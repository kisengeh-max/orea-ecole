/* ORÉA École — Espace ORÉA (v88)
   À charger APRÈS app.js et ambassadeur.js. Redéfinit adminDraw() :
   4 onglets (Écoles | Alertes | Ambassadeurs | Prospects). Réutilise extModal,
   setSchoolPhone et adminHistory de app.js.
   v88 : état de chaque école (actif / grâce / lecture seule / bloquée),
         bouton Bloquer / Débloquer, renouvellement +12 mois,
         Équipe (nommer le chef d'établissement, retirer un membre),
         Alertes (essais en double, changements de chef signalés). */

const ADM = { tab: 'ecoles', sch: [], pays: [], amb: [], pro: [], alerts: [] };
if (!document.getElementById('adm-css')) document.head.insertAdjacentHTML('beforeend', '<style id="adm-css">.adm-tabs{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.adm-tabs button:last-child:nth-child(odd){grid-column:1/-1}.adm-tabs button{width:100%;margin:0}@media (min-width:700px){.adm-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.adm-tabs button:last-child:nth-child(odd){grid-column:auto}}</style>');

async function adminDraw() {
    $('#nav').hidden = true;
    $('#main').innerHTML = SK;
    const r = await Promise.all([
        db.rpc('admin_list_schools'),
        db.from('sub_payments').select('amount,currency,created_at'),
        db.rpc('admin_list_ambassadors'),
        db.rpc('admin_list_prospects'),
        db.rpc('v88_admin_alerts')
    ]);
    r.slice(0, 4).forEach(x => { if (x.error) throw x.error; });
    const all = r[0].data || [];
    ADM.sch = all.filter(x => !x.is_test); ADM.test = all.filter(x => x.is_test);   // v90 : écoles TEST à part
    ADM.pays = r[1].data || [];
    try { const t = localStorage.getItem('orea_adm_tab'); if (t) { ADM.tab = t; localStorage.removeItem('orea_adm_tab'); } } catch (_) { }
    ADM.amb = r[2].data || []; ADM.pro = r[3].data || [];
    ADM.alerts = r[4].error ? [] : (r[4].data || []);
    admRender();
}

function admTab(t) { ADM.tab = t; admRender(); }

function admRender() {
    const nPend = ADM.amb.filter(a => a.status === 'pending').length;
    const tb = (k, l) => '<button class="' + (ADM.tab === k ? '' : 'ghost') + '" onclick="admTab(\'' + k + '\')">' + l + '</button>';
    let h = '<h3>Espace ORÉA</h3><div class="row adm-tabs">'
        + tb('ecoles', 'Écoles') + tb('alertes', 'Alertes' + (ADM.alerts.length ? ' 🔔' + ADM.alerts.length : '')) + tb('amb', 'Ambassadeurs' + (nPend ? ' 🔔' + nPend : '')) + tb('pro', 'Prospects') + (typeof oreaInspAdminSection === 'function' ? tb('insp', '🏛 Inspecteurs') : '') + (typeof oreaTestSection === 'function' ? tb('test', '🧪 Test') : '') + '</div>';
    h += ADM.tab === 'amb' ? admAmbSection() : ADM.tab === 'pro' ? admProSection() : ADM.tab === 'alertes' ? admAlertSection() : ADM.tab === 'test' && typeof oreaTestSection === 'function' ? oreaTestSection(ADM.test) : ADM.tab === 'insp' && typeof oreaInspAdminSection === 'function' ? oreaInspAdminSection() : admSchoolSection();
    $('#main').innerHTML = h + installCard() + '<button class=ghost onclick=out()>Déconnexion</button>';
    if (ADM.tab === 'test' && typeof oreaTestBind === 'function') oreaTestBind(ADM.test);
    if (ADM.tab === 'insp' && typeof oreaInspAdminBind === 'function') oreaInspAdminBind();
}

