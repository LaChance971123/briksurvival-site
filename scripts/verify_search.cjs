const assert=require('node:assert/strict');
const {rank}=require('../search.js');const data=require('../search-index.json');
const cases={'lights out':'Power outage','blackout':'Power outage','twister':'Tornado','smell gas':'Natural gas leak','no cell service':'Communications outage','water unsafe':'Water disruption','freezing no heat':'Extreme cold','tornadoo':'Tornado','how much water should I store':'Emergency water storage','need to leave home':'Evacuation','cant breathe smoke':'Wildfire smoke','tornado warning':'Tornado'};
Object.assign(cases,{'bomb went off':'Explosions & nearby shelling','toilet wont flush':'Sewer failure & toilets without service','my family is missing':'Family separation & reunification','out of medicine':'Medicines during disrupted services','government is the threat':'When authorities are unsafe to approach','no heat':'Heating failure in cold weather','no running water':'Water outage','landmine':'Mines & unexploded ordnance','fake aid':'Disaster scams & false aid offers'});
for(const [q,title] of Object.entries(cases))assert.equal(rank(data,q)[0]?.title,title,q);
assert.equal(rank(data,'tornado','','Emergency guide')[0].content_type,'Emergency guide');
assert.equal(rank(data,'','', 'Checklist').length,0,'Retired PDFs must not be searchable');
assert(rank(data,'','', 'Toolkit').length>0,'Toolkit sales descriptions must be discoverable');
assert(rank(data,'gas','natural-hazards').every(d=>d.category_id==='natural-hazards'));
assert.equal(rank(data,'zzzzzzzz').length,0);
console.log('PASS: phrase matching, aliases, typo tolerance, category/type filters and no-result searches.');
const regression={
 'stroke':'Suspected stroke','heart attack':'Chest pain & suspected heart attack','chest pain':'Chest pain & suspected heart attack',
 'my baby is choking':'Infant choking','baby not breathing':'Child & infant CPR',
 'how do I survive a tornado':'Tornado','there is a fire in my kitchen':'Home fire',
 'earthqauke':'Earthquake','power cut':'Power outage','no power in my apartment':'Power outage',
 'I smell natural gas in my house':'Natural gas leak','wifi down':'Communications outage',
 'insulin getting warm':'Medicines during disrupted services','apartment evacuation':'Apartment & high-rise fire',
 'seizure':'Seizures','epipen':'Severe allergy & anaphylaxis','narcan':'Suspected opioid overdose',
 'lost in woods':'Lost outdoors','flood cleanup':'Flood cleanup & mold','cheap emergency kit':'Preparedness on a limited budget'
};
for(const [q,title] of Object.entries(regression))assert.equal(rank(data,q)[0]?.title,title,q);
for(const d of data.filter(d=>d.priority===10))assert.equal(rank(data,d.title)[0]?.url,d.url,d.title);
assert(!rank(data,'stroke').slice(0,3).some(d=>d.title==='Lightning'),'Medical intent must not be corrected to lightning strike');
assert.equal(rank(data,'zzzzzzzz unknownword').length,0);
assert.equal(rank(data,'').length,data.length);
for(const type of ['Toolkit','Published reference','Emergency guide','Preparedness guide','Field guide'])assert(rank(data,'','',type).every(d=>d.content_type===type));
console.log(`PASS: ${Object.keys(regression).length+data.filter(d=>d.priority===10).length} audit regressions and canonical title searches.`);
