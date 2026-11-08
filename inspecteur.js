/* =====================================================================
   ORÉA École v92 — inspecteur.js
   1) Rapports statistiques de l'école (Statistiques → « Mes rapports ») :
      créer, modifier, imprimer ; choisir les tableaux et les classes,
      ajouter un commentaire ; « partager avec l'inspecteur ».
   2) Inspecteur : compte créé par ORÉA. Il demande à suivre une école avec
      son code ; le chef d'établissement accepte dans Réglages. Il ne voit
      QUE des statistiques, jamais un montant d'argent (ni à l'écran ni
      dans la base : tout passe par des fonctions sans montant).
   3) Espace ORÉA → onglet « Inspecteurs » : créer / désactiver les comptes.
   À charger APRÈS app.js, ambassadeur.js, ambadmin.js et stats.js.
   ===================================================================== */
(function () {
    'use strict';
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const SECTIONS = [['effectifs', 'Effectifs par classe'], ['ages', 'Âges'], ['presences', 'Présences'], ['personnel', 'Personnel'], ['pointage', 'Pointage du personnel'], ['resultats', 'Résultats'], ['enafep', 'ENAFEP']];
    const secOf = t => t.startsWith('Effectifs') ? 'effectifs' : t.startsWith('Âges') ? 'ages' : t.startsWith('Présences') ? 'presences' : t.startsWith('Pointage') ? 'pointage' : t.startsWith('Personnel') ? 'personnel' : t.startsWith('Résultats') ? 'resultats' : t.startsWith('ENAFEP') ? 'enafep' : '';
    const CLASS_TABLES = ['effectifs', 'presences', 'resultats'];
    // Garde les tableaux choisis, et seulement les lignes des classes choisies
    function pick(tables, secs, classes) {
        return tables.filter(t => !secs.length || secs.includes(secOf(t.title))).map(t => {
            if (!classes.length || !CLASS_TABLES.includes(secOf(t.title))) return t;
            const rows = t.rows.filter(r => classes.includes(String(r[0])));
            return Object.assign({}, t, { rows, foot: secOf(t.title) === 'effectifs' ? null : t.foot });
        });
    }

    /* ================= 1) RAPPORTS DE L'ÉCOLE ================= */
    window.oreaReports = async function () {
        const back = `<div class=bar><button class=ghost onclick="menuGo('stats')">← Statistiques</button></div>`;
        $('#main').innerHTML = back + '<h3>Rapports statistiques</h3><div class=sk></div>';
        const { data, error } = await db.from('stat_reports').select('*').eq('school_id', S.school.id).order('updated_at', { ascending: false });
        if (error) { $('#main').innerHTML = back + `<p class=empty>${E(error.message)}</p>`; return; }
        const L = data || [];
        $('#main').innerHTML = back + `<h3>Rapports statistiques</h3><small>Choisissez les tableaux et les classes, ajoutez un commentaire, puis imprimez ou enregistrez en PDF. Un rapport « partagé » est visible par l’inspecteur qui suit l’école (jamais de montant d’argent).</small>
<button id=rp-new style="margin:10px 0">+ Nouveau rapport</button>`
            + (L.length ? L.map(r => `<div class="card col"><div style="display:flex;justify-content:space-between;gap:8px"><b>${E(r.title)}</b><small>${new Date(r.updated_at).toLocaleDateString('fr-FR')}</small></div><small>${E(r.year || '')} · ${(r.sections || []).length ? r.sections.map(k => (SECTIONS.find(x => x[0] === k) || [0, k])[1]).join(', ') : 'Tous les tableaux'}${(r.class_names || []).length ? ' · ' + r.class_names.length + ' classe(s)' : ''}${r.shared ? ' · 🏛 partagé' : ''}</small>
<div class=row><button class=ghost data-pr="${r.id}">🖨 Imprimer</button><button class=ghost data-ed="${r.id}">✏️ Modifier</button><button class=ghost data-dl="${r.id}" style="color:var(--bad)">Supprimer</button></div></div>`).join('') : '<p class=empty>Aucun rapport enregistré.</p>');
        $('#rp-new').onclick = () => editReport(null);
        const byId = id => L.find(x => x.id === id);
        document.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => printReport(byId(b.dataset.pr)));
        document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editReport(byId(b.dataset.ed)));
        document.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer ce rapport ?')) return; const { error: e } = await db.from('stat_reports').delete().eq('id', b.dataset.dl); if (e) return toast(e.message); oreaReports(); });
    };
    function editReport(r) {
        const v = r || { title: 'Rapport ' + (S.year || ''), sections: [], class_names: [], comment: '', shared: false };
        const cls = yc();
        const ck = (name, val, lbl, on) => `<label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:14px;color:var(--tx);margin:4px 0"><input type=checkbox name=${name} value="${E(val)}" ${on ? 'checked' : ''} style="width:auto;margin:0">${E(lbl)}</label>`;
        const d = show(`<form method=dialog><h3>${r ? 'Modifier le rapport' : 'Nouveau rapport'}</h3>
<label>Titre<input name=title required maxlength=120 value="${E(v.title)}"></label>
<b style="display:block;margin-top:10px">Tableaux (aucun coché = tous)</b>${SECTIONS.map(s => ck('sec', s[0], s[1], (v.sections || []).includes(s[0]))).join('')}
<b style="display:block;margin-top:10px">Classes (aucune cochée = toutes)</b><div style="max-height:30vh;overflow-y:auto">${cls.map(c => ck('cl', c.name, c.name, (v.class_names || []).includes(c.name))).join('')}</div>
<label>Commentaire (imprimé en haut du rapport)<textarea name=comment rows=4 maxlength=3000>${E(v.comment || '')}</textarea></label>
${ck('shared', '1', 'Partager avec l’inspecteur qui suit l’école', v.shared)}
<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Enregistrer</button></div></form>`);
        const f = d.querySelector('form');
        f.onsubmit = async e => {
            if (!e.submitter || e.submitter.value !== 'ok') return;
            const vals = n => [...f.querySelectorAll(`input[name=${n}]:checked`)].map(x => x.value);
            const row = { title: f.title.value.trim(), year: S.year || '', sections: vals('sec'), class_names: vals('cl'), comment: f.comment.value.trim() || null, shared: f.shared.checked, updated_at: new Date().toISOString() };
            const q = r ? db.from('stat_reports').update(row).eq('id', r.id) : db.from('stat_reports').insert(Object.assign({ school_id: S.school.id }, row));
            const { error } = await q; if (error) return toast(error.message);
            toast('Rapport enregistré ✓'); oreaReports();
        };
    }
    async function printReport(r) {
        if (!window.OreaStats) return toast('Module statistiques manquant.');
        const { data, error } = await db.rpc('school_stats', { p_year: r.year || S.year || '' });
        if (error) return toast(error.message);
        OreaStats.print(S.school.name, r.title, pick(OreaStats.build(data || {}), r.sections || [], r.class_names || []), r.comment || '');
    }

    /* ================= 2a) RÉGLAGES DE L'ÉCOLE : inspecteurs ================= */
    const oReg = window.vReglages;
    if (typeof oReg === 'function') window.vReglages = function () {
        const r = oReg.apply(this, arguments);
        if (typeof fin === 'function' && fin() && !(window.oreaTest && oreaTest.active())) setTimeout(schoolInspCard, 0);
        return r;
    };
    async function schoolInspCard() {
        const m = document.getElementById('main'); if (!m || S.tab !== 'reglages' || m.querySelector('#ins-card')) return;
        const { data, error } = await db.rpc('v92_school_inspectors');
        if (error || !m.isConnected) return;
        const L = data || [];
        const c = document.createElement('div'); c.className = 'card col'; c.id = 'ins-card';
        c.innerHTML = `<b>🏛 Inspection</b><small>Un inspecteur peut suivre les statistiques de l’école (effectifs, présences, résultats…), jamais l’argent. Vous acceptez, refusez ou retirez l’accès à tout moment.</small>`
            + (L.length ? L.map(i => `<div class=card style="padding:8px 10px;gap:8px;flex-wrap:wrap"><span style="flex:1">${E(i.full_name)}${i.zone ? ' · ' + E(i.zone) : ''}<br><small>${i.status === 'acceptee' ? '✓ suit l’école' : i.status === 'refusee' ? 'refusé' : 'demande en attente'}</small></span>${i.status !== 'acceptee' ? `<button class=ghost style="width:auto" data-ia="${i.inspector_id}">Accepter</button>` : ''}${i.status !== 'refusee' ? `<button class=ghost style="width:auto;color:var(--bad)" data-ir="${i.inspector_id}">${i.status === 'acceptee' ? 'Retirer' : 'Refuser'}</button>` : ''}</div>`).join('') : '<small>Aucun inspecteur pour le moment.</small>');
        const sup = m.querySelector('#rg-support') || null;
        sup ? m.insertBefore(c, sup) : m.appendChild(c);
        const go = async (id, ok) => { const { error: e } = await db.rpc('v92_school_insp_decide', { p_insp: id, p_accept: ok }); if (e) return toast(e.message); toast(ok ? 'Inspecteur accepté ✓' : 'Accès retiré'); c.remove(); schoolInspCard(); };
        c.querySelectorAll('[data-ia]').forEach(b => b.onclick = () => go(b.dataset.ia, true));
        c.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => go(b.dataset.ir, false));
    }

    /* ================= 2b) ESPACE INSPECTEUR ================= */
    const IN = { me: null, sid: null };
    window.oreaInspView = async function () {
        $('#nav').hidden = true; $('#hs').textContent = 'ORÉA · Inspection';
        $('#main').innerHTML = '<div class=sk></div>';
        const [me, sc] = await Promise.all([db.rpc('v92_inspector_me'), db.rpc('v92_insp_schools')]);
        IN.me = me.data && me.data[0];
        if (!IN.me || !IN.me.active) { $('#main').innerHTML = '<div class=auth><h2>Compte inspecteur inactif</h2><p>Contactez ORÉA.</p><button class=ghost onclick=out()>Déconnexion</button></div>'; return; }
        const L = sc.data || [];
        $('#main').innerHTML = `<h3>Bonjour ${E(IN.me.full_name)}</h3><small>${E(IN.me.zone || '')}</small>
<div class="card col"><b>Suivre une école</b><small>Demandez son code d’école au chef d’établissement. Il doit ensuite accepter dans ses Réglages.</small><input id=in-code placeholder="Code de l’école" autocomplete=off><button id=in-req>Envoyer la demande</button></div>
<h3>Mes écoles</h3>` + (L.length ? L.map(s => `<div class="card col" ${s.status === 'acceptee' ? `data-sc="${s.school_id}" style="cursor:pointer"` : 'style="opacity:.7"'}><b>${E(s.name)}</b><small>${E(s.school_type || '')} · ${s.status === 'acceptee' ? 'statistiques disponibles →' : s.status === 'refusee' ? 'refusé par l’école' : 'en attente de l’école'}</small></div>`).join('') : '<p class=empty>Aucune école suivie.</p>')
            + (typeof installCard === 'function' ? installCard() : '') + '<button class=ghost onclick=out()>Déconnexion</button>';
        $('#in-req').onclick = async () => {
            const code = $('#in-code').value.trim(); if (!code) return toast('Écrivez le code de l’école.');
            const { data, error } = await db.rpc('v92_insp_request', { p_code: code });
            if (error) return toast(error.message);
            toast('Demande envoyée à ' + data + ' ✓'); oreaInspView();
        };
        document.querySelectorAll('[data-sc]').forEach(c => c.onclick = () => inspSchool(L.find(x => x.school_id === c.dataset.sc)));
    };
    async function inspSchool(s) {
        const back = `<div class=bar><button class=ghost onclick="oreaInspView()">← Mes écoles</button></div>`;
        $('#main').innerHTML = back + `<h3>${E(s.name)}</h3><div class=sk></div>`;
        const [st, rp] = await Promise.all([db.rpc('v92_insp_stats', { p_school: s.school_id, p_year: null }), db.rpc('v92_insp_reports', { p_school: s.school_id })]);
        if (st.error) { $('#main').innerHTML = back + `<p class=empty>${E(st.error.message)}</p>`; return; }
        const T = window.OreaStats ? OreaStats.build(st.data || {}) : [];
        const R = rp.data || [];
        $('#main').innerHTML = back + `<h3>${E(s.name)}</h3><small>Statistiques calculées le ${new Date().toLocaleDateString('fr-FR')} · aucune donnée financière</small>
<button class=ghost id=in-pr style="margin:10px 0">🖨 Imprimer / PDF</button>`
            + (R.length ? `<div class="card col"><b>Rapports partagés par l’école</b>${R.map(r => `<div class=row style="align-items:center"><span style="flex:1">${E(r.title)}<br><small>${new Date(r.updated_at).toLocaleDateString('fr-FR')}</small></span><button class=ghost style="width:auto" data-rp="${r.id}">🖨</button></div>`).join('')}</div>` : '')
            + (window.OreaStats ? T.map(OreaStats.tableHtml).join('') : '');
        $('#in-pr').onclick = () => OreaStats.print(s.name, 'Statistiques (inspection)', T, '');
        document.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { const r = R.find(x => x.id === b.dataset.rp); OreaStats.print(s.name, r.title, pick(T, r.sections || [], r.class_names || []), r.comment || ''); });
    }
    // Un compte sans école : inspecteur ? (sinon : écran habituel école / ambassadeur)
    const oSetup = window.setupView;
    if (typeof oSetup === 'function') window.setupView = async function () {
        try { const { data } = await db.rpc('v92_inspector_me'); if (data && data[0]) return oreaInspView(); } catch (_) { }
        return oSetup.apply(this, arguments);
    };

    /* ================= 3) ESPACE ORÉA : comptes inspecteur ================= */
    window.oreaInspAdminSection = function () { return `<h3>Inspecteurs</h3><div id=ia-box><div class=sk></div></div>`; };
    window.oreaInspAdminBind = async function () {
        const box = document.getElementById('ia-box'); if (!box) return;
        const { data, error } = await db.rpc('v92_admin_inspectors');
        if (error) { box.innerHTML = `<p class=empty>${E(error.message)}</p>`; return; }
        const L = data || [];
        box.innerHTML = `<div class="card col"><b>Nouveau compte inspecteur</b><small>La personne crée d’abord son compte ORÉA (Créer un compte) avec son e-mail, puis vous l’ajoutez ici.</small><input id=ia-mail type=email placeholder="E-mail de l’inspecteur"><input id=ia-name placeholder="Nom complet"><input id=ia-zone placeholder="Zone / sous-division (facultatif)"><input id=ia-ph type=tel placeholder="Téléphone (facultatif)"><button id=ia-add>Ajouter l’inspecteur</button></div>`
            + (L.length ? L.map(i => `<div class="card col" style="${i.active ? '' : 'opacity:.6'}"><b>${E(i.full_name)}</b><small>${E(i.email || '')}${i.zone ? ' · ' + E(i.zone) : ''}${i.phone ? ' · ' + E(i.phone) : ''} · ${i.schools} école(s) suivie(s)</small><button class=ghost data-ion="${i.user_id}" data-on="${i.active ? 0 : 1}">${i.active ? 'Désactiver' : 'Réactiver'}</button></div>`).join('') : '<p class=empty>Aucun inspecteur.</p>');
        box.querySelector('#ia-add').onclick = async () => {
            const { error: e } = await db.rpc('v92_admin_add_inspector', { p_email: box.querySelector('#ia-mail').value, p_name: box.querySelector('#ia-name').value, p_zone: box.querySelector('#ia-zone').value || null, p_phone: box.querySelector('#ia-ph').value || null });
            if (e) return toast(e.message); toast('Inspecteur ajouté ✓'); oreaInspAdminBind();
        };
        box.querySelectorAll('[data-ion]').forEach(b => b.onclick = async () => { const { error: e } = await db.rpc('v92_admin_inspector_active', { p_uid: b.dataset.ion, p_on: b.dataset.on === '1' }); if (e) return toast(e.message); oreaInspAdminBind(); });
    };
})();
