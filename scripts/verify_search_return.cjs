/* Search preserves the return journey without adding query URLs/history entries. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('search.js','utf8'),index=require('../search-index.json');
function element(){return {value:'',children:[],events:{},attrs:{},hidden:false,
 setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this[k]??this.attrs[k]??null;},
 focus(options){this.focused=options||true;},addEventListener(k,f){this.events[k]=f;},
 append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},
 querySelectorAll(selector){return this.children.filter(x=>x.href&&(!selector.includes('.search-result')||x.className==='search-result'));},
 querySelector(selector){return this.querySelectorAll(selector)[0];}};}
async function fixture(state=null,blocked=false){
 const input=element(),results=element(),category=element(),type=element(),form=element(),status=element(),events={},frames=[],requests=[];
 const history={state,replaceState(next,unused,url){if(blocked)throw Error('denied');this.state=next;this.url=url;}};
 const document={activeElement:{tagName:'BODY'},events:{},body:element(),createElement:element,querySelectorAll:()=>[],
  addEventListener(name,fn){this.events[name]=fn;},querySelector:selector=>({'#global-search':input,'#search-results':results,'#search-status':status,'#global-search-form':form,'#search-category':category,'#search-type':type}[selector]||null)};
 const window={scrollY:0,addEventListener:(name,fn)=>events[name]=fn,requestAnimationFrame:fn=>frames.push(fn),scrollTo(options){this.scrollY=options.top;this.scrollOptions=options;}};
 vm.runInNewContext(code,{window,document,history,location:{search:'',hash:''},URLSearchParams,setTimeout,clearTimeout,
  fetch:url=>{requests.push(url);return Promise.resolve({ok:true,json:()=>Promise.resolve(index)});}});
 await new Promise(resolve=>setImmediate(resolve));
 return {input,results,category,type,form,status,events,frames,history,document,window,requests,flushFrames(){frames.splice(0).forEach(fn=>fn());}};
}
(async()=>{
 const first=await fixture();assert.equal(first.results.querySelectorAll('a.search-result').length,30);
 first.results.children.at(-1).events.click();assert.equal(first.results.querySelectorAll('a.search-result').length,60);
 first.window.scrollY=2400;const selected=first.results.querySelectorAll('a.search-result')[45];selected.events.click();first.events.pagehide();
 assert.equal(first.history.state.ozSearch.limit,60);assert.equal(first.history.state.ozSearch.scrollY,2400);
 assert.equal(first.history.state.ozSearch.result,selected.href);assert.equal(first.history.url,'/search/');
 const restored=await fixture(first.history.state);assert.equal(restored.results.querySelectorAll('a.search-result').length,60);
 restored.flushFrames();assert.equal(restored.window.scrollY,2400);assert.equal(restored.window.scrollOptions.behavior,'instant');
 assert(restored.results.querySelectorAll('a.search-result')[45].focused.preventScroll);
 const interrupted=await fixture(first.history.state);interrupted.input.value='tornado';interrupted.form.events.submit({preventDefault(){}});interrupted.flushFrames();
 assert.equal(interrupted.window.scrollY,0,'A newer query must cancel delayed scroll restoration');
 assert.equal(interrupted.results.querySelectorAll('a.search-result')[0].href,'/emergencies/tornado/');
 assert.equal(interrupted.history.state.ozSearch.limit,30);assert.equal(interrupted.history.url,'/search/');
 const blocked=await fixture(null,true);assert.equal(blocked.results.querySelectorAll('a.search-result').length,30,'Blocked history must not break results');
 assert.equal(first.document.events.keydown,undefined,'Do not install a global single-character shortcut');
 assert([...first.requests,...restored.requests,...interrupted.requests,...blocked.requests].every(url=>url==='/search-index.json?v=oz19'));
 console.log('PASS: expanded result/scroll/focus return, interrupted restoration, blocked history, private queries and no global character shortcut.');
})().catch(error=>{console.error(error);process.exitCode=1;});
