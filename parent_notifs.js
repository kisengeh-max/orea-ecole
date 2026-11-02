/* =====================================================================
   ORÉA École v40 — parent_notifs.js
   Cloche 🔔 côté PARENT. Affiche les annonces publiées non lues.
   À charger APRÈS announcements.js sur parent.html.
   Utilise la table « notifications » (RLS : chacun voit/insère les siennes).
   Fournit son propre overlay (bouton Retour Android en phase capture).
   ===================================================================== */
(function () {
    'use strict';
    if (!document.getElementById('pmain')) return; // page école : rien à faire

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
    const PN = { uid: null, rows: [], ch: null, chUid: null, last: 0, busy: false, open: null };

    /* ---------------------------------------------------------------
       Style
       --------------------------------------------------------------- */
    function injectCss() {
        if (document.getElementById('pn-css')) return;
        const s = document.createElement('style');
        s.id = 'pn-css';
        s.textContent = `
header{position:relative}
#pnBell{width:auto;min-height:40px;padding:6px 10px;background:transparent;border:0;color:var(--tx);font-size:20px;line-height:1;position:relative;margin-left:auto;box-shadow:none;border-radius:10px}
#pnBell:active{background:rgba(199,163,75,.12)}
.pn-bdg{position:absolute;top:0;right:0;background:#D93025;color:#fff;font-size:10.5px;font-weight:800;min-width:17px;height:17px;border-radius:9px;padding:0 4px;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 0 0 2px var(--bg)}
.pn-bdg[hidden]{display:none}
.pn-ov{position:fixed;left:0;top:0;width:100%;height:100%;z-index:80;background:var(--bg);color:var(--tx);display:flex;flex-direction:column;animation:pnIn .24s ease;will-change:transform}
@keyframes pnIn{from{transform:translateX(100%);opacity:.6}to{transform:none;opacity:1}}
.pn-head{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:var(--card);border-bottom:1px solid var(--line)}
.pn-head .pn-t{flex:1;min-width:0}
.pn-head b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pn-head small{display:block;color:var(--mut,var(--muted,#a8a495));font-size:12px}
.pn-ov button.pn-ic{width:40px!important;min-height:40px!important;height:40px;padding:0!important;background:transparent!important;box-shadow:none!important;border:0;color:var(--tx);font-size:22px;line-height:1;flex:none}
.pn-ov button.pn-all{width:auto!important;min-height:36px!important;padding:6px 12px!important;font-size:12.5px!important;border-radius:18px!important;flex:none}
.pn-list{flex:1;overflow-y:auto;padding:8px 12px calc(16px + env(safe-area-inset-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.pn-it{background:var(--card);border:1px solid var(--line);border-left:4px solid #3b82f6;border-radius:12px;padding:10px 12px;margin-bottom:8px}
.pn-it.new{box-shadow:0 0 0 1px rgba(199,163,75,.5)}
.pn-it b{display:block;font-size:15px;color:var(--tx)}
.pn-it small{display:block;color:var(--mut,var(--muted,#a8a495));font-size:13px;margin-top:2px;white-space:pre-wrap;overflow-wrap:anywhere}
.pn-it em{display:block;font-style:normal;color:var(--mut,var(--muted,#a8a495));font-size:11.5px;margin-top:4px}
.pn-empty{text-align:center;color:var(--mut,var(--muted,#a8a495));padding:50px 20px;font-size:15px;line-height:1.7}
.pn-toast{position:fixed;left:14px;right:14px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:200;background:#3a2a26;color:#F0EEE6;padding:11px 16px;border-radius:12px;text-align:center;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
@media (prefers-reduced-motion:reduce){.pn-ov{animation:none}}
`;
        document.head.appendChild(s);
    }
    function pnToast(m) {
        const t = document.createElement('div');
        t.className = 'pn-toast'; t.textContent = m;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    /* ---------------------------------------------------------------
       Overlay + bouton Retour Android (propre au parent)
       --------------------------------------------------------------- */
    const STACK = [];
    function overlay(cls) {
        injectCss();
        const el = document.createElement('div');
        el.className = 'pn-ov ' + (cls || '');
        document.body.appendChild(el);
        const vv = window.visualViewport;
        if (vv) {
            const f = () => { el.style.height = vv.height + 'px'; el.style.transform = 'translateY(' + vv.offsetTop + 'px)'; };
            f();
            vv.addEventListener('resize', f); vv.addEventListener('scroll', f);
            el._fit = () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
        }
        STACK.push(el);
        history.pushState({ pn: STACK.length }, '');
        return el;
    }
    function closeTop() {
        const el = STACK.pop();
        if (!el) return;
        if (el._cleanup) el._cleanup();
        if (el._fit) el._fit();
        el.remove();
    }
    // parent.js n'a pas de gestion popstate, mais on bloque au cas où.
    window.addEventListener('popstate', e => {
        const d = document.getElementById('pdlg');
        if (d && d.open) return;
        if (STACK.length) { e.stopImmediatePropagation(); closeTop(); }
    }, true);
    const back = () => history.back();

    /* ---------------------------------------------------------------
       Données
       --------------------------------------------------------------- */
    async function load() {
        const { data, error } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) { console.warn('parent_notifs:', error.message); return false; }
        PN.rows = data || [];
        return true;
    }
    const visible = () => PN.rows.filter(n => !n.resolved_at && !(n.category === 'info' && n.read_at));
    const unreadCount = () => visible().filter(n => !n.read_at).length;

    // Crée une notification pour chaque annonce publiée non encore « consignée » côté parent.
    // dedupe_key = 'ann:<id>' : une seule notification par annonce et par parent.
    async function syncAnnouncements(force) {
        if (PN.busy) return;
        if (!force && Date.now() - PN.last < 120000) return;
        PN.busy = true;
        try {
            const { data: ses } = await db.auth.getSession();
            const uid = ses && ses.session && ses.session.user && ses.session.user.id;
            if (!uid) return;
            if (PN.uid !== uid) { PN.rows = []; PN.uid = uid; subscribe(); }
            if (!await load()) return;

            // Annonces publiées de mes écoles (via RPC parent_announcements)
            const { data: anns, error: e2 } = await db.rpc('parent_announcements');
            if (e2) { console.warn('parent_notifs annonces:', e2.message); return; }
            const pub = (anns || []).filter(a => a.status === 'published' && a.school_id);
            const have = new Set(PN.rows.map(r => r.dedupe_key).filter(Boolean));
            const add = pub
                .filter(a => !have.has('ann:' + a.id))
                .map(a => ({
                    school_id: a.school_id,
                    category: 'info',
                    kind: 'ann',
                    title: '📣 ' + (a.title || 'Annonce'),
                    body: String(a.content || '').slice(0, 400),
                    dedupe_key: 'ann:' + a.id,
                    meta: { announcement_id: a.id }
                }));
            if (add.length) {
                const { error } = await db.from('notifications').insert(add);
                if (error) { console.warn('parent_notifs insert:', error.message); return; }
                await load();
            }
        } catch (e) { console.warn('parent_notifs', e); }
        finally { PN.last = Date.now(); PN.busy = false; paintBell(); if (PN.open) draw(); }
    }

    // Temps réel : une nouvelle notification apparaît sans recharger
    const reloadSoon = debounce(async () => { if (await load()) { paintBell(); if (PN.open) draw(); } }, 500);
    function subscribe() {
        if (PN.ch && PN.chUid === PN.uid) return;
        if (PN.ch) { try { db.removeChannel(PN.ch); } catch (_) { } }
        PN.chUid = PN.uid;
        PN.ch = db.channel('pn-' + PN.uid)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + PN.uid }, reloadSoon)
            .subscribe();
    }

    /* ---------------------------------------------------------------
       Cloche
       --------------------------------------------------------------- */
    function ensureBell() {
        injectCss();
        if (document.getElementById('pnBell')) return;
        const h = document.querySelector('header');
        if (!h) return;
        h.insertAdjacentHTML('beforeend', '<button id="pnBell" aria-label="Notifications">🔔<span class="pn-bdg" hidden></span></button>');
        document.getElementById('pnBell').onclick = openPanel;
        paintBell();
    }
    function paintBell() {
        const n = unreadCount(), b = document.querySelector('#pnBell .pn-bdg');
        if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
    }

    /* ---------------------------------------------------------------
       Panneau
       --------------------------------------------------------------- */
    const when = d => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
    function item(n) {
        return `<div class="pn-it${n.read_at ? '' : ' new'}" data-id="${esc(n.id)}"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<em>${esc(when(n.created_at))}</em></div>`;
    }
    function draw() {
        const ov = PN.open; if (!ov) return;
        const box = ov.querySelector('#pn-list'), L = visible(), u = L.filter(n => !n.read_at).length;
        ov.querySelector('#pn-sub').textContent = u ? u + ' non lue' + (u > 1 ? 's' : '') : 'Tout est lu';
        if (!L.length) { box.innerHTML = '<div class="pn-empty">🎉<br>Rien de nouveau.<br><small>Les annonces de l’école apparaîtront ici.</small></div>'; return; }
        box.innerHTML = L.map(item).join('');
    }
    function openPanel() {
        if (PN.open) return;
        const ov = overlay('pn-panel');
        PN.open = ov;
        ov._cleanup = () => { PN.open = null; paintBell(); };
        ov.innerHTML = '<div class="pn-head"><button class="pn-ic" data-a="back" aria-label="Retour">←</button><div class="pn-t"><b>Notifications</b><small id="pn-sub"></small></div><button class="pn-all" data-a="all">Tout marquer comme lu</button></div><div class="pn-list" id="pn-list"></div>';
        ov.addEventListener('click', e => {
            const b = e.target.closest('[data-a]'), it = e.target.closest('.pn-it');
            if (b) {
                const a = b.dataset.a, id = it && it.dataset.id;
                if (a === 'back') return back();
                if (a === 'all') return markAll();
                if (a === 'read' && id) return markRead([id]);
                return;
            }
            if (it && it.classList.contains('new')) markRead([it.dataset.id]);
        });
        draw();
        syncAnnouncements(true);
    }

    async function markRead(ids) {
        const t = new Date().toISOString();
        PN.rows.forEach(n => { if (ids.includes(n.id) && !n.read_at) n.read_at = t; });
        paintBell(); if (PN.open) draw();
        const { error } = await db.from('notifications').update({ read_at: t }).in('id', ids);
        if (error) pnToast(error.message);
    }
    function markAll() {
        const ids = visible().filter(n => !n.read_at).map(n => n.id);
        if (!ids.length) return pnToast('Tout est déjà lu.');
        markRead(ids);
    }

    /* ---------------------------------------------------------------
       Démarrage : dès que l'utilisateur est connu
       --------------------------------------------------------------- */
    async function boot() {
        const { data } = await db.auth.getSession();
        const uid = data && data.session && data.session.user && data.session.user.id;
        if (!uid) return;
        PN.uid = uid;
        ensureBell();
        await syncAnnouncements(true);
        subscribe();
    }
    db.auth.onAuthStateChange((ev, ses) => {
        setTimeout(() => {
            if (ses && ses.user) { PN.uid = ses.user.id; ensureBell(); syncAnnouncements(false); subscribe(); }
            else { PN.uid = null; try { if (PN.ch) db.removeChannel(PN.ch); } catch (_) { } PN.ch = null; PN.rows = []; paintBell(); }
        }, 0);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && PN.uid) { paintBell(); syncAnnouncements(false); } });
    setInterval(() => { if (PN.uid) syncAnnouncements(false); }, 120000);

    // relance après les changements d'écran du parent
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__pn) return;
        const w = fn(o); w.__pn = true; window[name] = w;
    };
    hook('render', o => function () {
        const r = o.apply(this, arguments);
        try { ensureBell(); paintBell(); } catch (e) { console.error('parent_notifs', e); }
        return r;
    });

    // Au cas où le parent.js a déjà rendu l'écran avant le chargement
    try { boot(); } catch (_) { }
})();
