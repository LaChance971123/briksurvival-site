#!/usr/bin/env python3
"""Build ad-free briefing shells; current records are read from one same-origin snapshot."""
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def planning_cards():
    return '''<div class="briefing-planning-grid">
<article class="briefing-planning-card"><span class="briefing-eyebrow">PLANNING ESSENTIAL / 01</span><h3>Make your household plan.</h3><p>Choose contacts, meeting points and what would make you stay or leave.</p><a href="/preparedness/household-emergency-plan/">Household planning guide <span aria-hidden="true">→</span></a></article>
<article class="briefing-planning-card"><span class="briefing-eyebrow">PLANNING ESSENTIAL / 02</span><h3>Secure the essentials.</h3><p>Prioritize water, food, lighting and care needs around your budget.</p><a href="/preparedness/budget-preparedness/">Budget preparedness guide <span aria-hidden="true">→</span></a></article>
<article class="briefing-planning-card"><span class="briefing-eyebrow">PLANNING ESSENTIAL / 03</span><h3>Practice and maintain.</h3><p>Test the plan, check your supplies and fix one useful gap at a time.</p><a href="/preparedness/preparedness-maintenance/">Preparedness upkeep guide <span aria-hidden="true">→</span></a></article>
</div>'''


def planning_links():
    return '''<nav class="briefing-planning-links" aria-label="Planning essentials"><span>Keep preparing</span><a href="/preparedness/household-emergency-plan/">Household plan</a><a href="/preparedness/budget-preparedness/">Budget essentials</a><a href="/preparedness/preparedness-maintenance/">Practice &amp; upkeep</a></nav>'''


def notice():
    return '''<div class="briefing-notice"><span class="briefing-notice-mark" aria-hidden="true">i</span><p><strong>Scheduled snapshots, not live alerts.</strong> Refreshes are scheduled twice daily at 00:00 and 12:00 UTC. Reports can be incomplete or delayed. Check the linked source for changes; an absent, expired or unavailable report is not an all-clear.</p></div>'''


def live_sources():
    return '''<nav class="briefing-live-sources" aria-label="Check current official sources"><span>Check current sources</span><a href="https://www.weather.gov/alerts" rel="noopener noreferrer">NWS alerts ↗</a><a href="https://earthquake.usgs.gov/earthquakes/map/" rel="noopener noreferrer">USGS earthquakes ↗</a><a href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts" rel="noopener noreferrer">FDA recalls ↗</a></nav>'''


def homepage_section():
    return '''<section class="home-start-band home-briefing" data-briefing="home"><div class="wrap home-start" aria-labelledby="start-title"><div class="home-section-heading"><div><p class="kicker">03 / KNOW WHAT TO PREPARE FOR</p><h2 id="start-title">Preparedness briefing.</h2></div><a class="text-link" href="/briefing/">View all &amp; choose your area <span aria-hidden="true">→</span></a></div><p class="briefing-home-intro">Source-linked reports, with practical guides for your next step.</p>''' + notice() + live_sources() + '''<p class="briefing-status" data-briefing-status role="status" aria-live="polite">Reports load from a stored snapshot when JavaScript and a connection are available.</p><div class="briefing-card-grid" data-briefing-cards hidden></div><div data-briefing-fallback>''' + planning_cards() + '''</div><noscript><p class="briefing-help">Briefing reports need JavaScript and a connection. These planning guides are always available online.</p></noscript>''' + planning_links() + '''</div></section>'''


def build_page(route, title, description, main, noindex=False):
    shell = (ROOT / 'templates/shell.html').read_text()
    before = shell[:shell.index('  <main id="main"')]
    after = shell[shell.index('  <footer class="site-footer"'):]
    before = re.sub(r'<title>.*?</title>', '<title>' + escape(title) + ' — Osprey Zero</title>', before)
    before = re.sub(r'<meta name="description"[^>]*>', '<meta name="description" content="' + escape(description, quote=True) + '">', before)
    before = re.sub(r'<link rel="canonical"[^>]*>', '<link rel="canonical" href="https://ospreyzero.com' + route + '">', before)
    # The inherited shell contains ad initialization and page-specific metadata.
    # Briefing routes must never initialize an ad provider.
    before = re.sub(r'<script[^>]+src="/ads\.js[^\"]*"[^>]*></script>', '', before)
    before = re.sub(r'<meta name="monetag"[^>]*>', '', before)
    before = re.sub(r'<meta (?:property="og:|name="twitter:)[^>]*>', '', before)
    before = re.sub(r'<script type="application/ld\+json".*?</script>', '', before, flags=re.S)
    assets = '<link rel="stylesheet" href="/briefing.css?v=oz1"><script src="/briefing.js?v=oz1" defer></script>'
    if noindex:
        assets += '<meta name="robots" content="noindex,follow">'
    before = before.replace('</head>', assets + '</head>')
    page = before + main + after
    destination = ROOT / route.strip('/') / 'index.html'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(page)


