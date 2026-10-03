#!/usr/bin/env python3
"""Compile free editorial pages and public toolkit metadata; never paid files."""
import json,re
from pathlib import Path
from html import escape as e
from guide_diagrams import diagram
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
from toolkit_catalog import load_catalog, guide_cta, homepage_section, product_route, purchase_control
CATALOG=load_catalog(ROOT)
GUIDES=sorted((json.loads(p.read_text()) for p in (ROOT/'content/guides').glob('*.json')),key=lambda g:g['title'].lower())
CATS=json.loads((ROOT/'content/taxonomy.json').read_text());CAT={c['id']:c for c in CATS}
SOURCES=json.loads((ROOT/'content/sources.json').read_text())
SHELL=(ROOT/'templates/shell.html').read_text(); BEFORE=SHELL[:SHELL.index('  <main id="main"')];AFTER=SHELL[SHELL.index('  <footer class="site-footer"'):]
MANUALS={
'fema':dict(title='FEMA · Are You Ready? (PDF)',url='https://www.ready.gov/sites/default/files/2021-11/are-you-ready-guide.pdf',description='Civilian preparedness reference. Current local instructions take priority.'),
'weather':dict(title='FEMA · Hazard information sheets (PDF)',url='https://www.ready.gov/sites/default/files/2025-02/fema_full-suite-hazard-info-sheets.pdf',description='Published hazard reference sheets for preparation and response.'),
'water':dict(title='CDC · Make water safe (PDF)',url='https://www.cdc.gov/water-emergency/media/pdfs/make-water-safe-during-emergency-p.pdf',description='Microbial water treatment reference; does not override chemical or do-not-use restrictions.'),
'generator':dict(title='CDC · Generator safety (PDF)',url='https://www.cdc.gov/carbon-monoxide/media/pdfs/Generators_1.pdf',description='Published carbon monoxide prevention sheet.'),
'army':dict(title='U.S. Army · ATP 3-50.21 Survival (PDF)',url='https://armypubs.army.mil/epubs/DR_pubs/DR_a/pdf/web/ARN12086_ATP%203-50x21%20FINAL%20WEB%202.pdf',description='Military reference, September 2018. Historical context; civilian, medical and local guidance takes priority.')}

def write(path,content):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
def route(g): return '/'+('preparedness' if g['content_type']=='Preparedness guide' else 'guides' if g['content_type']=='Field guide' else 'emergencies')+'/'+g['slug']+'/'
def page(path,title,desc,main,noindex=False):
 head=re.sub(r'<title>.*?</title>',f'<title>{e(title)} — Osprey Zero</title>',BEFORE)
 head=re.sub(r'<meta name="description"[^>]*>',f'<meta name="description" content="{e(desc,quote=True)}">',head)
 head=re.sub(r'<link rel="canonical"[^>]*>',f'<link rel="canonical" href="https://ospreyzero.com{path}">',head)
 html=head+main+AFTER
 html=html.replace('href="/emergencies/" aria-current="page"','href="/emergencies/"')
 html=html.replace('href="/#guide-access">Get the first guide <span aria-hidden="true">↗</span>','href="/search/">Search the library')
 html=html.replace('href="#guide-access">Get the first guide <span aria-hidden="true">↗</span>','href="/search/">Search the library')
 html=html.replace('href="/guides/">Field guides','href="/library/">Encyclopedia')
 html=re.sub(r'/(styles.css|app.js)\?v=oz\d+',lambda m:'/'+m[1]+'?v=oz7',html)
 html=html.replace('</head>','<script src="/search.js?v=oz7" defer></script>\n</head>')
 if noindex:html=html.replace('</head>','<meta name="robots" content="noindex,follow"></head>')
 write(path.strip('/') if path.endswith('.html') else path.strip('/')+'/index.html',html)

def resource_keys(g):
 if g['category']=='field-skills':return ['water','army'] if g['subcategory']=='Water' else ['fema']
 if g['sources']=='generator-safety':return ['generator']
 if g['category']=='utilities' and g['subcategory']=='Water':return ['water']
 if g['category']=='natural-hazards':return ['weather']
 if g['category'] in ['preparedness','evacuation-shelter','conflict','chemical-radiation']:return ['fema']
 return []

