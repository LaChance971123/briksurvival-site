const search = document.querySelector('#emergency-search');
const cards = [...document.querySelectorAll('.topic-card')];
const empty = document.querySelector('#no-results');
const count = document.querySelector('#finder-count');
if (search && cards.length) {
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      const match = `${card.dataset.search || ''} ${card.textContent}`.toLocaleLowerCase().includes(query);
      card.classList.toggle('hidden', !match);
      visible += Number(match);
    }
    if (empty) empty.hidden = visible > 0;
    if (count) count.textContent = `${String(visible).padStart(2, '0')} TOPICS`;
  };
  search.addEventListener('input', filter);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      event.preventDefault(); search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = ''; filter(); search.blur();
    }
  });
}
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
if (menu && nav) {
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Open menu');
      nav.classList.remove('open');
    }
  });
}
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();
