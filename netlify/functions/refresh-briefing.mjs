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
  // Log only the normalized public source assessment, never raw feeds, credentials or SDK errors.
  console.log(JSON.stringify({snapshot:state.snapshot.id,generatedAt:state.snapshot.generatedAt,
    sources:state.snapshot.sources.map(({id,status,lastAttemptAt,lastSuccessAt,error}) =>
      ({id,status,lastAttemptAt,lastSuccessAt,error,nextEligibleAt:state.sources[id]?.nextEligibleAt||null})),events:state.snapshot.events.length}));
  return new Response(null,{status:204});
};
// UTC: 08:00/20:00 EDT; 07:00/19:00 EST. No DST-adjusting cron service.
export const config = {schedule:'0 0,12 * * *'};
