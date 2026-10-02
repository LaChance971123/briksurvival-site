const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('ads.js','utf8');
function fixture(path) {
 const scripts=[],root={dataset:{}},events={};
 const document={documentElement:root,head:{appendChild:s=>scripts.push(s)},querySelector:s=>scripts.find(e=>s===`script[data-oz-ad="${e.dataset.ozAd}"]`),createElement:tag=>({tag,dataset:{},events:{},addEventListener(k,f){this.events[k]=f}}),addEventListener:(k,f)=>events[k]=f};
 const context={document,window:{location:{pathname:path}}};
 vm.runInNewContext(code,context);
 return {scripts,root,events,rerun:()=>vm.runInNewContext(code,{...context})};
}
for(const p of ['/','/index.html','/index','/indexv3.html','/search/','/search/index.html','/emergencies/','/emergencies/tornado/','/emergencies/cpr/index.html','/emergencies/armed-conflict/','/emergencies/returning-home/','/privacy/','/thanks/','/unknown']) assert.equal(fixture(p).scripts.length,0,p);
for(const p of ['/library/','/library/index.html','/library/conflict/','/preparedness/go-bag/','/preparedness/','/guides/','/guides/water-purification/index.html','/topics/','/resources/','/about/','/emergencies/disaster-scams/','/emergencies/verify-information/index.html']) {
 const x=fixture(p),base=p.replace(/\/index\.html$/,'').replace(/\/$/,'');
 const hub=['/library','/preparedness','/topics','/resources','/about'].includes(base);
 assert.equal(x.scripts.length,hub?2:1,p);
 const v=x.scripts.find(s=>s.dataset.ozAd==='vignette');assert.equal(v.dataset.zone,'11941449');assert.equal(v.src,'https://n6wxm.com/vignette.min.js');assert.equal(v.async,true);
 v.events.load();assert.equal(v.dataset.ozState,'loaded');v.events.error();assert.equal(v.dataset.ozState,'error');
 if(hub){const push=x.scripts.find(s=>s.dataset.ozAd==='push');assert.equal(push.src,'https://5gvci.com/act/files/tag.min.js?z=11941494');assert.equal(push.dataset.cfasync,'false');}
 x.rerun();assert.equal(x.scripts.length,hub?2:1,'No duplicate formats');
 x.events.securitypolicyviolation({effectiveDirective:'script-src-elem',blockedURI:'inline'});assert.equal(x.root.dataset.ozAdCsp,'script-src-elem:inline');
}
assert(!/oz-focus|oz-ad-start|Continue with ads|ad-stop-button/.test(code));
assert(!fs.readFileSync('app.js','utf8').includes('n6wxm'));
assert(fs.readFileSync('scripts/refine_site.py','utf8').includes('/ads.js?v=oz8" async'));
assert(fs.readFileSync('scripts/stage_site.py','utf8').includes("'ads.js'"));
assert(fs.readFileSync('sw.js','utf8').includes('11941494'));
console.log('PASS: early vignette coverage, secondary push hubs, critical-page exclusions, no duplicate formats, delivery diagnostics.');
