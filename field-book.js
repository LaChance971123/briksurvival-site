/* Local, progressive field-manual pages. No autoplay, tracking or dependencies. */
(function(scope){
 'use strict';
 const clamp=(n,total)=>Math.max(0,Math.min(total-1,n));
 const swipe=(dx,dy)=>Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.3?(dx<0?1:-1):0;
 function createBook(root,win=scope){
  const pages=[...root.querySelectorAll('[data-book-page]')],dots=[...root.querySelectorAll('[data-book-go]')];
  const prev=root.querySelector('[data-book-prev]'),next=root.querySelector('[data-book-next]'),controls=root.querySelector('[data-book-controls]'),count=root.querySelector('[data-book-count]'),status=root.querySelector('[data-book-status]'),hint=root.querySelector('[data-book-hint]');
  if(pages.length<2||!prev||!next||!controls||!count||!status)return null;
  const doc=root.ownerDocument, motion=win.matchMedia?win.matchMedia('(prefers-reduced-motion: reduce)'):{matches:true};
  const originalTabs=new WeakMap();let current=0,animations=[],timer=null,serial=0,gesture=null;
  const focusables=pages.map(p=>[...p.querySelectorAll('a,button,input,select,textarea,[tabindex]')]);
  focusables.flat().forEach(el=>originalTabs.set(el,el.getAttribute('tabindex')));
  function settle(){
   serial++;if(timer!==null){win.clearTimeout(timer);timer=null;}
   animations.forEach(a=>{try{a.cancel();}catch{}});animations=[];
   pages.forEach(p=>{p.classList.remove('is-leaving');p.style.removeProperty('will-change');});
  }
  function sync(announce){
   const focusedControl=doc.activeElement;
   pages.forEach((p,i)=>{
    const active=i===current;p.classList.toggle('is-current',active);p.hidden=false;p.inert=!active;
    if(active){p.removeAttribute('inert');p.removeAttribute('aria-hidden');}else{p.setAttribute('inert','');p.setAttribute('aria-hidden','true');}
    focusables[i].forEach(el=>{const old=originalTabs.get(el);if(!active)el.setAttribute('tabindex','-1');else if(old===null)el.removeAttribute('tabindex');else el.setAttribute('tabindex',old);});
   });
   dots.forEach((d,i)=>{if(i===current)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current');});
   prev.disabled=current===0;next.disabled=current===pages.length-1;
   count.textContent=String(current+1).padStart(2,'0')+' / '+String(pages.length).padStart(2,'0')+' · '+pages[current].dataset.title;
   if(announce)status.textContent='Page '+(current+1)+' of '+pages.length+': '+pages[current].dataset.title;
   if((focusedControl===prev&&prev.disabled)||(focusedControl===next&&next.disabled))root.focus({preventScroll:true});
  }
  function go(to,announce=true){
   const target=clamp(to,pages.length);if(target===current)return false;
   const old=current,direction=target>old?1:-1;settle();
   if(pages[old].contains(doc.activeElement))root.focus({preventScroll:true});
   current=target;sync(announce);
   if(motion.matches||typeof pages[current].animate!=='function')return true;
   const outgoing=pages[old],incoming=pages[current],token=serial;
   outgoing.classList.add('is-leaving');outgoing.style.willChange='transform,opacity';incoming.style.willChange='transform,opacity';
   const options={duration:320,easing:'cubic-bezier(.2,.65,.25,1)',fill:'both'};
   try{
    animations=[outgoing.animate([{transform:'none',opacity:1},{transform:`translateX(${-direction*8}%) rotateY(${-direction*16}deg)`,opacity:0}],options),incoming.animate([{transform:`translateX(${direction*7}%) rotateY(${direction*15}deg)`,opacity:0},{transform:'none',opacity:1}],options)];
    const finish=()=>{if(token===serial)settle();};animations[1].onfinish=finish;timer=win.setTimeout(finish,390);
   }catch{settle();}
   return true;
  }
  function cancelGesture(){
   const old=gesture;gesture=null;root.classList.remove('is-dragging');
   if(old&&root.hasPointerCapture?.(old.id)){try{root.releasePointerCapture(old.id);}catch{}}
  }
  prev.addEventListener('click',()=>go(current-1));next.addEventListener('click',()=>go(current+1));
  dots.forEach(d=>d.addEventListener('click',()=>go(Number(d.dataset.bookGo))));
  root.addEventListener('keydown',e=>{
   if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   const target=e.key==='ArrowRight'?current+1:e.key==='ArrowLeft'?current-1:e.key==='Home'?0:e.key==='End'?pages.length-1:null;
   if(target!==null){e.preventDefault();cancelGesture();go(target);}
  });
  root.addEventListener('pointerdown',e=>{
   if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0)||e.target.closest?.('a,button,input,select,textarea,[contenteditable="true"]'))return;
   if(!pages[current].contains(e.target))return;
   gesture={id:e.pointerId,x:e.clientX,y:e.clientY,locked:false};
  },{passive:true});
  root.addEventListener('pointermove',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(!gesture.locked){
    if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){cancelGesture();return;}
    if(Math.abs(dx)<12||Math.abs(dx)<=Math.abs(dy)*1.3)return;
    gesture.locked=true;root.classList.add('is-dragging');try{root.setPointerCapture?.(e.pointerId);}catch{}
   }
   if(e.cancelable)e.preventDefault();
  },{passive:false});
  root.addEventListener('pointerup',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const g=gesture,step=g.locked?swipe(e.clientX-g.x,e.clientY-g.y):0;cancelGesture();if(step)go(current+step);
  });
  root.addEventListener('pointercancel',cancelGesture);root.addEventListener('lostpointercapture',cancelGesture);
  win.addEventListener?.('resize',()=>{cancelGesture();settle();});
  const changed=()=>{cancelGesture();settle();};motion.addEventListener?.('change',changed);
  root.classList.add('is-ready');if(!root.hasAttribute('tabindex'))root.tabIndex=0;sync(false);controls.hidden=false;
  if(hint){hint.hidden=false;if(hint.id)root.setAttribute('aria-describedby',hint.id);}
  return {go,get index(){return current},cancel:()=>{cancelGesture();settle();}};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={createBook,clamp,swipe};
 if(typeof document!=='undefined')document.querySelectorAll('[data-field-book]').forEach(root=>createBook(root,scope));
})(typeof window!=='undefined'?window:globalThis);
