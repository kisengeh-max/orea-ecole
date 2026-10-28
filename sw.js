const V='orea-v10',CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',F=['./','index.html','style.css','app.js','config.js','manifest.json','logo-dark.png','logo-light.png','icon-192.png',CDN];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(F.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||(u.origin!==location.origin&&u.href!==CDN))return;
const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);
e.respondWith(fetch(e.request,{signal:c.signal}).then(r=>{clearTimeout(t);if(r.ok||r.type==='opaque'){const k=r.clone();caches.open(V).then(x=>x.put(e.request,k))}return r}).catch(()=>{clearTimeout(t);return caches.match(e.request,{ignoreSearch:true})}))});