INDEX=[]
for g in GUIDES:
 assert g['category'] in CAT and g['subcategory'] in CAT[g['category']]['subcategories']
 for key in ['title','tldr','steps','next','watch','sources','updated']:assert g.get(key), (g['slug'],key)
 cat=CAT[g['category']];title=e(g['title']);url=route(g)
 resources=''
 for k in resource_keys(g):
  r=MANUALS[k];resources+=f'<a class="resource-button" href="{e(r["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{e(r["title"])}<small>Published reference · external</small></a>'
 label,source=SOURCES[g['sources']][0];resources+=f'<a class="resource-button resource-official" href="{e(source,quote=True)}" target="_blank" rel="noopener noreferrer">Trusted reference <small>{e(label)}</small></a>'
 sections=''.join(f'<section class="guide-section guide-deep-dive"><h2>{e(h)}</h2><p>{e(p)}</p></section>' for h,p in g.get('sections',[]))
 action_label='Build your plan' if g.get('urgency')=='planning' else 'Do now'
 steps=''.join(f'<li><span class="step-num">{n:02}</span><div><h3>{e(h)}</h3><p>{e(p)}</p></div></li>' for n,(h,p) in enumerate(g['steps'],1))
 decisions=''.join(f'<div class="decision-card"><h3>{e(h)}</h3><p>{e(p)}</p></div>' for h,p in g.get('decisions',[]))
 faqs=''.join(f'<details class="guide-faq"><summary>{e(h)}</summary><p>{e(p)}</p></details>' for h,p in g.get('faqs',[]))
 sources=''.join(f'<li><a href="{e(u,quote=True)}" target="_blank" rel="noopener noreferrer">{e(l)}</a></li>' for l,u in SOURCES[g['sources']])
 related=[x for x in GUIDES if x['slug']!=g['slug'] and x['category']==g['category'] and x['subcategory']==g['subcategory']][:3]
 extra={
  'power-outage':['generator-safety','food-safety-outage','water-disruption','extreme-cold'],
  'earthquake':['tsunami','evacuation','gas-leak'],
  'wildfire':['wildfire-smoke','evacuation','go-bag'],
  'wildfire-smoke':['wildfire','extreme-heat'],
  'tornado':['damaging-winds','thunderstorm','emergency-alerts'],
  'home-fire':['evacuation','carbon-monoxide','household-emergency-plan'],
  'carbon-monoxide':['generator-safety','power-outage'],
  'evacuation':['go-bag','household-emergency-plan','emergency-alerts'],
  'food-safety-outage':['power-outage','water-outage','72-hour-kit'],
  'nuclear-detonation':['shelter-in-place','water-disruption','emergency-alerts'],
  'cpr':['aed','choking','severe-bleeding'],
  'severe-bleeding':['cpr','aed','medication-continuity'],
  'choking':['cpr','aed','infant-child-preparedness'],
  'aed':['cpr','choking','severe-bleeding'],
  'armed-conflict':['explosions-shelling','unexploded-ordnance','displacement','family-reunification'],
  'civil-unrest':['checkpoint-safety','unsafe-authorities','verify-information','evacuation'],
  'emergency-restrictions':['unsafe-authorities','checkpoint-safety','verify-information'],
  'explosions-shelling':['armed-conflict','unexploded-ordnance','severe-bleeding','displacement'],
  'unexploded-ordnance':['armed-conflict','explosions-shelling','returning-home'],
  'displacement':['family-reunification','accessible-evacuation','pet-evacuation','go-bag'],
  'family-reunification':['displacement','communications-outage','infant-child-preparedness'],
  'sewer-failure':['water-outage','emergency-hygiene','water-storage'],
  'heating-failure':['extreme-cold','carbon-monoxide','long-blackout'],
  'medication-continuity':['accessible-evacuation','long-blackout','go-bag'],
  'returning-home':['downed-power-lines','disaster-scams','unexploded-ordnance'],
  'unsafe-authorities':['checkpoint-safety','verify-information','displacement'],
  'vehicle-breakdown':['winter-storm','extreme-heat','communications-outage']
 }.get(g['slug'],g.get('related',['emergency-alerts','72-hour-kit','evacuation']))
 for slug in extra:
  x=next(x for x in GUIDES if x['slug']==slug)
  if x not in related and slug!=g['slug'] and len(related)<4:related.append(x)
 # Explicit practical companions take precedence over alphabetical neighbours.
 preferred=[next(x for x in GUIDES if x['slug']==slug) for slug in extra if slug!=g['slug']]
 if extra!=['emergency-alerts','72-hour-kit','evacuation']:related=list(dict((x['slug'],x) for x in preferred+related).values())[:4]
 links=''.join(f'<a href="{route(x)}">{e(x["title"])}</a>' for x in related)
 main=f'''<main id="main" class="subpage guide-page"><nav class="wrap guide-breadcrumb" aria-label="Breadcrumb"><a href="/library/">Encyclopedia</a><span>/</span><a href="/library/{cat['id']}/">{e(cat['title'])}</a><span>/</span><span>{e(g['subcategory'])}</span></nav>
 <article class="wrap guide-layout"><div class="guide-main"><header class="guide-heading"><span class="kicker">{e(g['content_type'])}</span><h1>{title}</h1></header>
 <section class="quick-answer" id="quick-answer" aria-labelledby="quick-title"><h2 class="quick-label" id="quick-title">QUICK ANSWER · START HERE</h2><p>{e(g['tldr'])}</p></section>
 <section class="guide-resources" aria-label="Trusted references"><h2>Trusted references.</h2><div class="resource-grid">{resources}</div><p class="resource-note">Published references provide deeper context. The practical steps are below; outside references need a connection.</p></section>
 <div class="guide-meta"><span>UPDATED {g['updated']}</span><span>FREE ONLINE GUIDE</span></div>
 <div class="guide-alert"><span>!</span><p>Act on immediate danger. Seek qualified help when reachable and safe, but do not make your first protective step depend on a response. This page is general guidance, not a live alert.</p></div>
 <nav class="guide-jumps" aria-label="Skip to a section"><a href="#do-now">{action_label}</a><a href="#without-help">Without help</a><a href="#household">Family plan</a><a href="#next">Next</a><a href="#watch">Watch for</a><a href="#sources">Sources</a></nav>
 <section class="guide-section" id="do-now"><h2>{action_label}.</h2><ol class="action-list">{steps}</ol></section>
 {diagram(g.get('diagram'))}
 {sections}
 <section class="guide-section no-help-panel" id="without-help"><p class="kicker">PLAN AROUND WHAT YOU HAVE</p><h2>If help is unavailable.</h2><p>{e(g['without_help'])}</p></section>
 <section class="guide-section" id="household"><h2>People & practical needs.</h2><p>{e(g['household'])}</p><details class="pack-details"><summary>Keep essentials within reach</summary><p>{e(g['pack_now'])}</p></details></section>
 <section class="guide-section" id="next"><h2>Next steps.</h2><p>{e(g['next'])}</p><div class="decision-grid">{decisions}</div></section>
 <section class="guide-section"><h2>Questions in the field.</h2>{faqs}</section>
 <section class="guide-section guide-caution" id="watch"><h2>Watch for.</h2><p>{e(g['watch'])}</p></section>
 <section class="guide-section guide-sources" id="sources"><h2>Sources & context.</h2><p>Osprey Zero combines source-based protective guidance with practical household planning. References provide context, not a promise of assistance. Some standards are U.S.-based; local risks, laws and services differ.</p><ul>{sources}</ul><p>Updated {g['updated']}. {'First-aid summaries support immediate response and training; they have not received independent clinical review.' if g['category']=='medical' else 'Editorially reviewed against linked references; not independently certified by a subject-matter expert. Verify changing conditions through sources safe for you to contact.'}</p></section></div>
 <aside class="guide-rail" aria-label="Guide contents"><div class="rail-panel"><span>FIND IT FAST</span><a href="#quick-answer">Quick answer</a><a href="#do-now">{action_label}</a><a href="#without-help">If help is unavailable</a><a href="#household">People & practical needs</a><a href="#next">Next steps</a><a href="#watch">Watch for</a><a href="#sources">Sources</a><a href="/search/">Search another situation</a></div></aside></article>
 {guide_cta(g,CATALOG)}
 <section class="wrap guide-end"><h2>Related guidance.</h2><div class="related-links">{links}</div></section></main>'''
 page(url,g['title'],g['tldr'],main)
 INDEX.append(dict(title=g['title'],url=url,category=cat['title'],category_id=cat['id'],subcategory=g['subcategory'],content_type=g['content_type'],aliases=g.get('aliases',[]),summary=g['tldr'],text=' '.join([g.get('deck',''),' '.join(h+' '+p for h,p in g.get('decisions',[])+g.get('faqs',[])+g.get('sections',[])),g['next'],g['watch'],g['without_help'],g['household'],*g.get('keywords',[]),*[h+' '+p for h,p in g['steps']]]),priority=10))

