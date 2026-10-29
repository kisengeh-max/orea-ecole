/* ORÉA École — Paquet Ambassadeur (tranche 2)
   À charger APRÈS app.js. Redéfinit setupView() : écran de choix,
   attente de validation, tableau de bord de l'ambassadeur, prospects. */

document.head.insertAdjacentHTML('beforeend', '<style>'
    + '.amb-pill{display:inline-block;width:fit-content;padding:2px 10px;border-radius:99px;border:1px solid var(--line);font-size:12px;color:var(--mut)}'
    + '.amb-pill.in{color:var(--ok);border-color:var(--ok)}'
    + '.amb-note{border-color:var(--gold)}'
    + '.amb-name{font-family:var(--serif);font-size:20px;color:var(--tx)}'
    + '.amb-sum{font-size:15px;color:var(--mut);margin:0 0 6px}'
    + '.amb-btn{width:auto;text-decoration:none;text-align:center}'
    + '</style>');

const A = { me: null, schools: [], prospects: [], notifs: [] };
const AMB_ST = { contactee: 'Contactée', interessee: 'Intéressée', inscrite: 'Inscrite' };
const ambLeft = s => s.sub_until ? Math.ceil((new Date(s.sub_until) - Date.now()) / 864e5) : -999;
const ambMoney = (n, c) => nf(Number(n), c === 'CDF' ? 0 : 2) + ' ' + (SYM[c] || c);

function ambErr(e, retry) {
    console.error('ambassadeur', e);
    $('#nav').hidden = true;
    const msg = isNet(e) ? 'Pas de connexion internet.' : String((e && e.message) || e);
    $('#main').innerHTML = '<div class=auth><h2>Ambassadeur</h2><p>Impossible d’afficher la page : ' + esc(msg) + '</p><button onclick=' + retry + '()>Réessayer</button><button class=ghost onclick=out()>Déconnexion</button></div>';
}

/* ---------- Point d'entrée (remplace setupView de app.js) ---------- */
function setupView() { return ambEntry(); }

async function ambEntry() {
    try {
        $('#nav').hidden = true;
        $('#main').innerHTML = SK;
        const { data, error } = await db.rpc('amb_me');
        if (error) throw error;
        const me = data && data[0];
        if (!me) return ambChoice();
        A.me = me;
        if (me.status === 'active') return ambDraw();
        return ambWait();
    } catch (e) { ambErr(e, 'ambEntry'); }
}

/* ---------- Écran « Vous êtes : » ---------- */
function ambChoice() {
    $('#nav').hidden = true;
    $('#hs').textContent = 'ORÉA École';
    $('#main').innerHTML = '<div class=auth><h2>Vous êtes :</h2>'
        + '<button id=k1>🏫 Directeur</button>'
        + '<button class=ghost id=k2>👩‍🏫 Enseignant / Percepteur</button>'
        + '<button class=ghost id=k3>👪 Parent d’élèves</button>'
        + '<button class=ghost id=k4>🤝 ORÉA Ambassadeur</button>'
        + '<button class=ghost id=lo>Déconnexion</button></div>';
    $('#lo').onclick = out;
    $('#k1').onclick = () => ask('Nouvelle école', [
        { n: 'school', l: 'Nom de l’école' },
        { n: 'me', l: 'Ton nom' },
        { n: 'code', l: 'Code ambassadeur (facultatif)', r: false }
    ], async v => {
        const { error } = await db.rpc('create_school', { school_name: v.school.trim(), my_name: v.me.trim(), amb_code: (v.code || '').trim() || null });
        if (error) throw error;
        boot();
    });
    $('#k2').onclick = () => ask('Rejoindre une école', [
        { n: 'code', l: 'Code d’invitation' },
        { n: 'me', l: 'Ton nom' }
    ], async v => {
        const { error } = await db.rpc('join_school', { invite: v.code.trim(), my_name: v.me.trim() });
        if (error) throw error;
        boot();
    });
    $('#k3').onclick = () => { location.href = 'parent.html'; };
    $('#k4').onclick = () => ask('Devenir ambassadeur ORÉA', [
        { n: 'name', l: 'Ton nom' },
        { n: 'phone', l: 'Téléphone WhatsApp', t: 'tel' }
    ], async v => {
        const { error } = await db.rpc('amb_signup', { p_name: v.name.trim(), p_phone: v.phone.trim() });
        if (error) throw error;
        toast('Demande envoyée');
        ambEntry();
    });
}

