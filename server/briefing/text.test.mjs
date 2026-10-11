import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcePlainText,sourceText,textExcerpt,MAX_SOURCE_TEXT} from './text.mjs';
import {boundPublicEvents,MAX_PUBLIC_BODY_BYTES,MAX_PUBLIC_EVENT_BYTES} from './core.mjs';
test('paragraph extraction excludes third-party quotations/media and dangerous markup',()=>{
 assert.equal(sourcePlainText('<p>Original &amp; safe.</p><blockquote>Third party.</blockquote><figure>Caption</figure><script>steal()</script><p>Second paragraph.</p>'),'Original & safe.\n\nSecond paragraph.');
 assert.equal(sourcePlainText('<p>Credit: Writer. CC BY 4.0.</p>'),'Credit: Writer. CC BY 4.0.');
});
test('bounded source text and excerpts never cut words or claim a complete story',()=>{
 const body=sourceText('A source sentence. '.repeat(2000));assert.equal(body.mode,'excerpt');assert(body.text.length<=MAX_SOURCE_TEXT);assert(body.text.endsWith('…'));
 assert.equal(textExcerpt('A complete sentence. Another unfinished phrase follows.',27),'A complete sentence.…');
 assert.equal(textExcerpt('x'.repeat(100),30),'…');
 assert.equal(sourceText('',{}).text,'');
});
test('long bodies cannot displace any selected current records under either byte cap',()=>{
 const records=Array.from({length:800},(_,i)=>({id:String(i),source:{id:'nws'},status:'current',summary:'Notice '.repeat(190),instructions:'Instructions '.repeat(150)}));
 const before=boundPublicEvents(records),after=boundPublicEvents(records.map(e=>({...e,sourceText:sourceText('Actual source paragraph. '.repeat(800))})));
 assert.deepEqual(after.events.map(e=>e.id),before.events.map(e=>e.id));assert.deepEqual(after.dropped,before.dropped);
 assert(Buffer.byteLength(JSON.stringify(after.events))<=MAX_PUBLIC_EVENT_BYTES);
 const added=after.events.reduce((sum,event)=>{const {sourceText,...base}=event;return sum+Buffer.byteLength(JSON.stringify(event))-Buffer.byteLength(JSON.stringify(base));},0);
 assert(added<=MAX_PUBLIC_BODY_BYTES);assert(after.events.some(e=>!e.sourceText||e.sourceText.mode==='excerpt'));
});
test('a busy weather lane cannot consume every other source body allocation',()=>{
 const records=Array.from({length:500},(_,i)=>({id:String(i),source:{id:'nws'},summary:'Source notice.',sourceText:sourceText('Weather description. '.repeat(700))}));
 const news={id:'story',source:{id:'eff'},summary:'Short captured excerpt.',sourceText:sourceText('Original licensed reporting. '.repeat(300),{kind:'story'})};
 const result=boundPublicEvents([...records,news]);assert.equal(result.events.length,501);assert.equal(result.events.at(-1).sourceText.text,news.sourceText.text);assert.equal(result.events.at(-1).sourceText.mode,'complete');
});
