# Osprey Zero

Civilian emergency knowledge for people and households who may lack utilities, transport, communications or safe access to help. Static HTML, structured JSON, browser-local search and a Python document pipeline. Production: https://ospreyzero.com. Repository main publishes through the existing Netlify project `ospreyzero` (`a169e7e7-8cb7-4c81-a275-fba6ed9fc890`).

## Build and verify

Python 3.12 and Node 22:

```sh
pip install -r requirements-build.txt
python scripts/build_library.py
python scripts/build_offline.py
python scripts/refine_site.py
python scripts/polish_release.py
python scripts/verify_library.py
node scripts/verify_search.cjs
node scripts/verify_ads.cjs
node --check app.js
node --check search.js
node --check ads.js
node --check offline/reader.js
node --check offline/sw.js
python scripts/stage_site.py
python scripts/verify_release.py
```

Publish only `dist`. Netlify and GitHub Actions run these checks. Source JSON, build code, legacy artwork and PDF-only TTF files are excluded from the public output. Generated PDFs, pages, fonts and archives are committed for reproducibility. Assets/fonts contains licensed DM Sans, Space Grotesk and IBM Plex Mono. Web fonts use WOFF2; document fonts are embedded. No external font request is needed.

## Editorial system

86 original guides in 13 subjects. Edit `content/guides/*.json`, taxonomy and sources, then regenerate. Preserve URLs. Quick answer precedes downloads, actions, no-help fallback, household needs, next decisions, questions and source context. Dates distinguish content update, source check and planned editorial review; none means independent expert certification. Medical content requires current source verification and qualified independent review before claiming that status. `scripts/document_design.py` owns PDF styling. Checklists, shopping worksheets, full guides and three merged PDF packs share the site font families.

## Search and offline use

Search downloads an index and ranks locally. Exact terms outrank typo corrections; transpositions are supported. Typed queries are not added to history URLs. Incoming `?q=` links still load, and their initial request may be logged by hosting. Canonical titles and audit symptom/phrase regressions are checked in CI.

`/offline/` explicitly saves complete guide text, reader shell and fonts in browser cache. Its worker controls only `/offline/`; root `sw.js` remains the provider's advertising worker. Storage may be evicted. The portable ZIP includes complete standalone HTML with relative links and local fonts; extract all files and open START-HERE.html. External sources and live alerts are not available without a connection. Three PDF packs cover power/water, household readiness and first aid.

## Signups and delivery

The website's two Netlify forms collect optional requests, with honeypot, native validation, visible network errors and purpose-specific confirmation. They do not gate downloads. MailerLite account 1936886, selected form 200177377250117414 (`Osprey Zero | Early Access`), audience 171727495712736327, double opt-in true. At inspection the form has no content, no sender verification evidence and no automation. The connected API cannot design or publish its content. Do not invent a subscribe endpoint, copy an older form's code, resubscribe existing people or claim email delivery. Finish the selected form in MailerLite, verify sender/domain and confirmation, retrieve its exact HTML embed code, integrate the action and fields, then perform a consented end-to-end test. Public signup wording stays explicit about collection until this is verified.

## Advertising

Urgent response, home, search, privacy, thanks and offline pages do not initialize providers. Eligible browsing/preparedness/field pages load vignette 11941449; five hubs also load push-subscription 11941494. No MultiTag stacking, opt-in gate, ad-off switch or artificial site cooldown. Provider creative restrictions and a paid scrolling placement require Monetag account access; do not invent zones or ads.txt entries. Provider script loading is not evidence of paid fill or revenue. Exact advertising rules are in AGENTS.md and checked in scripts/verify_ads.cjs.

## Remaining account-side work

See docs/release-2026-10-02.md for concrete external dependencies and validation limits. Dedicated private contact, qualified medical review, verified email delivery, provider creative filtering and revenue reporting cannot be truthfully completed through static site changes alone.
