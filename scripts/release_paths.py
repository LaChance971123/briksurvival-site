"""Deterministic beginner learning paths; links remain usable without JavaScript."""
from pathlib import Path
import re,json
from html import escape as e
R=Path(__file__).resolve().parents[1]
paths=[
('Start preparing','Build the foundation before buying more gear.',[('Household emergency plan','/preparedness/household-emergency-plan/'),('Budget and priorities','/preparedness/budget-preparedness/'),('Inventory what you own','/preparedness/preparedness-inventory/')]),
('Stay or leave','Set clear limits and a real destination.',[('Bug-in plan','/preparedness/bug-in-plan/'),('Bug-out plan','/preparedness/bug-out-plan/'),('A carryable go bag','/preparedness/go-bag/')]),
('Prepare your home','Match your plan to the building you live in.',[('Apartments and rentals','/preparedness/apartment-preparedness/'),('Home hardening','/preparedness/home-hardening/'),('Trailers and mobile homes','/preparedness/trailer-preparedness/')]),
('Build field skills','Practice safely before conditions make skills urgent.',[('Bushcraft foundation','/guides/bushcraft-foundation/'),('Survival priorities','/guides/survival-priorities/'),('Outdoor trip plan','/guides/outdoor-trip-plan/')]),
('Communicate and coordinate','Choose usable radios and a simple group plan.',[('Baofeng basics','/preparedness/baofeng-basics/'),('Radio check-ins','/preparedness/radio-check-in-plan/'),('Small-team coordination','/preparedness/small-team-coordination/')]),
('Own and store responsibly','Learn safety, access control and equipment limits.',[('Firearm safety foundation','/preparedness/firearm-safety-basics/'),('Secure firearm storage','/preparedness/firearm-storage/'),('Ammunition safety','/preparedness/ammunition-storage/')])]
block='<section class="wrap learning-paths" id="learning-paths" aria-labelledby="learning-title"><p class="kicker">BUILD SKILLS / ONE STEP AT A TIME</p><h2 id="learning-title">New to preparedness? Start here.</h2><p>Choose the path that fits your next decision. Read in order or jump to the skill you need.</p><div class="learning-path-grid">'+''.join('<article class="learning-path"><h3>'+e(title)+'</h3><p>'+e(desc)+'</p><ol>'+''.join('<li><a href="'+url+'">'+e(label)+'</a></li>' for label,url in links)+'</ol></article>' for title,desc,links in paths)+'</div></section>'
for name in ('index.html','library/index.html'):
 p=R/name;s=p.read_text();s=re.sub(r'<section class="wrap learning-paths".*?</section>','',s,flags=re.S)
 if name=='index.html':s=s.replace('<section class="wrap mission-paths"',block+'<section class="wrap mission-paths"')
 else:s=s.replace('</main>',block+'</main>')
 p.write_text(s)
# Search includes the separately sold planner, without implying an active checkout.
p=R/'search-index.json';data=json.loads(p.read_text());data.append(dict(title='Household Planner',url='/planner/',category='Preparation tools',category_id='',subcategory='Separate digital product',content_type='Planner',aliases=['dashboard','household app'],summary='A household dashboard with local web access for customers who have the purchased app file. Separate from the topic kits.',text='inventory supplies contacts cards budgets tasks meals backup dashboard mobile',priority=0));p.write_text(json.dumps(data,separators=(',',':')))
