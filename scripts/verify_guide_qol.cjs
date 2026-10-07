/* Guide and browse enhancements: no browser dependency, no external requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('app.js', 'utf8');
const guideCode = app.slice(app.indexOf('// Guide controls enhance'), app.indexOf('// Browse choices live'));
const browseCode = app.slice(app.indexOf('// Browse choices live'), app.indexOf('// Progressive enhancement only:'));
function element(props = {}) {
  return {hidden: true, open: false, children: [], attrs: {}, events: {}, ...props,
    addEventListener(name, fn) { this.events[name] = fn; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    focus(options) { this.focused = options; }
  };
}
function guideFixture() {
  const print = element(), toc = element({open: true}), start = element({hash: '#do-now'});
  const links = ['quick-answer', 'do-now', 'household'].map(id => element({hash: '#' + id}));
  const sections = links.map(link => {
    const heading = element({textContent: link.hash.slice(1) + '.'});
    return element({id: link.hash.slice(1), heading, querySelector: () => heading});
  });
  const details = [element(), element({open: true})], events = {};
  toc.contains = link => links.includes(link);
  const guide = {querySelector: selector => ({'[data-print-guide]': print, '.guide-toc': toc})[selector],
    querySelectorAll: selector => selector.includes('.quick-answer') ? sections : selector === '.guide-start-link' ? [start] : selector.includes(':not([open])') ? details.filter(detail => !detail.open) : links};
  const document = {querySelector: () => guide, createElement: () => { throw Error('Guide headings must remain plain; no section controls'); }, getElementById: id => sections.find(section => section.id === id)};
  const window = {addEventListener: (name, fn) => { events[name] = fn; }, print: () => { events.beforeprint(); events.beforeprint(); }};
  const location = {origin: 'https://ospreyzero.com', pathname: '/emergencies/power-outage/', hash: '#household'};
  vm.runInNewContext(guideCode, {document, window, location});
  return {sections, links, toc, start, print, details, events};
}
function browseFixture({state = null, blocked = false, wide = false} = {}) {
  const cards = ['Emergency guide', 'Preparedness guide'].map(type => element({hidden: false, dataset: {guideType: type}}));
  const groups = cards.map((card, i) => element({id: 'subject-' + i, querySelectorAll: () => [card]}));
  const subject = element(), filter = element({value: ''}), status = element(), events = {}, media = {matches: wide, addEventListener(name, fn) { this.change = fn; }};
  const history = {state, calls: 0, replaceState(next) { if (blocked) throw Error('denied'); this.calls++; this.state = next; }};
  const document = {querySelector: selector => ({'.subject-menu': subject, '#browse-type': filter, '#browse-status': status})[selector],
    querySelectorAll: selector => selector === '[data-guide-type]' ? cards : selector === '.subcategory-chips a' ? [] : groups};
  const window = {matchMedia: () => media, addEventListener: (name, fn) => { events[name] = fn; }};
  vm.runInNewContext(browseCode, {document, window, history, location: {pathname: '/library/utilities/'}});
  return {cards, groups, subject, filter, status, events, media, history};
}
(() => {
  const g = guideFixture();
  assert.deepEqual(g.sections.map(section => section.id), ['quick-answer', 'do-now', 'household']);
  assert.deepEqual(g.sections.map(section => section.heading.textContent), ['quick-answer.', 'do-now.', 'household.']);
  assert.equal(g.links[2].attrs['aria-current'], 'location');
  let prevented = false;
  g.links[1].events.click({preventDefault() { prevented = true; }});
  assert(!prevented, 'Guide jumps must preserve native history');
  assert.equal(g.toc.open, false); assert.equal(g.sections[1].tabIndex, -1); assert(g.sections[1].focused.preventScroll);
  assert.equal(g.links[1].attrs['aria-current'], 'location'); assert.equal(g.links[2].attrs['aria-current'], undefined);
  g.sections[1].focused = null; g.start.events.click({ctrlKey: true}); assert.equal(g.sections[1].focused, null);
  assert.equal(g.print.hidden, false); g.print.events.click(); assert(g.details.every(detail => detail.open));
  g.events.afterprint(); assert.equal(g.details[0].open, false); assert.equal(g.details[1].open, true);
  g.start.events.click({}); assert(g.sections[1].focused);

  let b = browseFixture(); assert.equal(b.subject.open, false); assert.equal(b.status.textContent, '2 guides shown');
  b.groups[0].open = true; b.groups[0].events.toggle();
  assert.equal(b.history.state.ozBrowse.open[0], 'subject-0');
  b.filter.value = 'Preparedness guide'; b.filter.events.change();
  assert.equal(b.cards[0].hidden, true); assert.equal(b.groups[1].open, true); assert.equal(b.status.textContent, '1 guide shown');
  const saved = b.history.state;
  b = browseFixture({state: saved}); assert.equal(b.filter.value, 'Preparedness guide'); assert.equal(b.cards[0].hidden, true); assert.equal(b.groups[1].open, true);
  b.filter.value = ''; b.filter.events.change(); assert.equal(b.groups[0].open, true); assert.equal(b.groups[1].open, false);
  b.history.state = saved; b.events.popstate(); assert.equal(b.filter.value, 'Preparedness guide'); assert.equal(b.cards[0].hidden, true);
  b = browseFixture({blocked: true, wide: true}); assert.equal(b.subject.open, true);
  b.filter.value = 'Emergency guide'; b.filter.events.change(); assert.equal(b.cards[1].hidden, true);
  b.media.change({matches: false}); assert.equal(b.subject.open, false);
  console.log('PASS: plain section headings, section jump/focus/history, print disclosure restoration, browse filters/group Back state and blocked-history fallback.');
})();
