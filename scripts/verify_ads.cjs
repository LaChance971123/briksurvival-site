const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app.js','utf8');
function fixture(path) {
 const scripts=[];
 const document={body:{appendChild:s=>scripts.push(s)},querySelector:s=>s==='script[data-oz-ad]'?scripts.find(e=>e.dataset.ozAd):null,querySelectorAll:()=>[],createElement:tag=>({tag,dataset:{}})};
 // Deliberately omit storage and interaction APIs: automatic ads must need neither.
 const context={document,window:{location:{pathname:path}},Date};
 vm.runInNewContext(code,context);
 return {scripts,rerun:()=>vm.runInNewContext(code,{...context})};
}
for(const p of ['/','/index.html','/index','/indexv3.html','/search/','/search/index.html','/emergencies/','/emergencies/tornado/','/emergencies/cpr/index.html','/emergencies/armed-conflict/','/privacy/','/privacy/index.html','/thanks/','/unknown']) {
 assert.equal(fixture(p).scripts.length,0,p);
}
for(const p of ['/library/','/library/index.html','/library/conflict/','/preparedness/go-bag/','/guides/','/guides/water-purification/index.html','/topics/','/topics/index.html','/resources/','/about/']) {
 const x=fixture(p);assert.equal(x.scripts.length,1,'Automatic ads: '+p);
 const script=x.scripts[0];assert.equal(script.async,true);assert.equal(script.dataset.ozAd,'true');
 if(p.startsWith('/guides/')) {assert.equal(script.dataset.zone,'11941449');assert.equal(script.src,'https://n6wxm.com/vignette.min.js');}
 else {assert.equal(script.dataset.cfasync,'false');assert.equal(script.src,'https://5gvci.com/act/files/tag.min.js?z=11941494');}
 x.rerun();assert.equal(x.scripts.length,1,'No duplicate zones: '+p);
 assert.equal(fixture(p).scripts.length,1,'Next document loads without session cooldown: '+p);
}
assert(!/oz-focus|oz-ad-start|Continue with ads|ad-stop-button|createElement\('button'\)/.test(code));
assert(fs.readFileSync('sw.js','utf8').includes('11941494'));
console.log('PASS: automatic advertising, important-page exclusions and index aliases, both zones, no stacking, no opt-in/control/cooldown.');
