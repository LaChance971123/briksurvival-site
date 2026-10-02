const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app.js','utf8');
function fixture(path,storage={}) {
 const elements=[],scripts=[];
 const element=tag=>({tag,dataset:{},children:[],events:{},append(...x){this.children.push(...x)},appendChild(x){this.children.push(x)},setAttribute(k,v){this[k]=v},addEventListener(k,f){this.events[k]=f}});
 const main=element('main'),body=element('body');body.appendChild=s=>scripts.push(s);
 const store={getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v};
 const document={body,querySelector:s=>s==='main'?main:null,querySelectorAll:()=>[],createElement:tag=>{const e=element(tag);elements.push(e);return e}};
 let reloads=0; const window={location:{pathname:path,reload:()=>reloads++},localStorage:store,sessionStorage:store};
 vm.runInNewContext(code,{document,window,Date});
 return {elements,scripts,main,reloads:()=>reloads};
}
for(const p of ['/','/index.html','/index','/indexv3.html','/search/','/emergencies/tornado/','/emergencies/cpr/','/emergencies/armed-conflict/','/privacy/','/thanks/','/unknown']) {
 const x=fixture(p);assert.equal(x.scripts.length,0,p);assert.equal(x.main.children.length,0,p);
}
for(const p of ['/library/','/preparedness/go-bag/','/guides/water-purification/','/topics/','/resources/','/about/']) {
 const x=fixture(p);assert.equal(x.scripts.length,0,'No ads before user choice: '+p);
 const enable=x.elements.find(e=>e.textContent==='Continue with ads');assert(enable,p);enable.events.click();
 assert.equal(x.scripts.length,1,p);assert.equal(x.scripts[0].async,true);
 assert(p.startsWith('/guides/')?x.scripts[0].dataset.zone==='11941449':x.scripts[0].src.endsWith('11941494'));
 enable.events.click();assert.equal(x.scripts.length,1,'No duplicate zones');
 x.elements.find(e=>e.textContent==='Use focus mode').events.click();assert.equal(x.reloads(),1);
}
const capped=fixture('/library/',{'oz-ad-start':String(Date.now())});capped.elements.find(e=>e.textContent==='Continue with ads').events.click();assert.equal(capped.scripts.length,0);
assert(fs.readFileSync('sw.js','utf8').includes('11941494'));
console.log('PASS: homepage/search/response exclusions, explicit ad choice, both zones, no stacking, focus reload and session cap.');