# Category and subcategory pages remain usable without JavaScript.
def card(g):return f'<a class="library-card" href="{route(g)}"><span>{e(g["content_type"])}</span><h3>{e(g["title"])}</h3><p>{e(g["tldr"].split(". ")[0]+".")}</p><small>{e(g["subcategory"])}</small></a>'
def searchform():return '<form class="library-search" action="/search/" role="search"><label for="library-query">What do you need help with?</label><div><input id="library-query" name="q" type="search" placeholder="Try: smell gas, tornado warning, lights out" autocomplete="off"><button class="button button-primary" type="submit">Search</button></div></form>'
def browse(path,title,selected):
 groups=''
 chips=[]
 for cat in CATS:
  gs=[g for g in selected if g['category']==cat['id']]
  if not gs:continue
  collapsible=path in ['/emergencies/','/preparedness/','/guides/']
  groups+=(f'<details class="browse-group"><summary>{e(cat["title"])}<small>{len(gs)} {"guide" if len(gs)==1 else "guides"}</small></summary>' if collapsible else f'<section class="library-group"><h2><a href="/library/{cat["id"]}/">{e(cat["title"])}</a><small>{len(gs)} {"guide" if len(gs)==1 else "guides"}</small></h2>')
  for sub in cat['subcategories']:
   members=[g for g in gs if g['subcategory']==sub]
   if not members:continue
   subid=re.sub('[^a-z0-9]+','-',sub.lower()).strip('-')
   chips.append(f'<a href="#{cat["id"]}-{subid}">{e(sub)}</a>')
   groups+=f'<section id="{cat["id"]}-{subid}" class="library-subgroup"><h3>{e(sub)}</h3><div class="library-grid">'+''.join(card(g) for g in members)+'</div></section>'
  groups+='</details>' if collapsible else '</section>'
 nav=''.join(f'<a href="/library/{c["id"]}/"'+(' aria-current="page"' if path=='/library/'+c['id']+'/' else '')+f'>{e(c["title"])}</a>' for c in CATS)
 directory=''.join(f'<a class="subject-card" href="/library/{c["id"]}/"><h2>{e(c["title"])}</h2><p>{e(", ".join(s for s in c["subcategories"] if any(g["category"]==c["id"] and g["subcategory"]==s for g in selected)))}</p><span>{sum(g["category"]==c["id"] for g in selected)} {"guide" if sum(g["category"]==c["id"] for g in selected)==1 else "guides"}</span></a>' for c in CATS if any(g['category']==c['id'] for g in selected))
 if path=='/library/':groups='<div class="subject-grid">'+directory+'</div>'
 main=f'<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">OSPREY ZERO ENCYCLOPEDIA</p><h1>{e(title)}</h1><p>Choose a subject or search a few words. Every guide starts with what matters now and includes a plan for when help is unavailable.</p>{searchform()}<div class="library-meta">{len(selected)} free online guides · No signup needed</div><div class="browse-tools"><a href="/topics/">All topics A–Z</a><a href="/toolkits/">Preparation toolkits</a><a href="/resources/">Trusted references</a></div><nav class="subcategory-chips" aria-label="Jump to a subcategory">{"".join(chips) if len({g["category"] for g in selected})==1 else ""}</nav></section><div class="wrap library-layout"><nav class="category-nav" aria-label="Browse categories"><h2>Browse by subject</h2>{nav}<a href="/library/">All subjects</a></nav><div>{groups}</div></div></main>'
 page(path,title,f'{title.rstrip(chr(46))}: '+', '.join(g['title'] for g in selected[:4])+f'. Browse {len(selected)} free online guides and trusted references.',main)
