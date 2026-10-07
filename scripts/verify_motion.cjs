/* Progressive reveal behavior must never hide keyboard/reduced-motion content. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js','utf8').split('// Progressive enhancement only:')[1].split('\n').slice(1).join('\n');
function run(reduced=false, supported=true){
 const sections = Array.from({length:2},()=>({classes:new Set(),events:{},classList:{add(name){this.owner.classes.add(name)}},addEventListener(name,fn){this.events[name]=fn}}));
 sections.forEach(s=>s.classList.owner=s);
 let change, callback, disconnected=false;
 const win={matchMedia:()=>({matches:reduced,addEventListener:(name,fn)=>change=fn})};
 class Observer{constructor(fn){callback=fn}observe(){}unobserve(){}disconnect(){disconnected=true}}
 if(supported)win.IntersectionObserver=Observer;
 vm.runInNewContext(source,{window:win,document:{querySelectorAll:()=>sections},IntersectionObserver:Observer});
 return {sections,get change(){return change},get callback(){return callback},get disconnected(){return disconnected}};
}
let t=run(true);assert(t.sections.every(s=>!s.classes.has('oz-reveal-ready')));
t=run(false,false);assert(t.sections.every(s=>!s.classes.has('oz-reveal-ready')));
t=run();assert(t.sections.every(s=>s.classes.has('oz-reveal-ready')));
t.sections[0].events.focusin();assert(t.sections[0].classes.has('oz-revealed'));
t.callback([{isIntersecting:true,target:t.sections[1]}]);assert(t.sections[1].classes.has('oz-revealed'));
t.change({matches:true});assert(t.disconnected);assert(t.sections.every(s=>s.classes.has('oz-revealed')));
console.log('PASS: reduced-motion, unsupported-browser, keyboard-focus and scroll-reveal fallbacks.');