/* ---------- Onglet Écoles ---------- */
function admSchoolSection() {
    const data = ADM.sch, pays = ADM.pays;
    const now = Date.now(), nd = new Date(), act = data.filter(s => ['actif', 'grace'].includes(subPhase(s))).length;
    const m0 = new Date(nd.getFullYear(), nd.getMonth(), 1);
    const thisMonth = pays.filter(p => new Date(p.created_at) >= m0);
    const totCur = list => { const m = {}; list.forEach(p => { m[p.currency] = (m[p.currency] || 0) + Number(p.amount); }); return Object.entries(m).filter(x => x[1] > 0).map(x => nf(x[1]) + ' ' + SYM[x[0]]).join(' · ') || '0 FC'; };
    const ms = []; for (let i = 5; i >= 0; i--) { const d = new Date(nd.getFullYear(), nd.getMonth() - i, 1); ms.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), v: 0 }); }
    pays.forEach(p => { if (p.currency === 'USD') { const d = new Date(p.created_at), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), m = ms.find(x => x.k === k); if (m) m.v += Number(p.amount); } });
    const mx = Math.max(...ms.map(x => x.v), 1);
    let h = `<div class=card><span>Écoles actives / total</span><b>${act} / ${data.length}</b></div><div class=card><span>Revenus ce mois</span><b>${totCur(thisMonth)}</b></div>`;
    h += `<div class="card col"><b>Revenus USD (6 derniers mois)</b><div class="admin-bar">${ms.map(x => `<div style="height:${Math.max(4, Math.round(x.v / mx * 80))}px" title="${nf(x.v)} $"><small>${x.l}</small></div>`).join('')}</div></div>`;
    h += `<div class=row><button onclick=adminHistory()>Historique des encaissements</button></div><h3>Écoles</h3>`;
    return h + (data.length ? data.map(s => {
        const d = s.sub_until ? new Date(s.sub_until) : null;
        const left = d ? Math.ceil((d - now) / 864e5) : -999, ok = left > 0;
        const waMsg = ok ? `Bonjour, l’abonnement de ${s.name} arrive à échéance dans ${left} jour(s).` : `Bonjour, l’abonnement de ${s.name} est arrivé à échéance.`;
        const waUrl = s.phone ? waLink(s.phone, waMsg) : null;
        const byAmb = s.ambassador_id && s.amb_status === 'active';
        const sp = byAmb ? 'Parrain : <b>' + esc(s.amb_name) + '</b> (' + esc(s.amb_code || '') + ')'
            : 'Parrain : <b>moi (propriétaire)</b>' + (s.ambassador_id ? ' <small>— ' + esc(s.amb_name) + ' est ' + (s.amb_status === 'blocked' ? 'bloqué' : 'en attente') + '</small>' : '');
        const pr = s.sub_price != null
            ? 'Prix convenu / mois : <b>' + ambMoney(s.sub_price, s.sub_cur) + '</b>' + (byAmb ? ' · Commission ' + nf(Number(s.commission_pct), 0) + ' % : <b>' + ambMoney(Number(s.sub_price) * Number(s.commission_pct) / 100, s.sub_cur) + '</b>' : '')
            : 'Prix convenu / mois : <b>non défini</b>';
        return `<div class="card col"><b>${esc(s.name)}</b><span>${esc(s.director_name || '—')} · ${esc(s.director_email || '')}</span><small>${s.students} élèves · ${s.members} compte(s) · code ${esc(s.code)}</small>${admPhaseLabel(s, d, left)}<span>${sp}</span><span>${pr}</span>`
            + `<div class=row>${waUrl ? `<a class="btn ghost" style="width:auto;text-decoration:none" href="${waUrl}" target="_blank">💬 Relance WhatsApp</a><a class="btn ghost" style="width:auto;text-decoration:none" href="${esc(smsLink(s.phone, waMsg))}">SMS</a>` : `<button class=ghost style="width:auto" onclick="setSchoolPhone('${s.id}')">📞 Ajouter WhatsApp</button>`}${s.phone ? `<button class=ghost style="width:auto" data-p="${esc(s.phone)}" onclick="setSchoolPhone('${s.id}',this.dataset.p)">✏</button>` : ''}</div>`
            + `<div class=row><button class=ghost onclick="admSponsor('${s.id}')">🤝 Parrain</button><button class=ghost onclick="admPrice('${s.id}')">💰 Prix</button></div>`
            + `<div class=row>${EXT_MONTHS.map(n => `<button class=ghost onclick="extModal('${s.id}',${n})">+${n} m</button>`).join('')}</div>`
            + `<div class=row><button class=ghost onclick="admMembers('${s.id}')">👑 Équipe et chef</button>${s.blocked ? `<button onclick="admBlock('${s.id}',false)">🔓 Débloquer</button>` : `<button class=ghost onclick="admBlock('${s.id}',true)">⛔ Bloquer</button>`}</div></div>`;
    }).join('') : '<p class=empty>Aucune école pour le moment.</p>');
}

