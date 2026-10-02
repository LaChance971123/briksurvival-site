#!/usr/bin/env python3
"""Compile structured editorial content to static pages, PDFs and a search index."""
import json,re,hashlib
from pathlib import Path
from html import escape as e
from guide_diagrams import diagram
from collections import defaultdict
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab import rl_config
rl_config.invariant = True
ROOT=Path(__file__).resolve().parents[1]
from document_design import make_document
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
def page(path,title,desc,main):
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
 write(path.strip('/')+'/index.html',html)

def pdf(g,shopping=False):
 return make_document(g,SOURCES[g['sources']],route(g),'shopping' if shopping else 'checklist')

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
 fullpdf=make_document(g,SOURCES[g['sources']],route(g),'guide')
 checklist=pdf(g);resources=f'<a class="resource-button" href="{checklist}" download>Download checklist <small>PDF · Osprey Zero</small></a>'
 resources+=f'<a class="resource-button" href="{fullpdf}" download>Download full guide <small>PDF · All sections & planning sheet</small></a><a class="resource-button" href="/offline/">Save the offline library <small>Guides · Browser-local access</small></a>'
 INDEX.append(dict(title=g['title']+' full guide PDF',url=fullpdf,category=cat['title'],category_id=cat['id'],subcategory=g['subcategory'],content_type='Full guide PDF',aliases=[],summary='Complete branded field guide and household planning sheets for '+g['title']+'.',text=g['tldr'],priority=0))
 INDEX.append(dict(title=g['title']+' checklist',url=checklist,category=cat['title'],category_id=cat['id'],subcategory=g['subcategory'],content_type='Checklist',aliases=[],summary='Printable action checklist for '+g['title']+'.',text=g['tldr'],priority=0))
 if g.get('shopping'):
  shopping=pdf(g,True);resources+=f'<a class="resource-button" href="{shopping}" download>Download shopping list <small>PDF · Osprey Zero</small></a>'
  INDEX.append(dict(title=g['title']+' shopping list',url=shopping,category=cat['title'],category_id=cat['id'],subcategory=g['subcategory'],content_type='Shopping list',aliases=[],summary='Household supply list for '+g['title']+'.',text=' '.join(g['shopping']),priority=0))
 for k in resource_keys(g):
  r=MANUALS[k];resources+=f'<a class="resource-button" href="{e(r["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{e(r["title"])}<small>Published reference · external</small></a>'
 label,source=SOURCES[g['sources']][0];resources+=f'<a class="resource-button resource-official" href="{e(source,quote=True)}" target="_blank" rel="noopener noreferrer">Trusted reference <small>{e(label)}</small></a>'
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
 }.get(g['slug'],['emergency-alerts','72-hour-kit','evacuation'])
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
 <section class="guide-resources" aria-label="Downloads and trusted resources"><h2>Save the essentials.</h2><div class="resource-grid">{resources}</div><p class="resource-note">Free downloads. No signup. Branded guides, checklists and supply worksheets. Save a copy before service fails; external references need a connection.</p></section>
 <div class="guide-meta"><span>UPDATED {g['updated']}</span><button type="button" class="print-link" data-print>Print full guide</button></div>
 <div class="guide-alert"><span>!</span><p>Act on immediate danger. Seek qualified help when reachable and safe, but do not make your first protective step depend on a response. This page is general guidance, not a live alert.</p></div>
 <nav class="guide-jumps" aria-label="Skip to a section"><a href="#do-now">Do now</a><a href="#without-help">Without help</a><a href="#household">Family plan</a><a href="#next">Next</a><a href="#watch">Watch for</a><a href="#sources">Sources</a></nav>
 <section class="guide-section" id="do-now"><h2>Do now.</h2><ol class="action-list">{steps}</ol></section>
 {diagram(g.get('diagram'))}
 <section class="guide-section no-help-panel" id="without-help"><p class="kicker">PLAN AROUND WHAT YOU HAVE</p><h2>If help is unavailable.</h2><p>{e(g['without_help'])}</p></section>
 <section class="guide-section" id="household"><h2>People & practical needs.</h2><p>{e(g['household'])}</p><details class="pack-details"><summary>Keep essentials within reach</summary><p>{e(g['pack_now'])}</p></details></section>
 <section class="guide-section" id="next"><h2>Next steps.</h2><p>{e(g['next'])}</p><div class="decision-grid">{decisions}</div></section>
 <section class="guide-section"><h2>Questions in the field.</h2>{faqs}</section>
 <section class="guide-section guide-caution" id="watch"><h2>Watch for.</h2><p>{e(g['watch'])}</p></section>
 <section class="guide-section guide-sources" id="sources"><h2>Sources & context.</h2><p>Osprey Zero combines source-based protective guidance with practical household planning. References provide context, not a promise of assistance. Some standards are U.S.-based; local risks, laws and services differ.</p><ul>{sources}</ul><p>Updated {g['updated']}. {'First-aid summaries support immediate response and training; they have not received independent clinical review.' if g['category']=='medical' else 'Editorially reviewed against linked references; not independently certified by a subject-matter expert. Verify changing conditions through sources safe for you to contact.'}</p></section></div>
 <aside class="guide-rail" aria-label="Guide contents"><div class="rail-panel"><span>FIND IT FAST</span><a href="#quick-answer">Quick answer</a><a href="#do-now">Do now</a><a href="#without-help">If help is unavailable</a><a href="#household">People & practical needs</a><a href="#next">Next steps</a><a href="#watch">Watch for</a><a href="#sources">Sources</a><a href="/search/">Search another situation</a></div></aside></article>
 <section class="wrap guide-end"><h2>Related guidance.</h2><div class="related-links">{links}</div></section></main>'''
 page(url,g['title'],g['tldr'],main)
 INDEX.append(dict(title=g['title'],url=url,category=cat['title'],category_id=cat['id'],subcategory=g['subcategory'],content_type=g['content_type'],aliases=g.get('aliases',[]),summary=g['tldr'],text=' '.join([g.get('deck',''),' '.join(h+' '+p for h,p in g.get('decisions',[])+g.get('faqs',[])),g['next'],g['watch'],g['without_help'],g['household'],*g.get('keywords',[]),*[h+' '+p for h,p in g['steps']]]),priority=10))

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
 main=f'<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">OSPREY ZERO ENCYCLOPEDIA</p><h1>{e(title)}</h1><p>Choose a subject or search a few words. Every guide starts with what matters now and includes a plan for when help is unavailable.</p>{searchform()}<div class="library-meta">{len(selected)} guides · Free checklists · No signup needed</div><div class="browse-tools"><a href="/topics/">All topics A–Z</a><a href="/search/?type=Checklist">Printable checklists</a><a href="/search/?type=Shopping%20list">Shopping lists</a></div><nav class="subcategory-chips" aria-label="Jump to a subcategory">{"".join(chips) if len({g["category"] for g in selected})==1 else ""}</nav></section><div class="wrap library-layout"><nav class="category-nav" aria-label="Browse categories"><h2>Browse by subject</h2>{nav}<a href="/library/">All subjects</a></nav><div>{groups}</div></div></main>'
 page(path,title,f'{title.rstrip(chr(46))}: '+', '.join(g['title'] for g in selected[:4])+f'. Browse {len(selected)} guides, practical checklists and references.',main)
browse('/library/','Find information. Fast.',GUIDES)
browse('/emergencies/','Emergency guides.',[g for g in GUIDES if g['content_type']=='Emergency guide'])
browse('/preparedness/','Prepare before you need it.',[g for g in GUIDES if g['content_type']=='Preparedness guide'])
browse('/guides/','Field guides & practical skills.',[g for g in GUIDES if g['content_type']=='Field guide'])
for c in CATS:browse('/library/'+c['id']+'/',c['title'],[g for g in GUIDES if g['category']==c['id']])
letters=sorted({g['title'][0].upper() for g in GUIDES})
aznav=''.join(f'<a href="#letter-{x}">{x}</a>' for x in letters)
az=''.join(f'<section class="az-section" id="letter-{x}"><h2>{x}</h2><ul>'+''.join(f'<li><a href="{route(g)}">{e(g["title"])}</a><span>{e(CAT[g["category"]]["title"])}</span></li>' for g in GUIDES if g['title'][0].upper()==x)+'</ul></section>' for x in letters)
page('/topics/','All topics A–Z','A complete alphabetical index of Osprey Zero guides.',f'<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">THE COMPLETE INDEX</p><h1>All topics A–Z.</h1><p>{len(GUIDES)} original guides. Find the title, open the quick answer, save the checklist.</p>{searchform()}<nav class="az-nav" aria-label="Jump to a letter">{aznav}</nav><a href="/library/">Browse by subject</a></section><div class="wrap az-list">{az}</div></main>')
# Replace the broad weather guide with a browse page, preserving the URL.
browse('/emergencies/severe-weather/','Weather: choose the specific hazard.',[g for g in GUIDES if g['category']=='natural-hazards' and g['subcategory'] in ['Severe storms','Tropical weather','Winter','Heat & dry conditions','Flooding']])
filters=''.join(f'<option value="{c["id"]}">{e(c["title"])}</option>' for c in CATS)
types=['Emergency guide','Preparedness guide','Field guide','Checklist','Shopping list','Full guide PDF','Published reference']
main=f'''<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">SEARCH THE ENCYCLOPEDIA</p><h1>What happened?</h1><p>Use a topic or a few words. Try “lights out”, “smell gas” or “water unsafe”.</p><form id="global-search-form" class="library-search" role="search"><label for="global-search">Search all guides and downloads</label><div><input id="global-search" name="q" type="search" autocomplete="off" aria-controls="search-results" placeholder="Find the next step"><button class="button button-primary">Search</button></div><div class="search-filters"><label for="search-category">Subject<select id="search-category"><option value="">All subjects</option>{filters}</select></label><label for="search-type">Resource type<select id="search-type"><option value="">All types</option>{''.join(f'<option>{x}</option>' for x in types)}</select></label><button type="button" id="search-reset">Clear filters</button></div></form><p id="search-status" role="status" aria-live="polite">Loading the library…</p><div id="search-results" class="search-results"></div><noscript><p>Search needs JavaScript. <a href="/library/">Browse all topics here</a>; guides and downloads work without JavaScript.</p></noscript></section></main>'''
page('/search/','Search','Search the entire Osprey Zero library by topic, common phrase or keyword.',main)
for k,r in MANUALS.items():
 INDEX.append(dict(title=r['title'],url=r['url'],category='Reference shelf',category_id='',subcategory='Published manuals',content_type='Published reference',aliases=[],summary=r['description'],text=r['description'],priority=0))
