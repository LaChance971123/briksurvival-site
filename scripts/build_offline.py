"""Create a scoped offline reader and portable editorial PDF packs."""
import json,zipfile
from pathlib import Path
from html import escape as e
from pypdf import PdfReader,PdfWriter
from document_design import build,para,panel,Spacer,PageBreak
R=Path(__file__).resolve().parents[1]
G=sorted([json.loads(p.read_text()) for p in (R/'content/guides').glob('*.json')],key=lambda x:x['title'])
S=json.loads((R/'content/sources.json').read_text())
def route(g):return '/'+('preparedness' if g['content_type']=='Preparedness guide' else 'guides' if g['content_type']=='Field guide' else 'emergencies')+'/'+g['slug']+'/'
for g in G:g['url']=route(g);g['references']=S[g['sources']]
(R/'offline').mkdir(exist_ok=True)
(R/'offline/guides.json').write_text(json.dumps({'version':'2026-10-02.1','updated':'2026-10-02','guides':G},separators=(',',':')))
packs={'power-water':('Power & water',['power-outage','long-blackout','generator-safety','food-safety-outage','water-outage','water-storage','boil-water-advisory','sewer-failure']), 'household':('Household readiness',['household-emergency-plan','72-hour-kit','go-bag','budget-preparedness','infant-child-preparedness','medication-continuity','accessible-evacuation','pet-evacuation']), 'first-aid':('First aid',['cpr','aed','severe-bleeding','choking','infant-choking','child-infant-cpr','stroke','heart-attack','anaphylaxis','burns','seizures','opioid-overdose'])}
for key,(title,slugs) in packs.items():
 cover=R/'downloads'/f'{key}-cover.pdf';story=[para('OSPREY ZERO / OFFLINE COLLECTION','label'),para(title+'.','title'),panel('SAVE BEFORE SERVICE FAILS','A practical collection of complete guides and private planning worksheets. No signup required. This saved edition cannot provide current alerts.'),Spacer(1,18),para('Inside the collection.','h2')]
 for slug in slugs:
  g=next(x for x in G if x['slug']==slug);story+=[para(g['title'],'h3'),para(g['tldr'],'small')]
 story+=[para('Edition 2026-10-02. First-aid content is source-linked editorial guidance, not independent clinical certification. Seek current training and qualified help when reachable and safe.','small')];build(cover,title,'offline collection',story)
 w=PdfWriter();w.append(cover)
 for slug in slugs:
  g=next(x for x in G if x['slug']==slug);w.append(R/'downloads'/f'{slug}-field-guide.pdf',outline_item=g['title'])
 with (R/'downloads'/f'{key}-offline-pack.pdf').open('wb') as f:w.write(f)
 cover.unlink()
# Standalone portable HTML uses relative links and no ad/network dependencies.
css='body{font:17px/1.65 Arial,sans-serif;background:#0B0D0F;color:#f2eee6;max-width:850px;margin:40px auto;padding:0 24px}h1,h2,h3{line-height:1.15}a{color:#f2eee6}header{border-bottom:3px solid #F05A2A;padding:15px 0}section{padding:22px 0;border-bottom:1px solid #35393d}.quick{background:#D7D1C4;color:#0B0D0F;padding:24px}small{color:#a7aba9}'
with zipfile.ZipFile(R/'downloads/osprey-zero-offline-library.zip','w',zipfile.ZIP_DEFLATED) as z:
 fontcss=''
 for name,weight,file in [('DM Sans',400,'DMSans-400'),('Space Grotesk',700,'SpaceGrotesk-700'),('IBM Plex Mono',400,'IBMPlexMono-400')]:
  z.write(R/'Assets/fonts'/f'{file}.woff2',f'fonts/{file}.woff2');fontcss+=f'@font-face{{font-family:"{name}";font-weight:{weight};src:url("fonts/{file}.woff2")}}'
 css=fontcss+css+'@media print{body{background:white;color:#0B0D0F}a{color:#0B0D0F}.quick{break-inside:avoid}}body{font-family:"DM Sans",Arial,sans-serif}h1,h2,h3{font-family:"Space Grotesk",sans-serif}small{font-family:"IBM Plex Mono",monospace}'
 def doc(title,body):return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(title)+' | Osprey Zero</title><style>'+css+'</style><header>OSPREY ZERO / Skill beats panic. Every time.</header><main>'+body+'</main></html>'
 z.writestr('START-HERE.html',doc('Offline library','<h1>Knowledge without a connection.</h1><p>Edition 2026-10-02. Extract this entire folder and open START-HERE.html. External references need a connection. Emergency numbers and local conditions differ; source-linked guidance is not expert certification.</p><p>'+str(len(G))+' complete guides.</p><ul>'+''.join(f'<li><a href="{g["slug"]}.html">{e(g["title"])}</a></li>' for g in G)+'</ul>'))
 for g in G:
  body=f'<p><a href="START-HERE.html">All guides</a></p><h1>{e(g["title"])}</h1><section class="quick"><h2>Quick answer</h2><p>{e(g["tldr"])}</p></section><p>Print this saved guide from your browser. PDF packs and individual checklists can be downloaded separately from the live site before an outage.</p><section><h2>Do now</h2>'+''.join(f'<h3>{n}. {e(h)}</h3><p>{e(p)}</p>' for n,(h,p) in enumerate(g['steps'],1))+'</section>'
  for title,key in [('If help is unavailable','without_help'),('People & practical needs','household'),('Keep essentials within reach','pack_now'),('Next steps','next'),('Watch for','watch')]:body+=f'<section><h2>{title}</h2><p>{e(g[key])}</p></section>'
  for key in ['decisions','faqs']:body+='<section>'+''.join(f'<h3>{e(h)}</h3><p>{e(p)}</p>' for h,p in g.get(key,[]))+'</section>'
  body+='<section><h2>Sources & context</h2><p>'+e(g['scope'])+'</p><p>Source-linked editorial guidance; not independent clinical or specialist certification.</p>'+''.join(f'<p><a href="{e(url,quote=True)}">{e(label)}</a></p>' for label,url in g['references'])+f'<small>Content updated {g["updated"]}. Source checked {g["source_checked"]}.</small></section>'
  z.writestr(g['slug']+'.html',doc(g['title'],body))

import shutil
shutil.copy2(R/'downloads/long-blackout-checklist.pdf',R/'downloads/blackout-checklist.pdf')
print('Built scoped reader data, 3 PDF packs and the portable offline library.')