def build():
    index = '''<main id="main" class="subpage briefing-page" data-briefing="index">
<section class="wrap briefing-hero" aria-labelledby="briefing-title"><p class="kicker"><span class="accent-line"></span> OSPREY ZERO / SITUATIONAL CONTEXT</p><h1 id="briefing-title">Know what to<br><span>prepare for.</span></h1><p class="briefing-lede">A considered look at source reports, connected to the practical knowledge you can use. Start with the facts. Keep a workable household plan.</p>''' + notice() + live_sources() + '''<p class="briefing-status" data-briefing-status role="status" aria-live="polite">Reports load from a stored snapshot when JavaScript and a connection are available.</p></section>
<section class="wrap briefing-feed" aria-labelledby="reports-title"><div class="briefing-feed-heading"><div><p class="kicker">THE PREPAREDNESS BRIEFING</p><h2 id="reports-title">Source reports.</h2></div><a href="#briefing-method" class="text-link">How to read this page <span aria-hidden="true">↓</span></a></div>
<form class="briefing-zip-form" data-briefing-zip-form hidden><div><label for="briefing-zip">Find reports relevant to your area</label><p id="briefing-zip-help">Optional U.S. ZIP. Looked up and saved only in this browser; no GPS or external geocoder. County overlaps are approximate, not address-level coverage.</p><p class="briefing-zip-credit">ZIP-area estimate: <a href="https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html" rel="noopener noreferrer">U.S. Census Bureau, 2020 ↗</a></p></div><div class="briefing-zip-controls"><input id="briefing-zip" data-briefing-zip type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="ZIP code" aria-label="Five-digit U.S. ZIP code" aria-describedby="briefing-zip-help briefing-zip-status"><button type="submit">Use ZIP</button><button type="button" data-briefing-zip-clear hidden>Clear ZIP</button></div><p id="briefing-zip-status" data-briefing-zip-status role="status" aria-live="polite"></p></form>
<div class="briefing-filters" data-briefing-filters hidden><label for="briefing-category">Category<select id="briefing-category" data-briefing-category><option value="all">All categories</option></select></label><label for="briefing-location">Broad location<select id="briefing-location" data-briefing-location><option value="all">All locations</option></select></label><button type="button" data-briefing-reset>Reset filters</button><p>Your choices stay in this browser. Choosing a broad location clears the ZIP filter. Category applies across all report groups. Filters cannot establish whether your location is safe.</p></div>
<h3 class="briefing-area-heading" data-briefing-area-heading hidden></h3><p class="briefing-area-note" data-briefing-area-note hidden></p><p class="briefing-result-count" data-briefing-count role="status" aria-live="polite"></p><div class="briefing-card-grid" id="briefing-reports" data-briefing-cards hidden></div><button type="button" class="briefing-more" data-briefing-more aria-controls="briefing-reports" hidden>Show more reports</button><div class="briefing-empty" data-briefing-empty hidden></div><div data-briefing-area-groups hidden></div><div data-briefing-fallback><p class="briefing-fallback-intro">While the snapshot loads, start with your planning essentials.</p>''' + planning_cards() + '''</div><noscript><p class="briefing-help">Reports and filters need JavaScript and a connection. You can still use the planning guides above and the <a href="/resources/">reference shelf</a>.</p></noscript>
<details class="briefing-source-health" data-briefing-source-health hidden><summary>Source checks and coverage</summary><div data-briefing-sources></div></details></section>
<section class="wrap briefing-method" id="briefing-method" aria-labelledby="method-title"><p class="kicker">READ WITH CONTEXT</p><h2 id="method-title">A briefing. A starting point.</h2><div class="briefing-method-grid"><div><h3>Source reports stay separate.</h3><p>“Official source snapshot” identifies a report from the named official source. “Reported news” is reporting, not an official instruction. Open the original source to verify its current wording, time and scope.</p></div><div><h3>Guides are editorial preparation.</h3><p>Related Osprey Zero guides are general preparedness material. They are not new event-specific orders, guarantees of assistance or a substitute for specialist assessment.</p></div><div><h3>Coverage has limits.</h3><p>This is a selected set of reports, not a complete emergency feed. ZIP filtering uses a bundled <a href="https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt" rel="noopener noreferrer">2020 U.S. Census ZIP-area/county relationship</a>, not exact postal boundaries or your address. Osprey Zero derived this lookup; the Census Bureau does not endorse it. Connecticut matching is unavailable because county definitions changed. Unknown locations, missed refreshes, expired records and empty results never establish that a threat has ended. Verify changing conditions through sources safe for you to contact.</p></div></div>''' + planning_links() + '''</section></main>'''
    detail = '''<main id="main" class="subpage briefing-page" data-briefing="event"><nav class="wrap briefing-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/briefing/">Preparedness briefing</a></nav><div class="wrap briefing-detail-wrap">''' + notice() + live_sources() + '''<p class="briefing-status" data-briefing-status role="status" aria-live="polite">Reports load from a stored snapshot when JavaScript and a connection are available.</p><article class="briefing-detail" data-briefing-detail hidden></article><div data-briefing-fallback><h1 class="briefing-unavailable-title">Source report</h1><p data-briefing-detail-fallback>Loading this report from the stored briefing snapshot.</p><a class="text-link" href="/briefing/">Browse all briefings <span aria-hidden="true">→</span></a><div class="briefing-detail-planning">''' + planning_cards() + '''</div></div><noscript><p class="briefing-help">Source reports need JavaScript and a connection. The planning guides above remain available online.</p></noscript></div></main>'''
    build_page('/briefing/', 'Preparedness briefing', 'Scheduled source snapshots linked to reviewed Osprey Zero preparedness guidance. Not a live alert service.', index)
    build_page('/briefing/event/', 'Source report', 'Source context and related preparedness guides. Check current source instructions; this is not a live alert service.', detail, noindex=True)
    print('Built ad-free briefing index and source-report shells. No current-event data fabricated or bundled.')


if __name__ == '__main__':
    build()
