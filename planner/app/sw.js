'use strict';
const CACHE='oz-launcher-2.0-2db9b94c06ad',FILES=['./','./index.html','./launcher.js','./launcher.css','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./body.woff2','./display.woff2','./LICENSES.txt'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('oz-launcher-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){return await cache.match('./index.html')||fetch(event.request);}return await cache.match(event.request)||fetch(event.request);})());});
