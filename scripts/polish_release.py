"""Deterministic release polish for preserved and generated static pages."""
import json,re
from pathlib import Path
from html import escape as e
from lxml import html as dom
from PIL import Image,ImageDraw,ImageFont
from publication import public_pages
R=Path(__file__).resolve().parents[1]
G={g['slug']:g for g in [json.loads(p.read_text()) for p in (R/'content/guides').glob('*.json')]}
# Precise typographic share card; no photographic or generated factual imagery.
im=Image.new('RGB',(1200,630),'#0B0D0F');d=ImageDraw.Draw(im)
f=lambda name,size:ImageFont.truetype(str(R/'Assets/fonts'/name),size)
d.rectangle((60,65,140,69),fill='#F05A2A');d.text((60,100),'OSPREY',font=f('SpaceGrotesk-700.ttf',42),fill='#F2EEE6');d.text((241,100),'ZERO',font=f('SpaceGrotesk-700.ttf',42),fill='#F05A2A');d.text((60,235),'When systems fail,',font=f('SpaceGrotesk-700.ttf',75),fill='#F2EEE6');d.text((60,325),'skill remains.',font=f('SpaceGrotesk-700.ttf',75),fill='#D7D1C4');d.line((60,495,1140,495),fill='#35393D',width=2);d.text((60,530),'SKILL BEATS PANIC. EVERY TIME.',font=f('IBMPlexMono-400.ttf',21),fill='#D7D1C4');d.text((865,530),'OSPREYZERO.COM',font=f('IBMPlexMono-400.ttf',21),fill='#F05A2A');im.save(R/'Assets/oz-share.png',optimize=True)
for p in [R/'templates/shell.html',*[R/name for name in sorted(public_pages(R))]]:
 s=p.read_text();s=re.sub(r'\s*<link[^>]*(?:fonts.googleapis.com|fonts.gstatic.com)[^>]*>','',s)
 s=re.sub(r'/(styles.css|app.js|search.js)\?v=oz\d+',lambda m:'/'+m[1]+'?v=oz34',s)
 if p==R/'offline/index.html':
  s=re.sub(r'<script src="/ads.js[^"]*"[^>]*></script>','',s)
  if '/app.js?' not in s:s=s.replace('</head>','<script src="/app.js?v=oz34" defer></script></head>')
 if p==R/'404.html' and 'http-equiv="Content-Security-Policy"' not in s:
  policy=json.loads((R/'config/security-policy.json').read_text())['default']
  s=s.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+e(policy,quote=True)+'">')
 s=s.replace('https://monetag.com/privacy-policy/','https://monetag.com/privacy/')
 if 'class="mobile-search"' not in s:s=s.replace('<button class="menu-toggle"','<a class="mobile-search" href="/search/" aria-label="Search guides"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></a><button class="menu-toggle"')
 if 'apple-touch-icon' not in s:s=s.replace('</head>','<link rel="apple-touch-icon" href="/Assets/apple-touch-icon.png"></head>')
 if p==R/'index.html' and 'hero-urgent' not in s:
  m=re.search(r'<div class="finder-bar">.*?</div><span class="finder-count".*?</span></div>',s,re.S)
  if m:
   finder=m[0];s=s[:m.start()]+s[m.end():];s=s.replace('<div id="home-search-results" class="search-results" hidden></div>','');s=s.replace('<div class="hero-actions">',finder+'<div id="home-search-results" class="search-results" hidden></div><div class="hero-urgent" aria-label="Urgent situations"><a href="/emergencies/cpr/">Not breathing</a><a href="/emergencies/choking/">Choking</a><a href="/emergencies/gas-leak/">Smell gas</a><a href="/emergencies/home-fire/">Fire</a></div><noscript><p><a href="/emergencies/">Browse emergency guides</a>; search needs JavaScript.</p></noscript><div class="hero-actions">')
 # Accessible submission feedback, explicit purpose and privacy.
 for name in ['guide-early-access','field-notes-newsletter']:
  s=s.replace(f'action="/thanks/"',f'action="/thanks/"',1)
  s=s.replace(f'<form name="{name}"',f'<form data-signup="{name}" name="{name}"') if f'data-signup="{name}"' not in s else s
 s=s.replace('Guide release updates only. Unsubscribe any time.','Request guide release updates. <a href="/privacy/">Privacy & email details</a>.').replace('Only Osprey Zero email. Unsubscribe any time.','Request Osprey Zero Field Notes. <a href="/privacy/">Privacy & email details</a>.')
 if '<form ' in s and 'data-form-status' not in s:s=re.sub(r'(</form>)',r'<p class="form-status" data-form-status role="status" aria-live="polite"></p>\1',s)
 # Remove stale metadata before rebuilding it from the rendered content.
 s=re.sub(r'<meta (?:property="og:|name="twitter:)[^>]*>','',s)
 h=dom.fromstring(s);title=h.xpath('string(//title)');desc=h.xpath('//meta[@name="description"]/@content');canonical=h.xpath('//link[@rel="canonical"]/@href');url=canonical[0] if canonical else 'https://ospreyzero.com/404.html'
 metas=f'<meta property="og:type" content="{"article" if "guide-page" in s else "website"}"><meta property="og:title" content="{e(title,quote=True)}"><meta property="og:description" content="{e(desc[0] if desc else title,quote=True)}"><meta property="og:url" content="{url}"><meta property="og:image" content="https://ospreyzero.com/Assets/oz-share.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Osprey Zero — When systems fail, skill remains."><meta name="twitter:card" content="summary_large_image">'
 s=re.sub(r'<script type="application/ld\+json".*?</script>','',s,flags=re.S)
 slug=p.parent.name
 if slug in G:
  g=G[slug];s=re.sub(r'(?<!CONTENT )UPDATED '+re.escape(g['updated']),f'CONTENT UPDATED {g["updated"]}',s);s=s.replace(f'Updated {g["updated"]}. ',f'<span class="review-context">Content updated {g["updated"]}. Sources checked {g["source_checked"]}. Next editorial review due {g["next_review"]}.</span> ')
  if '<h2>Sources & context.</h2><p>'+e(g['scope'])+'</p>' not in s:s=s.replace('<h2>Sources & context.</h2>','<h2>Sources & context.</h2><p>'+e(g['scope'])+'</p>')
  schema={'@context':'https://schema.org','@type':'Article','headline':g['title'],'description':g['tldr'],'url':url,'image':'https://ospreyzero.com/Assets/oz-share.png','datePublished':g['published'],'dateModified':g['updated'],'author':{'@type':'Organization','name':'Osprey Zero'},'publisher':{'@type':'Organization','name':'Osprey Zero','url':'https://ospreyzero.com/'},'citation':[u for _,u in json.loads((R/'content/sources.json').read_text())[g['sources']]]}
 elif p==R/'index.html':schema={'@context':'https://schema.org','@type':'WebSite','name':'Osprey Zero','url':'https://ospreyzero.com/','description':desc[0] if desc else title}
 else:schema={'@context':'https://schema.org','@type':'CollectionPage' if p.parent.name in ['library','topics','resources'] else 'WebPage','name':title,'url':url}
 s=s.replace('</head>',metas+'<script type="application/ld+json">'+json.dumps(schema).replace('</','<\\/')+'</script></head>')
 p.write_text("\n".join(line.rstrip() for line in s.splitlines())+"\n")