function admSponsor(sid) {
    const s = ADM.sch.find(x => x.id === sid); if (!s) return;
    const opts = [['', 'Moi (propriétaire)']].concat(ADM.amb.filter(a => a.status === 'active').map(a => [a.user_id, a.full_name + ' (' + a.code + ')']));
    ask('Parrain de ' + esc(s.name), [{ n: 'amb', l: 'Parrainée par', o: opts, v: s.ambassador_id || '' }], async v => {
        const { error } = await db.rpc('admin_set_school_sponsor', { sid, p_amb: v.amb || null });
        if (error) throw error;
        toast('Parrain enregistré'); adminView();
    });
}

function admPrice(sid) {
    const s = ADM.sch.find(x => x.id === sid); if (!s) return;
    ask('Prix convenu / mois — ' + esc(s.name), [
        { n: 'price', l: 'Montant par mois', t: 'number', v: s.sub_price != null ? String(s.sub_price) : '' },
        { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: s.sub_cur || 'USD' }
    ], async v => {
        const { error } = await db.rpc('admin_set_school_price', { sid, p_price: +v.price, p_cur: v.cur });
        if (error) throw error;
        toast('Prix enregistré'); adminView();
    });
}

/* ---------- Onglet Ambassadeurs ---------- */
function admAmbSection() {
    const L = { pending: 'En attente', active: 'Actif', blocked: 'Bloqué' };
    let h = '<h3>Ambassadeurs (' + ADM.amb.length + ')</h3>';
    if (!ADM.amb.length) return h + '<p class=empty>Aucune demande pour le moment.</p>';
    return h + ADM.amb.map(a => {
        const wa = a.phone ? waLink(a.phone, 'Bonjour ' + a.full_name + ', ici ORÉA École.') : null;
        const btn = a.status === 'active'
            ? '<button class=ghost onclick="admAmbStatus(\'' + a.user_id + '\',\'blocked\')">⛔ Bloquer</button>'
            : '<button onclick="admAmbStatus(\'' + a.user_id + '\',\'active\')">' + (a.status === 'pending' ? '✅ Nommer' : '🔓 Débloquer') + '</button>';
        return '<div class="card col"><b>' + esc(a.full_name) + '</b>'
            + '<span class="amb-pill' + (a.status === 'active' ? ' in' : '') + '">' + L[a.status] + '</span>'
            + '<span>' + esc([a.phone, a.email].filter(Boolean).join(' · ') || '—') + '</span>'
            + '<small>Code : <b>' + esc(a.code || 'sera créé à la nomination') + '</b> · Commission ' + nf(Number(a.commission_pct), 0) + ' %</small>'
            + '<small>' + a.schools_count + ' école(s) · ' + a.active_schools + ' active(s) · ' + a.prospects_count + ' prospect(s)</small>'
            + '<div class=row>' + btn
            + '<button class=ghost onclick="admAmbPct(\'' + a.user_id + '\')">% Taux</button>'
            + (wa ? '<a class="btn ghost" style="width:auto;text-decoration:none" target=_blank href="' + wa + '">💬</a><a class="btn ghost" style="width:auto;text-decoration:none" href="' + esc(smsLink(a.phone, 'Bonjour ' + a.full_name + ', ici ORÉA École.')) + '">SMS</a>' : '') + '</div></div>';
    }).join('');
}

async function admAmbStatus(uid, st) {
    const a = ADM.amb.find(x => x.user_id === uid); if (!a) return;
    if (st === 'blocked' && !confirm('Bloquer ' + a.full_name + ' ? Ses écoles seront considérées comme parrainées par toi, et il ne verra plus rien.')) return;
    const { error } = await db.rpc('admin_set_ambassador_status', { p_uid: uid, p_status: st });
    if (error) return toast(error.message);
    toast(st === 'active' ? 'Ambassadeur actif' : 'Ambassadeur bloqué'); adminView();
}

function admAmbPct(uid) {
    const a = ADM.amb.find(x => x.user_id === uid); if (!a) return;
    ask('Commission de ' + esc(a.full_name), [{ n: 'pct', l: 'Taux en % (0 à 100)', t: 'number', v: String(a.commission_pct) }], async v => {
        const { error } = await db.rpc('admin_set_ambassador_commission', { p_uid: uid, p_pct: +v.pct });
        if (error) throw error;
        toast('Taux enregistré'); adminView();
    });
}

