# Briefing source policy and adapter contract

Reviewed against the publishers' official documentation and live responses on **10 October 2026**. This is a preparedness snapshot collected twice daily, not a live emergency-warning service. Feeds can be delayed, incomplete, revised, unavailable or limited to an editorial window. A successful fetch establishes access to that response, not complete coverage or safety at any location.

## Boundaries

- Only sources registered in `server/briefing/sources.mjs` are fetched. Source input is untrusted data, never instructions to the application or a language model.
- There are no API keys, paid subscriptions, article-page scraping, image downloads or browser-side calls to these feeds. Fetches belong to the server collector. No personalized location is sent to providers.
- Attribution, original source links, publication/update dates, collection time and source availability must accompany results. CC-licensed news also needs its author byline, license link and shortening notice, shown with the excerpt. The byline must precede a Global Voices excerpt.
- Official-source observations and notices must be distinguished from reporting/analysis. A news article is not an official warning. Automated selection is limited editorial filtering, not independent verification.
- No third-party full articles or media are stored or republished. RSS responses can contain full article bodies; the adapters retain only permitted fields and short excerpts. Global Voices `content:encoded` is inspected for rights exceptions but is never excerpted or retained. EFF's RSS description contains its article body, so only a short plain-text excerpt is retained.
- No publisher logo, endorsement claim, map, photograph, audio, video, tracking pixel or arbitrary embedded markup is used. Ads elsewhere on the site do not turn an alert into official advice or a publisher endorsement.
- **GDELT is not a license to republish its underlying publishers. Guardian content is excluded.** Do not add an RSS feed merely because it is publicly readable. A new publisher requires documented rights compatible with commercial use, attribution requirements and explicit coverage limits.

## Registered sources and rights provenance

### National Weather Service active alerts (`nws`)

- Feed: <https://api.weather.gov/alerts/active>
- Documentation and reuse permission: <https://www.weather.gov/documentation/services-web-api>
- Schema: <https://api.weather.gov/openapi.json>
- NWS describes API information as open data for any purpose, free of charge, subject to rate limits. Send an identifying User-Agent. The API documentation currently does not require a key.
- Retained fields: official identity, headline, brief description, instructions, source area/UGC codes, publication time, expiry/end time, urgency, explicit cancellation references and the source URL. Only public, actual messages are eligible; test/exercise/private messages are skipped.
- Scope: the United States, territories and NWS-covered marine zones. Marine zone prefixes do not become state codes. A missing polygon or area is not a nationwide warning. The product never promises every warning will be captured between twice-daily collections.

### National Weather Service cancellation messages (`nws-cancellations`)

- Fixed feed: <https://api.weather.gov/alerts?message_type=cancel&limit=100>
- Same documentation, rights and fields as the active-alert source. NWS's current schema explicitly documents the lowercase `message_type=cancel` query. Its general alerts endpoint holds recent messages, described by NWS as the past seven days.
- The adapter preserves `messageType=Cancel` (and CAP-style `msgType`) as an explicit cancellation with `cancelledAt` and exact referenced identifiers. Reference URLs and identifiers use the same normalized raw identifier form as active alerts. The core must apply references across both NWS lanes.
- This bounded request does not follow pagination. `pagination.next`, or reaching the 100-item cap, produces partial coverage. Cancellation history can therefore be incomplete even after a successful request.
- **Absence from the active feed never means cancelled, expired, resolved or safe.** An explicit source expiry/end time is different from a cancellation. Retired/superseded/omitted records must retain that distinction in storage and presentation. An expiry is the end of that message's stated validity, not proof that flooding, damage or other danger has ended.

### U.S. Geological Survey significant earthquakes (`usgs`)

- Feed: <https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson>
- Format and selection: <https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php>
- Rights: <https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits>
- Retained fields come from USGS-produced earthquake data, described by USGS as U.S. public domain. Credit USGS. This does not license unrelated imagery or third-party products appearing on USGS sites.
- Scope: significant earthquake observations from the past seven days worldwide, not every earthquake. Only `type=earthquake` is selected. A record's event time and later measurement update remain separate. Measurements may change.
- The reported place is labeled as an **epicenter**, not a shaking/impact boundary. Country/state scope is assigned only from exact, recognized terminal place names; ambiguous Georgia and unknown places stay unknown. Network IDs and coordinates alone do not establish country scope. The `tsunami` flag is never promoted into a tsunami warning. There is no invented event end time or all-clear.

### Consumer Product Safety Commission recalls (`cpsc`)

