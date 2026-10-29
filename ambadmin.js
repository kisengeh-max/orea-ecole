/* ORÉA École — Paquet Ambassadeur (tranche 3) : écran Administration
   À charger APRÈS app.js et ambassadeur.js. Redéfinit adminDraw() :
   3 onglets (Écoles | Ambassadeurs | Prospects). Réutilise extModal,
   setSchoolPhone et adminHistory de app.js. */

const ADM = { tab: 'ecoles', sch: [], pays: [], amb: [], pro: [] };

async function adminDraw() {
    $('#nav').hidden = true;
    $('#main').innerHTML = SK;
    const r = await Promise.all([
        db.rpc('admin_list_schools'),
        db.from('sub_payments').select('amount,currency,created_at'),
        db.rpc('admin_list_ambassadors'),
        db.rpc('admin_list_prospects')
    ]);
    r.forEach(x => { if (x.error) throw x.error; });
    ADM.sch = r[0].data || []; ADM.pays = r[1].data || [];
    ADM.amb = r[2].data || []; ADM.pro = r[3].data || [];
    admRender();
}

function admTab(t) { ADM.tab = t; admRender(); }

function admRender() {
    const nPend = ADM.amb.filter(a => a.status === 'pending').length;
    const tb = (k, l) => '<button class="' + (ADM.tab === k ? '' : 'ghost') + '" onclick="admTab(\'' + k + '\')">' + l + '</button>';
    let h = '<h3>Espace administrateur</h3><div class=row>'
        + tb('ecoles', 'Écoles') + tb('amb', 'Ambassadeurs' + (nPend ? ' 🔔' + nPend : '')) + tb('pro', 'Prospects') + '</div>';
    h += ADM.tab === 'amb' ? admAmbSection() : ADM.tab === 'pro' ? admProSection() : admSchoolSection();
    $('#main').innerHTML = h + installCard() + '<button class=ghost onclick=out()>Déconnexion</button>';
}

/* ---------- Onglet Écoles ---------- */
function admSchoolSection() {
    const data = ADM.sch, pays = ADM.pays;
    const now = Date.now(), nd = new Date(), act = data.filter(s => new Date(s.sub_until) > now).length;
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
        return `<div class="card col"><b>${esc(s.name)}</b><span>${esc(s.director_name || '—')} · ${esc(s.director_email || '')}</span><small>${s.students} élèves · ${s.members} compte(s) · code ${esc(s.code)}</small><span class="${ok && left > 7 ? 'ok' : 'due'}">${ok ? 'Actif jusqu’au ' + d.toLocaleDateString('fr-FR') + ' (' + left + ' j)' : '⛔ Expiré'}</span><span>${sp}</span><span>${pr}</span>`
            + `<div class=row>${waUrl ? `<a class="btn ghost" style="width:auto;text-decoration:none" href="${waUrl}" target="_blank">💬 Relance WhatsApp</a>` : `<button class=ghost style="width:auto" onclick="setSchoolPhone('${s.id}')">📞 Ajouter WhatsApp</button>`}${s.phone ? `<button class=ghost style="width:auto" onclick="setSchoolPhone('${s.id}','${esc(s.phone)}')">✏</button>` : ''}</div>`
            + `<div class=row><button class=ghost onclick="admSponsor('${s.id}')">🤝 Parrain</button><button class=ghost onclick="admPrice('${s.id}')">💰 Prix</button></div>`
            + `<div class=row>${[1, 2, 3, 6].map(n => `<button class=ghost onclick="extModal('${s.id}','${esc(s.name)}',${n})">+${n} m</button>`).join('')}</div></div>`;
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
            + (wa ? '<a class="btn ghost" style="width:auto;text-decoration:none" target=_blank href="' + wa + '">💬</a>' : '') + '</div></div>';
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
            + (wa ? '<div class=row><a class="btn ghost" style="width:auto;text-decoration:none" target=_blank href="' + wa + '">💬 WhatsApp</a></div>' : '') + '</div>';
    }).join('');
}
