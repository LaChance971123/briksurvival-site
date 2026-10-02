/* Scope /offline/ only. Root sw.js remains the provider's advertising worker. */
const CACHE='oz-offline-2026-10-02.1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET')return;event.respondWith(fetch(event.request).catch(async()=>{const c=await caches.open(CACHE);const exact=await c.match(event.request);if(exact)return exact;if(event.request.mode==='navigate')return(await c.match('/offline/'))||Response.error();return Response.error();}));});
