# Osprey Zero advertising delivery audit — 2 October 2026

## Findings

- Zone 11941494 is the owner's push-notification subscription zone. Earlier documentation incorrectly called it MultiTag; the generic /act/files/tag.min.js URL does not identify the account's format.
- Push subscriptions require browser permission and monetize notifications. They are not a dependable visible advertisement during a reading session.
- Vignette 11941449 produced an actual dismissible overlay in the live Chrome session, on the water-purification guide and, after this update, the subject directory. Its creative said “Download is ready” and had an Ad label, Close and Continue. No advertiser links were clicked. The language can be confused with site downloads; provider-side creative review is needed.
- Earlier coverage placed vignette only on three field articles plus their index. Most articles were excluded by the emergency-directory rule, so homepage → search → urgent article intentionally generated no ad opportunity.
- The push loader loaded successfully but injected an inline script that CSP blocked. New diagnostics confirmed script-src-elem:inline. A script load event is not evidence that all downstream code executed or a paid impression occurred.
- No Monetag account statistics or zone settings are accessible through the installed connectors. Fill, frequency caps, account approval, CPM, paid impressions and revenue cannot be verified from the site's DOM.

## Implemented changes

- ads.js is an asynchronous head script; ad initialization no longer waits for app.js to finish parsing the document.
- Vignette is primary across subject browsing, preparedness, field guides, A–Z, resources and about. Disaster-scams and verify-information are explicit non-urgent reading exceptions within the emergency directory.
- Push loads only on the five hubs: /library/, /preparedness/, /topics/, /resources/ and /about/. It is secondary and does not repeat on every article.
- Homepage, search, other emergency articles/index, privacy, confirmation and downloads remain free of third-party zone initialization.
- Each format initializes once per document. There is no site cooldown, opt-in panel, ad-off control, fabricated ad click, automatic refresh or manual creative retrigger.
- Provider load/error state is available on each script's data-oz-state attribute. CSP violations are recorded locally in data-oz-ad-csp. These diagnostics are not analytics or billing events.
- Per-route CSP in dist/_headers permits provider-injected inline script elements only on the five push hubs. Inline event handlers and eval stay blocked. All other HTML routes retain the strict default policy. Security headers for framing, MIME types, transport and browser capabilities remain in netlify.toml.

## Monetization assessment

Vignette is the existing format that demonstrably shows an on-site creative. Keep push as secondary pending acceptance and revenue evidence. MultiTag can be a later experiment if its extra formats justify popunders and notification offers; it needs its own newly created zone and must replace the standalone vignette on experiment pages, rather than stacking two vignette sources. No current push zone can be converted into MultiTag by changing the site label.

Do not infer a profit increase from wider initialization alone. Compare provider-paid impressions, revenue per thousand eligible page views, returning readers and engagement over a representative period. Repeat testing on the same browser is affected by provider frequency limits and visitor eligibility. A visible vignette is not proof of a credited impression.

There is no fixed inline display-banner inventory in these supplied tags. If the business needs ads that are consistently visible while scrolling and precise placement below article sections, obtain a real display/native placement from a compatible provider or a direct sponsor. Do not place fake ad placeholders and present them as paid inventory.

## Validation

Automated checks cover important-page exclusions, index.html aliases, primary vignette coverage, secondary push scope, duplicate prevention, load/error/CSP diagnostics, policy limits, search relevance and library links/PDFs. Netlify builds run the existing verification sequence before staging. Live browser testing confirms zone delivery and protected-route behavior. No push permission was granted and no paid advertiser action was performed. Actual mobile delivery and provider-account reporting remain unverified.

## Primary references

- https://help.monetag.com/en/articles/6726670-multitag-all-in-one
- https://help.monetag.com/en/articles/6726333-push-notifications
- https://help.monetag.com/en/articles/6725606-vignette-banners
- https://help.monetag.com/en/articles/6726321-onclick-popunder-ads
- https://help.monetag.com/en/articles/6738513-why-are-my-impressions-so-low-compared-to-the-number-of-visitors-on-my-site
