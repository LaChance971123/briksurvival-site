"""Osprey Zero document system: shared site typography, print-safe editorial layout."""
from pathlib import Path
from html import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak, Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab import rl_config
rl_config.invariant=True
ROOT=Path(__file__).resolve().parents[1]
INK=colors.HexColor('#0B0D0F');ASH=colors.HexColor('#D7D1C4');ORANGE=colors.HexColor('#C44119');PALE=colors.HexColor('#F2EEE6');MUTED=colors.HexColor('#505957');LINE=colors.HexColor('#B7BBB5')
for name,file in [('Body','DMSans-400'),('BodyBold','DMSans-700'),('Display','SpaceGrotesk-700'),('Mono','IBMPlexMono-400')]:pdfmetrics.registerFont(TTFont(name,str(ROOT/'Assets/fonts'/f'{file}.ttf')))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='Body',boldItalic='BodyBold')
ST={
 'body':ParagraphStyle('body',fontName='Body',fontSize=10,leading=14,textColor=INK,spaceAfter=5),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8.5,leading=12,textColor=MUTED,spaceAfter=5),
 'label':ParagraphStyle('label',fontName='Mono',fontSize=8,leading=12,textColor=ORANGE,spaceBefore=10,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='Display',fontSize=28,leading=30,textColor=INK,spaceAfter=15),
 'h2':ParagraphStyle('h2',fontName='Display',fontSize=19,leading=22,textColor=INK,spaceBefore=13,spaceAfter=8,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='Display',fontSize=13,leading=16,textColor=INK,spaceAfter=5,keepWithNext=True),
 'quick':ParagraphStyle('quick',fontName='BodyBold',fontSize=11,leading=15,textColor=INK,spaceAfter=0),
 'num':ParagraphStyle('num',fontName='Mono',fontSize=16,leading=20,textColor=ORANGE),
}
def clean(t):return escape(str(t).replace('’',"'").replace('–','-').replace('—','-').replace('“','"').replace('”','"'))
def para(t,key='body'):return Paragraph(clean(t),ST[key])
def panel(label,text):
 t=Table([[para(label,'label')],[para(text,'quick')]],colWidths=[516]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.6,LINE),('LINEBEFORE',(0,0),(0,-1),3,ORANGE),('LEFTPADDING',(0,0),(-1,-1),15),('RIGHTPADDING',(0,0),(-1,-1),15),('TOPPADDING',(0,0),(-1,0),3),('BOTTOMPADDING',(0,-1),(-1,-1),14)]));return t
class Writing(Flowable):
 def __init__(self,labels):Flowable.__init__(self);self.labels=labels;self.width=516;self.height=len(labels)*38+8
 def draw(self):
  c=self.canv
  for i,label in enumerate(self.labels):
   y=self.height-15-i*38;c.setFont('Mono',8);c.setFillColor(MUTED);c.drawString(0,y,label.upper());c.setStrokeColor(LINE);c.setLineWidth(.5);c.line(0,y-19,516,y-19)
def frame(title,kind):
 def paint(c,d):
  c.saveState();c.setFillColor(INK);c.rect(0,744,612,48,fill=1,stroke=0);c.setFillColor(colors.HexColor('#F2EEE6'));c.setFont('Display',15);c.drawString(48,762,'OSPREY');c.setFillColor(colors.HexColor('#F05A2A'));c.drawString(113,762,'ZERO');c.setFont('Mono',7);c.setFillColor(ASH);c.drawRightString(564,765,'SKILL BEATS PANIC. EVERY TIME.');c.setStrokeColor(ORANGE);c.setLineWidth(2);c.line(48,737,564,737)
  c.setStrokeColor(LINE);c.setLineWidth(.5);c.line(48,44,564,44);c.setFont('Mono',7);c.setFillColor(MUTED);c.drawString(48,30,'OSPREYZERO.COM / '+kind.upper());c.drawRightString(564,30,f'{d.page:02d}');c.restoreState()
 return paint
def build(path,title,kind,story):
 path.parent.mkdir(exist_ok=True,parents=True);doc=SimpleDocTemplate(str(path),pagesize=(612,792),leftMargin=48,rightMargin=48,topMargin=71,bottomMargin=61,title=title+' | Osprey Zero',author='Osprey Zero',subject=kind)
 doc.build(story,onFirstPage=frame(title,kind),onLaterPages=frame(title,kind))
def opening(g,kind):return [para('FIELD LIBRARY / '+kind.upper(),'label'),para(g['title'],'title'),para(g.get('category','').replace('-',' ').upper()+' / EDITION '+g['updated'],'small'),Spacer(1,9)]
class StepMarker(Flowable):
 def __init__(self,n):Flowable.__init__(self);self.n=n;self.width=36;self.height=29
 def draw(self):
  c=self.canv;c.setStrokeColor(MUTED);c.setLineWidth(.7);c.rect(0,13,10,10);c.setFont('Mono',9);c.setFillColor(ORANGE);c.drawString(0,0,f'{self.n:02d}')
