// Verify removal is scoped to OZ offline access, preserving other registrations/data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
  const removedCaches = [], removedWorkers = [];
  const registrations = ['/offline/', '/', '/other-app/'].map(scope => ({
    scope: 'https://ospreyzero.com' + scope,
    unregister: async () => { removedWorkers.push(scope); return true; }
  }));
  const caches = {
    keys: async () => ['oz-offline-2026-10-02.1', 'oz-offline-2026-10-02.2', 'advertising-cache', 'other-app'],
    delete: async key => { removedCaches.push(key); return true; }
  };
  const document = {querySelector: () => null, querySelectorAll: () => []};
  const context = {document, navigator: {serviceWorker: {getRegistrations: async () => registrations}},
    window: {caches}, caches, location: {origin: 'https://ospreyzero.com'}, URL, Promise};
  vm.runInNewContext(fs.readFileSync('app.js', 'utf8'), context);
  await vm.runInNewContext('retireOfflineAccess()', context);
  assert.deepEqual([...new Set(removedWorkers)], ['/offline/']);
  assert.deepEqual([...new Set(removedCaches)].sort(), ['oz-offline-2026-10-02.1', 'oz-offline-2026-10-02.2']);

  const events = {}, navigated = [], workerCaches = [];
  let unregistered = false;
  const retirementCaches = {...caches, delete: async key => { workerCaches.push(key); return true; }};
  const self = {
    addEventListener: (type, fn) => { events[type] = fn; },
    skipWaiting: async () => {},
    location: {origin: 'https://ospreyzero.com'},
    registration: {unregister: async () => { unregistered = true; }},
    clients: {matchAll: async () => ['/offline/', '/library/', '/offline/index.html'].map(path => ({
      url: 'https://ospreyzero.com' + path,
      navigate: async destination => { navigated.push([path, destination]); }
    }))}
  };
  vm.runInNewContext(fs.readFileSync('offline/sw.js', 'utf8'), {self, caches: retirementCaches, URL, Promise});
  assert.equal(events.fetch, undefined, 'Retirement worker must never serve or save old files');
  let activation;
  events.activate({waitUntil: promise => { activation = promise; }});
  await activation;
  assert(unregistered);
  assert.deepEqual(workerCaches.sort(), ['oz-offline-2026-10-02.1', 'oz-offline-2026-10-02.2']);
  assert.deepEqual(navigated, [['/offline/', '/offline/'], ['/offline/index.html', '/offline/']]);
  console.log('PASS: scoped offline cache/worker retirement preserves advertising and unrelated data.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