/* ---------- Attente / blocage ---------- */
function ambWait() {
    $('#nav').hidden = true;
    $('#hs').textContent = 'Ambassadeur';
    const blocked = A.me.status === 'blocked';
    $('#main').innerHTML = '<div class=auth><h2>' + (blocked ? 'Compte suspendu' : 'Compte en attente de validation par ORÉA') + '</h2>'
        + '<p>' + (blocked ? 'Ton accès ambassadeur est suspendu. Contacte ORÉA pour en savoir plus.' : 'Merci ' + esc(A.me.full_name) + ' ! Ta demande a bien été envoyée. Tu pourras utiliser ton espace dès que le propriétaire t’aura nommé ambassadeur.') + '</p>'
        + '<button id=rf>↻ Actualiser</button>'
        + (typeof ADMIN_WA !== 'undefined' && ADMIN_WA ? '<a class="btn ghost" style="text-align:center;text-decoration:none" target=_blank href="https://wa.me/' + ADMIN_WA + '?text=' + encodeURIComponent('Bonjour, je suis ' + A.me.full_name + ', ma demande d’ambassadeur ORÉA est en attente.') + '">💬 Contacter ORÉA</a>' : '')
        + '<button class=ghost id=lo>Déconnexion</button></div>';
    $('#rf').onclick = ambEntry;
    $('#lo').onclick = out;
}

/* ---------- Tableau de bord ---------- */
async function ambView() { try { await ambDraw(); } catch (e) { ambErr(e, 'ambView'); } }