- Endpoint: <https://www.saferproducts.gov/RestWebServices/Recall?format=json>
- API documentation: <https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information>
- Programmer's guide: <https://www.cpsc.gov/s3fs-public/pdfs/blk_pdf_CPSC-Recalls-Retrieval-Web-Services-Programmers-Guide_3-25-2015.pdf>
- Explicit recall/text reuse policy: <https://www.cpsc.gov/About-CPSC/Policies-Statements-and-Directives/Privacy-Policy>
- CPSC permits reuse of its recall notices and public safety text with credit and without implying endorsement. This implementation excludes all pictures even where CPSC permits recall-image distribution.
- `sourceRequestUrl` appends only the documented `LastPublishDateStart` parameter, set to the UTC calendar date 30 days before collection. This captures recent publication updates to older recalls and avoids pulling the entire historical database. No arbitrary caller-provided URL is accepted.
- Retained: recall ID, title, hazard description, source remedy instructions, recall date, last-published date and official recall URL. Timezone-free midnight values are source calendar dates represented at UTC midnight; they are not precise incident times.
- U.S. recall jurisdiction is labeled explicitly. Manufacturing country, company address and retailer prose do not establish affected-state distribution. The exact model, lot, date code and remedy remain in the original notice. Feed absence and elapsed time never prove termination or that a product is safe.

### FDA public recall announcements (`fda`)

- Official RSS: <https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml>
- Feed directory: <https://www.fda.gov/about-fda/contact-fda/subscribe-podcasts-and-news-feeds>
- Coverage limitations: <https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts>
- Reuse policy: <https://www.fda.gov/about-fda/about-website/website-policies>
- FDA's general website policy allows reuse of its material unless otherwise noted and recommends a source link and copy date. The adapter retains notice metadata and a short supplied description, skips detected rights exceptions and excludes article bodies/media. The feed can include firm-issued announcements; do not claim the site is the author of those announcements.
- This RSS listing is neither all FDA recalls nor a complete enforcement/termination database. The source page explicitly says some recalls are not posted. A company location in the description is not product distribution.
- Live RSS currently supplies some FDA article links using HTTP. Only links on known FDA hosts are upgraded to HTTPS. The public source remains FDA. No arbitrary URL is repaired or followed.
- A headline or absent record is not parsed as an official recall termination. There are no automatic product expiry/clearance dates.

### CISA Known Exploited Vulnerabilities (`cisa-kev`)

- Chosen feed: <https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json>
- Official mirror provenance: <https://github.com/cisagov/kev-data>
- Canonical catalog: <https://www.cisa.gov/known-exploited-vulnerabilities-catalog>
- Canonical license: <https://www.cisa.gov/sites/default/files/licenses/kev/license.txt>
- License: <https://creativecommons.org/publicdomain/zero/1.0/>
- The CISA-owned repository identifies itself as an official mirror and documents CC0 licensing equivalent to the canonical feed. The canonical JSON returned HTTP 403 in this environment on review; the official mirror returned usable data. The mirror can lag the canonical source by minutes, and the collector does not rotate through unverified mirrors.
- The parser validates catalog structure and CVE IDs, then selects additions in the past 30 days. Older additions are explicitly counted as out-of-window. The CVE's `dateAdded` is the catalog-addition date, not the vulnerability's discovery date or an incident date. A catalog-wide release time is retained as coverage metadata and never assigned to every CVE as its update time.
- **This is vulnerability information, not an incident/attack feed.** Software affected by an exploited vulnerability is not evidence of compromise in a particular household or place. CISA-required actions can contain federal directives; their legal scope must not be presented as a universal household obligation. Federal due dates do not become expiry dates, severity labels, local risk scores or consumer deadlines. The generic catalog URL is retained rather than inventing a fragment or silently using arbitrary URLs from notes.

### Electronic Frontier Foundation reporting (`eff`)

- Feed: <https://www.eff.org/rss/updates.xml>
- Source: <https://www.eff.org/deeplinks>
- Copyright policy: <https://www.eff.org/copyright>
- License: <https://creativecommons.org/licenses/by/4.0/>
- EFF's current policy licenses its original content under CC BY 4.0 unless otherwise noted; non-original material needs separate permission. Retained: article title, original URL, dates, every feed-supplied author and an excerpt of at most 360 characters. Mark it as a shortened excerpt with formatting removed, credit EFF and authors, and link the license. Do not imply endorsement.
- Selection requires explicit digital-security/privacy/digital-rights terms in the title or short description. This is advocacy reporting and analysis, not a general news service or official warning. Known rights exceptions and missing bylines cause omission. Blockquotes, figures, scripts and embedded media are excluded from excerpts.
- All affected-location scope is unknown. Article geography tags, if present, are labeled only as topics.

### Global Voices reporting (`global-voices`)

