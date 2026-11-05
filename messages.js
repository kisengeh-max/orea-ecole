/* =====================================================================
   ORÉA École v40 — messages.js
   Messagerie universelle (style WhatsApp) — table Supabase « messages ».
   Canaux : parent_ecole · admin_ecole · admin_ambassadeur · directeur_equipe
   À charger APRÈS app.js, ambassadeur.js, ambadmin.js (page école)
   ou APRÈS parent.js (page parent).
   S'accroche aux écrans existants SANS modifier app.js / parent.js :
     - école : carte « Messages » dans le Menu + pastille sur le bouton Menu
     - parent : onglet Messages (msgView / sendMsg remplacés) + pastille
     - admin / ambassadeur : bouton flottant « 💬 Messages »
   ===================================================================== */
(function () {
    'use strict';

    const PARENT = !!document.getElementById('pmain');
    const PAGE = 150;
    const $q = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
    const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) { } };

    const OM = {
        uid: null, chan: null, mode: null,           // mode : 'admin' | 'amb' (défini par les écrans admin / ambassadeur)
        unread: { total: 0, by: {} },
        stack: [], chat: null, inbox: null, contacts: null, stuNames: {}, plist: null
    };

    const ROLE_LBL = { ecole: 'École', parent: 'Parent', admin: 'Administration ORÉA', directeur: 'Direction', ambassadeur: 'Ambassadeur', enseignant: 'Enseignant', percepteur: 'Percepteur', equipe: 'Équipe' };

    /* ---------------------------------------------------------------
       Contexte (qui suis-je ?)
       --------------------------------------------------------------- */
    function kind() {
        if (PARENT) return 'parent';
        if (typeof S !== 'undefined' && S.me && ['directeur', 'enseignant', 'percepteur'].includes(S.me.role)) return 'staff';
        return OM.mode || null;
    }
    function myName() {
        try {
            if (PARENT) return (P.me && P.me.full_name) || 'Parent';
            if (typeof S !== 'undefined' && S.me) return S.me.full_name || ROLE_LBL[S.me.role] || 'Équipe';
            if (OM.mode === 'amb' && typeof A !== 'undefined' && A.me) return A.me.full_name || 'Ambassadeur';
        } catch (_) { }
        return 'Administration ORÉA';
    }

    /* ---------------------------------------------------------------
       Style
       --------------------------------------------------------------- */
    function injectCss() {
        if (document.getElementById('om-css')) return;
        const s = document.createElement('style');
        s.id = 'om-css';
        s.textContent = `
.om-badge{background:#D93025;color:#fff;font-size:11px;font-weight:800;min-width:19px;height:19px;border-radius:10px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 0 0 2px var(--card)}
.om-badge[hidden]{display:none}
.om-navb{position:absolute;top:4px;right:calc(50% - 24px)}
.p-nav-btn{position:relative}
.om-fab{position:fixed!important;right:14px;bottom:calc(16px + env(safe-area-inset-bottom));width:auto!important;z-index:30;display:flex;align-items:center;gap:8px;border-radius:26px!important;padding:12px 18px!important;box-shadow:0 6px 20px rgba(0,0,0,.45)!important}
.om-fab .om-badge{box-shadow:none}
.om-ov{position:fixed;left:0;top:0;width:100%;height:100%;z-index:80;background:var(--bg);color:var(--tx);display:flex;flex-direction:column;animation:omIn .22s ease;will-change:transform}
@keyframes omIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.om-head{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:var(--card);border-bottom:1px solid var(--line)}
.om-head .om-t{flex:1;min-width:0}
.om-head b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.om-head small{display:block;color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.om-ov button.om-ic{width:40px;min-height:40px;height:40px;padding:0;background:transparent;box-shadow:none;border:0;color:var(--tx);font-size:22px;line-height:1;flex:none}
.om-av{width:40px;height:40px;border-radius:50%;background:var(--gl);color:#1a1710;display:grid;place-items:center;font-weight:800;font-size:17px;flex:none}
.om-typing{padding:3px 14px;font-size:12.5px;color:var(--gold);font-style:italic;background:var(--card)}
.om-typing[hidden]{display:none}
.om-typing i{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--gold);margin-left:2px;animation:omDot 1.1s infinite}
.om-typing i:nth-child(2){animation-delay:.18s}.om-typing i:nth-child(3){animation-delay:.36s}
@keyframes omDot{0%,60%,100%{opacity:.25}30%{opacity:1}}
.om-pin{display:flex;align-items:center;gap:8px;padding:7px 14px;background:rgba(199,163,75,.14);border-bottom:1px solid var(--line);font-size:13px;cursor:pointer}
.om-pin[hidden]{display:none}
.om-pin span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.om-pin em{font-style:normal;color:var(--mut);font-size:11.5px}
.om-search{display:flex;gap:8px;align-items:center;padding:8px 12px;background:var(--card);border-bottom:1px solid var(--line)}
.om-search[hidden]{display:none}
.om-search input{margin:0;flex:1}
.om-search small{color:var(--mut);white-space:nowrap}
.om-list{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.om-day{align-self:center;background:var(--card);color:var(--mut);border:1px solid var(--line);font-size:11.5px;padding:3px 12px;border-radius:12px;margin:8px 0 2px}
.om-b{max-width:84%;padding:8px 11px 5px;border-radius:14px;font-size:15px;line-height:1.38;word-wrap:break-word;overflow-wrap:anywhere;position:relative;-webkit-tap-highlight-color:transparent}
.om-b.o{align-self:flex-start;background:var(--card);border:1px solid var(--line);border-bottom-left-radius:4px}
.om-b.m{align-self:flex-end;background:var(--gl);color:#1a1710;border-bottom-right-radius:4px}
.om-b.flash{animation:omFlash 1.2s}
@keyframes omFlash{0%,60%{box-shadow:0 0 0 3px var(--gold)}100%{box-shadow:none}}
.om-who{display:block;font-size:11.5px;font-weight:700;color:var(--gold);margin-bottom:2px}
.om-sub{display:block;font-weight:700;margin-bottom:2px}
.om-b mark{background:#ffe27a;color:#1a1710;border-radius:3px;padding:0 1px}
.om-meta{display:flex;justify-content:flex-end;align-items:center;gap:5px;font-size:10.5px;margin-top:2px;opacity:.75}
.om-tk{letter-spacing:-3px;font-weight:800;margin-right:3px}
.om-b.m .om-tk{color:#6b6760}
.om-tk.b{color:#1E88E5!important}
.om-empty{margin:auto;text-align:center;color:var(--mut);padding:30px 20px;font-size:14px}
.om-new{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);background:var(--gl);color:#1a1710;border-radius:18px;padding:7px 14px;font-weight:700;font-size:13px;z-index:3;width:auto!important;min-height:0!important}
.om-bar{display:flex;gap:8px;align-items:flex-end;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:var(--card);border-top:1px solid var(--line)}
.om-bar textarea{margin:0;flex:1;resize:none;max-height:120px;min-height:44px;border-radius:22px;padding:11px 16px}
.om-bar button{width:46px!important;min-height:46px!important;height:46px;border-radius:50%!important;padding:0!important;flex:none;font-size:20px}
.om-subj{margin:0 10px 0;padding:8px 10px 0;background:var(--card)}
.om-subj input{margin:0;min-height:38px;padding:8px 12px;font-size:14px}
.om-ro{padding:12px;text-align:center;color:var(--mut);font-size:13px;background:var(--card);border-top:1px solid var(--line)}
.om-chips{display:flex;gap:6px;padding:8px 12px 2px;overflow-x:auto;background:var(--bg)}
.om-chips button{width:auto!important;min-height:34px!important;padding:6px 14px!important;font-size:13px!important;border-radius:18px!important;flex:none}
.om-row{display:flex;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid var(--line);cursor:pointer}
.om-row:active{background:rgba(199,163,75,.08)}
.om-row .om-t{flex:1;min-width:0}
.om-row b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.om-row small{display:block;color:var(--mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.om-row .om-r{display:flex;flex-direction:column;align-items:flex-end;gap:5px;font-size:11.5px;color:var(--mut);flex:none}
.om-grp{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);padding:12px 12px 4px}
.om-sheet-bg{position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:10;display:flex;align-items:flex-end}
.om-sheet{width:100%;background:var(--card);border-radius:18px 18px 0 0;padding:12px 12px calc(12px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;animation:omIn .2s ease}
.om-sheet input{margin:0}
.om-sheet .om-res{max-height:42vh;overflow:auto}
.om-toast{position:fixed;left:14px;right:14px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:200;background:#3a2a26;color:#F0EEE6;padding:11px 16px;border-radius:12px;text-align:center;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
@media (prefers-reduced-motion:reduce){.om-ov,.om-sheet,.om-b.flash{animation:none}}
`;
        document.head.appendChild(s);
    }

    function omToast(m) {
        const t = document.createElement('div');
        t.className = 'om-toast'; t.textContent = m;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }
    const errMsg = e => {
        const m = (e && e.message) || '';
        if (!navigator.onLine || /failed to fetch|network|abort|load failed/i.test(m)) return 'Pas de connexion internet.';
        if (/row-level security|violates|permission/i.test(m)) return 'Envoi refusé : accès ou abonnement non valide.';
        return m || 'Une erreur est survenue.';
    };

    /* ---------------------------------------------------------------
       Écrans plein écran + bouton « Retour » d'Android
       --------------------------------------------------------------- */
    function overlay(cls) {
        injectCss();
        const el = document.createElement('div');
        el.className = 'om-ov ' + (cls || '');
        document.body.appendChild(el);
        const vv = window.visualViewport;
        if (vv) {
            const f = () => { el.style.height = vv.height + 'px'; el.style.transform = 'translateY(' + vv.offsetTop + 'px)'; };
            f();
            vv.addEventListener('resize', f); vv.addEventListener('scroll', f);
            el._fit = () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
        }
        OM.stack.push(el);
        history.pushState({ om: OM.stack.length }, '');
        return el;
    }
    function closeTop() {
        const el = OM.stack.pop();
        if (!el) return;
        if (el._cleanup) el._cleanup();
        if (el._fit) el._fit();
        el.remove();
        if (el.classList.contains('om-chat')) { OM.chat = null; if (OM.inbox && OM.inbox.refresh) OM.inbox.refresh(); if (OM.plist) OM.plist(); }
        if (el.classList.contains('om-inbox')) OM.inbox = null;
        refreshUnread();
    }
    // En phase de capture : on bloque le gestionnaire « retour » de app.js tant qu'un écran de messages est ouvert.
    window.addEventListener('popstate', e => {
        if (OM.stack.length) { e.stopImmediatePropagation(); closeTop(); }
    }, true);
    const goBack = () => history.back();

    /* ---------------------------------------------------------------
       Non-lus + temps réel
       --------------------------------------------------------------- */
    async function refreshUnread() {
        if (!OM.uid) return;
        const { data, error } = await db.rpc('messages_unread');
        if (error) return;
        const by = {}; let t = 0;
        (data || []).forEach(r => { by[r.ch + '|' + r.tk] = r.n; t += r.n; });
        OM.unread = { total: t, by };
        paintBadges();
        if (OM.inbox && OM.inbox.render) OM.inbox.render();
    }
    const refreshSoon = debounce(refreshUnread, 400);
    const inboxSoon = debounce(() => { if (OM.inbox && OM.inbox.refresh) OM.inbox.refresh(); }, 600);

    function paintBadges() {
        const n = OM.unread.total;
        $$('[data-om-badge]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
    }

    function onInsert(p) {
        const m = p.new;
        if (!m || m.sender_id === OM.uid) return;
        const T = OM.chat;
        if (T && T.meta.ch === m.channel && T.meta.tk === m.thread_key) {
            if (!T.msgs.some(x => x.id === m.id)) T.msgs.push(m);
            renderMsgs(); markRead(T); vib(25);
            return;
        }
        vib([40, 30, 40]);
        omToast('💬 Nouveau message');
        refreshSoon(); inboxSoon();
        if (OM.plist) OM.plist();
    }
    function onUpdate(p) {
        const m = p.new;
        const T = OM.chat;
        if (T && m) {
            const i = T.msgs.findIndex(x => x.id === m.id);
            if (i >= 0) { T.msgs[i] = Object.assign({}, T.msgs[i], m); renderMsgs(true); }
        }
        refreshSoon();
    }

    function start(uid) {
        if (OM.uid === uid && OM.chan) return;
        stop();
        OM.uid = uid;
        refreshUnread();
        OM.chan = db.channel('orea-msgs-' + uid)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onInsert)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, onUpdate)
            .subscribe();
    }
    function stop() {
        if (OM.chan) { try { db.removeChannel(OM.chan); } catch (_) { } OM.chan = null; }
        OM.uid = null; OM.mode = null; OM.unread = { total: 0, by: {} }; OM.contacts = null;
        paintBadges();
    }

    /* ---------------------------------------------------------------
       Outils d'affichage
       --------------------------------------------------------------- */
    const timeOf = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    function dayOf(d) {
        const x = new Date(d), t = new Date(), y = new Date(Date.now() - 864e5);
        const same = (a, b) => a.toDateString() === b.toDateString();
        return same(x, t) ? 'Aujourd’hui' : same(x, y) ? 'Hier' : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    function shortWhen(d) {
        const x = new Date(d);
        return x.toDateString() === new Date().toDateString() ? timeOf(d) : x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
    const isBroadcast = m => m.channel === 'directeur_equipe' && !m.recipient_id;
    const initial = s => (String(s || '?').trim()[0] || '?').toUpperCase();
    function hl(text, q) {
        if (!q) return esc(text).replace(/\n/g, '<br>');
        const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        return text.split(re).map((p, i) => i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p)).join('').replace(/\n/g, '<br>');
    }

    /* ---------------------------------------------------------------
       Discussion (écran plein écran)
       --------------------------------------------------------------- */
    async function fetchMsgs(T, before) {
        let qy = db.from('messages').select('*').eq('channel', T.meta.ch).eq('thread_key', T.meta.tk)
            .order('created_at', { ascending: false }).limit(PAGE);
        if (before) qy = qy.lt('created_at', before);
        const { data, error } = await qy;
        if (error) throw error;
        return (data || []).reverse();
    }

    async function loadBroadcastReads(T) {
        const ids = T.msgs.filter(isBroadcast).map(m => m.id).filter(id => !String(id).startsWith('tmp'));
        if (!ids.length) return;
        const { data } = await db.from('message_reads').select('message_id,user_id').in('message_id', ids);
        T.myReads = T.myReads || new Set(); T.readCounts = {};
        (data || []).forEach(r => {
            if (r.user_id === OM.uid) T.myReads.add(r.message_id);
            else T.readCounts[r.message_id] = (T.readCounts[r.message_id] || 0) + 1;
        });
    }

    async function openChat(meta) {
        if (OM.chat) { OM.chat = null; }
        const ov = overlay('om-chat');
        const T = { meta, msgs: [], q: '', hasMore: false, readCounts: {}, myReads: new Set(), typers: {}, pinIdx: 0, sending: false, ov };
        OM.chat = T;
        const canWrite = !meta.readonly;
        ov.innerHTML =
            `<div class="om-head"><button class="om-ic" id="om-bk" aria-label="Retour">‹</button><div class="om-av">${esc(meta.icon || initial(meta.title))}</div>`
            + `<div class="om-t"><b>${esc(meta.title)}</b><small>${esc(meta.sub || '')}</small></div>`
            + `<button class="om-ic" id="om-sr" aria-label="Rechercher">🔍</button></div>`
            + `<div class="om-search" id="om-sbar" hidden><input id="om-sq" type="search" placeholder="Rechercher dans la conversation…" autocomplete="off"><small id="om-sc"></small></div>`
            + `<div class="om-typing" id="om-ty" hidden></div>`
            + `<div class="om-pin" id="om-pn" hidden></div>`
            + `<div class="om-list" id="om-ls"><div class="om-empty">Chargement…</div></div>`
            + `<button class="om-new" id="om-nw" hidden>↓ Nouveau message</button>`
            + (canWrite
                ? `<div class="om-subj"><input id="om-su" placeholder="Objet (facultatif)" maxlength="80"></div>`
                  + `<div class="om-bar"><textarea id="om-in" rows="1" placeholder="Votre message…" maxlength="4000"></textarea><button id="om-sd" aria-label="Envoyer">➤</button></div>`
                : `<div class="om-ro">Lecture seule : seul le directeur écrit à toute l’équipe.</div>`);

        $q('#om-bk', ov).onclick = goBack;
        $q('#om-sr', ov).onclick = () => {
            const b = $q('#om-sbar', ov); b.hidden = !b.hidden;
            if (!b.hidden) $q('#om-sq', ov).focus(); else { T.q = ''; $q('#om-sq', ov).value = ''; renderMsgs(); }
        };
        $q('#om-sq', ov).oninput = e => { T.q = e.target.value.trim(); renderMsgs(); };
        $q('#om-pn', ov).onclick = jumpPin;
        $q('#om-nw', ov).onclick = () => { scrollBottom(true); };
        const ls = $q('#om-ls', ov);
        ls.addEventListener('scroll', () => { if (nearBottom()) $q('#om-nw', ov).hidden = true; });
        ls.addEventListener('click', onListClick);

        if (canWrite) {
            const ta = $q('#om-in', ov);
            ta.addEventListener('input', () => {
                ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
                sendTyping(T);
            });
            $q('#om-sd', ov).onclick = send;
        }

        typingSetup(T);
        ov._cleanup = () => { if (T.tch) { try { db.removeChannel(T.tch); } catch (_) { } } };

        try {
            T.msgs = await fetchMsgs(T);
            T.hasMore = T.msgs.length >= PAGE;
            await loadBroadcastReads(T);
        } catch (e) {
            ls.innerHTML = `<div class="om-empty">${esc(errMsg(e))}</div>`;
            return;
        }
        renderMsgs(false, true);
        markRead(T);
    }

    const nearBottom = () => { const l = $q('#om-ls'); return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 140; };
    function scrollBottom(smooth) {
        const l = $q('#om-ls'); if (!l) return;
        l.scrollTo({ top: l.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        const nw = $q('#om-nw'); if (nw) nw.hidden = true;
    }

    function tick(T, m) {
        if (m.sender_id !== OM.uid) return '';
        if (m._pending) return '<span class="om-tk">🕓</span>';
        const bc = isBroadcast(m), cnt = T.readCounts[m.id] || 0;
        const blue = bc ? cnt > 0 : !!m.read_at;
        return `<span class="om-tk ${blue ? 'b' : ''}">✓✓</span>` + (bc && cnt ? `<span>Lu par ${cnt}</span>` : '');
    }

    function renderMsgs(keep, first) {
        const T = OM.chat; if (!T) return;
        const ls = $q('#om-ls', T.ov); if (!ls) return;
        const wasNear = nearBottom(), prevH = ls.scrollHeight, prevTop = ls.scrollTop;
        const q = norm(T.q);
        const list = q ? T.msgs.filter(m => norm(m.content + ' ' + (m.subject || '')).includes(q)) : T.msgs;
        const sc = $q('#om-sc', T.ov); if (sc) sc.textContent = q ? list.length + ' résultat' + (list.length > 1 ? 's' : '') : '';
        let h = '', last = '';
        if (T.hasMore && !q) h += '<button class="ghost" id="om-more" style="width:auto;align-self:center;min-height:36px;padding:6px 14px;font-size:13px">Voir les messages plus anciens</button>';
        if (!list.length) h += `<div class="om-empty">${q ? 'Aucun message ne correspond.' : 'Aucun message pour le moment.<br>Écris le premier 👇'}</div>`;
        list.forEach(m => {
            const d = dayOf(m.created_at);
            if (d !== last) { h += `<div class="om-day">${esc(d)}</div>`; last = d; }
            const mine = m.sender_id === OM.uid;
            h += `<div class="om-b ${mine ? 'm' : 'o'}" data-id="${esc(m.id)}">`
                + (!mine ? `<span class="om-who">${esc(ROLE_LBL[m.sender_role] || 'Message')}</span>` : '')
                + (m.subject && !/^Re:/.test(m.content) ? `<span class="om-sub">${esc(m.subject)}</span>` : '')
                + `<div>${hl(m.content, T.q)}</div>`
                + `<div class="om-meta">${m.pinned ? '<span>📌</span>' : ''}<span>${timeOf(m.created_at)}</span>${tick(T, m)}</div></div>`;
        });
        ls.innerHTML = h;
        const more = $q('#om-more', ls);
        if (more) more.onclick = loadMore;
        if (first || (keep === false && wasNear)) scrollBottom(false);
        else if (keep === true) ls.scrollTop = prevTop;
        else if (wasNear) scrollBottom(true);
        else {
            ls.scrollTop = prevTop;
            const nw = $q('#om-nw', T.ov);
            if (nw && list.length && list[list.length - 1].sender_id !== OM.uid) nw.hidden = false;
        }
        renderPin();
    }

    async function loadMore() {
        const T = OM.chat; if (!T || !T.msgs.length) return;
        try {
            const older = await fetchMsgs(T, T.msgs[0].created_at);
            T.hasMore = older.length >= PAGE;
            const ls = $q('#om-ls', T.ov), before = ls.scrollHeight;
            T.msgs = older.concat(T.msgs);
            renderMsgs(true);
            ls.scrollTop = ls.scrollHeight - before;
        } catch (e) { omToast(errMsg(e)); }
    }

    /* ----- messages épinglés ----- */
    const pinsOf = T => T.msgs.filter(m => m.pinned).sort((a, b) => new Date(b.pinned_at || b.created_at) - new Date(a.pinned_at || a.created_at));
    function renderPin() {
        const T = OM.chat; if (!T) return;
        const b = $q('#om-pn', T.ov), pins = pinsOf(T);
        if (!pins.length) { b.hidden = true; return; }
        T.pinIdx = T.pinIdx % pins.length;
        const m = pins[T.pinIdx];
        b.hidden = false;
        b.innerHTML = `<span>📌 ${esc((m.subject ? m.subject + ' — ' : '') + m.content).slice(0, 140)}</span>` + (pins.length > 1 ? `<em>${T.pinIdx + 1}/${pins.length}</em>` : '');
    }
    function jumpPin() {
        const T = OM.chat; if (!T) return;
        const pins = pinsOf(T); if (!pins.length) return;
        const m = pins[T.pinIdx % pins.length];
        const el = $q('[data-id="' + m.id + '"]', T.ov);
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
        T.pinIdx++; renderPin();
    }

    /* ----- appui sur un message : Répondre / Copier / Épingler ----- */
    function onListClick(e) {
        const T = OM.chat; if (!T) return;
        const el = e.target.closest('.om-b'); if (!el) return;
        const m = T.msgs.find(x => String(x.id) === el.dataset.id);
        if (!m || m._pending) return;
        const canWrite = !T.meta.readonly;
        const bg = document.createElement('div');
        bg.className = 'om-sheet-bg';
        bg.innerHTML = '<div class="om-sheet">'
            + (canWrite ? '<button id="om-a-re">↩︎ Répondre</button>' : '')
            + '<button class="ghost" id="om-a-cp">⧉ Copier</button>'
            + (T.meta.canPin ? `<button class="ghost" id="om-a-pn">${m.pinned ? '📌 Retirer l’épingle' : '📌 Épingler en haut'}</button>` : '')
            + '<button class="ghost" id="om-a-x">Annuler</button></div>';
        T.ov.appendChild(bg);
        bg.onclick = ev => { if (ev.target === bg) bg.remove(); };
        $q('#om-a-x', bg).onclick = () => bg.remove();
        const re = $q('#om-a-re', bg);
        if (re) re.onclick = () => {
            bg.remove();
            const ex = (m.subject || m.content).replace(/^Re:\s*/, '').replace(/\s+/g, ' ').slice(0, 40);
            const ta = $q('#om-in', T.ov);
            ta.value = 'Re: «' + ex + '»\n'; ta.focus();
            ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
        };
        $q('#om-a-cp', bg).onclick = async () => {
            bg.remove();
            try { await navigator.clipboard.writeText(m.content); omToast('Copié ✓'); }
            catch (_) { omToast('Copie impossible sur cet appareil.'); }
        };
        const pn = $q('#om-a-pn', bg);
        if (pn) pn.onclick = async () => {
            bg.remove();
            const v = !m.pinned;
            const { error } = await db.from('messages').update({ pinned: v }).eq('id', m.id);
            if (error) return omToast(errMsg(error));
            m.pinned = v; m.pinned_at = v ? new Date().toISOString() : null;
            renderMsgs(true); omToast(v ? 'Message épinglé 📌' : 'Épingle retirée');
        };
    }

    /* ----- accusés de lecture ----- */
    async function markRead(T) {
        if (!T || !OM.uid) return;
        const others = T.msgs.filter(m => m.sender_id !== OM.uid && !String(m.id).startsWith('tmp'));
        const ids = others.filter(m => !isBroadcast(m) && !m.read_at).map(m => m.id);
        const bids = others.filter(m => isBroadcast(m) && !T.myReads.has(m.id)).map(m => m.id);
        const now = new Date().toISOString();
        if (ids.length) {
            const { error } = await db.from('messages').update({ read_at: now }).in('id', ids);
            if (!error) T.msgs.forEach(m => { if (ids.includes(m.id)) m.read_at = now; });
        }
        if (bids.length) {
            const { error } = await db.from('message_reads').upsert(bids.map(id => ({ message_id: id, user_id: OM.uid })), { onConflict: 'message_id,user_id', ignoreDuplicates: true });
            if (!error) bids.forEach(id => T.myReads.add(id));
        }
        if (ids.length || bids.length) refreshSoon();
    }

    /* ----- « en train d'écrire… » ----- */
    function typingSetup(T) {
        try {
            T.tch = db.channel('typing:' + T.meta.ch + ':' + T.meta.tk, { config: { broadcast: { self: false } } });
            T.tch.on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (!payload || payload.uid === OM.uid) return;
                T.typers[payload.uid] = { name: payload.name || 'Quelqu’un', at: Date.now() };
                showTyping(); setTimeout(showTyping, 3700);
            }).subscribe();
        } catch (_) { T.tch = null; }
    }
    function sendTyping(T) {
        const now = Date.now();
        if (!T.tch || now - (T.lastTyping || 0) < 2500) return;
        T.lastTyping = now;
        try { T.tch.send({ type: 'broadcast', event: 'typing', payload: { uid: OM.uid, name: myName() } }); } catch (_) { }
    }
    function showTyping() {
        const T = OM.chat; if (!T) return;
        const el = $q('#om-ty', T.ov); if (!el) return;
        const act = Object.values(T.typers).filter(t => Date.now() - t.at < 3500);
        el.hidden = !act.length;
        if (act.length) el.innerHTML = esc(act.map(a => a.name).join(', ')) + ' est en train d’écrire <i></i><i></i><i></i>';
    }

    /* ----- envoi ----- */
    async function send() {
        const T = OM.chat; if (!T || T.sending) return;
        const ta = $q('#om-in', T.ov); if (!ta) return;
        const txt = ta.value.trim();
        if (!txt) return;
        if (!navigator.onLine) return omToast('Pas de connexion internet.');
        const meta = T.meta;
        let subject = null;
        const mm = /^Re:\s*«?(.{1,80}?)»?\s*(\n|$)/.exec(txt);
        if (mm) subject = mm[1].trim().slice(0, 80);
        else { const su = $q('#om-su', T.ov); subject = su && su.value.trim() ? su.value.trim().slice(0, 80) : null; } // objet facultatif, dans toutes les conversations
        const row = {
            school_id: meta.school_id || null, channel: meta.ch, thread_key: meta.tk,
            student_id: meta.student_id || null, ambassador_id: meta.ambassador_id || null,
            recipient_id: meta.recipient_id || null, subject, content: txt
        };
        if (kind() === 'parent') row.parent_id = OM.uid;
        T.sending = true;
        const tmp = Object.assign({ id: 'tmp' + Date.now(), sender_id: OM.uid, created_at: new Date().toISOString(), _pending: true }, row);
        T.msgs.push(tmp); renderMsgs(false); scrollBottom(false);
        ta.value = ''; ta.style.height = 'auto';
        const su = $q('#om-su', T.ov); if (su) su.value = '';
        const { data, error } = await db.from('messages').insert(row).select().single();
        T.sending = false;
        const i = T.msgs.indexOf(tmp);
        if (error) {
            if (i >= 0) T.msgs.splice(i, 1);
            renderMsgs(false);
            ta.value = txt; omToast(errMsg(error)); vib([80, 40, 80]);
            return;
        }
        if (i >= 0) T.msgs[i] = data;
        renderMsgs(false);
        scrollBottom(true);
    }

    /* ---------------------------------------------------------------
       Boîte de réception (école et administrateur) — plein écran
       --------------------------------------------------------------- */
    async function getContacts() {
        if (OM.contacts) return OM.contacts;
        const { data } = await db.rpc('messages_contacts');
        OM.contacts = data || [];
        return OM.contacts;
    }
    async function stuName(ids) {
        const miss = ids.filter(id => id && !OM.stuNames[id]);
        if (!miss.length) return;
        try { (S.stu || []).forEach(s => { OM.stuNames[s.id] = s.name; }); } catch (_) { }
        const still = miss.filter(id => !OM.stuNames[id]);
        if (!still.length) return;
        const { data } = await db.from('students').select('id,name').in('id', still);
        (data || []).forEach(s => { OM.stuNames[s.id] = s.name; });
    }
    function classOfStudent(id) {
        try { const s = S.stu.find(x => x.id === id); const c = s && S.classes.find(x => x.id === s.class_id); return c ? c.name : ''; } catch (_) { return ''; }
    }

    async function buildRows() {
        const k = kind();
        const { data } = await db.from('messages')
            .select('channel,thread_key,content,sender_id,created_at,read_at,student_id,recipient_id')
            .order('created_at', { ascending: false }).limit(600);
        const last = {};
        (data || []).forEach(m => { const key = m.channel + '|' + m.thread_key; if (!last[key]) last[key] = m; });
        const rows = [];
        const add = (grp, ch, tk, title, sub, icon, meta) => rows.push({ grp, ch, tk, title, sub, icon, last: last[ch + '|' + tk] || null, meta: Object.assign({ ch, tk, title, sub, icon }, meta) });

        if (k === 'staff') {
            const dirR = S.me.role === 'directeur', sid = S.school.id;
            const contacts = await getContacts();
            if (dirR) {
                add('admin', 'admin_ecole', 'school:' + sid, 'Administration ORÉA', 'Support et assistance', '🛡️', { school_id: sid, canPin: true });
                add('equipe', 'directeur_equipe', 'team:all', 'Toute l’équipe', 'Envoi groupé', '📢', { school_id: sid, broadcast: true, canPin: true });
                contacts.forEach(c => add('equipe', 'directeur_equipe', 'team:' + c.uid, c.nom, ROLE_LBL[c.role] || c.role, null, { school_id: sid, recipient_id: c.uid, canPin: true }));
                const ids = Object.values(last).filter(m => m.student_id && m.channel === 'parent_ecole').map(m => m.student_id);
                await stuName(ids);
                Object.entries(last).forEach(([key, m]) => {
                    if (m.channel !== 'parent_ecole') return;
                    const nm = OM.stuNames[m.student_id] || 'Élève';
                    add('parents', 'parent_ecole', m.thread_key, nm, 'Parent · ' + (classOfStudent(m.student_id) || 'école'), null, { school_id: sid, student_id: m.student_id, canPin: true });
                });
            } else {
                const dr = contacts[0];
                if (dr) add('equipe', 'directeur_equipe', 'team:' + OM.uid, 'Direction', dr.nom, '🏫', { school_id: sid, recipient_id: dr.uid });
                add('equipe', 'directeur_equipe', 'team:all', 'Messages à toute l’équipe', 'Lecture seule', '📢', { school_id: sid, readonly: true });
            }
        } else if (k === 'admin') {
            if (typeof ADM !== 'undefined') {
                if (!ADM.sch || !ADM.sch.length) { const r = await db.rpc('admin_list_schools'); ADM.sch = r.data || []; }
                if (!ADM.amb || !ADM.amb.length) { const r = await db.rpc('admin_list_ambassadors'); ADM.amb = r.data || []; }
                ADM.sch.forEach(s => add('ecoles', 'admin_ecole', 'school:' + s.id, s.name, s.director_name || 'École', null, { school_id: s.id, canPin: true }));
                ADM.amb.filter(a => a.status === 'active').forEach(a => add('amb', 'admin_ambassadeur', 'amb:' + a.user_id, a.full_name || 'Ambassadeur', 'Ambassadeur', null, { ambassador_id: a.user_id, canPin: true }));
            }
        }
        return rows;
    }

    async function inboxView() {
        const k = kind(); if (!k) return;
        if (OM.inbox) return;
        const ov = overlay('om-inbox');
        const dirR = k === 'staff' && S.me.role === 'directeur';
        const chips = k === 'admin' ? [['all', 'Tous'], ['ecoles', 'Écoles'], ['amb', 'Ambassadeurs']]
            : dirR ? [['all', 'Tous'], ['parents', 'Parents'], ['equipe', 'Équipe'], ['admin', 'Admin']] : [];
        const I = OM.inbox = { ov, rows: [], filter: 'all', q: '' };
        ov.innerHTML =
            `<div class="om-head"><button class="om-ic" id="om-bk" aria-label="Retour">‹</button><div class="om-t"><b>Messages</b><small>${esc(k === 'admin' ? 'Écoles et ambassadeurs' : (S.school ? S.school.name : ''))}</small></div>`
            + (dirR ? '<button class="om-ic" id="om-nu" aria-label="Nouveau message">✎</button>' : '') + '</div>'
            + (chips.length ? '<div class="om-chips">' + chips.map(c => `<button data-f="${c[0]}" class="${c[0] === 'all' ? '' : 'ghost'}">${c[1]}</button>`).join('') + '</div>' : '')
            + '<div class="om-search" style="border:0;background:var(--bg)"><input id="om-iq" type="search" placeholder="Rechercher…" autocomplete="off"></div>'
            + '<div class="om-list" id="om-il" style="padding:0"><div class="om-empty">Chargement…</div></div>';
        $q('#om-bk', ov).onclick = goBack;
        if (dirR) $q('#om-nu', ov).onclick = newParentMsg;
        $q('#om-iq', ov).oninput = e => { I.q = e.target.value.trim(); I.render(); };
        $$('.om-chips button', ov).forEach(b => b.onclick = () => {
            I.filter = b.dataset.f;
            $$('.om-chips button', ov).forEach(x => x.classList.toggle('ghost', x !== b));
            I.render();
        });
        I.render = () => {
            const list = $q('#om-il', ov); if (!list) return;
            const q = norm(I.q);
            let rows = I.rows.filter(r => I.filter === 'all' || r.grp === I.filter);
            if (q) rows = rows.filter(r => norm(r.title + ' ' + r.sub).includes(q));
            else if (rows.length > 30) rows = rows.filter(r => r.last);
            rows.sort((a, b) => (b.last ? +new Date(b.last.created_at) : 0) - (a.last ? +new Date(a.last.created_at) : 0) || a.title.localeCompare(b.title, 'fr'));
            if (!rows.length) { list.innerHTML = '<div class="om-empty">Aucune conversation.<br>' + (dirR ? 'Touche ✎ pour écrire à un parent.' : '') + '</div>'; return; }
            list.innerHTML = rows.map((r, i) => {
                const n = OM.unread.by[r.ch + '|' + r.tk] || 0, m = r.last;
                const mine = m && m.sender_id === OM.uid;
                return `<div class="om-row" data-k="${esc(r.ch + '|' + r.tk)}"><div class="om-av">${esc(r.icon || initial(r.title))}</div>`
                    + `<div class="om-t"><b>${esc(r.title)}</b><small>${m ? (mine ? 'Vous : ' : '') + esc(m.content.replace(/\s+/g, ' ')) : esc(r.sub || '')}</small></div>`
                    + `<div class="om-r">${m ? `<span>${shortWhen(m.created_at)}</span>` : ''}${n ? `<span class="om-badge">${n}</span>` : ''}</div></div>`;
            }).join('');
            $$('.om-row', list).forEach(el => el.onclick = () => {
                const r = I.rows.find(x => x.ch + '|' + x.tk === el.dataset.k);
                if (r) openChat(r.meta);
            });
        };
        I.refresh = async () => { try { I.rows = await buildRows(); } catch (e) { omToast(errMsg(e)); } I.render(); };
        await I.refresh();
    }

    // Directeur : nouveau message à un parent (on choisit l'élève)
    function newParentMsg() {
        const I = OM.inbox; if (!I) return;
        const bg = document.createElement('div');
        bg.className = 'om-sheet-bg';
        bg.innerHTML = '<div class="om-sheet"><b>Écrire au parent de…</b><input id="om-nq" type="search" placeholder="Nom de l’élève" autocomplete="off"><div class="om-res" id="om-nr"></div><button class="ghost" id="om-nx">Annuler</button></div>';
        I.ov.appendChild(bg);
        const draw = () => {
            const q = norm($q('#om-nq', bg).value);
            const L = (S.stu || []).filter(s => !q || norm(s.name).includes(q)).slice(0, 30);
            $q('#om-nr', bg).innerHTML = L.length ? L.map(s => `<div class="om-row" data-s="${esc(s.id)}"><div class="om-av">${esc(initial(s.name))}</div><div class="om-t"><b>${esc(s.name)}</b><small>${esc(classOfStudent(s.id))}</small></div></div>`).join('')
                : '<div class="om-empty">Aucun élève trouvé.</div>';
            $$('.om-row', bg).forEach(el => el.onclick = () => {
                const s = S.stu.find(x => x.id === el.dataset.s); bg.remove();
                if (s) openChat({ ch: 'parent_ecole', tk: 'student:' + s.id, title: s.name, sub: 'Parent · ' + (classOfStudent(s.id) || 'école'), school_id: S.school.id, student_id: s.id, canPin: true });
            });
        };
        $q('#om-nq', bg).oninput = draw; draw();
        $q('#om-nx', bg).onclick = () => bg.remove();
        bg.onclick = e => { if (e.target === bg) bg.remove(); };
        setTimeout(() => $q('#om-nq', bg).focus(), 50);
    }

    /* ---------------------------------------------------------------
       Point d'entrée public
       --------------------------------------------------------------- */
    async function open() {
        injectCss();
        if (!OM.uid) { const { data } = await db.auth.getSession(); if (data.session) start(data.session.user.id); }
        const k = kind();
        if (k === 'amb') {
            return openChat({ ch: 'admin_ambassadeur', tk: 'amb:' + OM.uid, title: 'Administration ORÉA', sub: 'Support ORÉA', icon: '🛡️', school_id: null, ambassador_id: OM.uid });
        }
        if (k === 'staff' || k === 'admin') return inboxView();
    }

    /* ---------------------------------------------------------------
       Branchements sur les écrans existants
       --------------------------------------------------------------- */
    const MSG_ICON = () => (typeof svgI === 'function' ? svgI('messages') : '💬');

    function decorateStaff() {
        if (PARENT || typeof S === 'undefined' || !S.me) return;
        if (!['directeur', 'enseignant', 'percepteur'].includes(S.me.role)) return;
        const nb = $q('#nav button[data-t=menu]');
        if (nb && !nb.querySelector('[data-om-badge]')) nb.insertAdjacentHTML('beforeend', '<span class="om-badge om-navb" data-om-badge hidden></span>');
        if (S.tab === 'menu') {
            const main = $q('#main');
            if (main && !main.querySelector('[data-om-card]')) {
                const old = main.querySelector('.menu-card[onclick*="pAdminInbox"]');
                if (old) {
                    old.setAttribute('onclick', 'OreaMsg.open()'); old.setAttribute('data-om-card', '1');
                    const lb = old.querySelector('.menu-label'); if (lb) lb.firstChild.textContent = 'Messages';
                    old.insertAdjacentHTML('beforeend', '<span class="om-badge" data-om-badge hidden style="margin-left:6px"></span>');
                } else {
                    const h3 = main.querySelector('h3');
                    const card = `<div class="menu-title">Communication</div><div class="menu-card" data-om-card="1" onclick="OreaMsg.open()"><div class="menu-ic">${MSG_ICON()}</div><div class="menu-label">Messages</div><span class="om-badge" data-om-badge hidden style="margin-right:6px"></span><span class="menu-arrow">›</span></div>`;
                    if (h3) h3.insertAdjacentHTML('afterend', card); else main.insertAdjacentHTML('afterbegin', card);
                }
            }
        }
        paintBadges();
    }

    function addFab() {
        injectCss();
        const main = $q('#main'); if (!main || main.querySelector('.om-fab')) return;
        main.insertAdjacentHTML('beforeend', '<button class="om-fab" onclick="OreaMsg.open()">💬 Messages<span class="om-badge" data-om-badge hidden></span></button>');
        paintBadges();
    }

    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__om) return;
        const w = fn(o); w.__om = true; window[name] = w;
    };

    if (!PARENT) {
        // École : on décore chaque rendu
        hook('render', o => function () { const r = o.apply(this, arguments); try { decorateStaff(); } catch (e) { console.error('messages', e); } return r; });
        // Ancien écran « Messages des parents » → nouvelle messagerie
        window.pAdminInbox = () => open();
        // Administrateur
        hook('admRender', o => function () { OM.mode = 'admin'; const r = o.apply(this, arguments); try { addFab(); } catch (_) { } return r; });
        // Ambassadeur actif
        hook('ambDraw', o => async function () {
            const r = await o.apply(this, arguments);
            try { if (typeof A !== 'undefined' && A.me && A.me.status === 'active') { OM.mode = 'amb'; addFab(); } } catch (_) { }
            return r;
        });
    } else {
        /* ---------- Page parent ---------- */
        hook('navView', o => function () {
            const h = o.apply(this, arguments);
            return h.replace(/(<button[^>]*P\.tab='messages'[^>]*>[\s\S]*?)(<\/button>)/, '$1<span class="om-badge om-navb" data-om-badge hidden></span>$2');
        });
        hook('render', o => function () { const r = o.apply(this, arguments); try { paintBadges(); } catch (_) { } return r; });

        const childMeta = c => ({
            ch: 'parent_ecole', tk: 'student:' + c.id, title: c.name, sub: 'Discussion avec l’école',
            school_id: c.school_id || P.school_id || (P.school && P.school.id), student_id: c.id, canPin: false
        });

        window.msgView = async function () {
            injectCss();
            const root = document.getElementById('pmain');
            let h = '<h2 style="color:var(--gold);margin:10px 0">💬 Messages</h2>';
            if (!P.children.length) {
                root.innerHTML = h + '<div class=p-empty>Ajoutez un enfant pour discuter avec l’école.</div>' + navView() + '<div style="height:90px"></div>';
                paintBadges(); return;
            }
            root.innerHTML = h + '<div id="om-pl" style="border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card)"></div>' + navView() + '<div style="height:90px"></div>';
            paintBadges();
            const draw = async () => {
                const box = document.getElementById('om-pl'); if (!box) return;
                let last = {};
                const { data } = await db.from('messages').select('thread_key,content,sender_id,created_at').eq('channel', 'parent_ecole').order('created_at', { ascending: false }).limit(300);
                (data || []).forEach(m => { if (!last[m.thread_key]) last[m.thread_key] = m; });
                box.innerHTML = P.children.map(c => {
                    const tk = 'student:' + c.id, m = last[tk], n = OM.unread.by['parent_ecole|' + tk] || 0;
                    return `<div class="om-row" data-c="${esc(c.id)}"><div class="om-av">${esc(initial(c.name))}</div><div class="om-t"><b>${esc(c.name)}</b>`
                        + `<small>${m ? (m.sender_id === OM.uid ? 'Vous : ' : '') + esc(m.content.replace(/\s+/g, ' ')) : 'Écrire à l’école'}</small></div>`
                        + `<div class="om-r">${m ? `<span>${shortWhen(m.created_at)}</span>` : ''}${n ? `<span class="om-badge">${n}</span>` : ''}</div></div>`;
                }).join('');
                $$('.om-row', box).forEach(el => el.onclick = () => {
                    const c = P.children.find(x => x.id === el.dataset.c);
                    if (c) openChat(childMeta(c));
                });
            };
            OM.plist = draw;
            if (!OM.uid) { const { data } = await db.auth.getSession(); if (data.session) start(data.session.user.id); }
            draw();
        };
        // L'ancien bouton « envoyer » n'est plus utilisé
        window.sendMsg = function () { window.msgView(); };
    }

    /* ---------------------------------------------------------------
       Démarrage : suit la connexion / déconnexion
       --------------------------------------------------------------- */
    db.auth.onAuthStateChange((ev, ses) => {
        setTimeout(() => { if (ses && ses.user) start(ses.user.id); else stop(); }, 0);
    });
    db.auth.getSession().then(r => { if (r.data && r.data.session) start(r.data.session.user.id); }).catch(() => { });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUnread(); });
    window.addEventListener('online', () => refreshUnread());

    window.OreaMsg = { open, openChat, refresh: refreshUnread, unread: () => OM.unread.total };

    // Si un rendu a déjà eu lieu avant le chargement de ce fichier, on décore tout de suite.
    try { decorateStaff(); } catch (_) { }
})();
