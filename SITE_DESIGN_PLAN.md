# Osprey Zero — website design and content plan

## Design intent

A calm, premium knowledge platform that is useful before the full guide library exists and scales into a one-stop emergency reference. The homepage must let a visitor facing a disruption find a situation immediately, while offering a slower path into preparedness, original guides, and the newsletter.

The approved Osprey Zero logo is the OZ osprey monogram with field-bone mark and signal-orange triangle. The site uses the exact palette: Obsidian Black `#0B0D0F`, Field Bone `#D7D1C4`, Field Olive `#55624A`, Slate Gray `#6B7378`, Signal Orange `#F05A2A`. The page surfaces are solid black and charcoal. There are no photographic or decorative graphics behind content. Orange is reserved for direction, active states, small rules, and primary actions. Typography uses a condensed display face, readable body text, and restrained mono labels. The inherited slogan remains exact: **Skill beats panic. Every time.**

## Visitor paths

| Visitor state | First action | Destination | What must be visible immediately |
| --- | --- | --- | --- |
| Facing a disruption | Choose or search a situation | `/emergencies/#topic` | Immediate-danger instruction, situation label, current official source path |
| Preparing ahead | Open the preparedness path | `/preparedness/` | A small, practical four-part starting framework |
| Learning a skill | Browse the field library | `/guides/` | Own guide formats, publication status, quick-answer-first promise |
| Interested in the first guide | Enter email | Guide early-access form | Clear guide status and what email they will receive |
| Wants regular updates | Enter email | Field Notes newsletter form | What the newsletter contains and frequency expectations |
| Wants an Osprey Zero video offline | Open ClipJar | `https://clipjar.io/` | Copy-link workflow and limitation on available watermark-free files |
| Wants original source material | Open reference shelf | `/resources/` | Distinct public-agency and published-manual links |

## Homepage hierarchy

1. **Navigation:** logo; emergencies, preparedness, field guides, reference shelf, about; persistent guide CTA.
2. **Hero:** “When systems fail, skill remains.” The primary action jumps to the emergency finder. A right-hand start panel offers three unambiguous paths.
3. **Immediate danger strip:** directs visitors in active danger to local emergency services and local instructions. This is a utility notice, not a dramatic visual.
4. **Emergency finder:** search/filter and six internal topic cards. Search works locally and links open Osprey Zero topic anchors rather than sending visitors straight to external websites.
5. **Guide method:** a contained, editorial field-manual specimen. The first paragraph is the quick answer, followed by ordered steps, exceptions, sources, review date, and optional printable aids. It is explicitly labeled as a format preview.
6. **First guide early access:** the upcoming 72-hour blackout field guide and a dedicated email signup. The existing BRIK PDF is not presented as a completed Osprey Zero guide.
7. **Field Notes newsletter:** separate opt-in for ongoing notes and guide releases.
8. **ClipJar:** a restrained utility panel explaining personal offline reference for Osprey Zero’s public videos and linking to the actual ClipJar product. Copy promises only source-available files; a watermark-free file is not guaranteed on every video.
9. **Reference shelf:** separate path to agencies, public-health material, and published military field manuals.
10. **Footer:** main paths, privacy, identity, and local-authority priority.

## Information architecture

- `/emergencies/` — situation directory, short orientations, future quick answers and detailed Osprey Zero guides.
- `/preparedness/` — household and individual planning path.
- `/guides/` — original Field Guides, Protocols, Checklists, Briefings, and Field Notes. The current page describes the editorial format and publication status.
- `/resources/` — source shelf: public agencies, official alerts, and published manuals. Outside links are labeled.
- `/about/` — mission, BRIK continuity, editorial standards.
- `/privacy/` — current draft disclosure, to be finalized with the live collection and mail delivery configuration.
- `/thanks/` — success destination for signup submissions.

## Guide publishing standard for the next phase

Every guide starts with an **answer-first paragraph** of roughly 40–80 words, followed by a compact “Do now” list. Longer context is below the fold. Guides should be directly addressable from search and category links. The working template:

1. Title, situation, short scope, and the key local-authority override.
2. TL;DR first paragraph and the most urgent safe action.
3. “Do now” in a small number of ordered steps.
4. “Next” for the following hours or days, with decision points.
5. Risks, exceptions, and clear thresholds for seeking qualified help.
6. Equipment/skills where relevant, with alternatives for budget and access.
7. Sources, author/reviewer, last-reviewed date, next review, and update note.
8. Related guides, printable checklist, and offline-friendly version where useful.

The guide author should synthesize and explain source material in Osprey Zero’s voice. Source links support the guide; they do not substitute for it. High-stakes medical, water, and safety instructions require domain review before publication. If source guidance changes, the guide records the change visibly.

## Newsletter and guide signup

The draft contains two distinct Netlify HTML forms with honeypots and separate names (`guide-early-access`, `field-notes-newsletter`). Their visible consent copy is purpose-specific. **The current Netlify project reported Forms disabled.** Before any public deployment, enable form detection, verify real submissions, confirmation behavior and notification flow, and decide whether to sync or replace collection with the connected MailerLite list. The Osprey Zero MailerLite embedded form currently has no content and is inactive; it is not a live signup destination. Keep the guide and ongoing newsletter intent separate when wiring groups or automations. Review the privacy notice against the final data flow before launch.

## Release sequence

1. Review the visual prototype on desktop and mobile against the approved brand boards.
2. Finish the first source-reviewed Osprey Zero guide and the rebranded blackout checklist before claiming those assets are available.
3. Wire and test both opt-ins end to end, including consent, double opt-in where appropriate, confirmation, and unsubscribe.
4. Review every emergency topic for accurate live source paths and publish quick answers as original articles.
5. Prepare favicon/social images, privacy, redirects, sitemap, accessibility, and performance checks.
6. Deploy on a branch preview; verify Osprey Zero domain and preserve old BRIK URLs. Promote to production only after the content and signup paths work.
