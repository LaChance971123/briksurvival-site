/** Bounded, source-independent editorial mapping. No model-generated advice. */
const guide = (title, url) => ({title, url});
const guides = {
  alerts: guide('Emergency alerts', '/preparedness/emergency-alerts/'),
  plan: guide('Household emergency plan', '/preparedness/household-emergency-plan/'),
  verify: guide('Verify emergency information', '/emergencies/verify-information/'),
  contacts: guide('Household contact plan', '/preparedness/emergency-contact-plan/'),
  inventory: guide('Household inventory', '/preparedness/preparedness-inventory/'),
  earthquake: guide('Earthquake', '/emergencies/earthquake/'),
  weather: guide('Severe weather', '/emergencies/severe-weather/'),
};
const weatherRules = [
  [/tornado/i, 'Tornado', 'tornado'],
  [/flash flood/i, 'Flash flood', 'flash-flood'],
  [/flood|hydrologic outlook/i, 'Flooding', 'flooding'],
  [/storm surge/i, 'Storm surge', 'storm-surge'],
  [/hurricane/i, 'Hurricane', 'hurricane'],
  [/tropical storm|tropical cyclone/i, 'Tropical storm', 'tropical-storm'],
  [/thunderstorm/i, 'Thunderstorm', 'thunderstorm'],
  [/hail/i, 'Hail', 'hail'],
  [/high wind|wind warning|wind advisory|damaging wind/i, 'Damaging winds', 'damaging-winds'],
  [/heat/i, 'Extreme heat', 'extreme-heat'],
  [/wind chill|extreme cold|freeze|frost/i, 'Extreme cold', 'extreme-cold'],
  [/ice storm|freezing rain/i, 'Ice storm', 'ice-storm'],
  [/winter|snow|blizzard|ice storm/i, 'Winter storm', 'winter-storm'],
  [/rip current|beach hazards|high surf/i, 'Rip currents', 'rip-currents'],
  [/dust storm|blowing dust/i, 'Dust-storm driving', 'dust-storm-driving'],
  [/smoke|air quality/i, 'Wildfire smoke', 'wildfire-smoke'],
  [/fire weather|red flag/i, 'Wildfire', 'wildfire'],
];
const weatherPlanning = {
  'tornado': ['If this notice covers you, check NWS instructions now and identify a sturdy shelter away from windows.', 'Review shelter access for everyone in the household, including anyone who needs mobility or communication support.'],
  'flash-flood': ['If this notice covers your home or route, check NWS timing and road closures before travel; review how to reach higher ground without entering floodwater.', 'Identify an alternative route and transport help before water blocks roads.'],
  'flooding': ['If this notice covers your home or route, check the named waterway and flood timing, then review travel alternatives and protection for essential items.', 'Plan around flooded roads and river access; use the original notice for the affected locations and changing river levels.'],
  'storm-surge': ['If this notice covers your coast, check the stated inundation area and local instructions, then review how to reach a suitable inland destination.', 'Review evacuation transport and timing before rising water blocks routes; use the source for the actual affected area.'],
  'hurricane': ['If this notice covers you, review the latest storm track, local instructions and your shelter or evacuation plan before conditions deteriorate.', 'Check transport, medicines, water and a way to receive further instructions if power or mobile service fails.'],
  'tropical-storm': ['If this notice covers you, check the latest storm timing and local instructions, then review shelter, travel and power-outage plans.', 'Review household transport, essential supplies and an alternative way to get updates; different parts of a storm can affect different areas.'],
  'thunderstorm': ['If this notice covers you, check its timing and plan access to sturdy indoor shelter before outdoor activity.', 'Review travel and power-outage alternatives and secure loose items only while conditions allow.'],
  'hail': ['If this notice covers you, check its timing and plan indoor shelter for people and animals before the storm arrives.', 'Consider how to protect vehicles and essential equipment only while conditions allow.'],
  'damaging-winds': ['If this notice covers you, check the strongest-wind timing and review travel, loose outdoor items and backup power needs.', 'Consider vulnerable trees, overhead lines and anyone who depends on powered equipment when reviewing the household plan.'],
  'extreme-heat': ['If this notice covers you, check the heat timing and arrange cooling, drinking water and support for people most affected by heat.', 'Review a cooling alternative if power fails, including transport and care needs.'],
  'extreme-cold': ['If this notice covers you, check the temperature and timing, then review safe heating, warm clothing and exposed water pipes.', 'Check that backup heating plans do not depend on running fuel-burning equipment indoors.'],
  'ice-storm': ['If this notice covers you, check road conditions and timing, then review safe heat and a plan for a prolonged power interruption.', 'Consider postponing nonessential travel and review access to medicines, food and assistance.'],
  'winter-storm': ['If this notice covers you, check snow or ice timing before travel and review warm shelter, supplies and a power-outage plan.', 'Plan for household access, medicines and safe heating if roads or utilities are disrupted.'],
  'rip-currents': ['If you will visit the named coast, check the current beach conditions and lifeguard instructions before entering the water.', 'Review the beach-hazard guidance with anyone in your group; the location and timing in the source matter.'],
  'dust-storm-driving': ['If this notice covers your route, check visibility and road conditions before driving and review a safer travel alternative.', 'Use the dust-storm driving guide to review what to do if visibility deteriorates.'],
  'wildfire-smoke': ['If this notice covers you, check the current air-quality guidance and review indoor cleaner-air options and necessary outdoor activity.', 'Consider people with breathing difficulties, available filtration and a fallback if power is unavailable.'],
  'wildfire': ['If this notice covers you, check local fire restrictions and review evacuation transport, essential items and a way to receive further warnings.', 'Review the household wildfire plan while conditions allow; this notice alone does not establish that a fire is at your location.'],
};

