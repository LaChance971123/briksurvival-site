/* Shared, local full-text search. No query leaves the browser. */
(function(root){
 'use strict';
 const normalize=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const stop=new Set(['i','my','a','an','the','is','it','to','of','for','and','what','how','do','in','with','just','me','can','should','there','are','am','we','our','at','on','please','help','survive','happened','someone','person','has','have','having','their','they']);
 const models=new WeakMap();
 const words=s=>normalize(s).split(' ').filter(Boolean);
 const near=(a,b)=>{
  if(a.length<4||b.length<4||Math.abs(a.length-b.length)>1)return false;
  if(a.length===b.length){const diff=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff.push(i);return diff.length<=1||(diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]]);}
  const short=a.length<b.length?a:b,long=a.length<b.length?b:a;let i=0,j=0,miss=0;
  while(i<short.length&&j<long.length){if(short[i]===long[j]){i++;j++;}else{j++;if(++miss>1)return false;}}return true;
 };
 function prepare(items){
  if(!models.has(items)){const records=items.map(d=>({d,title:normalize(d.title),aliases:(d.aliases||[]).map(normalize),fields:[words(d.title),words((d.aliases||[]).join(' ')),words(d.category+' '+d.subcategory),words(d.summary+' '+d.text)]}));models.set(items,{records,vocabulary:new Set(records.flatMap(r=>r.fields.flat()))});}
  return models.get(items);
 }
 function rank(items,query,category='',type=''){
  const q=normalize(query),terms=[...new Set(words(q).filter(t=>!stop.has(t)))];
  prepare(items);
  const records=models.get(items).records.filter(r=>(!category||r.d.category_id===category)&&(!type||r.d.content_type===type));
  const vocabulary=models.get(items).vocabulary;
  // Correct a typo only when the query word has no exact match anywhere.
  // This prevents stroke from being corrected to strike on a lightning guide.
  const typo=new Map(terms.filter(t=>!vocabulary.has(t)).map(t=>[t,[...vocabulary].filter(w=>near(t,w))]));
  const scored=records.map(r=>{
   const {d,title,aliases,fields}=r;if(!q)return {d,score:d.priority||0};if(!terms.length)return {d,score:-1};
   let score=0,matched=0,anchor=0;
   if(title===q)score+=1000;
   if(aliases.includes(q))score+=900;
   const contains=(phrase)=>(' '+q+' ').includes(' '+phrase+' ');
   if(contains(title))score+=700;
   if(aliases.some(a=>a&&contains(a)))score+=650;
   for(const t of terms){
    let strength=0;
    fields.forEach((f,n)=>{if(f.includes(t))strength=Math.max(strength,[100,90,25,12][n]);});
    if(!strength&&t.length>=4)fields.slice(0,2).forEach((f,n)=>{if(f.some(w=>w.startsWith(t)))strength=Math.max(strength,[50,45][n]);});
    if(!strength&&typo.has(t))fields.slice(0,2).forEach((f,n)=>{if(f.some(w=>typo.get(t).includes(w)))strength=Math.max(strength,[35,30][n]);});
    if(strength){matched++;score+=strength;if(strength>=30)anchor++;}
   }
   const covered=matched/terms.length;
   if(!matched||(!anchor&&covered<1)||(anchor===1&&covered<.34&&score<650))return {d,score:-1};
   score+=covered*40+(d.priority||0);
   // Symptom search supports finding guidance, never diagnosing a condition.
   if(/\b(baby|infant)\b/.test(q)&&/\binfant\b/.test(title))score+=200;
   return {d,score};
  }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.d.title.localeCompare(b.d.title));
  const floor=terms.length>1&&scored[0]?.score>=650?scored[0].score*.15:0;
  return scored.filter(x=>x.score>=floor).map(x=>x.d);
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={rank,normalize};
 if(typeof document==='undefined')return;
 const transferKey='oz-search-transfer-v1';
 // Query text remains in tab-local memory. Storage restrictions fall back to explicit URL search.
 for(const browse of document.querySelectorAll('form.library-search[action="/search/"]')){
  browse.addEventListener('submit',e=>{
   const query=browse.querySelector('input[type="search"]').value.trim();
   try{sessionStorage.setItem(transferKey,query);}catch{return;}
   e.preventDefault();location.assign('/search/');
  });
 }
 const input=document.querySelector('#global-search')||document.querySelector('#emergency-search');
 const results=document.querySelector('#search-results')||document.querySelector('#home-search-results');
 const status=document.querySelector('#search-status')||document.querySelector('#finder-count');
 const category=document.querySelector('#search-category'),type=document.querySelector('#search-type');
 const form=document.querySelector('#global-search-form'),pageSize=form?30:5;let data=[],ready=false,limit=pageSize,loading=null,failed=false;
 if(!input||!results)return;
 let savedSearch=null;try{savedSearch=history.state?.ozSearch||null;}catch{}
 let restorePosition=null,lastResult=null,viewVersion=0;
 const params=new URLSearchParams(location.search);if(form){
  let transferred=null;try{transferred=sessionStorage.getItem(transferKey);sessionStorage.removeItem(transferKey);}catch{}
  input.value=params.get('q')??transferred??savedSearch?.query??'';
  category.value=params.get('category')||savedSearch?.category||'';
  type.value=params.get('type')||savedSearch?.type||'';
  if(!params.has('q')&&transferred===null&&savedSearch){
   limit=Number.isInteger(savedSearch.limit)?Math.max(30,Math.min(savedSearch.limit,1000)):30;
   if(Number.isFinite(savedSearch.scrollY))restorePosition=Math.max(0,savedSearch.scrollY);
   lastResult=typeof savedSearch.result==='string'?savedSearch.result:null;
  }
 }
 function saveState(){
  if(!form)return;
  const p=new URLSearchParams();if(category.value)p.set('category',category.value);if(type.value)p.set('type',type.value);
  try{history.replaceState({...history.state,ozSearch:{query:input.value.trim(),category:category.value,type:type.value,limit,scrollY:restorePosition??root.scrollY??0,result:lastResult}},'','/search/'+(p.size?'?'+p.toString():''));}catch{}
 }
 function restoreScroll(){
  if(restorePosition===null)return;
  const y=restorePosition,version=viewVersion;restorePosition=null;
  if(typeof root.requestAnimationFrame!=='function')return;
  root.requestAnimationFrame(()=>{
   if(version!==viewVersion)return;
   const link=[...results.querySelectorAll('a.search-result')].find(a=>a.getAttribute('href')===lastResult);
   if(link)link.focus({preventScroll:true});
   if(!location.hash&&typeof root.scrollTo==='function')root.scrollTo({top:y,behavior:'instant'});
  });
 }
 function render(reset=true){
  // Clearing must restore browsing immediately, even while the index is loading.
  if(!form&&!input.value.trim()){
   results.hidden=true;results.replaceChildren();
   document.querySelectorAll('.topic-grid,.topic-card').forEach(x=>x.hidden=false);
   const empty=document.querySelector('#no-results');if(empty)empty.hidden=true;
   if(status)status.textContent='SEARCH ALL TOPICS';
   return;
  }
  if(!ready){if(failed)showError();else load();return;}
  if(reset)limit=pageSize;
  const query=input.value.trim(),items=rank(data,query,category?.value||'',type?.value||'');
  if(form)saveState();
  else{results.hidden=!query;document.querySelectorAll('.topic-grid,.topic-card').forEach(x=>x.hidden=false);const empty=document.querySelector('#no-results');if(empty)empty.hidden=true;if(!query){if(status)status.textContent='SEARCH ALL TOPICS';return;}}
  results.replaceChildren();if(status)status.textContent=(items.length>limit?'Showing '+limit+' of ':'')+items.length+' '+(items.length===1?'result':'results')+(query?' for “'+query+'”':'');
  if(!items.length){const p=document.createElement('p');p.className='search-empty';p.textContent='No matching guidance found. Try the main hazard or symptom, clear filters, or browse by subject. Search cannot assess a medical emergency.';const link=document.createElement('a');link.href='/library/';link.textContent='Browse all topics';results.append(p,link);restoreScroll();return;}
  for(const d of items.slice(0,limit)){
   const a=document.createElement('a');a.className='search-result';a.href=d.url;
   if(d.url.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}
   const meta=document.createElement('span');meta.className='result-meta';meta.textContent=d.content_type+' · '+d.category+' / '+d.subcategory;
   const h=document.createElement('h2');h.textContent=d.title;
   const p=document.createElement('p');p.textContent=d.summary.length>240?d.summary.slice(0,237)+'…':d.summary;
   a.append(meta,h,p);
   a.addEventListener('click',()=>{lastResult=d.url;saveState();});
   results.append(a);
  }
  if(items.length>limit){const button=document.createElement('button');button.type='button';button.className='button button-outline';button.textContent='Show more results ('+(items.length-limit)+' remaining)';button.addEventListener('click',()=>{const previous=limit;limit+=pageSize;render(false);results.querySelectorAll('a.search-result')[previous]?.focus();});results.append(button);}
  restoreScroll();
 }
 let timer;
 function update(){viewVersion++;clearTimeout(timer);restorePosition=null;lastResult=null;render();}
 input.addEventListener('input',()=>{
  viewVersion++;restorePosition=null;lastResult=null;limit=pageSize;clearTimeout(timer);
  if(!input.value.trim()){render();return;}
  load();timer=setTimeout(render,100);
 });
 input.addEventListener('focus',()=>{if(!ready&&!failed)load();});
 input.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();update();results.querySelector('a')?.focus();}
  if(e.key==='Escape'){e.preventDefault();input.value='';update();}
 });
 results.addEventListener('keydown',e=>{const links=[...results.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();links[Math.min(i+1,links.length-1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();if(i<=0)input.focus();else links[i-1]?.focus();}if(e.key==='Escape')input.focus();});
 if(form)form.addEventListener('submit',e=>{e.preventDefault();update();});
 category?.addEventListener('change',update);type?.addEventListener('change',update);
 document.querySelector('#search-reset')?.addEventListener('click',()=>{category.value='';type.value='';update();input.focus();});
 function showError(){
  if(!form&&!input.value.trim()){render();return;}
  if(status)status.textContent='Search could not load. Try again or browse all topics.';
  results.hidden=false;results.replaceChildren();
  const b=document.createElement('button');b.type='button';b.textContent='Retry search';b.addEventListener('click',()=>load());
  const a=document.createElement('a');a.href='/library/';a.textContent='Browse all topics';results.append(b,a);
 }
 function load(){
  if(ready)return loading;
  if(form||input.value.trim()){if(status)status.textContent='Loading the library…';}
  if(loading)return loading;
  failed=false;results.setAttribute('aria-busy','true');
  loading=fetch('/search-index.json?v=oz19').then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(d=>{
   // Build normalized records once after loading, not on the first keystroke.
   prepare(d);data=d;ready=true;loading=null;
   results.setAttribute('aria-busy','false');clearTimeout(timer);render(false);
  }).catch(()=>{loading=null;failed=true;results.setAttribute('aria-busy','false');showError();});
  return loading;
 }
 if(form&&typeof root.addEventListener==='function')root.addEventListener('pagehide',saveState);
 // Dedicated search pages show the library immediately. Homepage browsing does
 // not need the full index until the visitor focuses or types into search.
 if(form||input.value.trim())load();
})(typeof window!=='undefined'?window:globalThis);
