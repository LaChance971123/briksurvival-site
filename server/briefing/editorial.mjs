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
  [/flood/i, 'Flooding', 'flooding'],
  [/hurricane/i, 'Hurricane', 'hurricane'],
  [/tropical storm/i, 'Tropical storm', 'tropical-storm'],
  [/thunderstorm/i, 'Thunderstorm', 'thunderstorm'],
  [/hail/i, 'Hail', 'hail'],
  [/high wind|wind warning|wind advisory|damaging wind/i, 'Damaging winds', 'damaging-winds'],
  [/heat/i, 'Extreme heat', 'extreme-heat'],
  [/wind chill|extreme cold|freeze/i, 'Extreme cold', 'extreme-cold'],
  [/ice storm|freezing rain/i, 'Ice storm', 'ice-storm'],
  [/winter|snow|blizzard|ice storm/i, 'Winter storm', 'winter-storm'],
  [/rip current/i, 'Rip currents', 'rip-currents'],
  [/dust storm|blowing dust/i, 'Dust-storm driving', 'dust-storm-driving'],
  [/smoke|air quality/i, 'Wildfire smoke', 'wildfire-smoke'],
  [/fire weather|red flag/i, 'Wildfire', 'wildfire'],
];
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
    const rule = weatherRules.find(([pattern]) => pattern.test(event.title));
    selected = [rule ? guide(rule[1], `/emergencies/${rule[2]}/`) : guides.weather, guides.alerts, guides.plan];
    meaning = 'This is a snapshot of a weather notice for the area described by the source. Its timing and instructions can change between briefings. Current source instructions take priority over general preparedness guidance.';
    cardMeaning = 'If the named area includes you, check the latest notice and follow its instructions before using general guides.';
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
  }
  const resources = event.category === 'recall' ? [
    {label:'Consumer product recalls · CPSC (US)',url:'https://www.cpsc.gov/Recalls'},
    {label:'Recalls and safety alerts · FDA (US)',url:'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts'},
  ] : event.category === 'cyber' ? [{label:'Known Exploited Vulnerabilities catalog · CISA',url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'}] : event.category === 'earthquake' ? [{label:'Earthquake observations · USGS',url:'https://earthquake.usgs.gov/earthquakes/map/'}] : event.category === 'weather' ? [{label:'Current weather notices · NWS (US)',url:'https://www.weather.gov/alerts'}] : [{label:'Emergency planning · Ready.gov (US)',url:'https://www.ready.gov/'}];
  return {whatThisMeans: meaning, cardMeaning, preparedness: steps, guides: selected, editorialReview: 'Fixed editorial mapping, reviewed 2026-10-10; not a specialist assessment.', resources};
}
