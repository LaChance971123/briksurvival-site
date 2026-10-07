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

// Compact subject browsing; full navigation also works without JavaScript.
for (const menu of document.querySelectorAll('.subject-menu')) {
  const wide = window.matchMedia('(min-width: 1021px)');
  menu.open = wide.matches;
  wide.addEventListener('change', e => { menu.open = e.matches; });
}
const browseType = document.querySelector('#browse-type');
if (browseType) {
  const cards = [...document.querySelectorAll('[data-guide-type]')], status = document.querySelector('#browse-status');
  const groups = [...document.querySelectorAll('.browse-group')];
  let originalOpen;
  browseType.addEventListener('change', () => {
    if (browseType.value && !originalOpen) originalOpen = groups.map(g => g.open);
    let count = 0;
    for (const card of cards) { card.hidden = Boolean(browseType.value && card.dataset.guideType !== browseType.value); if (!card.hidden) count++; }
    for (const group of document.querySelectorAll('.library-subgroup,.library-group,.browse-group')) {
      group.hidden = ![...group.querySelectorAll('[data-guide-type]')].some(card => !card.hidden);
      if (group.matches('.browse-group') && browseType.value && !group.hidden) group.open = true;
    }
    for (const chip of document.querySelectorAll('.subcategory-chips a')) {
      const target = document.getElementById(chip.hash.slice(1)); chip.hidden = Boolean(target?.hidden);
    }
    if (!browseType.value && originalOpen) { groups.forEach((g, i) => { g.open = originalOpen[i]; }); originalOpen = undefined; }
    status.textContent = count + (count === 1 ? ' guide shown' : ' guides shown');
  });
}

// Progressive enhancement only: content stays visible without JS or with reduced motion.
(() => {
  if (typeof window.matchMedia !== 'function') return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const sections = [...document.querySelectorAll('.home-common,.home-toolkits,.home-start,.home-encyclopedia,.home-planner,.home-mission,.home-clipjar')];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('oz-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.04, rootMargin: '0px 0px 32px 0px' });
  for (const section of sections) {
    section.classList.add('oz-reveal-ready');
    observer.observe(section);
  }
  // Keyboard navigation never lands in visually hidden content.
  for (const section of sections) section.addEventListener('focusin', () => {
    section.classList.add('oz-revealed'); observer.unobserve(section);
  });
  motion.addEventListener('change', e => {
    if (e.matches) { sections.forEach(s => s.classList.add('oz-revealed')); observer.disconnect(); }
  });
})();