browse('/library/','Find information. Fast.',GUIDES)
browse('/emergencies/','Emergency guides.',[g for g in GUIDES if g['content_type']=='Emergency guide'])
browse('/preparedness/','Prepare before you need it.',[g for g in GUIDES if g['content_type']=='Preparedness guide'])
browse('/guides/','Field guides & practical skills.',[g for g in GUIDES if g['content_type']=='Field guide'])
for c in CATS:browse('/library/'+c['id']+'/',c['title'],[g for g in GUIDES if g['category']==c['id']])
letters=sorted({g['title'][0].upper() for g in GUIDES})
aznav=''.join(f'<a href="#letter-{x}">{x}</a>' for x in letters)
az=''.join(f'<section class="az-section" id="letter-{x}"><h2>{x}</h2><ul>'+''.join(f'<li><a href="{route(g)}">{e(g["title"])}</a><span>{e(CAT[g["category"]]["title"])}</span></li>' for g in GUIDES if g['title'][0].upper()==x)+'</ul></section>' for x in letters)
page('/topics/','All topics A–Z','A complete alphabetical index of Osprey Zero guides.',f'<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">THE COMPLETE INDEX</p><h1>All topics A–Z.</h1><p>{len(GUIDES)} original guides. Find the title and open the quick answer.</p>{searchform()}<nav class="az-nav" aria-label="Jump to a letter">{aznav}</nav><a href="/library/">Browse by subject</a></section><div class="wrap az-list">{az}</div></main>')
# Replace the broad weather guide with a browse page, preserving the URL.
browse('/emergencies/severe-weather/','Weather: choose the specific hazard.',[g for g in GUIDES if g['category']=='natural-hazards' and g['subcategory'] in ['Severe storms','Tropical weather','Winter','Heat & dry conditions','Flooding']])
filters=''.join(f'<option value="{c["id"]}">{e(c["title"])}</option>' for c in CATS)
types=['Emergency guide','Preparedness guide','Field guide','Published reference','Toolkit']
main=f'''<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">SEARCH THE ENCYCLOPEDIA</p><h1>What happened?</h1><p>Use a topic or a few words. Try “lights out”, “smell gas” or “water unsafe”.</p><form id="global-search-form" class="library-search" role="search"><label for="global-search">Search all guides and references</label><div><input id="global-search" name="q" type="search" autocomplete="off" aria-controls="search-results" placeholder="Find the next step"><button class="button button-primary">Search</button></div><div class="search-filters"><label for="search-category">Subject<select id="search-category"><option value="">All subjects</option>{filters}</select></label><label for="search-type">Resource type<select id="search-type"><option value="">All types</option>{''.join(f'<option>{x}</option>' for x in types)}</select></label><button type="button" id="search-reset">Clear filters</button></div></form><p id="search-status" role="status" aria-live="polite">Loading the library…</p><div id="search-results" class="search-results"></div><noscript><p>Search needs JavaScript. <a href="/library/">Browse all topics here</a>; guides work without JavaScript.</p></noscript></section></main>'''
page('/search/','Search','Search the entire Osprey Zero library by topic, common phrase or keyword.',main)
for k,r in MANUALS.items():
 INDEX.append(dict(title=r['title'],url=r['url'],category='Reference shelf',category_id='',subcategory='Published manuals',content_type='Published reference',aliases=[],summary=r['description'],text=r['description'],priority=0))
