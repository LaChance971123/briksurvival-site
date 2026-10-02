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
