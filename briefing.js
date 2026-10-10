/* One shared, same-origin snapshot per page. No polling, upstream calls or location transmission. */
(function () {
  'use strict';
  const ENDPOINT = '/api/briefing';
  const STALE_AFTER_MS = 14 * 60 * 60 * 1000;
  const LOCATION_KEY = 'oz-briefing-broad-location-v1';
  const STATES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',AS:'American Samoa',GU:'Guam',MP:'Northern Mariana Islands',PR:'Puerto Rico',VI:'U.S. Virgin Islands'};
  const CATEGORY_NAMES = {'severe-weather':'Severe weather','weather':'Weather','flooding':'Flooding','flood':'Flooding','earthquake':'Earthquakes','earthquakes':'Earthquakes','wildfire':'Wildfire','wildfire-smoke':'Wildfire & smoke','extreme-heat':'Extreme heat','extreme-cold':'Extreme cold','tropical-weather':'Tropical weather','utilities':'Utilities','public-health':'Public health','health':'Public health','conflict':'Civilian safety','civilian-safety':'Civilian safety','preparedness':'Preparedness','recall':'Product recalls','cyber':'Cybersecurity','news':'Reported news','other':'Other source reports'};
  const plain = (value, max = 6000) => typeof value === 'string' ? value.slice(0, max) : '';
  const excerpt = (value, max = 360) => { const text = plain(value); return text.length > max ? text.slice(0,max).replace(/\s+\S*$/, '') + '…' : text; };
  const parseDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  function stamp(value) {
    const date = parseDate(value);
    if (date === null) return 'Not provided';
    return new Date(date).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}) + ' UTC';
  }
  function externalUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function guideUrl(value) {
    return typeof value === 'string' && /^\/(?:emergencies|preparedness|guides)\/[a-z0-9-]+\/$/.test(value) ? value : null;
  }
  function categoryName(value) {
    const name = plain(value, 80);
    return CATEGORY_NAMES[name] || name.replace(/[-_]/g, ' ').replace(/^\w/, letter => letter.toUpperCase()) || 'Other source reports';
  }
  function sourceKind(event) { return event.source?.kind === 'official' ? 'Official source snapshot' : 'Reported news'; }
  function broadLocation(event) {
    return ['US','International'].includes(event.location?.scope) ? event.location.scope : 'Unknown';
  }
  function locationLabel(event) {
    if (broadLocation(event) === 'Unknown') return 'Location unknown';
    return plain(event.location?.label, 300) || (broadLocation(event) === 'US' ? 'United States · area not specified' : 'International · area not specified');
  }
  function sourceStates(event) {
    return broadLocation(event) === 'US' && Array.isArray(event.location?.codes) ? event.location.codes.filter(code => Object.hasOwn(STATES, code)) : [];
  }
  function recordState(event, now = Date.now()) {
    if (event.status === 'cancelled' || parseDate(event.cancelledAt) !== null) return {label:'Source cancellation recorded',note:'The source recorded a cancellation. This does not establish current safety; check the source for newer instructions.'};
    if (event.status === 'expired' || (parseDate(event.expiresAt) !== null && parseDate(event.expiresAt) <= now)) return {label:'Source validity time has passed',note:'This record’s source validity time has passed. That does not mean the threat has ended. Check the current source.'};
    if (event.status === 'no-longer-listed') return {label:'No longer in the source feed',note:'The record was absent from the latest source feed. Its absence is not an all-clear; check current source information.'};
    if (event.status === 'archived') return {label:'Archived source record',note:'This retained record is historical context. It does not establish current conditions or that a threat has ended.'};
    if (parseDate(event.endsAt) !== null && parseDate(event.endsAt) <= now) return {label:'Source end time has passed',note:'The end time listed by the source has passed. Verify current conditions; this time is not confirmation that a threat has ended.'};
    return {label:'Stored source report',note:''};
  }
  function snapshotState(snapshot, now = Date.now()) {
    const last = parseDate(snapshot.lastSuccessfulAt);
    const issues = snapshot.sources.filter(source => source.status !== 'ok' || source.coverage?.status === 'partial' || parseDate(source.lastSuccessAt) === null || now - parseDate(source.lastSuccessAt) > STALE_AFTER_MS);
    const stale = last === null || now - last > STALE_AFTER_MS;
    const successful = snapshot.sources.some(source => source.status === 'ok');
    const unavailable = snapshot.storageStatus === 'unavailable' || snapshot.sources.length === 0 || (!successful && !snapshot.events.length && last === null);
    const state = unavailable || snapshot.storageStatus === 'unavailable' ? 'unavailable' : stale ? 'stale' : issues.length || snapshot.storageStatus === 'initial-snapshot' ? 'partial' : 'current';
    const lead = unavailable ? 'Snapshot unavailable. Current conditions are unknown.' : stale ? 'Snapshot is out of date. Current conditions may have changed.' : issues.length ? 'Partial source coverage. Some source checks or record coverage are incomplete.' : 'Latest stored snapshot. Conditions may have changed since the source checks.';
    return {state, text:lead + ' Last successful refresh: ' + stamp(snapshot.lastSuccessfulAt) + '. Snapshot generated: ' + stamp(snapshot.generatedAt) + '.'};
  }
  function nextTransitionAt(snapshot, now = Date.now()) {
    const deadlines = [];
    const add = (value, offset = 0) => { const at = parseDate(value); if (at !== null && at + offset > now) deadlines.push(at + offset); };
    // Freshness uses strict greater-than, so transition one millisecond after 14h.
    add(snapshot.lastSuccessfulAt, STALE_AFTER_MS + 1);
    for (const source of snapshot.sources) add(source.lastSuccessAt, STALE_AFTER_MS + 1);
    for (const event of snapshot.events) {
      add(event.expiresAt); add(event.endsAt); add(event.lastCheckedAt, STALE_AFTER_MS + 1);
    }
    return deadlines.length ? Math.min(...deadlines) : null;
  }
  function normalizeSnapshot(input) {
    if (!input || input.schemaVersion !== 1 || !Array.isArray(input.events) || !Array.isArray(input.sources)) throw Error('Unsupported snapshot');
    const events = input.events.filter(event => event && typeof event.id === 'string' && event.id.length > 0 && typeof event.title === 'string' && event.title.trim() && event.source && ['official','news'].includes(event.source.kind) && externalUrl(event.url) && (event.source.kind !== 'news' || (plain(event.attribution).trim() && externalUrl(event.source.licenseUrl) && externalUrl(event.source.rightsUrl)))).slice(0, 500);
    const sources = input.sources.filter(source => source && typeof source.id === 'string' && typeof source.name === 'string').slice(0, 100);
    return {...input,events,sources,invalidRecords:input.events.length - events.length};
  }
  function filterEvents(events, category, location) {
    return events.filter(event => (category === 'all' || event.category === category) && (location === 'all' || (location.startsWith('US:') ? sourceStates(event).includes(location.slice(3)) : broadLocation(event) === location)));
  }
  function exactGuides(event) {
    const found = new Set();
    return (Array.isArray(event.guides) ? event.guides : []).filter(guide => guide && guideUrl(guide.url) && plain(guide.title) && !found.has(guide.url) && found.add(guide.url)).slice(0, 4);
  }
  function eventUrl(event) { return '/briefing/event/?id=' + encodeURIComponent(event.id); }
  function selectHomeEvents(snapshot, now = Date.now()) {
    const sources = new Map(snapshot.sources.map(source => [source.id, source]));
    const isCurrent = event => recordState(event,now).label === 'Stored source report';
    const sourceOkay = event => { const source = sources.get(event.source.id); const last = parseDate(source?.lastSuccessAt); return source?.status === 'ok' && last !== null && now-last <= STALE_AFTER_MS; };
    const current = snapshot.events.filter(isCurrent);
    const pool = (current.length >= 3 ? current : snapshot.events).slice();
    const selected = [], categories = new Set(), origins = new Set();
    const base = (a,b) => Number(!isCurrent(a))-Number(!isCurrent(b)) || Number(!sourceOkay(a))-Number(!sourceOkay(b));
    const rank = (a,b) => base(a,b) || Number(categories.has(a.category))-Number(categories.has(b.category)) || Number(origins.has(a.source.id))-Number(origins.has(b.source.id)) || (parseDate(b.updatedAt || b.publishedAt) || 0)-(parseDate(a.updatedAt || a.publishedAt) || 0) || a.id.localeCompare(b.id);
    while (selected.length < 3 && pool.length) {
      pool.sort(rank);
      const eligible = pool.filter(event => !selected.some(item => item.source.kind === 'news') || event.source.kind !== 'news');
      if (!eligible.length) break;
      let next = eligible[0];
      if (!selected.length) next = eligible.find(event => event.source.kind === 'official' && base(event,next) === 0) || next;
      // One current, recently checked news report can broaden the context without
      // displacing fresher official information or elevating an expired record.
      if (selected.length === 1) next = eligible.find(event => event.source.kind === 'news' && base(event,next) === 0) || next;
      selected.push(next); categories.add(next.category); origins.add(next.source.id);
      pool.splice(pool.indexOf(next),1);
    }
    return selected;
  }
  const helpers = {STALE_AFTER_MS,LOCATION_KEY,STATES,stamp,externalUrl,guideUrl,categoryName,sourceKind,broadLocation,locationLabel,sourceStates,recordState,snapshotState,normalizeSnapshot,filterEvents,exactGuides,eventUrl,selectHomeEvents,nextTransitionAt};
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;
  const roots = [...document.querySelectorAll('[data-briefing]')];
  if (!roots.length) return;
  for (const root of roots) root.querySelector('[data-briefing-status]').textContent = 'Checking the latest stored snapshot…';

  // Keep live DOM nodes stable: time changes must not reset filters, pagination,
  // section navigation, selection or focus. Detached labels are pruned on refresh.
  const timedLabels = new Set();
  function watchLabel(node, readText, hideWhenEmpty = false) {
    const update = () => {
      const text = readText();
      if (node.textContent !== text) node.textContent = text;
      if (hideWhenEmpty) node.hidden = !text;
    };
    update(); timedLabels.add({node,update}); return node;
  }
  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function link(text, href, className = '') {
    const element = el('a', className, text);
    element.href = href;
    if (href.startsWith('https://')) element.rel = 'noopener noreferrer';
    return element;
  }
  function timeLine(label, value) { return el('span', '', label + ': ' + stamp(value)); }
  function safeTextList(value) { return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, 12).map(item => plain(item)) : []; }
  function sourceCheck(event, snapshot) {
    const source = snapshot.sources.find(source => source.id === event.source.id);
    if (source && source.status === 'unavailable') return 'Source unavailable; retained report.';
    if (source && (source.status === 'stale' || parseDate(source.lastSuccessAt) === null || Date.now() - parseDate(source.lastSuccessAt) > STALE_AFTER_MS)) return 'Source refresh overdue; retained report.';
    if (parseDate(event.lastCheckedAt) === null || Date.now() - parseDate(event.lastCheckedAt) > STALE_AFTER_MS) return 'Source check overdue; retained report.';
    return '';
  }
  function attributionBlock(event) {
      const attribution = el('p', 'briefing-attribution', plain(event.attribution, 1200) || plain(event.source.name,160) + ' · Reported news; open the source for author and publisher attribution.');
      const attributionLinks = el('span', 'briefing-attribution-links');
      attributionLinks.append(link(plain(event.source.name,160) + ' · original ↗', externalUrl(event.url)));
      const license = externalUrl(event.source.licenseUrl);
      if (license) attributionLinks.append(link('Reuse license ↗',license));
      attribution.append(attributionLinks); return attribution;
  }
  function card(event, snapshot) {
    const article = el('article', 'briefing-card');
    const top = el('div', 'briefing-card-top');
    top.append(el('span', 'briefing-category', categoryName(event.category)), el('span', 'briefing-source-kind', sourceKind(event)));
    const title = el('h3'); title.append(link(plain(event.title, 500), eventUrl(event)));
    article.append(top, el('p', 'briefing-location', locationLabel(event)), title);
    if (event.source.kind === 'news') article.append(attributionBlock(event));
    article.append(el('p', 'briefing-card-summary', excerpt(event.summary) || 'Open the original source for the available report details.'));
    article.append(watchLabel(el('p', 'briefing-record-note'), () => { const state = recordState(event); return state.note ? state.label + '. This is not an all-clear.' : ''; }, true));
    article.append(watchLabel(el('p', 'briefing-record-note'), () => sourceCheck(event,snapshot), true));
    const times = el('div', 'briefing-card-time');
    times.append(el('span', '', plain(event.source.name, 120)), timeLine('Source date', event.updatedAt || event.publishedAt), timeLine('Last checked', event.lastCheckedAt));
    const actions = el('div', 'briefing-card-links');
    actions.append(link('Read the brief →', eventUrl(event)));
    const guide = exactGuides(event)[0];
    if (guide) actions.append(link(plain(guide.title, 120) + ' ↗', guide.url));
    article.append(times, actions);
    return article;
  }
  function updateStatus(root, snapshot) {
    const status = root.querySelector('[data-briefing-status]');
    const current = snapshotState(snapshot);
    status.setAttribute('data-state', current.state);
    const text = current.text + (snapshot.storageNote ? ' ' + plain(snapshot.storageNote, 2000) : '') + (snapshot.invalidRecords ? ' Some records could not be displayed; coverage is incomplete.' : '') + (root.getAttribute('data-briefing') === 'home' && !snapshot.events.length ? ' No source reports are available in this snapshot. This is not an all-clear.' : '');
    if (status.textContent !== text) status.textContent = text;
  }
  function showFailure(root) {
    const status = root.querySelector('[data-briefing-status]');
    status.setAttribute('data-state', 'unavailable');
    status.textContent = 'The stored snapshot could not be loaded. Current conditions are unknown. Check the original sources or use the planning guides below.';
    const detail = root.querySelector('[data-briefing-detail-fallback]');
    if (detail) detail.textContent = 'This report could not be loaded. That does not mean the event is over. Return to the briefing or verify current information through trusted sources safe for you to contact.';
    const intro = root.querySelector('.briefing-fallback-intro');
    if (intro) intro.textContent = 'The source snapshot is unavailable. These general planning guides remain useful.';
  }
  function health(root, snapshot) {
    const wrapper = root.querySelector('[data-briefing-source-health]');
    if (!wrapper) return;
    const contents = root.querySelector('[data-briefing-sources]');
    const list = el('ul');
    for (const source of snapshot.sources) {
      const item = el('li');
      const title = el('strong');
      const url = externalUrl(source.website);
      title.append(url ? link(plain(source.name, 160), url) : el('span', '', plain(source.name, 160)));
      const statusLabel = watchLabel(el('span'), () => {
        const overdue = parseDate(source.lastSuccessAt) === null || Date.now() - parseDate(source.lastSuccessAt) > STALE_AFTER_MS;
        const status = source.status === 'ok' && !overdue ? 'Source check succeeded' : source.status === 'stale' || overdue && source.status !== 'unavailable' ? 'Source is stale; older records may be retained' : 'Source is unavailable; current conditions unknown';
        return status + '. Last success: ' + stamp(source.lastSuccessAt) + '. Last attempt: ' + stamp(source.lastAttemptAt) + '.';
      });
      item.append(title,statusLabel);
      if (typeof source.coverage === 'string') item.append(el('p', '', plain(source.coverage, 1000)));
      else if (source.coverage?.label) item.append(el('p', '', plain(source.coverage.label, 1000)));
      if (Number.isFinite(source.coverage?.storedCount) && Number.isFinite(source.coverage?.receivedCount)) item.append(el('p', '', source.coverage.storedCount + ' records stored from ' + source.coverage.receivedCount + ' source records received; storage cap ' + source.coverage.limit + ' per source. Relevance, rights and validation filters can reduce this further.'));
      if (source.coverage?.status === 'partial') item.append(el('p', '', 'Partial source coverage. Some records were omitted or unavailable.'));
      for (const warning of safeTextList(source.coverage?.warnings)) item.append(el('p', '', warning));
      // Operational errors are summarized rather than displaying provider internals.
      if (source.error) item.append(el('p', '', 'The latest source refresh reported an error. Check its original website for current information.'));
      list.append(item);
    }
    contents.replaceChildren();
    if (snapshot.coverage) contents.append(el('p', '', plain(snapshot.coverage, 1800)));
    contents.append(list, el('p', '', 'A successful check confirms access to a source, not complete coverage or current safety.'));
    wrapper.hidden = false;
  }
  function renderHome(root, snapshot) {
    const cards = root.querySelector('[data-briefing-cards]');
    const records = selectHomeEvents(snapshot);
    cards.replaceChildren(...records.map(event => card(event, snapshot)));
    cards.hidden = !records.length;
    root.querySelector('[data-briefing-fallback]').hidden = Boolean(records.length);
  }
  function option(value, label) { const node = el('option', '', label); node.value = value; return node; }
  function renderIndex(root, snapshot) {
    const filters = root.querySelector('[data-briefing-filters]');
    const category = root.querySelector('[data-briefing-category]');
    const location = root.querySelector('[data-briefing-location]');
    const reset = root.querySelector('[data-briefing-reset]');
    const cards = root.querySelector('[data-briefing-cards]');
    const count = root.querySelector('[data-briefing-count]');
    const empty = root.querySelector('[data-briefing-empty]');
    const fallback = root.querySelector('[data-briefing-fallback]');
    const more = root.querySelector('[data-briefing-more]');
    let limit = 18;
    const categories = [...new Set(snapshot.events.map(event => plain(event.category, 80)).filter(Boolean))].sort((a,b) => categoryName(a).localeCompare(categoryName(b)));
    category.replaceChildren(option('all','All categories'), ...categories.map(value => option(value,categoryName(value))));
    const states = [...new Set(snapshot.events.flatMap(sourceStates))].sort((a,b) => STATES[a].localeCompare(STATES[b]));
    location.replaceChildren(option('all','All locations'), option('US','United States'), ...states.map(code => option('US:' + code, STATES[code])), option('International','International'), option('Unknown','Location unknown'));
    category.value = 'all'; location.value = 'all';
    try {
      const stored = localStorage.getItem(LOCATION_KEY);
      if (['all','US','International','Unknown',...states.map(code => 'US:' + code)].includes(stored)) location.value = stored;
    } catch { /* Reading may be blocked in private/restricted browsing. */ }
    function render() {
      const matches = filterEvents(snapshot.events, category.value, location.value);
      cards.replaceChildren(...matches.slice(0,limit).map(event => card(event, snapshot)));
      if (more) { more.hidden = matches.length <= limit; more.textContent = 'Show more reports (' + Math.max(0,matches.length-limit) + ' remaining)'; }
      cards.hidden = !matches.length;
      count.textContent = (matches.length > limit ? `${limit} of ${matches.length} reports shown` : `${matches.length} ${matches.length === 1 ? 'report' : 'reports'} shown`) + ` · ${snapshot.events.length} in this snapshot`;
      empty.replaceChildren(); empty.hidden = Boolean(matches.length);
      if (!matches.length) {
        empty.append(el('h3','',snapshot.events.length ? 'No reports match these filters.' : 'No reports are available in this snapshot.'), el('p','','This is not an all-clear. Coverage is limited, and location details may be unknown. Check current source information; use the planning guides below.'));
      }
      fallback.hidden = Boolean(matches.length);
      const intro = root.querySelector('.briefing-fallback-intro');
      if (intro) intro.textContent = 'Prepare ahead with the household essentials.';
    }
    category.addEventListener('change', () => { limit = 18; render(); });
    if (more) more.addEventListener('click', () => { const firstNew = limit; limit += 18; render(); cards.children[firstNew]?.querySelector('h3 a')?.focus(); });
    location.addEventListener('change', () => {
      try { localStorage.setItem(LOCATION_KEY, location.value); } catch { /* Filtering still works without persistence. */ }
      limit = 18; render();
    });
    reset.addEventListener('click', () => {
      category.value = 'all'; location.value = 'all'; limit = 18;
      try { localStorage.removeItem(LOCATION_KEY); } catch { /* No persistence required. */ }
      render();
    });
    filters.hidden = false;
    render(); health(root, snapshot);
  }
  function section(id, title) {
    const node = el('section', 'briefing-detail-section'); node.id = id;
    node.setAttribute('aria-labelledby', id + '-title');
    const heading = el('h2', '', title); heading.id = id + '-title'; node.append(heading);
    return node;
  }
  function fact(list, label, value) {
    const group = el('div'), description = el('dd','',value); group.append(el('dt','',label),description); list.append(group); return description;
  }
  function renderDetail(root, snapshot) {
    const id = new URLSearchParams(window.location.search).get('id');
    const event = snapshot.events.find(event => event.id === id);
    if (!event) {
      root.querySelector('[data-briefing-detail-fallback]').textContent = 'This report is not in the available snapshot. It may have changed, expired or been removed from the source. Its absence is not an all-clear. Check current source information or browse the latest briefing.';
      return;
    }
    const target = root.querySelector('[data-briefing-detail]');
    const header = el('header','briefing-detail-header');
    header.append(el('p','briefing-category',categoryName(event.category)),el('span','briefing-source-kind',sourceKind(event)),el('h1','',plain(event.title, 500)));
    header.append(watchLabel(el('p','briefing-record-note'), () => recordState(event).note, true));
    header.append(watchLabel(el('p','briefing-record-note'), () => sourceCheck(event,snapshot), true));
    const jumps = el('nav','briefing-detail-jumps'); jumps.setAttribute('aria-label','On this page');
    for (const [id,label] of [['at-a-glance','At a glance'],['what-this-means','What this means'],['official-instructions','Official instructions'],['preparedness-steps','Preparedness next steps'],['related-guides','Related guides'],['sources-updates','Sources and updates']]) jumps.append(link(label,'#' + id));
    if (event.source.kind === 'news') header.append(attributionBlock(event));
    header.append(jumps);
    const glance = section('at-a-glance','At a glance');
    glance.append(el('p','',plain(event.summary) || 'The source did not provide a report summary. Read the original source for its available details.'));
    const facts = el('dl','briefing-facts');
    fact(facts,'Reported location',locationLabel(event));
    fact(facts,'Source',plain(event.source.name,160) + ' · ' + sourceKind(event));
    fact(facts,'Published by source',stamp(event.publishedAt));
    fact(facts,'Updated by source',stamp(event.updatedAt));
    fact(facts,'Last source check',stamp(event.lastCheckedAt));
    watchLabel(fact(facts,'Record status',''), () => recordState(event).label);
    if (event.expiresAt) fact(facts,'Source validity / expiry time',stamp(event.expiresAt));
    if (event.endsAt) fact(facts,'End time listed by source',stamp(event.endsAt));
    glance.append(facts);
    const meaning = section('what-this-means','What this means');
    meaning.append(el('p','',plain(event.whatThisMeans) || 'This is a stored source report. Verify its location, time and current source instructions before applying it to your situation.'), el('p','briefing-reviewed-note','Osprey Zero editorial context. It does not establish local conditions, an evacuation order or access to assistance.'));
    const official = section('official-instructions','Official instructions');
    const panel = el('div','briefing-official-panel');
    const hasInstructions = event.source.kind === 'official' && plain(event.instructions).trim();
    if (hasInstructions) {
      panel.append(el('p','briefing-reviewed-note','Instructions supplied by ' + plain(event.source.name,160) + ' in this stored source report. Check the original for changes.'),el('p','briefing-official-text',plain(event.instructions,16000)));
    } else {
      panel.append(el('p','',event.instructionsOmitted ? 'The source instructions exceeded this briefing’s display limit and were omitted in full to avoid presenting an incomplete directive. Open the original source for the complete instructions.' : event.source.kind === 'news' ? 'This reported-news record does not supply official instructions. Reporting is not an evacuation, shelter or medical order.' : 'No instruction text is included in this source record. This does not mean that no protective action is needed.'));
    }
    panel.append(link('Read the current original source ↗',externalUrl(event.url)));
    official.append(panel);
    const steps = section('preparedness-steps','Reviewed preparedness next steps');
    steps.append(el('p','briefing-reviewed-note','General Osprey Zero preparedness guidance, drawn from reviewed library material. These are editorial planning steps, not instructions issued for this event. Match them to your household and follow current, applicable source instructions.'));
    const actions = safeTextList(event.preparedness);
    if (actions.length) { const list = el('ol'); for (const text of actions) list.append(el('li','',text)); steps.append(list); }
    else steps.append(el('p','','No reviewed preparedness steps are attached to this record. Use the original source and the linked guides for context.'));
    const related = section('related-guides','Related guides');
    const guides = exactGuides(event);
    if (guides.length) { const links = el('div','briefing-guide-links'); for (const guide of guides) { const node = link(plain(guide.title,200),guide.url); const arrow = el('span','','↗'); arrow.setAttribute('aria-hidden','true'); node.append(arrow); links.append(node); } related.append(links); }
    else related.append(el('p','','No exact guide mapping is available for this record.'));
    const sources = section('sources-updates','Sources and updates');
    const sourceList = el('ul','briefing-sources-list');
    const original = el('li'); original.append(link(plain(event.source.name,160) + ' · original report ↗',externalUrl(event.url)),el('small','','Source date: ' + stamp(event.updatedAt || event.publishedAt) + '. Last checked: ' + stamp(event.lastCheckedAt) + '.')); sourceList.append(original);
    for (const resource of (Array.isArray(event.resources) ? event.resources : []).slice(0,10)) {
      if (!resource || !externalUrl(resource.url) || !plain(resource.label)) continue;
      const item = el('li'); item.append(link(plain(resource.label,200) + ' ↗',externalUrl(resource.url))); sourceList.append(item);
    }
    const license = externalUrl(event.source.licenseUrl);
    if (license) { const item = el('li'); item.append(link('Source content license ↗',license)); sourceList.append(item); }
    const rights = externalUrl(event.source.rightsUrl);
    if (rights) { const item = el('li'); item.append(link(plain(event.source.rightsLabel,180) || 'Source reuse and attribution',rights)); sourceList.append(item); }
    sources.append(sourceList);
    const updates = (Array.isArray(event.updates) ? event.updates : []).filter(update => update && plain(update.text)).slice(0,20);
    if (updates.length) {
      sources.append(el('h3','','Record history'));
      const list = el('ul','briefing-sources-list');
      for (const update of updates) { const item = el('li','',''); item.append(el('small','',stamp(update.at)),el('span','',plain(update.text,1000))); list.append(item); }
      sources.append(list);
    }
    sources.append(el('p','briefing-reviewed-note','Snapshot generated: ' + stamp(snapshot.generatedAt) + '. Last successful refresh: ' + stamp(snapshot.lastSuccessfulAt) + '. Scheduled twice daily at 00:00 and 12:00 UTC. An expired, removed or unavailable record does not establish that a threat has ended.'));
    target.replaceChildren(header,glance,meaning,official,steps,related,sources);
    target.hidden = false; root.querySelector('[data-briefing-fallback]').hidden = true;
    document.title = plain(event.title,180) + ' — Osprey Zero briefing';
  }

  function trackLocalTime(snapshot) {
    let timer = null;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const refresh = () => {
      for (const root of roots) updateStatus(root,snapshot);
      for (const binding of timedLabels) {
        if (binding.node.isConnected === false) timedLabels.delete(binding);
        else binding.update();
      }
    };
    const schedule = () => {
      clear();
      if (document.hidden) return;
      const now = Date.now(), next = nextTransitionAt(snapshot,now);
      if (next !== null) timer = setTimeout(() => { timer = null; refresh(); schedule(); }, Math.min(next-now,2147483647));
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clear();
      else { refresh(); schedule(); }
    });
    window.addEventListener('pageshow', () => { refresh(); schedule(); });
    // This is a deadline timer for this stored snapshot, never a refresh request
    // or periodic source polling. There is no timer once all boundaries pass.
    schedule();
  }

  // A failed or slow request leaves the static, readable planning fallback in place.
  // Only one request is made. Filtering and saved broad preferences never reach a server.
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 12000) : null;
  const request = fetch(ENDPOINT, {credentials:'omit',headers:{Accept:'application/json'},...(controller ? {signal:controller.signal} : {})})
    .then(response => { if (!response.ok) throw Error('Snapshot unavailable'); return response.json(); })
    .then(normalizeSnapshot);
  request.then(snapshot => {
    for (const root of roots) {
      updateStatus(root,snapshot);
      const mode = root.getAttribute('data-briefing');
      if (mode === 'home') renderHome(root,snapshot);
      else if (mode === 'index') renderIndex(root,snapshot);
      else if (mode === 'event') renderDetail(root,snapshot);
    }
    trackLocalTime(snapshot);
  }).catch(() => roots.forEach(showFailure)).finally(() => { if (timeout !== null) clearTimeout(timeout); });
}());
