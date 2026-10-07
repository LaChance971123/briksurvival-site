const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
if (menu && nav) {
  const closeMenu = (restoreFocus = false) => {
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open menu');
    nav.classList.remove('open');
    if (restoreFocus) menu.focus();
  };
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  document.addEventListener('click', (event) => {
    if (menu.getAttribute('aria-expanded') === 'true' && !menu.contains(event.target) && !nav.contains(event.target)) closeMenu();
  });
  window.matchMedia('(min-width: 1021px)').addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });
}
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// Retire only Osprey Zero's former offline reader; preserve the advertising worker.
async function retireOfflineAccess() {
  const jobs = [];
  if ('serviceWorker' in navigator) {
    jobs.push(navigator.serviceWorker.getRegistrations().then(registrations =>
      Promise.all(registrations.filter(registration =>
        new URL(registration.scope).origin === location.origin &&
        new URL(registration.scope).pathname === '/offline/'
      ).map(registration => registration.unregister()))));
  }
  if ('caches' in window) {
    jobs.push(caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith('oz-offline-')).map(key => caches.delete(key)))));
  }
  await Promise.allSettled(jobs);
}
retireOfflineAccess().catch(() => {});

// Netlify collection remains truthful until the selected email form is fully configured.
for (const form of document.querySelectorAll('form[data-signup]')) {
 form.addEventListener('submit',async event=>{
  if(!form.reportValidity())return;event.preventDefault();const button=form.querySelector('button[type="submit"]'),status=form.querySelector('[data-form-status]');
  if(form.querySelector('[name="bot-field"]')?.value)return;
  button.disabled=true;status.textContent='Submitting your request…';
  try {const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString()});if(!response.ok)throw Error();location.assign('/thanks/?request='+encodeURIComponent(form.dataset.signup));}
  catch {status.textContent='The request could not be submitted. Check your connection and try again. You can still read all free guides.';button.disabled=false;}
 });
}
const thanks=document.querySelector('.thanks-page h1');
if(thanks){const type=new URLSearchParams(location.search).get('request');if(type==='guide-early-access')thanks.textContent='Toolkit update request received.';else if(type==='field-notes-newsletter')thanks.textContent='Field Notes request received.';else if(type==='private-contact')thanks.textContent='Your message has been submitted.';}

// Guide links only: no downloaded content, accounts, or household records.
(function () {
  const key = 'oz-reading-list-v1', max = 60;
  const valid = path => typeof path === 'string' && /^\/(emergencies|preparedness|guides)\/[a-z0-9-]+\/$/.test(path);
  function read() {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? [...new Set(value.filter(valid))].slice(0, max) : []; }
    catch { return []; }
  }
  function write(paths) { try { localStorage.setItem(key, JSON.stringify(paths)); return true; } catch { return false; } }
  const save = document.querySelector('[data-save-guide]'), message = document.querySelector('[data-guide-status]');
  const current = location.pathname;
  function sync() { if (save) { const saved = read().includes(current); save.setAttribute('aria-pressed', String(saved)); save.textContent = saved ? 'Remove from reading list' : 'Save to reading list'; } }
  if (save && valid(current)) {
    save.hidden = false; sync();
    save.addEventListener('click', () => {
      const paths = read(), saved = paths.includes(current);
      if (!saved && paths.length >= max) { message.textContent = 'Your list has 60 links. Remove one before adding another.'; return; }
      if (!write(saved ? paths.filter(p => p !== current) : [...paths, current])) { message.textContent = 'This browser could not save the link. Use a browser bookmark instead.'; return; }
      sync(); message.textContent = saved ? 'Link removed.' : 'Link saved in this browser. Reading still needs a connection.';
    });
  }
  const share = document.querySelector('[data-share-guide]');
  if (share && navigator.clipboard?.writeText) {
    share.hidden = false;
    share.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.origin + current); message.textContent = 'Guide link copied.'; }
      catch { message.textContent = 'Copy the address from your browser to share this guide.'; }
    });
  }
  const list = document.querySelector('#reading-list'), status = document.querySelector('#reading-status');
  let index;
  function renderList() {
    if (!list || !index) return;
    const paths = read(), guides = paths.map(p => index.find(g => g.url === p && g.priority === 10)).filter(Boolean).reverse();
    list.replaceChildren();
    status.textContent = guides.length ? `${guides.length} saved ${guides.length === 1 ? 'guide' : 'guides'} · Links saved on this device` : 'Your list is empty. Open a guide and choose “Save to reading list”.';
    for (const g of guides) {
      const item = document.createElement('article'); item.className = 'reading-card';
      const content = document.createElement('div'), meta = document.createElement('p'), title = document.createElement('h2'), link = document.createElement('a'), summary = document.createElement('p'), remove = document.createElement('button');
      meta.className = 'result-meta'; meta.textContent = g.content_type + ' · ' + g.category;
      link.href = g.url; link.textContent = g.title; title.append(link); summary.textContent = g.summary;
      content.append(meta, title, summary); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + g.title + ' from reading list');
      remove.addEventListener('click', () => {
        const siblings = [...list.children], position = siblings.indexOf(item);
        if (!write(read().filter(p => p !== g.url))) { status.textContent = 'This browser could not update the list.'; return; }
        renderList(); const next = list.children[Math.min(position, list.children.length - 1)];
        if (next) next.querySelector('button').focus(); else { status.tabIndex = -1; status.focus(); }
      });
      item.append(content, remove); list.append(item);
    }
  }
  if (list) fetch('/search-index.json?v=oz13').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => { index = data; renderList(); }).catch(() => {
    status.textContent = 'Your guide directory could not load. Check your connection and reload. Saved links remain in this browser.';
  });
  window.addEventListener('storage', e => { if (e.key === key || e.key === null) { sync(); renderList(); } });
})();