# Aliases appear in A-Z without hiding the canonical titles.
p=R/'topics/index.html';s=p.read_text();aliases=sorted({(a,g['title'],g['slug'],g['content_type']) for g in G.values() for a in g['aliases']},key=lambda x:(x[0].casefold(),x[1].casefold(),x[2],x[3],x[0]))
if 'id="common-phrases"' not in s:s=s.replace('</main>','<section class="wrap az-list" id="common-phrases"><h2>Common phrases & alternate names.</h2><p>These aliases open the same full guide as the main title.</p><ul>'+''.join(f'<li><a href="/{"preparedness" if t=="Preparedness guide" else "guides" if t=="Field guide" else "emergencies"}/{slug}/">{e(a)}</a><span>{e(title)}</span></li>' for a,title,slug,t in aliases)+'</ul></section></main>');p.write_text(s)
manifest={'name':'Osprey Zero','short_name':'Osprey Zero','id':'/','start_url':'/','scope':'/','display':'browser','background_color':'#0B0D0F','theme_color':'#0B0D0F','icons':[{'src':'/Assets/favicon-192x192.png','sizes':'192x192','type':'image/png'},{'src':'/Assets/android-chrome-512x512.png','sizes':'512x512','type':'image/png'}]};(R/'Assets/site.webmanifest').write_text(json.dumps(manifest))
print('Polished local typography, mobile entry, metadata, aliases, review context and signup feedback.')
