/* =====================================================================
   ORÉA École v40 — notifications.js
   Cloche 🔔 dans l'en-tête + panneau qui glisse, notifications groupées :
     🔴 Urgent  : reste jusqu'au renouvellement (abonnement)
     🟠 À faire : reste jusqu'à ce que ce soit fait (sauvegarde)
     🔵 Info    : disparaît après lecture (début de trimestre)
   Boutons : « Tout marquer comme lu » et « ⏰ Plus tard » (snoozed_until).
   Table Supabase « notifications » (RLS : chacun voit les siennes).
   Page école uniquement (directeur, enseignant, percepteur).
   À charger APRÈS app.js et reminders.js, AVANT announcements.js.
   Fournit aussi window.OreaOv (écrans plein écran + bouton Retour Android)
   réutilisé par announcements.js.
   ===================================================================== */
(function () {
    'use strict';
    if (document.getElementById('pmain')) return; // page parent : pas de cloche

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
    const STAFF = ['directeur', 'enseignant', 'percepteur'];
    const NT = { uid: null, rows: [], ch: null, chUid: null, last: 0, busy: false, open: null };
    const isStaff = () => typeof S !== 'undefined' && !!S.me && !!S.school && STAFF.includes(S.me.role);

    /* ---------------------------------------------------------------
       Style
       --------------------------------------------------------------- */
    function injectCss() {
        if (document.getElementById('nt-css')) return;
        const s = document.createElement('style');
        s.id = 'nt-css';
        s.textContent = `
#nav button{position:relative}
.nt-ov{position:fixed;left:0;top:0;width:100%;height:100%;z-index:80;background:var(--bg);color:var(--tx);display:flex;flex-direction:column;animation:ntIn .24s ease;will-change:transform}
@keyframes ntIn{from{transform:translateX(100%);opacity:.6}to{transform:none;opacity:1}}
.nt-head{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:var(--card);border-bottom:1px solid var(--line)}
.nt-head .nt-t{flex:1;min-width:0}
.nt-head b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nt-head small{display:block;color:var(--mut);font-size:12px}
.nt-ov button.nt-ic{width:40px!important;min-height:40px!important;height:40px;padding:0!important;background:transparent!important;box-shadow:none!important;border:0;color:var(--tx);font-size:22px;line-height:1;flex:none}
.nt-ov button.nt-all{width:auto!important;min-height:36px!important;padding:6px 12px!important;font-size:12.5px!important;border-radius:18px!important;flex:none}
.nt-list{flex:1;overflow-y:auto;padding:8px 12px calc(16px + env(safe-area-inset-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.nt-grp{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);padding:12px 2px 6px}
.nt-grp span{color:var(--mut);font-weight:600;margin-left:4px}
.nt-it{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--mut);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.nt-it.urgent{border-left-color:#E5484D}
.nt-it.action{border-left-color:#E08A1E}
.nt-it.info{border-left-color:#3b82f6}
.nt-it.new{box-shadow:0 0 0 1px rgba(199,163,75,.5)}
.nt-it b{display:block;font-size:15px}
.nt-it small{display:block;color:var(--mut);font-size:13px;margin-top:2px}
.nt-it em{display:block;font-style:normal;color:var(--mut);font-size:11.5px;margin-top:3px}
.nt-btns{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.nt-btns button{width:auto!important;min-height:36px!important;padding:6px 14px!important;font-size:13px!important;border-radius:18px!important}
.nt-empty{text-align:center;color:var(--mut);padding:50px 20px;font-size:15px;line-height:1.7}
.nt-bdg{position:absolute;top:2px;right:-2px;background:#D93025;color:#fff;font-size:10.5px;font-weight:800;min-width:17px;height:17px;border-radius:9px;padding:0 4px;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 0 0 2px var(--bg)}
.nt-bdg[hidden]{display:none}
.nt-sheet-bg{position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:10;display:flex;align-items:flex-end}
.nt-sheet{width:100%;background:var(--card);border-radius:18px 18px 0 0;padding:14px 12px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px}
.nt-toast{position:fixed;left:14px;right:14px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:200;background:#3a2a26;color:#F0EEE6;padding:11px 16px;border-radius:12px;text-align:center;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
@media (prefers-reduced-motion:reduce){.nt-ov{animation:none}}
`;
        document.head.appendChild(s);
    }
    function ntToast(m) {
        const t = document.createElement('div');
        t.className = 'nt-toast'; t.textContent = m;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    /* ---------------------------------------------------------------
       Écrans plein écran + bouton « Retour » d'Android
       (même principe que messages.js ; partagé via window.OreaOv)
       --------------------------------------------------------------- */
    const STACK = [];
    function overlay(cls) {
        injectCss();
        const el = document.createElement('div');
        el.className = 'nt-ov ' + (cls || '');
        document.body.appendChild(el);
        const vv = window.visualViewport;
        if (vv) {
            const f = () => { el.style.height = vv.height + 'px'; el.style.transform = 'translateY(' + vv.offsetTop + 'px)'; };
            f();
            vv.addEventListener('resize', f); vv.addEventListener('scroll', f);
            el._fit = () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
        }
        STACK.push(el);
        history.pushState({ nt: STACK.length }, '');
        return el;
    }
    function closeTop() {
        const el = STACK.pop();
        if (!el) return;
        if (el._cleanup) el._cleanup();
        if (el._fit) el._fit();
        el.remove();
    }
    // Phase de capture : on bloque le « retour » d'app.js tant qu'un de nos écrans est ouvert.
    // Si une boîte de dialogue d'app.js est ouverte, on la laisse gérer.
    window.addEventListener('popstate', e => {
        const d = document.getElementById('dlg');
        if (d && d.open) return;
        if (STACK.length) { e.stopImmediatePropagation(); closeTop(); }
    }, true);
    const back = () => history.back();
    window.OreaOv = { overlay, closeTop, back, toast: ntToast, injectCss };

    /* ---------------------------------------------------------------
       Données : lecture, règles d'affichage
       --------------------------------------------------------------- */
    async function load() {
        const { data, error } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) { console.warn('notifications:', error.message); return false; }
        NT.rows = data || [];
        return true;
    }
    function visible() {
        const now = Date.now();
        return NT.rows.filter(n => {
            if (n.resolved_at) return false;
            if (n.snoozed_until && new Date(n.snoozed_until) > now) return false;
            if (n.category === 'info' && n.read_at) return false; // l'info disparaît après lecture
            return true;
        });
    }
    const unreadCount = () => visible().filter(n => !n.read_at).length;

    /* ---------------------------------------------------------------
       Création automatique des rappels (sans doublon grâce à dedupe_key)
       --------------------------------------------------------------- */
    const backupDue = () => {
        const a = bkAge(), is1st = new Date().getDate() === 1;
        return a === null || a >= 30 || (is1st && a > 0);
    };
    function candidates() {
        const out = [], R = S.me.role, today = tdy();
        if (R === 'directeur') {
            // 🟠 Sauvegarde (rappel conservé)
            if (backupDue()) {
                const a = bkAge(), is1st = new Date().getDate() === 1;
                out.push({ category: 'action', kind: 'backup', title: 'Sauvegarde' + (is1st ? ' du mois' : ' conseillée'),
                    body: a === null ? 'Aucune sauvegarde faite.' : 'Dernière sauvegarde il y a ' + a + ' jour' + (a > 1 ? 's' : '') + '.',
                    dedupe_key: 'backup:' + today.slice(0, 7) });
            }
            // 🔴 Abonnement : rappel dès J-10, puis « expiré »
            const until = S.school.sub_until ? String(S.school.sub_until).slice(0, 10) : '', n = subLeft();
            if (until && n <= 0) out.push({ category: 'urgent', kind: 'sub_exp', title: 'Abonnement expiré', body: 'Contacte l’administrateur pour renouveler.', dedupe_key: 'sub_exp:' + until });
            else if (until && n <= 10) out.push({ category: 'urgent', kind: 'sub_end', title: 'Abonnement bientôt terminé', body: 'Il reste ' + n + ' jour' + (n > 1 ? 's' : '') + '.', dedupe_key: 'sub_end:' + until });
        }
        // 🔵 Début de trimestre (tous les rôles de l'équipe)
        if (typeof hasTerms === 'function' && hasTerms()) {
            const t = (S.terms && S.terms[S.year]) || {}, tm = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE');
            [t.t1, t.t2, t.t3].forEach((d, i) => {
                if (!d) return;
                if (d === today) out.push({ category: 'info', kind: 'term', title: 'Début du trimestre ' + (i + 1), body: 'Le trimestre commence aujourd’hui.', dedupe_key: 'term:' + S.year + ':' + i + ':d' });
                else if (d === tm) out.push({ category: 'info', kind: 'term', title: 'Début du trimestre ' + (i + 1) + ' demain', body: 'Prépare les encaissements.', dedupe_key: 'term:' + S.year + ':' + i + ':j1' });
            });
        }
        return out;
    }
    // Rappels devenus inutiles : on les marque « résolus »
    function staleIds() {
        const res = [], R = S.me.role, n = subLeft(), until = S.school.sub_until ? String(S.school.sub_until).slice(0, 10) : '';
        NT.rows.filter(r => !r.resolved_at).forEach(r => {
            const keyDate = String(r.dedupe_key || '').split(':')[1] || '';
            if (r.kind === 'backup' && (R !== 'directeur' || !backupDue())) res.push(r.id);
            else if (r.kind === 'sub_end' && (R !== 'directeur' || n <= 0 || n > 10 || keyDate !== until)) res.push(r.id);
            else if (r.kind === 'sub_exp' && (R !== 'directeur' || n > 0 || keyDate !== until)) res.push(r.id);
            else if (r.category === 'info' && Date.now() - new Date(r.created_at) > 7 * 864e5) res.push(r.id);
        });
        return res;
    }

    async function sync(force) {
        if (!isStaff() || NT.busy) return;
        if (!force && Date.now() - NT.last < 300000) return;
        NT.busy = true;
        try {
            if (NT.uid && NT.uid !== S.me.id) NT.rows = [];
            NT.uid = S.me.id; subscribe();
            if (!await load()) return;
            const have = new Set(NT.rows.map(r => r.dedupe_key).filter(Boolean));
            const add = candidates().filter(c => !have.has(c.dedupe_key)).map(c => Object.assign({ school_id: S.school.id }, c));
            let changed = false;
            if (add.length) {
                const { error } = await db.from('notifications').insert(add);
                if (error) { // doublon simultané : on réessaie un par un
                    for (const r of add) { const x = await db.from('notifications').insert(r); if (x.error && x.error.code !== '23505') console.warn('notifications:', x.error.message); }
                }
                changed = true;
            }
            const res = staleIds();
            if (res.length) { await db.from('notifications').update({ resolved_at: new Date().toISOString() }).in('id', res); changed = true; }
            if (changed) await load();
        } catch (e) { console.warn('notifications', e); }
        finally { NT.last = Date.now(); NT.busy = false; paintBell(); if (NT.open) draw(); }
    }

    // Temps réel : une nouvelle notification apparaît sans recharger
    const reloadSoon = debounce(async () => { if (await load()) { paintBell(); if (NT.open) draw(); } }, 500);
    function subscribe() {
        if (NT.ch && NT.chUid === NT.uid) return;
        if (NT.ch) { try { db.removeChannel(NT.ch); } catch (_) { } }
        NT.chUid = NT.uid;
        NT.ch = db.channel('nt-' + NT.uid)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + NT.uid }, reloadSoon)
            .subscribe();
    }

    /* ---------------------------------------------------------------
       Cloche 🔔 (à droite de la loupe 🔍)
       --------------------------------------------------------------- */
    function ensureBell() {
        injectCss();
        if (document.getElementById('ntBell')) return;
        const s = document.getElementById('searchBtn'); if (!s) return;
        s.insertAdjacentHTML('afterend', '<button id="ntBell" class="ghost" aria-label="Notifications" style="width:auto;min-height:40px;padding:8px;border:none;position:relative">🔔<span class="nt-bdg" hidden></span></button>');
        document.getElementById('ntBell').onclick = openPanel;
        paintBell();
    }
    function removeBell() { const b = document.getElementById('ntBell'); if (b) b.remove(); }
    function paintBell() {
        const n = unreadCount(), b = document.querySelector('#ntBell .nt-bdg');
        if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
        try { if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(Math.min(n, 99)); else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (_) { }
    }

    /* ---------------------------------------------------------------
       Panneau
       --------------------------------------------------------------- */
    const CAT = { urgent: { ico: '🔴', lbl: 'Urgent' }, action: { ico: '🟠', lbl: 'À faire' }, info: { ico: '🔵', lbl: 'Infos' } };
    const renew = () => { if (typeof subRenew === 'function') subRenew(); else ntToast('Contacte l’administrateur.'); };
    const goTerm = () => { back(); setTimeout(() => { if (typeof menuGo === 'function') menuGo(S.me.role === 'enseignant' ? 'presences' : 'caisse'); }, 80); };
    const ACT = {
        backup: ['💾 Sauvegarder', () => { if (typeof doBackup === 'function') doBackup(); setTimeout(() => sync(true), 6000); }],
        sub_end: ['Renouveler', renew], sub_exp: ['Renouveler', renew], term: ['Voir', goTerm]
    };
    const when = d => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
    const liveBody = n => {
        if (n.kind !== 'sub_end') return n.body;
        const d = subLeft();
        return 'Il reste ' + d + ' jour' + (d > 1 ? 's' : '') + (S.school.sub_until ? ' (fin le ' + fdate(String(S.school.sub_until).slice(0, 10)) + ')' : '') + '.';
    };
    function item(n) {
        const a = ACT[n.kind], body = liveBody(n);
        return `<div class="nt-it ${esc(n.category)}${n.read_at ? '' : ' new'}" data-id="${esc(n.id)}"><b>${esc(n.title)}</b>${body ? `<small>${esc(body)}</small>` : ''}<em>${esc(when(n.created_at))}</em>`
            + `<div class="nt-btns">${a ? `<button data-a="act">${a[0]}</button>` : ''}${n.category === 'info' ? '<button class="ghost" data-a="read">✓ Lu</button>' : ''}<button class="ghost" data-a="snooze">⏰ Plus tard</button></div></div>`;
    }
    function draw() {
        const ov = NT.open; if (!ov) return;
        const box = ov.querySelector('#nt-list'), L = visible(), u = L.filter(n => !n.read_at).length;
        ov.querySelector('#nt-sub').textContent = u ? u + ' non lue' + (u > 1 ? 's' : '') : 'Tout est lu';
        if (!L.length) { box.innerHTML = '<div class="nt-empty">🎉<br>Rien de nouveau.<br><small>Les rappels importants apparaîtront ici.</small></div>'; return; }
        box.innerHTML = ['urgent', 'action', 'info'].map(c => {
            const g = L.filter(n => n.category === c);
            return g.length ? `<div class="nt-grp">${CAT[c].ico} ${CAT[c].lbl}<span>${g.length}</span></div>` + g.map(item).join('') : '';
        }).join('');
    }
    function openPanel() {
        if (NT.open || !isStaff()) return;
        const ov = overlay('nt-panel');
        NT.open = ov;
        ov._cleanup = () => { NT.open = null; paintBell(); };
        ov.innerHTML = '<div class="nt-head"><button class="nt-ic" data-a="back" aria-label="Retour">←</button><div class="nt-t"><b>Notifications</b><small id="nt-sub"></small></div><button class="nt-all" data-a="all">Tout marquer comme lu</button></div><div class="nt-list" id="nt-list"></div>';
        ov.addEventListener('click', e => {
            const b = e.target.closest('[data-a]'), it = e.target.closest('.nt-it');
            if (b) {
                const a = b.dataset.a, id = it && it.dataset.id;
                if (a === 'back') return back();
                if (a === 'all') return markAll();
                if (!id) return;
                if (a === 'read') return markRead([id]);
                if (a === 'snooze') return snoozeMenu(id);
                if (a === 'act') return runAct(id);
                return;
            }
            if (it && it.classList.contains('new')) markRead([it.dataset.id]); // toucher la carte = lue
        });
        draw();
        sync(true);
    }

    async function markRead(ids) {
        const t = new Date().toISOString();
        NT.rows.forEach(n => { if (ids.includes(n.id) && !n.read_at) n.read_at = t; });
        paintBell(); if (NT.open) draw();
        const { error } = await db.from('notifications').update({ read_at: t }).in('id', ids);
        if (error) ntToast(error.message);
    }
    function markAll() {
        const ids = visible().filter(n => !n.read_at).map(n => n.id);
        if (!ids.length) return ntToast('Tout est déjà lu.');
        markRead(ids);
    }
    function runAct(id) {
        const n = NT.rows.find(x => x.id === id), a = n && ACT[n.kind]; if (!a) return;
        a[1](n); markRead([id]);
    }
    function snoozeMenu(id) {
        const ov = NT.open; if (!ov) return;
        const bg = document.createElement('div');
        bg.className = 'nt-sheet-bg';
        bg.innerHTML = '<div class="nt-sheet"><b>Me le rappeler…</b><button data-h="1">Dans 1 heure</button><button data-h="24">Demain</button><button data-h="72">Dans 3 jours</button><button class="ghost" data-h="0">Annuler</button></div>';
        ov.appendChild(bg);
        bg.onclick = e => {
            const h = e.target.dataset ? e.target.dataset.h : undefined;
            if (e.target === bg || h === '0') { bg.remove(); return; }
            if (h) { bg.remove(); snooze(id, +h); }
        };
    }
    async function snooze(id, hours) {
        const until = new Date(Date.now() + hours * 3600e3).toISOString();
        const n = NT.rows.find(x => x.id === id); if (n) n.snoozed_until = until;
        paintBell(); if (NT.open) draw();
        const { error } = await db.from('notifications').update({ snoozed_until: until }).eq('id', id);
        if (error) return ntToast(error.message);
        ntToast(hours === 1 ? 'Rappel dans 1 heure' : hours === 24 ? 'Rappel demain' : 'Rappel dans 3 jours');
    }

    /* ---------------------------------------------------------------
       Branchements (sans modifier app.js)
       --------------------------------------------------------------- */
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__nt) return;
        const w = fn(o); w.__nt = true; window[name] = w;
    };
    hook('render', o => function () {
        const r = o.apply(this, arguments);
        try { if (isStaff()) { ensureBell(); sync(false); } else removeBell(); } catch (e) { console.error('notifications', e); }
        return r;
    });
    setInterval(() => { try { if (isStaff()) { paintBell(); sync(false); } } catch (_) { } }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && isStaff()) { paintBell(); sync(false); } });
})();