for product in CATALOG['products']:
 if product['status']!='retired':
  INDEX.append(dict(title=product['title']+(' · Coming soon' if product['status']=='planned' else ''),url=product_route(product),category='Preparation toolkits',category_id='',subcategory='Paid preparation tools',content_type='Toolkit',aliases=[],summary=product['summary']+(' In development; not available to purchase.' if product['status']=='planned' else ''),text=' '.join(product['components']),priority=0))
write('search-index.json',json.dumps(INDEX,separators=(',',':')))
# The reference shelf links to independently published sources.
refs=''.join(f'<article class="library-card"><h3>{e(r["title"])}</h3><p>{e(r["description"])}</p><a href="{e(r["url"],quote=True)}" target="_blank" rel="noopener noreferrer">Open published PDF</a></article>' for r in MANUALS.values())
page('/resources/','Reference shelf','Published manuals, humanitarian references and official information.',f'<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">REFERENCE SHELF</p><h1>Published knowledge.</h1><p>Original quick answers remain in the encyclopedia. These published references provide deeper context; check their date and follow current local guidance.</p><div class="library-grid">{refs}</div><div class="reference-toolkit-note"><h2>Build your household plan.</h2><p>Explore four completed preparation toolkit editions with printable guides, checklists and Excel calculators. Checkout is opening soon. Our online guides remain free to read.</p><a class="button button-outline" href="/toolkits/">Explore the toolkits</a></div><h2>Current official information.</h2><div class="related-links"><a href="https://www.weather.gov/">National Weather Service</a><a href="https://www.ready.gov/">Ready.gov</a><a href="https://www.cdc.gov/">CDC</a><a href="https://www.redcross.org/get-help.html">American Red Cross</a></div></section></main>')
rp=ROOT/'resources/index.html'
rp.write_text(rp.read_text().replace('<h2>Current official information.</h2>','<h2>Independent humanitarian & civilian support.</h2><p>Verify contacts directly and share personal information only when safe. These services may have limited access or capacity and do not guarantee assistance.</p><div class="related-links"><a href="https://www.icrc.org/en/where-we-work">ICRC · Find a country operation</a><a href="https://help.unhcr.org/">UNHCR · Country-specific help</a><a href="https://www.icrc.org/en/what-we-do/reconnecting-families">Red Cross · Family reunification</a><a href="https://www.accessnow.org/help/">Access Now · Digital Security Helpline</a></div><h2>Official hazard & health references.</h2>'))
# Add global navigation to preserved pages and make homepage search global.
for p in [ROOT/'index.html',ROOT/'about/index.html',ROOT/'privacy/index.html',ROOT/'thanks/index.html']:
 html=p.read_text();html=html.replace('/styles.css?v=oz5','/styles.css?v=oz6').replace('/app.js?v=oz4','/app.js?v=oz6')
 html=html.replace('href="/guides/">Field guides','href="/library/">Encyclopedia').replace('href="/#guide-access">Get the first guide <span aria-hidden="true">↗</span>','href="/search/">Search the library')
 if '/search.js?' not in html:html=html.replace('</head>','<script src="/search.js?v=oz6" defer></script>\n</head>')
 if p==ROOT/'index.html':
  html=re.sub(r'<input([^>]*id="emergency-search"[^>]*)>',lambda m:'<input'+m[1]+' aria-controls="home-search-results">',html) if 'aria-controls="home-search-results"' not in html else html
  if 'id="home-search-results"' not in html:html=html.replace('<div class="topic-grid"','<div id="home-search-results" class="search-results" hidden></div><div class="topic-grid"')
  html=re.sub(r'(?:\d+|TEN) ORIGINAL GUIDES',str(len(GUIDES))+' ORIGINAL GUIDES',html)
  html=re.sub(r'All \d+ guides start',f'All {len(GUIDES)} guides start',html)
  html=re.sub(r'ENCYCLOPEDIA / \d+ GUIDES',f'ENCYCLOPEDIA / {len(GUIDES)} GUIDES',html)
 p.write_text(html)
