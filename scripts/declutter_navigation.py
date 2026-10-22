"""Apply a consistent, progressively disclosed navigation after page generation."""
from pathlib import Path
from html import escape as e
import re,json,hashlib
from publication import public_pages
R=Path(__file__).resolve().parents[1]
version=hashlib.sha256((R/'Assets/navigation.css').read_bytes()).hexdigest()[:12]
nav_items=[('/emergencies/','Emergencies'),('/preparedness/','Prepare'),('/library/','Library'),('/briefing/','Daily Brief')]
footer='''<footer class="site-footer calm-footer"><div class="wrap calm-footer-top"><div><a class="brand" href="/" aria-label="Osprey Zero home"><img src="/Assets/oz-mark.webp" alt="" width="52" height="52"><span>OSPREY <strong>ZERO</strong></span></a><p>Skill beats panic. Every time.</p></div><nav aria-label="Useful links"><a href="/about/">About</a><a href="/reading-list/">Saved guides</a><a href="/contact/">Contact & corrections</a><a href="/privacy/">Privacy</a></nav><details class="footer-more"><summary>Tools & more</summary><nav aria-label="Tools and other resources"><a href="/toolkits/">Preparation toolkits</a><a href="/planner/">Household planner</a><a href="/planner/app/">Planner customer access</a><a href="/topics/">All guides A–Z</a><a href="/resources/">Reference shelf</a><a href="/guides/">Field skills</a><a href="https://clipjar.io/" target="_blank" rel="noopener noreferrer">ClipJar ↗</a><a href="https://www.tiktok.com/@osprey_zero" target="_blank" rel="noopener noreferrer">TikTok ↗</a><a href="https://www.instagram.com/ospreyzero/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.youtube.com/@OspreyZero" target="_blank" rel="noopener noreferrer">YouTube ↗</a></nav></details></div><div class="wrap footer-bottom"><span>© <span id="year"></span> Osprey Zero</span><span>Free knowledge. Clear first steps.</span></div></footer>'''
for name in sorted(public_pages(R)):
 if name.startswith('planner/app/'):continue
 p=R/name;s=p.read_text()
 section='/'+name.split('/')[0]+'/'
 if section in ['/guides/','/topics/','/resources/']:section='/library/'
 nav='<nav id="primary-nav" class="primary-nav" aria-label="Primary navigation">'+''.join(f'<a href="{u}"'+(' aria-current="page"' if u==section else '')+f'>{label}</a>' for u,label in nav_items)+'<a class="nav-search" href="/search/" aria-label="Search guides"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>Search</span></a></nav>'
 s=re.sub(r'<nav id="primary-nav".*?</nav>',lambda _:nav,s,flags=re.S)
 # Remove duplicate utility strapline; the homepage and footer retain the slogan.
 s=re.sub(r'<div class="utility-line">.*?</div></div>\s*','',s,flags=re.S)
 s=re.sub(r'<footer class="site-footer[^"]*".*?</footer>',lambda _:footer,s,flags=re.S)
 s=s.replace('>Encyclopedia</a>','>Library</a>')
 s=re.sub(r'<link rel="stylesheet" href="/(?:Assets/)?navigation.css[^\"]*">','',s)
 s=s.replace('</head>',f'<link rel="stylesheet" href="/Assets/navigation.css?v={version}"></head>')
 if name.startswith(('library/','emergencies/','preparedness/','guides/')) and 'class="wrap library-heading"' in s:
  s=re.sub(r'<nav class="browse-modes".*?</nav>','',s,flags=re.S)
  s=re.sub(r'<div class="browse-tools">.*?</div>','<div class="browse-tools"><a href="/topics/">All guides A–Z</a><a href="/reading-list/">Saved guides</a></div>',s,flags=re.S)
  s=re.sub(r'<details class="wrap learning-directory">.*?</details>','',s,flags=re.S)
  if name!='library/index.html':
   s=s.replace('<section class="wrap library-heading">','<section class="wrap library-heading"><nav class="browse-breadcrumb" aria-label="Breadcrumb"><a href="/library/">Library</a><span aria-hidden="true">/</span><span>'+('Prepare' if name=='preparedness/index.html' else 'Emergencies' if name=='emergencies/index.html' else 'Browse guides')+'</span></nav>')
 if name=='about/index.html':
  s=s.replace('Join Field Notes if you would like updates; email signup never unlocks emergency information.','Follow Osprey Zero for updates. Free guides never require signup.')
  s=s.replace('href="/#newsletter">Join Field Notes →','href="https://www.tiktok.com/@osprey_zero" target="_blank" rel="noopener noreferrer">Follow Osprey Zero ↗')
 p.write_text(s)
# Library: seven broad groups; all fourteen existing subject URLs remain accessible.
p=R/'library/index.html';s=p.read_text();taxonomy=json.loads((R/'content/taxonomy.json').read_text());cats={c['id']:c for c in taxonomy}
guides=[json.loads(p.read_text()) for p in (R/'content/guides').glob('*.json')]
groups=[('Weather & disasters','Storms, floods, fire and environmental hazards',['natural-hazards','chemical-radiation']),('Health & first aid','Immediate response and public health',['medical','public-health']),('Home & essential services','Your building, power, water and sanitation',['home-building','utilities']),('Leaving, shelter & recovery','Evacuation, travel and returning home',['evacuation-shelter','vehicle-travel','recovery']),('Household preparedness','Plans, supplies and everyday readiness',['preparedness']),('Communication & civilian safety','Staying informed and navigating disruption',['communications','conflict']),('Outdoor skills & equipment','Field skills, tools and responsible equipment use',['field-skills','firearms-tools'])]
blocks=''
for title,desc,ids in groups:
 links=''.join(f'<a href="/library/{id}/"><span>{e(cats[id]["title"])}</span><small>{sum(g["category"]==id for g in guides)} guides <span aria-hidden="true">→</span></small></a>' for id in ids)
 blocks+=f'<details class="subject-family"><summary><span><strong>{e(title)}</strong><small>{e(desc)}</small></span><span class="family-plus" aria-hidden="true">+</span></summary><div class="family-links">{links}</div></details>'
s=s.replace('class="subpage"','class="subpage calm-library"',1)
s=s.replace('Find information. Fast.','Explore the library.')
s=re.sub(r'<details class="subject-menu">.*?</details>','',s,flags=re.S)
s=re.sub(r'<div class="subject-grid">.*?</div>',lambda _:'<div class="subject-families">'+blocks+'</div>',s,flags=re.S)
s=s.replace('Choose a subject or search a few words. Every guide starts with what matters now and includes a plan for when help is unavailable.','Search a few words, or open a subject below. Every guide starts with a quick answer.')
p.write_text(s)
print('Applied four primary destinations, compact footer and seven subject groups.')
