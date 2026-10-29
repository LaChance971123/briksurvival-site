# October 29 production health investigation

## Conclusion and confidence

The strongest supported explanation is a failed CPSC collection in the midnight batch, retained as `status: stale` until the next successful batch. This status alone fails the existing health predicate, even while the snapshot itself is less than 14 hours old. The noon batch restored CPSC to `ok`, explaining the later green check without a code deployment.

Confirmed: the midnight job completed both storage writes and logged CPSC stale; the noon job completed both writes and logged all eight sources ok. Unconfirmed: CPSC's underlying error (timeout, HTTP failure, response-size rejection, parse/validation failure, or Retry-After deferral). The old refresh log omitted that field. The failed health response bodies were also discarded by the synthetic checker, so a concurrent storage-read failure at either check cannot be excluded. Do not claim the exact response reason or a permanent repair from these observations.

## Evidence

All times below are UTC on October 29, 2026. Netlify edge/function logs were inspected using the connected observability tools for site `a169e7e7-8cb7-4c81-a275-fba6ed9fc890`.

| Time | Evidence | Result |
| --- | --- | --- |
| 00:00:55–00:01:06 | Scheduler request `01M62FBBCDZM426GBA3S4DW6XE`; snapshot `briefing-20261029000058387` | HTTP 204; CPSC stale; other seven sources ok; 1,000 records. The log executes after both `saveState` writes. |
| 01:48:42 | Health request `01M62NGPN8XD4DV9JQYSN0EJ8P`; [workflow 40802632923](https://github.com/LaChance971123/briksurvival-site/actions/runs/40802632923), job 123214066234 | HTTP 503, JSON content type, cache miss; function duration approximately 2.27 seconds. No body or failure reason retained. |
| 08:29:52 | Health request `01M63CF8BQQKTP8AT7713SR4JB`; [workflow 40842530209](https://github.com/LaChance971123/briksurvival-site/actions/runs/40842530209), job 123342119916 | HTTP 503, cache miss. The compact feed returned 200; its durable cache was stale. |
| 12:00:54–12:01:01 | Scheduler request `01M63RHNR9JBE8KGMYHFC8TJBR`; snapshot `briefing-20261029120057041` | HTTP 204; all eight sources ok; 1,000 records. |
| 15:34:30 | [Workflow 40902919015](https://github.com/LaChance971123/briksurvival-site/actions/runs/40902919015), job 123549796877 | All four synthetic checks passed. |

The three workflow checkouts and the currently published Netlify deploy `6ada2db7df0eb3a1d98656a2` identify commit `00a5ad8c56a795c692e2e62530f88d15e06923f1`. That deploy was published October 22. Both functions and the `0 0,12 * * *` schedule are registered. A read-only live health probe during this investigation returned 200 with storage ok, the noon snapshot timestamp, and all eight sources healthy; this is only a point-in-time observation.

## Why other checks passed

- `healthView` requires readable persisted storage, a valid snapshot timestamp no more than 14 hours old or five minutes in the future, at least one source, and every source `ok` with a similarly valid last-success timestamp.
- `assembleSnapshot` marks an unsuccessful source `stale` when prior good data exists, retaining that data and its original last-success time. `stale` means the latest collection failed; it need not mean 14 hours have elapsed yet.
- One failed source therefore keeps health red between scheduled batches. There is no per-visitor recollection or immediate retry.
- Homepage and search are separate static checks. The compact-feed check asserts HTTP success and a 128 KiB size cap, not freshness or completeness. The feed can intentionally return 200 with warnings and dated fallback data; it also has a five-minute durable CDN cache plus up to one minute stale-while-revalidate. Health is explicitly no-store and does not use the feed's ETag/304 path.

## Storage and freshness assessment

Production reads and writes use the same site-wide `osprey-briefing-v1` store with strong consistency. Previews use a deploy-isolated store and cannot run production collection. Each refresh writes a complete version slot before replacing `latest-state`; storage failure prevents the success log. Midnight and noon success logs argue against a missing scheduled run or failed publication as the primary explanation here.

Storage headers and body are bounded to two seconds per SDK request; the scheduled client additionally has a 28-second deadline. Retryable HTTP statuses are converted to a local terminal SDK error, avoiding a retry storm. A slow/read-error response can independently cause `storageStatus: unavailable`, dated bootstrap fallback, and a health 503. The observed request durations alone do not distinguish cold start, transfer latency and timeout. No evidence justifies increasing the timeout, changing regions, weakening consistency, or relaxing the health gate.

The schedule is every 12 hours with a 14-hour freshness allowance. The midnight snapshot would have been approximately 1h48m and 8h29m old at the failed checks, so its generation age alone would not fail health if read successfully. The historical CPSC last-success timestamp was not retained in the old log; its age cannot be established from that log.

## Targeted correction

This patch repairs the confirmed observability gap; it does not purport to eliminate upstream failures.

1. `server/briefing/public-view.mjs`: add stable reason codes, evaluation time, snapshot ID, ages, and source attempt times while preserving the existing health predicate and thresholds.
2. `scripts/production-health.mjs` and `scripts/check_production.mjs`: read the health response even on 503, retain only bounded allowlisted health fields plus the Netlify request ID, and fail on bad status, unhealthy JSON, malformed/oversized bodies, or interrupted reads. No retries hide the first failure. Body reading remains within the request's 20-second abort signal and is capped at 64 KiB. Raw error pages, raw feeds, SDK errors and unknown fields are not logged.
3. `netlify/functions/refresh-briefing.mjs`: log the already normalized source error, last attempt, last success and retry eligibility after persistence, alongside the existing source statuses.
4. Regression tests cover fresh snapshots with failed sources, exact age/skew boundaries, storage fallback, missing state, 503 diagnostics, healthy recovery, malformed/oversized bodies, and exclusion of private data.

No routes, markup, styles, source requests, collection limits, storage writes, cache policy, public fallback behavior, ad configuration or permissions change.

## Verification and next evidence

Before merge:

```sh
npm ci
node --test server/briefing/health-diagnostics.test.mjs server/briefing/hardening.test.mjs server/briefing/serving.test.mjs
python scripts/build_site.py
git diff --check
```

The targeted tests and full build passed during this investigation. The full build includes backend, UI, search, navigation, privacy, advertising and publishing-boundary checks. Generated page churn from the build is excluded from this patch.

After the normal owner-approved production release:

1. Confirm Netlify published the intended commit, then run `node scripts/check_production.mjs`. Confirm successful output contains snapshot/source evidence and `x-nf-request-id`. Verify `/api/health` still sends both browser and Netlify CDN `no-store` headers.
2. At the next 00:00 and 12:00 UTC collections, inspect the refresh logs and check that snapshot IDs advance only after persistence. Confirm new source errors/timestamps are present when a source fails. A preview cannot establish production cadence.
3. On the next failure, retain the first workflow diagnostic. `storage_unavailable` indicates the read/fallback path; `snapshot_missing` indicates no persisted snapshot; `snapshot_overdue` indicates age; `sources_unhealthy` plus source reason codes identifies the failing lane. Correlate the snapshot ID and Netlify request ID with function logs. Do not overwrite the failure with a rerun or re-date retained data.
4. To establish the historical CPSC error, use authenticated Netlify **Data & Storage → Blobs** to read `osprey-briefing-v1`, key `versions/slot-14`. Verify its ID is `briefing-20261029000058387` before using its `sources` entry for CPSC (`error`, `lastAttemptAt`, `lastSuccessAt`). This snapshot slot is expected to rotate at November 12 00:00 UTC; do not modify it. The connected tools used here expose observability but no Blob-content read operation, so this historical value was not retrieved.
5. Only then consider a collection change tied to the actual failure: a timeout requires latency evidence and the unchanged 30-second execution budget; 429 requires respecting Retry-After; size/validation failures require a representative retained response or inert fixture. Keep official-source failure visible.

Observe multiple subsequent scheduled batches, including the previously affected midnight window. A successful noon refresh or a single green workflow demonstrates recovery at that time, not permanent resolution.
