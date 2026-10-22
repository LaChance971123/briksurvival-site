"""Task-focused presentation pass. Preserve guide content, URLs and brand styling."""
from pathlib import Path
import json, re, hashlib
from lxml import html as H, etree as E
from publication import public_pages
R=Path(__file__).resolve().parents[1]
CATS={c['id']:c for c in json.loads((R/'content/taxonomy.json').read_text())}
GUIDES={g['slug']:g for g in (json.loads(p.read_text()) for p in (R/'content/guides').glob('*.json'))}
TITLES={'search/index.html':'Search Osprey Zero','topics/index.html':'All guides A–Z','reading-list/index.html':'Saved guides','resources/index.html':'Sources & references','contact/index.html':'Contact & corrections','preparedness/index.html':'Prepare your household','guides/index.html':'Outdoor & practical skills','emergencies/severe-weather/index.html':'Severe weather guides'}
LABELS=json.loads((R/'config/ux-labels.json').read_text())
NEXT={'household-emergency-plan':('Check what you already own','preparedness-inventory'),'preparedness-inventory':('Cover the essentials','budget-preparedness'),'budget-preparedness':('Practise and maintain','preparedness-maintenance'),'preparedness-maintenance':('Revisit your household plan','household-emergency-plan')}
def node(s):return H.fragment_fromstring(s)
def remove(n):n.getparent().remove(n)
def route(g):return '/'+{'Preparedness guide':'preparedness','Field guide':'guides'}.get(g['content_type'],'emergencies')+'/'+g['slug']+'/'
def addlink(parent,url,label):
 a=E.SubElement(parent,'a',href=url);a.text=label;return a