/* ---------- Onglet Prospects (tous les ambassadeurs) ---------- */
function admProSection() {
    const P = ADM.pro;
    const n = P.filter(p => p.status !== 'inscrite').length;
    let h = '<h3>Prospects (' + P.length + ')</h3><p class=amb-sum>' + n + ' à suivre · ' + (P.length - n) + ' inscrite(s)</p>';
    if (!P.length) return h + '<p class=empty>Aucun prospect pour le moment.</p>';
    return h + P.map(p => {
        const msg = 'Bonjour' + (p.contact_name ? ' ' + p.contact_name : '') + ', ici ORÉA École. Nous avons échangé avec ' + p.amb_name + ' au sujet de ' + p.school_name + '. Puis-je vous aider à démarrer ?';
        const wa = p.phone ? waLink(p.phone, msg) : null;
        return '<div class="card col"><b>' + esc(p.school_name) + '</b>'
            + (p.contact_name || p.phone ? '<span>' + esc([p.contact_name, p.phone].filter(Boolean).join(' · ')) + '</span>' : '')
            + '<span class="amb-pill' + (p.status === 'inscrite' ? ' in' : '') + '">' + (p.status === 'inscrite' ? '✅ ' : '') + AMB_ST[p.status] + '</span>'
            + '<small>Ambassadeur : ' + esc(p.amb_name) + (p.amb_status !== 'active' ? ' (' + (p.amb_status === 'blocked' ? 'bloqué' : 'en attente') + ')' : '') + '</small>'
            + (p.note ? '<small>' + esc(p.note) + '</small>' : '')
            + (wa ? '<div class=row><a class="btn ghost" style="width:auto;text-decoration:none" target=_blank href="' + wa + '">💬 WhatsApp</a><a class="btn ghost" style="width:auto;text-decoration:none" href="' + esc(smsLink(p.phone, msg)) + '">SMS</a></div>' : '') + '</div>';
    }).join('');
}

/* ---------- v88 : état d'une école ---------- */
function admPhaseLabel(s, d, left) {
    const ph = subPhase(s), fd = x => x.toLocaleDateString('fr-FR');
    if (ph === 'bloquee') return `<span class=due>🚫 Bloquée par ORÉA${s.blocked_note ? ' · ' + esc(s.blocked_note) : ''}</span>`;
    if (ph === 'actif') return `<span class="${left > 7 ? 'ok' : 'due'}">Actif jusqu’au ${fd(d)} (${left} j)</span>`;
    if (ph === 'grace') return `<span class=due>⛔ Expiré le ${fd(d)} · lecture seule le ${fd(new Date(d.getTime() + GRACE_J * 864e5))}</span>`;
    return `<span class=due>🔒 Lecture seule${d ? ' depuis le ' + fd(new Date(d.getTime() + GRACE_J * 864e5)) : ''}</span>`;
}

/* ---------- v88 : bloquer / débloquer une école ---------- */
function admBlock(sid, on) {
    const s = ADM.sch.find(x => x.id === sid); if (!s) return;
    if (!on) {
        if (!confirm('Débloquer ' + s.name + ' ? L’équipe retrouve immédiatement l’accès.')) return;
        return db.rpc('v88_admin_block', { sid, p_block: false, p_note: null }).then(({ error }) => { if (error) return toast(error.message); toast('École débloquée'); adminView(); });
    }
    ask('Bloquer ' + esc(s.name), [{ n: 'note', l: 'Raison (visible seulement par vous)', r: false }], async v => {
        const { error } = await db.rpc('v88_admin_block', { sid, p_block: true, p_note: (v.note || '').trim() || null });
        if (error) return toast(error.message);
        toast('École bloquée : plus aucun accès pour l’équipe'); adminView();
    });
}

