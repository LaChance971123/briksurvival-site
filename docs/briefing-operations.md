# Daily Brief · twice-daily source snapshots

This release adds `/briefing/`, `/briefing/event/?id=…`, and a compact three-card homepage block. It replaces the larger “Prepare ahead” section while retaining its three planning links. Briefing routes remain ad-free. Existing emergency guidance, search, paid-product boundaries, forms, and advertising rules remain intact.

## Data and schedule

- Eight fixed source targets are pooled into one scheduled Netlify function. See [source policies](briefing-sources.md) for the scope, reuse basis and omissions of each feed.
- Production-only cron: `0 0,12 * * *`, or **00:00 and 12:00 UTC**. This is 8 p.m./8 a.m. Eastern Daylight Time and 7 p.m./7 a.m. Eastern Standard Time. UTC cron does not adjust for daylight saving. These are planned collection times, not delivery guarantees.
- In a 30-day month: 60 scheduled jobs and at most 480 source requests, before explicit manual tests/captures. Conditional requests still count. There is no per-visitor source request, hidden client polling, AI call, site rebuild or deployment per refresh.
- Collection uses maximum concurrency 3, a 6.5-second per-source timeout and a 21-second overall fetch budget. Storage requests (including response bodies) are bounded to two seconds each with default SDK retry loops disabled; the scheduled storage client has a 28-second wall-clock deadline, leaving headroom inside Netlify's 30-second scheduled-function limit. Responses are capped at 4 MiB. Redirects are not followed. Each source fails independently; previous good records survive outages. ETag and Last-Modified are reused. Retry-After suppresses early requests; no immediate retries occur inside a batch.
- Netlify Blobs holds latest-state and 28 rotating half-day version slots. A complete version is written before one atomic latest-state replacement. The shared store is production-only; previews use their deploy-isolated store. No new user token, account or secret is required. Latest-state replacement is atomic: readers see a complete previous or new value, even when acknowledgement of a timed-out write is uncertain. If a reader cannot access storage, it serves the explicitly dated initial snapshot with an outage notice.
- The CDN and cross-edge durable cache share the read endpoint for five minutes plus at most one minute of stale-while-revalidate. The browser fetches once per page load, calculates expiry/overdue state with its clock, and never polls. The cache lifetime is not upstream polling.
- The active NWS lane contributes at most 800 records; other sources contribute at most 120 each. The public response is bounded to 1,000 records and 3 MiB. Omitted records mark coverage partial, with received/stored counts shown in source health. Official instructions over 12,000 sanitized characters are omitted in full, with a direction to the original source rather than a silently truncated directive. NWS cancellation queries are capped at 100; pagination is disclosed instead of fetched. CPSC covers the last 30 days of publication changes; KEV covers additions in the last 30 days; USGS covers significant earthquakes in the past seven days. RSS windows are publisher-defined.

## Editorial and safety boundaries

Source text is untrusted data: adapters validate feeds/items; the core strips markup, limits fields and validates HTTPS source hosts/dates; the browser uses text-only DOM insertion and checks URLs again. XML external entities/document types are rejected. No source instructions are executed. No feed images, full news articles, model summaries or publisher-country geolocation are used. Optional device coordinates are handled only by the browser-local area matcher; they never enter source collection.

Official instructions are separate from fixed editorial planning. Existing guides are selected deterministically in server/briefing/editorial.mjs, with exact routes checked during builds. Recall records require exact product/model/lot matching, use inventory/information-verification guides, and defer to the original remedy. KEV describes vulnerabilities, never infers household compromise, and never turns federal deadlines into consumer expiry. News cannot carry official urgency/instructions. Byline, original source, policy, license and shortened-excerpt attribution accompany news text.

A successful check is not a complete hazard inventory. Missing is not cancelled. Explicit CAP cancellations link to referenced notices; expired notices say only that a source validity/end time passed. Neither establishes that hazards ended. Retained official notices absent from a successful refresh are labeled no-longer-listed and age out after the bounded retention window. News omitted in a successful refresh is removed, including rights exclusions. An outage retains last-permitted data with its original check time.

The UI flags source checks older than 14 hours, partial coverage, source/storage failure and missing detail records. It never offers an all-clear. Publication, update, snapshot and last-check times are distinct, in UTC. Device clocks can be wrong; source links remain authoritative. Broad location filters stay in browser-local storage, without transmission to source services. US recall jurisdiction is not state-level distribution; earthquake epicenters are not affected-area boundaries; news topic tags do not establish affected geography.

## ZIP-area relevance and compact cards

The optional ZIP field uses a bundled Census 2020 ZCTA–county multimap in the browser. It is an approximate ZIP-area lookup, not a current postal directory or geocoder. All intersecting counties are retained; leading zeroes are significant. Connecticut is excluded from county matching because its county-equivalent vintage changed after the source dataset; unavailable, unsupported and malformed codes give a broad-location fallback. See [dataset provenance, regeneration and limitations](briefing-zip-areas.md).

NWS county overlaps use source SAME identifiers and county UGC codes. Forecast-zone and marine identifiers are preserved but never reinterpreted as counties. A partial-county SAME match is still only a broad county overlap, not evidence that a whole county, ZIP or address is affected. Source scope and missing/capped coverage remain visible. Product and software notices stay separate because applicability depends on exact product identifiers, not residence; other areas and unverified locations remain accessible.

