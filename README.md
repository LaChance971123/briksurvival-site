# Osprey Zero

Civilian emergency knowledge for individuals and households who may lack utilities, transport, communications or safe access to help. Production: https://ospreyzero.com. Repository `main` publishes through the existing Netlify project `ospreyzero` (`a169e7e7-8cb7-4c81-a275-fba6ed9fc890`).

## Build and verify

Python 3.12 and Node 22:

```sh
pip install -r requirements-build.txt
python scripts/build_site.py
```

Publish only `dist`, never the source checkout. The same complete build and validation pipeline runs locally, in GitHub Actions and on Netlify. `scripts/publication.py` owns public routes; `config/public-assets.json` owns the web asset allowlist. Fonts are hosted locally; DM Sans, Space Grotesk and IBM Plex Mono retain their license files.

## Free encyclopedia and paid toolkits

86 original online guides in 13 subjects remain free without signup. Edit `content/guides/*.json`, taxonomy and sources, then rebuild. Guide URLs, the quick answer, practical actions, no-help fallback, household needs, decisions and source context remain. Medical content requires current source verification and qualified independent review before claiming that status.

The toolkit catalogue, complete-collection detail page, homepage feature and guide CTAs are generated from `content/toolkits.json`. The first collection is explicitly in development. No package, current price or checkout is claimed. Future ready products must have verified Payhip delivery, a price, edition, component list and matching checkout URL. Collections must list their included ready topic products.

Premium manuscripts and finished files belong in a separate private workspace, never this public repository or deployment. Payhip will handle purchased-file delivery. The retained document-design utility requires an explicit private output path outside the repository. See [toolkit architecture](docs/toolkit-architecture.md) for product lifecycle, delivery setup and publishing boundaries.

## Search and retired offline access

Browser-local search covers free guides, trusted published references and public toolkit descriptions. Exact topics outrank typo corrections; phrase and symptom regressions run in CI. Typed queries are not added to history URLs. Incoming shared query links may still be logged by hosting.

Free Osprey Zero PDF downloads, the portable library and browser offline saving have retired. Old document URLs return an explanatory 404; `/offline/` is a retirement notice. Its remaining worker only clears former offline access. Returning visitors' `oz-offline-` caches and `/offline/` registration are cleaned up where the browser permits. Root `sw.js` remains the provider's advertising worker. Previously downloaded copies cannot be recalled.

## Signups and account-side setup

The existing Netlify forms collect optional toolkit-update and Field Notes requests, with honeypots, native validation and visible submission feedback. They do not unlock guidance. Automatic newsletter delivery remains awaiting MailerLite setup and verification; do not invent a subscribe endpoint or promise an immediate email.

Payhip checkout and paid-file delivery are not enabled in this migration. Merchant identity and payout setup, actual product upload and an end-to-end payment/delivery test precede a ready product. Affiliate accounts and equipment research are later work.

## Advertising

Homepage, search, urgent response, toolkit, privacy, signup confirmation and retired-access pages initialise no advertising providers. Existing eligible browsing/preparedness/field pages plus disaster-scams and verify-information retain vignette 11941449. Five existing browsing hubs also retain push-subscription 11941494. No MultiTag stacking, opt-in gate, ad-off control or site cooldown is added. Provider script loading is not evidence of paid fill or revenue. Exact rules live in AGENTS.md and the ad-policy checks.
