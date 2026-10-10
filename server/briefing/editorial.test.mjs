import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialFor, presentationFor, newsRelevance } from './editorial.mjs';

test('compact card meaning stays reviewed, conditional and separate from source instructions', () => {
  for (const category of ['weather','earthquake','recall','cyber','news']) {
    const result = editorialFor({category,title:'Source headline'});
    assert.ok(result.cardMeaning.length > 50 && result.cardMeaning.length < 180);
    assert.ok(!/\b(safe|all clear|evacuate|take medicine)\b/i.test(result.cardMeaning));
    assert.ok(result.guides.length >= (category==='news'?1:2) && result.guides.length <= 4);
  }
  assert.match(editorialFor({category:'recall'}).cardMeaning,/exact model or lot/);
  assert.match(editorialFor({category:'cyber'}).cardMeaning,/does not establish a breach/);
  assert.match(editorialFor({category:'earthquake'}).cardMeaning,/does not establish damage or a tsunami warning/);
});

test('readable weather title uses event and verified affected area, never issuer geography', () => {
  const result=presentationFor({category:'weather',title:'Wind Advisory issued October 10 at 12:21PM EDT until October 11 at 2:00PM EDT by NWS State College PA',summary:'* WHAT...Southeast winds 15 to 25 mph with maximum gusts between 45 and 50 mph expected. * IMPACTS...Gusty winds will blow around unsecured objects. Tree limbs could be blown down.',location:{label:'Cambria; Somerset',codes:['PA'],precision:'source area'}});
  assert.equal(result.displayTitle,'Wind advisory: Cambria and Somerset, PA');
  assert.equal(result.displaySummary,'The notice lists “Southeast winds 15 to 25 mph with maximum gusts between 45 and 50 mph expected” as the hazard.');
  assert.doesNotMatch(result.displayTitle,/issued|until|State College/);
});

test('tropical local statement removes CAP boilerplate and uses its complete source banner', () => {
  const event={category:'weather',title:'Tropical Cyclone Local Statement issued October 10 by NWS San Diego CA',summary:'HLSSGX This product covers EXTREME SOUTHWESTERN CALIFORNIA **Impacts from Tropical Storm Rachel Expected in San Diego County Late Tonight through Sunday Afternoon** NEW INFORMATION... - Storm Intensity 60 mph - Movement ',location:{label:'San Diego County',codes:['CA'],precision:'source area'}};
  const result=presentationFor(event);
  assert.equal(result.displaySummary,'The NWS headline states: “Impacts from Tropical Storm Rachel Expected in San Diego County Late Tonight through Sunday Afternoon”.');
  assert.doesNotMatch(result.displaySummary,/HLSSGX|NEW INFORMATION|Movement|60 mph/);
  assert.equal(editorialFor({...event,eventType:result.eventType}).guides[0].url,'/emergencies/tropical-storm/');
});

test('source sentences never finish a truncated FDA warning or keep a dangling person initial', () => {
  const result=presentationFor({category:'recall',title:'Oliva LLC Issues Allergy Alert on Undeclared Sesame',summary:'Oliva LLC is recalling Baba Ghanouj because it contains undeclared sesame. People who have a severe allergy run the risk of a serious reaction if th'});
  assert.equal(result.displaySummary,'Oliva LLC is recalling Baba Ghanouj because it contains undeclared sesame.');
  assert.doesNotMatch(result.displaySummary,/if th|serious reaction/);
  const article=presentationFor({category:'news',title:'Digital security guide',summary:'This post was co-authored by Sheila B. Example. Account recovery can help restore access. A backup may protect important files.'});
  assert.equal(article.displaySummaryKind,'source-metadata');
  assert.doesNotMatch(article.displaySummary,/Sheila|Example/);
});

test('CAP section delimiters and all-uppercase headings never become invented complete sentences', () => {
  const event={category:'weather',title:'Hydrologic Outlook',summary:'ESFPPG A flood watch may be needed later. THE FLOOD WARNING CONTINUES FOR THE FOLLOWING RIVERS... River Example near Sample Town... additional fragment'};
  const result=presentationFor(event);
  assert.equal(result.displaySummary,'A flood watch may be needed later.');
  assert.equal(editorialFor(event).guides[0].url,'/emergencies/flooding/');
  const incomplete=presentationFor({category:'recall',title:'A recall',summary:'People who have an allergy or severe sensitivity run the risk of serious'});
  assert.equal(incomplete.displaySummaryKind,'source-metadata');
  assert.match(incomplete.displaySummary,/does not provide a complete short summary/);
});

