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
  catch {status.textContent='The request could not be submitted. Check your connection and try again. The free online guides are available without signup.';button.disabled=false;}
 });
}
const thanks=document.querySelector('.thanks-page h1');
if(thanks){const type=new URLSearchParams(location.search).get('request');if(type==='guide-early-access')thanks.textContent='Toolkit update request received.';else if(type==='field-notes-newsletter')thanks.textContent='Field Notes request received.';}
