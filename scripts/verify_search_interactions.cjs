/* Browser-local async search interactions, without a browser dependency. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('search.js','utf8');
const index=require('../search-index.json');
function element(){return {value:'',children:[],events:{},attrs:{},hidden:false,
 setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},
 addEventListener(k,f){this.events[k]=f;},append(...children){this.children.push(...children);},
 replaceChildren(){this.children=[];},
 querySelectorAll(){return this.children.filter(x=>x.href);},querySelector(){return this.querySelectorAll()[0];}};}
function fixture({dedicated=false}={}){
 const input=element(),results=element(),status=element(),topic=element(),category=element(),type=element(),form=dedicated?element():null;
 const requests=[],timers=new Map();let nextTimer=0;
 const document={activeElement:{tagName:'BODY'},body:element(),createElement:()=>element(),addEventListener(){},
  querySelectorAll:s=>s==='.topic-grid,.topic-card'?[topic]:[],
  querySelector:s=>({'#global-search':input,'#search-results':results,'#search-status':status,'#global-search-form':form,'#search-category':category,'#search-type':type}[s]||null)};
 vm.runInNewContext(code,{document,URLSearchParams,location:{search:''},history:{state:null,replaceState(){}},
  fetch:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject})),
  setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 return {input,results,status,topic,requests,timers,document,form,
  type(value){input.value=value;input.events.input();},
  key(key){input.events.keydown({key,preventDefault(){}});},
  flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const complete=async request=>{request.resolve({ok:true,json:()=>Promise.resolve(index)});await tick();};
(async()=>{
 const home=fixture();assert.equal(home.requests.length,0,'Homepage must not load the index before intent');
 home.input.events.focus();assert.equal(home.requests.length,1);
 home.type('tornado');home.type('water unsafe');assert.equal(home.requests.length,1,'Concurrent intent must share one request');
 assert.equal(home.timers.size,1,'Typing must debounce');assert.match(home.status.textContent,/Loading/);
 home.key('Escape');assert.equal(home.timers.size,0);assert.equal(home.results.hidden,true);assert.equal(home.topic.hidden,false);
 await complete(home.requests[0]);assert.equal(home.results.hidden,true,'Late index arrival must not reopen cleared search');
 assert.equal(home.results.attrs['aria-busy'],'false');
 home.type('tornado');home.type('water unsafe');home.flush();
 assert.equal(home.results.children[0].href,'/emergencies/water-disruption/');assert.equal(home.topic.hidden,true);
 home.type('');assert.equal(home.results.hidden,true);assert.equal(home.topic.hidden,false);
 home.type('tornado');home.key('ArrowDown');assert(home.results.children[0].focused,'ArrowDown must focus fresh, not stale results');
 assert.equal(home.timers.size,0);
 const failing=fixture();failing.type('tornado');failing.requests[0].reject(Error('offline'));await tick();failing.flush();
 assert.equal(failing.requests.length,1,'A debounce timer must not silently retry failed loading');
 assert.match(failing.status.textContent,/could not load/);assert.equal(failing.results.attrs['aria-busy'],'false');
 assert.equal(failing.results.children[0].type,'button');
 failing.results.children[0].events.click();assert.equal(failing.requests.length,2);await complete(failing.requests[1]);
 assert.equal(failing.results.children[0].href,'/emergencies/tornado/');
 const lateFailure=fixture();lateFailure.type('gas');lateFailure.type('');lateFailure.requests[0].reject(Error('offline'));await tick();
 assert.equal(lateFailure.results.hidden,true,'Late failure must not reopen cleared search');assert.equal(lateFailure.status.textContent,'SEARCH ALL TOPICS');
 const search=fixture({dedicated:true});assert.equal(search.requests.length,1,'Dedicated search loads immediately');await complete(search.requests[0]);
 assert.equal(search.results.querySelectorAll().length,30);
 assert([...home.requests,...failing.requests,...search.requests].every(r=>r.url==='/search-index.json?v=oz19'),'Queries must never be transmitted');
 console.log('PASS: lazy intent, loading deduplication, debounce, clear/Escape races, keyboard focus, failure recovery and local query privacy.');
})().catch(error=>{console.error(error);process.exitCode=1;});
