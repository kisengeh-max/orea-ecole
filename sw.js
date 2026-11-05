const V='orea-v67',CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',F=['./','index.html','parent.html','style.css','parent.css','app.js','finance.js','equipe.js','parent.js','parent_notes.js','ambassadeur.js','ambadmin.js','reminders.js','notes.js','bulletins.js','scan.js','config.js','auth_ui.js','messages.js','notifications.js','parent_notifs.js','timetable.js','villes.js','announcements.js','quiz_engine.js','quiz_ui.js','manifest.json','logo-dark.png','logo-light.png','icon-192.png','icon-512.png',CDN,'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'];

self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(F.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));

self.addEventListener('fetch',e=>{
    const u=new URL(e.request.url);
    if(e.request.method!=='GET'||(u.origin!==location.origin&&u.href!==CDN&&!u.href.includes('qrcode')&&!u.href.includes('html5-qrcode')))return;
    const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);
    e.respondWith(fetch(e.request,{signal:c.signal}).then(r=>{clearTimeout(t);if(r.ok||r.type==='opaque'){const k=r.clone();caches.open(V).then(x=>x.put(e.request,k))}return r}).catch(()=>{clearTimeout(t);return caches.match(e.request,{ignoreSearch:true})}))
});

// --- NOUVEAU : Gestion des notifications Push ---
self.addEventListener('push', function(event) {
    let data = {};
    try { data = event.data.json(); } catch (e) { data = { title: 'ORÉA École', body: 'Nouvelle notification' }; }
    
    const options = {
        body: data.body || '',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200], // Fait vibrer le téléphone
        data: { url: data.url || './' }, // Où aller quand on clique
        tag: data.tag || 'orea-notif',
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'ORÉA École', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url || './';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // Si une fenêtre est déjà ouverte, on la focus
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Sinon on en ouvre une nouvelle
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
