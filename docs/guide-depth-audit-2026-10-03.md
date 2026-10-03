# Free encyclopedia depth audit — 3 October 2026

## Findings before this iteration

Audited all 126 topic guides. Median editorial length was 430 words; 108 guides were below 600 words, 69 had no deep-dive sections, and only three used a diagram. These are useful response briefs, but most are not yet complete guides. Counts include headings, quick answers, action steps, household planning, questions and deeper content (excluding expandable equipment lists); they exclude navigation, references and sales copy.

## Completed first batch

Utility interruptions are a connected entry point: power, water, safe food and backup equipment affect nearly every household. Six guides received original, topic-specific chapters, practical planning exercises, six accessible process/decision diagrams, comparison tables, chapter references and more specific essentials lists. Quick answers and immediate steps remain at the top; mobile contents and the sticky desktop rail link each chapter. All new paragraph and table content enters browser-local full-text search.

| Guide | Before words | After words | Deep chapters |
|---|---:|---:|---:|
| Power outage | 547 | 1664 | 7 |
| Long-duration blackout | 466 | 1712 | 7 |
| Generator safety | 302 | 1516 | 7 |
| Emergency water storage | 596 | 1622 | 7 |
| Water outage | 258 | 1513 | 7 |
| Food safety after power loss | 402 | 1591 | 7 |

## Expansion standard

Keep immediate instructions concise and accessible. Develop the body around the actual problem: preparation, actions during disruption, recovery, decisions and exceptions. Include a usable example, at least one appropriate visual aid, sources beside specialist instructions, and household/access needs. Use plain explanations rather than padding, repeated generic checklist text, or unsupported certainty. Tables scroll within their own region on small screens; diagrams become vertical sequences with selectable, crisp HTML text. No new client libraries or image downloads are needed for these components.

## Suggested next sequence

1. Household emergency plan, 72-hour kit, go-bag, evacuation and shelter-in-place: decision trees, bag layouts, family scenarios and realistic departure planning.
2. Emergency hygiene, sewer failure, heating failure and apartment preparedness: complete household routines, equipment constraints and recovery.
3. Emergency communications, radio fundamentals and information verification: plain-language diagrams and legally scoped civilian use.
4. Hurricanes, flooding, extreme heat and extreme cold: geographic limits, before/during/after actions and accessibility.
5. Medical and conflict briefs need careful source-based expansion, with specialist review where appropriate. Keep civilian protection boundaries and avoid turning summaries into unverified clinical or tactical instruction.

## Verification

Run scripts/build_site.py. It checks routes, anchors, rich content/search coverage, accessible table structure, homepage/search regressions, ad exclusions, retired-download boundaries, toolkit checkout gating and the paid planner publishing boundary. Browser or physical-device verification must be reported separately from static/build checks.