/* ---------- v88 : équipe d'une école, nommer le chef ---------- */
const ADM_ROLE = { directeur: 'Direction', enseignant: 'Enseignant', percepteur: 'Percepteur', parent: 'Parent' };
async function admMembers(sid) {
    const s = ADM.sch.find(x => x.id === sid); if (!s) return;
    const { data, error } = await db.rpc('v88_admin_members', { sid });
    if (error) return toast(error.message);
    const L = data || [];
    const isHead = m => m.role === 'directeur' && !m.etudes && !m.secretariat;
    const lbl = m => isHead(m) ? '👑 Chef d’établissement' : m.role === 'directeur' ? (m.etudes ? 'Directeur des études' : 'Secrétariat') : (ADM_ROLE[m.role] || m.role);
    const rows = L.map(m => `<div class="card col"><b>${esc(m.full_name || '—')}</b><small>${lbl(m)}${m.active ? '' : ' · désactivé'} · ${esc(m.email || '')}</small>`
        + `<div class=row>${m.active && !isHead(m) ? `<button class=ghost data-head="${m.id}">👑 Nommer chef</button>` : ''}`
        + `${m.active && !isHead(m) ? `<button class=ghost data-off="${m.id}">Retirer</button>` : ''}${!m.active ? `<button class=ghost data-on="${m.id}">Réactiver</button>` : ''}</div></div>`).join('');
    const d = show(`<h3>Équipe · ${esc(s.name)}</h3><p><small>Nommer un chef : l’ancien chef devient enseignant (vous pouvez ensuite le retirer). Si le nouveau chef n’a pas de compte, il rejoint d’abord l’école avec le code <b>${esc(s.code)}</b>.</small></p>${rows || '<p class=empty>Aucun membre.</p>'}<form method=dialog><button class=ghost>Fermer</button></form>`);
    const nm = id => (L.find(x => x.id === id) || {}).full_name || '';
    d.querySelectorAll('[data-head]').forEach(b => b.onclick = async () => {
        if (!confirm('Nommer ' + nm(b.dataset.head) + ' chef d’établissement de ' + s.name + ' ?\nL’ancien chef deviendra enseignant.')) return;
        const { error } = await db.rpc('v88_admin_set_head', { sid, p_uid: b.dataset.head });
        if (error) return toast(error.message);
        toast('Nouveau chef nommé ✓'); admMembers(sid);
    });
    d.querySelectorAll('[data-off],[data-on]').forEach(b => b.onclick = async () => {
        const on = !!b.dataset.on, uid = b.dataset.on || b.dataset.off;
        if (!on && !confirm('Retirer ' + nm(uid) + ' de ' + s.name + ' ? Son compte ne pourra plus ouvrir l’école (rien n’est effacé).')) return;
        const { error } = await db.rpc('v88_admin_set_member_active', { sid, p_uid: uid, p_active: on });
        if (error) return toast(error.message);
        toast(on ? 'Membre réactivé' : 'Membre retiré'); admMembers(sid);
    });
}

/* ---------- v88 : onglet Alertes ---------- */
function admAlertSection() {
    const A = ADM.alerts;
    let h = '<h3>Alertes (' + A.length + ')</h3>';
    if (!A.length) return h + '<p class=empty>Aucune alerte en attente.</p>';
    const fdt = x => new Date(x).toLocaleString('fr-FR');
    return h + A.map(a => {
        const dt = a.detail || {};
        if (a.kind === 'essai') return `<div class="card col"><b>⚠️ Essai à vérifier · ${esc(a.school_name || dt.ecole || '')}</b>`
            + `<span>Créée le ${fdt(a.created_at)} par ${esc(dt.chef || '—')} · ${esc(dt.email || '')}</span>`
            + `<small>Raison : ${esc((dt.raisons || []).join(', '))}${dt.autres ? ' · déjà vu : ' + esc(dt.autres) : ''}</small>`
            + `<div class=row><button class=ghost onclick="admAlertClose('${a.id}','acceptee')">✅ Laisser l’essai</button><button onclick="admAlertClose('${a.id}','bloquee')">⛔ Bloquer l’école</button></div></div>`;
        return `<div class="card col"><b>👑 Changement de chef signalé · ${esc(a.school_name || '')}</b>`
            + `<span>Par ${esc(a.by_name || '—')} le ${fdt(a.created_at)}</span>${dt.note ? `<small>« ${esc(dt.note)} »</small>` : ''}`
            + `<div class=row><button onclick="admMembers('${a.school_id}')">👑 Équipe et chef</button><button class=ghost onclick="admAlertClose('${a.id}','traitee')">Terminé</button><button class=ghost onclick="admAlertClose('${a.id}','ignoree')">Ignorer</button></div></div>`;
    }).join('');
}
async function admAlertClose(id, st) {
    if (st === 'bloquee' && !confirm('Bloquer cette école ? L’équipe n’aura plus aucun accès.')) return;
    const { error } = await db.rpc('v88_admin_alert_close', { p_id: id, p_status: st });
    if (error) return toast(error.message);
    toast(st === 'bloquee' ? 'École bloquée' : 'Alerte fermée'); adminView();
}
