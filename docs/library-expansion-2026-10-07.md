# Library expansion review — 7 October 2026

This batch adds six complete guides and replaces the hurricane and flooding briefs with full guides, using the existing guide template, typography, responsive styles and navigation. The library now contains 136 structured guides and 42 rich guides.

| Guide | Route | Rich sections | Extended-section words |
| --- | --- | ---: | ---: |
| Frozen and burst pipes | `/emergencies/frozen-burst-pipes/` | 7 | 1,245 |
| Private wells after flooding | `/emergencies/flooded-private-well/` | 7 | 1,184 |
| Septic systems after flooding | `/emergencies/flooded-septic-system/` | 7 | 1,150 |
| Driving near a dust storm | `/emergencies/dust-storm-driving/` | 7 | 1,145 |
| Stranded in a vehicle during winter weather | `/emergencies/winter-vehicle-stranding/` | 7 | 1,201 |
| Household drought and water-saving plan | `/preparedness/drought-water-plan/` | 7 | 1,146 |
| Hurricane | `/emergencies/hurricane/` | 8 | 1,559 |
| Flooding | `/emergencies/flooding/` | 8 | 1,685 |

Word counts use the existing `guide_content.text(sections)` method and exclude the quick answer, header/sidebar navigation, bibliography and toolkit CTA. Each guide retains immediate actions, a topic-specific no-help fallback, household/access needs, decisions, FAQs, linked sources and review dates. The two replacements retain their original 2 October publication dates and existing category/subcategory/routes.

## Editorial verification and discovery

The coordinated research pass supplied all eight complete drafts and source groups after independent editorial/source review. All eight objects matched its canonical SHA-256 checks before integration, using sorted compact ASCII JSON. Presentation escaping in the drought subcategory was decoded to the exact existing taxonomy string `Heat & dry conditions` before comparison. Source-linked editorial review is not professional or clinical certification.

One intentional discovery-only change adds `septic flood` to the septic guide's aliases. The exact requested search query otherwise returned the broader flooding guide first. Its focused regression now requires the septic guide to rank first. No reviewed safety prose was changed. Removing that added alias reproduces the supplied canonical hash.

Eight new ordered source groups were appended without changing any original group. Six existing companions received ten contextual links: water-outage, sewer-failure, winter-storm, vehicle-breakdown, water-storage and flood-cleanup. Their original prose and other data remain intact. All other existing guide JSON is unchanged. Generated hubs, A–Z, related guidance, search and sitemap include the additions automatically. Baseline-only generated churn was excluded from the review diff.

The hurricane and flooding resources distinguish FEMA flood-risk planning maps from local evacuation zones/orders and live NOAA/NWS information. FEMA's state directory is a starting point; local authorities publish their own orders. Dust-storm lights-off advice remains conditional on a complete safe stop clear of traffic. Winter guidance separately covers visibility, cold, and combustion/hybrid exhaust risks. Those lighting instructions were not transplanted between guides.

Core primary guidance and practical resource destinations were checked by the supplied research/review pass. A few municipal/state sources required indexed text after direct-fetch 403 responses. No real household addresses were submitted to interactive maps, and not every downstream state-directory link was checked. This review does not claim those actions.

## Renderer support

The new `resources` block accepts `{label, url, description}` items and renders described external links with the existing `resource-grid` and `resource-button` styles. URLs require HTTPS and a host and reject embedded credentials, whitespace/control characters and malformed ports/IPv6. Body strings are escaped; links disclose their new-tab behavior and use `noopener noreferrer`. Chapter references remain separate.

Existing `flow` blocks provide the process/decision figures; existing table markup supplies captions, row/column headers and labelled keyboard-scrollable regions. Resource labels/descriptions and chapter/table text are included in browser-local search and verified in generated output. No embeds, provider accounts or new map-service configuration were added.

A one-line staging fix uses `Path.as_posix()` for URL paths. The original Windows build emitted `/planner\app`, missed the already-defined planner policy and failed its final assertion. Normalizing the path preserves the existing policy and Linux behavior; no security-policy configuration or service settings changed.

## Validation and review boundary

`python scripts/build_site.py` passes completely with the integrated batch:

- 136 free guides, 42 substantial rich guides, 176 public pages, 224 allowlisted public files and 147 search entries.
- Eight focused queries: frozen pipes, flooded well, septic flood, dust storm, stranded in snow, drought, hurricane flood map and flood zone map; 164 audit regressions and canonical-title searches pass.
- Internal links/navigation, guide controls, accessible table/figure markup, resource-card output/search coverage, homepage/search privacy/interactions/return behavior, ad policy, worker boundaries, JavaScript syntax, publication allowlist, toolkit gating and planner checks pass.
- Focused resource-renderer checks pass escaped labels/descriptions, separate references, search extraction and ten unsafe/malformed URL rejections.
- Original route files are present in staged output; original source groups and existing guide prose are verified against the starting Git commit. `git diff --check` passes.

Local validation used Python 3.12.14 and Node 24.19.0. Installed pypdf is 6.10.0 rather than the requirements-pinned 6.1.1; other build packages match their pins. GitHub Actions supplies the repository's Python 3.12, Node 22 and pinned-dependency validation. Exact CI parity is not inferred from the local run.

Interactive desktop/mobile screenshots, resource-card keyboard behavior, narrow-phone overflow and diagram readability are explicitly **unrun**: local browser controls returned `Browser is not available: chrome` and an empty browser inventory. Review can continue against a verified hosted preview from an available browser. No physical-device testing is claimed.

The expansion is a stacked draft based on `polish/editorial-search-hero` at `aa86c1b79f7aaa9e73818c20a609ecdff4e1a146` and depends on PR #17. PR #17 and main remain unchanged. No merge or production publication is authorized. Preserve the ad zones, root worker, planner scope, paused catalogue and retired-download boundaries.
