import bootstrap from '../../server/briefing/bootstrap.json' with {type:'json'};
import { collectBriefing } from '../../server/briefing/collector.mjs';
import { briefingStore, saveState } from '../../server/briefing/store.mjs';

export default async (_request,context) => {
  // Scheduled jobs run on the published deploy only. An explicit guard also
  // prevents manual preview invocations from mutating production data.
  if (context?.deploy?.context !== 'production') return new Response('Preview: schedule inactive',{status:200});
  const store = briefingStore(context,{deadline:Date.now()+28000});
  const previous = await store.get('latest-state',{type:'json'}) || bootstrap;
  const state = await collectBriefing(previous);
  await saveState(store,state);
  console.log(JSON.stringify({snapshot:state.snapshot.id,sources:state.snapshot.sources.map(({id,status}) => ({id,status})),events:state.snapshot.events.length}));
  return new Response(null,{status:204});
};
// UTC: 08:00/20:00 EDT; 07:00/19:00 EST. No DST-adjusting cron service.
export const config = {schedule:'0 0,12 * * *'};
