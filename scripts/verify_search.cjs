const assert=require('node:assert/strict');
const {rank}=require('../search.js');const data=require('../search-index.json');
const cases={'lights out':'Power outage','blackout':'Power outage','twister':'Tornado','smell gas':'Natural gas leak','no cell service':'Communications outage','water unsafe':'Water disruption','freezing no heat':'Extreme cold','tornadoo':'Tornado','how much water should I store':'Emergency water storage','need to leave home':'Evacuation','cant breathe smoke':'Wildfire smoke','tornado warning':'Tornado'};
Object.assign(cases,{'bomb went off':'Explosions & nearby shelling','toilet wont flush':'Sewer failure & toilets without service','my family is missing':'Family separation & reunification','out of medicine':'Medicines during disrupted services','government is the threat':'When authorities are unsafe to approach','no heat':'Heating failure in cold weather','no running water':'Water outage','landmine':'Mines & unexploded ordnance','fake aid':'Disaster scams & false aid offers'});
for(const [q,title] of Object.entries(cases))assert.equal(rank(data,q)[0]?.title,title,q);
assert.equal(rank(data,'tornado','','Checklist')[0].content_type,'Checklist');
assert(rank(data,'gas','natural-hazards').every(d=>d.category_id==='natural-hazards'));
assert.equal(rank(data,'zzzzzzzz').length,0);
console.log('PASS: phrase matching, aliases, typo tolerance, category/type filters and no-result searches.');
