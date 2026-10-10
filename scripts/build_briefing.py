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


def context_details():
    return '<details class="briefing-context"><summary>How Daily Brief works &amp; current sources</summary>' + notice() + live_sources() + '<p class="briefing-status-detail" data-briefing-status-detail></p><p>ZIP-area estimate: <a href="https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html" rel="noopener noreferrer">U.S. Census Bureau, 2020 ↗</a>. County overlap is approximate, not address-level coverage. Connecticut matching is unavailable because county definitions changed. ZIP and city lookups use public local maps. Device location is requested once on your first Daily Brief visit if no area is already saved. Permission is optional; the browser or operating system may use its own location services. This site does not send coordinates to a geocoder or store them. Only your derived area and location-request attempt are remembered in this browser. City and device-location matching use approximate 2020 Census areas; cities may span counties. State searches use broad source labels. Products and other reports remain available.</p><p>Source: U.S. Census Bureau, 2020; adapted by Osprey Zero. <a href="https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt" rel="noopener noreferrer">Census place–county codes ↗</a> · <a href="https://www2.census.gov/geo/tiger/TIGER2020/COUNTY/tl_2020_us_county.zip" rel="noopener noreferrer">TIGER/Line® county source ↗</a>. No Census endorsement.</p></details>'


def status_line():
    return '<p class="briefing-schedule">Not live · twice daily, 00:00 / 12:00 UTC</p><p class="briefing-status" data-briefing-status role="status" aria-live="polite">Loading stored reports; coverage is incomplete.</p>'


def homepage_section():
    return '''<section class="home-start-band home-briefing" data-briefing="home"><div class="wrap home-start" aria-labelledby="start-title"><div class="home-section-heading"><div><p class="kicker">03 / KNOW WHAT TO PREPARE FOR</p><h2 id="start-title">Daily Brief.</h2></div><a class="text-link" href="/briefing/">View all &amp; choose your area <span aria-hidden="true">→</span></a></div>''' + status_line() + '''<div class="briefing-card-grid" data-briefing-cards hidden></div><div data-briefing-fallback>''' + planning_cards() + '''</div><noscript><p class="briefing-help">Briefing reports need JavaScript and a connection. These planning guides are always available online.</p></noscript>''' + context_details() + planning_links() + '''</div></section>'''


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
    assets = '<link rel="stylesheet" href="/briefing.css?v=oz1">'
    if route == '/briefing/':
        assets += '<script src="/briefing/local-area-lookup.js?v=oz1" defer></script>'
    assets += '<script src="/briefing.js?v=oz1" defer></script>'
    if noindex:
        assets += '<meta name="robots" content="noindex,follow">'
    before = before.replace('</head>', assets + '</head>')
    page = before + main + after
    destination = ROOT / route.strip('/') / 'index.html'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text('\n'.join(line.rstrip() for line in page.splitlines()) + '\n')


def build():
    index = '''<main id="main" class="subpage briefing-page" data-briefing="index">
<header class="wrap briefing-compact-header"><h1>Daily Brief</h1>''' + status_line() + '''</header>
<section class="wrap briefing-feed" aria-label="Source reports">
<form class="briefing-zip-form" data-briefing-zip-form hidden><div class="briefing-zip-controls"><label for="briefing-zip">Your area</label><input id="briefing-zip" data-briefing-zip type="text" autocomplete="off" maxlength="120" placeholder="ZIP, city or state" aria-label="U.S. ZIP, city or state" aria-describedby="briefing-zip-help briefing-zip-status" aria-controls="briefing-area-choices" aria-expanded="false"><button type="submit" data-briefing-zip-submit>Search</button><button type="button" data-briefing-zip-clear hidden>Clear</button><button type="button" class="briefing-geolocate" data-briefing-geolocate>Use my location</button></div><p id="briefing-zip-help">Allow location access to show news and preparedness guides relevant to your area. You can also enter a ZIP, city, or state.</p><p class="briefing-location-caveat">Approximate U.S. area matches only. Location is optional; no exact hazard or complete news coverage is implied.</p><p id="briefing-zip-status" data-briefing-zip-status role="status" aria-live="polite"></p><div id="briefing-area-choices" class="briefing-area-choices" data-briefing-area-choices role="group" aria-label="Choose an area" hidden></div></form>
<div class="briefing-filters" data-briefing-filters hidden><label class="briefing-category-filter" for="briefing-category"><span class="briefing-sr-only">Category</span><select id="briefing-category" data-briefing-category aria-label="Category"><option value="all">All categories</option></select></label><details class="briefing-filter-options" data-briefing-options><summary>More filters</summary><div><label for="briefing-location">Broad location<select id="briefing-location" data-briefing-location aria-label="Broad location"><option value="all">All locations</option></select></label><button type="button" data-briefing-reset>Reset filters</button><p>Choosing a broad location replaces your area search. Historical and background records are hidden by default. Missing reports never mean all-clear.</p></div></details><label class="briefing-history-choice"><input type="checkbox" data-briefing-history><span data-briefing-history-label>Include history &amp; background reports</span></label></div>
<nav class="briefing-group-nav" data-briefing-group-nav aria-label="Report groups" hidden></nav><h2 class="briefing-area-heading" data-briefing-area-heading hidden></h2><p class="briefing-area-note" data-briefing-area-note hidden></p><p class="briefing-result-count" data-briefing-count role="status" aria-live="polite"></p><div class="briefing-card-grid" id="briefing-reports" data-briefing-cards hidden></div><button type="button" class="briefing-more" data-briefing-more aria-controls="briefing-reports" hidden>Show more reports</button><div class="briefing-empty" data-briefing-empty hidden></div><div data-briefing-fallback><p class="briefing-fallback-intro">While reports load, start with the essentials.</p>''' + planning_cards() + '''</div><noscript><p class="briefing-help">Reports and filters need JavaScript and a connection. These planning guides remain available.</p></noscript>
''' + context_details() + '''<details class="briefing-source-health" data-briefing-source-health hidden><summary>Source checks, dates &amp; coverage</summary><div data-briefing-sources></div></details>''' + planning_links() + '''</section></main>'''
    detail = '''<main id="main" class="subpage briefing-page" data-briefing="event"><div class="wrap briefing-detail-wrap"><a class="briefing-back" data-briefing-back href="/briefing/">← Back to Daily Brief</a>''' + status_line() + '''<article class="briefing-detail" data-briefing-detail hidden></article><div data-briefing-fallback><h1 class="briefing-unavailable-title">Source report</h1><p data-briefing-detail-fallback>Loading this stored report.</p><a class="text-link" href="/briefing/">Browse Daily Brief →</a><div class="briefing-detail-planning">''' + planning_cards() + '''</div></div>''' + context_details() + '''<noscript><p class="briefing-help">Source reports need JavaScript and a connection. The planning guides remain available online.</p></noscript></div></main>'''
    build_page('/briefing/', 'Daily Brief', 'Scheduled source snapshots linked to reviewed Osprey Zero preparedness guidance. Not a live alert service.', index)
    build_page('/briefing/event/', 'Source report', 'Source context and related preparedness guides. Check current source instructions; this is not a live alert service.', detail, noindex=True)
    print('Built ad-free briefing index and source-report shells. No current-event data fabricated or bundled.')


if __name__ == '__main__':
    build()