ZIP, city, state and device-area matching use fixed same-origin geographic assets. Search text and coordinates never enter a request URL, body, analytics event or source lookup. The first Daily Brief index visit without a saved manual area may request browser geolocation once; an explicit button remains available when a browser requires a gesture. Attempts are remembered when browser storage works. A prior unsuccessful request may recover once on a later visit only when the Permissions API confirms access is already granted; prompt, denied or unreadable permission states never trigger another automatic attempt. Explicit manual choices and clear/reset suppress this recovery. Manual choices win over pending callbacks. Only a validated derived area is saved locally, never coordinates. Clearing an area does not reset the automatic-prompt attempt. Homepage and detail views never request location. The browser and operating system control their own permission and location services. See the [local area data documentation](local-area-data.md) and privacy page for data vintages, limitations and ordinary hosting requests.

Cards emphasize a readable headline, one or two complete source-supported sentences, a short visible source/check-time line, reviewed event-type meaning and exact guide links. Original source text and identifiers remain separate from display fields. Technical boilerplate and incomplete trailing fragments are not promoted into complete assertions. If a safe complete excerpt is unavailable, the display uses an explicit neutral fallback rather than inventing a missing clause. News keeps its required byline and license before the excerpt.

The compact index places location and result controls first, with detailed methodology under About these reports. It starts with six current source records and category diversity; current here describes source-record status, not proof of an ongoing local hazard. Expired, cancelled and no-longer-listed records remain available through a counted history control. Local clock/visibility updates maintain these distinctions without network polling. Related notices are not merged merely because titles or counties match. The retained capture contains no present predecessor pairs among its explicit source references, so records stay separate; no relationship or shared instruction is inferred. Product/software and other-location counts are available beside the local group, rather than buried below a long list.

Detail guides follow the short opening report. Product-specific recall instructions remain a primary original-source action; general guides cannot replace the remedy. NWS exact record links remain API data provenance, while clearly labelled current alerts/forecast pages offer a human-readable route. A current area page is not represented as the exact historical notice.

Back to your results restores only browser-local UI state such as category, group, pagination and scroll, with a safe direct-visit fallback. It does not cache a source snapshot or put ZIP data in URLs. The mobile menu includes a briefing entry. Fixed editorial meaning is reviewed and deterministic, never generated by a model at runtime.

## Development and preview

```sh
npm ci
pip install -r requirements-build.txt
python scripts/build_site.py
```

The complete build includes backend/adapters, frontend DOM tests, original search/navigation/privacy/ad-policy checks, exact guide links and public-file boundary checks. Inert fixtures remain outside public output; no fake emergencies are shipped.

An explicit live initial capture is available with `npm run briefing:seed -- --fresh`. It is **not** part of builds. This local script permits 12 seconds per source and 40 seconds total for initialization; it does not change scheduled limits. Inspect statuses, rights exclusions, timestamp and counts before committing the capture. Omitting --fresh preserves prior good source data through outages. Do not use fake records to make a preview look populated.

Deploy previews read the bundled genuine dated snapshot. Netlify does not fire schedules on previews, and the refresh function rejects non-production contexts. The public read endpoint cannot trigger ingestion. A preview/unit test does not prove production cadence, Blobs writes or quota sufficiency.

## Launch gates and operation

1. Review the draft PR, genuine snapshot, desktop/mobile UI and source policies. Production release requires owner approval.
2. Check the existing Netlify plan's remaining allowance and storage/function availability. The observed Personal account does not establish remaining credits. No paid service is added, but compute, CDN requests, bandwidth, builds and storage use the shared allowance.
3. After approved production release, verify both functions are deployed, optionally invoke the schedule through Netlify's authorized dashboard, and confirm /api/briefing changes from initial-snapshot to ok with persisted source statuses. Inspect logs; observe the next scheduled UTC run before claiming cadence is proven.
4. Source failure keeps last-good data and an honest warning. For scheduler/store failure, inspect Netlify logs/usage. Never mask an outage by refreshing timestamps or adding per-visitor upstream calls.
5. Roll back the code deploy if needed. Production storage is schema-versioned (osprey-briefing-v1); previews cannot mutate it. Never insert incidents or delete history to conceal problems.

Deferred: comprehensive international hazards, additional publishers, editorial review tooling, personalized alerts, maps, accounts, push notifications, paid news APIs and AI.

## Daily Brief location release check

Only the static Daily Brief index aliases (`/briefing`, `/briefing/`, `/briefing/index.html`) allow same-origin geolocation. Other pages retain the global geolocation deny; camera and microphone remain blocked. This explicitly approved exception does not change visitor permission, which the browser controls. Verify actual preview CDN headers with `python scripts/verify_daily_brief_headers.py https://<preview-host>` before publication; do not infer overlapping-header behavior from TOML order alone. No location permission is requested by the shared snapshot API.

The first attempt requests a fresh one-shot position (`maximumAge: 0`, no continuous watcher). An independent UI deadline releases the busy controls while a permission prompt is unanswered. It does not discard a later permission grant; only a newer manual action, retry or navigation invalidates that callback. A generic saved empty view is not treated as a completed manual location choice. Browser/OS refusal, timeout, inaccurate/out-of-coverage positions and geographic-file failures all retain a manual state fallback. Exact coordinates and browser accuracy are never saved in preference or return-navigation state.
