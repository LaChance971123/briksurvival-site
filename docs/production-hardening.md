# Production hardening and recovery

## Release changes

- Ad-free pages allow only same-origin scripts, connections and frames (frames are denied). Advertising pages allow the existing vignette script host; the push prompt stays disabled. Root advertising worker and subscriptions are unchanged. Planner isolation remains a separate-origin requirement, not a CSP guarantee.
- Search requests stop after 12 seconds; signup requests after 15 seconds. Signup timeout does not assert that a submission failed to reach Netlify.
- `/api/briefing/home` supplies at most 12 compact candidates. `/api/briefing` bounds the entire serialized response to 3 MiB and discloses omitted records. Original timestamps, attribution and source coverage remain.
- `/api/health` reports 503 for unavailable storage, stale snapshots or stale/failed source fetches (14-hour freshness budget against twice-daily refresh). Partial geographic/source coverage remains normal and is not a promise of comprehensive alerts.
- The production-health workflow runs twice hourly. GitHub schedules may be delayed and are not a guaranteed uptime service. Enable owner failure notifications; run the workflow manually and verify delivery. Its read-only script checks home content, search, compact-feed size and health. No customer form submissions occur.
- Root icons resolve and legacy hosts redirect to the primary host with the requested path. Netlify preview hosts remain testable.
- Weekly dependency-update requests cover npm, pip and Actions. Build runtimes are pinned to Node 22 and Python 3.12.

## Planner rollout

1. Create a separate Netlify project connected to this repository. Set base directory `planner-host`, production branch `main`; its local netlify.toml builds only launcher files. Check that the `URL` environment variable is the dedicated HTTPS origin.
2. Verify the resulting project contains no advertising worker, ad script, content-site pages or paid HTML. Test that a visit to `/library/` cannot load the content site at that origin. Check CSP and frame protection.
3. Test the exact approved purchased HTML on Safari/iPhone and Chrome/Android: import, airplane-mode reopening, editable backup, restore on a second device and update preservation. Do not publish the private file or place it in CI artifacts.
4. Only after successful deployment and tests, add the verified destination link to the old launcher's recovery notice and product installation instructions. Customers must export and explicitly import their backup. Storage does not migrate across origins. Do not redirect the recovery page or clear its IndexedDB/localStorage.
5. The content-site launcher pauses new imports and requires an explicit warning acknowledgement before opening an existing app for backup. Old installed copies can retain earlier cached UI until their worker updates online. Existing records remain exposed to the old origin until the customer migrates/removes them. Do not claim automatic migration or complete remediation of legacy storage.

## Account-side release gates

These require authenticated owner/admin access and must be verified in the provider; repository configuration alone does not enable them.

- GitHub main rules: require pull requests, the `site` verification check, resolved conversations, block force pushes/deletion, and restrict bypass. Add independent approval when another trusted reviewer is available. A sole owner must not be locked out by an impossible self-review requirement. Confirm rule enforcement with a harmless test branch, not by bypassing it.
- Netlify/GitHub/registrar MFA and recovery: owner completes credential enrollment; keep recovery codes privately outside this repository. Confirm billing allowance, overage/spend controls and deploy/usage notifications. Do not buy or upgrade a plan without an agreed budget.
- MailerLite: configure and activate the current Field Notes/early-access flow, purpose-specific consent, double opt-in, sender identity and unsubscribe. Do not reactivate legacy free-checklist promises. Connect Netlify collection only through an authenticated, purpose-matched integration. Test using an owner-approved inbox; verify confirmation and unsubscribe, without enrolling existing contacts or sending a campaign.
- Private-contact form: configure owner notification routing in Netlify and test an innocuous message with an approved inbox. Do not put private addresses or tokens in public source.
- Commerce: keep planned products disabled. Test the exact sale edition, checkout, payment, receipt and delivered checksum before changing catalogue readiness. Financial verification and private product files require owner participation.
- Real-device/accessibility: verify keyboard navigation, focus, zoom, screen-reader status and narrow-screen search/briefing/planner journeys. Record device/browser versions and measured LCP/INP/CLS; automated DOM checks do not certify accessibility or mobile performance.
- Editorial: assign a qualified reviewer and review dates for high-stakes content. This release does not claim independent clinical/legal certification.

## Recovery

Application rollback: retain the previously published Netlify deploy ID and Git commit. If release verification fails, restore the prior ready deploy in Netlify, then revert the offending source change through a tested PR. Never force-reset main. A rollback does not undo browser-stored data or external submissions.

Briefing storage: `osprey-briefing-v1` keeps 28 half-day snapshot slots plus atomic `latest-state`. Scheduled refresh preserves last-good data on source failures. Validate a historical snapshot in a private/nonproduction store first; preserve its original dates. Do not claim an old restored snapshot is fresh. Existing server store/failure tests exercise atomic writes and bounded-history behavior; an account-level restore drill remains required.

Planner: make an editable backup inside the paid application before replacing its software, moving origins, clearing site data or uninstalling. Verify restoration before deleting any old copy. No automatic transfer or deletion is performed by this release.
