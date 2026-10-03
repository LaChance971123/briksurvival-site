/* Shared, local full-text search. No query leaves the browser. */
(function(root){
 'use strict';
 const normalize=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const stop=new Set(['i','my','a','an','the','is','it','to','of','for','and','what','how','do','in','with','just','me','can','should','there','are','am','we','our','at','on','please','help','survive','happened','someone','person','has','have','having','their','they']);
 const words=s=>normalize(s).split(' ').filter(Boolean);
 const near=(a,b)=>{
  if(a.length<4||b.length<4||Math.abs(a.length-b.length)>1)return false;
  if(a.length===b.length){const diff=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff.push(i);return diff.length<=1||(diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]]);}
  const short=a.length<b.length?a:b,long=a.length<b.length?b:a;let i=0,j=0,miss=0;
  while(i<short.length&&j<long.length){if(short[i]===long[j]){i++;j++;}else{j++;if(++miss>1)return false;}}return true;
 };
 function rank(items,query,category='',type=''){
  const q=normalize(query),terms=[...new Set(words(q).filter(t=>!stop.has(t)))];
  const eligible=items.filter(d=>(!category||d.category_id===category)&&(!type||d.content_type===type));
  const records=eligible.map(d=>({d,title:normalize(d.title),aliases:(d.aliases||[]).map(normalize),fields:[words(d.title),words((d.aliases||[]).join(' ')),words(d.category+' '+d.subcategory),words(d.summary+' '+d.text)]}));
  const vocabulary=new Set(records.flatMap(r=>r.fields.flat()));
  // Correct a typo only when the query word has no exact match anywhere.
  // This prevents stroke from being corrected to strike on a lightning guide.
  const typo=new Map(terms.filter(t=>!vocabulary.has(t)).map(t=>[t,[...vocabulary].filter(w=>near(t,w))]));
  return records.map(r=>{
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
   if(!matched||(!anchor&&covered<.6)||(anchor===1&&covered<.34&&score<650))return {d,score:-1};
   score+=covered*40+(d.priority||0);
   // Symptom search supports finding guidance, never diagnosing a condition.
   if(/\b(baby|infant)\b/.test(q)&&/\binfant\b/.test(title))score+=200;
   return {d,score};
  }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.d.title.localeCompare(b.d.title)).map(x=>x.d);
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={rank,normalize};
 if(typeof document==='undefined')return;
 const input=document.querySelector('#global-search')||document.querySelector('#emergency-search');
 const results=document.querySelector('#search-results')||document.querySelector('#home-search-results');
 const status=document.querySelector('#search-status')||document.querySelector('#finder-count');
 const category=document.querySelector('#search-category'),type=document.querySelector('#search-type');
 const form=document.querySelector('#global-search-form');let data=[],ready=false,limit=30;
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.activeElement?.isContentEditable){e.preventDefault();if(input)input.focus();else location.href='/search/';}});
 if(!input||!results)return;
 const params=new URLSearchParams(location.search);if(form){input.value=params.get('q')||'';category.value=params.get('category')||'';type.value=params.get('type')||'';}
 function render(reset=true){
  if(!ready)return;
  if(reset)limit=30;
  const query=input.value.trim(),items=rank(data,query,category?.value||'',type?.value||'');
  if(form){const p=new URLSearchParams();if(category.value)p.set('category',category.value);if(type.value)p.set('type',type.value);history.replaceState(null,'','/search/'+(p.size?'?'+p.toString():''));}
  else{results.hidden=!query;document.querySelectorAll('.topic-grid,.topic-card').forEach(x=>x.hidden=Boolean(query));const empty=document.querySelector('#no-results');if(empty)empty.hidden=true;if(!query){if(status)status.textContent='SEARCH ALL TOPICS';return;}}
  results.replaceChildren();if(status)status.textContent=items.length+' '+(items.length===1?'result':'results')+(query?' for “'+query+'”':'');
  if(!items.length){const p=document.createElement('p');p.className='search-empty';p.textContent='No matching guidance found. Try the main hazard or symptom, clear filters, or browse by subject. Search cannot assess a medical emergency.';const link=document.createElement('a');link.href='/library/';link.textContent='Browse all topics';results.append(p,link);return;}
  for(const d of items.slice(0,limit)){
   const a=document.createElement('a');a.className='search-result';a.href=d.url;
   if(d.url.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}
   const meta=document.createElement('span');meta.className='result-meta';meta.textContent=d.content_type+' · '+d.category+' / '+d.subcategory;
   const h=document.createElement('h2');h.textContent=d.title;
   const p=document.createElement('p');p.textContent=d.summary.length>240?d.summary.slice(0,237)+'…':d.summary;
   a.append(meta,h,p);results.append(a);
  }
  if(items.length>limit){const button=document.createElement('button');button.type='button';button.className='button button-outline';button.textContent='Show more results ('+(items.length-limit)+' remaining)';button.addEventListener('click',()=>{limit+=30;render(false);});results.append(button);}
 }
 let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,100);});
 input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('a')?.focus();}if(e.key==='Escape'){input.value='';render();}});
 results.addEventListener('keydown',e=>{const links=[...results.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();links[Math.min(i+1,links.length-1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();if(i<=0)input.focus();else links[i-1]?.focus();}if(e.key==='Escape')input.focus();});
 if(form)form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);render();});
 category?.addEventListener('change',render);type?.addEventListener('change',render);
 document.querySelector('#search-reset')?.addEventListener('click',()=>{category.value='';type.value='';render();input.focus();});
 function load(){if(status)status.textContent='Loading the library…';fetch('/search-index.json?v=oz15').then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(d=>{data=d;ready=true;const list=document.createElement('datalist');list.id='topic-suggestions';for(const item of data.filter(x=>x.priority===10)){const option=document.createElement('option');option.value=item.title;list.append(option);}document.body.append(list);input.setAttribute('list',list.id);render();}).catch(()=>{if(status)status.textContent='Search could not load. Try again or browse all topics.';results.hidden=false;results.replaceChildren();const b=document.createElement('button');b.textContent='Retry search';b.addEventListener('click',load);const a=document.createElement('a');a.href='/library/';a.textContent='Browse all topics';results.append(b,a);});}load();
})(typeof window!=='undefined'?window:globalThis);