write('search-index.json',json.dumps(INDEX,separators=(',',':')))
# Source shelf includes published references and direct resource downloads.
refs=''.join(f'<article class="library-card"><h3>{e(r["title"])}</h3><p>{e(r["description"])}</p><a href="{e(r["url"],quote=True)}" target="_blank" rel="noopener noreferrer">Open published PDF</a></article>' for r in MANUALS.values())
page('/resources/','Reference shelf','Published manuals, official information and Osprey Zero downloads.',f'<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">REFERENCE SHELF</p><h1>Published knowledge.</h1><p>Original quick answers remain in the encyclopedia. These published references provide deeper context; check their date and follow current local guidance.</p><div class="library-grid">{refs}</div><h2>Checklists & shopping lists.</h2><p>Every guide includes its own printable action checklist. Supply-oriented guides also include shopping lists.</p><a class="button button-primary" href="/search/?type=Checklist">Find a checklist</a><a class="button" href="/search/?type=Shopping%20list">Find a shopping list</a><h2>Current official information.</h2><div class="related-links"><a href="https://www.weather.gov/">National Weather Service</a><a href="https://www.ready.gov/">Ready.gov</a><a href="https://www.cdc.gov/">CDC</a><a href="https://www.redcross.org/get-help.html">American Red Cross</a></div></section></main>')
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
paths=sorted({'/','/about/','/privacy/','/resources/','/library/','/topics/','/search/','/emergencies/','/preparedness/','/guides/','/emergencies/severe-weather/',*[route(g) for g in GUIDES],*['/library/'+c['id']+'/' for c in CATS]})
write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>https://ospreyzero.com{x}</loc><lastmod>2026-10-02</lastmod></url>' for x in paths)+'</urlset>')
print(f'Built {len(GUIDES)} guides, {len(CATS)} categories, {len(INDEX)} indexed resources.')
# The offline reader is intentionally ad-free and owns a separate worker scope.
page('/offline/','Save the offline library','Save 86 complete Osprey Zero guides in this browser or download refined PDF packs and a portable offline library.',f'''<main id="main" class="subpage"><section class="wrap library-heading"><p class="kicker">KNOWLEDGE WITHOUT A CONNECTION</p><h1>Keep the next step<br>within reach.</h1><p>Save the complete guide text and site fonts in this browser, or keep a portable copy on your device. Free access. No account. Saved content cannot provide live alerts.</p><div class="offline-actions"><button id="offline-save" class="button button-primary" type="button">Save for offline</button><button id="offline-remove" class="button button-outline" type="button">Remove saved reader</button><a class="button button-outline" href="/downloads/osprey-zero-offline-library.zip" download>Download portable library ZIP</a></div><p id="offline-status" role="status" aria-live="polite">Loading the library…</p><p>After saving, bookmark this page and test reopening it before relying on it. Browser storage can be cleared or evicted. PDF packs and an extracted ZIP are useful backups. The ZIP contains relative links and local fonts; open START-HERE.html after extracting the whole folder.</p><div class="pack-grid"><article class="pack-card"><p class="kicker">COLLECTION / 01</p><h2>Power & water.</h2><p>Eight complete guides for outages, safe backup power, food, drinking water and sanitation.</p><a href="/downloads/power-water-offline-pack.pdf" download>Download power & water PDF</a></article><article class="pack-card"><p class="kicker">COLLECTION / 02</p><h2>Household readiness.</h2><p>Eight guides for kits, budgets, children, medication, pets and access needs.</p><a href="/downloads/household-offline-pack.pdf" download>Download household PDF</a></article><article class="pack-card"><p class="kicker">COLLECTION / 03</p><h2>First aid.</h2><p>Twelve immediate-response summaries and planning sheets. Source-linked; not independently clinically reviewed.</p><a href="/downloads/first-aid-offline-pack.pdf" download>Download first-aid PDF</a></article></div><noscript><p>The browser reader requires JavaScript. Download a PDF pack or the portable ZIP for complete guidance without JavaScript.</p></noscript><div class="offline-reader"><div><label for="offline-query">Find a saved topic</label><input id="offline-query" type="search" placeholder="Topic or common phrase"><div id="offline-list" class="offline-list"></div></div><article id="offline-article" aria-label="Selected offline guide"><h2>Choose a guide.</h2><p>Read the complete guide here. External references need a connection. Personal worksheets are in the PDF downloads; the reader does not submit household notes.</p></article></div></section></main>''')
p=ROOT/'offline/index.html';p.write_text(p.read_text().replace('<script src="/app.js?v=oz7" defer></script>','').replace('<script src="/search.js?v=oz7" defer></script>','').replace('<script src="/ads.js?v=oz8" async></script>','').replace('</head>','<script src="/offline/reader.js" defer></script></head>'))
