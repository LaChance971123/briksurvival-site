/* Retirement worker only. It never saves files or handles fetch requests. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('oz-offline-')).map(key => caches.delete(key)));
  await self.registration.unregister();
  const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  await Promise.all(clients.filter(client => {
    const url = new URL(client.url);
    return url.origin === self.location.origin && url.pathname.startsWith('/offline/');
  }).map(client => client.navigate('/offline/')));
})()));