async function ambDraw() {
    $('#nav').hidden = true;
    $('#hs').textContent = 'Ambassadeur';
    $('#main').innerHTML = SK;
    const [a, b, c, d] = await Promise.all([db.rpc('amb_my_schools'), db.rpc('amb_prospects_list'), db.rpc('amb_notifs'), db.rpc('amb_me')]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    if (c.error) throw c.error;
    if (d.error) throw d.error;
    const me = d.data && d.data[0];
    if (!me || me.status !== 'active') { A.me = me || A.me; return me ? ambWait() : ambChoice(); }
    A.me = me; A.schools = a.data || []; A.prospects = b.data || []; A.notifs = c.data || [];

    const L = A.schools, nAct = L.filter(s => ambLeft(s) > 0).length, nRel = L.filter(s => ambLeft(s) <= 7).length;
    const un = A.notifs.filter(n => !n.read_at);
    let h = '<h3>Bonjour ' + esc(me.full_name) + '</h3>';
    if (un.length) h += '<div class="card col amb-note"><b>🔔 ' + un.length + ' nouveauté(s)</b>' + un.map(n => '<span>' + esc(n.body) + '</span>').join('') + '<button id=nr>OK, j’ai vu</button></div>';
    h += '<div class="card col"><span>Ton code de parrainage</span><b class=amb-name>' + esc(me.code || '—') + '</b>'
        + '<small>À donner aux directeurs : ils le saisissent en créant leur école.</small>'
        + '<div class=row><button class=ghost style=width:auto id=cc>Copier</button>'
        + '<button class=ghost style=width:auto id=cs>Partager sur WhatsApp</button></div></div>';
    h += '<h3>Mes écoles</h3><p class=amb-sum>' + L.length + ' école(s) · ' + nAct + ' active(s) · ' + nRel + ' à relancer</p>';
    h += L.length ? L.map(ambSchoolCard).join('') : '<p class=empty>Aucune école parrainée pour le moment.</p>';
    h += '<h3>Prospects (' + A.prospects.length + ')</h3><div class=row><button onclick=ambProspect()>＋ Ajouter un prospect</button></div>';
    h += A.prospects.length ? A.prospects.map(ambProspectCard).join('') : '<p class=empty>Note ici les écoles que tu démarches.</p>';
    h += '<div class=row><button class=ghost onclick=ambView()>↻ Actualiser</button></div>' + installCard() + '<button class=ghost onclick=out()>Déconnexion</button>';
    $('#main').innerHTML = h;

    const nr = $('#nr');
    if (nr) nr.onclick = async () => { const { error } = await db.rpc('amb_notifs_read'); if (error) return toast(error.message); ambView(); };
    const code = me.code || '';
    $('#cc').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Code copié'), () => toast(code)); };
    $('#cs').onclick = () => { const u = 'https://wa.me/?text=' + encodeURIComponent('Bonjour, voici mon code ambassadeur ORÉA École : ' + code + '. Saisis-le en créant ton école sur https://kisengeh-max.github.io/orea-ecole/'); window.open(u, '_blank'); };
}

function ambSchoolCard(s) {
    const left = ambLeft(s), d = s.sub_until ? new Date(s.sub_until) : null;
    const dot = left <= 0 ? '🔴' : left <= 7 ? '🟠' : '🟢';
    const st = left > 0 ? 'Actif jusqu’au ' + d.toLocaleDateString('fr-FR') + ' (' + left + ' j)' : '⛔ Expiré';
    const pct = Number(s.commission_pct);
    const price = s.sub_price != null
        ? '<span>Prix convenu / mois : <b>' + ambMoney(s.sub_price, s.sub_cur) + '</b></span><span class=ok>Ma commission (' + nf(pct, 0) + ' %) : ' + ambMoney(Number(s.sub_price) * pct / 100, s.sub_cur) + '</span>'
        : '<span class=due>Prix convenu / mois : non défini</span>';
    const msg = left > 0 ? 'Bonjour, l’abonnement de ' + s.name + ' arrive à échéance dans ' + left + ' jour(s).' : 'Bonjour, l’abonnement de ' + s.name + ' est arrivé à échéance.';
    const wa = s.phone ? waLink(s.phone, msg) : null;
    return '<div class="card col"><span class=amb-name>' + dot + ' ' + esc(s.name) + '</span>'
        + '<span>Directeur : ' + esc(s.director_name || '—') + '</span>'
        + '<small>' + s.students + ' élève(s) · ' + s.members + ' compte(s)</small>'
        + '<span class="' + (left > 7 ? 'ok' : 'due') + '">' + st + '</span>' + price
        + '<div class=row>' + (wa ? '<a class="btn ghost amb-btn" target=_blank href="' + wa + '">💬 Relancer</a><button class=ghost style=width:auto onclick="ambPhone(\'' + s.id + '\')">✏ N°</button>' : '<button class=ghost style=width:auto onclick="ambPhone(\'' + s.id + '\')">📞 Ajouter WhatsApp</button>')
        + '<button class=ghost style=width:auto onclick="ambPrice(\'' + s.id + '\')">💰 Prix</button></div></div>';
}

function ambPrice(id) {
    const s = A.schools.find(x => x.id === id); if (!s) return;
    ask('Prix convenu / mois — ' + esc(s.name), [
        { n: 'price', l: 'Montant par mois', t: 'number', v: s.sub_price != null ? String(s.sub_price) : '' },
        { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: s.sub_cur || 'USD' }
    ], async v => {
        const { error } = await db.rpc('amb_set_price', { sid: id, p_price: +v.price, p_cur: v.cur });
        if (error) throw error;
        toast('Prix enregistré'); ambView();
    });
}

function ambPhone(id) {
    const s = A.schools.find(x => x.id === id); if (!s) return;
    ask('Numéro WhatsApp — ' + esc(s.name), [{ n: 'phone', l: 'Numéro', t: 'tel', v: s.phone || '' }], async v => {
        const { error } = await db.rpc('amb_set_school_phone', { sid: id, p: v.phone.trim() || null });
        if (error) throw error;
        toast('Numéro enregistré'); ambView();
    });
}

/* ---------- Prospects ---------- */
function ambProspectCard(p) {
    const msg = 'Bonjour' + (p.contact_name ? ' ' + p.contact_name : '') + ', je suis ' + A.me.full_name + ', ambassadeur ORÉA École. ORÉA École est une application qui simplifie la gestion de ' + p.school_name + ' : paiements, présences, communication avec les parents. Puis-je vous la présenter ?' + (A.me.code ? ' Lors de l’inscription, utilisez mon code : ' + A.me.code + '.' : '');
    const wa = p.phone ? waLink(p.phone, msg) : null;
    return '<div class="card col"><b>' + esc(p.school_name) + '</b>'
        + (p.contact_name || p.phone ? '<span>' + esc([p.contact_name, p.phone].filter(Boolean).join(' · ')) + '</span>' : '')
        + '<span class="amb-pill' + (p.status === 'inscrite' ? ' in' : '') + '">' + (p.status === 'inscrite' ? '✅ ' : '') + AMB_ST[p.status] + '</span>'
        + (p.note ? '<small>' + esc(p.note) + '</small>' : '')
        + '<div class=row>' + (wa ? '<a class="btn ghost amb-btn" target=_blank href="' + wa + '">💬 WhatsApp</a>' : '')
        + '<button class=ghost style=width:auto onclick="ambProspect(\'' + p.id + '\')">✏</button>'
        + '<button class=ghost style=width:auto onclick="ambProspectDel(\'' + p.id + '\')">🗑</button></div></div>';
}

function ambProspect(id) {
    const p = id ? A.prospects.find(x => x.id === id) : null;
    ask(p ? 'Modifier le prospect' : 'Nouveau prospect', [
        { n: 'name', l: 'Nom de l’école', v: p ? p.school_name : '' },
        { n: 'contact', l: 'Nom du contact', v: p ? p.contact_name || '' : '', r: false },
        { n: 'phone', l: 'Téléphone / WhatsApp (conseillé)', t: 'tel', v: p ? p.phone || '' : '', r: false },
        { n: 'status', l: 'Statut', o: Object.entries(AMB_ST), v: p ? p.status : 'contactee' },
        { n: 'note', l: 'Note', t: 'textarea', v: p ? p.note || '' : '', r: false }
    ], async v => {
        const { error } = await db.rpc('amb_prospect_save', { p_id: id || null, p_school_name: v.name.trim(), p_contact: v.contact.trim(), p_phone: v.phone.trim(), p_status: v.status, p_note: v.note.trim() });
        if (error) throw error;
        toast('Prospect enregistré'); ambView();
    });
}

async function ambProspectDel(id) {
    if (!confirm('Supprimer ce prospect ?')) return;
    const { error } = await db.rpc('amb_prospect_delete', { p_id: id });
    if (error) return toast(error.message);
    toast('Prospect supprimé'); ambView();
}
