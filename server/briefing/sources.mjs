import { XMLParser, XMLValidator } from 'fast-xml-parser';

// The collector owns I/O. These adapters never follow item URLs or retrieve articles.
const NWS_RIGHTS = 'https://www.weather.gov/documentation/services-web-api';
const FIELDS = ['id', 'title', 'summary', 'instructions', 'location', 'dates', 'status', 'url'];
const source = (config) => Object.freeze({ ...config,
  allowedHosts: Object.freeze(config.allowedHosts),
  rights: Object.freeze({ ...config.rights, allowedFields: Object.freeze(config.rights.allowedFields) }),
});

export const SOURCES = Object.freeze([
  source({ id: 'nws', name: 'National Weather Service', kind: 'official', format: 'json',
    url: 'https://api.weather.gov/alerts/active', website: NWS_RIGHTS,
    allowedHosts: ['api.weather.gov', 'www.weather.gov', 'weather.gov'],
    rights: { label: 'NWS open data; attribution provided', url: NWS_RIGHTS, allowedFields: FIELDS },
    coverage: 'NWS active alerts for the United States, territories and covered marine zones. This twice-daily snapshot misses short-lived alerts and is not a warning service.',
  }),
  source({ id: 'nws-cancellations', name: 'National Weather Service cancellations', kind: 'official', format: 'json',
    url: 'https://api.weather.gov/alerts?message_type=cancel&limit=100', website: NWS_RIGHTS,
    allowedHosts: ['api.weather.gov', 'www.weather.gov', 'weather.gov'],
    rights: { label: 'NWS open data; attribution provided', url: NWS_RIGHTS, allowedFields: FIELDS },
    coverage: 'At most 100 recent explicit NWS cancellation messages; pagination is disclosed rather than followed. An absent alert does not mean the danger has ended.',
  }),
  source({ id: 'usgs', name: 'U.S. Geological Survey', kind: 'official', format: 'json',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
    website: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php', allowedHosts: ['earthquake.usgs.gov', 'www.usgs.gov'],
    rights: { label: 'USGS-produced data; U.S. public domain', url: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits', allowedFields: FIELDS },
    coverage: 'USGS significant earthquakes in the past seven days, worldwide. Significance is a source selection, not all earthquakes. The place describes the epicenter, not an affected-area boundary.',
  }),
  source({ id: 'cpsc', name: 'U.S. Consumer Product Safety Commission', kind: 'official', format: 'json',
    url: 'https://www.saferproducts.gov/RestWebServices/Recall?format=json',
    website: 'https://www.cpsc.gov/Recalls', allowedHosts: ['www.cpsc.gov', 'cpsc.gov'],
    rights: { label: 'CPSC recall notices: reuse permitted with credit', url: 'https://www.cpsc.gov/About-CPSC/Policies-Statements-and-Directives/Privacy-Policy', allowedFields: FIELDS },
    coverage: 'U.S. CPSC recalls published or updated during the past 30 days. Product ownership and exact models or lots determine relevance; the feed does not establish state-level distribution or recall termination.',
  }),
  source({ id: 'fda', name: 'U.S. Food and Drug Administration', kind: 'official', format: 'xml',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml',
    website: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts', allowedHosts: ['www.fda.gov', 'fda.gov'],
    rights: { label: 'FDA public-domain notice metadata, unless otherwise noted', url: 'https://www.fda.gov/about-fda/about-website/website-policies', allowedFields: ['id', 'title', 'summary', 'dates', 'url'] },
    coverage: 'FDA public recall announcements supplied by its RSS feed. This is not every FDA recall or a complete enforcement/termination database; manufacturer headquarters do not establish product distribution.',
  }),
  source({ id: 'cisa-kev', name: 'CISA Known Exploited Vulnerabilities', kind: 'official', format: 'json',
    url: 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json',
    website: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', allowedHosts: ['www.cisa.gov', 'cisa.gov'],
    rights: { label: 'CISA KEV data: CC0', url: 'https://www.cisa.gov/sites/default/files/licenses/kev/license.txt', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', allowedFields: FIELDS },
    coverage: 'Entries added during the past 30 days from CISA’s official GitHub mirror of the KEV catalog. These are known exploited software vulnerabilities, not local attack reports or proof a household was compromised. Federal remediation deadlines are not consumer expiry dates.',
  }),
  source({ id: 'eff', name: 'Electronic Frontier Foundation', kind: 'news', format: 'xml',
    url: 'https://www.eff.org/rss/updates.xml', website: 'https://www.eff.org/deeplinks', allowedHosts: ['www.eff.org', 'eff.org'],
    rights: { label: 'Original EFF material: CC BY 4.0; shortened excerpts', url: 'https://www.eff.org/copyright', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', allowedFields: ['id', 'title', 'shortExcerpt', 'author', 'dates', 'url'] },
    coverage: 'Selected EFF digital-security and digital-rights reporting and analysis. This advocacy publisher is not an official alert or general world-news service. Geography remains unknown without explicit item metadata.',
  }),
  source({ id: 'global-voices', name: 'Global Voices', kind: 'news', format: 'xml',
    url: 'https://globalvoices.org/feed/', website: 'https://globalvoices.org/', allowedHosts: ['globalvoices.org', 'www.globalvoices.org'],
    rights: { label: 'Original Global Voices text: CC BY 3.0; shortened excerpts', url: 'https://globalvoices.org/about/global-voices-attribution-policy/', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', allowedFields: ['id', 'title', 'shortExcerpt', 'author', 'dates', 'url'] },
    coverage: 'Selected recent Global Voices reporting with explicit preparedness-hazard relevance, from its limited RSS window. Country tags describe article topics, not verified incident boundaries. No comprehensive international warning coverage.',
  }),
]);

export const SOURCE_BY_ID = new Map(SOURCES.map((entry) => [entry.id, entry]));

/** Only this documented date query may vary; no caller-supplied host or feed URL. */
export function sourceRequestUrl(sourceOrId, { now = new Date() } = {}) {
  const config = SOURCE_BY_ID.get(typeof sourceOrId === 'string' ? sourceOrId : sourceOrId?.id);
  if (!config) throw new Error('Unknown briefing source');
  if (config.id !== 'cpsc') return config.url;
  const time = new Date(now).getTime();
  if (!Number.isFinite(time)) throw new Error('Invalid source request time');
  const url = new URL(config.url);
  url.searchParams.set('LastPublishDateStart', new Date(time - 30 * 86400000).toISOString().slice(0, 10));
  return url.href;
}

const STATE_NAMES = Object.freeze({ Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC', 'Puerto Rico': 'PR', Guam: 'GU', 'American Samoa': 'AS', 'Northern Mariana Islands': 'MP', 'U.S. Virgin Islands': 'VI' });
const STATE_CODES = new Set(Object.values(STATE_NAMES));
const STATE_FIPS = Object.freeze({ AL:'01', AK:'02', AZ:'04', AR:'05', CA:'06', CO:'08', CT:'09', DE:'10', DC:'11', FL:'12', GA:'13', HI:'15', ID:'16', IL:'17', IN:'18', IA:'19', KS:'20', KY:'21', LA:'22', ME:'23', MD:'24', MA:'25', MI:'26', MN:'27', MS:'28', MO:'29', MT:'30', NE:'31', NV:'32', NH:'33', NJ:'34', NM:'35', NY:'36', NC:'37', ND:'38', OH:'39', OK:'40', OR:'41', PA:'42', RI:'44', SC:'45', SD:'46', TN:'47', TX:'48', UT:'49', VT:'50', VA:'51', WA:'53', WV:'54', WI:'55', WY:'56', AS:'60', GU:'66', MP:'69', PR:'72', VI:'78' });
const FIPS_STATES = new Set(Object.values(STATE_FIPS));
const GEO_CODES_LIMIT = 512;
const NWS_GEO_EVIDENCE = 'NWS CAP geocode and affectedZones; county overlap, not exact ZIP coverage';

/** Validate and re-derive matching keys at both adapter and storage boundaries.
 * The leading SAME digit is a county subdivision; Z-zone suffixes are NOT FIPS.
 * County membership must never come from a polygon/zone centroid. */
export function normalizeNwsGeo(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const sameInput = list(input.sameCodes), zoneInput = list(input.zoneIds);
  const validSame = code => typeof code === 'string' && /^\d{6}$/.test(code.trim());
  const validZone = code => typeof code === 'string' && /^[A-Z]{2}[CZ]\d{3}$/.test(code.trim()) && code.trim().slice(3) !== '000' && (code.trim()[2] === 'Z' || STATE_CODES.has(code.trim().slice(0,2)));
  const same = [...new Set(sameInput.filter(validSame).map(code => code.trim()))];
  const zones = [...new Set(zoneInput.filter(validZone).map(code => code.trim()))];
  const counties = [...new Set([
    ...same.filter(code => FIPS_STATES.has(code.slice(1,3)) && code.slice(3) !== '000').map(code => code.slice(1)),
    ...zones.filter(code => code[2] === 'C').map(code => `${STATE_FIPS[code.slice(0,2)]}${code.slice(3)}`),
  ])];
  return { countyFips:counties.slice(0,GEO_CODES_LIMIT), zoneIds:zones.slice(0,GEO_CODES_LIMIT), sameCodes:same.slice(0,GEO_CODES_LIMIT),
    precision:counties.length || zones.length ? 'county-or-zone' : 'unknown',
    evidence:counties.length || zones.length || same.length ? NWS_GEO_EVIDENCE : null,
    incomplete:input.incomplete === true || sameInput.some(code => !validSame(code)) || same.some(code => !FIPS_STATES.has(code.slice(1,3))) || zoneInput.some(code => !validZone(code)),
    truncated:input.truncated === true || [same,zones,counties].some(codes => codes.length > GEO_CODES_LIMIT) };
}

function nwsGeo(properties) {
  const affected = list(properties.affectedZones).flatMap(value => {
    try {
      const url = new URL(scalar(value));
      if (url.protocol !== 'https:' || url.hostname !== 'api.weather.gov' || url.username || url.password || url.port || url.search || url.hash) return [];
      const match = url.pathname.match(/^\/zones\/(?:county|forecast|fire|marine)\/([A-Z]{2}[CZ]\d{3})$/);
      return match ? [match[1]] : [];
    } catch { return []; }
  });
  return normalizeNwsGeo({ sameCodes:properties.geocode?.SAME, zoneIds:[...list(properties.geocode?.UGC),...affected], incomplete:affected.length < list(properties.affectedZones).length });
}
// Deliberately exact. Unrecognised tags/places are unknown, never guessed.
const COUNTRIES = new Set(('Afghanistan|Albania|Algeria|Angola|Argentina|Armenia|Australia|Austria|Azerbaijan|Bahrain|Bangladesh|Barbados|Belarus|Belgium|Belize|Benin|Bhutan|Bolivia|Bosnia and Herzegovina|Botswana|Brazil|Bulgaria|Burkina Faso|Burundi|Cambodia|Cameroon|Canada|Cape Verde|Chad|Chile|China|Colombia|Costa Rica|Croatia|Cuba|Cyprus|Czech Republic|Democratic Republic of Congo|Denmark|Dominican Republic|Ecuador|Egypt|El Salvador|Eritrea|Estonia|Eswatini|Ethiopia|Fiji|Finland|France|Gabon|Gambia|Georgia|Germany|Ghana|Greece|Guatemala|Guinea|Guyana|Haiti|Honduras|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Jamaica|Japan|Jordan|Kazakhstan|Kenya|Kosovo|Kuwait|Kyrgyzstan|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Lithuania|Luxembourg|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Mauritania|Mauritius|Mexico|Moldova|Mongolia|Montenegro|Morocco|Mozambique|Myanmar|Namibia|Nepal|Netherlands|New Zealand|Nicaragua|Niger|Nigeria|North Korea|North Macedonia|Norway|Oman|Pakistan|Palestine|Panama|Papua New Guinea|Paraguay|Peru|Philippines|Poland|Portugal|Qatar|Romania|Russia|Rwanda|Saudi Arabia|Senegal|Serbia|Sierra Leone|Singapore|Slovakia|Slovenia|Solomon Islands|Somalia|South Africa|South Korea|South Sudan|Spain|Sri Lanka|Sudan|Suriname|Sweden|Switzerland|Syria|Taiwan|Tajikistan|Tanzania|Thailand|Timor-Leste|Togo|Trinidad and Tobago|Tunisia|Turkey|Türkiye|Turkmenistan|Uganda|Ukraine|United Arab Emirates|United Kingdom|Uruguay|Uzbekistan|Vanuatu|Venezuela|Vietnam|Yemen|Zambia|Zimbabwe').split('|'));

const scalar = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const xmlText = (value) => scalar(value) || (value && typeof value === 'object' ? scalar(value['#text']) : '');
const list = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const unique = (values) => [...new Set(values.filter(Boolean))];
const unknownLocation = () => ({ label: 'Location not established by this feed', scope: 'Unknown', codes: [], precision: 'unknown' });
const usRecallLocation = () => ({ label: 'U.S. recall notice; check the source for product distribution', scope: 'US', codes: [], precision: 'country-only' });

function iso(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  // CPSC emits timezone-free dates: retain calendar date without pretending local time.
  let normalized = value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00$/.test(value)) normalized = `${value}Z`;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function sourceLink(value, config) {
  try {
    const url = new URL(scalar(value));
    if (!config.allowedHosts.includes(url.hostname) || url.username || url.password || url.port) return '';
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

function plainExcerpt(value, maximum = 420) {
  // This is extraction, not the rendering security boundary: core and UI still sanitize.
  const entity = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const text = scalar(value).slice(0, 100000)
    .replace(/<(script|style|blockquote|figure|iframe|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, code) => {
      if (code[0] !== '#') return entity[code.toLowerCase()] || match;
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1).replace(/\s+\S*$/, '').trim()}…`;
}

function event(config, fields) {
  return { sourceId: config.id, summary: '', instructions: '', location: unknownLocation(),
    updatedAt: null, expiresAt: null, endsAt: null, cancelledAt: null,
    status: 'current', urgency: 'unknown', relatedIds: [], ...fields };
}

function nwsIdentifier(value) {
  const id = scalar(value);
  return id.replace(/^https?:\/\/api\.weather\.gov\/alerts\//, '');
}

function nwsLocation(properties) {
  const codes = unique(list(properties.geocode?.UGC).map(scalar).filter((code) => /^[A-Z]{2}[CZ]\d{3}$/.test(code)).map((code) => code.slice(0, 2)).filter((code) => STATE_CODES.has(code)));
  const label = scalar(properties.areaDesc);
  return { label: label || 'NWS area unspecified; consult the source', scope: 'US', codes,
    precision: label || codes.length ? 'source-area' : 'unknown' };
}

function adaptNws(item, config, now) {
  const p = item?.properties;
  if (!p || typeof p !== 'object') throw new Error('Missing NWS properties');
  if (p.status !== 'Actual' || (p.scope && p.scope !== 'Public')) return { skipped: 'non-public-or-test' };
  const messageType = scalar(p.messageType || p.msgType).toLowerCase();
  if (!['alert', 'update', 'cancel'].includes(messageType)) throw new Error('Unknown NWS message type');
  const id = nwsIdentifier(p.id || item.id);
  const publishedAt = iso(p.sent);
  const title = scalar(p.headline) || scalar(p.event);
  const url = sourceLink(item.id || p['@id'], config) || (id.startsWith('urn:') ? sourceLink(`https://api.weather.gov/alerts/${id}`, config) : '');
  if (!id || !publishedAt || !title || !url) throw new Error('Incomplete NWS identity, date, title or URL');
  const relatedIds = unique(list(p.references).flatMap((ref) => {
    if (ref && typeof ref === 'object') return [nwsIdentifier(ref.identifier || ref['@id'])];
    return scalar(ref).split(/\s+/).map((reference) => nwsIdentifier(reference.split(',')[1] || reference));
  })).filter((ref) => ref !== id);
  const expiresAt = iso(p.expires);
  const endsAt = iso(p.ends);
  const expired = [expiresAt, endsAt].some((date) => date && Date.parse(date) <= now);
  return event(config, { id, title, category: 'weather', summary: scalar(p.description), instructions: scalar(p.instruction),
    location: nwsLocation(p), geo:nwsGeo(p), publishedAt, updatedAt: publishedAt, expiresAt, endsAt,
    cancelledAt: messageType === 'cancel' ? publishedAt : null,
    status: messageType === 'cancel' ? 'cancelled' : expired ? 'expired' : 'current',
    urgency: ['Immediate', 'Expected'].includes(p.urgency) ? p.urgency.toLowerCase() : 'unknown', url, relatedIds });
}

function quakeLocation(place) {
  if (!place) return unknownLocation();
  // Exact terminal location only; network IDs, coordinates, headlines and publisher do not imply a country.
  const suffix = place.split(',').at(-1).trim();
  if (suffix === 'Georgia') return { label: `${place} (epicenter; country not established)`, scope: 'Unknown', codes: [], precision: 'epicenter-place' };
  const state = STATE_NAMES[suffix] || (STATE_CODES.has(suffix) ? suffix : null);
  if (state) return { label: `${place} (epicenter)`, scope: 'US', codes: [state], precision: 'epicenter-place' };
  if (COUNTRIES.has(suffix)) return { label: `${place} (epicenter)`, scope: 'International', codes: [], precision: 'epicenter-place' };
  return { label: `${place} (epicenter; country not established)`, scope: 'Unknown', codes: [], precision: 'epicenter-place' };
}

function adaptUsgs(item, config) {
  const p = item?.properties;
  if (!p || typeof p !== 'object') throw new Error('Missing USGS properties');
  if (p.type !== 'earthquake') return { skipped: 'not-earthquake' };
  const id = scalar(item.id), publishedAt = iso(p.time), title = scalar(p.title), url = sourceLink(p.url, config);
  if (!id || !publishedAt || !title || !url) throw new Error('Incomplete USGS event');
  // A tsunami flag is not a warning and does not describe a household's risk.
  const magnitude = typeof p.mag === 'number' && Number.isFinite(p.mag) ? `Magnitude ${p.mag}. ` : '';
  return event(config, { id, title, category: 'earthquake', summary: `${magnitude}USGS earthquake observation. Values may be revised; the epicenter location does not describe all areas that felt shaking.`,
    location: quakeLocation(scalar(p.place)), publishedAt, updatedAt: iso(p.updated) || publishedAt, url });
}

function adaptCpsc(item, config) {
  if (!item || typeof item !== 'object') throw new Error('Invalid recall');
  const id = scalar(item.RecallID || item.RecallNumber), title = scalar(item.Title), publishedAt = iso(item.RecallDate), url = sourceLink(item.URL, config);
  if (!id || !title || !publishedAt || !url) throw new Error('Incomplete CPSC recall');
  return event(config, { id, title, category: 'recall',
    summary: unique(list(item.Hazards).map((hazard) => scalar(hazard?.Name))).join(' ') || scalar(item.Description),
    instructions: unique(list(item.Remedies).map((remedy) => scalar(remedy?.Name))).join(' '),
    location: usRecallLocation(), publishedAt, updatedAt: iso(item.LastPublishDate) || publishedAt, url });
}

function adaptKev(item, config, now) {
  if (!item || typeof item !== 'object' || !/^CVE-\d{4}-\d{4,}$/.test(scalar(item.cveID))) throw new Error('Invalid KEV identifier');
  const id = scalar(item.cveID), publishedAt = iso(item.dateAdded), name = scalar(item.vulnerabilityName);
  if (!publishedAt || !name) throw new Error('Incomplete KEV record');
  if (Date.parse(publishedAt) < now - 30 * 86400000) return { skipped: 'outside-30-day-window' };
  return event(config, { id, title: `${id}: ${name}`, category: 'cyber',
    summary: `Known exploited vulnerability: ${scalar(item.shortDescription)}`,
    instructions: scalar(item.requiredAction), publishedAt, updatedAt: publishedAt,
    location: { label: 'Affected software users; no incident location provided', scope: 'Unknown', codes: [], precision: 'product-only' },
    url: config.website });
}

function rssLocation(item) {
  const tags = list(item.category).map(xmlText);
  const countries = unique(tags.filter((tag) => COUNTRIES.has(tag) || ['United States', 'USA'].includes(tag)));
  if (countries.length) return { label: `Article topics: ${countries.join('; ')}; affected area unverified`, scope: 'Unknown', codes: [], precision: 'article-topic' };
  return unknownLocation();
}

const HAZARD_NEWS = /\b(?:earthquakes?|tsunamis?|flood(?:s|ing)?|wildfires?|hurricanes?|cyclones?|typhoons?|tornado(?:es|s)?|droughts?|heatwaves?|heat waves?|landslides?|volcan(?:o|oes|ic)|blackouts?|power outages?|water shortages?|water contamination|unsafe drinking water|disease outbreaks?|epidemics?|pandemics?|cholera|evacuat(?:ion|ions|e|ed)|displac(?:ed|ement)|humanitarian (?:crisis|aid)|ceasefires?|bombardments?|airstrikes?|armed conflict|civilian casualties|internet shutdowns?|internet blackouts?|ransomware|cyberattacks?|data breaches?|phishing|scams?)\b/i;
const DIGITAL_NEWS = /\b(?:privacy|surveillance|security|encryption|censorship|shutdowns?|data breaches?|cyberattacks?|ransomware|phishing|scams?|digital rights|free speech|biometric|doxxing|doxing|stalkerware|malware|data (?:collection|consolidation|sharing|broker))\b/i;
const RESERVED_RIGHTS = /(?:all rights reserved|creative commons[^\n<]{0,100}(?:noncommercial|non-commercial|no.?derivatives)|creativecommons\.org\/licenses\/by-(?:nc|nd)|republished (?:with permission|from)|content partnership agreement)/i;
const THIRD_PARTY_ORIGIN = /(?:first|originally) (?:published|appeared) (?:in|at|on)\s+(?!Global Voices|EFF|Electronic Frontier)/i;

function adaptRss(item, config) {
  if (!item || typeof item !== 'object') throw new Error('Invalid RSS item');
  const title = plainExcerpt(xmlText(item.title), 240);
  const url = sourceLink(xmlText(item.link), config);
  const publishedAt = iso(xmlText(item.pubDate) || xmlText(item['dc:date']));
  if (!title || !url || !publishedAt) throw new Error('Incomplete RSS item');
  const id = xmlText(item.guid) || url;
  const description = xmlText(item.description);
  // Full content:encoded is never excerpted or retained. It is inspected only for rights exceptions.
  const rightsText = `${description}\n${xmlText(item['content:encoded'])}`;
  const rightsPlainText = plainExcerpt(rightsText, 100000);
  if (RESERVED_RIGHTS.test(rightsText) || RESERVED_RIGHTS.test(rightsPlainText) || THIRD_PARTY_ORIGIN.test(rightsPlainText)) return { skipped: 'rights-exception', id };
  if (config.id === 'fda') return event(config, { id, title, category: 'recall', summary: plainExcerpt(description),
    location: usRecallLocation(), publishedAt, updatedAt: iso(xmlText(item.updated)) || publishedAt, url });
  const excerpt = plainExcerpt(description, 360);
  const relevance = config.id === 'eff' ? DIGITAL_NEWS : HAZARD_NEWS;
  if (config.id === 'eff' && /(?:donor.advised|\bDAF\b|donat(?:e|ion)|fundrais|membership|join us|upcoming events)/i.test(title)) return { skipped: 'fundraising-or-events' };
  if (!relevance.test(`${title} ${excerpt}`)) return { skipped: 'outside-topic-scope' };
  const author = plainExcerpt(unique(list(item['dc:creator'] || item.author).map(xmlText)).join(', '), 300);
  // Do not publish a CC excerpt when its required byline is absent.
  if (!author) return { skipped: 'missing-attribution' };
  return event(config, { id, title, category: 'news', summary: excerpt,
    attribution: `By ${author}, ${config.name}. Shortened excerpt; formatting removed.`,
    location: rssLocation(item), publishedAt, updatedAt: iso(xmlText(item.updated)) || publishedAt, url });
}

function parseJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') throw new Error('Expected JSON object or array');
  return data;
}

function parseRss(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Expected nonempty RSS XML');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(raw)) throw new Error('XML document types and entity declarations are not allowed');
  if (XMLValidator.validate(raw) !== true) throw new Error('Invalid RSS XML');
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false,
    trimValues: true, processEntities: true, ignoreDeclaration: true });
  const data = parser.parse(raw);
  if (!data.rss?.channel || typeof data.rss.channel !== 'object' || !xmlText(data.rss.channel.title)) throw new Error('Expected RSS channel with title');
  return data.rss.channel;
}

/** Parse one response. Malformed feed containers throw; malformed items are counted. */
export function adaptSource(sourceId, raw, { now = new Date() } = {}) {
  const config = SOURCE_BY_ID.get(sourceId);
  if (!config) throw new Error('Unknown briefing source');
  const time = new Date(now).getTime();
  if (!Number.isFinite(time)) throw new Error('Invalid adapter time');
  const data = config.format === 'xml' ? parseRss(raw) : parseJson(raw);
  let items, adapter, sourceUpdatedAt = null;
  const warnings = [];
  if (sourceId.startsWith('nws')) {
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Expected NWS FeatureCollection');
    items = data.features; adapter = adaptNws; sourceUpdatedAt = iso(data.updated);
    if (data.pagination?.next || (sourceId === 'nws-cancellations' && items.length >= 100)) warnings.push('The cancellation/query window may be truncated; no additional pages were fetched.');
  } else if (sourceId === 'usgs') {
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || (data.metadata?.status && data.metadata.status !== 200)) throw new Error('Expected successful USGS FeatureCollection');
    items = data.features; adapter = adaptUsgs; sourceUpdatedAt = iso(data.metadata?.generated);
    if (Number.isFinite(data.metadata?.count) && data.metadata.count !== items.length) warnings.push('USGS metadata count does not match returned items.');
  } else if (sourceId === 'cpsc') {
    if (!Array.isArray(data)) throw new Error('Expected CPSC recall array');
    items = data; adapter = adaptCpsc;
  } else if (sourceId === 'cisa-kev') {
    if (!Array.isArray(data.vulnerabilities) || !scalar(data.catalogVersion)) throw new Error('Expected CISA KEV catalog');
    items = data.vulnerabilities; adapter = adaptKev; sourceUpdatedAt = iso(data.dateReleased);
    if (Number.isFinite(data.count) && data.count !== items.length) warnings.push('KEV catalog count does not match returned items.');
  } else {
    items = list(data.item); adapter = adaptRss; sourceUpdatedAt = iso(xmlText(data.lastBuildDate));
  }
  const records = new Map(), skippedReasons = {}, excludedIds = [];
  let rejectedCount = 0, skippedCount = 0, duplicatesRemoved = 0;
  for (const item of items) {
    try {
      const record = adapter(item, config, time);
      if (record.skipped) {
        if (record.skipped === 'rights-exception' && record.id) excludedIds.push(record.id);
        skippedCount += 1;
        skippedReasons[record.skipped] = (skippedReasons[record.skipped] || 0) + 1;
        continue;
      }
      const previous = records.get(record.id);
      if (previous) {
        duplicatesRemoved += 1;
        const newest = Date.parse(record.updatedAt || record.publishedAt) >= Date.parse(previous.updatedAt || previous.publishedAt);
        if (!newest && record.status !== 'cancelled') continue;
      }
      records.set(record.id, record);
    } catch { rejectedCount += 1; }
  }
  if (items.length && rejectedCount === items.length) throw new Error('Every source item was malformed; preserve the last successful source result');
  if (rejectedCount) warnings.push(`${rejectedCount} malformed source item(s) were omitted.`);
  if (skippedReasons['missing-attribution']) warnings.push(`${skippedReasons['missing-attribution']} news item(s) omitted because their author attribution was missing.`);
  if (skippedReasons['rights-exception']) warnings.push(`${skippedReasons['rights-exception']} item(s) omitted due to possible source-specific rights restrictions.`);
  const incompleteGeography = [...records.values()].filter(record => record.geo?.incomplete || record.geo?.truncated).length;
  if (incompleteGeography) warnings.push(`${incompleteGeography} notice(s) have incomplete or bounded geographic codes; local matching may omit affected areas.`);
  return { events: [...records.values()], excludedIds, coverage: { sourceId, status: warnings.length ? 'partial' : 'ok',
    receivedCount: items.length, acceptedCount: records.size, rejectedCount, skippedCount, skippedReasons,
    duplicatesRemoved, sourceUpdatedAt, warnings, scope: config.coverage } };
}
