/* One shared, same-origin snapshot per page. No polling, upstream calls or location transmission. */
(function () {
  'use strict';
  const ENDPOINT = '/api/briefing';
  const STALE_AFTER_MS = 14 * 60 * 60 * 1000;
  const LOCATION_KEY = 'oz-briefing-broad-location-v1';
  const ZIP_KEY = 'oz-briefing-zip-v1';
  const ZIP_DATA_URL = '/briefing/zip-areas.json';
  const RETURN_KEY = 'oz-briefing-return-v1';
  const AREA_KEY = 'oz-daily-brief-area-v1';
  const GEO_ATTEMPT_KEY = 'oz-daily-brief-location-attempt-v1';
  const PLACE_DATA_URL = '/briefing/place-areas.json';
  const COUNTY_DATA_URL = '/briefing/county-geometry.json';
  const GEO_DEADLINE_MS = 15000;
  const PAGE_SIZE = 6;
  const AREA_CHOICES_MAX = 20;
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
  function shortStamp(value) {
    const date = parseDate(value);
    return date === null ? 'date unknown' : new Date(date).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}) + ' UTC';
  }
  function displayTitle(event) { return plain(event.displayTitle,500).trim() || plain(event.title,500); }
  function displaySummary(event) { return plain(event.displaySummary,1200).trim() || 'Read the linked source for this report’s full details.'; }
  function sourceUrl(event) { return externalUrl(event.sourceUrl) || externalUrl(event.url); }
  function isCurrentRelevant(event, now = Date.now()) { return recordState(event,now).label === 'Stored source report' && event.relevance !== 'background'; }
  function prioritizeEvents(events, sources = [], now = Date.now()) {
    const sourceMap = new Map(sources.map(source => [source.id,source]));
    const fresh = event => { const source = sourceMap.get(event.source.id); const at = parseDate(source?.lastSuccessAt); return source?.status === 'ok' && at !== null && now-at <= STALE_AFTER_MS; };
    const base = (a,b) => Number(!isCurrentRelevant(a,now))-Number(!isCurrentRelevant(b,now)) || Number(!fresh(a))-Number(!fresh(b));
    const latest = (a,b) => (parseDate(b.updatedAt || b.publishedAt)||0)-(parseDate(a.updatedAt || a.publishedAt)||0) || a.id.localeCompare(b.id);
    const pool = events.slice(), selected = [], categories = new Set(), origins = new Set();
    while (selected.length < PAGE_SIZE && pool.length) {
      pool.sort((a,b) => base(a,b) || Number(categories.has(a.category))-Number(categories.has(b.category)) || Number(a.source.kind==='news')-Number(b.source.kind==='news') || Number(origins.has(a.source.id))-Number(origins.has(b.source.id)) || latest(a,b));
      const next = pool.shift(); selected.push(next); categories.add(next.category); origins.add(next.source.id);
    }
    return selected.concat(pool.sort((a,b)=>base(a,b)||latest(a,b)));
  }
  function validViewState(value, now = Date.now()) {
    if (!value || value.version !== 1 || value.path !== '/briefing/' || !Number.isFinite(value.at) || now-value.at > 86400000 || value.at > now+60000) return null;
    const limits = {};
    for (const key of ['all','local','products','other']) limits[key] = Number.isInteger(value.limits?.[key]) ? Math.max(PAGE_SIZE,Math.min(1000,value.limits[key])) : PAGE_SIZE;
    return {...value,area:validArea(value.area),zip:/^\d{5}$/.test(value.zip || '')?value.zip:'',category:plain(value.category,80),location:plain(value.location,40),group:['all','local','products','other'].includes(value.group)?value.group:'all',includeHistory:value.includeHistory===true,limits,scrollY:Number.isFinite(value.scrollY)?Math.max(0,Math.min(1e7,value.scrollY)):0,focusHref:typeof value.focusHref==='string' && /^\/briefing\/event\/\?id=[a-zA-Z0-9_%.-]+$/.test(value.focusHref)?value.focusHref:null};
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
    const events = input.events.filter(event => event && typeof event.id === 'string' && event.id.length > 0 && typeof event.title === 'string' && event.title.trim() && event.source && ['official','news'].includes(event.source.kind) && externalUrl(event.url) && (event.source.kind !== 'news' || (plain(event.attribution).trim() && externalUrl(event.source.licenseUrl) && externalUrl(event.source.rightsUrl)))).slice(0, 1000);
    const sources = input.sources.filter(source => source && typeof source.id === 'string' && typeof source.name === 'string').slice(0, 100);
    return {...input,events,sources,invalidRecords:input.events.length - events.length};
  }
  function filterEvents(events, category, location) {
    return events.filter(event => (category === 'all' || event.category === category) && (location === 'all' || (location.startsWith('US:') ? sourceStates(event).includes(location.slice(3)) : broadLocation(event) === location)));
  }
  // Only allowlisted derived area fields can enter local/history storage. Never coordinates.
  function validArea(value) {
    if (!value || !['zip','city','geolocation'].includes(value.kind) || typeof value.label !== 'string' || !Array.isArray(value.counties) || !value.counties.length || value.counties.length > 100) return null;
    const counties = value.counties.map(county => ({code:plain(county?.code,5),name:plain(county?.name,120),state:plain(county?.state,2)}));
    if (counties.some(county => !/^\d{5}$/.test(county.code) || !county.name || !Object.hasOwn(STATES,county.state) || county.state === 'CT')) return null;
    return {kind:value.kind,label:plain(value.label,400),counties,approximate:true,...(value.kind === 'zip' && /^\d{5}$/.test(value.zip || '') ? {zip:value.zip} : {})};
  }
  function stateQuery(value) {
    const query = plain(value,120).trim().toLowerCase().replace(/\./g,'');
    return Object.keys(STATES).find(code => code.toLowerCase() === query || STATES[code].toLowerCase() === query) || null;
  }
  function resolveZipArea(data, value) {
    const zip = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{5}$/.test(zip)) return {status:'invalid',zip};
    if (!data || data.schemaVersion !== 1 || !data.zipAreas || !data.counties || !data.states) throw Error('Unsupported ZIP mapping');
    const codes = data.zipAreas[zip];
    if (!Array.isArray(codes) || !codes.length) return {status:'unmapped',zip};
    const counties = [...new Set(codes)].filter(code => typeof code === 'string' && /^\d{5}$/.test(code)).map(code => ({code,...data.counties[code]}));
    if (counties.length !== new Set(codes).size || counties.some(county => !county.name || !data.states[county.state])) return {status:'unmapped',zip};
    if (counties.some(county => (data.unsupportedStates || []).includes(county.state))) return {status:'unsupported',zip,counties};
    return {status:'found',kind:'zip',zip,counties,label:counties.map(county => county.name + ', ' + county.state).join('; '),vintage:plain(data.source?.vintage,30)};
  }
  function partitionAreaEvents(events, area, location) {
    const groups = {local:[],products:[],other:[]};
    const counties = new Set(area?.counties?.map(county => county.code) || []);
    for (const event of events) {
      const official = event.source?.kind === 'official';
      if (official && ['cpsc','fda','cisa-kev'].includes(event.source.id)) groups.products.push(event);
      else if (area ? official && ['nws','nws-cancellations'].includes(event.source.id) && Array.isArray(event.geo?.countyFips) && event.geo.countyFips.some(code => counties.has(code)) : sourceStates(event).includes(location.slice(3))) groups.local.push(event);
      else groups.other.push(event);
    }
    return groups;
  }
  function exactGuides(event) {
    const found = new Set();
    return (Array.isArray(event.guides) ? event.guides : []).filter(guide => guide && guideUrl(guide.url) && plain(guide.title) && !found.has(guide.url) && found.add(guide.url)).slice(0, 4);
  }
  function eventUrl(event) { return '/briefing/event/?id=' + encodeURIComponent(event.id); }
  function selectHomeEvents(snapshot, now = Date.now()) {
    const records = prioritizeEvents(snapshot.events.filter(event=>isCurrentRelevant(event,now)),snapshot.sources,now);
    const selected = [];
    for (const event of records) {
      if (event.source.kind === 'news' && selected.some(item=>item.source.kind==='news')) continue;
      selected.push(event); if (selected.length === 3) break;
    }
    return selected;
  }
  const helpers = {AREA_KEY,GEO_ATTEMPT_KEY,PLACE_DATA_URL,COUNTY_DATA_URL,GEO_DEADLINE_MS,validArea,stateQuery,PAGE_SIZE,RETURN_KEY,shortStamp,displayTitle,displaySummary,sourceUrl,isCurrentRelevant,prioritizeEvents,validViewState,STALE_AFTER_MS,LOCATION_KEY,ZIP_KEY,ZIP_DATA_URL,resolveZipArea,partitionAreaEvents,STATES,stamp,externalUrl,guideUrl,categoryName,sourceKind,broadLocation,locationLabel,sourceStates,recordState,snapshotState,normalizeSnapshot,filterEvents,exactGuides,eventUrl,selectHomeEvents,nextTransitionAt};
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;
  const roots = [...document.querySelectorAll('[data-briefing]')];
  if (!roots.length) return;
  for (const root of roots) root.querySelector('[data-briefing-status]').textContent = 'Checking the latest stored snapshot…';

  // Keep live DOM nodes stable: time changes must not reset filters, pagination,
  // section navigation, selection or focus. Detached labels are pruned on refresh.
  const timedLabels = new Set();
  const localTimeListeners = new Set();
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
  function readingLink(title,href) {
    const anchor=link('',href),icon=el('span','briefing-reading-icon'),arrow=el('span','briefing-reading-arrow','↗');
    icon.setAttribute('aria-hidden','true');arrow.setAttribute('aria-hidden','true');
    anchor.append(icon,el('span','briefing-reading-title',title),arrow);return anchor;
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
  function sourceLine(event) {
    const line = el('p','briefing-card-source');
    const alias = {nws:'NWS','nws-cancellations':'NWS',usgs:'USGS',fda:'FDA',cpsc:'CPSC','cisa-kev':'CISA'}[event.source.id] || plain(event.source.name,160);
    const source = link(alias,sourceUrl(event));
    source.setAttribute('aria-label',alias + ' · ' + plain(event.source.name,160) + ': ' + (plain(event.sourceLinkLabel,180) || 'Open original source'));
    line.append(el('span','',event.source.kind === 'official' ? 'Official · ' : 'Reported news · '),source,el('span','',' · checked ' + shortStamp(event.lastCheckedAt)));
    return line;
  }
  function card(event, snapshot) {
    const article = el('article', 'briefing-card'); article.setAttribute('data-record-id',event.id);
    const title = el('h3'); title.append(link(displayTitle(event), eventUrl(event)));
    article.append(el('p', 'briefing-category', categoryName(event.category)+(event.relevance==='background'?' · background':'')),title);
    // Required author, original story and license stay above every news excerpt.
    article.append(sourceLine(event),el('p','briefing-card-area',excerpt(locationLabel(event),105)));
    if (event.source.kind === 'news') article.append(attributionBlock(event));
    const summary=el('p','briefing-card-summary');
    if(event.displaySummaryKind==='source-metadata')summary.append(el('span','briefing-summary-label','Source record: '));
    summary.append(el('span','',displaySummary(event) || 'Open the original source for the available report details.'));article.append(summary);
    const meaning = plain(event.cardMeaning,420).trim();
    if (meaning) { const context = el('p','briefing-card-meaning'); context.append(el('strong','','For you: '),el('span','',meaning)); article.append(context); }
    if(event.category==='recall')article.append(link('Check product & remedy ↗',sourceUrl(event),'briefing-source-action'));
    const guides = exactGuides(event);
    if (guides.length) {
      const actions = el('nav', 'briefing-card-guides'); actions.setAttribute('aria-label','Relevant preparedness guides');
      actions.append(el('span','','Prepare for this'));
      for (const guide of guides) actions.append(readingLink(plain(guide.title,140),guide.url));
      article.append(actions);
    }
    article.append(watchLabel(el('p', 'briefing-record-note'), () => { const state = recordState(event); return state.note ? state.label + '. Not an all-clear.' : ''; }, true));
    article.append(watchLabel(el('p', 'briefing-record-note'), () => sourceCheck(event,snapshot), true));
    const metadata = el('details','briefing-card-metadata');
    metadata.append(el('summary','','Source details & dates'));
    const times = el('div','briefing-card-time');
    times.append(el('span','',sourceKind(event)),el('span','',locationLabel(event)),el('span','','Original headline: ' + plain(event.title,500)),link(plain(event.source.name,160) + ' ↗',sourceUrl(event)),timeLine('Source date',event.updatedAt || event.publishedAt),timeLine('Last checked',event.lastCheckedAt));
    if (event.geo?.incomplete || event.geo?.truncated) times.append(el('span','','Some source area identifiers were unavailable; the geographic list is incomplete.'));
    if(event.sourceUrlKind && event.sourceUrlKind!=='original-notice')times.append(link(event.sourceUrlKind==='source-catalog'?'CISA catalog (search by CVE) ↗':'Original source data record ↗',externalUrl(event.url)),el('span','',plain(event.sourceLinkLabel,180) || 'Current source page; not this exact notice.'));
    metadata.append(times);
    const footer = el('div','briefing-card-footer'); footer.append(link('Full brief →',eventUrl(event)),metadata);
    article.append(footer);
    return article;
  }
  function updateStatus(root, snapshot) {
    const status = root.querySelector('[data-briefing-status]'), detail = root.querySelector('[data-briefing-status-detail]');
    const current = snapshotState(snapshot); status.setAttribute('data-state',current.state);
    const lead = current.state === 'unavailable' ? 'Unavailable; conditions unknown.' : current.state === 'stale' ? 'Out of date; verify current sources.' : current.state === 'partial' ? 'Partial coverage.' : 'Limited coverage.';
    const text = lead + ' Checked ' + shortStamp(snapshot.lastSuccessfulAt) + '.' + (snapshot.storageStatus === 'initial-snapshot' ? ' Initial snapshot.' : '');
    if (status.textContent !== text) status.textContent = text;
    if (detail) detail.textContent = current.text + (snapshot.storageNote ? ' ' + plain(snapshot.storageNote,2000) : '') + (snapshot.invalidRecords ? ' Some records were omitted; coverage is incomplete.' : '') + ' An absent report is not an all-clear.';
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
      const coverage = source.coverage;
      if (coverage && typeof coverage === 'object') {
        const counts = [];
        if (Number.isFinite(coverage.publicCount)) counts.push(coverage.publicCount + ' records included in this snapshot');
        if (Number.isFinite(coverage.storedCount)) counts.push(coverage.storedCount + ' records stored, which may include prior retained records');
        if (Number.isFinite(coverage.receivedCount)) counts.push(coverage.receivedCount + ' source records received on the latest successful response');
        if (Number.isFinite(coverage.limit)) counts.push('source storage cap: ' + coverage.limit);
        if (coverage.sourceDroppedCount > 0) counts.push(coverage.sourceDroppedCount + ' records omitted at the source cap');
        if (coverage.publicDroppedCount > 0) counts.push(coverage.publicDroppedCount + ' stored records omitted from the public snapshot');
        if (counts.length) item.append(el('p','',counts.join('. ') + '. Relevance, rights and validation filters can reduce coverage further.'));
      }
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
  function renderHome(root,snapshot) {
    const cards=root.querySelector('[data-briefing-cards]');let signature='';
    const paint=()=>{
      const records=selectHomeEvents(snapshot),next=records.map(event=>event.id).join('|');
      if(next===signature&&signature)return;signature=next;
      const active=document.activeElement,candidate=active?.closest?.('.briefing-card'),article=candidate?.parentElement===cards?candidate:null,href=article?.querySelector('h3 a')?.getAttribute('href'),y=window.scrollY||0;
      cards.replaceChildren(...records.map(event=>card(event,snapshot)));cards.hidden=!records.length;root.querySelector('[data-briefing-fallback]').hidden=Boolean(records.length);
      if(href){const replacement=[...(cards.querySelectorAll?.('a[href]')||[])].find(node=>node.getAttribute('href')===href);if(replacement){replacement.focus({preventScroll:true});window.scrollTo?.({top:y,behavior:'instant'});}else{const status=root.querySelector('[data-briefing-status]');status.setAttribute('tabindex','-1');status.focus();}}
    };
    paint();localTimeListeners.add(paint);
  }
  function option(value, label) { const node = el('option', '', label); node.value = value; return node; }
  // Same-origin public lookup assets are shared per page; queries never enter requests.
  const areaDataRequests = new Map();
  function loadAreaData(url) {
    if (!areaDataRequests.has(url)) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timeout;
      const request = new Promise((resolve,reject)=>{
        timeout=setTimeout(()=>{controller?.abort();reject(Error('Area lookup timed out'));},12000);
        fetch(url,{credentials:'omit',headers:{Accept:'application/json'},...(controller ? {signal:controller.signal} : {})})
          .then(response=>{if(!response.ok)throw Error('Area mapping unavailable');return response.json();}).then(resolve,reject);
      }).catch(error=>{areaDataRequests.delete(url);throw error;}).finally(()=>clearTimeout(timeout));
      areaDataRequests.set(url,request);
    }
    return areaDataRequests.get(url);
  }
  function loadZipData() { return loadAreaData(ZIP_DATA_URL); }
  function hasLocationAttempt() {
    try { if (localStorage.getItem(GEO_ATTEMPT_KEY)) return true; } catch {}
    try { if (sessionStorage.getItem(GEO_ATTEMPT_KEY)) return true; } catch {}
    return false;
  }
  function rememberLocationAttempt() {
    // If storage is unavailable, an automatic prompt cannot safely remember a denial.
    try { localStorage.setItem(GEO_ATTEMPT_KEY,'1'); if (localStorage.getItem(GEO_ATTEMPT_KEY) === '1') return true; } catch {}
    try { sessionStorage.setItem(GEO_ATTEMPT_KEY,'1'); return sessionStorage.getItem(GEO_ATTEMPT_KEY) === '1'; } catch { return false; }
  }
  function readReturnState() {
    try { return validViewState(JSON.parse(sessionStorage.getItem(RETURN_KEY))); } catch { return null; }
  }
  function renderIndex(root, snapshot) {
    const get = key => root.querySelector('[data-briefing-' + key + ']');
    const filters=get('filters'),category=get('category'),location=get('location'),reset=get('reset'),options=get('options'),historyChoice=get('history'),historyLabel=get('history-label');
    const cards=get('cards'),count=get('count'),empty=get('empty'),fallback=get('fallback'),more=get('more'),groupNav=get('group-nav');
    const zipForm=get('zip-form'),zipInput=get('zip'),zipSubmit=get('zip-submit'),zipStatus=get('zip-status'),zipClear=get('zip-clear'),areaHeading=get('area-heading'),areaNote=get('area-note'),geoButton=get('geolocate'),choices=get('area-choices');
    let saved = null;
    try { saved = validViewState(window.history?.state?.ozBriefing); } catch { /* Optional history storage. */ }
    if (!saved) saved = readReturnState();
    try { sessionStorage.removeItem(RETURN_KEY); } catch { /* Optional handoff. */ }
    let geoTimer=null,geoPending=false;
    let area=null,zipAttempt=0,group=saved?.group || 'all',focusHref=saved?.focusHref || null,restoring=Boolean(saved),viewVersion=0;
    let restorePosition=saved?.scrollY ?? null;
    const limits={all:PAGE_SIZE,local:PAGE_SIZE,products:PAGE_SIZE,other:PAGE_SIZE,...saved?.limits};
    const categories=[...new Set(snapshot.events.map(event=>plain(event.category,80)).filter(Boolean))].sort((a,b)=>categoryName(a).localeCompare(categoryName(b)));
    category.replaceChildren(option('all','All categories'),...categories.map(value=>option(value,categoryName(value))));
    const states=Object.keys(STATES).sort((a,b)=>STATES[a].localeCompare(STATES[b]));
    const locations=['all','US','International','Unknown',...states.map(code=>'US:'+code)];
    location.replaceChildren(option('all','All locations'),option('US','United States'),...states.map(code=>option('US:'+code,STATES[code])),option('International','International'),option('Unknown','Location unknown'));
    category.value=categories.includes(saved?.category)?saved.category:'all'; location.value=locations.includes(saved?.location)?saved.location:'all';
    historyChoice.checked=saved?.includeHistory || false; options.open=saved?.optionsOpen || false;
    if (!saved) try { const stored=localStorage.getItem(LOCATION_KEY); if(locations.includes(stored))location.value=stored; } catch { /* No persistence needed. */ }
    function viewState() { return {version:1,path:'/briefing/',at:Date.now(),zip:area?.zip || '',area:validArea(area),category:category.value,location:location.value,group,includeHistory:historyChoice.checked,limits:{...limits},optionsOpen:options.open,scrollY:restorePosition ?? window.scrollY ?? 0,focusHref}; }
    function save(forReturn=false) {
      if(restoring)return;
      const state=viewState();
      try { window.history.replaceState({...window.history.state,ozBriefing:state},''); } catch { /* Browsing works without history writes. */ }
      if(forReturn)try { sessionStorage.setItem(RETURN_KEY,JSON.stringify(state)); } catch { /* Native history is the primary return path. */ }
    }
    function cancelRestore() { viewVersion++; restorePosition=null; restoring=false; }
    function restoreScroll() {
      const y=restorePosition,version=viewVersion; restorePosition=null; restoring=false;
      if(y===null)return;
      const apply=()=>{
        if(version!==viewVersion)return;
        const anchors=root.querySelectorAll?.('a[href]') || [];
        const focused=[...anchors].find(node=>node.getAttribute('href')===focusHref);
        focused?.focus({preventScroll:true});
        window.scrollTo?.({top:y,behavior:'instant'}); save();
      };
      if(window.requestAnimationFrame)window.requestAnimationFrame(apply);else apply();
    }
    function resetLimits() { for(const key of Object.keys(limits))limits[key]=PAGE_SIZE; group='all'; }
    function render() {
      const selected=filterEvents(snapshot.events,category.value,'all');
      const current=selected.filter(event=>isCurrentRelevant(event));
      const records=historyChoice.checked?selected:current;
      const grouped=Boolean(area)||location.value.startsWith('US:');
      const groups=grouped?partitionAreaEvents(records,area,location.value):{all:filterEvents(records,'all',location.value)};
      const totals=grouped?partitionAreaEvents(selected,area,location.value):{all:filterEvents(selected,'all',location.value)};
      if(!Object.hasOwn(groups,group))group=Object.keys(groups).find(key=>groups[key].length)||Object.keys(groups)[0];
      const matches=prioritizeEvents(groups[group],snapshot.sources),limit=limits[group];
      cards.replaceChildren(...matches.slice(0,limit).map(event=>card(event,snapshot)));cards.hidden=!matches.length;
      more.hidden=matches.length<=limit;more.textContent='Show '+Math.min(PAGE_SIZE,Math.max(0,matches.length-limit))+' more ('+Math.max(0,matches.length-limit)+' remaining)';
      const hidden=historyChoice.checked?0:Math.max(0,totals[group].length-matches.length);
      const label={local:'area reports',products:'product/software notices',other:'other reports',all:'reports'}[group];
      count.textContent=(historyChoice.checked?'Including history · ':'Current source records · ')+Math.min(limit,matches.length)+' of '+matches.length+' '+label+(hidden?' · '+hidden+' historical/background hidden':'');
      historyLabel.textContent='Show history & background ('+(selected.length-current.length)+')';
      groupNav.replaceChildren();groupNav.hidden=!grouped;
      if(grouped)for(const [key,title] of [['local','Area'],['products','Products'],['other','Other']]){
        const button=el('button','',title+' · '+groups[key].length);button.type='button';button.setAttribute('aria-pressed',String(group===key));button.setAttribute('data-group',key);
        button.addEventListener('click',()=>{cancelRestore();group=key;render();save();[...groupNav.children].find(node=>node.getAttribute('data-group')===key)?.focus({preventScroll:true});});groupNav.append(button);
      }
      areaHeading.hidden=!grouped;areaNote.hidden=!grouped;
      areaHeading.textContent={local:'Relevant to your area',products:'Product & software notices',other:'Other areas & reporting'}[group] || '';
      areaNote.textContent=group==='local'?(area?area.label+' · approximate county overlap only; not your exact position or a hazard boundary. Local matches cover NWS county-coded reports only; zone-only and other reports remain in Other.':STATES[location.value.slice(3)]+' · broad state labels, not address matches.'):group==='products'?'Check your exact product, lot or software. A local incident is not implied.':'Other places or unverified locations. Some reports may still apply to you.';
      empty.replaceChildren();empty.hidden=Boolean(matches.length);
      if(!matches.length)empty.append(el('h3','',group==='local'?'No verified county/state matches.':'No reports in this view.'),el('p','','Not an all-clear. Check current sources'+(grouped?' or choose another report group above.':'. Try another category or include history.')));
      fallback.hidden=Object.values(groups).some(records=>records.length);
      const intro=root.querySelector('.briefing-fallback-intro');
      if(intro)intro.textContent='No reports match this view. These general planning guides remain available.';
    }
    function zipBusy(busy) {
      zipSubmit.disabled=busy;zipSubmit.textContent=busy?'Searching…':'Search';
      zipInput.setAttribute('aria-busy',String(busy));
    }
    function clearChoices() { choices.replaceChildren();choices.hidden=true;zipInput.setAttribute('aria-expanded','false'); }
    function stopGeolocation() {
      if(geoTimer!==null)clearTimeout(geoTimer);geoTimer=null;geoPending=false;geoButton.disabled=false;geoButton.textContent='Use my location';
    }
    function cancelLocationWork() { zipAttempt++;stopGeolocation();zipBusy(false);clearChoices(); }
    function closeOptions(restoreFocus=false) {
      if(!options.open)return;
      options.open=false;save();
      if(restoreFocus)options.querySelector('summary')?.focus({preventScroll:true});
    }
    options.addEventListener('keydown',event=>{if(event.key==='Escape'&&options.open){event.preventDefault();closeOptions(true);}});
    document.addEventListener('click',event=>{if(!event.target?.closest?.('[data-briefing-options]'))closeOptions();});
    document.addEventListener('focusin',event=>{if(!event.target?.closest?.('[data-briefing-options]'))closeOptions();});
    function clearZip(message) {
      cancelLocationWork();rememberLocationAttempt();zipInput.setAttribute('aria-invalid','false');area=null;zipInput.value='';zipClear.hidden=true;zipStatus.textContent=message;
      try{localStorage.removeItem(ZIP_KEY);localStorage.removeItem(AREA_KEY);}catch{}
    }
    function selectArea(result,{restore=false,restoreGroup=null,fromLocation=false,accuracyLabel=''}={}) {
      cancelLocationWork();
      if(!restore){cancelRestore();resetLimits();}
      if(result.kind==='state' && Object.hasOwn(STATES,result.state)) {
        area=null;location.value='US:'+result.state;zipInput.value=STATES[result.state];
        zipStatus.textContent=STATES[result.state]+' · broad state matches, not address-level coverage.';
        try{localStorage.setItem(LOCATION_KEY,location.value);localStorage.removeItem(ZIP_KEY);localStorage.removeItem(AREA_KEY);}catch{}
      } else {
        const nextArea=validArea(result);if(!nextArea)throw Error('Invalid derived area');area=nextArea;location.value='all';zipInput.value=area.zip || area.label;
        zipStatus.textContent=(area.zip?'ZIP '+area.zip:area.label)+' · '+(fromLocation?'device-location county estimate'+(accuracyLabel?' · '+accuracyLabel:'')+'; map boundaries are approximate.':'county-area estimate.');
        try{localStorage.setItem(AREA_KEY,JSON.stringify(area));localStorage.removeItem(LOCATION_KEY);if(area.zip)localStorage.setItem(ZIP_KEY,area.zip);else localStorage.removeItem(ZIP_KEY);}catch{}
      }
      zipInput.setAttribute('aria-invalid','false');zipClear.hidden=false;if(restoreGroup)group=restoreGroup;
      render();restoreScroll();save();
    }
    function presentChoices(matches,{fromLocation=false,accuracyLabel=''}={}) {
      clearChoices();choices.hidden=false;zipInput.setAttribute('aria-expanded','true');
      choices.append(el('p','briefing-choice-label',fromLocation?'Location is near a boundary or has limited accuracy.'+(accuracyLabel?' '+accuracyLabel+'.':'')+' Choose the county to browse, or search manually:':'Choose a place. Cities with the same name can be in different states:'));
      for(const match of matches.slice(0,AREA_CHOICES_MAX)){
        const button=el('button','briefing-area-choice',match.label);button.type='button';
        if(match.unsupported){button.disabled=true;button.textContent+=' · county matching unavailable';}
        button.addEventListener('click',()=>{if(match.unsupported)return;rememberLocationAttempt();selectArea(match,{fromLocation,accuracyLabel});zipInput.focus({preventScroll:true});});choices.append(button);
      }
      zipStatus.textContent=(matches.length>AREA_CHOICES_MAX?'Showing '+AREA_CHOICES_MAX+' of '+matches.length+' matches. Add a state or use a fuller city name to narrow your search.':matches.length+' area '+(matches.length===1?'choice':'choices')+'.')+' Use Tab or the down arrow to choose; Escape closes the choices.';
    }
    function lookupMessage(result,kind) {
      if(result.status==='unsupported')return 'Connecticut county matching is unavailable with this mapping vintage. Search Connecticut for broad state reports; no safety conclusion can be drawn.';
      if(result.status==='imprecise')return 'Device location is too imprecise for a county estimate. Search a ZIP, city or state instead.';
      if(kind==='zip')return 'ZIP not in this geographic lookup. Search a city or state; missing data does not mean no alerts.';
      if(kind==='geolocation')return 'No supported U.S. county match was found. Search a U.S. ZIP, city or state, or browse other locations under More filters.';
      return 'No matching city or state in this geographic lookup. Try a city with its state, or a five-digit ZIP. Missing data does not mean no alerts.';
    }
    async function applyZip({restore=false}={}) {
      if(!restore){cancelRestore();rememberLocationAttempt();}
      cancelLocationWork();const query=zipInput.value.trim(),attempt=zipAttempt,restoreGroup=restore?group:null;
      zipInput.setAttribute('aria-invalid','false');zipClear.hidden=!query&&!area;
      if(!query || query.length>120 || (/\d/.test(query) && !/^\d{5}$/.test(query))) {
        zipInput.setAttribute('aria-invalid','true');zipStatus.textContent='Enter a five-digit U.S. ZIP, city name, or state name/code.';restoreScroll();save();zipInput.focus();return;
      }
      const state=stateQuery(query);if(state){selectArea({kind:'state',state},{restore,restoreGroup});return;}
      zipBusy(true);zipStatus.textContent='Searching the area map in this browser…';
      try {
        let result;
        if(/^\d{5}$/.test(query)) {const match=resolveZipArea(await loadZipData(),query);result={status:match.status,matches:match.status==='found'?[match]:[]};}
        else {const data=await loadAreaData(PLACE_DATA_URL);if(!window.OspreyAreaLookup)throw Error('Area lookup module unavailable');result=window.OspreyAreaLookup.searchAreas(data,query);}
        if(attempt!==zipAttempt)return;zipBusy(false);
        if(result.status==='unavailable')throw Error('Area mapping unavailable');
        if(result.status==='found' && result.matches?.length===1 && !result.matches[0].unsupported)selectArea(result.matches[0],{restore,restoreGroup});
        else if(result.status==='found' && result.matches?.length>1){presentChoices(result.matches);restoreScroll();save();}
        else{zipStatus.textContent=lookupMessage(result,/^\d{5}$/.test(query)?'zip':'city');restoreScroll();save();}
      } catch {if(attempt!==zipAttempt)return;areaDataRequests.delete(/^\d{5}$/.test(query)?ZIP_DATA_URL:PLACE_DATA_URL);zipBusy(false);zipStatus.textContent='Area lookup unavailable. Search a state name or code, or use More filters. Try the city or ZIP again when connected.';restoreScroll();save();}
    }
    function startGeolocation(automatic=false) {
      if(geoPending)return;
      const remembered=rememberLocationAttempt();
      if(automatic && !remembered){zipStatus.textContent='Location prompts cannot be remembered here. Search an area or choose Use my location.';return;}
      cancelRestore();cancelLocationWork();const attempt=zipAttempt;
      if(typeof navigator==='undefined' || !navigator.geolocation || window.isSecureContext===false){zipStatus.textContent='Device location is unavailable in this browser. Search a ZIP, city or state.';return;}
      geoPending=true;geoButton.disabled=true;geoButton.textContent='Locating…';zipClear.hidden=false;
      zipStatus.textContent='Waiting for browser location permission. You can search an area instead.';
      const fail=error=>{
        if(attempt!==zipAttempt)return;cancelLocationWork();
        zipStatus.textContent=error?.code===1?'Location permission was not granted. Search an area, or change browser permission and choose Use my location.':error?.code===3?'Location request timed out. Search an area or choose Use my location to retry.':'Device location could not be determined. Search an area or choose Use my location to retry.';
      };
      // Browser timeout excludes time awaiting permission. This UI deadline also ignores late callbacks.
      geoTimer=setTimeout(()=>fail({code:3}),GEO_DEADLINE_MS);
      try { navigator.geolocation.getCurrentPosition(async position=>{
        if(attempt!==zipAttempt)return;
        stopGeolocation();geoButton.disabled=true;geoButton.textContent='Matching…';geoPending=true;zipStatus.textContent='Matching an approximate county in this browser…';
        try {
          const data=await loadAreaData(COUNTY_DATA_URL);if(attempt!==zipAttempt)return;
          if(!window.OspreyAreaLookup)throw Error('Area lookup module unavailable');
          const result=window.OspreyAreaLookup.resolveCoordinates(data,position.coords.latitude,position.coords.longitude,position.coords.accuracy);
          if(attempt!==zipAttempt)return;stopGeolocation();
          if(result.status==='unavailable')throw Error('County mapping unavailable');
          const meters=position.coords.accuracy;const accuracyLabel=Number.isFinite(meters)?'browser accuracy about '+(meters>=1000?(meters/1000).toFixed(1)+' km':Math.ceil(meters)+' m'):'';
          if(result.status==='found' && result.matches?.length===1)selectArea(result.matches[0],{fromLocation:true,accuracyLabel});
          else if(result.status==='ambiguous' && result.matches?.length)presentChoices(result.matches,{fromLocation:true,accuracyLabel});
          else zipStatus.textContent=lookupMessage(result,'geolocation');
        } catch {if(attempt!==zipAttempt)return;areaDataRequests.delete(COUNTY_DATA_URL);stopGeolocation();zipStatus.textContent='County lookup unavailable. Search a state name or code, or use More filters. Use my location can retry.';}
      },fail,{enableHighAccuracy:false,maximumAge:0,timeout:10000}); } catch {fail({code:2});}
    }
    geoButton.addEventListener('click',()=>startGeolocation());
    zipInput.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'&&!choices.hidden){event.preventDefault();[...choices.querySelectorAll('button')].find(button=>!button.disabled)?.focus();}
      else if(event.key==='Escape'&&!choices.hidden){event.preventDefault();clearChoices();zipStatus.textContent='Area choices closed. Refine your search and choose Search.';}
    });
    choices.addEventListener('keydown',event=>{
      const buttons=[...choices.querySelectorAll('button')].filter(button=>!button.disabled),index=buttons.indexOf(document.activeElement);
      if(event.key==='Escape'){event.preventDefault();clearChoices();zipInput.focus();zipStatus.textContent='Area choices closed. Refine your search and choose Search.';}
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();}
    });
    category.addEventListener('change',()=>{cancelRestore();resetLimits();render();save();});
    historyChoice.addEventListener('change',()=>{cancelRestore();resetLimits();render();save();});
    more.addEventListener('click',()=>{cancelRestore();const first=limits[group];limits[group]+=PAGE_SIZE;render();cards.children[first]?.querySelector('h3 a')?.focus();save();});
    location.addEventListener('change',()=>{cancelRestore();clearZip('Browsing by broad location.');try{localStorage.setItem(LOCATION_KEY,location.value);}catch{}resetLimits();render();save();});
    zipInput.addEventListener('input',()=>{cancelRestore();cancelLocationWork();rememberLocationAttempt();zipInput.setAttribute('aria-invalid','false');zipClear.hidden=!area&&!zipInput.value;zipStatus.textContent=area?'Still using '+(area.zip?'ZIP '+area.zip:area.label)+'. Choose Search to apply your edit.':'';});
    zipForm.addEventListener('submit',event=>{event.preventDefault();applyZip();});
    zipClear.addEventListener('click',()=>{cancelRestore();clearZip('Area cleared.');location.value='all';try{localStorage.removeItem(LOCATION_KEY);}catch{}resetLimits();render();save();zipInput.focus();});
    reset.addEventListener('click',()=>{cancelRestore();category.value='all';location.value='all';historyChoice.checked=false;clearZip('All filters cleared.');resetLimits();try{localStorage.removeItem(LOCATION_KEY);}catch{}render();save();closeOptions(true);});
    options.addEventListener('toggle',()=>save());
    root.addEventListener('click',event=>{const anchor=event.target?.closest?.('a');const href=anchor?.getAttribute('href');if(href?.startsWith('/briefing/event/?id=')){focusHref=href;save(true);}});
    window.addEventListener('pagehide',()=>{cancelLocationWork();save(true);});
    window.addEventListener('pageshow',event=>{if(event.persisted){try{const state=validViewState(window.history?.state?.ozBriefing);if(state){restorePosition=state.scrollY;restoreScroll();}}catch{}}});
    let eligibility=snapshot.events.map(event=>Number(isCurrentRelevant(event))).join('');
    localTimeListeners.add(()=>{
      const next=snapshot.events.map(event=>Number(isCurrentRelevant(event))).join('');
      if(next===eligibility)return;eligibility=next;
      const active=document.activeElement,candidate=active?.closest?.('.briefing-card'),article=candidate?.parentElement===cards?candidate:null;
      const href=article?.querySelector('h3 a')?.getAttribute('href'),groupFocus=active?.getAttribute?.('data-group');
      const openRecords=[...(cards.querySelectorAll?.('.briefing-card-metadata[open]')||[])].map(node=>node.closest('.briefing-card')?.getAttribute('data-record-id'));
      const y=window.scrollY||0;render();
      for(const node of cards.querySelectorAll?.('.briefing-card')||[])if(openRecords.includes(node.getAttribute('data-record-id')))node.querySelector('.briefing-card-metadata').open=true;
      const replacement=href?[...(cards.querySelectorAll?.('a[href]')||[])].find(node=>node.getAttribute('href')===href):null;
      if(article&&!replacement){count.setAttribute('tabindex','-1');count.focus();}
      else{replacement?.focus({preventScroll:true});if(groupFocus)[...groupNav.children].find(node=>node.getAttribute('data-group')===groupFocus)?.focus({preventScroll:true});window.scrollTo?.({top:y,behavior:'instant'});}
      save();
    });
    filters.hidden=false;zipForm.hidden=false;render();health(root,snapshot);
    let zip=saved?.zip || '',storedArea=saved?.area || null,hasManualPreference=Boolean(saved);
    if(!saved){
      try{zip=localStorage.getItem(ZIP_KEY)||'';hasManualPreference=Boolean(localStorage.getItem(LOCATION_KEY));}catch{}
      try{storedArea=validArea(JSON.parse(localStorage.getItem(AREA_KEY)));}catch{}
      hasManualPreference=hasManualPreference||Boolean(zip||storedArea||location.value!=='all');
    }
    if(storedArea){selectArea(storedArea,{restore:Boolean(saved),restoreGroup:saved?.group});}
    else if(/^\d{5}$/.test(zip)){zipInput.value=zip;applyZip({restore:Boolean(saved)});}
    else{restoreScroll();save();if(!hasManualPreference&&!hasLocationAttempt()){const attempt=zipAttempt;const launch=()=>{if(attempt===zipAttempt&&!hasLocationAttempt())startGeolocation(true);};if(window.requestAnimationFrame)window.requestAnimationFrame(launch);else setTimeout(launch,0);}}
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
    const back=root.querySelector('[data-briefing-back]'), returnState=readReturnState();
    if(back&&returnState){back.textContent='← Back to your results';back.addEventListener('click',event=>{try{const previous=new URL(document.referrer);if(previous.origin===window.location.origin&&previous.pathname==='/briefing/'&&window.history.length>1){event.preventDefault();window.history.back();}}catch{ /* Direct visits use the plain /briefing/ link. */ }});}
    const id = new URLSearchParams(window.location.search).get('id');
    const event = snapshot.events.find(event => event.id === id);
    if (!event) {
      root.querySelector('[data-briefing-detail-fallback]').textContent = 'This report is not in the available snapshot. It may have changed, expired or been removed from the source. Its absence is not an all-clear. Check current source information or browse the latest briefing.';
      return;
    }
    const target = root.querySelector('[data-briefing-detail]');
    const header = el('header','briefing-detail-header');
    header.append(el('p','briefing-category',categoryName(event.category)+(event.relevance==='background'?' · background':'')),el('span','briefing-source-kind',sourceKind(event)),el('h1','',displayTitle(event)));
    header.append(sourceLine(event));
    header.append(watchLabel(el('p','briefing-record-note'), () => recordState(event).note, true));
    header.append(watchLabel(el('p','briefing-record-note'), () => sourceCheck(event,snapshot), true));
    const jumps = el('nav','briefing-detail-jumps'); jumps.setAttribute('aria-label','On this page');
    for (const [id,label] of [['related-guides','Relevant guides'],['what-this-means','What this means'],['official-instructions','Official instructions'],['preparedness-steps','Preparedness next steps'],['sources-updates','Sources and updates']]) jumps.append(link(label,'#' + id));
    if (event.source.kind === 'news') header.append(attributionBlock(event));
    const glance = section('at-a-glance',event.displaySummaryKind==='source-metadata'?'Source record at a glance':'At a glance');
    glance.append(el('p','',displaySummary(event) || 'The source did not provide a report summary. Read the original source for its available details.'));
    header.append(glance);
    if(event.source.kind==='official'&&event.category==='recall')header.append(link('Check the exact product & remedy ↗',sourceUrl(event),'briefing-source-action'));
    const facts = el('dl','briefing-facts');
    fact(facts,'Reported location',locationLabel(event));
    if (event.geo?.incomplete || event.geo?.truncated) fact(facts,'Geographic coverage','Some source area identifiers were unavailable; the geographic list is incomplete.');
    fact(facts,'Source',plain(event.source.name,160) + ' · ' + sourceKind(event));
    fact(facts,'Original source headline',plain(event.title,500));
    fact(facts,'Published by source',stamp(event.publishedAt));
    fact(facts,'Updated by source',stamp(event.updatedAt));
    fact(facts,'Last source check',stamp(event.lastCheckedAt));
    watchLabel(fact(facts,'Record status',''), () => recordState(event).label);
    if (event.expiresAt) fact(facts,'Source validity / expiry time',stamp(event.expiresAt));
    if (event.endsAt) fact(facts,'End time listed by source',stamp(event.endsAt));
    // Detailed timestamps remain available with the source history below.
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
    panel.append(link(plain(event.sourceLinkLabel,160) || 'Open the source record ↗',sourceUrl(event)));
    official.append(panel);
    const steps = section('preparedness-steps','Reviewed preparedness next steps');
    steps.append(el('p','briefing-reviewed-note','General Osprey Zero preparedness guidance, drawn from reviewed library material. These are editorial planning steps, not instructions issued for this event. Match them to your household and follow current, applicable source instructions.'));
    const actions = safeTextList(event.preparedness);
    if (actions.length) { const list = el('ol'); for (const text of actions) list.append(el('li','',text)); steps.append(list); }
    else steps.append(el('p','','No reviewed preparedness steps are attached to this record. Use the original source and the linked guides for context.'));
    const related = section('related-guides','Prepare for this');
    const guides = exactGuides(event);
    if (guides.length) { const links = el('div','briefing-guide-links'); for (const guide of guides) links.append(readingLink(plain(guide.title,200),guide.url)); related.append(links); }
    else related.append(el('p','','No exact guide mapping is available for this record.'));
    const sources = section('sources-updates','Sources and updates');
    const sourceList = el('ul','briefing-sources-list');
    const original = el('li'); original.append(link(event.sourceUrlKind==='source-catalog'?'CISA catalog (search by CVE) ↗':plain(event.source.name,160) + (event.sourceUrlKind && event.sourceUrlKind!=='original-notice' ? ' · original data record ↗' : ' · original report ↗'),externalUrl(event.url)),el('small','','Source date: ' + stamp(event.updatedAt || event.publishedAt) + '. Last checked: ' + stamp(event.lastCheckedAt) + '.')); sourceList.append(original);
    for (const resource of (Array.isArray(event.resources) ? event.resources : []).slice(0,10)) {
      if (!resource || !externalUrl(resource.url) || !plain(resource.label)) continue;
      const item = el('li'); item.append(link(plain(resource.label,200) + ' ↗',externalUrl(resource.url))); sourceList.append(item);
    }
    const license = externalUrl(event.source.licenseUrl);
    if (license) { const item = el('li'); item.append(link('Source content license ↗',license)); sourceList.append(item); }
    const rights = externalUrl(event.source.rightsUrl);
    if (rights) { const item = el('li'); item.append(link(plain(event.source.rightsLabel,180) || 'Source reuse and attribution',rights)); sourceList.append(item); }
    sources.append(facts,sourceList);
    if(event.summary && event.displaySummary && event.summary!==event.displaySummary){const originalText=el('details','briefing-original-summary');originalText.append(el('summary','','Original source summary'),el('p','',plain(event.summary)));sources.append(originalText);}
    const updates = (Array.isArray(event.updates) ? event.updates : []).filter(update => update && plain(update.text)).slice(0,20);
    if (updates.length) {
      sources.append(el('h3','','Record history'));
      const list = el('ul','briefing-sources-list');
      for (const update of updates) { const item = el('li','',''); item.append(el('small','',stamp(update.at)),el('span','',plain(update.text,1000))); list.append(item); }
      sources.append(list);
    }
    sources.append(el('p','briefing-reviewed-note','Snapshot generated: ' + stamp(snapshot.generatedAt) + '. Last successful refresh: ' + stamp(snapshot.lastSuccessfulAt) + '. Scheduled twice daily at 00:00 and 12:00 UTC. An expired, removed or unavailable record does not establish that a threat has ended.'));
    target.replaceChildren(header,related,jumps,meaning,official,steps,sources);
    target.hidden = false; root.querySelector('[data-briefing-fallback]').hidden = true;
    document.title = plain(displayTitle(event),180) + ' — Osprey Zero Daily Brief';
  }

  function trackLocalTime(snapshot) {
    let timer = null;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const refresh = () => {
      for (const root of roots) updateStatus(root,snapshot);
      for (const listener of localTimeListeners) listener();
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
  }).catch(() => roots.forEach(root=>{if(root.getAttribute('data-briefing')==='index')renderIndex(root,{events:[],sources:[]});showFailure(root);})).finally(() => { if (timeout !== null) clearTimeout(timeout); });
}());
