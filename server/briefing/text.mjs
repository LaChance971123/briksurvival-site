// Source input is data. Never execute markup, follow links or interpret instructions.
export const MAX_SOURCE_TEXT = 16000;
export function sourcePlainText(value) {
  if (typeof value !== 'string') return '';
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”'};
  return value.slice(0,100000)
    .replace(/<(script|style|blockquote|q|figure|figcaption|iframe|object|template|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<div\b[^>]*class=["'][^"']*(?:wp-caption|caption)[^"']*["'][^>]*>[\s\S]*?<\/div\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<\/(?:p|div|h[1-6]|li)>|<br\s*\/?\s*>/gi,'\n\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(match,code)=>{
      if(code[0]!=='#')return entities[code.toLowerCase()]??match;
      const n=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
      return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):' ';
    })
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ')
    .split(/\n\s*\n/).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n\n').trim();
}
export function textExcerpt(text,maximum=620) {
  if(text.length<=maximum)return text;
  const prefix=text.slice(0,maximum-1);
  // Prefer a complete sentence; otherwise a word boundary, never a partial word.
  const sentence=prefix.match(/^[\s\S]*[.!?](?=\s|$)/)?.[0];
  const cut=sentence&&sentence.length>maximum/2?sentence:prefix.replace(/\s+\S*$/,'');
  return (cut===prefix&&!/\s/.test(prefix)?'':cut.trim())+'…';
}
export function sourceText(value,{kind='description',mode='complete',maximum=MAX_SOURCE_TEXT,modified=false}={}) {
  const clean=sourcePlainText(value);
  let text=textExcerpt(clean,maximum);
  if(mode==='excerpt'&&text&&!/[.!?…]$/.test(text))text=(/\s/.test(text)?text.replace(/\s+\S*$/,''):'')+'…';
  return {text,kind,mode:clean.length>maximum?'excerpt':mode,modified:modified||clean!==value||clean.length>maximum};
}