paths=sorted({'/toolkits/','/planner/',*[product_route(p) for p in CATALOG['products'] if p['status']!='retired'],'/','/about/','/privacy/','/resources/','/library/','/topics/','/search/','/emergencies/','/preparedness/','/guides/','/emergencies/severe-weather/',*[route(g) for g in GUIDES],*['/library/'+c['id']+'/' for c in CATS]})
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>https://ospreyzero.com{x}</loc><lastmod>{next((g['updated'] for g in GUIDES if route(g)==x),'2026-10-03')}</lastmod></url>' for x in paths)+'</urlset>')
print(f'Built {len(GUIDES)} guides, {len(CATS)} categories, {len(INDEX)} indexed resources.')

# Sales pages contain descriptions only; purchased files are delivered by Payhip.
products=[p for p in CATALOG['products'] if p['status']!='retired']
cards=''
for product in products:
 status='Available now' if product['status']=='ready' else 'Files complete · Checkout opening soon' if product['status']=='files-ready' else 'In development'
 contents=''.join(f'<li>{e(x)}</li>' for x in product['components'])
 cards+=f'<article class="toolkit-card"><p class="toolkit-eyebrow">{e(product["kind"].upper())} / {status.upper()}</p><h2>{e(product["title"])}</h2><p>{e(product["summary"])}</p><h3>{"Included tools" if product["status"] in ("ready","files-ready") else "Planned tools"}</h3><ul>{contents}</ul><a class="button button-outline" href="{product_route(product)}">Explore the {"collection" if product["kind"]=="collection" else "toolkit"}</a></article>'
