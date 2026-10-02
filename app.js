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

// Load one advertising zone per eligible document; urgent response stays ad-free.
(() => {
  const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  const eligible = /^\/(library|preparedness|guides)(\/|$)/.test(path) || ['/topics', '/resources', '/about'].includes(path);
  if (!eligible || document.querySelector('script[data-oz-ad]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.dataset.ozAd = 'true';
  if (/^\/guides(\/|$)/.test(path)) {
    script.dataset.zone = '11941449';
    script.src = 'https://n6wxm.com/vignette.min.js';
  } else {
    script.dataset.cfasync = 'false';
    script.src = 'https://5gvci.com/act/files/tag.min.js?z=11941494';
  }
  (document.body || document.documentElement).appendChild(script);
})();
