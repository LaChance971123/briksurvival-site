const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('search.js','utf8'),index=JSON.parse(fs.readFileSync('search-index.json','utf8'));
function element(){return {value:'',children:[],events:{},hidden:false,setAttribute(){},focus(){this.focused=true;},addEventListener(k,f){this.events[k]=f;},append(...x){this.children.push(...x);},replaceChildren(){this.children=[];},querySelectorAll(sel){return this.children.filter(x=>x.href&&(!sel.includes('.search-result')||x.className==='search-result'));},querySelector(sel){return this.querySelectorAll(sel)[0];}};}
async function fixture({browse=false,query='',state=null,transfer=null,blocked=false}={}){
 const input=element(),results=element(),status=element(),category=element(),type=element(),form=element(),browseForm=element();browseForm.querySelector=()=>input;
 const storage=new Map(transfer===null?[]:[['oz-search-transfer-v1',transfer]]),requests=[],navigations=[];
 const history={state,replaceState(s,unused,url){this.state=s;this.url=url;}};
 const document={activeElement:{tagName:'BODY'},body:element(),createElement:()=>element(),addEventListener(){},querySelectorAll:s=>s.startsWith('form.library-search')&&browse?[browseForm]:[],querySelector:s=>browse?null:({'#global-search':input,'#search-results':results,'#search-status':status,'#global-search-form':form,'#search-category':category,'#search-type':type}[s]||null)};
 const context={document,history,location:{search:query,assign:x=>navigations.push(x)},sessionStorage:{getItem:k=>{if(blocked)throw Error();return storage.get(k)??null;},setItem:(k,v)=>{if(blocked)throw Error();storage.set(k,v);},removeItem:k=>storage.delete(k)},URLSearchParams,fetch:url=>{requests.push(url);return Promise.resolve({ok:true,json:()=>Promise.resolve(index)});},setTimeout,clearTimeout};
 vm.runInNewContext(code,context);await new Promise(resolve=>setImmediate(resolve));
 return {input,results,form,browseForm,history,storage,requests,navigations};
}
(async()=>{
 const b=await fixture({browse:true});b.input.value='water unsafe';let prevented=false;b.browseForm.events.submit({preventDefault(){prevented=true;}});assert(prevented);assert.equal(b.storage.get('oz-search-transfer-v1'),'water unsafe');assert.deepEqual(b.navigations,['/search/']);assert.equal(b.requests.length,0);
 const f=await fixture({browse:true,blocked:true});f.input.value='water unsafe';let intercepted=false;f.browseForm.events.submit({preventDefault(){intercepted=true;}});assert(!intercepted,'Storage unavailable must retain disclosed native GET fallback');
 const p=await fixture({transfer:'water unsafe'});assert.equal(p.input.value,'water unsafe');assert(!p.storage.has('oz-search-transfer-v1'));assert.equal(p.history.state.ozSearch.query,'water unsafe');assert.equal(p.history.url,'/search/');assert(p.requests.every(x=>x.startsWith('/search-index.json?')));
 const restored=await fixture({state:p.history.state});assert.equal(restored.input.value,'water unsafe');assert.equal(restored.results.children[0].href,'/emergencies/water-disruption/');
 const shared=await fixture({query:'?q=tornado&category=natural-hazards'});assert.equal(shared.input.value,'tornado');assert(!shared.history.url.includes('q='));assert(shared.history.url.includes('category=natural-hazards'));
 const all=await fixture();assert.equal(all.results.querySelectorAll('a.search-result').length,30);all.results.children.at(-1).events.click();assert.equal(all.results.querySelectorAll('a.search-result').length,60);assert(all.results.querySelectorAll('a.search-result')[30].focused);
 console.log('PASS: private browse handoff, blocked-storage fallback, query refresh, shared-link cleanup and result expansion focus.');
})().catch(e=>{console.error(e);process.exitCode=1;});