test('bounded source-metadata sentences preserve complete hazard clauses and observation facts',()=>{
  const weather=presentationFor({category:'weather',title:'Coastal Flood Advisory',summary:'* WHAT...Minor coastal flooding. * WHERE...Flagler County. * WHEN...Until Sunday.'});
  assert.equal(weather.displaySummary,'The notice lists “Minor coastal flooding” as the hazard.');
  const marine=presentationFor({category:'weather',title:'Small Craft Advisory',summary:'Coastal Waters Forecast. .TODAY...SW wind 30 kt diminishing to 20 kt in the afternoon. Seas 11 ft. .TONIGHT...SW wind 25 kt.'});
  assert.equal(marine.displaySummary,'The notice’s forecast for today lists “SW wind 30 kt diminishing to 20 kt in the afternoon”.');
  const quake=presentationFor({category:'earthquake',title:'M 7.7 - 20 km W of Example',summary:'Magnitude 7.7. Values may be revised by USGS.'});
  assert.equal(quake.displayTitle,'Magnitude 7.7 earthquake: 20 km W of Example');
  assert.match(quake.displaySummary,/USGS recorded a magnitude 7.7 earthquake/);
  assert.doesNotMatch(quake.displaySummary,/damage|tsunami|killed/);
});

test('weather planning and guides differ by reviewed event type, while retaining source priority',()=>{
  const cases=[['Winter Storm Warning','winter-storm'],['Rip Current Statement','rip-currents'],['Flood Warning','flooding'],['Tropical Cyclone Local Statement','tropical-storm'],['Frost Advisory','extreme-cold'],['Storm Surge Watch','storm-surge']];
  const meanings=new Set();
  for(const [title,slug] of cases){const result=editorialFor({category:'weather',title});assert.equal(result.guides[0].url,`/emergencies/${slug}/`);assert.match(result.cardMeaning,/If /);assert.match(result.whatThisMeans,/current source instructions take priority/);meanings.add(result.cardMeaning);}
  assert.equal(meanings.size,cases.length);
});

test('policy commentary remains background, while practical digital reporting stays relevant',()=>{
  for(const title of ['Resisting the Menace of Federal Data Consolidation','Court Rejects Surveillance Lawsuit','Privacy Podcast: How to Fix the Internet','Congress Debates a Data Breach Bill']){
    assert.equal(newsRelevance({title}).relevance,'background');
    const mapped=editorialFor({category:'news',title});assert.equal(mapped.guides.length,1);assert.match(mapped.cardMeaning,/Background reporting/);
  }
  for(const title of ['Digital Doxxing: What to Do if You Are Targeted','How to Protect Your Accounts from Phishing','Flooding displaces residents'])assert.equal(newsRelevance({title}).relevance,'household');
});

test('HLS headline quotation preserves negation, possibility and conditions without a grammar rewrite',()=>{
 for(const heading of [
  'Impacts from Hurricane Example Not Expected Along the Coast',
  'Impacts from Hurricane Example Possibly Expected Along the Coast',
  'Impacts from Hurricane Example Expected Only If the Track Changes',
  'Impacts from Hurricane Example Possible Along the Coast',
 ]) {
  const result=presentationFor({category:'weather',title:'Tropical Cyclone Local Statement',summary:`HLSTST This product covers TEST AREA **${heading}** NEW INFORMATION...`});
  assert.equal(result.displaySummary,`The NWS headline states: “${heading}”.`);
  assert.equal(result.displaySummaryKind,'source-metadata');
  assert.doesNotMatch(result.displaySummary,/are expected/);
 }
});

test('technical path notation is preserved and cannot become a detached lowercase cyber clause',()=>{
 const source='ONLYOFFICE Docs contains a path traversal vulnerability that can occur when JWT is used, via a /.. sequence in an image upload parameter and could allow for remote code execution.';
 const result=presentationFor({category:'cyber',title:'CVE-2021-3199: ONLYOFFICE Docs Server Path Traversal Vulnerability',summary:`Known exploited vulnerability: ${source}`});
 assert.equal(result.displaySummary,source);
 assert.doesNotMatch(result.displaySummary,/^sequence/);
 const detached=presentationFor({category:'cyber',title:'A vulnerability',summary:'sequence in a parameter could allow remote code execution.'});
 assert.equal(detached.displaySummaryKind,'source-metadata');
});

test('contiguous excerpts keep lead prohibitions and cannot promote a less restrictive follow-on',()=>{
 for(const lead of ['It is not safe to drink the water.','Do not drink the water.']) {
  const result=presentationFor({category:'news',title:'Water contamination report',summary:`${lead} Boiling can remove some contaminants.`});
  assert.equal(result.displaySummary,`${lead} Boiling can remove some contaminants.`);
 }
 for(const lead of ['If flooding is expected.','Residents who have lost access to.','sequence in a parameter could allow code execution.']) {
  const result=presentationFor({category:'news',title:'Source report',summary:`${lead} Residents may need shelter.`});
  assert.equal(result.displaySummaryKind,'source-metadata');
  assert.doesNotMatch(result.displaySummary,/Residents may need shelter/);
 }
});
