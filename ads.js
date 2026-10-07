// Advertising delivery diagnostics describe script loading, never paid impressions.
(() => {
  const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  const readingExceptions = ['/emergencies/disaster-scams', '/emergencies/verify-information'];
  const eligible = /^\/(library|preparedness|guides)(\/|$)/.test(path) || ['/topics', '/resources', '/about', ...readingExceptions].includes(path);
  if (!eligible) return;
  const root = document.documentElement;
  root.dataset.ozAdPolicy = 'vignette';
  // Load early in the head so delivery can initialise before the first interaction.
  const load = (kind, src, zone) => {
    if (document.querySelector(`script[data-oz-ad="${kind}"]`)) return;
    const script = document.createElement('script');
    script.async = true; script.dataset.ozAd = kind; script.dataset.ozState = 'loading';
    if (zone) script.dataset.zone = zone;
    else script.dataset.cfasync = 'false';
    script.src = src;
    script.addEventListener('load', () => { script.dataset.ozState = 'loaded'; });
    script.addEventListener('error', () => { script.dataset.ozState = 'error'; });
    (document.head || document.body || root).appendChild(script);
  };
  document.addEventListener('securitypolicyviolation', event => {
    root.dataset.ozAdCsp = event.effectiveDirective + ':' + event.blockedURI;
  });
  load('vignette', 'https://n6wxm.com/vignette.min.js', '11941449');
  // The separate push-subscription prompt is disabled. Leave the supplied root
  // worker and existing browser permissions unchanged; they are not offline caches.
})();
