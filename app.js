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

for (const button of document.querySelectorAll("[data-print]")) button.addEventListener("click", () => window.print());

// Advertising is separate from emergency response; no cold-load permission prompts.
(() => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const eligible = /^\/(library|preparedness|guides)(\/|$)/.test(path) || ['/topics', '/resources', '/about'].includes(path);
  if (!eligible) return;
  const safeRead = (storage, key) => { try { return storage.getItem(key); } catch { return null; } };
  const safeWrite = (storage, key, value) => { try { storage.setItem(key, value); } catch { /* Reading still works without storage. */ } };
  let focused = false;
  try { focused = safeRead(window.localStorage, 'oz-focus') === 'true'; } catch { /* private mode */ }
  const main = document.querySelector('main');
  if (!main) return;
  const panel = document.createElement('section');
  panel.className = 'wrap ad-choice';
  panel.setAttribute('aria-label', 'Advertising choice');
  const heading = document.createElement('h2');
  heading.textContent = 'Keep knowledge free.';
  const text = document.createElement('p');
  text.textContent = 'Optional advertising supports this library. It may include overlays, advertising tabs or an optional notification offer. Your guides and downloads stay available either way.';
  const controls = document.createElement('div');
  const enable = document.createElement('button');
  enable.type = 'button'; enable.className = 'button button-outline';
  enable.textContent = 'Continue with ads';
  const focus = document.createElement('button');
  focus.type = 'button'; focus.className = 'button button-outline';
  focus.textContent = focused ? 'Focus mode is on' : 'Use focus mode';
  focus.setAttribute('aria-pressed', String(focused));
  const note = document.createElement('p');
  note.className = 'ad-status'; note.setAttribute('role', 'status');
  note.textContent = focused ? 'Ads are off on this device. Emergency response and search pages always stay free of ad scripts.' : 'Advertising is off until you choose to enable it.';
  const privacy = document.createElement('a');
  privacy.href = '/privacy/'; privacy.textContent = 'Privacy & advertising';
  controls.append(enable, focus, privacy); panel.append(heading, text, controls, note);
  main.appendChild(panel);
  focus.addEventListener('click', () => {
    try { safeWrite(window.localStorage, 'oz-focus', 'true'); } catch { /* private mode */ }
    // Reload removes already active third-party code from this document.
    if (loaded) window.location.reload();
    focused = true; focus.textContent = 'Focus mode is on'; focus.setAttribute('aria-pressed', 'true');
    note.textContent = 'Focus mode is on. This page will not initialise advertisements.';
  });
  let loaded = false;
  // Register before the provider so its click handlers cannot consume this control.
  const stopAdvertising = () => {
    try { safeWrite(window.localStorage, 'oz-focus', 'true'); } catch { /* private mode */ }
    window.location.reload();
  };
  window.addEventListener('pointerdown', event => {
    if (loaded && focus.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); stopAdvertising();
    }
  }, true);
  window.addEventListener('keydown', event => {
    if (loaded && event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); stopAdvertising();
    }
  }, true);
  enable.addEventListener('click', () => {
    if (loaded) return;
    let last = 0;
    try { last = Number(safeRead(window.sessionStorage, 'oz-ad-start')) || 0; } catch { /* private mode */ }
    if (Date.now() - last < 600000) { note.textContent = 'Advertising was recently enabled in this session. No additional ad zone is being loaded here.'; return; }
    focused = false;
    try { safeWrite(window.localStorage, 'oz-focus', 'false'); safeWrite(window.sessionStorage, 'oz-ad-start', String(Date.now())); } catch { /* private mode */ }
    const script = document.createElement('script');
    script.async = true;
    if (/^\/guides(\/|$)/.test(path)) {
      script.dataset.zone = '11941449';
      script.src = 'https://n6wxm.com/vignette.min.js';
    } else {
      script.dataset.cfasync = 'false';
      script.src = 'https://5gvci.com/act/files/tag.min.js?z=11941494';
    }
    script.addEventListener('error', () => { note.textContent = 'Advertising could not load. All guides remain available.'; });
    script.addEventListener('load', () => {
      note.textContent = 'Advertising provider loaded. Use focus mode or press Escape to reload without ads.';
      focus.classList.add('ad-stop-button'); focus.textContent = 'Stop ads · Focus mode';
      // Keep the escape control outside the document layout and above overlays.
      document.body.appendChild(focus);
    });
    loaded = true; enable.disabled = true; focus.textContent = 'Use focus mode'; focus.setAttribute('aria-pressed', 'false');
    note.textContent = 'Loading the advertising provider…';
    document.body.appendChild(script);
  });
})();