live=any(p['status']=='ready' for p in products)
catalog_status='Toolkits available now' if live else 'Four topic kits complete · Checkout opening soon'
catalog_intro=('Browse available packages and planned releases. Each available product lists its exact contents, edition and one-time price.' if live else 'Explore four completed topic kits below. Each has professionally branded PDFs, separate A4 and US Letter folders, and an Excel calculator. The complete bundle is still being assembled; the Household Planner is sold separately.')
catalog_delivery=('Purchases and file delivery take place through Payhip. Products marked in development are not available to purchase.' if live else 'Each product will list its contents, edition and one-time price. Purchases and file delivery will take place through Payhip. No toolkit is currently on sale.')
page('/toolkits/','Preparation toolkits','Browse Osprey Zero preparation toolkits: practical guides, checklists and household planners.',f'''<main id="main" class="subpage toolkit-page"><section class="wrap toolkit-heading"><p class="kicker">OSPREY ZERO / PREPARATION TOOLKITS</p><h1>Make preparation<br><em>practical.</em></h1><p>Keep the guidance, organise your supplies and make a plan for the people who depend on you.</p><div class="toolkit-intro"><span class="toolkit-status">{catalog_status}</span><p>{catalog_intro}</p></div></section><section class="wrap toolkit-grid" aria-label="Toolkit catalogue">{cards}</section><section class="wrap toolkit-details"><div><p class="kicker">FREE GUIDANCE / PRACTICAL TOOLS</p><h2>Read now.<br>Prepare ahead.</h2><p>Online guides give you the quick answer, protective steps and linked sources. Preparation toolkits are designed to add printable guides, checklists and household planning materials you can keep on your device or in a binder.</p><a class="text-link" href="/library/">Browse the free encyclopedia</a></div><div><h2>{'Purchase and delivery.' if live else 'When the collection is ready.'}</h2><p>{catalog_delivery}</p><a class="text-link" href="/toolkits/">Explore all toolkits</a></div></section></main>''')
for product in products:
 ready=product['status']=='ready'
 complete=product['status'] in ('ready','files-ready')
 contents=''.join(f'<li>{e(x)}</li>' for x in product['components'])
 members=[next(p for p in products if p['id']==pid) for pid in product['included_product_ids']]
 member_html=('<h2>Topic packages in the planned collection.</h2><ul>'+''.join(f'<li><a href="{product_route(p)}">{e(p["title"])}</a></li>' for p in members)+'</ul>') if members else ''
 if not members:
  member_html=('<h2>Topic packages, brought together.</h2><p>The collection is being planned around major household preparation needs. Its final topic list will be published here when the packages are ready.</p>' if product['kind']=='collection' else '<h2>Put the guidance into practice.</h2><p>Use the topic guide and planning materials to prepare your household before you need them.</p>')
 availability=('Edition '+e(product['edition'])+' · One-time purchase' if ready else ('Edition '+e(product['edition'])+' · Files complete. Checkout and pricing will be confirmed before sales open.' if complete else 'Exact contents, price and edition will be confirmed before launch. No preorders are being taken.'))
 related=''.join(f'<a href="{route(g)}">{e(g["title"])}</a>' for g in GUIDES if g['slug'] in product['guide_slugs'])
 related_html=f'<section class="wrap toolkit-details"><div><h2>Read the free guidance.</h2><div class="related-links">{related}</div></div></section>' if related else ''
 page(product_route(product),product['title'],product['summary'],f'''<main id="main" class="subpage toolkit-page"><nav class="wrap guide-breadcrumb" aria-label="Breadcrumb"><a href="/toolkits/">Preparation toolkits</a><span>/</span><span>{e(product['title'])}</span></nav><section class="wrap toolkit-product"><div class="toolkit-product-copy"><p class="kicker">OSPREY ZERO / {'COLLECTION' if product['kind']=='collection' else 'TOPIC TOOLKIT'}</p><h1>{e(product['title'])}</h1><p>{e(product['summary'])}</p>{purchase_control(product)}<p class="toolkit-edition">{availability}</p><div class="toolkit-product-actions"><a class="button button-outline" href="/library/">Read the free guides</a><a class="text-link" href="/toolkits/">Explore all toolkits</a></div></div><div class="toolkit-inclusions"><p class="kicker">{'INCLUDED' if complete else 'PLANNED CONTENTS'}</p><h2>A plan you can use.</h2><ul>{contents}</ul></div></section><section class="wrap toolkit-details"><div>{member_html}<p>Free emergency guidance stays available online without signup.</p></div><div><h2>{'Delivery and access.' if ready else 'Designed to keep.'}</h2><p>{'Payhip handles payment and download access. Your receipt includes a link for returning to your files. Household worksheets are filled in on your own device; personal plans are not submitted to Osprey Zero.' if ready else 'Topic kits combine printable reference pages with practical worksheets and an Excel calculator. Completed editions are organized into A4, US Letter and digital folders. Payhip checkout and delivery must be verified before sales open. The full Household Planner is a separate product.'}</p></div></section>{related_html}</main>''')

