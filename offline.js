/* =====================================================================
   ORÉA École v91 — offline.js : mode avion (base de données locale)
   - Chaque lecture réussie (élèves, classes, cotes, horaires, devoirs,
     annonces, soldes…) est gardée sur le téléphone (IndexedDB).
     Sans réseau, l'application relit ces données : elle s'ouvre et
     s'utilise même en mode avion.
   - Sans réseau, les ajouts suivants sont mis en file d'attente puis envoyés
     tout seuls au retour du réseau : présences, cotes, devoirs, cahier de
     textes, sorties d'élèves, scans du gardien (les paiements ont déjà
     leur propre file dans app.js).
   - Après 72 h sans connexion : bandeau rouge « Connectez-vous pour ne pas
     perdre vos données ».
   Chargé par index.html et parent.html AVANT app.js / parent.js (juste après
   la bibliothèque Supabase et config.js) : le client « db » est équipé dès
   sa création, donc même les toutes premières lectures passent par ici.
   ===================================================================== */
(function () {
    'use strict';
    if (!window.supabase || !supabase.createClient || !window.indexedDB) return;
    let from0 = null, rpc0 = null, client = null;

    const H72 = 72 * 3600e3;
    const QOK = new Set(['attendance', 'attendance_logs', 'assignments', 'lesson_log', 'grades', 'pickups']);   // ajouts possibles hors ligne
    const QRPC = new Set(['v91_scan']);                                                                          // actions possibles hors ligne
    // Fonctions qui MODIFIENT : jamais servies depuis la mémoire du téléphone
    const WRPC = /(^|_)(set|add|create|delete|del|pay|unpay|give|link|report|cancel|extend|block|close|exit|view|sync|checkin|save|update|insert|remove|revoke|join|mark|read|send|upsert|restore|toggle|decide|request|assign|generer|verifier|push|notify|touch|import|archive|move|clear|bill|scan|reply|pin|accept|refuse|approve|reset|rename|signup|submit|vote|answer|finish|start|draw|record)(_|$)/i;
    const NETRX = /fetch|network|abort|load failed|timed? ?out/i;
    const isNetErr = e => !!e && (e.name === 'TypeError' || e.name === 'AuthRetryableFetchError' || e.status === 0 || NETRX.test(e.message || String(e)));
    const OFFERR = () => ({ data: null, error: { message: 'Failed to fetch : hors connexion, ces données ne sont pas encore sur ce téléphone.', code: 'OFFLINE', status: 0 } });

    /* ---------- Mémoire du téléphone (IndexedDB) ---------- */
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, ko) => {
        const r = indexedDB.open('orea_offline', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    }));
    const store = (mode, fn) => open().then(d => new Promise((ok, ko) => {
        const t = d.transaction('kv', mode), s = t.objectStore('kv'), r = fn(s);
        t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
    }));
    const kget = k => store('readonly', s => s.get(k)).catch(() => undefined);
    const kset = (k, v) => store('readwrite', s => s.put(v, k)).catch(() => { });
    const kclear = () => store('readwrite', s => s.clear()).catch(() => { });

    /* ---------- État du réseau ---------- */
    let UID = null, lastFail = 0;
    try { const t = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k)); if (t) UID = (JSON.parse(localStorage.getItem(t)) || {}).user?.id || null; } catch (_) { }

    const isOff = () => !navigator.onLine || Date.now() - lastFail < 15000;
    const markOff = () => { lastFail = Date.now(); paint(); };
    let pt = 0; const soon = () => { clearTimeout(pt); pt = setTimeout(paint, 300); };
    let okThrottle = 0;
    const markOn = () => { lastFail = 0; if (Date.now() - okThrottle > 30000) { okThrottle = Date.now(); try { localStorage.setItem('orea_net_ok', String(Date.now())); } catch (_) { } } };

    /* ---------- File d'envoi ---------- */
    const QK = 'orea_q2';
    const qread = () => { try { return JSON.parse(localStorage.getItem(QK) || '[]'); } catch (_) { return []; } };
    const qwrite = a => { try { localStorage.setItem(QK, JSON.stringify(a)); } catch (_) { } paint(); };
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
    function queueWrite(t, op, args, chain) {
        let rows = args[0], opts = args[1] || null;
        const many = Array.isArray(rows);
        rows = (many ? rows : [rows]).map(r => Object.assign({ id: uuid() }, r));
        const a = qread(); a.push({ k: 'w', t, op, rows, opts, at: Date.now(), uid: UID }); qwrite(a);
        const single = chain.some(c => c[0] === 'single' || c[0] === 'maybeSingle');
        return { data: single ? rows[0] : rows, error: null, offline: true };
    }
    function queueRpc(name, args) {
        const a = qread(); const x = Object.assign({}, args || {}); if (!x.p_at) x.p_at = new Date().toISOString();
        a.push({ k: 'r', name, args: x, at: Date.now(), uid: UID }); qwrite(a);
        return { data: { offline: true }, error: null, offline: true };
    }
    let flushing = false;
    let flush = async function () {
        if (flushing || isOff()) return;
        const all = qread(); if (!all.length) return;
        flushing = true; let sent = 0, failed = 0;
        try {
            const keep = [];
            for (let i = 0; i < all.length; i++) {
                const it = all[i];
                if (it.uid && UID && it.uid !== UID) { keep.push(it); continue; }   // autre compte sur ce téléphone : on garde
                if (it.err) { keep.push(it); continue; }
                let r;
                try {
                    if (it.k === 'r') r = await rpc0(it.name, it.args);
                    else { let b = from0(it.t); b = it.op === 'upsert' ? b.upsert(it.rows, it.opts || undefined) : b.insert(it.rows); r = await b; }
                } catch (e) { r = { error: e }; }
                if (r && r.error && isNetErr(r.error)) { markOff(); keep.push(...all.slice(i)); break; }
                if (r && r.error && r.error.code !== '23505') { failed++; keep.push(Object.assign({}, it, { err: r.error.message || 'Erreur' })); continue; }
                sent++;
            }
            qwrite(keep);
        } finally { flushing = false; }
        if (sent && typeof toast === 'function') toast(sent + ' enregistrement' + (sent > 1 ? 's' : '') + ' hors connexion envoyé' + (sent > 1 ? 's' : '') + ' ✓');
        if (failed && typeof toast === 'function') toast(failed + ' enregistrement(s) refusé(s) par le serveur : voir le bandeau.');
    }

    /* ---------- Lectures / écritures à travers la mémoire ---------- */
    const WRITE = new Set(['insert', 'update', 'upsert', 'delete']);
    const keyOf = (pre, a, b) => { try { return pre + ':' + (UID || '?') + ':' + a + ':' + JSON.stringify(b); } catch (_) { return null; } };
    const thenable = (run, chain) => {
        let pr = null; const go = () => pr || (pr = run());
        const p = new Proxy(function () { }, {
            get(o, k) {
                if (k === 'then') return (a, b) => go().then(a, b);
                if (k === 'catch') return b => go().catch(b);
                if (k === 'finally') return f => go().finally(f);
                return (...args) => { chain.push([k, args]); return p; };
            }
        });
        return p;
    };
    const wrapFrom = function (t) {
        const chain = [];
        const run = async () => {
            const w = chain.find(c => WRITE.has(c[0]));
            const build = () => { let b = from0(t); for (const [m, a] of chain) b = b[m](...a); return b; };
            if (!w) {   // lecture
                const key = keyOf('f', t, chain);
                if (isOff()) { soon(); const c = key && await kget(key); return c ? c.r : OFFERR(); }
                try {
                    const r = await build();
                    if (r && r.error && isNetErr(r.error)) { markOff(); const c = key && await kget(key); return c ? c.r : r; }
                    if (r && !r.error) { markOn(); if (key) kset(key, { r: { data: r.data, error: null, count: r.count ?? null, status: r.status }, at: Date.now() }); }
                    return r;
                } catch (e) { if (isNetErr(e)) { markOff(); const c = key && await kget(key); if (c) return c.r; return OFFERR(); } throw e; }
            }
            const can = QOK.has(t) && (w[0] === 'insert' || w[0] === 'upsert');
            if (isOff()) return can ? queueWrite(t, w[0], w[1], chain) : { data: null, error: { message: 'Hors connexion : cette modification demande internet.', code: 'OFFLINE' } };
            try {
                const r = await build();
                if (r && r.error && isNetErr(r.error)) { markOff(); if (can) return queueWrite(t, w[0], w[1], chain); }
                else if (r && !r.error) markOn();
                return r;
            } catch (e) { if (isNetErr(e)) { markOff(); if (can) return queueWrite(t, w[0], w[1], chain); } throw e; }
        };
        return thenable(run, chain);
    };
    const wrapRpc = function (name, args, opts) {
        const chain = [];
        const run = async () => {
            const write = WRPC.test(name), key = write ? null : keyOf('r', name, [args || null, chain]);
            const build = () => { let b = rpc0(name, args, opts); for (const [m, a] of chain) b = b[m](...a); return b; };
            if (isOff()) {
                if (QRPC.has(name)) return queueRpc(name, args);
                const c = key && await kget(key); return c ? c.r : OFFERR();
            }
            try {
                const r = await build();
                if (r && r.error && isNetErr(r.error)) { markOff(); if (QRPC.has(name)) return queueRpc(name, args); const c = key && await kget(key); return c ? c.r : r; }
                if (r && !r.error) { markOn(); if (key) kset(key, { r: { data: r.data, error: null }, at: Date.now() }); }
                return r;
            } catch (e) { if (isNetErr(e)) { markOff(); if (QRPC.has(name)) return queueRpc(name, args); const c = key && await kget(key); if (c) return c.r; return OFFERR(); } throw e; }
        };
        return thenable(run, chain);
    };

    // Le client Supabase est équipé au moment où app.js / parent.js le crée
    const cc = supabase.createClient.bind(supabase);
    supabase.createClient = function () {
        const c = cc.apply(null, arguments);
        if (client) return c;   // un seul client équipé
        client = c; from0 = c.from.bind(c); rpc0 = c.rpc.bind(c);
        c.from = wrapFrom; c.rpc = wrapRpc;
        try { c.auth.onAuthStateChange((ev, ses) => { const u = ses && ses.user ? ses.user.id : null; if (ev === 'SIGNED_OUT') kclear(); if (u) UID = u; }); } catch (_) { }
        return c;
    };

    /* ---------- Bandeau ---------- */
    const css = document.createElement('style');
    css.textContent = '#off-bar{position:sticky;top:0;z-index:940;padding:8px 12px;font:600 13px/1.35 system-ui,sans-serif;text-align:center;color:#fff;background:#4b5563}#off-bar.red{background:#b91c1c}#off-bar button{width:auto;min-height:30px;margin:4px 0 0 6px;padding:2px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.15);color:#fff;font:700 12px system-ui,sans-serif;box-shadow:none}';
    document.head.appendChild(css);
    function paint() {
        if (!document.body) return;
        const q = qread(), pend = q.filter(x => !x.err).length, bad = q.filter(x => x.err).length;
        const okAt = +localStorage.getItem('orea_net_ok') || 0, old = okAt && Date.now() - okAt > H72;
        let b = document.getElementById('off-bar');
        const off = isOff();
        if (!off && !bad) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('div'); b.id = 'off-bar'; document.body.prepend(b); }
        b.className = old && off ? 'red' : '';
        let h = '';
        if (off && old) h = '⚠️ Plus de 72 h sans connexion. Connectez-vous à internet pour enregistrer vos données et ne pas les perdre.';
        else if (off) h = '📴 Hors connexion : vous pouvez continuer, tout sera envoyé au retour du réseau.';
        if (pend) h += ` <b>${pend} en attente.</b>`;
        if (bad) h += ` <b>${bad} refusé(s)</b><button type="button" id="off-see">Voir</button>`;
        b.innerHTML = h.trim();
        const s = b.querySelector('#off-see'); if (s) s.onclick = showBad;
    }
    function showBad() {
        const a = qread(), bad = a.filter(x => x.err);
        const lbl = x => x.k === 'r' ? 'Scan' : ({ attendance: 'Présence', attendance_logs: 'Entrée/sortie', assignments: 'Devoir', lesson_log: 'Cahier de textes', grades: 'Cote', pickups: 'Sortie d’élève' }[x.t] || x.t);
        const txt = bad.map(x => '• ' + lbl(x) + ' du ' + new Date(x.at).toLocaleString('fr-FR') + ' : ' + x.err).join('\n');
        if (confirm('Enregistrements refusés par le serveur :\n\n' + txt + '\n\nOK = les retirer de la liste. Annuler = les garder.')) qwrite(a.filter(x => !x.err));
    }

    window.addEventListener('online', () => { lastFail = 0; paint(); setTimeout(flush, 1500); });
    window.addEventListener('offline', paint);
    setInterval(() => { paint(); flush(); }, 45000);
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => { paint(); setTimeout(flush, 4000); }) : (paint(), setTimeout(flush, 4000));
    const flush0 = flush; flush = async () => { if (from0) return flush0(); };

    window.oreaOffline = { isOff, flush, pending: () => qread().filter(x => !x.err).length, paint };
})();
