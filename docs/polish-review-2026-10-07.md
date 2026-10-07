# Emergency-first polish review

## Scope
- Put the existing urgent-situation links before the marketing hero.
- Keep one search field beside the main message on desktop, with a compact single-column phone layout.
- Refine solid charcoal/ash/orange surfaces, navigation, cards, typography, focus and reduced-motion states.
- Load the full homepage search index only on search intent, with deduplicated requests, immediate clear/Escape handling and recoverable errors.
- Make alias ordering deterministic across builds.

Guide content, advertising configuration, sales availability, signup behavior and paid-file boundaries are unchanged.

## Verified locally
- Complete `python scripts/build_site.py` pipeline passes.
- 170 public pages, library/navigation links, editorial boundaries, search ranking/privacy, ads, offline retirement, toolkit and planner gates pass.
- New interaction tests cover deferred loading, races, keyboard focus and recovery.
- Repeated builds produce identical changed files.
- Independent source review completed; search focus specificity corrected.
- `git diff --check` passes.

## Pending
- Desktop and phone rendered review, overflow, contrast and interaction checks.
- CI/Netlify preview verification after review-branch publication is authorized.
- User approval before production publication.

The cloud browser cannot open localhost, and the local browser test process is blocked by the environment socket policy. No screenshots or browser-based accessibility result are claimed yet.