// Guide controls enhance plain anchors; section history remains native.
(() => {
  const guide = document.querySelector('.guide-page');
  if (!guide) return;
  const toc = guide.querySelector('.guide-toc');
  const links = [...guide.querySelectorAll('.guide-jumps a[href^="#"],.rail-panel a[href^="#"]')];
  const sections = [...guide.querySelectorAll('.quick-answer[id],.guide-section[id]')];
  const markCurrent = id => links.forEach(link => {
    if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const markHash = () => {
    const id = location.hash.slice(1);
    if (sections.some(section => section.id === id)) markCurrent(id);
  };
  markHash();
  window.addEventListener('hashchange', markHash);
  // Keep native anchor navigation and Back behavior; only move keyboard focus.
  for (const link of [...links, ...guide.querySelectorAll('.guide-start-link')]) {
    link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      target.tabIndex = -1;
      target.focus({preventScroll: true});
      if (toc?.contains(link)) toc.open = false;
      markCurrent(target.id);
    });
  }
  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      const first = sections.find(section => visible.has(section));
      if (first) markCurrent(first.id);
    }, {rootMargin: '-105px 0px -60% 0px', threshold: 0});
    sections.forEach(section => observer.observe(section));
  }
  const print = guide.querySelector('[data-print-guide]');
  if (print && typeof window.print === 'function') {
    print.hidden = false;
    let expanded = [];
    const openDetails = () => {
      if (expanded.length) return;
      expanded = [...guide.querySelectorAll('.guide-faq:not([open]),.pack-details:not([open])')];
      expanded.forEach(detail => { detail.open = true; });
    };
    const restoreDetails = () => { expanded.forEach(detail => { detail.open = false; }); expanded = []; };
    window.addEventListener('beforeprint', openDetails);
    window.addEventListener('afterprint', restoreDetails);
    print.addEventListener('click', () => window.print());
  }
})();

// Browse choices live on this history entry, never in an account or a query URL.
(() => {
  const subject = document.querySelector('.subject-menu');
  const browseType = document.querySelector('#browse-type');
  const groups = [...document.querySelectorAll('.browse-group')];
  if (!subject && !browseType && !groups.length) return;
  const cards = [...document.querySelectorAll('[data-guide-type]')];
  const status = document.querySelector('#browse-status');
  const wide = window.matchMedia('(min-width: 1021px)');
  const snapshot = () => {
    try { return history.state?.ozBrowse?.path === location.pathname ? history.state.ozBrowse : null; }
    catch { return null; }
  };
  let originalOpen = null;
  let restoring = false;
  const save = () => {
    if (restoring) return;
    try {
      history.replaceState({...history.state, ozBrowse: {
        path: location.pathname, type: browseType?.value || '',
        open: groups.filter(group => group.open).map(group => group.id),
        originalOpen, subjectOpen: subject?.open, width: wide.matches
      }}, '');
    } catch { /* Browsing still works when history storage is unavailable. */ }
  };
  const applyFilter = () => {
    const type = browseType?.value || '';
    let count = 0;
    for (const card of cards) {
      card.hidden = Boolean(type && card.dataset.guideType !== type);
      if (!card.hidden) count++;
    }
    for (const group of document.querySelectorAll('.library-subgroup,.library-group,.browse-group')) {
      group.hidden = ![...group.querySelectorAll('[data-guide-type]')].some(card => !card.hidden);
    }
    for (const chip of document.querySelectorAll('.subcategory-chips a')) {
      chip.hidden = Boolean(document.getElementById(chip.hash.slice(1))?.hidden);
    }
    if (status) status.textContent = count + (count === 1 ? ' guide shown' : ' guides shown');
  };
  const restore = () => {
    restoring = true;
    const state = snapshot();
    if (subject) subject.open = state && state.width === wide.matches && typeof state.subjectOpen === 'boolean' ? state.subjectOpen : wide.matches;
    if (browseType) browseType.value = state?.type || '';
    if (state && Array.isArray(state.open)) groups.forEach(group => { group.open = state.open.includes(group.id); });
    originalOpen = Array.isArray(state?.originalOpen) ? state.originalOpen : null;
    applyFilter(); restoring = false;
  };
  restore();
  subject?.addEventListener('toggle', save);
  groups.forEach(group => group.addEventListener('toggle', save));
  wide.addEventListener('change', event => { if (subject) subject.open = event.matches; save(); });
  browseType?.addEventListener('change', () => {
    if (browseType.value) {
      if (!originalOpen) originalOpen = groups.filter(group => group.open).map(group => group.id);
      applyFilter(); groups.forEach(group => { if (!group.hidden) group.open = true; });
    } else {
      applyFilter();
      if (originalOpen) groups.forEach(group => { group.open = originalOpen.includes(group.id); });
      originalOpen = null;
    }
    save();
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('popstate', restore);
})();
