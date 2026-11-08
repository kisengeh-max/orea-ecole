const V='orea-v91',CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',F=['./','index.html','parent.html','style.css','parent.css','app.js','finance.js','equipe.js','personnel.js','test.js','offline.js','cahier.js','parent.js','parent_notes.js','ambassadeur.js','ambadmin.js','reminders.js','notes.js','bulletins.js','scan.js','config.js','auth_ui.js','messages.js','notifications.js','push.js','parent_notifs.js','timetable.js','villes.js','quotidien.js','famille.js','installcheck.js','stats.js','enafep.js','ui.js','bureau.js','bureau.css','announcements.js','quiz_engine.js','quiz_ui.js','manifest.json','manifest-parent.json','verif.html','icon-maskable-192.png','icon-maskable-512.png','logo-dark.png','logo-light.png','icon-192.png','icon-512.png',CDN,'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'];

self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(F.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));

self.addEventListener('fetch',e=>{
    const u=new URL(e.request.url);
    if(e.request.method!=='GET'||(u.origin!==location.origin&&u.href!==CDN&&!u.href.includes('qrcode')&&!u.href.includes('html5-qrcode')))return;
    const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);
    e.respondWith(fetch(e.request,{signal:c.signal}).then(r=>{clearTimeout(t);if(r.ok||r.type==='opaque'){const k=r.clone();caches.open(V).then(x=>x.put(e.request,k))}return r}).catch(()=>{clearTimeout(t);return caches.match(e.request,{ignoreSearch:true})}))
});

// --- Notifications Push (v73) ---
// Message reçu de la fonction send-push : { title, body, url, tag }
self.addEventListener('push', function (event) {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'ORÉA École', body: event.data ? event.data.text() : '' }; }
    const options = {
        body: data.body || '',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || './' },
        tag: data.tag || 'orea-notif', // une notification par nouveauté (elles ne s'écrasent plus)
        renotify: true
    };
    event.waitUntil(self.registration.showNotification(data.title || 'ORÉA École', options));
});

// Toucher la notification : ouvre (ou ramène au premier plan) la bonne page
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
    const page = u => new URL(u).pathname.replace(/\/index\.html$/, '/');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
            for (const c of list) {
                if (page(c.url) === page(target) && 'focus' in c) return c.focus();
            }
            for (const c of list) {
                if ('navigate' in c && 'focus' in c) return c.navigate(target).then(w => (w || c).focus()).catch(() => clients.openWindow(target));
            }
            return clients.openWindow ? clients.openWindow(target) : undefined;
        })
    );
});