function weatherRuleFor(event) {
  const title = event.eventType || event.title || '';
  if (/tropical cyclone/i.test(title) && /\bhurricane\b/i.test(event.summary || '')) return weatherRules.find(rule => rule[2] === 'hurricane');
  return weatherRules.find(([pattern]) => pattern.test(title)) || (/special weather statement/i.test(title) ? weatherRules.find(([pattern]) => pattern.test(event.summary || '')) : null);
}

const PRACTICAL_DIGITAL = /\b(?:doxxing|doxing|phishing|ransomware|malware|stalkerware|data breach(?:es)?|account security|passwords?|passkeys?|scams?|security updates?|two.factor|multi.factor|backups?|protect(?:ing)? (?:your|yourself)|incident response)\b/i;
const POLICY_CONTEXT = /\b(?:lawsuit|litigation|court|congress|parliament|legislation|bill|lawmakers?|policy|podcast|conference|campaign|donate|fundraising|data consolidation|surveillance laws?|constitutional|supreme court)\b/i;
const HOUSEHOLD_HAZARD = /\b(?:earthquake|tsunami|floods?|flooding|wildfire|hurricane|tropical storm|heatwave|heat wave|drought|power outage|blackout|water shortage|water outage|contaminated water|disease outbreak|epidemic|displacement|displaced|evacuation|internet shutdown)\b/i;
export function newsRelevance(event) {
  const title = event.title || '';
  const practical = !POLICY_CONTEXT.test(title) && (PRACTICAL_DIGITAL.test(title) || HOUSEHOLD_HAZARD.test(title));
  return practical ? {relevance:'household',relevanceReason:'Practical preparedness or digital-security reporting; check its date and your own circumstances.'}
    : {relevance:'background',relevanceReason:'Policy, advocacy or other background reporting; not a current household incident or local alert.'};
}

