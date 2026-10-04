# Audit fixes and equipment education release

## Changes

- Browse searches hand off query text in session storage; the search page keeps query text in history state so refresh restores it without a query URL. Native GET remains a disclosed fallback when JavaScript or tab storage is unavailable.
- Search tokenisation and vocabulary are cached per index. Multiword search rejects weak body-only matches and trims low-scoring results when an exact topic is present. Show-more moves keyboard focus to the newly revealed results.
- About and Planner copy reflects the paused toolkit redesign. The homepage plan entry leads to the free household plan.
- Added /contact/ with labelled private Netlify form fields, a honeypot, accessible status, failure recovery and explicit manual-review expectations. Footer and privacy links expose it; no contact-page advertising.
- Removed repeated filler FAQ blocks from 57 guides; topic-specific FAQs remain. This is editorial cleanup, not a claim that those guides are now fully expanded.
- Added four six-chapter equipment guides: cartridge terminology and sporting context; suppressors and hearing-risk literacy; night vision technologies; thermal imaging specifications and interpretation. Each includes approximately 1,100 words of deeper material plus quick actions, comparison tables and an HTML process diagram.
- Expanded Home fire into six substantial chapters with specific USFA and Red Cross references.
- Equipment pathways and related links make the new content discoverable. All new guides remain browser-searchable and preserve quick answers before deeper detail and commercial CTAs.
- Increased urgent-link touch areas and refined small hero text. Private contact fields use 16px text on narrow screens.

## Editorial scope

Cartridge examples identify names and broad lawful sporting contexts, rather than optimise weapons for harm to people or penetration. Suppressor content covers sound reduction, ownership questions and manufacturer support, without construction, modification or stealth guidance. Night-vision and thermal content covers civilian observation and inspection, without weapon integration or targeting. Current legal processes, costs and timelines are not promised.

## Newsletter status

The user selected MailerLite form 200177377250117414, Osprey Zero | Early Access. Connector evidence: inactive, no content, double opt-in enabled, existing group retained. The connector exposes form naming but not design/activation. Attempting to open its editor encountered browser native-credential observation protection. No subscribers were imported and no campaign was sent. Existing website request collection stays explicitly separate from automated delivery until the selected form is completed and tested.

## Verification and remaining work

Run the complete build; added regressions cover private query handoff, blocked storage fallback, refresh state, shared-link cleanup, show-more focus, paused sales claims, free plan entry and private contact markup. Existing internal-link, metadata, publishing boundary, rich-content, search, ad policy, toolkit and planner tests remain required.

The release has 130 guides, 31 with substantial rich chapters. The remaining 99 still need staged content expansion; priority hazards include hurricane, tornado, flash flood, wildfire, heat, gas and CO, followed by clinical-review-sensitive first aid. This release does not claim to certify the full encyclopedia, audit all external websites, benchmark real mobile devices or finish newsletter automation. Mobile browser/installed planner testing remains separate from structural responsive checks. Contact form registration will be checked after deployment; no real customer message is sent as a test.
