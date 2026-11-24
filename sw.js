const CACHE_NAME='houseplan-studio-offline-v18';
const APP_FILES=[
  './', './index.html', './styles.css', './mobile.css?v=roomstyle1',
  './geometry.js?v=update2', './project-store.js?v=update1', './mesh-import.js?v=update3', './room-finishes.js?v=roomstyle1', './depth-render.js?v=roomstyle1', './walk-navigation.js?v=doorfix1', './app.js?v=roomstyle1',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('houseplan-studio-offline-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{})}
    return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
});