- Feed: <https://globalvoices.org/feed/>
- Attribution/republishing policy: <https://globalvoices.org/about/global-voices-attribution-policy/>
- License: <https://creativecommons.org/licenses/by/3.0/>
- The policy permits commercial adaptation of original Global Voices content under CC BY and the site's linked license is version 3.0. Display the original author and source link above the excerpt; provide the license and shortening notice. Its invitation to notify/contact the editors about republication is a request alongside that license, not an automated-contact authorization. No message has been sent to the publisher.
- Limit reuse to original text. Partner syndication is not assumed to inherit Global Voices' license. For example, a live feed item credited to CONNECTAS carried a content-partnership notice and was omitted. Recognized third-party origin, partnership, noncommercial, no-derivatives and reserved-rights notices cause omission. Media is always excluded. This conservative notice screen is not a substitute for reviewing new source licensing or new syndication formats.
- Retained: title, publication date, source URL, feed author(s) and at most 360 characters from `description`. Full `content:encoded` is not used as an excerpt fallback. Missing authors are omitted.
- The broad feed is filtered for explicit household-preparedness hazards such as floods, earthquakes, fire, outages, water shortages, displacement, civilian conflict impacts, disease outbreaks and cyber attacks. Generic politics and unrelated culture/technology coverage are excluded. The short rolling RSS feed cannot provide comprehensive international coverage.
- Even explicit country category tags do not verify an affected area. They may be shown as article topics, but `location.scope` remains `Unknown`, with no state codes.

## API contract and invariants

`SOURCES` is an immutable array of registered configuration records. `SOURCE_BY_ID` looks them up. Each record has `id`, `name`, `kind` (`official` or `news`), fixed HTTPS `url`, `format` (`json` or `xml`), `website`, `allowedHosts`, `rights` (`label`, provenance `url`, `allowedFields`, and a `licenseUrl` where applicable) and human-readable `coverage`.

`sourceRequestUrl(sourceOrId, { now })` returns a registered fetch target. CPSC's bounded date query is the only variable target. The collector owns HTTP status checks, timeout and response-size limits, fetch concurrency, retries, conditional requests if used and last-good persistence. Adapters do no network I/O.

`adaptSource(sourceId, raw, { now })` accepts a JSON string/parsed JSON or an RSS XML string and returns `{ events, coverage }`:

- Events: `id`, `sourceId`, `title`, `summary`, `instructions`, `category`, `location: { label, scope, codes, precision }`, `publishedAt`, `updatedAt`, `expiresAt`, `endsAt`, `cancelledAt`, `status`, `urgency`, `url`, `relatedIds`; CC news also includes `attribution`.
- Categories: `weather`, `earthquake`, `recall`, `cyber`, `news`. Location scopes: `US`, `International`, `Unknown`. State/territory codes are included only when supported; they are not inferred from an issuer's office, company address or publisher.
- Adapter status is source-derived `current`, `expired` or `cancelled`; broader retention states belong to core. Urgency is only NWS `immediate`/`expected`, otherwise `unknown`. News never acquires emergency urgency from title keywords.
- Coverage: `sourceId`, `status` (`ok` or `partial`), `receivedCount`, `acceptedCount`, `rejectedCount`, `skippedCount`, `skippedReasons`, `duplicatesRemoved`, `sourceUpdatedAt`, `warnings`, `scope`.
- Invalid feed containers, invalid XML/JSON and nonempty feeds in which every item is malformed **throw**. The collector must retain prior successful data and label the failed refresh. A well-formed empty feed or intentional relevance/rights exclusions are different; exclusions are counted and rights/attribution exclusions produce a coverage warning.
- Malformed individual items are counted without discarding valid neighbors. Stable source IDs deduplicate records, preferring newer revisions. The core must not collapse distinct CISA CVEs merely because they share the catalog URL.
- XML DTD/entity declarations are rejected before parsing. Source URLs must match exact allowlisted publisher hosts and cannot include credentials, custom ports or executable schemes. Item URLs are links for the reader, never collector fetch targets. Adapters emit no media or arbitrary object fields. Core sanitization and text-only rendering remain mandatory even after adapter extraction.
- Feed fields that could have special safety significance are not guessed: missing dates do not become collection time; an absent end time stays absent; source snippets are not evacuation orders; topic tags are not impact polygons; finite observation windows are not hazard termination.

## Verification

`node --test server/briefing/sources.test.mjs` exercises synthetic fixtures for all sources, cancellation references, expiry precedence, empty-vs-failed feeds, source revision deduplication, incomplete/ambiguous geography, count/pagination warnings, restricted news rights, multiple authors, malicious links/text and XML entity declarations. Tests make no network calls and do not imply production endpoint availability.

All eight selected endpoints returned parseable responses during development with Python HTTP requests. One initial USGS request timed out before a successful retry; canonical CISA returned 403, motivating the documented official mirror. Actual collector timeouts and freshness must be reported from each real collection. Do not publish synthetic test events as current incidents, and do not turn a later failed refresh into an empty “nothing happening” snapshot.
