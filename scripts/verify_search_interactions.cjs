/* Browser-local async search interactions, without a browser dependency. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('search.js','utf8');
const index=require('../search-index.json');
const {rank}=require('../search.js');
function element(){return {value:'',children:[],events:{},attrs:{},hidden:false,
 setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},
 addEventListener(k,f){this.events[k]=f;},append(...children){this.children.push(...children);},
 replaceChildren(){this.children=[];},
 querySelectorAll(){return this.children.filter(x=>x.href);},querySelector(){return this.querySelectorAll()[0];}};}
function fixture({dedicated=false}={}){
 const input=element(),results=element(),status=element(),topic=element(),category=element(),type=element(),form=dedicated?element():null;
 const requests=[],timers=new Map(),createdTags=[];let nextTimer=0;
 const document={activeElement:{tagName:'BODY'},body:element(),createElement:tag=>{createdTags.push(tag);return element();},addEventListener(){},
  querySelectorAll:s=>s==='.topic-grid,.topic-card'?[topic]:[],
  querySelector:s=>({'#global-search':input,'#search-results':results,'#search-status':status,'#global-search-form':form,'#search-category':category,'#search-type':type}[s]||null)};
 vm.runInNewContext(code,{document,URLSearchParams,location:{search:''},history:{state:null,replaceState(){}},
  fetch:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject})),
  setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 return {input,results,status,topic,requests,timers,document,form,createdTags,
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
 assert(!home.createdTags.includes('datalist'),'Search must not create native suggestions that overlay the input on iOS');
 assert.equal(home.input.attrs.list,undefined,'Only inline search results should be attached to the input');
 home.type('tornado');home.type('water unsafe');home.flush();
 assert.equal(home.results.children[0].href,'/emergencies/water-disruption/');assert.equal(home.topic.hidden,false,'Topics remain available below inline results');
 home.type('water');home.flush();const total=rank(index,'water').length;
 assert(total>10,'Broad query must exercise multiple result pages');
 assert.equal(home.results.querySelectorAll().length,5,'Homepage starts with five inline results');
 assert.equal(home.status.textContent,'Showing 5 of '+total+' results for “water”');
 assert.match(home.results.children.at(-1).textContent,new RegExp('\\('+String(total-5)+' remaining\\)'));
 home.results.children.at(-1).events.click();assert.equal(home.results.querySelectorAll().length,10);
 assert(home.results.querySelectorAll()[5].focused,'Show more must focus the first newly revealed result');
 assert.equal(home.status.textContent,'Showing 10 of '+total+' results for “water”');
 let shown=10;
 while(shown<total){home.results.children.at(-1).events.click();shown=Math.min(shown+5,total);assert.equal(home.results.querySelectorAll().length,shown);}
 assert.equal(home.status.textContent,total+' results for “water”');
 assert.equal(home.results.children.at(-1).className,'search-result','Show more disappears when all results are visible');
 home.type('fire');home.flush();assert.equal(home.results.querySelectorAll().length,5,'A new query resets homepage expansion');
 home.type('zzzzzzzz');home.flush();assert.equal(home.status.textContent,'0 results for “zzzzzzzz”');
 assert.equal(home.results.children[0].className,'search-empty');assert.equal(home.topic.hidden,false);
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
 assert.equal(search.status.textContent,'Showing 30 of '+index.length+' results');
 search.results.children.at(-1).events.click();assert.equal(search.results.querySelectorAll().length,60,'Dedicated search retains batches of thirty');
 assert(search.results.querySelectorAll()[30].focused);
 assert(!search.createdTags.includes('datalist'));assert.equal(search.input.attrs.list,undefined);
 assert([...home.requests,...failing.requests,...search.requests].every(r=>r.url==='/search-index.json?v=oz19'),'Queries must never be transmitted');
 console.log('PASS: inline-only suggestions, homepage batches of five, visible topics, dedicated batches of thirty, expansion focus, lazy loading, debounce, clear/Escape races, failure recovery and local query privacy.');
})().catch(error=>{console.error(error);process.exitCode=1;});
