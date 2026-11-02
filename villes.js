/* =====================================================================
   ORÉA École v40 — villes.js
   - Directeur : champ « Ville de l'école » en haut des Réglages
   - Ambassadeur : carte « Ma ville » sous son code
   - Administrateur : menu « Toutes les villes » + ville sur chaque carte
   À charger APRÈS app.js, ambassadeur.js, ambadmin.js (page école).
   Sans effet sur la page parent. Ne modifie aucun fichier existant.
   ===================================================================== */
(function () {
    'use strict';
    if (document.getElementById('pmain')) return; // page parent : rien à faire

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const say = m => { try { toast(m); } catch (_) { alert(m); } };
    const VL = { sc: {}, am: {}, ok: false, filtre: '' };
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__vl) return;
        const w = fn(o); w.__vl = true; window[name] = w;
    };
    const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    /* ---------- 1. Directeur : Réglages ---------- */
    hook('vReglages', o => function () {
        const r = o.apply(this, arguments);
        try { if (S.me && S.me.role === 'directeur') cardEcole(); } catch (e) { console.error('villes', e); }
        return r;
    });
    function cardEcole() {
        const m = document.getElementById('main');
        if (!m || m.querySelector('#vl-card')) return;
        const city = (S.school && S.school.city) || '';
        m.insertAdjacentHTML('afterbegin', `<div class="card col" id="vl-card"><b>📍 Ville de l’école</b><small>Elle sert à regrouper les écoles par ville.</small>`
            + `<input id="vl-in" value="${esc(city)}" maxlength="60" placeholder="Ex. : Lubumbashi" autocomplete="off"><button id="vl-sv">Enregistrer la ville</button></div>`);
        document.getElementById('vl-sv').onclick = async () => {
            const v = document.getElementById('vl-in').value.trim();
            const { data, error } = await db.from('schools').update({ city: v || null }).eq('id', S.school.id).select('city').single();
            if (error) return say(error.message);
            S.school.city = data.city; say(v ? 'Ville enregistrée : ' + v : 'Ville effacée');
        };
    }

    /* ---------- 2. Ambassadeur actif : carte « Ma ville » ---------- */
    hook('ambDraw', o => async function () {
        const r = await o.apply(this, arguments);
        try { if (typeof A !== 'undefined' && A.me && A.me.status === 'active') await cardAmb(); } catch (e) { console.error('villes', e); }
        return r;
    });
    async function cardAmb() {
        const m = document.getElementById('main');
        if (!m || m.querySelector('#vl-amb')) return;
        const anchor = m.querySelector('.amb-name');
        const host = anchor && anchor.closest('.card');
        if (!host) return;
        let city = A.me.city || '';
        if (A.me.city === undefined) {
            const uid = A.me.user_id || ((await db.auth.getUser()).data.user || {}).id;
            const { data } = await db.from('ambassadors').select('city').eq('user_id', uid).maybeSingle();
            city = (data && data.city) || '';
        }
        host.insertAdjacentHTML('afterend', `<div class="card col" id="vl-amb"><b>📍 Ma ville</b><input id="vl-ain" value="${esc(city)}" maxlength="60" placeholder="Ex. : Kinshasa" autocomplete="off"><button id="vl-asv" class="ghost">Enregistrer ma ville</button></div>`);
        document.getElementById('vl-asv').onclick = async () => {
            const v = document.getElementById('vl-ain').value.trim();
            const { error } = await db.rpc('amb_set_city', { p_city: v });
            if (error) return say(error.message);
            A.me.city = v || null; say(v ? 'Ville enregistrée : ' + v : 'Ville effacée');
        };
    }


    /* ---------- 3. Administrateur : filtre « Toutes les villes » ---------- */
    async function loadCities() {
        const [a, b] = await Promise.all([db.rpc('admin_school_cities'), db.rpc('admin_ambassador_cities')]);
        VL.sc = {}; VL.am = {};
        (a.data || []).forEach(x => { VL.sc[x.sid] = x.ville || ''; });
        (b.data || []).forEach(x => { VL.am[x.uid] = x.ville || ''; });
        VL.ok = !a.error && !b.error;
    }
    // Chargement des villes en même temps que la liste des écoles, puis nouveau dessin
    hook('adminDraw', o => async function () {
        const p = loadCities().catch(() => { VL.ok = false; });
        const r = await o.apply(this, arguments);
        await p;
        try { if (VL.ok && typeof admRender === 'function') admRender(); } catch (_) { }
        return r;
    });
    // À chaque dessin : on filtre temporairement les listes, puis on les remet
    hook('admRender', o => function () {
        if (!VL.ok || !ADM || ADM.tab === 'pro') return o.apply(this, arguments);
        const sch = ADM.sch, amb = ADM.amb, f = VL.filtre;
        const villes = [...new Set([...sch.map(s => VL.sc[s.id]), ...amb.map(a => VL.am[a.user_id])].map(v => (v || '').trim()).filter(Boolean))]
            .sort((x, y) => x.localeCompare(y, 'fr'));
        if (f && f !== '_none' && !villes.some(v => norm(v) === norm(f))) VL.filtre = '';
        const keep = c => !VL.filtre ? true : VL.filtre === '_none' ? !(c || '').trim() : norm(c) === norm(VL.filtre);
        ADM.sch = sch.filter(s => keep(VL.sc[s.id]));
        ADM.amb = amb.filter(a => keep(VL.am[a.user_id]));
        let r;
        try { r = o.apply(this, arguments); } finally { ADM.sch = sch; ADM.amb = amb; }
        try { decore(villes); } catch (e) { console.error('villes', e); }
        return r;
    });
    function decore(villes) {
        const m = document.getElementById('main'); if (!m) return;
        const row = m.querySelector('.row'); // la rangée des onglets
        if (row && !m.querySelector('#vl-flt')) {
            row.insertAdjacentHTML('afterend', '<div class="bar"><select id="vl-flt"><option value="">Toutes les villes</option>'
                + villes.map(v => `<option value="${esc(v)}" ${norm(v) === norm(VL.filtre) ? 'selected' : ''}>${esc(v)}</option>`).join('')
                + `<option value="_none" ${VL.filtre === '_none' ? 'selected' : ''}>Sans ville</option></select></div>`);
            document.getElementById('vl-flt').onchange = e => { VL.filtre = e.target.value; admRender(); };
        }
        // Ville + bouton « Modifier » sur chaque carte (id lu dans le bouton Parrain / Taux)
        m.querySelectorAll('.card').forEach(c => {
            const bs = c.querySelector('[onclick*="admSponsor("]'), ba = c.querySelector('[onclick*="admAmbPct("]');
            const b = bs || ba; if (!b) return;
            const id = (/\('([^']+)'/.exec(b.getAttribute('onclick')) || [])[1]; if (!id) return;
            const v = (bs ? VL.sc[id] : VL.am[id]) || '';
            const line = document.createElement('small');
            line.innerHTML = '📍 ' + (v ? esc(v) : '<i>ville non renseignée</i>') + ' · <a href="#" data-vl="1">modifier</a>';
            line.querySelector('a').onclick = ev => { ev.preventDefault(); changeCity(bs ? 's' : 'a', id, v); };
            const t = c.querySelector('b'); if (t) t.insertAdjacentElement('afterend', line); else c.prepend(line);
        });
    }
    function changeCity(kind, id, cur) {
        ask('Ville', [{ n: 'v', l: 'Ville', v: cur, r: false }], async f => {
            const v = (f.v || '').trim();
            const { error } = kind === 's' ? await db.rpc('admin_set_school_city', { p_school: id, p_city: v })
                : await db.rpc('admin_set_ambassador_city', { p_uid: id, p_city: v });
            if (error) throw error;
            (kind === 's' ? VL.sc : VL.am)[id] = v; say('Ville enregistrée'); admRender();
        });
    }
})();