def action(n,h,p):
 box=Table([[StepMarker(n),[para(h,'h3'),para(p)]]],colWidths=[43,473]);box.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.5,LINE)]));return KeepTogether([box])
def sources(g,refs,route,compact=False):
 if compact:
  s=[para('SOURCES / SCOPE / LIMITS','label'),para('Source-linked civilian guidance, not independent clinical or specialist certification. U.S. references; emergency numbers and services differ. Training and product instructions remain essential.','small')]
  for label,url in refs:s.append(Paragraph('<link href="'+escape(url,quote=True)+'" color="#C44119">'+clean(label)+'</link>',ST['small']))
  s.append(para('Full guide: https://ospreyzero.com'+route,'small'));return s
 s=[para('Sources & limits.','label' if compact else 'h2'),para(g.get('scope','Civilian planning. References may use U.S. systems; emergency numbers, laws and available services differ.'),'small'),para('Source-linked editorial guidance. Not independent clinical or specialist certification. Training and product-specific instructions remain essential.','small')]
 for label,url in refs:s.extend([Paragraph('<link href="'+escape(url,quote=True)+'" color="#C44119">'+clean(label)+'</link>',ST['small']),*([para(url,'small')] if not compact else [])])
 s.extend([para('Full guide: https://ospreyzero.com'+route,'small'),para('Content updated '+g['updated']+'. Saved guidance cannot provide live alerts.','small')]);return s
def make_document(g,refs,route,kind):
 suffix={'checklist':'checklist','shopping':'shopping-list','guide':'field-guide'}[kind];path=ROOT/'downloads'/f'{g["slug"]}-{suffix}.pdf';story=opening(g,{'checklist':'Action checklist','shopping':'Supply worksheet','guide':'Full field guide'}[kind])
 if kind=='shopping':
  story+=[panel('BUILD AROUND YOUR HOUSEHOLD','Use what you own first. Match quantities to people, days and medical needs. Supplies are preparation, never a reason to delay escape.'),Spacer(1,15),Writing(['Household / people / pets','Planning period / available budget'])]
  for n,item in enumerate(g['shopping'],1):
   row=Table([[para(f'{n:02d}','small'),para(item,'small'),para('Have: _____  Need: _____','small')]],colWidths=[25,291,200]);row.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.5,LINE)]));story+=[KeepTogether([row])]
  story+=[PageBreak(),para('Make it workable.','title'),para('BUY / BORROW / SHARE','label'),para('Mark essentials before optional equipment. Choose supplies you can carry, store and use safely. Check compatibility, expiry dates and instructions; no product or retailer is endorsed.'),Writing(['Buy first / estimated cost','Borrow or share / contact','Carry and storage limits','Expiry / refill / battery checks']),para('Household considerations.','h2'),para(g['household']),*sources(g,refs,route)]
 else:
  story+=[panel('QUICK ANSWER / START HERE',g['tldr']),para('Do now.','h2')]
  for n,(h,p) in enumerate(g['steps'],1):story.append(action(n,h,p))
  # A distinct planning sheet keeps urgent actions separate from writable notes.
  story+=[PageBreak(),para('Keep the plan moving.','title'),panel('IF HELP IS UNAVAILABLE',g['without_help']),para('Watch for.','h2'),para(g['watch']),para('People & practical needs.','h2'),para(g['household'] if kind=='guide' else '. '.join(g['household'].split('. ')[:2]))]
  if kind=='guide':
   story+=[para('Keep essentials within reach.','h2'),para(g['pack_now']),para('Next decisions.','h2'),para(g['next'])]
   for h,p in g.get('decisions',[]):story+=[para(h,'h3'),para(p)]
   if g.get('faqs'):
    story+=[para('Questions in the field.','h2')]
    for h,p in g['faqs']:story+=[para(h,'h3'),para(p)]
  else:story+=[para('Next decision.','h2'),para(g['next'])]
  story+=[KeepTogether([para('YOUR SITUATION / PRIVATE WORKSHEET','label'),Writing(g.get('worksheet',['Time / location / changing conditions','People / access or medical needs','Next action / person responsible'])[:2] if kind=='checklist' else g.get('worksheet',['Time / location / changing conditions','People / access or medical needs','Next action / person responsible']))])]
  if kind=='guide':story.append(Spacer(1,14))
  story+=sources(g,refs,route,compact=kind=='checklist')
 build(path,g['title'],suffix,story);return '/downloads/'+path.name