// These are structured CAP assessment/action fields, not prose paragraphs.
// Never detach their numbers or instructions from the accompanying qualifiers.
const WEATHER_STRUCTURED_LABEL = /\b(?:LOCATIONS AFFECTED|LATEST LOCAL FORECAST|THREAT TO LIFE AND PROPERTY|POTENTIAL IMPACTS)\b|\b(?:PLAN|PREPARE|ACT)\s*:/i;
const segmenter = new Intl.Segmenter('en', {granularity:'sentence'});
const HAS_PREDICATE = /\b(?:is|are|was|were|will|can|could|may|might|must|has|have|had|remains?|continues?|causes?|poses?|contains?|includes?|affects?|allows?|recalls?|issued|announced|reports?|warns?|threatens?|occurred|struck|began|ended|reached|produces?|affect|cause|sweep|damage|lead|expect|expecting|reported|help|helps|protect|protects|violate|violates|adopted|treats|recalling|says|said|explains|explained|describes|described|do|avoid|use|check|stay|seek|follow|stop|keep|leave|never|refrain)\b/i;
function completeSentences(text, {weather=false,maximum=560} = {}) {
  let cleaned=String(text || '').slice(0,16000);
  if(weather)cleaned=cleaned
    .replace(/^\s*(?:HLS|ESF)[A-Z]{3}\s+/, '')
    .replace(/\*?\s*(?:WHAT|WHERE|WHEN|IMPACTS?|HAZARD|SOURCE|ADDITIONAL DETAILS)\s*\.{2,}/g, ' ∷ ')
    // Only CAP uses ellipses as section delimiters. Preserve technical notation
    // such as /.. in KEV descriptions and omission marks in reported news.
    .replace(/\.{2,}/g,' ∷ ').replace(/\*+/g,' ');
  cleaned=cleaned.replace(/\s+/g,' ').trim();
  const picked=[];
  for(const part of cleaned.split('∷').flatMap(section=>[...segmenter.segment(section)])) {
    const sentence=part.segment.replace(/^[.∷\s-]+/,'').replace(/\s+([,;!?])/g,'$1').trim();
    if(!sentence)continue;
    if(weather && WEATHER_STRUCTURED_LABEL.test(sentence))break;
    // Only known CAP metadata can be skipped. Rejected substantive content ends
    // the excerpt: never surface a later sentence after dropping its caution.
    if(weather && /\b(?:NEW INFORMATION|CHANGES TO WATCHES|STORM INFORMATION|CURRENT WATCHES|This product covers|FOR THE FOLLOWING (?:AREAS|RIVERS)|forecasts (?:reflect|represent))\b/i.test(sentence))continue;
    if(/^[“"'(\[]*[a-z]/.test(sentence) || !/[.!?][\]”"')]*$/.test(sentence) || /(?:…|\.\.)[.!?]?$/.test(sentence) || !HAS_PREDICATE.test(sentence))break;
    if(/\b(?:to|if|and|or|because|with|for|the|a|an|of|in|at|by|from|that|which)[.!?]$/.test(sentence))break;
    if(/^(?:if|unless|although|because|when|until|provided that|only if)\b/i.test(sentence) && !sentence.includes(','))break;
    if(/\b(?:co.authored by|https?:\/\/|www\.)/i.test(sentence) || /\b[A-Z]\.$/.test(sentence) || sentence===sentence.toUpperCase() || sentence.length>maximum)break;
    if(picked.join(' ').length+sentence.length+(picked.length?1:0)>maximum)break;
    picked.push(sentence);if(picked.length===2)break;
  }
  return picked.join(' ');
}
function readableArea(event) {
  const location=event.location || {};
  if(location.precision==='unknown' || !location.label || /unspecified|not established/i.test(location.label))return '';
  const places=location.label.split(';').map(value=>value.trim()).filter(Boolean);
  let area=places.length>2?`${places.slice(0,2).join(', ')} and other named areas`:places.join(' and ');
  if(area.length>130)return '';
  const states=location.codes || [];
  if(states.length===1&&!new RegExp(`\\b${states[0]}\\b`).test(area))area+=`, ${states[0]}`;
  return area;
}
export function weatherEventType(event) {
  return (event.eventType || event.title || '').replace(/\s+issued\s+.*$/i,'').replace(/^The\s+/,'').replace(/\s+has been (?:cancelled|replaced).*$/i,'').replace(/[.]$/,'').trim();
}
export function presentationFor(event) {
  let displayTitle=event.title || '';
  let displaySummary=completeSentences(event.summary,{weather:event.category==='weather'});
  let displaySummaryKind='source-excerpt';
  let eventType=event.eventType || '';
  if(event.category==='weather') {
    eventType=weatherEventType(event);
    const type=eventType.replace(/Local Statement$/i,'local update');
    const readable=type?type[0].toUpperCase()+type.slice(1).toLowerCase():'Weather notice';
    const area=readableArea(event);
    displayTitle=`${readable}${area?`: ${area}`:''}`;
    // Preserve the entire headline, including negations and conditions. Never
    // turn a possible/conditional/negative impact heading into an assertion.
    const banner=String(event.summary || '').match(/\*\*(Impacts? from [^*]{1,340})\*\*/i)?.[1];
    if(banner && !WEATHER_STRUCTURED_LABEL.test(banner)) {
      displaySummary=`The NWS headline states: “${banner}”.`;
      displaySummaryKind='source-metadata';
    }
    if(!displaySummary) {
      const what=String(event.summary || '').match(/\*\s*WHAT\.{2,}\s*([\s\S]*?)(?=\s*\*\s*(?:WHERE|WHEN|IMPACTS?|ADDITIONAL DETAILS)\.{2,}|$)/i)?.[1]?.trim();
      if(what && !WEATHER_STRUCTURED_LABEL.test(what) && /[^.]\.$/.test(what) && !/\.{2,}|[∷…]/.test(what) && what.length<380 && !/[<>]/.test(what)) {
        displaySummary=`The notice lists “${what.replace(/\.$/,'')}” as the hazard.`;
        displaySummaryKind='source-metadata';
      }
    }
    if(!displaySummary && /marine|gale|small craft|storm warning|hazardous seas/i.test(eventType)) {
      const today=String(event.summary || '').match(/\.TODAY\.{2,}\s*((?:(?:[NSEW]{1,3}|Variable) winds?|Light winds) [^.]{1,180})\./)?.[1];
      if(today) {
        displaySummary=`The notice’s forecast for today lists “${today}”.`;
        displaySummaryKind='source-metadata';
      }
    }
    if(!displaySummary) {
      displaySummary=`The National Weather Service issued a ${eventType.toLowerCase() || 'weather notice'}${area?` for ${area}`:''}. Open the source for its affected areas and instructions.`;
      displaySummaryKind='source-metadata';
    }
  } else if(event.category==='earthquake') {
    const observation=displayTitle.match(/^M\s+([\d.]+)\s*-\s*(.+)$/);
    displayTitle=displayTitle.replace(/^M\s+([\d.]+)\s*-\s*/,'Magnitude $1 earthquake: ');
    if(observation) {
      displaySummary=`USGS recorded a magnitude ${observation[1]} earthquake with the reported location “${observation[2].replace(/[.]$/,'')}”. Magnitude and location may be revised.`;
      displaySummaryKind='source-metadata';
    }
  } else if(event.category==='recall') {
    displayTitle=displayTitle.replace(/\s+(?:Due to|Because of)\s+.*$/i,'').replace(/;\s*(?:Sold|Violates?|Fail).*$/i,'').replace(/\bRecalls\b/,'recalls');
    if(displayTitle.length>190 || /…$/.test(displayTitle)) {
      const issuer=displayTitle.split(/\s+(?:Expands?\s+)?Recalls?\b/i)[0];
      if(issuer.length<100)displayTitle=`${issuer}: product recall notice`;
    }
  } else if(event.category==='cyber') {
    const match=displayTitle.match(/^(CVE-\d{4}-\d+):\s*(.+)$/);
    if(match)displayTitle=`${match[2]} (${match[1]})`;
    displaySummary=completeSentences((event.summary || '').replace(/^Known exploited vulnerability:\s*/i,''));
  }
  if(!displaySummary) {
    displaySummary=event.category==='recall'?'The feed does not provide a complete short summary. Open the original notice for affected products and instructions.':'The feed does not provide a complete short summary. Open the original source for context.';
    displaySummaryKind='source-metadata';
  }
  return {eventType,displayTitle,displaySummary,displaySummaryKind,...(event.category==='news'?newsRelevance(event):{})};
}
const baseSteps = [
  'Open the original source and check its latest update, affected area or product, and any instructions before making a decision.',
  'Check the household plan for communication, transport, accessibility and care needs. Use the linked guides to review gaps while conditions allow.',
];
export function editorialFor(event) {
  let selected = [guides.verify, guides.plan];
  let meaning = 'This source item offers context for preparation. Its inclusion does not establish a threat at your location. Check the original source before acting.';
  let cardMeaning = 'Use this report as context for planning; it does not establish a threat in your area.';
  let steps = [...baseSteps];
  if (event.category === 'weather') {
    const rule = weatherRuleFor(event);
    selected = [rule ? guide(rule[1], `/emergencies/${rule[2]}/`) : guides.weather, guides.alerts, guides.plan];
    meaning = 'This is a snapshot of a weather notice for the area described by the source. Its timing and instructions can change between briefings. Current source instructions take priority over general preparedness guidance.';
    const planning=rule && weatherPlanning[rule[2]];
    cardMeaning = planning?planning[0]:/marine|gale|small craft|storm warning|hazardous seas/i.test(event.eventType || event.title || '')?'If you use the named waters, check the latest marine forecast and review whether to change the trip or remain ashore.':'If this notice covers your plans, check its specific hazard, area and timing before choosing a relevant preparedness step.';
    if(planning)steps=['Check the original NWS notice and its latest instructions first.',planning[1]];
    else if(/marine|gale|small craft|hazardous seas/i.test(event.eventType || event.title || ''))steps=['Check the latest NWS marine forecast for the exact waters and timing before departure.','Review the trip, communications and a safe-harbor alternative in light of the source’s instructions.'];
    meaning=`${cardMeaning} This is a dated source snapshot; current source instructions take priority over general planning guidance.`;
  } else if (event.category === 'earthquake') {
    selected = [guides.earthquake, guides.contacts, guides.plan];
    meaning = 'USGS reports an earthquake observation. Reported magnitude and location may be revised. A recorded earthquake does not establish damage, a tsunami warning or danger at your location.';
    cardMeaning = 'If you are near the reported earthquake, check local updates; this observation alone does not establish damage or a tsunami warning.';
  } else if (event.category === 'recall') {
    selected = [guides.inventory, guides.verify];
    meaning = 'A recall applies to the products, models, lots and distribution details in the original notice. A similar product name alone does not establish that your item is included.';
    cardMeaning = 'If you own this product, match its exact model or lot against the notice and follow the stated remedy.';
    steps = ['Compare the exact product identifiers you own with the original recall notice. Follow the notice’s product-specific instructions and remedy.', 'Record the notice link and any matching product identifiers in your household inventory. Do not substitute general guidance for the source’s instructions.'];
  } else if (event.category === 'cyber') {
    selected = [guides.verify, guides.contacts];
    meaning = 'CISA lists a known exploited vulnerability in specified technology. This is not a report of a breach of your household, device or organization. Check product and version applicability with the vendor.';
    cardMeaning = 'If you use the named product and version, check the vendor’s update instructions. This listing does not establish a breach.';
    steps = ['Check whether you use the named product and version. Follow CISA’s linked action and the vendor’s current update instructions.', 'Review how your household would communicate if a service or device became unavailable. The linked library guides cover continuity and information verification, not a technical security assessment.'];
  } else if (event.category === 'news') {
    const topic = [
      [/\bearthquake\b/i, guides.earthquake],
      [/\b(flooding|floods|flash flood)\b/i, guide('Flooding', '/emergencies/flooding/')],
      [/\b(wildfire|wildfires)\b/i, guide('Wildfire', '/emergencies/wildfire/')],
      [/\b(power outage|blackout|blackouts)\b/i, guide('Power outage', '/emergencies/power-outage/')],
      [/\b(water shortage|water shortages|water outage)\b/i, guide('Water disruption', '/emergencies/water-disruption/')],
      [/\b(displaced|displacement)\b/i, guide('Displacement', '/emergencies/displacement/')],
    ].find(([pattern]) => pattern.test(event.title || ''));
    if (topic) selected = [topic[1], guides.verify, guides.plan];
    const relevance=newsRelevance(event);
    if(relevance.relevance==='background') {
      cardMeaning='Background reporting for understanding policy or public debate; it does not identify a household emergency.';
      meaning='This is reporting or advocacy context, not an official notice or verified local incident. Read the article and its date before drawing conclusions about your circumstances.';
      selected=[guides.verify];steps=['Read the original reporting, its date and attribution. Keep policy commentary separate from current operational instructions.'];
    } else if(PRACTICAL_DIGITAL.test(event.title || '')) {
      cardMeaning='If this security topic applies to you, check the article’s date and review the relevant accounts, devices or recovery plan.';
      meaning='This reporting may support practical digital preparation. It does not establish that your accounts or devices were compromised.';
      selected=[guides.verify,guides.contacts];
    }
  }
  const resources = event.category === 'recall' ? [
    {label:'Consumer product recalls · CPSC (US)',url:'https://www.cpsc.gov/Recalls'},
    {label:'Recalls and safety alerts · FDA (US)',url:'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts'},
  ] : event.category === 'cyber' ? [{label:'Known Exploited Vulnerabilities catalog · CISA',url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'}] : event.category === 'earthquake' ? [{label:'Earthquake observations · USGS',url:'https://earthquake.usgs.gov/earthquakes/map/'}] : event.category === 'weather' ? [{label:'Current weather notices · NWS (US)',url:'https://www.weather.gov/alerts'}] : [{label:'Emergency planning · Ready.gov (US)',url:'https://www.ready.gov/'}];
  return {whatThisMeans: meaning, cardMeaning, preparedness: steps, guides: selected, editorialReview: 'Fixed editorial mapping, reviewed 2026-10-10; not a specialist assessment.', resources};
}
