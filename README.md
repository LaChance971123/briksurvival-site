# Osprey Zero website design draft

A static, multi-page design prototype for the Osprey Zero emergency-first knowledge platform. The visual system now follows the approved OZ logo, Obsidian Black, Field Bone, and Signal Orange identity with clean, solid backgrounds.

Read `SITE_DESIGN_PLAN.md` for the site hierarchy, guide model, signup integration status, ClipJar placement, and release sequence. The files can be served with a basic HTTP server; there is no build step. `app.js` handles only mobile navigation and emergency topic filtering.

This is a reviewable design draft. The guide and newsletter forms are written as Netlify Forms but the current project has Forms disabled; real submissions, MailerLite handoff, the first reviewed original guide, and final privacy wording are launch tasks. The existing BRIK checklist PDF is not presented as a finished Osprey Zero guide.

## Knowledge library v2

53 original guides in 13 subject categories. Each guide starts with a quick answer,
then direct PDF downloads and official guidance. Search indexes article bodies,
aliases, metadata, checklists, shopping lists and published references locally.

Edit one JSON file per article in `content/guides/`; category/subcategory membership
is defined in `content/taxonomy.json`, sources in `content/sources.json`.
Do not claim a clinical review without an actual qualified reviewer.

Build: `pip install -r requirements-build.txt && python scripts/build_library.py`.
Validate: `python scripts/verify_library.py && node scripts/verify_search.cjs`.
Generated static pages and PDFs are committed for Netlify's existing static publish.
The shared page shell lives in `templates/shell.html`. Update sources and the
article date together; never publish placeholder guides or download buttons.
# Civilian resilience release — October 2026

The knowledge library contains 74 original guides across 13 subjects, 74 generated action checklists, seven shopping lists and a complete A–Z index. Every guide has a quick answer, immediate actions, a situation-specific no-assistance plan, household considerations and linked references. See AGENTS.md for the enduring mission.

Build and verify:

```sh
pip install -r requirements-build.txt
python scripts/build_library.py
python scripts/refine_site.py
python scripts/verify_library.py
node --check app.js
node --check search.js
node scripts/verify_search.cjs
node scripts/verify_ads.cjs
python scripts/stage_site.py
```

Netlify runs the build and publishes `dist`. PDFs are regenerated from source during deployment. Source JSON, templates and scripts are excluded from public output. Existing public URLs are preserved.

Advertising zones: 11941494 (MultiTag) on eligible browsing/preparedness pages and 11941449 (vignette) on field-guide pages, only after a deliberate choice. Homepage, search, urgent response, privacy and signup confirmation pages do not initialize either zone. Focus mode reloads without initialization; browser notification permission must be revoked separately. The site limits new zone starts to once per ten minutes per tab session; third-party creative frequency and revenue remain provider-controlled.

Netlify Forms collects optional email signup requests. Automated newsletter delivery is not configured by this release. Search ranking runs locally; query URLs can persist in history and hosting logs. First-aid and conflict material is source-linked editorial guidance, not independently certified clinical or protection advice.
