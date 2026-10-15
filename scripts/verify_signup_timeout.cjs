const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const timers=new Map(),button={disabled:false},status={textContent:''};let submit,request,redirect;
 const form={dataset:{signup:'field-notes-newsletter'},reportValidity:()=>true,querySelector:s=>s==='button[type="submit"]'?button:s==='[data-form-status]'?status:null,addEventListener:(_,fn)=>submit=fn};
 const document={querySelector:()=>null,querySelectorAll:s=>s==='form[data-signup]'?[form]:[]};
 const ctx={document,navigator:{},window:{addEventListener(){}},location:{origin:'https://example.test',assign:p=>redirect=p},URLSearchParams,FormData:class{*[Symbol.iterator](){yield ['form-name','field-notes-newsletter'];}},AbortController,setTimeout:(fn,ms)=>{timers.set(ms,fn);return ms;},clearTimeout:id=>timers.delete(id),fetch:(_,options)=>new Promise((resolve,reject)=>{request={resolve,reject,options};options.signal.addEventListener('abort',()=>reject(Error('deadline')));})};
 vm.runInNewContext(readFileSync('app.js','utf8'),ctx);
 const pending=submit({preventDefault(){}});assert.equal(button.disabled,true);assert.ok(timers.has(15000));timers.get(15000)();await pending;assert.equal(button.disabled,false);assert.match(status.textContent,/may have been received/);assert.equal(redirect,undefined);
 const retry=submit({preventDefault(){}});request.resolve({ok:true});await retry;assert.match(redirect,/thanks/);assert.equal(timers.size,0);console.log('PASS: signup timeout restores controls without false failure claims; successful retry redirects.');
})().catch(e=>{console.error(e);process.exitCode=1;});
