// Read-only synthetic checks; never submits forms or invokes collection.
const origin=process.argv[2]||'https://ospreyzero.com';
if(!/^https:\/\/[a-zA-Z0-9.-]+$/.test(origin))throw Error('Use an HTTPS origin without a path');
async function read(path){const response=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);return response;}
const outcomes=await Promise.allSettled([
 (async()=>{const html=await(await read('/')).text();if(!html.includes('OSPREY')||!html.includes('emergency-search'))throw Error('Homepage content missing');return 'Homepage';})(),
 (async()=>{const index=await(await read('/search-index.json')).json();if(!Array.isArray(index)||index.length<138||!index.some(x=>x.url==='/emergencies/gas-leak/'))throw Error('Search index incomplete');return 'Search';})(),
 (async()=>{const health=await(await read('/api/health')).json();if(!health.healthy)throw Error('Briefing unhealthy');return 'Briefing storage and source freshness';})(),
 (async()=>{const response=await read('/api/briefing/home');const body=await response.text();if(Buffer.byteLength(body)>128*1024)throw Error('Homepage feed too large');return 'Compact feed';})()
]);
for(const result of outcomes)console.log(result.status==='fulfilled'?`PASS ${result.value}`:`FAIL ${result.reason.message}`);
if(outcomes.some(x=>x.status==='rejected'))process.exitCode=1;
