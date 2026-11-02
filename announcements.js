/* =====================================================================
   ORÉA École v40 — announcements.js
   DIRECTEUR (page école) : écran « Annonces » — liste des annonces
     publiées + brouillons, « ＋ Nouvelle annonce », brouillon, épinglage 📌,
     date de fin, compteur « 👁 Vue par X parents », modifier, supprimer.
     (corrige le bug : le directeur ne voyait pas ses propres annonces)
   PARENT (page parent) : enregistre la vue de chaque annonce affichée et
     ajoute 📌 devant les annonces épinglées.
   À charger APRÈS notifications.js (page école) / APRÈS parent.js (page parent).
   ===================================================================== */
(function () {
    'use strict';

    const PARENT = !!document.getElementById('pmain');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const today = () => new Date().toLocaleDateString('sv-SE');
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__an) return;
        const w = fn(o); w.__an = true; window[name] = w;
    };

    /* =================================================================
       PAGE PARENT : vues + 📌
       ================================================================= */
    if (PARENT) {
        const seen = new Set();
        hook('ecoleView', o => function () {
            const r = o.apply(this, arguments);
            try { afterEcole(); } catch (e) { console.error('announcements', e); }
            return r;
        });
        function afterEcole() {
            const t = today();
            const L = (P.annonces || []).filter(a => !a.end_date || a.end_date >= t);
            // 📌 devant les annonces épinglées (le bloc des annonces est la 1re section)
            const sec = document.querySelector('#pmain .p-sec');
            if (sec) {
                const items = [...sec.children].filter(x => x.tagName === 'DIV');
                if (items.length === L.length) items.forEach((el, i) => {
                    const b = el.querySelector('b');
                    if (L[i].pinned && b && !b.dataset.pn) { b.dataset.pn = '1'; b.textContent = '📌 ' + b.textContent; }
                });
            }
            // Enregistre la vue (une seule fois par annonce et par session)
            const rows = L.filter(a => a.school_id && !seen.has(a.id)).map(a => ({ announcement_id: a.id, school_id: a.school_id }));
            if (!rows.length) return;
            rows.forEach(r => seen.add(r.announcement_id));
            db.from('announcement_views').upsert(rows, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true })
                .then(({ error }) => { if (error) { rows.forEach(r => seen.delete(r.announcement_id)); console.warn('announcement_views:', error.message); } });
        }
        return;
    }

    /* =================================================================
       PAGE ÉCOLE : écran « Annonces » du directeur
       ================================================================= */
    const AN = { rows: [], views: {}, ov: null };
    const isDir = () => typeof S !== 'undefined' && S.me && S.me.role === 'directeur';
    const OV = () => window.OreaOv;
    const say = m => { if (OV()) OV().toast(m); else if (typeof toast === 'function') toast(m); };

    function injectCss() {
        if (document.getElementById('an-css')) return;
        const s = document.createElement('style');
        s.id = 'an-css';
        s.textContent = `
.an-card{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:12px;padding:11px 12px;margin-bottom:10px}
.an-card.draft{border-left-color:var(--mut);opacity:.9}
.an-card.exp{border-left-color:#E5484D}
.an-card h4{margin:0 0 4px;font-size:15.5px;color:var(--tx)}
.an-txt{font-size:14px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.an-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.an-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(199,163,75,.18);color:var(--gold)}
.an-tag.d{background:rgba(150,150,150,.2);color:var(--mut)}
.an-tag.e{background:rgba(229,72,77,.15);color:#E5484D}
.an-meta{color:var(--mut);font-size:12px;margin-top:6px}
.an-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.an-btns button{width:auto!important;min-height:34px!important;padding:5px 12px!important;font-size:13px!important;border-radius:17px!important}
.an-foot{padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--card);border-top:1px solid var(--line)}
.an-form{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.an-form label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--mut)}
.an-form input,.an-form textarea{margin:0}
.an-form textarea{min-height:170px;resize:vertical}
.an-form .an-chk{flex-direction:row;align-items:center;gap:10px;color:var(--tx);font-size:14.5px}
.an-form .an-chk input{width:auto;margin:0}
.an-sec{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);padding:10px 2px 6px}
`;
        document.head.appendChild(s);
    }

    // L'ancien bouton « Publier une annonce » du Menu ouvre maintenant l'écran complet
    window.pAdminAnnonce = function () {
        if (!isDir()) return say('Réservé au directeur.');
        if (!OV()) return say('Recharge l’application (notifications.js manquant).');
        openList();
    };
    // Menu : « Publier une annonce » devient « Annonces »
    hook('render', o => function () {
        const r = o.apply(this, arguments);
        try {
            if (S.tab === 'menu') document.querySelectorAll('.menu-card[onclick*="pAdminAnnonce"] .menu-label').forEach(l => {
                if (l.firstChild && l.firstChild.nodeType === 3) l.firstChild.textContent = 'Annonces';
            });
        } catch (e) { console.error('announcements', e); }
        return r;
    });

    /* ---------- Liste ---------- */
    function openList() {
        injectCss();
        const ov = OV().overlay('an-list-ov');
        AN.ov = ov; ov._cleanup = () => { AN.ov = null; };
        ov.innerHTML = '<div class="nt-head"><button class="nt-ic" data-a="back" aria-label="Retour">←</button><div class="nt-t"><b>Annonces</b><small id="an-sub">Chargement…</small></div></div>'
            + '<div class="nt-list" id="an-list"><div class="sk"></div><div class="sk"></div></div>'
            + '<div class="an-foot"><button data-a="new">＋ Nouvelle annonce</button></div>';
        ov.addEventListener('click', e => {
            const b = e.target.closest('[data-a]'); if (!b) return;
            const a = b.dataset.a, c = e.target.closest('.an-card'), id = c && c.dataset.id;
            if (a === 'back') return OV().back();
            if (a === 'new') return openEditor(null);
            if (!id) return;
            if (a === 'edit') return openEditor(AN.rows.find(x => x.id === id));
            if (a === 'pin') return togglePin(id);
            if (a === 'pub') return publish(id);
            if (a === 'del') return remove(id);
        });
        load();
    }
    async function load() {
        const [r, v] = await Promise.all([
            db.from('announcements').select('*').eq('school_id', S.school.id).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
            db.rpc('announcement_view_counts')
        ]);
        if (!AN.ov) return;
        const box = AN.ov.querySelector('#an-list');
        if (r.error) { box.innerHTML = `<p class="empty">${esc(r.error.message)}</p>`; return; }
        AN.rows = r.data || [];
        AN.views = {}; (v.data || []).forEach(x => { AN.views[x.aid] = x.n; });
        draw();
    }
    function card(a) {
        const draft = a.status === 'draft', exp = !draft && a.end_date && a.end_date < today(), n = AN.views[a.id] || 0;
        const tags = (a.pinned ? '<span class="an-tag">📌 Épinglée</span>' : '') + (draft ? '<span class="an-tag d">Brouillon</span>' : '') + (exp ? '<span class="an-tag e">Expirée</span>' : '');
        const dt = a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : '';
        const meta = (draft ? 'Créée le ' : 'Publiée le ') + dt + (a.end_date ? ' · jusqu’au ' + fdate(a.end_date) : '') + (draft ? '' : ' · 👁 Vue par ' + n + ' parent' + (n > 1 ? 's' : ''));
        return `<div class="an-card${draft ? ' draft' : ''}${exp ? ' exp' : ''}" data-id="${esc(a.id)}">${tags ? `<div class="an-tags">${tags}</div>` : ''}<h4>${esc(a.title)}</h4><div class="an-txt">${esc(a.content)}</div><div class="an-meta">${esc(meta)}</div>`
            + `<div class="an-btns">${draft ? '<button data-a="pub">Publier</button>' : ''}<button class="ghost" data-a="pin">${a.pinned ? 'Désépingler' : '📌 Épingler'}</button><button class="ghost" data-a="edit">✏️ Modifier</button><button class="ghost" data-a="del">🗑</button></div></div>`;
    }
    function draw() {
        if (!AN.ov) return;
        const pub = AN.rows.filter(a => a.status !== 'draft'), dr = AN.rows.filter(a => a.status === 'draft');
        AN.ov.querySelector('#an-sub').textContent = pub.length + ' publiée' + (pub.length > 1 ? 's' : '') + (dr.length ? ' · ' + dr.length + ' brouillon' + (dr.length > 1 ? 's' : '') : '');
        let h = '';
        if (pub.length) h += '<div class="an-sec">Publiées</div>' + pub.map(card).join('');
        if (dr.length) h += '<div class="an-sec">Brouillons</div>' + dr.map(card).join('');
        if (!h) h = '<div class="nt-empty">📣<br>Aucune annonce pour le moment.<br><small>Touche « Nouvelle annonce » pour en écrire une.</small></div>';
        AN.ov.querySelector('#an-list').innerHTML = h;
    }

    /* ---------- Actions ---------- */
    async function update(id, patch, okMsg) {
        const { data, error } = await db.from('announcements').update(patch).eq('id', id).select('id');
        if (error) return say(error.message);
        if (!data || !data.length) return say('Modification refusée.');
        say(okMsg); load();
    }
    function togglePin(id) {
        const a = AN.rows.find(x => x.id === id); if (!a) return;
        const p = !a.pinned;
        update(id, { pinned: p, pinned_at: p ? new Date().toISOString() : null }, p ? 'Annonce épinglée 📌' : 'Annonce désépinglée');
    }
    function publish(id) {
        const a = AN.rows.find(x => x.id === id); if (!a) return;
        if (!String(a.content || '').trim()) return say('Écris d’abord le contenu (Modifier).');
        update(id, { status: 'published' }, 'Annonce publiée ✓');
    }
    async function remove(id) {
        const a = AN.rows.find(x => x.id === id); if (!a) return;
        if (!confirm('Supprimer l’annonce « ' + a.title + ' » ? Les parents ne la verront plus.')) return;
        const { data, error } = await db.from('announcements').delete().eq('id', id).select('id');
        if (error) return say(error.message);
        if (!data || !data.length) return say('Suppression refusée.');
        say('Annonce supprimée'); load();
    }

    /* ---------- Éditeur (nouvel écran plein écran) ---------- */
    function openEditor(cur) {
        injectCss();
        const ov = OV().overlay('an-edit-ov');
        const isNew = !cur, draft = !cur || cur.status === 'draft';
        ov.innerHTML = `<div class="nt-head"><button class="nt-ic" data-a="back" aria-label="Retour">←</button><div class="nt-t"><b>${isNew ? 'Nouvelle annonce' : 'Modifier l’annonce'}</b><small>${draft ? 'Brouillon' : 'Publiée'}</small></div></div>`
            + `<div class="an-form"><label>Titre<input id="an-t" maxlength="120" value="${esc(cur ? cur.title : '')}" placeholder="Ex. : Rentrée des classes"></label>`
            + `<label>Contenu<textarea id="an-c" placeholder="Écris ton message aux parents…">${esc(cur ? cur.content : '')}</textarea></label>`
            + `<label>Date de fin (facultatif)<input id="an-e" type="date" value="${esc(cur && cur.end_date ? cur.end_date : '')}"></label>`
            + `<label class="an-chk"><input id="an-p" type="checkbox" ${cur && cur.pinned ? 'checked' : ''}> 📌 Épingler en haut de la liste des parents</label></div>`
            + `<div class="an-foot"><div class="row" style="margin:0">${draft ? '<button class="ghost" data-a="draft">Enregistrer en brouillon</button><button data-a="publish">Publier</button>' : '<button data-a="save">Enregistrer</button>'}</div></div>`;
        const save = async status => {
            const t = ov.querySelector('#an-t').value.trim(), c = ov.querySelector('#an-c').value.trim();
            const e = ov.querySelector('#an-e').value, p = ov.querySelector('#an-p').checked;
            if (!t) return say('Écris un titre.');
            if (status === 'published' && !c) return say('Écris le contenu avant de publier.');
            const row = { title: t, content: c, end_date: e || null, status, pinned: p, pinned_at: p ? ((cur && cur.pinned && cur.pinned_at) || new Date().toISOString()) : null };
            const r = cur ? await db.from('announcements').update(row).eq('id', cur.id).select('id')
                : await db.from('announcements').insert(Object.assign({ school_id: S.school.id, author_id: S.me.id }, row)).select('id');
            if (r.error) return say(r.error.message);
            if (!r.data || !r.data.length) return say('Enregistrement refusé.');
            say(status === 'published' ? 'Annonce publiée ✓' : 'Brouillon enregistré');
            OV().back(); load();
        };
        ov.addEventListener('click', e => {
            const b = e.target.closest('[data-a]'); if (!b) return;
            const a = b.dataset.a;
            if (a === 'back') return OV().back();
            if (a === 'draft') return save('draft');
            if (a === 'publish') return save('published');
            if (a === 'save') return save(cur.status);
        });
        setTimeout(() => { const i = ov.querySelector('#an-t'); if (i && isNew) i.focus(); }, 300);
    }
})();
