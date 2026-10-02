const search = document.querySelector('#emergency-search');
const cards = [...document.querySelectorAll('.category-card')];
const empty = document.querySelector('#no-results');
if (search) {
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const haystack = `${card.dataset.search} ${card.innerText}`.toLowerCase();
      const match = haystack.includes(query);
      card.classList.toggle('hidden', !match);
      shown += Number(match);
    }
    empty.hidden = shown > 0;
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      search.dispatchEvent(new Event('input'));
      search.blur();
    }
  });
}
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
if (menu && nav) {
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) {
      menu.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    }
  });
}
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