for name in sorted(public_pages(R)):
 if name.startswith('planner/app/'):continue
 p=R/name;d=H.document_fromstring(p.read_text());main=d.xpath('//main')[0]
 for el in d.xpath('//text()[contains(.,"reading list") or contains(.,"All topics A–Z")]'):
  text=str(el).replace('My reading list','Saved guides').replace('Your reading list','Saved guides').replace('Save to reading list','Save guide').replace('All topics A–Z','All guides A–Z')
  if el.is_tail:el.getparent().tail=text
  else:el.getparent().text=text
 if name in TITLES:
  title=TITLES[name];h=d.xpath('//h1')[0];h.clear();h.text=title
  d.xpath('//title')[0].text=title+' — Osprey Zero'
  for m in d.xpath('//meta[@property="og:title"]'):m.set('content',title+' — Osprey Zero')
 # Current section and current page are different navigation states.
 for a in d.xpath('//nav[@id="primary-nav"]/a[@aria-current]'):
  a.set('aria-current','page' if a.get('href')=='/'+name.removesuffix('index.html') else 'location')
 # Remove the parallel whole-library menu; subject chips retain local destinations.
 for menu in d.xpath('//details[@class="subject-menu"]'):remove(menu)
 for layout in d.xpath('//div[@class="wrap library-layout"]'):layout.set('class','wrap library-layout focused-browse')
 for crumb in d.xpath('//nav[@class="browse-breadcrumb"]'):remove(crumb)
 heading=d.xpath('//section[@class="wrap library-heading"]')
 if heading and name.startswith(('library/','preparedness/','emergencies/','guides/')):
  crumb=node('<nav class="browse-breadcrumb" aria-label="Breadcrumb"></nav>');addlink(crumb,'/','Home')
  if name.startswith('library/') and name!='library/index.html':addlink(crumb,'/library/','Library')
  if name=='emergencies/severe-weather/index.html':addlink(crumb,'/emergencies/','Emergencies')
  label=E.SubElement(crumb,'span',{'aria-current':'page'});label.text=d.xpath('//h1')[0].text_content().strip().rstrip('.')
  heading[0].insert(0,crumb)
  if name.startswith('library/') and name!='library/index.html':
   tools=heading[0].xpath('.//div[@class="browse-tools"]')
   if tools:addlink(tools[0],'/library/','All subjects')
 if name=='emergencies/index.html':
  intro=heading[0].xpath('./p[not(@class)]')[0];intro.text='Find your situation, then open the guide for clear first steps.'
  choices=node('<section class="wrap situation-entry" aria-labelledby="situation-title"><h2 id="situation-title">What is happening?</h2><p>Choose a situation, or browse the full emergency collection below.</p><div class="situation-links"></div></section>')
  grid=choices.xpath('.//div')[0]
  for label,url in [('First aid: choose an age and situation','/library/medical/'),('Fire in a home','/emergencies/home-fire/'),('Smell gas','/emergencies/gas-leak/'),('No electricity','/emergencies/power-outage/'),('Water is unsafe or unavailable','/emergencies/water-disruption/'),('Severe weather','/emergencies/severe-weather/'),('Need to leave','/emergencies/evacuation/'),('Civilian safety during conflict','/library/conflict/')]:addlink(grid,url,label)
  heading[0].addnext(choices)
 if name=='preparedness/index.html':
  for h in d.xpath('//*[@id="learning-title"]'):h.text='Choose a specific preparation goal.'
  for summary in d.xpath('//details[@class="prepare-more"]/summary'):summary.text='Choose a specific preparation goal'
  layout=d.xpath('//div[contains(@class,"focused-browse")]')[0]
  wrapper=node('<details class="wrap preparation-directory"><summary>Browse all preparation guides</summary></details>');layout.addprevious(wrapper);wrapper.append(layout);layout.set('class','focused-browse')
 if name=='search/index.html':
  for filters in d.xpath('//div[@class="search-filters"]'):
   disclosure=node('<details class="search-options"><summary>Filter by subject or resource type</summary></details>');filters.addprevious(disclosure);disclosure.append(filters)
 if name=='topics/index.html':
  for section in d.xpath('//*[@id="common-phrases" and self::section]'):
   details=node('<details class="wrap alternate-names" id="common-phrases"><summary>Other names people use</summary></details>')
   for child in list(section):
    if child.tag!='h2':details.append(child)
   section.getparent().replace(section,details)
 slug=Path(name).parent.name
 if slug in GUIDES and '/'+name.removesuffix('index.html')==route(GUIDES[slug]):
  resources=d.xpath('//section[@class="guide-resources"]')[0]
  resources.set('class','guide-resources compact-references')
  for note in resources.xpath('./p[@class="resource-note"]'):note.text='External references · Internet connection required'
  for a in resources.xpath('.//a[@class="resource-button resource-official"]'):
   small=a.find('small')
   if small is not None:a.text=small.text;remove(small)
  # Keep cautions before action. Move secondary metadata and tools after actions.
  action=d.xpath('//*[@id="do-now"]')[0]
  for selector in ['//div[@class="guide-actions"]','//div[@class="guide-meta"]']:
   el=d.xpath(selector)[0];remove(el);action.addnext(el)
  rail=d.xpath('//nav[@class="rail-panel"]')[0]
  links=rail.xpath('./a')
  if len(links)>12:
   more=node('<details class="rail-more"><summary>Full contents</summary></details>')
   primary={'#quick-answer','#do-now','#without-help','#next','#sources'}
   for a in links:
    if a.get('href') not in primary:remove(a);more.append(a)
   rail.append(more)
  sources=d.xpath('//*[@id="sources"]')[0]
  addlink(sources,'/contact/?guide='+route(GUIDES[slug]),'Suggest a correction to this guide')
  if slug in NEXT:
   label,nxt=NEXT[slug];block=node('<nav class="wrap next-in-path" aria-label="Next in preparation path"><p class="kicker">YOUR HOUSEHOLD PREPARATION PATH</p></nav>');addlink(block,'/preparedness/'+nxt+'/',label+' →');main.append(block)
  # Free next guidance comes before optional unavailable product information.
  for promo in d.xpath('//section[contains(@class,"guide-toolkit")]'):
   if not any(x['status']=='ready' for x in json.loads((R/'content/toolkits.json').read_text())['products']):
    promo.clear();promo.set('class','wrap guide-toolkit quiet-tools');promo.set('aria-label','Preparation toolkits')
    addlink(promo,'/toolkits/','Planning tools in development');E.SubElement(promo,'p').text='Purchases are paused. Free online guides remain available.'
    remove(promo);main.append(promo)
 if name=='resources/index.html':
  for promo in d.xpath('//div[@class="reference-toolkit-note"]'):remove(promo)
  h=d.xpath('//div[@class="library-grid"]')[0];h.addprevious(node('<h2>Published reference documents</h2>'))
 if name=='404.html' and not main.xpath('.//a[@href="/search/"]'):
  links=node('<nav class="related-links" aria-label="Find another page"></nav>');addlink(links,'/search/','Search guides');addlink(links,'/library/','Browse the library');main.append(links)
 if name=='privacy/index.html':
  for old in d.xpath('//*[@id="privacy-summary"]'):remove(old)
  intro=node('<section class="wrap interior-section" id="privacy-summary"><h2>Privacy at a glance</h2><p>Search and saved guide links work locally. Contact submissions go to the site operator. Device location is requested only when you choose Use my location. Some browsing pages load third-party advertising. External links follow their providers’ privacy policies.</p><nav class="privacy-contents" aria-label="Privacy contents"></nav></section>')
  nav=intro.xpath('.//nav')[0]
  for i,h in enumerate(d.xpath('//main//div[@class="prose"]/h2')):
   h.set('id','privacy-'+str(i));addlink(nav,'#privacy-'+str(i),h.text_content())
  main.insert(1,intro)
 # Concise browsing labels retain complete article titles and searchable aliases.
 for a in d.xpath('//a[starts-with(@href,"/preparedness/") or starts-with(@href,"/guides/")]'):
  slug=a.get('href').strip('/').split('/')[-1]
  if slug in LABELS:
   for h in a.xpath('./h4'):h.text=LABELS[slug]
 # Generated metadata remains consistent with display titles.
 for schema in d.xpath('//script[@type="application/ld+json"]'):
  data=json.loads(schema.text)
  if name in TITLES and data.get('@type')!='Article':data['name']=TITLES[name];schema.text=json.dumps(data)
 for script in d.xpath('//script[@src]'):
  asset=script.get('src').split('?')[0]
  if asset in ['/app.js','/search.js','/briefing.js']:
   version=hashlib.sha256((R/asset.lstrip('/')).read_bytes()).hexdigest()[:12];script.set('src',asset+'?v='+version)
 p.write_text('<!doctype html>\n'+H.tostring(d,encoding='unicode',method='html'))
p=R/'search-index.json';index=json.loads(p.read_text())
for record in index:
 slug=record['url'].strip('/').split('/')[-1]
 if slug in LABELS:record['nav_title']=LABELS[slug]
p.write_text(json.dumps(index,separators=(',',':')))
print('Applied focused navigation, situation choices, article hierarchy and utility clarity.')
