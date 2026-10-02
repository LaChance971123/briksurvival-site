/* Shared, local full-text search. No query leaves the browser. */
(function(root){
 'use strict';
 const normalize=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const stop=new Set(['i','my','a','an','the','is','it','to','of','for','and','what','how','do','in','with','just','me','can']);
 const near=(a,b)=>{
  if(a.length<4||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(++n>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}}
  return n+(i<a.length||j<b.length?1:0)<=1;
 };
 function rank(items,query,category='',type=''){
  const q=normalize(query),terms=q.split(' ').filter(t=>t&&!stop.has(t));
  return items.filter(d=>(!category||d.category_id===category)&&(!type||d.content_type===type)).map(d=>{
   if(!q)return {d,score:d.priority||0};
   const title=normalize(d.title),aliases=(d.aliases||[]).map(normalize),meta=normalize(d.category+' '+d.subcategory),body=normalize(d.summary+' '+d.text),fields=[title,aliases.join(' '),meta,body];
   let score=0;
   if(title===q)score+=500;
   if(aliases.includes(q))score+=400;
   if(title.includes(q))score+=100;
   if(aliases.some(a=>a.includes(q)))score+=80;
   for(const t of terms){
    let found=false;
    fields.forEach((f,n)=>{const words=f.split(' ');if(words.some(w=>w===t||w.startsWith(t))){score+=[40,35,10,3][n];found=true;}});
    if(!found){const words=fields.slice(0,3).join(' ').split(' ');if(words.some(w=>near(t,w))){score+=12;found=true;}}
    if(!found&&score<350)return {d,score:-1};
   }
   return {d,score:terms.length?score+(d.priority||0):-1};
  }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.d.title.localeCompare(b.d.title)).map(x=>x.d);
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={rank,normalize};
 if(typeof document==='undefined')return;
 const input=document.querySelector('#global-search')||document.querySelector('#emergency-search');
 const results=document.querySelector('#search-results')||document.querySelector('#home-search-results');
 const status=document.querySelector('#search-status')||document.querySelector('#finder-count');
 const category=document.querySelector('#search-category'),type=document.querySelector('#search-type');
 const form=document.querySelector('#global-search-form');let data=[],ready=false;
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.activeElement?.isContentEditable){e.preventDefault();if(input)input.focus();else location.href='/search/';}});
 if(!input||!results)return;
 const params=new URLSearchParams(location.search);if(form){input.value=params.get('q')||'';category.value=params.get('category')||'';type.value=params.get('type')||'';}
 function render(){
  if(!ready)return;
  const query=input.value.trim(),items=rank(data,query,category?.value||'',type?.value||'');
  if(form){const p=new URLSearchParams();if(query)p.set('q',query);if(category.value)p.set('category',category.value);if(type.value)p.set('type',type.value);history.replaceState(null,'','/search/'+(p.size?'?'+p.toString():''));}
  else{results.hidden=!query;document.querySelectorAll('.topic-grid,.topic-card').forEach(x=>x.hidden=Boolean(query));const empty=document.querySelector('#no-results');if(empty)empty.hidden=true;if(!query){if(status)status.textContent='SEARCH ALL TOPICS';return;}}
  results.replaceChildren();if(status)status.textContent=items.length+' '+(items.length===1?'result':'results')+(query?' for “'+query+'”':'');
  if(!items.length){const p=document.createElement('p');p.className='search-empty';p.textContent='No exact match. Try fewer words, clear the filters, or browse by subject.';const link=document.createElement('a');link.href='/library/';link.textContent='Browse all topics';results.append(p,link);return;}
  for(const d of items.slice(0,60)){
   const a=document.createElement('a');a.className='search-result';a.href=d.url;
   if(d.url.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}
   const meta=document.createElement('span');meta.className='result-meta';meta.textContent=d.content_type+' · '+d.category+' / '+d.subcategory;
   const h=document.createElement('h2');h.textContent=d.title;
   const p=document.createElement('p');p.textContent=d.summary.length>240?d.summary.slice(0,237)+'…':d.summary;
   a.append(meta,h,p);results.append(a);
  }
  if(items.length>60){const p=document.createElement('p');p.textContent='Showing 60 results. Narrow the query or use filters to see more specific matches.';results.append(p);}
 }
 let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,100);});
 input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('a')?.focus();}if(e.key==='Escape'){input.value='';render();}});
 results.addEventListener('keydown',e=>{const links=[...results.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();links[Math.min(i+1,links.length-1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();if(i<=0)input.focus();else links[i-1]?.focus();}if(e.key==='Escape')input.focus();});
 if(form)form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);render();});
 category?.addEventListener('change',render);type?.addEventListener('change',render);
 document.querySelector('#search-reset')?.addEventListener('click',()=>{category.value='';type.value='';render();input.focus();});
 function load(){if(status)status.textContent='Loading the library…';fetch('/search-index.json?v=oz6').then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(d=>{data=d;ready=true;render();}).catch(()=>{if(status)status.textContent='Search could not load. Try again or browse all topics.';results.hidden=false;results.replaceChildren();const b=document.createElement('button');b.textContent='Retry search';b.addEventListener('click',load);const a=document.createElement('a');a.href='/library/';a.textContent='Browse all topics';results.append(b,a);});}load();
})(typeof window!=='undefined'?window:globalThis);