# Legacy entry points explain the retirement without offering any old files.
page('/offline/','The offline library has retired','The free offline reader has retired. Read Osprey Zero guides online or explore upcoming preparation toolkits.','''<main id="main" class="subpage"><section class="wrap library-heading retired-notice"><p class="kicker">OSPREY ZERO</p><h1>The offline library<br>has retired.</h1><p>Our emergency guides remain free to read online. Printable guides and planning tools are being developed as preparation toolkits.</p><div class="toolkit-product-actions"><a class="button button-primary" href="/library/">Read the free guides</a><a class="button button-outline" href="/toolkits/">Explore the toolkits</a></div></section></main>''')
p=ROOT/'offline/index.html';p.write_text(p.read_text().replace('</head>','<meta name="robots" content="noindex,follow"></head>'))
page('/retired-downloads.html','This download has retired','The former free download has retired. Osprey Zero guides remain free to read online.','''<main id="main" class="subpage"><section class="wrap library-heading retired-notice"><p class="kicker">OSPREY ZERO</p><h1>This download<br>has retired.</h1><p>The former free PDF and portable library downloads are no longer available. Our online emergency guides remain free to read.</p><div class="toolkit-product-actions"><a class="button button-primary" href="/library/">Read the free guides</a><a class="button button-outline" href="/toolkits/">Explore the toolkits</a></div></section></main>''',noindex=True)
page('/blackout-checklist-confirmed.html','Power outage guidance','Read Osprey Zero power outage guidance online and explore upcoming preparation toolkits.','''<main id="main" class="subpage"><section class="wrap library-heading retired-notice"><p class="kicker">OSPREY ZERO</p><h1>Power outage<br>guidance.</h1><p>The former free checklist download has retired. The power outage guide remains free to read online.</p><div class="toolkit-product-actions"><a class="button button-primary" href="/emergencies/power-outage/">Read the power outage guide</a><a class="button button-outline" href="/toolkits/">Explore the toolkits</a></div></section></main>''',noindex=True)
p=ROOT/'index.html';s=p.read_text();s=re.sub(r'<section class="section wrap access-section[^\"]*".*?</section>',homepage_section(CATALOG),s,flags=re.S);p.write_text(s)

page('/planner/','Household Planner','Manage household readiness in the Osprey Zero Household Planner: supplies, contacts, budgets, maintenance and printable plans.','''<main id="main" class="subpage"><section class="wrap toolkit-heading"><p class="kicker">OSPREY ZERO / SEPARATE DIGITAL PRODUCT</p><h1>Your household.<br><em>One clear plan.</em></h1><p>A practical dashboard for supplies, contacts, household needs, tasks and readiness. The Household Planner is a separate product, with web access for customers who have the purchased app file.</p><a class="button button-primary" href="/planner/app/">Open the web planner</a><p class="toolkit-purchase-note">Already have the app? Import your original purchased HTML file. New purchases open when checkout and delivery are verified.</p></section><section class="wrap toolkit-grid"><article class="toolkit-card"><h2>See what needs attention.</h2><p>Keep household needs, water and food reserves, inventory, budget and tasks together. Use the dashboard to spot gaps and plan practical improvements.</p></article><article class="toolkit-card"><h2>Prepare the people.</h2><p>Organize contacts, care needs, transport, meeting points and useful household information. Generate printable plans and cards from the app.</p></article><article class="toolkit-card"><h2>Keep your own records.</h2><p>Your imported app and household records are kept in this browser. This version has no account or cloud sync. Export editable backups regularly; clearing browser storage can delete local copies.</p></article><article class="toolkit-card"><h2>Use it on mobile.</h2><p>Open the launcher in Safari on iPhone or a supported browser on Android. You can add it to your home screen and import your app there. Test offline access before relying on it during an outage.</p></article></section><section class="wrap toolkit-details"><div><h2>Start in three steps.</h2><ol><li>Open the web planner on the device you will use.</li><li>Import the original purchased C01-Household-Planner.html file. Verification happens on your device.</li><li>Set up the household, add your supplies and save an editable backup.</li></ol></div><div><h2>Works alongside the kits.</h2><p>The four topic kits include simpler Excel calculators. The full dashboard app is a separate product; it is not included in those kits.</p><a href="/toolkits/">Explore the preparation toolkits</a><p>The launcher supplies no paid app file and uploads no imported file. Keep sensitive information out of shared devices and open radio messages.</p></div></section></main>''')
# Unify retained pages as well as the shell for the next build.
for p in [ROOT/'templates/shell.html',*[ROOT/x for x in ('index.html','about/index.html','privacy/index.html','thanks/index.html','404.html')]]:
 s=p.read_text().replace('<a href="/resources/">Sources</a>','<a href="/planner/">Planner</a>')
 p.write_text(s)
