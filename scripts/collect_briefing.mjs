/** Explicit one-time initial data capture; never part of a site build. */
import { readFile, writeFile } from 'node:fs/promises';
import { collectBriefing } from '../server/briefing/collector.mjs';
const path = new URL('../server/briefing/bootstrap.json',import.meta.url);
const fresh = process.argv.includes('--fresh');
const previous = fresh ? null : JSON.parse(await readFile(path,'utf8'));
// An explicit initial capture can wait longer in this local script. The scheduled
// production collector keeps its 21-second total/6.5-second per-source bounds.
const state = await collectBriefing(previous,{timeoutMs:12000,budgetMs:40000});
await writeFile(path,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({generatedAt:state.snapshot.generatedAt,events:state.snapshot.events.length,sources:state.snapshot.sources},null,2));
