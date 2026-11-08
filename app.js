const tfetch = (u, o = {}) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
    if (o.signal) o.signal.addEventListener('abort', () => c.abort());
    return fetch(u, { ...o, signal: c.signal }).finally(() => clearTimeout(t));
};

const db = supabase.createClient(OREA_CONFIG.SUPABASE_URL, OREA_CONFIG.SUPABASE_ANON_KEY, { global: { fetch: tfetch } });
const $ = s => document.querySelector(s);
const CUR = ['CDF', 'USD', 'EUR'];
const SYM = { CDF: 'FC', USD: '$', EUR: '€' };

const S = {
    me: null, school: null, classes: [], stu: [], cls: null, view: 'grid', sort: 'alpha', tab: 'accueil',
    cur: localStorage.cur || 'CDF', year: null, q: '', ft: 'all', offline: false,
    fees: [], fpaid: {}, terms: {}, depenses: [], depDate: null, bilDate: null,
    impcls: '', impf: 'all', imps: 'anciennete', _bilan: null, events: [], evMonth: null,
    absM: null, sanM: null
};
S.curTermFilter = null;
S.ro = false; // v88 : lecture seule (abonnement expiré depuis plus de 7 jours)

/* ---------- v88 : état de l'abonnement ----------
   actif   : abonnement en cours
   grace   : expiré depuis moins de 7 jours → tout fonctionne, bandeau rouge
   lecture : expiré depuis 7 jours ou plus → consultation + encaissement seulement
   bloquee : accès suspendu par ORÉA */
const GRACE_J = 7;
function subPhase(s = S.school) {
    if (!s) return 'actif';
    if (s.blocked) return 'bloquee';
    if (!s.sub_until) return 'lecture';
    const t = new Date(s.sub_until).getTime(), n = Date.now();
    return n < t ? 'actif' : n < t + GRACE_J * 864e5 ? 'grace' : 'lecture';
}
// En lecture seule, l'application refuse tout de suite les modifications (la base les refuse aussi),
// sauf l'encaissement et ce qui l'accompagne.
const RO_OK = new Set(['payments', 'fee_payments', 'closures', 'change_requests', 'payment_plans', 'notifications', 'push_subs', 'parent_acks', 'announcement_views']);
const RO_MSG = 'Lecture seule : l’abonnement de l’école a expiré. Vous pouvez consulter et encaisser, mais plus modifier. Le chef d’établissement peut renouveler auprès d’ORÉA.';
(function () {
    const from0 = db.from.bind(db);
    const deny = () => {
        const r = { data: null, error: { message: RO_MSG, code: 'ORO' } };
        const p = new Proxy({}, { get(o, k) {
            if (k === 'then') return (a, c) => Promise.resolve(r).then(a, c);
            if (k === 'catch') return c => Promise.resolve(r).catch(c);
            if (k === 'finally') return f => Promise.resolve(r).finally(f);
            return () => p;
        } });
        return p;
    };
    db.from = function (t) {
        const b = from0(t);
        if (!S.ro || RO_OK.has(t)) return b;
        return new Proxy(b, { get(o, k) {
            if (k === 'insert' || k === 'update' || k === 'upsert' || k === 'delete') return deny;
            const v = o[k]; return typeof v === 'function' ? v.bind(o) : v;
        } });
    };
})();

document.documentElement.dataset.theme = localStorage.theme || 'dark';

// v74 — Rôles :
//   dir()   = la direction (Préfet / Directeur ET Directeur des études) : pédagogie, élèves, classes…
//   fin()   = le chef d'établissement seul (Préfet ou Directeur) : argent, nominations, réglages
//   isCol() = percepteur, ou Directeur des études nommé percepteur (encaisse dans ses classes)
//   money() = peut voir des montants (soldes, frais)
const dir = () => S.me.role === 'directeur';
const fin = () => !!(S.me && S.me.role === 'directeur' && !S.me.etudes && !S.me.secretariat);
// v83 : Secrétariat = rôle directeur + marque secretariat (élèves, documents, présences ; pas l'argent ni la pédagogie)
const secr = () => !!(S.me && S.me.role === 'directeur' && S.me.secretariat);
// Le percepteur est un enseignant qui encaisse en plus, uniquement dans les classes qui lui sont confiées
const isCol = () => !!(S.me && (S.me.role === 'percepteur' || (S.me.role === 'directeur' && (S.me.etudes || S.me.secretariat) && S.me.collector)));
const canCollect = () => !!S.me && (fin() || isCol());
const money = () => !!S.me && (fin() || isCol());
const isTeach = () => !!(S.me && ['enseignant', 'percepteur'].includes(S.me.role));
const colOK = cid => fin() || (isCol() && !!(S.myCls && S.myCls.has(cid)));
// Rôle « financier » : le Directeur des études est vu comme un enseignant (ou un percepteur s'il encaisse)
const fRole = () => (S.me && S.me.role === 'directeur' && (S.me.etudes || S.me.secretariat)) ? (S.me.collector ? 'percepteur' : 'enseignant') : S.me.role;
// Titres affichés : Préfet (secondaire, complexe) · Directeur (primaire, maternelle) · Directeur des études
const schoolKind = () => (S.school && S.school.school_type) || 'secondaire';
const roleTitle = p => {
    if (!p) return '';
    if (p.role === 'directeur' && p.secretariat) return 'Secrétariat';
    if (p.role === 'directeur') return p.etudes ? 'Directeur des études' : (['primaire', 'maternelle'].includes(schoolKind()) ? 'Directeur' : 'Préfet');
    return { percepteur: 'Percepteur', enseignant: 'Enseignant', parent: 'Parent' }[p.role] || p.role || '';
};
const headTitle = () => roleTitle({ role: 'directeur' });
window.oreaRoleTitle = roleTitle; window.oreaHeadTitle = headTitle;
const SCHOOL_TYPES = [['secondaire', 'Secondaire'], ['primaire', 'Primaire'], ['maternelle', 'Maternelle'], ['complexe', 'Complexe scolaire']];
const SEXES = [['', '— à préciser —'], ['M', 'M · Masculin'], ['F', 'F · Féminin']];
const CLASS_LEVELS = [['maternelle', 'Maternelle'], ['primaire', 'Primaire'], ['secondaire', 'Secondaire']];
// Contact ORÉA Assistance (Réglages de tous les comptes)
const supportCard = () => `<div class="card col"><b>Vous avez besoin d’aide ?</b><span>ORÉA Assistance</span><small>+243 825 556 492 · kisengeh@gmail.com</small><div class=row><a class="btn ghost" style="text-align:center;text-decoration:none" href="tel:+243825556492">📞 Appeler</a><a class="btn ghost" style="text-align:center;text-decoration:none" href="https://wa.me/243825556492" target=_blank rel=noopener>💬 WhatsApp</a><a class="btn ghost" style="text-align:center;text-decoration:none" href="mailto:kisengeh@gmail.com">✉️ E-mail</a></div></div>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n, d = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
const fmt = n => nf(n / (S.school.rates[S.cur] || 1), S.cur === 'CDF' ? 0 : 2) + ' ' + SYM[S.cur];
const isNet = e => !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0 || /fetch|network|abort|load failed|timed? ?out/i.test(e.message || ''));
let toastTimer = 0;
const toast = m => {
    m = /failed to fetch|networkerror|network request|abort|load failed/i.test(m) ? 'Pas de connexion internet.' : m;
    const t = $('#toast');
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.hidden = true, 4000);
};

let dlgPushed = false, ignorePop = false;
const show = h => {
    const d = $('#dlg');
    d.innerHTML = h;
    if (!d.open) {
        d.showModal();
        if (!dlgPushed) {
            history.pushState({ dlg: 1 }, '');
            dlgPushed = true;
        }
    }
    return d;
};

$('#dlg').addEventListener('close', () => setTimeout(() => {
    const d = $('#dlg');
    if (!d.open && dlgPushed) {
        dlgPushed = false;
        ignorePop = true;
        history.back();
    }
}, 0));

window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    // v82 : un panneau plein écran est ouvert (messages, notifications, jeu, vérification) :
    // c'est lui qui gère le retour, la page dessous ne bouge pas
    if (document.querySelector('.om-ov, .nt-ov, .qz-ov, .fm-ov, .ic-ov')) return;
    const d = $('#dlg');
    if (d.open) {
        dlgPushed = false;
        d.close();
        return;
    }
    if (S.me && S.tab === 'presences' && S.attFromCls) { attLeave(); return; }
    if (S.me && (S.tab === 'cotation' || S.tab === 'bulletins')) { if (S.tab === 'cotation' && S.cotScreen === 'eval') S.cotScreen = 'home'; else S.tab = 'eleves'; render(); return; }
    if (S.me && S.tab === 'eleves' && S.view === 'class') { S.view = 'grid'; S.q = ''; render(); return; }
    if (S.me && S.tab === 'bilan' && fin()) { S.tab = 'finance_home'; render(); return; }
    if (S.me && !['accueil', 'menu'].includes(S.tab)) {
        if (['impayes', 'depenses', 'bilan', 'presences', 'caisse', 'absences', 'sanctions', 'calendrier', 'devoirs', 'cahier', 'emploi_temps', 'finance_home', 'programme_home', 'donnees_home', 'perception', 'stats', 'enafep'].includes(S.tab)) {
            S.tab = 'menu';
            render();
        } else {
            S.tab = 'accueil';
            render();
        }
    }
});

const sum = a => a.reduce((t, p) => t + Number(p.amount_cdf), 0);
const out = async () => {
    const n = S.me ? qget().length : 0;
    if (n && !confirm(n + ' élément(s) pas encore envoyé(s) seront perdus. Se déconnecter quand même ?')) return;
    if (S.me) localStorage.removeItem('orea_q_' + S.me.id);
    localStorage.removeItem('orea_snap');
    await db.auth.signOut();
    location.reload();
};

let defPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); defPrompt = e; });
window.addEventListener('appinstalled', () => { defPrompt = null; const b = $('#ibc'); if (b) b.remove(); });
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const installCard = () => isInstalled() ? '' : `<div class=card><span>Application</span><button id=ibc class=ghost style=width:auto onclick=installApp()>📲 Installer</button></div>`;

async function installApp() {
    if (defPrompt) {
        defPrompt.prompt();
        const { outcome } = await defPrompt.userChoice;
        if (outcome === 'accepted') defPrompt = null;
        return;
    }
    // v87 : guide adapté à l'appareil (Android, iPhone, ordinateur) — ui.js
    if (typeof oreaInstall === 'function') return oreaInstall();
    show('<h3>Installer ORÉA École</h3><p>Dans Chrome, touche le menu <b>⋮</b> en haut à droite, puis <b>Ajouter à l’écran d’accueil</b>.</p><form method=dialog><button>OK</button></form>');
}

// v88 : texte d'une option de liste toujours protégé (accepte aussi un texte déjà protégé avec esc)
const optEsc = v => esc(String(v ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[k])));
function ask(title, fields, ok) {
    const d = show(`<form method=dialog><h3>${title}</h3>${fields.map(f => `<label>${f.l}${f.o ? `<select name=${f.n}>${f.o.map(o => `<option value="${optEsc(o[0])}" ${o[0] === f.v ? 'selected' : ''}>${optEsc(o[1])}</option>`).join('')}</select>` : f.t === 'textarea' ? `<textarea name=${f.n} rows=4 style="width:100%" ${f.r === false ? '' : 'required'}>${esc(f.v)}</textarea>` : `<input name=${f.n} type=${f.t || 'text'} step=any value="${esc(f.v)}" ${f.r === false ? '' : 'required'}>`}</label>`).join('')}<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Valider</button></div></form>`);
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        const v = Object.fromEntries(new FormData(e.target));
        try { await ok(v); } catch (x) { toast(x.message || 'Erreur'); }
    };
}

/* ---------- Années scolaires ---------- */
const cy = c => c.year || 'Sans année';
const yrs = () => [...new Set(S.classes.map(cy))].sort((a, b) => a === 'Sans année' ? 1 : b === 'Sans année' ? -1 : b.localeCompare(a, 'fr'));

function pickYear() {
    const y = yrs(), k = 'orea_year_' + S.school.id;
    if (!S.year || !y.includes(S.year)) {
        const st = localStorage[k];
        S.year = y.includes(st) ? st : (y[0] || '');
    }
}

const clNum = n => { const m = String(n).match(/\d+/); return m ? +m[0] : null; };
const clLvl = n => { const t = String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return t.includes('matern') ? 0 : t.includes('primaire') ? 1 : t.includes('human') ? 2 : 3; };
const classSort = (a, b) => {
    const x = clNum(a.name), y = clNum(b.name);
    if (x !== null && y === null) return -1;
    if (x === null && y !== null) return 1;
    if (x !== null && x !== y) return x - y;
    return clLvl(a.name) - clLvl(b.name) || a.name.localeCompare(b.name, 'fr', { numeric: true });
};
const yc = () => { pickYear(); return S.classes.filter(c => cy(c) === S.year).sort(classSort); };
const ys = () => { const ids = new Set(yc().map(c => c.id)); return S.stu.filter(s => ids.has(s.class_id)); };

function setYear(v) {
    S.year = v;
    localStorage['orea_year_' + S.school.id] = v;
    S.cls = null;
    render();
}

const ybar = () => yrs().length > 1 ? `<div class=bar><select onchange="setYear(this.value)">${yrs().map(y => `<option value="${esc(y)}" ${y === S.year ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select></div>` : '';
const nrm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rno = p => p.receipt_no ? 'REC-' + String(p.receipt_no).padStart(4, '0') : 'REC-…';

function newYear() {
    const m = String(S.year).match(/(\d{4})\D+(\d{4})/), sg = m ? (+m[1] + 1) + '-' + (+m[2] + 1) : '';
    ask('Nouvelle année scolaire', [{ n: 'y', l: 'Année (ex : 2027-2028)', v: sg }, { n: 'cp', l: 'Classes de départ', o: [['1', 'Copier les classes et les frais de ' + esc(S.year)], ['0', 'Partir de zéro']], v: '1' }], async v => {
        const y = v.y.trim();
        if (!y) throw Error('Année obligatoire');
        if (yrs().includes(y)) throw Error('Cette année existe déjà');
        if (v.cp === '0') { setTimeout(() => addClass(y), 60); return; }
        const rows = yc().map(c => ({ school_id: S.school.id, name: c.name, year: y, level: c.level || null, fee_t1: c.fee_t1, fee_t2: c.fee_t2, fee_t3: c.fee_t3, fee_currency: c.fee_currency }));
        if (!rows.length) throw Error('Aucune classe à copier');
        const { data: nc, error } = await db.from('classes').insert(rows).select();
        if (error) throw error;

        const fo = S.fees.filter(f => cy(f) === S.year && !f.student_id);
        if (fo.length && nc) {
            const nm = Object.fromEntries(S.classes.map(c => [c.id, c.name]));
            const fr = fo.map(f => {
                const cn = f.class_id ? nc.find(c => c.name === nm[f.class_id]) : null;
                return f.class_id && !cn ? null : { school_id: S.school.id, year: y, name: f.name, amount: f.amount, currency: f.currency, class_id: cn ? cn.id : null };
            }).filter(Boolean);
            if (fr.length) {
                const { error: e2 } = await db.from('extra_fees').insert(fr);
                if (e2) toast(e2.message);
            }
        }
        S.year = y; S.cls = null; localStorage['orea_year_' + S.school.id] = y; await load(); render();
        toast('Année ' + y + ' créée. Utilise « Passage de classe ».');
    });
}

function promote() {
    const oth = yrs().filter(y => y !== S.year);
    if (!oth.length) return toast('Crée d’abord la nouvelle année (+ Nouvelle année).');
    const src = yc();
    if (!src.length) return toast('Aucune classe à faire passer.');
    let tg = oth[0];
    const guess = (n, tc) => { const m = n.match(/\d+/); if (!m) return ''; const g = n.replace(/\d+/, +m[0] + 1).toLowerCase(), c = tc.find(x => x.name.toLowerCase() === g); return c ? c.id : ''; };
    const d = show(`<form method=dialog><h3>Passage de classe</h3><small>De ${esc(S.year)} vers :</small><select id=py>${oth.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('')}</select><div id=pm></div><small>Les élèves gardent leur ancien dossier dans l’année précédente.</small><label><input type=checkbox name=pc checked style=width:auto> Reporter les impayés de ${esc(S.year)} (frais « Arriérés »)</label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Faire passer</button></div></form>`);
    const draw = () => {
        const tc = S.classes.filter(c => cy(c) === tg);
        d.querySelector('#pm').innerHTML = src.map(c => {
            const n = S.stu.filter(s => s.class_id === c.id).length, g = guess(c.name, tc);
            return `<label>${esc(c.name)} (${n} élève${n > 1 ? 's' : ''}) →<select name="m_${c.id}"><option value="">— Ne pas passer —</option>${tc.map(t => `<option value="${t.id}" ${t.id === g ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`;
        }).join('');
    };
    draw();
    d.querySelector('#py').onchange = e => { tg = e.target.value; draw(); };
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        e.preventDefault();
        const f = e.target, rows = [], bal = {}, carry = f.elements.pc.checked;
        for (const c of src) {
            const dest = f.elements['m_' + c.id].value;
            if (!dest) continue;
            const have = new Set(S.stu.filter(s => s.class_id === dest).map(s => s.name.toLowerCase()));
            S.stu.filter(s => s.class_id === c.id).forEach(s => {
                if (!have.has(s.name.toLowerCase())) {
                    rows.push({ school_id: S.school.id, class_id: dest, name: s.name, parent_phone: s.parent_phone });
                    if (carry && s.balance_cdf > 0) bal[dest + '|' + s.name.toLowerCase()] = Math.round(s.balance_cdf);
                }
            });
        }
        if (!rows.length) return toast('Aucun élève à faire passer');
        const nb = Object.keys(bal).length;
        if (!confirm(rows.length + ' élève(s) seront inscrits en ' + tg + (nb ? ' ; ' + nb + ' impayé(s) reportés' : '') + '. Continuer ?')) return;
        e.submitter.disabled = true;
        const ns = [];
        for (let i = 0; i < rows.length; i += 300) {
            const { data, error } = await db.from('students').insert(rows.slice(i, i + 300)).select('id,class_id,name');
            if (error) { e.submitter.disabled = false; return toast(error.message); }
            ns.push(...data);
        }
        let rep = 0;
        if (nb) {
            const fr = ns.filter(n => bal[n.class_id + '|' + n.name.toLowerCase()]).map(n => ({ school_id: S.school.id, year: tg, name: 'Arriérés ' + S.year, amount: bal[n.class_id + '|' + n.name.toLowerCase()], currency: 'CDF', class_id: n.class_id, student_id: n.id }));
            for (let i = 0; i < fr.length; i += 300) {
                const { error } = await db.from('extra_fees').insert(fr.slice(i, i + 300));
                if (error) { toast('Élèves inscrits, mais report impossible : ' + error.message); break; }
                rep += Math.min(300, fr.length - i);
            }
        }
        d.close(); S.year = tg; localStorage['orea_year_' + S.school.id] = tg; S.cls = null; await load(); render();
        toast(rows.length + ' élève(s) inscrit(s) en ' + tg + (rep ? ' · ' + rep + ' impayé(s) reporté(s)' : ''));
    };
}

// --- FIN DE LA TRANCHE 1. La tranche suivante commencera par : /* ---------- Hors connexion ---------- */ ---
/* ---------- Hors connexion ---------- */
function saveSnap() { try { localStorage.orea_snap = JSON.stringify({ uid: S.me.id, me: S.me, school: S.school, classes: S.classes, stu: S.stu, fees: S.fees, fpaid: S.fpaid, terms: S.terms, at: Date.now() }); } catch { } }
function readSnap() { try { return JSON.parse(localStorage.orea_snap || 'null'); } catch { return null; } }
function goOffline(sn) { S.me = sn.me; S.school = sn.school; S.classes = sn.classes; S.stu = sn.stu; S.fees = sn.fees || []; S.fpaid = sn.fpaid || {}; S.terms = sn.terms || {}; S.offline = true; $('#hs').textContent = sn.school.name; if (subPhase() === 'bloquee') return lockView(); S.ro = subPhase() === 'lecture'; render(); toast('Mode hors connexion : tu peux encaisser et faire l’appel.'); }
function netView() { $('#nav').hidden = true; $('#main').innerHTML = '<div class=auth><h2>Pas de connexion</h2><p>Connecte-toi à internet une première fois pour charger tes données.</p><button onclick=boot()>Réessayer</button></div>'; }
const qkey = () => 'orea_q_' + (S.me && S.me.id);
function qget() { if (!S.me) return []; try { return JSON.parse(localStorage[qkey()] || '[]'); } catch { return []; } }
function qset(a) { localStorage[qkey()] = JSON.stringify(a); qui(); }
function qadd(it) { let a = qget(); if (it.k === 'att') a = a.filter(x => !(x.k === 'att' && x.student_id === it.student_id && x.day === it.day)); a.push({ ...it, qid: crypto.randomUUID(), at: it.at || new Date().toISOString() }); qset(a); }
function qui() {
    let b = $('#qb');
    const a = qget(), bad = a.filter(x => x.err).length, off = S.offline || !navigator.onLine;
    if (!S.me || (!a.length && !off)) { if (b) b.hidden = true; return; }
    if (!b) { b = document.createElement('div'); b.id = 'qb'; b.onclick = qview; $('header').after(b); }
    b.hidden = false; b.className = off ? 'off' : '';
    b.textContent = [off ? '📴 Hors connexion' : '', a.length ? '⏳ ' + a.length + ' en attente d’envoi' : '', bad ? '⚠ ' + bad + ' à vérifier' : ''].filter(Boolean).join(' · ');
}
function applyLocal(sid, term, cdf) {
    const s = S.stu.find(x => x.id === sid); if (!s) return;
    const rem = trims(s)[term - 1][1];
    s['p' + term + '_cdf'] = Number(s['p' + term + '_cdf'] || 0) + cdf;
    s.paid_cdf = Number(s.paid_cdf || 0) + cdf;
    s.balance_cdf = Math.max(0, Number(s.balance_cdf) - Math.min(cdf, rem));
    s.last_pay = new Date().toISOString();
}
const cdfOf = x => x.amount * (S.school.rates[x.currency] || 1);
function overlayQ() { qget().forEach(x => { if (x.k === 'pay') applyLocal(x.student_id, x.term, cdfOf(x)); else if (x.k === 'fpay') applyLocalFee(x); }); }
function qToday() { const t0 = new Date(); t0.setHours(0, 0, 0, 0); return qget().filter(x => (x.k === 'pay' || x.k === 'fpay') && new Date(x.at) >= t0).reduce((t, x) => t + cdfOf(x), 0); }
function payOffline(row) {
    const at = new Date().toISOString(), isF = !!row.fee_id;
    qadd({ k: isF ? 'fpay' : 'pay', ...row, at });
    if (isF) applyLocalFee(row); else applyLocal(row.student_id, row.term, cdfOf(row));
    saveSnap(); render();
    toast('Enregistré hors connexion. Envoi automatique dès que le réseau revient.');
    receipt({ ...row, created_at: at, collector_id: S.me.id, receipt_no: null }, row.student_id);
}
async function qsend(it) {
    if (it.k === 'att') { const { k, qid, at, err, ...row } = it; return db.from('attendance').upsert(row, { onConflict: 'student_id,day' }); }
    const { k, qid, at, err, ...row } = it;
    const tb = k === 'fpay' ? 'fee_payments' : 'payments';
    let r = await db.from(tb).insert({ ...row, created_at: at });
    if (r.error && r.error.code === '42501') r = await db.from(tb).insert(row);
    if (r.error && r.error.code === '23505') { if (/pkey/.test(r.error.message || '')) return {}; return { error: { message: 'Référence Mobile Money déjà utilisée' } }; }
    return r;
}
let syncing = false;
async function qsync() {
    if (syncing || !S.me || S.offline || !navigator.onLine) return;
    const todo = qget().filter(x => !x.err); if (!todo.length) return;
    syncing = true; let done = 0;
    try {
        for (const it of todo) {
            let r; try { r = await qsend(it); } catch (e) { r = { error: e }; }
            if (r.error && isNet(r.error)) break;
            const cur = qget();
            if (!r.error) { qset(cur.filter(x => x.qid !== it.qid)); done++; }
            else qset(cur.map(x => x.qid === it.qid ? { ...x, err: r.error.message || 'Refusé' } : x));
        }
    } finally { syncing = false; }
    if (done) { await load(); if (!$('#dlg').open) render(); toast(done + ' élément(s) envoyé(s) ✓'); }
}
function qview() {
    const a = qget(), sn = id => (S.stu.find(x => x.id === id) || {}).name || '?';
    const d = show(`<h3>En attente d’envoi</h3>${a.length ? a.map(x => `<div class="card col"><b>${x.k === 'pay' ? 'Paiement · ' + esc(sn(x.student_id)) + ' · ' + nf(x.amount) + ' ' + x.currency + ' (T' + x.term + ')' : x.k === 'fpay' ? 'Frais · ' + esc(sn(x.student_id)) + ' · ' + esc(x.fee_name || '') + ' · ' + nf(x.amount) + ' ' + x.currency : 'Présence · ' + esc(sn(x.student_id)) + ' · ' + x.status}</b><small>${new Date(x.at).toLocaleString('fr-FR')}</small>${x.err ? `<span class=due>⚠ ${esc(x.err)}</span><div class=row><button class=ghost data-r="${x.qid}">Réessayer</button><button class=ghost data-d="${x.qid}">Supprimer</button></div>` : ''}</div>`).join('') : '<p class=empty>Rien en attente.</p>'}<div class=col><button id=qs>Envoyer maintenant</button><button class=ghost id=qc>Fermer</button></div>`);
    d.querySelector('#qc').onclick = () => d.close();
    d.querySelector('#qs').onclick = async () => { d.close(); await qsync(); };
    d.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { qset(qget().map(x => x.qid === b.dataset.r ? { ...x, err: undefined } : x)); d.close(); qsync(); });
    d.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer cet élément ? Il ne sera jamais envoyé.')) return; qset(qget().filter(x => x.qid !== b.dataset.d)); d.close(); await load(); render(); });
}

/* ---------- Démarrage ---------- */
async function boot() {
    $('#dlg').close?.();
    const snap = readSnap();
    let session = null;
    try {
        const r = await db.auth.getSession(); session = r.data.session;
        if (!session && snap && (isNet(r.error) || !navigator.onLine)) return goOffline(snap);
    } catch (e) { if (snap) return goOffline(snap); }
    if (!session) return authView();
    // v91 : avec la base locale (offline.js), l'application démarre normalement même en mode avion ;
    // l'ancien mode réduit (caisse + appel) ne sert plus que si les données ne sont pas encore sur le téléphone.
    if (!navigator.onLine && snap && snap.uid === session.user.id && !window.oreaOffline) return goOffline(snap);
    const { data: adm, error: ea } = await db.rpc('is_platform_admin');
    if (isNet(ea)) return snap && snap.uid === session.user.id ? goOffline(snap) : netView();
    // v90 : mode Test (ORÉA « voit comme » un rôle dans une école TEST)
    const tst = adm === true && window.oreaTest ? oreaTest.read() : null;
    if (adm === true && !tst) { $('#hs').textContent = 'ORÉA'; return adminView(); }
    if (tst && tst.role === 'parent') { location.replace('parent.html'); return; }
    if (tst && tst.role === 'ambassadeur') return typeof ambEntry === 'function' ? ambEntry() : adminView();
    if (tst && tst.role === 'inspecteur') return typeof oreaInspView === 'function' ? oreaInspView() : adminView();
    const { data: p, error: ep } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (isNet(ep)) return snap && snap.uid === session.user.id ? goOffline(snap) : netView();
    if (!p) return setupView();
    // v87 : un compte parent ouvert sur la page de l'école (application installée depuis l'espace parent) → espace parent
    if (p.role === 'parent') { location.replace('parent.html'); return; }
    if (tst && p.active === false) { localStorage.removeItem('orea_test'); $('#hs').textContent = 'ORÉA'; return adminView(); }
    if (p.active === false) { $('#nav').hidden = true; $('#main').innerHTML = '<div class=auth><h2>Compte désactivé</h2><p>Contacte la direction de ton école.</p><button class=ghost onclick=out()>Déconnexion</button></div>'; return; }
    S.me = p;
    // v87 : « dernière connexion » enregistrée par la base (l'ancienne écriture directe était refusée)
    db.rpc('v87_touch_seen').then(() => { }, () => { });
    const { data: s, error: es } = await db.from('schools').select('*').eq('id', p.school_id).single();
    if (!s) {
        if (isNet(es) && snap && snap.uid === p.id) return goOffline(snap);
        if (isNet(es) || !es) return netView();
        $('#nav').hidden = true;
        $('#main').innerHTML = '<div class=auth><h2>École introuvable</h2><p>' + esc(es.message || 'Impossible de charger ton école.') + '</p><button onclick=boot()>Réessayer</button><button class=ghost onclick=out()>Déconnexion</button></div>';
        return;
    }
    S.school = s; $('#hs').textContent = s.name;
    // v88 : seul un blocage par ORÉA ferme l'application ; après 7 jours d'expiration → lecture seule
    const ph = subPhase(s);
    if (ph === 'bloquee') return lockView();
    S.ro = ph === 'lecture';
    await autoRate(); await qsync(); await load(); render();
    shortcutTab();
}
// v87 : raccourcis de l'icône de l'application (appui long) : ./?t=caisse ou ./?t=presences
function shortcutTab() {
    const t = new URLSearchParams(location.search).get('t');
    if (!t || !['caisse', 'presences'].includes(t)) return;
    try { history.replaceState(history.state, '', location.pathname); } catch (_) { }
    if (t === 'caisse' && !money()) return;
    menuGo(t);
}

/* ---------- Autres frais, trimestres, stats ---------- */
const rateOf = cur => S.school.rates[cur] || 1;
const fees4 = s => { const c = S.classes.find(x => x.id === s.class_id); if (!c) return []; return S.fees.filter(f => cy(f) === cy(c) && (!f.class_id || f.class_id === c.id) && (!f.student_id || f.student_id === s.id)); };
const feeRem = (s, f) => Math.max(0, Number(f.amount) - (S.fpaid[s.id + ':' + f.id] || 0));
const feeRemCdf = (s, f) => feeRem(s, f) * rateOf(f.currency);
async function pageAll(mk) { let all = [], i = 0; for (; ;) { const { data, error } = await mk().order('id').range(i, i + 999); if (error) return { error }; all = all.concat(data); if (data.length < 1000) break; i += 1000; } return { data: all }; }
function augment() {
    S.stu.forEach(s => {
        const fs = fees4(s); let due = 0, exp = 0;
        fs.forEach(f => { exp += Number(f.amount) * rateOf(f.currency); due += feeRemCdf(s, f); });
        s.fee_due_cdf = due; s.fee_exp_cdf = exp;
        s.balance_cdf = Number(s.balance_cdf || 0) + due;
        s.paid_cdf = Number(s.paid_cdf || 0) + (exp - due);
    });
}
function applyLocalFee(x) {
    const s = S.stu.find(i => i.id === x.student_id), f = S.fees.find(i => i.id === x.fee_id); if (!s || !f) return;
    const before = feeRemCdf(s, f), k = s.id + ':' + f.id;
    S.fpaid[k] = (S.fpaid[k] || 0) + x.amount * rateOf(x.currency) / rateOf(f.currency);
    const d = before - feeRemCdf(s, f);
    s.balance_cdf = Math.max(0, s.balance_cdf - d); s.fee_due_cdf -= d; s.paid_cdf += d;
}
const hasTerms = () => { const t = S.terms[S.year]; return !!(t && (t.t1 || t.t2 || t.t3)); };
function curTerm(year) { const t = S.terms[year]; if (!t || !(t.t1 || t.t2 || t.t3)) return null; const now = tdy(); let k = 0; [t.t1, t.t2, t.t3].forEach((d, i) => { if (d && d <= now) k = i + 1; }); return k; }
const getTermToShow = () => S.curTermFilter || (typeof curTerm === 'function' ? curTerm(S.year) : 1) || 1;
const termOn = () => !!(S.curTermFilter || hasTerms());
const tRem = s => { const t = trims(s)[getTermToShow() - 1]; return t ? t[1] : 0; };
function setTermFilter(v) { S.curTermFilter = v; render(); }
const termBar = () => `<div class=chips>${[[null, 'Auto'], [1, 'T1'], [2, 'T2'], [3, 'T3']].map(x => `<button class="chip ${S.curTermFilter === x[0] ? 'on' : ''}" onclick="setTermFilter(${x[0]})">${x[1]}${x[0] === null ? ' (T' + getTermToShow() + ')' : ''}</button>`).join('')}</div>`;
function status(s) {
    if (s.balance_cdf <= 0) return 'paid';
    const c = S.classes.find(x => x.id === s.class_id), k = c ? curTerm(cy(c)) : null;
    if (k === null) return 'due';
    return trims(s).slice(0, k).some(t => t[1] > 0) ? 'late' : 'ok';
}
function stTag(s, scoped) {
    if (scoped && termOn()) {
        const k = getTermToShow(), t = trims(s)[k - 1], c = S.classes.find(x => x.id === s.class_id), real = c ? curTerm(cy(c)) : null;
        if (!t || t[2] <= 0) return `<span class=ok>— T${k}</span>`;
        if (t[1] <= 0) return `<span class=ok>✓ Soldé T${k}</span>`;
        if (real !== null && k <= real) return `<span class=due>🔴 En retard T${k}<br><small>Doit ${fmt(t[1])}</small></span>`;
        return `<span class=due>À payer T${k}<br><small>Doit ${fmt(t[1])}</small></span>`;
    }
    const st = status(s);
    if (st === 'paid') return '<span class=ok>✓ Soldé</span>';
    if (st === 'ok') return `<span class=ok>✅ À jour<br><small>reste ${fmt(s.balance_cdf)}</small></span>`;
    if (st === 'late') return `<span class=due>🔴 En retard<br><small>Doit ${fmt(s.balance_cdf)}</small></span>`;
    return `<span class=due>Doit ${fmt(s.balance_cdf)}</span>`;
}

/* ---------- Carte « retard » (refonte SVG) ---------- */
function lateCard() {
    if (!hasTerms()) return '';
    const n = ys().filter(s => status(s) === 'late').length;
    return `<div class=menu-card onclick="menuGo('impayes')"><div class=menu-ic>${svgI('alerte')}</div><div class=menu-label>Élèves en retard<small>${n > 0 ? 'Action requise' : 'Aucun retard'}</small></div><b class="${n ? 'due' : 'ok'}" style="font-family:var(--serif);font-size:18px">${n}</b><span class=menu-arrow>›</span></div>`;
}

// --- FIN DE LA TRANCHE 2. La tranche suivante commencera par : const short = cdf => { ---
const short = cdf => { const v = cdf / rateOf(S.cur); return v >= 1e6 ? nf(v / 1e6, 1) + ' M' : v >= 1e3 ? nf(Math.round(v / 1e3), 0) + ' k' : nf(v, 0); };
function classBars() {
    const r = yc().map(c => {
        const l = S.stu.filter(s => s.class_id === c.id), exp = l.reduce((t, s) => t + Number(s.due1_cdf || 0) + Number(s.due2_cdf || 0) + Number(s.due3_cdf || 0) + Number(s.fee_exp_cdf || 0), 0), due = l.reduce((t, s) => t + Number(s.balance_cdf || 0), 0);
        return { n: c.name, p: exp > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - due / exp)))) : null };
    }).filter(x => x.p !== null);
    if (!r.length) return '';
    return `<div class="card col"><b>Recouvrement par classe</b>${r.map(x => `<div><div class=row style="justify-content:space-between;margin:2px 0"><small>${esc(x.n)}</small><small><b>${x.p} %</b></small></div><div class=pbar><i style="width:${x.p}%;background:var(${x.p >= 80 ? '--ok' : x.p >= 50 ? '--gold' : '--bad'})"></i></div></div>`).join('')}</div>`;
}
async function monthChart() {
    const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const q = n => pageAll(() => db.from(n).select('created_at,amount_cdf').gte('created_at', m0.toISOString()));
    const [a, b] = await Promise.all([q('payments'), q('fee_payments')]);
    if (a.error) return;
    const rows = a.data.concat(b.error ? [] : b.data), ms = [];
    for (let i = 0; i < 6; i++) { const d = new Date(m0.getFullYear(), m0.getMonth() + i, 1); ms.push({ k: d.getFullYear() * 12 + d.getMonth(), l: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), v: 0 }); }
    rows.forEach(r => { const d = new Date(r.created_at), m = ms.find(x => x.k === d.getFullYear() * 12 + d.getMonth()); if (m) m.v += Number(r.amount_cdf); });
    const el = $('#ch'); if (!el || S.tab !== 'accueil') return;
    const mx = Math.max(...ms.map(x => x.v), 1);
    el.innerHTML = `<div class="card col"><b>Encaissements par mois</b><div class=bars>${ms.map(x => `<div class=bcol><small>${x.v ? short(x.v) : ''}</small><div class=bbar style="height:${Math.max(3, Math.round(x.v / mx * 90))}px"></div><small>${x.l}</small></div>`).join('')}</div></div>`;
}
async function todayPay(t0) { const q = n => db.from(n).select('amount_cdf,collector_id').gte('created_at', t0.toISOString()); const [a, b] = await Promise.all([q('payments'), q('fee_payments')]); return { data: a.data ? [...a.data, ...(b.data || [])] : null }; }
async function todayFull(t0) { const q = n => db.from(n).select('*').gte('created_at', t0.toISOString()); const [a, b] = await Promise.all([q('payments'), q('fee_payments')]); return { data: a.data ? [...a.data, ...(b.data || [])] : null, error: a.error }; }

function goTab(t) {
    S.attFromCls = false;
    if (t === S.tab) { if (t === 'eleves' && S.view === 'class') backGrid(); return; }
    if (t === 'eleves') { S.view = 'grid'; S.q = ''; }
    if (t === 'accueil' && history.state && history.state.t) { history.back(); return; }
    if (S.tab === 'accueil' && t !== 'accueil' && !(history.state && history.state.t)) history.pushState({ t: 1 }, '');
    S.tab = t; render();
}
function menuGo(t) {
    if (t !== 'presences') S.attFromCls = false;
    if (S.tab === 'accueil' && !(history.state && history.state.t)) history.pushState({ t: 1 }, '');
    S.tab = t; render();
}
const SK = '<div class=sk></div>'.repeat(4);
const ICON = {
    accueil: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    eleves: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
    presences: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 16l2 2 4-4"/>',
    caisse: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
    reglages: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    impayes: '<path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
    depenses: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>',
    bilan: '<rect x="3" y="10" width="4" height="10" rx="1"/><rect x="10" y="6" width="4" height="14" rx="1"/><rect x="17" y="13" width="4" height="7" rx="1"/>',
    absences: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-4 4"/><path d="M22 15l-4-4"/>',
    sanctions: '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-2 6h4l-2-6z"/><path d="M19 7l-2 6h4l-2-6z"/><path d="M9 21h6"/>',
    calendrier: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    devoirs: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6M9 11h6"/>',
    emploi_temps: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    equipe: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    journal: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    exports: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    sauvegarde: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    rapport: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/>',
    messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    justificatifs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>',
    annonces: '<path d="M3 11l19-9-9 19-2-8-8-2z"/>',
    annees: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    alerte: '<path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
    graph: '<path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 5-5"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    arrow: '<polyline points="9 6 15 12 9 18"/>'
};
const svgI = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;

function addFee() {
    if (!yc().length) return toast('Crée d’abord une classe.');
    ask('Nouveau frais · ' + S.year, [{ n: 'name', l: 'Nom (ex : Inscription, Uniforme)' }, { n: 'amount', l: 'Montant', t: 'number' }, { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur }, { n: 'cls', l: 'Classe concernée', o: [['', 'Toutes les classes'], ...yc().map(c => [c.id, esc(c.name)])] }], async v => {
        const { error } = await db.from('extra_fees').insert({ school_id: S.school.id, year: S.year, name: v.name.trim(), amount: +v.amount, currency: v.cur, class_id: v.cls || null });
        if (error) throw error; await load(); render(); toast('Frais ajouté');
    });
}
function editFee(id) {
    const f = S.fees.find(x => x.id === id), cn = f.class_id ? (S.classes.find(c => c.id === f.class_id) || {}).name : 'Toutes les classes';
    const d = show(`<h3>${esc(f.name)}</h3><p>${nf(f.amount)} ${f.currency} · ${esc(cn || '')}</p><div class=col><button id=e1>Modifier</button><button class=ghost id=e2>Supprimer</button><button class=ghost id=e3>Fermer</button></div>`);
    d.querySelector('#e3').onclick = () => d.close();
    d.querySelector('#e1').onclick = () => ask('Modifier le frais', [{ n: 'name', l: 'Nom', v: f.name }, { n: 'amount', l: 'Montant (' + f.currency + ')', t: 'number', v: f.amount }], async v => {
        const { data, error } = await db.from('extra_fees').update({ name: v.name.trim(), amount: +v.amount }).eq('id', id).select();
        if (error) throw error; if (!data.length) throw Error('Modification refusée'); await load(); render(); toast('Frais modifié');
    });
    d.querySelector('#e2').onclick = async () => {
        if (!confirm('Supprimer ce frais ?')) return;
        const { data, error } = await db.from('extra_fees').delete().eq('id', id).select(); d.close();
        if (error) return toast(error.code === '23503' ? 'Impossible : des paiements existent.' : error.message);
        if (!data.length) return toast('Suppression refusée'); await load(); render(); toast('Frais supprimé');
    };
}
function setTerms() {
    const t = S.terms[S.year] || {};
    ask('Trimestres · ' + S.year, [{ n: 't1', l: 'Début T1', t: 'date', v: t.t1 || '', r: false }, { n: 't2', l: 'Début T2', t: 'date', v: t.t2 || '', r: false }, { n: 't3', l: 'Début T3', t: 'date', v: t.t3 || '', r: false }], async v => {
        const a = [v.t1, v.t2, v.t3].filter(Boolean);
        if (a.some((d, i) => i && d < a[i - 1])) throw Error('Les dates doivent se suivre dans l’ordre');
        const { data, error } = await db.from('terms').upsert({ school_id: S.school.id, year: S.year, t1: v.t1 || null, t2: v.t2 || null, t3: v.t3 || null }, { onConflict: 'school_id,year' }).select();
        if (error) throw error; if (!data.length) throw Error('Modification refusée'); await load(); render(); toast('Dates enregistrées');
    });
}
const fdate = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '—';

async function load() {
    const [a, b, c, t, e] = await Promise.all([db.from('classes').select('*').order('name'), pageAll(() => db.from('student_balance').select('*')), db.from('extra_fees').select('*').order('name'), db.from('terms').select('*'), db.from('events').select('*').gte('start_date', tdy()).order('start_date').limit(5)]);
    if (a.error || b.error) return toast((a.error || b.error).message);
    const fees = c.error ? [] : c.data, fpaid = {}, terms = {};
    (t.error ? [] : t.data).forEach(r => terms[r.year] = { t1: r.t1, t2: r.t2, t3: r.t3 });
    if (fees.length) {
        const r = await pageAll(() => db.from('fee_payments').select('student_id,fee_id,fee_paid'));
        if (r.error) return toast(r.error.message);
        r.data.forEach(x => { const k = x.student_id + ':' + x.fee_id; fpaid[k] = (fpaid[k] || 0) + Number(x.fee_paid); });
    }
    S.classes = a.data; S.stu = b.data; S.fees = fees; S.fpaid = fpaid; S.terms = terms; S.events = e.error ? [] : e.data;
    if (isCol()) { const r = await db.from('collector_classes').select('class_id').eq('collector_id', S.me.id); S.myCls = new Set((r.data || []).map(x => x.class_id)); }
    augment(); S.offline = !!(window.oreaOffline && oreaOffline.isOff()); overlayQ(); saveSnap();
}
async function autoRate() {
    const s = S.school;
    if (!fin() || !s.auto_rates || Date.now() - new Date(s.rates_at) < 432e5) return;
    try {
        const r = (await (await fetch('https://open.er-api.com/v6/latest/USD')).json()).rates;
        const rates = { CDF: 1, USD: Math.round(r.CDF * 100) / 100, EUR: Math.round(r.CDF / r.EUR * 100) / 100 };
        const { data } = await db.from('schools').update({ rates, rates_at: new Date().toISOString() }).eq('id', s.id).select().single();
        if (data) S.school = data;
    } catch { }
}

/* ---------- Connexion ---------- */
function authView() {
    $('#nav').hidden = true;
    $('#main').innerHTML = `<div class=auth><img class=ld src=logo-dark.png alt="ORÉA École"><img class=ll src=logo-light.png alt=""><form id=af class=col><input name=email type=email placeholder="E-mail" required><input name=pw type=password placeholder="Mot de passe (8 caractères min.)" minlength=8 required><button>Se connecter</button><button type=button class=ghost id=su>Créer un compte</button></form></div>`;
    $('#af').onsubmit = async e => { e.preventDefault(); const f = e.target; const { error } = await db.auth.signInWithPassword({ email: f.email.value, password: f.pw.value }); error ? toast(error.message) : boot(); };
    $('#su').onclick = async () => { const f = $('#af'); if (!f.reportValidity()) return; const { data, error } = await db.auth.signUp({ email: f.email.value, password: f.pw.value }); if (error) return toast(error.message); data.session ? boot() : toast('Compte créé. Confirme ton e-mail, puis connecte-toi.'); };
}
function setupView() {
    $('#nav').hidden = true;
    $('#main').innerHTML = `<div class=auth><h2>Bienvenue</h2><button id=c1>Je crée mon école (chef d’établissement)</button><button class=ghost id=c2>Je rejoins une école avec un code</button><button class=ghost id=lo>Déconnexion</button></div>`;
    $('#lo').onclick = out;
    $('#c1').onclick = () => ask('Nouvelle école', [{ n: 'school', l: 'Nom de l’école' }, { n: 'type', l: 'Type d’école', o: SCHOOL_TYPES, v: 'secondaire' }, { n: 'me', l: 'Ton nom' }], async v => { const { error } = await db.rpc('create_school', { school_name: v.school, my_name: v.me, p_type: v.type }); if (error) throw error; boot(); });
    $('#c2').onclick = () => ask('Rejoindre', [{ n: 'code', l: 'Code d’invitation' }, { n: 'me', l: 'Ton nom' }], async v => { const { error } = await db.rpc('join_school', { invite: v.code.trim(), my_name: v.me }); if (error) throw error; boot(); });
}

/* ---------- Écrans ---------- */
function render() {
    $('#nav').hidden = false; subBanner();
    const R = S.me.role, tabs = [['accueil', 'Accueil'], ['eleves', 'École'], ['menu', 'Menu'], ['reglages', 'Réglages']];
    const SUB = ['impayes', 'depenses', 'bilan', 'presences', 'caisse', 'absences', 'sanctions', 'calendrier', 'devoirs', 'cahier', 'emploi_temps', 'cotation', 'bulletins', 'finance_home', 'programme_home', 'donnees_home', 'perception', 'stats', 'enafep'];
    if (!tabs.some(x => x[0] === S.tab) && !SUB.includes(S.tab)) S.tab = 'accueil';
    let activeTab = ['cotation', 'bulletins'].includes(S.tab) ? 'eleves' : SUB.includes(S.tab) ? 'menu' : S.tab;
    $('#nav').innerHTML = tabs.map(x => `<button data-t=${x[0]}>${svgI(x[0])}<span>${x[1]}</span></button>`).join('');
    document.querySelectorAll('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.t === activeTab); b.onclick = () => goTab(b.dataset.t); });

    const hs = $('#hs');
    if (hs && !$('#searchBtn')) {
        hs.insertAdjacentHTML('afterend', `<button id="searchBtn" class="ghost" style="width:auto;min-height:40px;padding:8px;margin-left:auto;border:none" onclick="openSearch()">🔍</button>`);
    }

    if (!fin() && ['depenses', 'bilan', 'finance_home', 'donnees_home'].includes(S.tab)) S.tab = 'menu';
    if (!money() && ['caisse', 'impayes', 'perception'].includes(S.tab)) S.tab = 'menu';
    ({ accueil: vAccueil, eleves: vEleves, menu: vMenu, reglages: vReglages, impayes: vImpayes, depenses: vDepenses, bilan: vBilan, presences: vPresences, caisse: vCaisse, absences: vAbsences, sanctions: vSanctions, calendrier: vCalendrier, devoirs: vDevoirs, cahier: () => window.vCahier ? vCahier() : vDevoirs(), emploi_temps: vEmploiTemps, finance_home: vFinanceHome, programme_home: vProgrammeHome, donnees_home: vDonneesHome, cotation: () => vCotation(), bulletins: () => vBulletins(), perception: vPerception, stats: () => window.vStats ? vStats() : vMenu(), enafep: () => window.vEnafep ? vEnafep() : vMenu() })[S.tab]();
    qui();
}
const sorts = {
    alpha: (a, b) => a.name.localeCompare(b.name, 'fr'),
    solde: (a, b) => b.balance_cdf - a.balance_cdf,
    retard: (a, b) => { const k = s => s.balance_cdf > 0 ? (s.last_pay ? +new Date(s.last_pay) : 0) : 9e15; return k(a) - k(b); },
    moyenne: (a, b) => { const v = s => S.avg && S.avg[s.id] != null ? S.avg[s.id] : -1; return v(b) - v(a) || a.name.localeCompare(b.name, 'fr'); }
};
const avgPill = s => { const v = S.avg && S.avg[s.id]; return v == null ? '' : `<span class="avgp ${v < 50 ? 'bad' : ''}">${nf(v, 1)} %</span>`; };

// --- FIN DE LA TRANCHE 3. La tranche suivante commencera par : /* ---------- Onglet École : grille de classes ---------- */ ---
/* ---------- Onglet École : grille de classes ---------- */
document.head.insertAdjacentHTML('beforeend', '<style>'
    + '.cgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}'
    + '.ccard{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 6px 12px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;-webkit-tap-highlight-color:transparent}'
    + '.ccard:active{transform:scale(.97);border-color:var(--gold)}'
    + '.ccard b{font-family:var(--serif);font-size:16px;color:var(--tx);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.ccard small{font-size:11.5px}'
    + '.ccard .cd{font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums}'
    + '.csum{justify-content:space-between;flex-wrap:wrap;gap:4px 12px;font-size:13.5px}'
    + '.ctitle{font-family:var(--serif);font-size:18px;color:var(--gold);align-self:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}'
    + '</style>');

function openClass(id) {
    const c = S.classes.find(x => x.id === id); if (!c) return;
    if (cy(c) !== S.year) { S.year = cy(c); localStorage['orea_year_' + S.school.id] = S.year; }
    S.cls = id; S.view = 'class'; S.q = ''; S.ft = 'all'; S.sort = 'alpha'; S.tab = 'eleves';
    if (!(history.state && history.state.cls)) history.pushState({ cls: 1 }, '');
    render();
}
function backGrid() {
    if (history.state && history.state.cls) { history.back(); return; }
    S.view = 'grid'; S.q = ''; render();
}
function vEleves() {
    const cl = yc();
    if (S.view === 'class' && !cl.some(c => c.id === S.cls)) S.view = 'grid';
    let h = ybar();
    if (!cl.length) h += '<p class=empty data-ic="🏫">Aucune classe pour le moment.</p>';
    else if (S.view === 'class') {
        const c = cl.find(x => x.id === S.cls);
        if (S.ft === 'late' && !hasTerms()) S.ft = 'all';
        if (!money() && !['all', 'nophone'].includes(S.ft)) S.ft = 'all';
        if (!money() && ['solde', 'retard'].includes(S.sort)) S.sort = 'alpha';
        const FT = money() ? [['all', 'Tous'], ...(hasTerms() ? [['late', 'En retard']] : []), ['due', 'À payer'], ['paid', 'Soldés'], ['nophone', 'Sans n°']] : [['all', 'Tous'], ['nophone', 'Sans n°']];
        h += `<div class=bar><button class=ghost style="width:auto" onclick=backGrid()>← Classes</button><b class=ctitle>${esc(c.name)}</b>${money() ? '<button class=ghost style="width:auto;margin-left:auto" onclick=printClass()>🖨 Imprimer</button>' : ''}</div>`
            + `<input id=q type=search placeholder="🔍 Rechercher dans ${esc(c.name)}" value="${esc(S.q)}">`
            + termBar()
            + classBtns()
            + `<div class=bar><select id=so><option value=alpha>Alphabétique A → Z</option>${money() ? '<option value=solde>Plus grand solde dû</option><option value=retard>Retard de paiement</option>' : ''}<option value=moyenne>Tri par moyenne</option></select></div>`
            + `<div class=chips>${FT.map(f => `<button class="chip ${S.ft === f[0] ? 'on' : ''}" data-f=${f[0]}>${f[1]}</button>`).join('')}</div><div id=lst></div>`;
    } else {
        if (!cl.some(c => c.id === S.cls)) S.cls = cl[0].id;
        h += `<input id=q type=search placeholder="🔍 Rechercher un élève (toutes les classes)" value="${esc(S.q)}"><div id=lst></div>`;
    }
    if (dir()) h += `<div class=row><button class=ghost onclick=addClass()>+ Classe</button>${cl.length ? '<button onclick=addStudent()>+ Élève</button><button class=ghost onclick=bulkAdd()>+ Liste</button>' : ''}</div>`;
    $('#main').innerHTML = h;
    if ($('#q')) {
        $('#q').oninput = e => { S.q = e.target.value; drawList(); };
        if ($('#so')) {
            $('#so').value = S.sort;
            $('#so').onchange = e => { S.sort = e.target.value; drawList(); };
            document.querySelectorAll('.chip[data-f]').forEach(b => b.onclick = () => { S.ft = b.dataset.f; document.querySelectorAll('.chip[data-f]').forEach(x => x.classList.toggle('on', x === b)); drawList(); });
        }
        drawList();
    }
    if (S.view === 'class' && typeof loadClassAvg === 'function') loadClassAvg();
}
function drawGrid() {
    const cl = yc(), st = ys(), by = {};
    st.forEach(s => { const o = by[s.class_id] || (by[s.class_id] = { n: 0, d: 0 }); o.n++; o.d += Math.max(0, Number(s.balance_cdf || 0)); });
    const td = st.reduce((t, s) => t + Math.max(0, Number(s.balance_cdf || 0)), 0), u = SYM[S.cur] || '', M = money();
    $('#lst').innerHTML = `<div class="card csum"><span><b>${cl.length}</b> classe${cl.length > 1 ? 's' : ''} · <b>${st.length}</b> élève${st.length > 1 ? 's' : ''}</span>${M ? `<span class="${td ? 'due' : 'ok'}">${td ? short(td) + ' ' + u + ' à recevoir' : '✓ Tout est soldé'}</span>` : ''}</div>`
        + '<div class=cgrid>' + cl.map(c => {
            const o = by[c.id] || { n: 0, d: 0 };
            return `<div class=ccard onclick="openClass('${c.id}')"><b>${esc(c.name)}</b><small>${o.n} élève${o.n > 1 ? 's' : ''}</small>${M ? `<span class="cd ${o.d ? 'due' : 'ok'}">${!o.n ? '—' : o.d ? short(o.d) + ' ' + u : '✓ Soldé'}</span>` : ''}</div>`;
        }).join('') + '</div>';
}
function listNow() {
    const grid = S.view !== 'class', q = nrm(S.q).trim(), qd = q.replace(/\D/g, '');
    let l = grid ? ys() : ys().filter(s => s.class_id === S.cls);
    if (q) l = l.filter(s => nrm(s.name).includes(q) || (qd && String(s.parent_phone || '').replace(/\D/g, '').includes(qd)));
    if (!grid) {
        if (S.ft === 'due') l = l.filter(s => termOn() ? tRem(s) > 0 : s.balance_cdf > 0);
        else if (S.ft === 'late') l = l.filter(s => status(s) === 'late');
        else if (S.ft === 'paid') l = l.filter(s => termOn() ? tRem(s) <= 0 : s.balance_cdf <= 0);
        else if (S.ft === 'nophone') l = l.filter(s => !s.parent_phone);
    }
    return l.sort(sorts[grid ? 'alpha' : S.sort]);
}
function drawList() {
    const grid = S.view !== 'class', q = nrm(S.q).trim();
    if (grid && !q) return drawGrid();
    const cn = Object.fromEntries(S.classes.map(c => [c.id, c.name])), l = listNow();
    const sc = !grid && termOn(), tot = l.reduce((t, s) => t + (sc ? tRem(s) : Number(s.balance_cdf || 0)), 0);
    $('#lst').innerHTML = l.length ? `<small>${l.length} élève(s)${money() ? ' · reste dû ' + (sc ? 'T' + getTermToShow() + ' ' : '') + fmt(tot) : ''}</small>` + l.map(s => `<div class=card onclick="menu('${s.id}')"><span><b>${esc(s.name)}</b>${grid ? '' : avgPill(s)}${grid ? '<br><small>' + esc(cn[s.class_id] || '') + '</small>' : ''}</span>${money() ? stTag(s, !grid) : ''}</div>`).join('') : `<p class=empty>${q || S.ft !== 'all' ? 'Aucun élève trouvé.' : 'Aucun élève dans cette classe.'}</p>`;
}

/* ---------- Impression d’une classe (PDF / PNG) ---------- */
function printClass() {
    const c = S.classes.find(x => x.id === S.cls); if (!c) return;
    const l = listNow(); if (!l.length) return toast('Aucun élève à imprimer.');
    const d = show(`<h3>Imprimer · ${esc(c.name)}</h3><div class=col><small>${l.length} élève(s) · selon le tri et le filtre affichés</small><button id=pp>📄 PDF</button><button class=ghost id=pi>🖼 Image PNG</button><button class=ghost id=px>Fermer</button></div>`);
    d.querySelector('#px').onclick = () => d.close();
    d.querySelector('#pp').onclick = e => exRun(e.target, () => classPdf(c, l));
    d.querySelector('#pi').onclick = e => exRun(e.target, () => classPng(c, l));
}
const clSlug = n => nrm(n).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function classPdf(c, l) {
    const rows = l.map((s, i) => [i + 1, s.name, s.parent_phone || '', Math.round(Number(s.paid_cdf || 0)), Math.round(Number(s.balance_cdf || 0))]);
    const a = k => rows.reduce((t, r) => t + r[k], 0);
    const o = { title: c.name + ' — ' + S.school.name, sub: stamp() + ' · ' + rows.length + ' élèves · montants en FC', head: ['N°', 'Élève', 'Téléphone parent', 'Payé (FC)', 'Reste (FC)'], rows, w: [6, 40, 22, 16, 16], r: [3, 4], tot: ['', 'Total', '', a(3), a(4)] };
    dl(new Blob([mkPdf(o)], { type: 'application/pdf' }), fnm('classe-' + clSlug(c.name), 'pdf'));
    $('#dlg').close(); toast('PDF enregistré dans Téléchargements');
}
async function classPng(c, l) {
    const PP = 40, N = Math.ceil(l.length / PP), W = 720, RH = 44, files = [], tot = l.reduce((t, s) => t + Math.max(0, Number(s.balance_cdf || 0)), 0);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'logo-light.png'; });
    for (let p = 0; p < N; p++) {
        const rows = l.slice(p * PP, (p + 1) * PP), last = p === N - 1, H = 190 + rows.length * RH + (last ? 130 : 70);
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
        x.fillStyle = '#fffdf6'; x.fillRect(0, 0, W, H);
        const gg = x.createLinearGradient(0, 0, W, H); gg.addColorStop(0, '#e9cf86'); gg.addColorStop(.5, '#b08a30'); gg.addColorStop(1, '#8a6a1f');
        x.strokeStyle = gg; x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28); x.lineWidth = 1; x.strokeRect(24, 24, W - 48, H - 48);
        if (im) x.drawImage(im, 44, 44, 70, 70);
        x.textAlign = 'left'; x.fillStyle = '#111211'; x.font = 'bold 28px Georgia,serif'; x.fillText(c.name, 130, 74);
        x.fillStyle = '#6b6a60'; x.font = '17px sans-serif'; x.fillText(S.school.name + ' · ' + (S.year || '—'), 130, 101);
        x.fillText(l.length + ' élève' + (l.length > 1 ? 's' : '') + (N > 1 ? ' · page ' + (p + 1) + '/' + N : ''), 130, 125);
        x.fillStyle = gg; x.fillRect(50, 148, W - 100, 2);
        const cut = (t, w) => { if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
        rows.forEach((s, i) => {
            const yy = 190 + i * RH;
            if (i % 2) { x.fillStyle = '#f7f1e0'; x.fillRect(40, yy - 26, W - 80, RH); }
            x.textAlign = 'left'; x.fillStyle = '#6b6a60'; x.font = '15px sans-serif'; x.fillText(String(p * PP + i + 1), 50, yy);
            x.fillStyle = '#111211'; x.font = '17px sans-serif'; x.fillText(cut(s.name, 275), 90, yy);
            x.fillStyle = '#6b6a60'; x.font = '15px sans-serif'; x.fillText(cut(s.parent_phone || '', 140), 380, yy);
            const due = Number(s.balance_cdf || 0) > 0; x.textAlign = 'right'; x.font = 'bold 16px sans-serif'; x.fillStyle = due ? '#a85a4e' : '#3f7a5c'; x.fillText(due ? fmt(s.balance_cdf) : '✓ Soldé', W - 50, yy);
        });
        x.textAlign = 'left';
        if (last) { const yt = 190 + rows.length * RH + 20; x.fillStyle = gg; x.fillRect(50, yt - 22, W - 100, 2); x.fillStyle = '#111211'; x.font = 'bold 18px Georgia,serif'; x.fillText('Total dû', 50, yt + 12); x.textAlign = 'right'; x.fillText(fmt(tot), W - 50, yt + 12); }
        x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '14px sans-serif'; x.fillText('Édité le ' + new Date().toLocaleDateString('fr-FR') + ' — ORÉA École', W / 2, H - 44);
        const blob = await new Promise(r => cv.toBlob(r, 'image/png')), fn = fnm('classe-' + clSlug(c.name) + (N > 1 ? '-p' + (p + 1) : ''), 'png');
        files.push({ blob, fn, url: URL.createObjectURL(blob), file: new File([blob], fn, { type: 'image/png' }) });
    }
    const fl = files.map(f => f.file), can = !!(navigator.canShare && navigator.canShare({ files: fl }));
    const d = show(`<h3>${esc(c.name)} · ${N} image${N > 1 ? 's' : ''}</h3><div class=col><button id=ps>📤 Partager</button><button class=ghost id=pd>Télécharger</button><button class=ghost id=pc>Fermer</button></div>${files.map(f => `<img src="${f.url}" alt="">`).join('')}`);
    d.querySelector('#pc').onclick = () => d.close();
    d.querySelector('#pd').onclick = () => { files.forEach(f => dl(f.blob, f.fn)); toast('Image' + (N > 1 ? 's enregistrées' : ' enregistrée') + ' dans Téléchargements'); };
    d.querySelector('#ps').onclick = async () => { if (can) { try { await navigator.share({ files: fl, text: c.name + ' — ' + S.school.name }); } catch (e) { if (e.name !== 'AbortError') toast('Partage impossible.'); } } else { files.forEach(f => dl(f.blob, f.fn)); toast('Image enregistrée.'); } };
}
function addClass(yr) {
    // Complexe scolaire : on choisit le niveau. Sinon, la base le déduit du type d'école.
    // Les frais ne sont demandés qu'au chef d'établissement (le Directeur des études n'a pas accès à l'argent).
    const F = [{ n: 'name', l: 'Nom (ex : 3e A)' }, { n: 'year', l: 'Année scolaire', v: yr || S.year || '' }];
    if (schoolKind() === 'complexe') F.push({ n: 'level', l: 'Niveau', o: CLASS_LEVELS, v: 'secondaire' });
    if (fin()) F.push({ n: 't1', l: 'Frais 1er trimestre', t: 'number' }, { n: 't2', l: 'Frais 2e trimestre', t: 'number' }, { n: 't3', l: 'Frais 3e trimestre', t: 'number' }, { n: 'cur', l: 'Devise des frais', o: CUR.map(c => [c, c]), v: S.cur });
    ask('Nouvelle classe', F, async v => {
        const row = { school_id: S.school.id, name: v.name.trim(), year: v.year.trim() };
        if (v.level) row.level = v.level;
        if (fin()) Object.assign(row, { fee_t1: +v.t1, fee_t2: +v.t2, fee_t3: +v.t3, fee_currency: v.cur });
        const { data: nc, error } = await db.from('classes').insert(row).select('id');
        if (error) throw error;
 S.year = cy({ year: v.year.trim() }); S.cls = null; localStorage['orea_year_' + S.school.id] = S.year; await load(); render();
    });
}
function addStudent() {
    ask('Nouvel élève', [{ n: 'name', l: 'Nom complet' }, { n: 'sexe', l: 'Sexe', o: SEXES, v: '' }, { n: 'dn', l: 'Date de naissance', t: 'date', r: false }, { n: 'phone', l: 'WhatsApp du parent', t: 'tel', r: false }, { n: 'cls', l: 'Classe', o: yc().map(c => [c.id, esc(c.name)]), v: S.cls }], async v => {
        if (v.dn && v.dn > tdy()) throw Error('La date de naissance est dans le futur.');
        const { error } = await db.from('students').insert({ school_id: S.school.id, class_id: v.cls, name: v.name.trim(), parent_phone: v.phone.trim() || null, sexe: v.sexe || null, date_naissance: v.dn || null });
        if (error) throw error; S.cls = v.cls; await load(); render();
    });
}
function termSolde(s) {
    const c = S.classes.find(x => x.id === s.class_id), k = S.curTermFilter || (c ? curTerm(cy(c)) : null);
    if (!(k > 0)) return `<p>${stTag(s)}</p>`;
    const t = trims(s)[k - 1];
    return `<p><b>Solde du trimestre ${k}</b> : ${t[1] > 0 ? `<span class=due>${fmt(t[1])} à payer</span>` : '<span class=ok>✓ Soldé</span>'}</p>`;
}
function menu(id) {
    const s = S.stu.find(x => x.id === id), R = S.me.role, D = dir();
    if (!s) return;
    // Dette : chef d'établissement uniquement. Code parent : toute la direction.
    let head = '';
    if (D) {
        const fs = fin() ? fees4(s).filter(f => feeRem(s, f) > 0) : [];
        head = (fin() ? debtLines(s) : '')
            + (fs.length ? '<p><small>Autres frais : ' + fs.map(f => esc(f.name) + ' reste ' + fmt(feeRemCdf(s, f))).join(' · ') + '</small></p>' : '')
            + '<div class=card id=pcode style="display:block"><small>Code parent</small><br><b id=pcv style="font-size:22px;letter-spacing:.14em">…</b><div class=row id=pcb style="display:none;margin-top:8px"><button class=ghost id=pc1>Copier</button><button class=ghost id=pc2>SMS</button><button class=ghost id=pc3>WhatsApp</button></div></div>';
    }
    const d = show(`<h3>${esc(s.name)}</h3>${head}<div class=col>${colOK(s.class_id) ? '<button id=m2>Paiement</button>' : ''}<button class=ghost id=m7>Avertissements et sanctions</button><button class=ghost id=m9>Cotes</button>${D ? '<button class=ghost id=m6>Message au parent</button><button class=ghost id=m4>Modifier l’élève</button><button class=ghost id=m5>Supprimer l’élève</button>' : ''}<button class=ghost id=m3>Fermer</button></div>`);
    const b = (k, f) => { const e = d.querySelector('#' + k); if (e) e.onclick = f; };
    b('m2', () => hist(id)); b('m3', () => d.close()); b('m4', () => editStudent(id)); b('m5', () => { d.close(); delStudent(id); }); b('m6', () => wa(id)); b('m7', () => sanc(id)); b('m9', () => { if (typeof openStuCotes === 'function') openStuCotes(id); });
    if (D) {
        db.rpc('student_parent_code', { p_student: id }).then(({ data, error }) => {
            const v = d.querySelector('#pcv'); if (!v || !d.open) return;
            if (error || !data) { v.textContent = 'introuvable'; return; }
            v.textContent = data;
            const msg = codeMsg(s, data), hasPh = !!s.parent_phone;
            d.querySelector('#pcb').style.display = 'flex';
            d.querySelector('#pc1').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(data) : Promise.reject()).then(() => toast('Code copié !')).catch(() => toast('Code : ' + data)); };
            d.querySelector('#pc2').onclick = () => hasPh ? openSms(s.parent_phone, msg) : toast('Aucun numéro de parent enregistré.');
            d.querySelector('#pc3').onclick = () => { const u = hasPh && waLink(s.parent_phone, msg); if (u) window.open(u, '_blank'); else toast('Aucun numéro de parent enregistré.'); };
        });
    }
}
// Message d'envoi du code parent (avec le lien de l'espace parent)
function codeMsg(s, code) {
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'parent.html';
    return `Bonjour, ici ${S.school.name}. Voici le code parent de ${s.name} : ${code}. Avec ce code, suivez sa scolarité (paiements, notes, présences) sur ORÉA École : ${link}`;
}
// Dette du trimestre en cours (en grand) + reste des trimestres précédents (en petit)
function debtLines(s) {
    const c = S.classes.find(x => x.id === s.class_id), t = trims(s), k0 = c ? curTerm(cy(c)) : null;
    if (k0 === null) { const v = Number(s.balance_cdf || 0); return `<p><b>Dette totale</b> : ${v > 0 ? `<span class=due>${fmt(v)}</span>` : '<span class=ok>✓ Soldé</span>'}</p>`; }
    const k = Math.max(1, k0), cur = t[k - 1], prev = t.slice(0, k - 1).filter(x => x[1] > 0);
    return `<p><b>Dette Trimestre ${k}</b> : ${cur[1] > 0 ? `<span class=due>${fmt(cur[1])}</span>` : '<span class=ok>✓ Soldé</span>'}</p>`
        + (prev.length ? `<p><small>${prev.map(x => 'Reste T' + x[0] + ' : ' + fmt(x[1])).join(' · ')}</small></p>` : '');
}
/* ---------- Trimestres et WhatsApp ---------- */
const COUNTRY = '243';
const trims = s => [1, 2, 3].map(i => { const due = Number(s['due' + i + '_cdf'] || 0), paid = Number(s['p' + i + '_cdf'] || 0); return [i, Math.max(0, due - paid), due, paid]; });
function telNum(phone) {
    let n = String(phone || '').replace(/[^\d]/g, '');
    if (!n) return null;
    if (n.startsWith('00')) n = n.slice(2); else if (n.startsWith('0')) n = COUNTRY + n.slice(1);
    return n;
}
function waLink(phone, msg) { const n = telNum(phone); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg) : null; }
// SMS : ouvre l'application SMS du téléphone avec le message déjà écrit (envoi par le forfait du téléphone)
function smsLink(phone, msg) { const n = telNum(phone); return n ? 'sms:+' + n + '?body=' + encodeURIComponent(msg) : null; }
function openSms(phone, msg) { const u = smsLink(phone, msg); if (!u) { toast('Numéro invalide'); return false; } location.href = u; return true; }
const logMsg = (sid, kind, body) => db.from('messages_log').insert({ school_id: S.school.id, student_id: sid, kind, body }).then(() => { }, () => { });
const feeMsg = s => { const hi = `Bonjour, ici ${S.school.name}. `, rest = trims(s).filter(t => t[1] > 0).map(t => 'T' + t[0] + ' : ' + fmt(t[1])).concat(fees4(s).filter(f => feeRem(s, f) > 0).map(f => f.name + ' : ' + fmt(feeRemCdf(s, f)))).join(', '); return s.balance_cdf > 0 ? `${hi}Concernant ${s.name} : il reste ${fmt(s.balance_cdf)} à payer (${rest}). Merci de régulariser.` : `${hi}Les frais de ${s.name} sont entièrement soldés. Merci !`; };
const fillTpl = (t, s) => String(t || '').replace(/{eleve}/g, s.name).replace(/{classe}/g, cnm(s.class_id)).replace(/{reste}/g, fmt(s.balance_cdf)).replace(/{ecole}/g, S.school.name);
function getTpl(kind, s) {
    const tpl = S.school.message_templates || {};
    return fillTpl(tpl[kind] || (kind === 'frais' ? feeMsg(s) : ''), s);
}

// --- FIN DE LA TRANCHE 4. La tranche suivante commencera par : async function wa(id) { ---
async function wa(id) {
    const s = S.stu.find(x => x.id === id); if (!s) return;
    const [{ data: ab }, { data: sa }] = await Promise.all([db.from('attendance').select('day').eq('student_id', id).eq('status', 'absent').order('day', { ascending: false }).limit(5), db.from('sanctions').select('*').eq('student_id', id).order('created_at', { ascending: false }).limit(1)]);
    const A = ab || [], X = sa || [], fd = x => new Date(x + 'T00:00').toLocaleDateString('fr-FR'), hi = `Bonjour, ici ${S.school.name}. `;
    const C = (S.school.message_templates || {}).custom || [];
    const M = {
        frais: getTpl('frais', s),
        absence: A.length ? `${hi}${s.name} a été absent(e) le ${A.map(a => fd(a.day)).join(', ')}. Merci de nous en indiquer la raison.` : `${hi}${s.name} n’a pas d’absence récente.`,
        sanction: X.length ? `${hi}${s.name} a reçu la sanction suivante le ${fd(X[0].day)} : ${X[0].kind}${X[0].note ? ' (' + X[0].note + ')' : ''}. Merci de passer à l’école.` : `${hi}Aucune sanction enregistrée pour ${s.name}.`,
        libre: hi
    };
    C.forEach(c => { M['c_' + c.id] = fillTpl(c.text, s); });
    const ph = !!s.parent_phone;
    const d = show(`<h3>Message au parent · ${esc(s.name)}</h3><label>Sujet<select id=wk><option value=frais>Frais restants</option><option value=absence>Absences</option><option value=sanction>Sanction</option>${C.map(c => `<option value="c_${esc(c.id)}">${esc(c.name)}</option>`).join('')}<option value=libre>Message libre</option></select></label><label>Message<textarea id=wm rows=6 style="width:100%">${esc(M.frais)}</textarea></label><div class=col>${ph ? '' : '<small>Aucun numéro de téléphone enregistré : seule la messagerie ORÉA est possible.</small>'}<button id=ws1 ${ph ? '' : 'disabled'}>Message par WhatsApp</button><button class=ghost id=ws4 ${ph ? '' : 'disabled'}>Message par SMS</button><button class=ghost id=ws2>Messagerie ORÉA</button><button class=ghost id=ws3 ${ph ? '' : 'disabled'}>Les 2</button><button class=ghost id=wc>Fermer</button></div>`);
    d.querySelector('#wk').onchange = e => { d.querySelector('#wm').value = M[e.target.value]; };
    d.querySelector('#wc').onclick = () => d.close();
    const go = async (useWa, useOrea, btn, useSms) => {
        const m = d.querySelector('#wm').value.trim(), k = d.querySelector('#wk').value;
        if (!m) return toast('Le message est vide.');
        if (useSms) { if (!openSms(s.parent_phone, m)) return; logMsg(id, k.startsWith('c_') ? 'libre' : k, m); d.close(); return toast('SMS prêt à envoyer'); }
        if (useWa) { // WhatsApp d'abord : l'ouverture doit suivre directement le toucher
            const u = waLink(s.parent_phone, m);
            if (!u) return toast('Numéro WhatsApp invalide');
            window.open(u, '_blank');
        }
        if (useOrea) {
            btn.disabled = true;
            const { error } = await db.from('messages').insert({ school_id: S.school.id, channel: 'parent_ecole', thread_key: 'student:' + id, student_id: id, content: m.slice(0, 4000) });
            btn.disabled = false;
            if (error) return toast('Messagerie ORÉA : ' + (isNet(error) ? 'pas de connexion internet.' : error.message));
        }
        logMsg(id, k.startsWith('c_') ? 'libre' : k, m); d.close();
        toast(useWa && useOrea ? 'Envoyé sur WhatsApp et dans ORÉA' : useOrea ? 'Message envoyé dans ORÉA' : 'WhatsApp ouvert');
    };
    d.querySelector('#ws1').onclick = e => go(true, false, e.currentTarget);
    d.querySelector('#ws2').onclick = e => go(false, true, e.currentTarget);
    d.querySelector('#ws3').onclick = e => go(true, true, e.currentTarget);
    d.querySelector('#ws4').onclick = e => go(false, false, e.currentTarget, true);
}
function editFees(id) {
    const c = S.classes.find(x => x.id === id);
    ask('Frais — ' + esc(c.name), [{ n: 't1', l: '1er trimestre', t: 'number', v: c.fee_t1 }, { n: 't2', l: '2e trimestre', t: 'number', v: c.fee_t2 }, { n: 't3', l: '3e trimestre', t: 'number', v: c.fee_t3 }, { n: 'cur', l: 'Devise', o: CUR.map(x => [x, x]), v: c.fee_currency }], async v => {
        const { data, error } = await db.from('classes').update({ fee_t1: +v.t1, fee_t2: +v.t2, fee_t3: +v.t3, fee_currency: v.cur }).eq('id', id).select();
        if (error) throw error; if (!data.length) throw Error('Modification refusée'); await load(); render(); toast('Frais enregistrés');
    });
}
function editStudent(id) {
    const s = S.stu.find(x => x.id === id);
    ask('Modifier l’élève', [{ n: 'name', l: 'Nom complet', v: s.name }, { n: 'sexe', l: 'Sexe', o: SEXES, v: s.sexe || '' }, { n: 'dn', l: 'Date de naissance', t: 'date', r: false, v: s.date_naissance || '' }, { n: 'phone', l: 'WhatsApp du parent', t: 'tel', r: false, v: s.parent_phone }, { n: 'cls', l: 'Classe', o: yc().map(c => [c.id, esc(c.name)]), v: s.class_id }], async v => {
        if (v.dn && v.dn > tdy()) throw Error('La date de naissance est dans le futur.');
        const { data, error } = await db.from('students').update({ name: v.name.trim(), parent_phone: v.phone.trim() || null, class_id: v.cls, sexe: v.sexe || null, date_naissance: v.dn || null }).eq('id', id).select();
        if (error) throw error; if (!data.length) throw Error('Modification refusée'); S.cls = v.cls; await load(); render(); toast('Élève modifié');
    });
}
async function delStudent(id) {
    const s = S.stu.find(x => x.id === id);
    if (!confirm('Supprimer ' + s.name + ' ?')) return;
    const { data, error } = await db.from('students').delete().eq('id', id).select();
    if (error) return toast(error.code === '23503' ? 'Impossible : cet élève a des paiements.' : error.message);
    if (!data.length) return toast('Suppression refusée');
    await load(); render(); toast('Élève supprimé');
}
const parseList = t => { const seen = new Set(); return t.split('\n').map(l => l.replace(/^\s*\d+\s*[.)\-–]\s*/, '').trim()).filter(Boolean).map(l => { const [n, p] = l.split(/[;\t]/); return { name: n.trim().replace(/\s+/g, ' '), phone: (p || '').trim() || null }; }).filter(r => r.name && !seen.has(r.name.toLowerCase()) && seen.add(r.name.toLowerCase())); };
function bulkAdd() {
    const d = show(`<form method=dialog><h3>Ajouter une liste d’élèves</h3><label>Classe<select name=cls>${yc().map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label>Un nom par ligne (téléphone après « ; »)<textarea name=txt rows=10 style="width:100%" required></textarea></label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Enregistrer</button></div></form>`);
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        const f = e.target, cls = f.cls.value;
        const have = new Set(S.stu.filter(s => s.class_id === cls).map(s => s.name.toLowerCase()));
        const all = parseList(f.txt.value), rows = all.filter(r => !have.has(r.name.toLowerCase()));
        if (!rows.length) return toast('Aucun nouveau nom à ajouter');
        const { error } = await db.from('students').insert(rows.map(r => ({ school_id: S.school.id, class_id: cls, name: r.name, parent_phone: r.phone })));
        if (error) return toast(error.message);
        S.cls = cls; await load(); render();
        toast(rows.length + ' élève(s) ajouté(s)' + (all.length > rows.length ? ' · ' + (all.length - rows.length) + ' ignoré(s)' : ''));
    };
}

/* ---------- Abonnement et administrateur ---------- */
const ADMIN_WA = '243825556492';
function lockView() {
    $('#nav').hidden = true; $('#exb').hidden = true;
    $('#main').innerHTML = `<div class=auth><h2>Accès suspendu</h2><p>ORÉA a suspendu l’accès de ${esc(S.school.name)}. Aucune donnée n’est effacée : tout revient dès la réactivation.</p>${ADMIN_WA ? `<a class=btn style="text-align:center;text-decoration:none" href="https://wa.me/${ADMIN_WA}?text=${encodeURIComponent('Bonjour ORÉA, l’accès de ' + S.school.name + ' est suspendu. Pouvez-vous m’aider ?')}">Contacter ORÉA</a>` : ''}<button class=ghost onclick=out()>Déconnexion</button></div>`;
}
async function adminView() {
    try { await adminDraw(); }
    catch (e) {
        console.error('adminView', e);
        $('#main').innerHTML = '<div class=auth><h2>ORÉA</h2><p>Impossible d’afficher la page : ' + esc(String((e && e.message) || e)) + '</p><button onclick=adminView()>Réessayer</button><button class=ghost onclick=out()>Déconnexion</button></div>';
    }
}
async function adminDraw() {
    $('#nav').hidden = true;
    $('#main').innerHTML = SK;
    let [{ data, error }, { data: pays }] = await Promise.all([db.rpc('admin_list_schools'), db.from('sub_payments').select('amount,currency,created_at')]);
    if (error) throw error;
    data = data || []; pays = pays || [];
    const now = Date.now(), nd = new Date(), act = data.filter(s => new Date(s.sub_until) > now).length;
    const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonth = pays.filter(p => new Date(p.created_at) >= m0);
    const totCur = list => { const m = {}; list.forEach(p => { m[p.currency] = (m[p.currency] || 0) + Number(p.amount); }); return Object.entries(m).filter(x => x[1] > 0).map(x => nf(x[1]) + ' ' + SYM[x[0]]).join(' · ') || '0 FC'; };
    const ms = []; for (let i = 5; i >= 0; i--) { const d = new Date(nd.getFullYear(), nd.getMonth() - i, 1); ms.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), v: 0 }); }
    pays.forEach(p => { if (p.currency === 'USD') { const d = new Date(p.created_at), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), m = ms.find(x => x.k === k); if (m) m.v += Number(p.amount); } });
    const mx = Math.max(...ms.map(x => x.v), 1);
    let h = `<h3>Espace ORÉA</h3><div class=card><span>Écoles actives / total</span><b>${act} / ${data.length}</b></div><div class=card><span>Revenus ce mois</span><b>${totCur(thisMonth)}</b></div>`;
    h += `<div class="card col"><b>Revenus USD (6 derniers mois)</b><div class="admin-bar">${ms.map(x => `<div style="height:${Math.max(4, Math.round(x.v / mx * 80))}px" title="${nf(x.v)} $"><small>${x.l}</small></div>`).join('')}</div></div>`;
    h += `<div class=row><button onclick=adminHistory()>Historique des encaissements</button></div>`;
    h += '<h3>Écoles</h3>' + (data.length ? data.map(s => {
        const d = s.sub_until ? new Date(s.sub_until) : null;
        const left = d ? Math.ceil((d - now) / 864e5) : -999;
        const ok = left > 0;
        const waMsg = ok ? `Bonjour, l’abonnement de ${s.name} arrive à échéance dans ${left} jour(s).` : `Bonjour, l’abonnement de ${s.name} est arrivé à échéance.`;
        const waUrl = s.phone ? waLink(s.phone, waMsg) : null;
        return `<div class="card col"><b>${esc(s.name)}</b><span>${esc(s.director_name || '—')} · ${esc(s.director_email || '')}</span><small>${s.students} élèves · ${s.members} compte(s) · code ${esc(s.code)}</small><span class="${ok && left > 7 ? 'ok' : 'due'}">${ok ? 'Actif jusqu’au ' + d.toLocaleDateString('fr-FR') + ' (' + left + ' j)' : '⛔ Expiré'}</span><div class=row>${waUrl ? `<a class="btn ghost" style="width:auto;text-decoration:none" href="${waUrl}" target="_blank">💬 Relance WhatsApp</a><a class="btn ghost" style="width:auto;text-decoration:none" href="${esc(smsLink(s.phone, waMsg))}">SMS</a>` : `<button class=ghost style="width:auto" onclick="setSchoolPhone('${s.id}')">📞 Ajouter WhatsApp</button>`}${s.phone ? `<button class=ghost style="width:auto" data-p="${esc(s.phone)}" onclick="setSchoolPhone('${s.id}',this.dataset.p)">✏</button>` : ''}</div><div class=row>${[1, 2, 3, 6].map(n => `<button class=ghost onclick="extModal('${s.id}',${n})">+${n} m</button>`).join('')}</div></div>`;
    }).join('') : '<p class=empty>Aucune école pour le moment.</p>') + installCard() + '<button class=ghost onclick=out()>Déconnexion</button>';
    $('#main').innerHTML = h;
}
// v88 : renouvellement — durée 1 à 12 mois + point de départ si l'école est en retard
//   a. à partir d'aujourd'hui (par défaut : les jours de retard sont offerts)
//   b. à partir de l'ancienne date de fin (l'école « paie » son retard)
//   c. rattraper un nombre de jours au choix
// Une école encore active : les mois s'ajoutent toujours à sa date de fin.
const EXT_MONTHS = [1, 2, 3, 6, 12];
function extModal(sid, n) {
    const sc = (typeof ADM !== 'undefined' && ADM.sch ? ADM.sch.find(x => x.id === sid) : null) || {};
    const sname = sc.name || 'l’école';
    const end = sc.sub_until ? new Date(sc.sub_until) : null;
    const late = end && end < Date.now() ? Math.floor((Date.now() - end) / 864e5) : 0;
    const fd = d => d.toLocaleDateString('fr-FR');
    const d = show(`<form method=dialog><h3>Prolonger ${esc(sname)}</h3>
<label>Durée<select name=n>${EXT_MONTHS.map(m => `<option value=${m} ${m === +n ? 'selected' : ''}>${m} mois</option>`).join('')}</select></label>
${late > 0 ? `<label>Point de départ<select name=mode><option value=today selected>a. À partir d’aujourd’hui (${late} jour${late > 1 ? 's' : ''} de retard offert${late > 1 ? 's' : ''})</option><option value=old_end>b. À partir de l’ancienne fin (${fd(end)})</option><option value=days>c. Rattraper un nombre de jours</option></select></label><label id=xdl hidden>Jours de retard à rattraper (0 à ${late})<input name=days type=number min=0 max=${late} step=1 value=${late}></label>` : `<p><small>${end ? 'L’école est encore active : les mois s’ajoutent à sa date de fin (' + fd(end) + ').' : 'Les mois partent d’aujourd’hui.'}</small></p>`}
<div class="card col"><span>Nouvelle date de fin</span><b id=xpv>—</b></div>
<label>Montant perçu<input name=amount type=number step=any value=0></label>
<label>Devise<select name=cur>${CUR.map(c => `<option value=${c} ${c === 'USD' ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
<label>Remarque<input name=note></label>
<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Valider</button></div></form>`);
    const f = d.querySelector('form');
    const calc = () => {
        const m = +f.n.value, mode = f.mode ? f.mode.value : 'today';
        if (f.mode) d.querySelector('#xdl').hidden = mode !== 'days';
        let base;
        if (!late) base = end ? new Date(end) : new Date();
        else if (mode === 'old_end') base = new Date(end);
        else if (mode === 'days') base = new Date(Date.now() - Math.min(late, Math.max(0, Math.floor(+f.days.value || 0))) * 864e5);
        else base = new Date();
        { const day = base.getDate(); base.setDate(1); base.setMonth(base.getMonth() + m); base.setDate(Math.min(day, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate())); } // comme la base
        const pv = d.querySelector('#xpv');
        pv.textContent = fd(base) + (base <= Date.now() ? ' (déjà passée : choisissez plus de mois)' : '');
        pv.className = base <= Date.now() ? 'due' : '';
        return base;
    };
    f.oninput = calc; f.onchange = calc; calc();
    f.onsubmit = async e => {
        if (!e.submitter || e.submitter.value !== 'ok') return;
        if (calc() <= Date.now()) { e.preventDefault(); return toast('La nouvelle date de fin serait déjà passée.'); }
        const mode = !late ? 'today' : f.mode.value;
        const { data, error } = await db.rpc('v88_admin_extend', { sid, p_months: +f.n.value, p_mode: mode, p_days: mode === 'days' ? Math.floor(+f.days.value || 0) : 0, pay_amount: +f.amount.value || 0, pay_cur: f.cur.value, pay_note: f.note.value.trim() || null });
        if (error) return toast(error.message);
        toast('Abonnement prolongé jusqu’au ' + (data ? fd(new Date(data)) : '…')); adminView();
    };
}
function setSchoolPhone(sid, curr = '') {
    ask('Numéro WhatsApp', [{ n: 'phone', l: 'Numéro', t: 'tel', v: curr }], async v => {
        const { error } = await db.rpc('admin_set_school_phone', { sid, p: v.phone.trim() || null });
        if (error) return toast(error.message);
        toast('Numéro enregistré'); adminView();
    });
}
async function adminHistory() {
    const [{ data: p0, error }, { data: sc0 }] = await Promise.all([db.from('sub_payments').select('*').order('created_at', { ascending: false }).limit(100), db.from('schools').select('id,name')]);
    if (error) return toast(error.message);
    const p = p0 || [], sc = sc0 || [];
    const nm = Object.fromEntries(sc.map(s => [s.id, s.name]));
    const totUSD = p.filter(x => x.currency === 'USD').reduce((t, x) => t + Number(x.amount), 0);
    const totCDF = p.filter(x => x.currency === 'CDF').reduce((t, x) => t + Number(x.amount), 0);
    const d = show(`<h3>Comptabilité abonnements</h3><div class=card><span>Total encaissé</span><b>${nf(totUSD)} $ · ${nf(totCDF)} FC</b></div><input type="search" id="ah-search" placeholder="Rechercher une école..." oninput="filterHistory(this.value)"><div id="ah-list">${p.length ? p.map(x => `<div class="card col" data-school="${esc(nm[x.school_id] || 'École')}"><b>${esc(nm[x.school_id] || 'École')} · +${x.months} mois</b><span>${nf(x.amount)} ${x.currency}</span><small>${new Date(x.created_at).toLocaleString('fr-FR')}</small></div>`).join('') : '<p class=empty>Aucun encaissement.</p>'}</div><button class=ghost id=ahc>Fermer</button>`);
    d.querySelector('#ahc').onclick = () => d.close();
}
function filterHistory(q) {
    const s = nrm(q);
    document.querySelectorAll('#ah-list .card').forEach(el => {
        el.hidden = s && !nrm(el.dataset.school).includes(s);
    });
}

/* ---------- Paiements ---------- */
function pay(id) {
    const s = S.stu.find(x => x.id === id);
    const dt = (trims(s).find(x => x[1] > 0) || [0])[0], fs = fees4(s).filter(f => feeRem(s, f) > 0);
    const opts = [['t1', '1er trimestre'], ['t2', '2e trimestre'], ['t3', '3e trimestre'], ...fs.map(f => ['f' + f.id, esc(f.name) + ' · reste ' + fmt(feeRemCdf(s, f))])];
    const def = dt ? 't' + dt : fs.length ? 'f' + fs[0].id : 't1';
    ask('Encaisser — ' + esc(s.name), [{ n: 'target', l: 'Paiement pour', o: opts, v: def }, { n: 'amount', l: 'Montant', t: 'number' }, { n: 'currency', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur }, { n: 'method', l: 'Mode', o: [['especes', 'Espèces'], ['mobile_money', 'Mobile Money']] }, { n: 'reference', l: 'Réf. Mobile Money (si applicable)', r: false }, { n: 'amount2', l: 'Paiement mixte : complément en FC (facultatif)', t: 'number', r: false }], async v => {
        const mm = v.method === 'mobile_money';
        if (mm && !v.reference.trim()) throw Error('Référence Mobile Money obligatoire');
        const isF = v.target[0] === 'f', fid = v.target.slice(1);
        const base = { id: crypto.randomUUID(), student_id: id, amount: +v.amount, currency: v.currency, method: v.method, reference: mm ? v.reference.trim() : null };
        const row = isF ? { ...base, fee_id: fid, fee_name: (S.fees.find(f => f.id === fid) || {}).name } : { ...base, term: +fid };
        // Paiement mixte : une 2e ligne en FC (même objet, même mode), avec son propre reçu
        const a2 = +(v.amount2 || 0), row2 = a2 > 0 ? Object.assign({}, row, { id: crypto.randomUUID(), amount: a2, currency: 'CDF', reference: mm ? v.reference.trim() + '-FC' : null }) : null;
        if (a2 < 0) throw Error('Complément invalide');
        if (!navigator.onLine) { if (row2) await payOffline(row2); return payOffline(row); }
        const { data, error } = await db.from(isF ? 'fee_payments' : 'payments').insert(row).select().single();
        if (isNet(error)) { if (row2) await payOffline(row2); return payOffline(row); }
        if (error) throw error.code === '23505' ? Error('Cette référence existe déjà') : error;
        if (row2) { const r2 = await db.from(isF ? 'fee_payments' : 'payments').insert(row2).select().single(); if (r2.error) toast('Complément en FC non enregistré : ' + r2.error.message); else toast('Paiement mixte : 2 reçus créés (voir « Paiement » de l’élève)'); }
        await load(); render(); receipt(data, id);
        if (!isF) ppSync(id); // coche les échéances couvertes du plan de paiement
    });
}
async function hist(id) {
    const [{ data: d1, error: e1 }, { data: d2 }] = await Promise.all([db.from('payments').select('*').eq('student_id', id), db.from('fee_payments').select('*').eq('student_id', id)]);
    if (e1) return toast(e1.message);
    const data = [...d1.map(p => ({ ...p, _f: 0 })), ...(d2 || []).map(p => ({ ...p, _f: 1 }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const ids = d1.map(p => p.id);
    const fids = (d2 || []).map(p => p.id);
    const [{ data: pend0 }, { data: fpend0 }] = await Promise.all([
        ids.length ? db.from('change_requests').select('payment_id').eq('status', 'en_attente').in('payment_id', ids) : { data: [] },
        fids.length ? db.from('change_requests').select('fee_payment_id').eq('status', 'en_attente').in('fee_payment_id', fids) : { data: [] }
    ]);
    const pend = pend0 || [], fpend = fpend0 || [];
    const pe = new Set(pend.map(r => r.payment_id));
    const fpe = new Set(fpend.map(r => r.fee_payment_id));
    const st = S.stu.find(x => x.id === id), cc = canCollect() && (!st || colOK(st.class_id));
    const d = show(`<h3>Paiement${st ? ' · ' + esc(st.name) : ''}</h3>${st ? debtLines(st) : ''}${cc ? '<div class=col><button id=hp>Encaisser un paiement</button><button class=ghost id=hpl>Plan de paiement</button></div>' : ''}<p style="margin:14px 0 4px"><small>HISTORIQUE ET REÇUS</small></p>${data.length ? data.map((p, i) => {
        const isP = pe.has(p.id) || fpe.has(p.id);
        const late = p.recu_le && (new Date(p.recu_le) - new Date(p.created_at)) > 36e5;
        return `<div class="card col"><span>${rno(p)} · ${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${p._f ? esc(p.fee_name || 'Frais') : 'T' + p.term} · ${nf(p.amount)} ${p.currency}</span>${late ? `<small class=due>📴 Encaissé hors connexion · arrivé le ${new Date(p.recu_le).toLocaleString('fr-FR')}</small>` : ''}<div class=row><button class=ghost data-i=${i}>Reçu</button>${p._f ? (fin() ? `<button class=ghost data-x=${i}>Supprimer</button>` : '') : pe.has(p.id) ? '<small>⏳ demande en attente</small>' : `<button class=ghost data-c=${i}>${fin() ? 'Corriger' : 'Demander correction'}</button>`}</div></div>`;
    }).join('') : '<p class=empty data-ic="🧾">Aucun paiement.</p>'}<button class=ghost id=hc>Fermer</button>`);
    d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => receipt(data[b.dataset.i], id));
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => fixPay(data[b.dataset.c], id));
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
        const p = data[b.dataset.x]; if (!confirm('Supprimer ce paiement ?')) return;
        const { data: r, error } = await db.from('fee_payments').delete().eq('id', p.id).select();
        if (error || !r.length) return toast(error ? error.message : 'Refusé');
        d.close(); await load(); render(); toast('Paiement supprimé');
    });
    d.querySelector('#hc').onclick = () => d.close();
    if (cc) { d.querySelector('#hp').onclick = () => pay(id); d.querySelector('#hpl').onclick = () => ppOpen(id); }
}
function fixPay(p, sid) {
    const T = [['1', '1er trimestre'], ['2', '2e trimestre'], ['3', '3e trimestre']], D = fin();
    const d = show(`<h3>Paiement de ${nf(p.amount)} ${p.currency} (${p._f ? (p.fee_name || 'Frais') : 'T' + p.term})</h3><div class=col><button id=f1>${D ? 'Modifier' : 'Demander modification'}</button><button class=ghost id=f2>${D ? 'Supprimer' : 'Demander suppression'}</button><button class=ghost id=f3>Retour</button></div>`);
    d.querySelector('#f3').onclick = () => hist(sid);
    d.querySelector('#f1').onclick = () => ask(D ? 'Modifier' : 'Demande de modification', [{ n: 'amount', l: 'Montant', t: 'number', v: p.amount }, ...(p._f ? [] : [{ n: 'term', l: 'Trimestre', o: T, v: String(p.term) }]), ...(D ? [] : [{ n: 'reason', l: 'Motif', r: false }])], async v => {
        if (D) {
            if (p._f) { const { data, error } = await db.from('fee_payments').update({ amount: +v.amount, amount_cdf: +v.amount * (p.rate || rateOf(p.currency)), fee_paid: +v.amount * (p.rate || rateOf(p.currency)) / rateOf(((S.fees.find(f => f.id === p.fee_id) || {}).currency) || p.currency) }).eq('id', p.id).select(); if (error) throw error; if (!data.length) throw Error('Refusé'); }
            else { const { data, error } = await db.from('payments').update({ amount: +v.amount, term: +v.term }).eq('id', p.id).select(); if (error) throw error; if (!data.length) throw Error('Refusé'); }
            await load(); render(); toast('Modifié');
        }
        else {
            const payload = p._f ? { fee_payment_id: p.id, kind: 'edit_fee_payment', new_amount: +v.amount, reason: (v.reason || '').trim() || null } : { payment_id: p.id, kind: 'edit_payment', new_amount: +v.amount, new_term: +v.term, reason: (v.reason || '').trim() || null };
            const { error } = await db.from('change_requests').insert(payload); if (error) throw error.code === '23505' ? Error('Déjà en attente') : error; toast('Demande envoyée');
        }
    });
    d.querySelector('#f2').onclick = () => {
        if (D) { d.close(); if (!confirm('Supprimer ?')) return; const tb = p._f ? 'fee_payments' : 'payments'; db.from(tb).delete().eq('id', p.id).select().then(async ({ data, error }) => { if (error || !data.length) return toast(error ? error.message : 'Refusé'); await load(); render(); toast('Supprimé'); }); }
        else ask('Demande de suppression', [{ n: 'reason', l: 'Motif', r: false }], async v => {
            const payload = p._f ? { fee_payment_id: p.id, kind: 'delete_fee_payment', reason: (v.reason || '').trim() || null } : { payment_id: p.id, kind: 'delete_payment', reason: (v.reason || '').trim() || null };
            const { error } = await db.from('change_requests').insert(payload); if (error) throw error.code === '23505' ? Error('Déjà en attente') : error; toast('Demande envoyée');
        });
    };
}
async function decide(id, ok) {
    if (!confirm(ok ? 'Approuver ?' : 'Refuser ?')) return;
    const { error } = await db.rpc('decide_request', { rid: id, approve: ok });
    if (error) return toast(error.message);
    await load(); render(); toast(ok ? 'Approuvée' : 'Refusée');
}
async function journal() {
    const [ra, rpr] = await Promise.all([db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(60), db.from('profiles').select('id,full_name')]);
    const a = ra.data || [], pr = rpr.data || [];
    const nm = Object.fromEntries(pr.map(p => [p.id, p.full_name])), T = { payments: 'Paiement', fee_payments: 'Paiement de frais', students: 'Élève', classes: 'Classe' };
    const line = r => {
        const o = r.old_row || {}, n = r.new_row || {};
        if (r.tbl === 'fee_payments') return 'supprimé (' + nf(o.amount) + ' ' + o.currency + ')';
        if (r.tbl === 'payments') return r.op === 'DELETE' ? `supprimé (${nf(o.amount)} ${o.currency})` : `modifié : ${nf(o.amount)} → ${nf(n.amount)}`;
        return r.op === 'DELETE' ? `supprimé : ${o.name}` : `modifié : ${n.name}`;
    };
    const d = show(`<h3>Journal d’activité</h3>${a.length ? a.map(r => `<div class="card col"><b>${T[r.tbl] || r.tbl} ${esc(line(r))}</b><small>${new Date(r.created_at).toLocaleString('fr-FR')} · ${esc(nm[r.user_id] || '?')}</small></div>`).join('') : '<p class=empty data-ic="📋">Aucune activité.</p>'}<button class=ghost id=jc>Fermer</button>`);
    d.querySelector('#jc').onclick = () => d.close();
}

// --- FIN DE LA TRANCHE 6. La tranche suivante commencera par : async function receipt(p, sid) { ---
const receiptUrl = p => location.origin + location.pathname.replace(/[^/]*$/, '') + 'verif.html?id=' + p.id + '&k=' + (p.fee_id ? 'f' : 'p');
async function receipt(p, sid) {
    const s = S.stu.find(x => x.id === sid), c = S.classes.find(x => x.id === s.class_id);
    const QH = p.receipt_no ? 190 : 0; // place du QR code de vérification (reçus numérotés)
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 900 + QH; const x = cv.getContext('2d');
    x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 640, 900 + QH); const gg = x.createLinearGradient(0, 0, 640, 900 + QH); gg.addColorStop(0, '#e9cf86'); gg.addColorStop(.5, '#b08a30'); gg.addColorStop(1, '#8a6a1f'); x.strokeStyle = gg; x.lineWidth = 4; x.strokeRect(14, 14, 612, 872 + QH); x.lineWidth = 1; x.strokeRect(24, 24, 592, 852 + QH);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'logo-light.png'; });
    if (im) x.drawImage(im, 225, 36, 190, 190);
    x.fillStyle = '#111211'; x.textAlign = 'center'; x.font = 'bold 28px Georgia,serif'; x.fillText(S.school.name, 320, 270);
    x.font = '20px Georgia,serif'; x.fillText(p.receipt_no ? 'REÇU DE PAIEMENT N° ' + rno(p) : 'REÇU PROVISOIRE', 320, 305);
    const L = [['Élève', s.name], ['Classe', c ? c.name : ''], [p.fee_id ? 'Frais : ' + (p.fee_name || '') : 'Montant payé', nf(p.amount) + ' ' + p.currency + (p.fee_id ? '' : ' (T' + (p.term || 1) + ')')], ['Mode', p.method === 'especes' ? 'Espèces' : 'Mobile Money']];
    if (p.reference) L.push(['Référence', p.reference]);
    L.push(['Date', new Date(p.created_at).toLocaleString('fr-FR')]);
    if (p.collector_id === S.me.id) L.push(['Perçu par', S.me.full_name]);
    if (p.fee_id) { const f = S.fees.find(z => z.id === p.fee_id); L.push(['Reste ' + (p.fee_name || 'frais'), f && feeRem(s, f) > 0 ? fmt(feeRemCdf(s, f)) : 'Soldé']); } else { const tt = trims(s)[(p.term || 1) - 1]; L.push(['Reste T' + (p.term || 1), tt && tt[1] > 0 ? fmt(tt[1]) : 'Soldé']); }
    L.push(['Solde actuel', s.balance_cdf > 0 ? fmt(s.balance_cdf) : 'Soldé']);
    x.fillStyle = gg; x.fillRect(220, 322, 200, 2);
    L.forEach((r, i) => {
        const y = 370 + i * 55; x.strokeStyle = '#ddd'; x.beginPath(); x.moveTo(40, y + 16); x.lineTo(600, y + 16); x.stroke();
        x.textAlign = 'left'; x.fillStyle = '#6b6a60'; x.font = '18px sans-serif'; x.fillText(r[0], 40, y);
        x.textAlign = 'right'; x.fillStyle = '#111211'; x.font = 'bold 20px sans-serif'; x.fillText(r[1], 600, y);
    });
    x.save(); x.translate(515, 125); x.rotate(-.2); x.globalAlpha = .85; x.strokeStyle = x.fillStyle = '#9a7a2c'; x.lineWidth = 3; x.font = 'bold 26px Georgia,serif'; x.textAlign = 'center'; const sw = x.measureText(p.receipt_no ? 'PAYÉ' : 'PROVISOIRE').width; x.strokeRect(-sw / 2 - 12, -28, sw + 24, 40); x.fillText(p.receipt_no ? 'PAYÉ' : 'PROVISOIRE', 0, 0); x.restore();
    if (QH) {
        // QR code : ouvre la page publique de vérification (verif.html) — contre les faux reçus
        try {
            const box = document.createElement('div');
            new QRCode(box, { text: receiptUrl(p), width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });
            const qc = box.querySelector('canvas'); if (qc) x.drawImage(qc, 250, 860, 140, 140);
            x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '15px sans-serif'; x.fillText('Scannez pour vérifier l’authenticité de ce reçu', 320, 1025);
        } catch (_) { }
    }
    x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '16px sans-serif'; x.fillText('Merci — ORÉA École', 320, 870 + (QH ? QH - 5 : 0));
    const nm = p.receipt_no ? rno(p) : 'provisoire-' + p.id.slice(0, 6), fn = 'recu-' + nm + '.png';
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), url = URL.createObjectURL(blob);
    const file = new File([blob], fn, { type: 'image/png' });
    const txt = 'Reçu ' + (p.receipt_no ? rno(p) : 'provisoire') + ' — ' + S.school.name + '\n' + s.name + ' : ' + nf(p.amount) + ' ' + p.currency;
    const can = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const d = show(`<h3>Reçu ${p.receipt_no ? rno(p) : 'provisoire'}</h3><div class=col><button id=rw>📤 Envoyer sur WhatsApp</button>${s.parent_phone ? '<button class=ghost id=rs>💬 Envoyer par SMS</button>' : ''}<a class="btn ghost" download="${fn}" href="${url}">Télécharger PNG</a><button class=ghost id=rc>Fermer</button></div><img src="${url}" alt="Reçu">`);
    d.querySelector('#rc').onclick = () => d.close();
    const rsb = d.querySelector('#rs'); if (rsb) rsb.onclick = () => openSms(s.parent_phone, txt);
    d.querySelector('#rw').onclick = async () => {
        if (can) { try { await navigator.share({ files: [file], text: txt }); } catch (e) { if (e.name !== 'AbortError') toast('Partage impossible.'); } }
        else { const a = document.createElement('a'); a.href = url; a.download = fn; a.click(); const u = waLink(s.parent_phone, txt); if (u) window.open(u, '_blank'); else toast('Image téléchargée.'); }
    };
}

/* ---------- Accueil (REFONTE GRAPHIQUE) ---------- */
const tdy = () => new Date().toLocaleDateString('sv-SE');
function previsionCard() {
    const t = getTermToShow();
    if (!S.curTermFilter && !hasTerms()) return '';
    const st = ys();
    const due = st.reduce((a, s) => a + Number(s['due' + t + '_cdf'] || 0), 0);
    const paid = st.reduce((a, s) => a + Number(s['p' + t + '_cdf'] || 0), 0);
    const rem = Math.max(0, due - paid);
    // Fin du trimestre = veille du début du trimestre suivant (ou fin de l'année scolaire)
    const tm = S.terms[S.year] || {}, nx = t < 3 ? tm['t' + (+t + 1)] : null;
    const end = window.FinP ? FinP.termRange(S.year, +t)[1] : nx;
    const dt = end ? new Date(Date.parse(end + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10) : null;
    const pct = due > 0 ? Math.max(0, Math.min(100, Math.round(100 * paid / due))) : 0;
    return `<div class="card col" style="padding:14px 16px"><div style="display:flex;align-items:center;gap:10px"><div class=menu-ic style="width:34px;height:34px;border-radius:9px">${svgI('graph')}</div><b style="font-family:var(--serif);font-size:15px">Prévision T${t}</b></div><small style="margin-top:8px">Encaissé ${fmt(paid)} / ${fmt(due)}</small><div class=tri-bar style="margin:6px 0"><i style="width:${pct}%"></i></div><small class=due>Reste à encaisser : ${fmt(rem)}</small><small>Fin du trimestre : ${dt ? fdate(dt) : '—'}</small></div>`;
}
async function vAccueil() {
    $('#main').innerHTML = SK;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); const R = fRole();
    const [pp, aa, rq, ml] = await Promise.all([
        R === 'enseignant' ? { data: [] } : todayPay(t0),
        db.from('attendance').select('status').eq('day', tdy()),
        R === 'directeur' ? db.from('change_requests').select('id').eq('status', 'en_attente') : { data: [] },
        R === 'directeur' ? db.from('messages_log').select('*').order('created_at', { ascending: false }).limit(5) : { data: [] }
    ]);
    const st = isCol() ? ys().filter(s => colOK(s.class_id)) : ys(), sm = k => st.reduce((a, s) => a + Number(s[k] || 0), 0), A = aa.data || [], cnt = k => A.filter(a => a.status === k).length;
    const tod = sum((pp.data || []).filter(p => R === 'directeur' || p.collector_id === S.me.id)) + qToday(), pend = (rq.data || []).length;
    const tt = getTermToShow(), tDue = sm('due' + tt + '_cdf'), tPaid = sm('p' + tt + '_cdf'), due = Math.max(0, tDue - tPaid);
    let h = termBar() + ybar() + `<h3>Bonjour ${esc(S.me.full_name)}</h3>`;
    if (isTeach()) h += `<div id=tday></div>`;

    if (S.events && S.events.length) {
        const ev = S.events[0];
        h += `<div class="menu-card"><div class=menu-ic>${svgI('calendrier')}</div><div class=menu-label>${esc(ev.title)}<small>Le ${fdate(ev.start_date)}</small></div></div>`;
    }

    const left = S.school.sub_until ? Math.ceil((new Date(S.school.sub_until) - Date.now()) / 864e5) : 99;
    if (R === 'directeur' && left > 3 && left <= 14) h += `<div class="card col"><b class=due>⚠ Abonnement : ${left} jours restants</b><small>Pense à renouveler.</small>${subWa(left) ? `<a class=btn href="${subWa(left)}" target=_blank rel=noopener>Contacter ORÉA</a>` : ''}</div>`;
    if (R === 'directeur') h += bkCard();
    if (pend) h += `<div class="menu-card" onclick="menuGo('caisse')"><div class=menu-ic>${svgI('alerte')}</div><div class=menu-label>Demandes à approuver<small>Corrections en attente</small></div><b class=due style="font-family:var(--serif);font-size:18px">${pend}</b><span class=menu-arrow>›</span></div>`;
    if (R !== 'enseignant') {
        if (!isCol()) h += lateCard();
        if (R === 'directeur') h += previsionCard();
        const pct = tDue > 0 ? Math.max(0, Math.min(100, Math.round(100 * tPaid / tDue))) : 0;
        h += `<div class="card hero"><small>Encaissé aujourd'hui ${R === 'directeur' ? '· école' : '· ma caisse'}</small><span class=big>${fmt(tod)}</span></div>`;
        if (isCol()) h += `<small style="display:block;margin:-4px 2px 8px">Chiffres ci-dessous : mes classes uniquement</small>`;
        h += `<div class="stat-pair"><div class="card stat"><span>Total encaissé · T${tt}</span><b>${fmt(tPaid)}</b></div><div class="card stat"><span>Reste à encaisser · T${tt}</span><b class="${due > 0 ? 'due' : ''}">${fmt(due)}</b></div></div>`;
        h += `<div class="card ring-card"><span>Taux de recouvrement · T${tt}</span><div class=ring style="--p:${pct}"><b>${pct} %</b></div></div>`;
        h += '<h3>Par trimestre</h3><div class=tri-list>';
        [1, 2, 3].forEach(i => {
            const paidI = sm('p' + i + '_cdf'), dueI = sm('due' + i + '_cdf');
            const pctI = dueI > 0 ? Math.max(0, Math.min(100, Math.round(100 * paidI / dueI))) : 0;
            h += `<div class="tri-card" ${i === tt ? 'style="border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)"' : ''}><div class=tri-badge>T${i}</div><div class=tri-info><div class=tri-labels><small>Encaissé</small><b>${fmt(paidI)} / ${fmt(dueI)}</b></div><div class=tri-bar><i style="width:${pctI}%"></i></div></div></div>`;
        });
        h += '</div>';
        if (!isCol()) h += classBars() + (R === 'directeur' ? '<div id=ch></div>' : '');
    }
    h += `<h3>Présences du jour</h3><div class=stat-pair><div class="card stat"><span>Présents · Absents · Retards</span><b>${cnt('present')} · ${cnt('absent')} · ${cnt('retard')}</b></div><div class="card stat"><span>Élèves inscrits</span><b>${st.length}</b></div></div>`;
    h += `<div class=row><button onclick="menuGo('presences')">Faire l’appel</button>${R === 'directeur' ? '<button class=ghost onclick=reminders()>Relance des parents</button>' : ''}</div>`;
    const ms = ml.data || [], K = { frais: 'Frais', absence: 'Absence', sanction: 'Sanction', libre: 'Message' };
    if (R === 'directeur') h += '<h3>Derniers messages</h3>' + (ms.length ? ms.map(m => { const s = st.find(x => x.id === m.student_id); return `<div class=menu-card style="cursor:default"><div class=menu-ic>${svgI('messages')}</div><div class=menu-label>${esc(s ? s.name : '')} · ${K[m.kind] || m.kind}<small>${new Date(m.created_at).toLocaleString('fr-FR')}</small></div></div>`; }).join('') : '<p class=empty>Aucun message envoyé.</p>');
    if (S.tab !== 'accueil') return;
    $('#main').innerHTML = h;
    if (R === 'directeur') monthChart();
}

/* ---------- Présences ---------- */
async function vPresences() {
    if (!yc().length) { $('#main').innerHTML = ybar() + `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><p class=empty>Crée d’abord une classe.</p>`; return; }
    if (!yc().some(c => c.id === S.cls)) S.cls = yc()[0].id;
    S.day = S.day || tdy();
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="attBack()">← ' + (S.attFromCls ? 'Classe' : 'Menu') + '</button></div>' + SK;
    const { data } = await db.from('attendance').select('student_id,status').eq('day', S.day);
    if (data) { S.att = Object.fromEntries(data.map(a => [a.student_id, a.status])); S.attDay = S.day; } else if (S.attDay !== S.day) S.att = {};
    qget().filter(x => x.k === 'att' && x.day === S.day).forEach(x => S.att[x.student_id] = x.status);
    if (S.tab !== 'presences') return;
    drawAtt();
}
function drawAtt() {
    const l = S.stu.filter(s => s.class_id === S.cls).sort(sorts.alpha), A = S.att || {};
    const n = k => l.filter(s => A[s.id] === k).length, un = l.filter(s => !A[s.id]).length, B = [['present', 'Présent'], ['absent', 'Absent'], ['retard', 'Retard']];
    let h = `<div class=bar><button class=ghost onclick="attBack()">← ${S.attFromCls ? 'Classe' : 'Menu'}</button></div>` + ybar() + `<div class=bar><select id=cs>${yc().map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><input id=dy type=date value="${S.day}" max="${tdy()}"></div><div class=card><small>Présents ${n('present')} · Absents ${n('absent')} · Retards ${n('retard')} · Non marqués ${un}</small></div>`;
    h += l.length ? (un ? '<button class=ghost onclick=allPresent()>Tout le monde présent</button>' : '') + l.map(s => `<div class="card col"><b>${esc(s.name)}</b><div class=row>${B.map(b => `<button class="${A[s.id] === b[0] ? '' : 'ghost'}" onclick="mark('${s.id}','${b[0]}')">${A[s.id] === b[0] ? '✓ ' : ''}${b[1]}</button>`).join('')}</div></div>`).join('') : '<p class=empty data-ic="🎓">Aucun élève.</p>';
    h += '<button class=ghost onclick=icsRappel()>Ajouter un rappel d’appel à l’agenda</button>';
    $('#main').innerHTML = h;
    $('#cs').onchange = e => { S.cls = e.target.value; drawAtt(); };
    $('#dy').onchange = e => { S.day = e.target.value || tdy(); vPresences(); };
}
async function mark(id, st) {
    const A = S.att = S.att || {}, old = A[id]; A[id] = st; drawAtt();
    const row = { school_id: S.school.id, student_id: id, day: S.day, status: st };
    if (!navigator.onLine) return qadd({ k: 'att', ...row });
    const { error } = await db.from('attendance').upsert(row, { onConflict: 'student_id,day' });
    if (isNet(error)) return qadd({ k: 'att', ...row });
    if (error) { A[id] = old; drawAtt(); toast(error.message); }
}
async function allPresent() {
    const A = S.att = S.att || {}, rows = S.stu.filter(s => s.class_id === S.cls && !A[s.id]).map(s => ({ school_id: S.school.id, student_id: s.id, day: S.day, status: 'present' }));
    if (!rows.length) return;
    const off = () => { rows.forEach(r => { A[r.student_id] = 'present'; qadd({ k: 'att', ...r }); }); drawAtt(); };
    if (!navigator.onLine) return off();
    const { error } = await db.from('attendance').upsert(rows, { onConflict: 'student_id,day' });
    if (isNet(error)) return off();
    if (error) return toast(error.message);
    rows.forEach(r => A[r.student_id] = 'present'); drawAtt();
}
function icsRappel() {
    const d = new Date(Date.now() + 864e5), p = n => String(n).padStart(2, '0'), ds = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OREA Ecole//FR', 'BEGIN:VEVENT', 'UID:appel-' + S.school.id + '@orea', 'DTSTAMP:' + stamp, 'DTSTART:' + ds + 'T073000', 'DTEND:' + ds + 'T080000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'SUMMARY:Faire l\'appel - OREA Ecole', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Faire l\'appel', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'rappel-appel.ics'; a.click();
}

/* ---------- Sanctions et équipe ---------- */
const WARN_KINDS = ['Avertissement oral', 'Avertissement écrit'];
const SANC_KINDS = ['Retenue', 'Exclusion temporaire', 'Travail d’intérêt', 'Autre'];
const SIG_KINDS = ['Signalement · comportement', 'Signalement · retard répété', 'Signalement · tenue', 'Signalement · autre'];
const isSig = k => /^signalement/i.test(String(k || ''));
const isWarn = k => /^avertissement/i.test(String(k || ''));
async function sanc(id) {
    const s = S.stu.find(x => x.id === id); if (!s) return;
    const D = dir();
    const [r1, r2] = await Promise.all([
        db.from('sanctions').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        db.from('sanction_requests').select('*').eq('student_id', id).order('created_at', { ascending: false })
    ]);
    if (r1.error) return toast(r1.error.message);
    const data = r1.data || [], req = r2.error ? [] : (r2.data || []);
    const pend = req.filter(r => r.status === 'en_attente'), mineDone = req.filter(r => r.status !== 'en_attente' && r.requested_by === S.me.id).slice(0, 5);
    const acks = await ackMap('sanction', data.map(x => x.id));
    const nW = data.filter(x => isWarn(x.kind)).length, nS = data.length - nW;
    const RS = { validee: ['Validé ✓', 'ok'], refusee: ['Refusé', 'due'], traitee: ['Pris en compte ✓', 'ok'], en_attente: ['En attente de la direction', ''] };
    let h = `<h3>Avertissements et sanctions — ${esc(s.name)}</h3>`;
    if (data.length) h += `<small>${nW} avertissement(s) · ${nS} sanction(s)${nW >= 3 ? ' · <b class=due>3 avertissements atteints</b>' : ''}</small>`;
    if (pend.length) h += `<p style="margin:10px 0 4px"><small>${D ? 'PROPOSITIONS À VALIDER' : 'EN ATTENTE DE LA DIRECTION'}</small></p>` + pend.map(r => `<div class="card col" style="border-left:3px dashed var(--gold)"><b>${esc(r.kind)}</b><small>${fdate(r.day)}${r.note ? ' · ' + esc(r.note) : ''}</small>${D ? `<div class=row><button data-ok=${r.id}>Valider</button><button class=ghost data-no=${r.id}>Refuser</button></div>` : ''}</div>`).join('');
    h += data.length ? data.map(x => `<div class="card col" style="border-left:3px solid ${isWarn(x.kind) ? 'var(--gold)' : 'var(--bad)'}"><b>${esc(x.kind)}</b><small>${fdate(x.day)}${x.note ? ' · ' + esc(x.note) : ''}</small>${acks[x.id] ? `<small class=ok>👁 Vu par le parent le ${new Date(acks[x.id]).toLocaleDateString('fr-FR')}</small>` : ''}${D ? `<button class=ghost data-x=${x.id}>Supprimer</button>` : ''}</div>`).join('') : (pend.length ? '' : '<p class=empty>Aucun avertissement ni sanction.</p>');
    if (mineDone.length) h += `<p style="margin:10px 0 4px"><small>MES DERNIÈRES PROPOSITIONS</small></p>` + mineDone.map(r => `<div class=card><span>${esc(r.kind)}<br><small>${fdate(r.day)}</small></span><small class="${(RS[r.status] || RS.en_attente)[1]}">${(RS[r.status] || RS.en_attente)[0]}</small></div>`).join('');
    h += `<div class=col><button id=sw>+ Avertissement</button><button class=ghost id=sa>+ Sanction</button>${D ? '' : '<button class=ghost id=sg>+ Signaler un comportement</button>'}<button class=ghost id=sc>Fermer</button></div>`;
    if (!D) h += `<small>Vos avertissements, sanctions et signalements sont envoyés à la direction. Les parents sont prévenus dès que la direction valide (un signalement reste interne).</small>`;
    const d = show(h);
    d.querySelector('#sc').onclick = () => d.close();
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer ?')) return; const { error } = await db.from('sanctions').delete().eq('id', b.dataset.x); error ? toast(error.message) : sanc(id); });
    d.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => { b.disabled = true; await decideReq(req.find(r => r.id === b.dataset.ok), true); sanc(id); });
    d.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => { b.disabled = true; await decideReq(req.find(r => r.id === b.dataset.no), false); sanc(id); });
    const add = (title, kinds) => ask(title + ' — ' + esc(s.name), [{ n: 'kind', l: 'Type', o: kinds.map(k => [k, k]) }, { n: 'day', l: 'Date', t: 'date', v: tdy() }, { n: 'note', l: 'Motif / détail', r: kinds === SIG_KINDS }], async v => {
        const row = { school_id: S.school.id, student_id: id, kind: v.kind, day: v.day, note: v.note.trim() || null };
        if (D) { const { error } = await db.from('sanctions').insert(row); if (error) throw error; toast(isWarn(v.kind) ? 'Avertissement enregistré · parents prévenus' : 'Sanction enregistrée · parents prévenus'); }
        else { const { error } = await db.from('sanction_requests').insert(Object.assign(row, { requested_by: S.me.id, status: 'en_attente' })); if (error) throw error; toast('Envoyé à la direction pour validation'); }
        sanc(id);
    });
    d.querySelector('#sw').onclick = () => add('Nouvel avertissement', WARN_KINDS);
    d.querySelector('#sa').onclick = () => add('Nouvelle sanction', SANC_KINDS);
    const sg = d.querySelector('#sg'); if (sg) sg.onclick = () => add('Signaler un comportement', SIG_KINDS);
}
// Décision du directeur sur une proposition (avertissement / sanction -> enregistrée et parents prévenus ; signalement -> interne)
async function decideReq(r, ok) {
    if (!r) return;
    if (secr()) return toast('Les décisions de sanction sont réservées à la direction pédagogique.');
    let note = null;
    if (!ok) { note = prompt('Motif du refus (facultatif) :') || null; }
    if (ok && !isSig(r.kind)) {
        const { error } = await db.from('sanctions').insert({ school_id: r.school_id, student_id: r.student_id, kind: r.kind, day: r.day, note: r.note, by_id: r.requested_by });
        if (error) return toast(error.message);
    }
    const { error } = await db.from('sanction_requests').update({ status: ok ? (isSig(r.kind) ? 'traitee' : 'validee') : 'refusee', decided_by: S.me.id, decided_at: new Date().toISOString(), decision_note: note }).eq('id', r.id);
    if (error) return toast(error.message);
    toast(ok ? (isSig(r.kind) ? 'Signalement pris en compte' : 'Validé · parents prévenus') : 'Proposition refusée');
}
// Accusés de lecture des parents : { id: date }
async function ackMap(type, ids) {
    if (!ids.length) return {};
    const { data, error } = await db.from('parent_acks').select('item_id,seen_at').eq('item_type', type).in('item_id', ids);
    const m = {}; if (error) return m;
    (data || []).forEach(a => { if (!m[a.item_id] || a.seen_at < m[a.item_id]) m[a.item_id] = a.seen_at; });
    m.__n = {}; (data || []).forEach(a => { m.__n[a.item_id] = (m.__n[a.item_id] || 0) + 1; });
    return m;
}
async function team() {
    const { data, error } = await db.from('profiles').select('*').order('full_name');
    if (error) return toast(error.message);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    const [{ data: pays }, { data: clos }] = await Promise.all([db.from('payments').select('collector_id,amount_cdf,created_at').gte('created_at', m0.toISOString()), db.from('closures').select('collector_id,declared_cash,expected_cash').gte('day', m0.toISOString().split('T')[0])]);
    const stats = {};
    data.filter(p => p.id !== S.me.id).forEach(p => stats[p.id] = { today: 0, month: 0, ecarts: 0, last: p.last_seen });
    (pays || []).forEach(p => { if (!stats[p.collector_id]) return; const d = new Date(p.created_at); stats[p.collector_id].month += Number(p.amount_cdf); if (d >= t0) stats[p.collector_id].today += Number(p.amount_cdf); });
    (clos || []).forEach(c => { if (!stats[c.collector_id]) return; if (Math.abs(c.declared_cash - c.expected_cash) > 0.5) stats[c.collector_id].ecarts++; });
    const RL = { directeur: 'Directeur', percepteur: 'Percepteur', enseignant: 'Enseignant' }, l = data.filter(p => p.id !== S.me.id);
    const d = show(`<h3>Équipe & Performance</h3>${l.length ? l.map(p => {
        const st = stats[p.id];
        const last = st.last ? new Date(st.last).toLocaleDateString('fr-FR') : 'Jamais';
        return `<div class="card col"><b>${esc(p.full_name)}</b><span class="${p.active === false ? 'due' : ''}">${RL[p.role]}${p.active === false ? ' · désactivé' : ''}</span>${p.role === 'percepteur' ? `<small>Encaissé : Aujourd'hui ${fmt(st.today)} · Ce mois ${fmt(st.month)}</small><small class="${st.ecarts > 0 ? 'due' : 'ok'}">Écarts de caisse : ${st.ecarts}</small>` : ''}<small>Dernière connexion : ${last}</small><div class=row>${p.role === 'directeur' ? '' : `<button class=ghost data-r=${p.id}>→ ${p.role === 'percepteur' ? 'Enseignant' : 'Percepteur'}</button>`}<button class=ghost data-a=${p.id}>${p.active === false ? 'Réactiver' : 'Désactiver'}</button></div></div>`;
    }).join('') : '<p class=empty>Personne d’autre.</p>'}<small>Code d’invitation : <b>${esc(S.school.code)}</b></small><button class=ghost id=tc>Fermer</button>`);
    const up = async (id, patch) => { const { data: x, error } = await db.from('profiles').update(patch).eq('id', id).select(); if (error || !x.length) return toast(error ? error.message : 'Refusé'); team(); };
    d.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const p = data.find(x => x.id === b.dataset.r); up(p.id, { role: p.role === 'percepteur' ? 'enseignant' : 'percepteur' }); });
    d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const p = data.find(x => x.id === b.dataset.a); up(p.id, { active: p.active === false }); });
    d.querySelector('#tc').onclick = () => d.close();
}

// --- FIN DE LA TRANCHE 7. La tranche suivante commencera par : /* ---------- Caisse ---------- */ ---
/* ---------- Caisse ---------- */
async function vCaisse() {
    if (!canCollect()) { $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div><p class=empty data-ic="🔒">Accès réservé au percepteur ou au chef d’établissement</p>'; return; }
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const { data: ps0, error: pe0 } = await todayFull(t0);
    if (pe0 || !ps0) { $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div><p class=empty>La caisse demande une connexion.</p>'; return; }
    const mine = ps0.filter(p => p.collector_id === S.me.id);
    const ps = fin() ? ps0 : mine;
    const tot = a => [sum(a.filter(p => p.method === 'especes')), sum(a.filter(p => p.method === 'mobile_money'))];
    const [c, m] = tot(fin() ? ps : mine);
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Aujourd’hui ${fin() ? '(toute l’école)' : '(ma caisse)'}</h3><div class=card><span>Espèces</span><b>${fmt(c)}</b></div><div class=card><span>Mobile Money</span><b>${fmt(m)}</b></div><div class=card><span>Paiements</span><b>${(fin() ? ps : mine).length}</b></div>`;
    if (isCol()) h += '<button onclick=closeDay()>Clôturer ma journée</button>';
    let { data: cl } = await db.from('closures').select('*').order('created_at', { ascending: false }).limit(30);
    cl = cl || [];
    if (!fin()) cl = cl.filter(k => k.collector_id === S.me.id);
    const { data: pr0 } = await db.from('profiles').select('id,full_name');
    const nm = Object.fromEntries((pr0 || []).map(p => [p.id, p.full_name]));
    let { data: rq } = await db.from('change_requests').select('*').order('created_at', { ascending: false }).limit(20);
    rq = rq || [];
    if (!fin()) rq = rq.filter(r => r.requested_by === S.me.id);
    const st = { en_attente: '⏳ En attente', approuvee: '✓ Approuvée', refusee: '✗ Refusée' };
    const isSig = r => /^Signalement parent/.test(r.reason || ''), reqLabel = r => isSig(r) ? 'Signalement d’un parent (aucune modification demandée)' : /^delete/.test(r.kind || '') ? 'Suppression' : 'Correction → ' + nf(r.new_amount || 0) + (r.new_term ? ' · T' + r.new_term : '');
    const reqHtml = rq.length ? '<h3>Demandes de correction</h3>' + rq.map(r => `<div class="card col"><b>${esc(r.info || 'Paiement')}</b><span>${reqLabel(r)}${nm[r.requested_by] ? ' · ' + esc(nm[r.requested_by]) : ''}</span><small>${st[r.status] || ''}${r.reason ? ' · ' + esc(r.reason) : ''}</small>${fin() && r.status === 'en_attente' ? `<div class=row>${isSig(r) ? '' : `<button onclick="decide('${r.id}',true)">Approuver</button>`}<button class=ghost onclick="decide('${r.id}',false)">${isSig(r) ? 'Classer' : 'Refuser'}</button></div>` : ''}</div>`).join('') : '';
    h += reqHtml + '<h3>Clôtures</h3>' + (cl.length ? cl.map(k => {
        const e = k.declared_cash - k.expected_cash, bad = Math.abs(e) > 0.5;
        return `<div class="card col"><b>${k.day} · ${esc(nm[k.collector_id] || '')}</b><span>Attendu ${fmt(k.expected_cash)} · Compté ${fmt(k.declared_cash)}</span><span class="${bad ? 'due' : 'ok'}">${bad ? '⚠ Écart : ' + fmt(e) : '✓ Aucun écart'}</span><small>${k.status === 'controlee' ? 'Contrôlée' : 'À contrôler'}${k.note ? ' · ' + esc(k.note) : ''}</small>${fin() && k.status === 'enregistree' ? `<button class=ghost onclick="ctl('${k.id}')">Marquer comme contrôlée</button>` : ''}</div>`;
    }).join('') : '<p class=empty data-ic="💰">Aucune clôture.</p>');
    if (S.tab !== 'caisse') return;
    $('#main').innerHTML = h;
}
function closeDay() {
    ask('Clôture de caisse', [{ n: 'cash', l: 'Espèces comptées (en ' + S.cur + ')', t: 'number' }, { n: 'note', l: 'Remarque', r: false }], async v => {
        const t0 = new Date(); t0.setHours(0, 0, 0, 0);
        const { data: ps } = await todayFull(t0); if (!ps) throw Error('Connexion requise');
        const mine = ps.filter(p => p.collector_id === S.me.id);
        const { error } = await db.from('closures').insert({ day: new Date().toLocaleDateString('sv-SE'), expected_cash: sum(mine.filter(p => p.method === 'especes')), declared_cash: +v.cash * S.school.rates[S.cur], mobile_total: sum(mine.filter(p => p.method === 'mobile_money')), note: v.note.trim() || null });
        if (error) throw error.code === '23505' ? Error('Déjà clôturée') : error;
        toast('Clôture enregistrée.'); render();
    });
}
async function ctl(id) {
    const { error } = await db.from('closures').update({ status: 'controlee', reviewed_by: S.me.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    error ? toast(error.message) : render();
}

/* ---------- Réglages ---------- */
function vReglages() {
    const sc = S.school;
    let h = `<div class=card><span>Devise d’affichage</span><select id=cu style=width:auto;margin:0>${CUR.map(c => `<option ${c === S.cur ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class=card><span>Thème</span><button class=ghost style=width:auto id=th>Clair / Sombre</button></div>` + installCard();
    if (fin()) h += `<div class="card col"><b>Taux de change (1 unité en FC)</b><label>USD<input id=r1 type=number step=any value="${sc.rates.USD}"></label><label>EUR<input id=r2 type=number step=any value="${sc.rates.EUR}"></label><label><input id=au type=checkbox style=width:auto ${sc.auto_rates ? 'checked' : ''}> Mise à jour automatique</label><button id=sr>Enregistrer les taux</button><small>Code d’invitation : <b>${esc(sc.code)}</b></small></div>`;
    if (fin()) h += `<div class="card col"><b>Frais par trimestre</b>${yc().length ? yc().map(c => `<button class=ghost onclick="editFees('${c.id}')">${esc(c.name)} · T1: ${nf(c.fee_t1 || 0)} / T2: ${nf(c.fee_t2 || 0)} / T3: ${nf(c.fee_t3 || 0)} ${c.fee_currency}</button>`).join('') : '<small>Aucune classe.</small>'}<small>Touche une classe pour modifier T1, T2 et T3.</small></div>`;
    if (dir()) {
        const yf = S.fees.filter(f => cy(f) === S.year && !f.student_id), tm = S.terms[S.year] || {};
        if (fin()) h += `<div class="card col"><b>Autres frais · ${esc(S.year || '—')}</b>${yf.length ? yf.map(f => `<button class=ghost onclick="editFee('${f.id}')">${esc(f.name)} · ${nf(f.amount)} ${f.currency} · ${f.class_id ? esc((S.classes.find(c => c.id === f.class_id) || {}).name || '') : 'Toutes'}</button>`).join('') : '<small>Aucun frais supplémentaire.</small>'}<button class=ghost onclick=addFee()>+ Frais (inscription, uniforme…)</button></div>`;
        h += `<div class="card col"><b>Dates des trimestres</b><small>${hasTerms() ? 'T1 dès le ' + fdate(tm.t1) + ' · T2 dès le ' + fdate(tm.t2) + ' · T3 dès le ' + fdate(tm.t3) : 'Non réglées : le statut « en retard » est désactivé.'}</small><button class=ghost onclick=setTerms()>Régler les dates · ${esc(S.year || '—')}</button></div>`;
        if (fin()) h += `<div class="card col"><b>Modèles de messages</b><small>Personnalise les messages WhatsApp (frais).</small><button class=ghost onclick=editTemplates()>✏️ Modifier les modèles</button></div>`;
    }
    h += headChangeCard();
    h += supportCard();
    h += `<details><summary>Guide rapide</summary><p><b>Encaisser</b> : École → ouvre la classe → touche l’élève → Encaisser.<br><b>Reçu</b> : Élève → Historique et reçus → Envoyer le reçu.<br><b>Clôture</b> : Menu → Caisse → Clôturer.<br><b>Sans réseau</b> : tu peux encaisser et faire l’appel.<br><b>Correction</b> : Élève → Historique et reçus → Corriger.</p></details><button class=ghost id=lo>Déconnexion</button><div class=card><span>Code PIN de l’app</span><button class=ghost style=width:auto id=pinb>${pinGet() ? 'Modifier / retirer' : 'Activer'}</button></div><p style="text-align:center;margin:18px 0 6px"><a href="#" id=delacc style="font-size:11px;color:var(--mut)">Supprimer mon compte</a></p>`;
    $('#main').innerHTML = h;
    $('#lo').onclick = out;
    $('#delacc').onclick = e => { e.preventDefault(); deleteAccount(); };
    $('#pinb').onclick = pinSetup;
    $('#cu').onchange = e => { S.cur = e.target.value; localStorage.cur = S.cur; toast('Devise : ' + S.cur); };
    $('#th').onclick = () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = localStorage.theme = t; };
    if (fin()) $('#sr').onclick = async () => {
        const usd = +$('#r1').value, eur = +$('#r2').value;
        if (!(usd > 0) || !(eur > 0)) return toast('Les taux doivent être supérieurs à 0.');
        const rates = { CDF: 1, USD: usd, EUR: eur };
        const { data, error } = await db.from('schools').update({ rates, auto_rates: $('#au').checked, rates_at: new Date().toISOString() }).eq('id', sc.id).select().single();
        if (error) return toast(error.message); S.school = data; await load(); toast('Taux enregistrés');
    };
}
function editTemplates() {
    const t = S.school.message_templates || {};
    let cu = (t.custom || []).map(c => ({ ...c })), fr = t.frais || feeMsg({ name: '{eleve}', class_id: '', balance_cdf: 0 });
    const draw = () => {
        const d = show(`<h3>Modèles de messages</h3><small>Variables : <b>{eleve}</b>, <b>{classe}</b>, <b>{reste}</b>, <b>{ecole}</b></small><div class=col><label>Relance des frais<textarea id=tf0 rows=4 style="width:100%">${esc(fr)}</textarea></label>${cu.map((c, i) => `<div class=card style="display:block"><label>Nom<input data-n=${i} value="${esc(c.name)}"></label><label>Message<textarea data-t=${i} rows=3 style="width:100%">${esc(c.text)}</textarea></label><button type=button class=ghost data-x=${i}>🗑 Supprimer</button></div>`).join('')}<button type=button class=ghost id=ta>+ Ajouter un modèle</button><div class=row><button class=ghost id=tc>Annuler</button><button id=ts>Enregistrer</button></div></div>`);
        const grab = () => { fr = d.querySelector('#tf0').value; d.querySelectorAll('[data-n]').forEach(x => cu[+x.dataset.n].name = x.value); d.querySelectorAll('[data-t]').forEach(x => cu[+x.dataset.t].text = x.value); };
        d.querySelector('#ta').onclick = () => { grab(); cu.push({ id: Date.now().toString(36), name: 'Nouveau modèle', text: 'Bonjour, ici {ecole}. ' }); draw(); };
        d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { grab(); cu.splice(+b.dataset.x, 1); draw(); });
        d.querySelector('#tc').onclick = () => d.close();
        d.querySelector('#ts').onclick = async () => {
            grab();
            const nt = { ...t, frais: fr.trim(), custom: cu.filter(c => c.name.trim() && c.text.trim()).map(c => ({ id: c.id, name: c.name.trim(), text: c.text.trim() })) };
            const { error } = await db.from('schools').update({ message_templates: nt }).eq('id', S.school.id);
            if (error) return toast(error.message);
            S.school.message_templates = nt; d.close(); toast('Modèles mis à jour');
        };
    };
    draw();
}

/* ---------- Recherche globale ---------- */
function openSearch() {
    let m = $('#searchModal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'searchModal';
        m.innerHTML = `<header><input type="search" id="globalSearch" placeholder="Rechercher un élève, une classe, REC-0042..." oninput="doGlobalSearch(this.value)"><button class="ghost" style="width:auto;margin-top:10px" onclick="closeSearch()">Fermer</button></header><div class="res" id="searchRes"></div>`;
        document.body.appendChild(m);
    }
    m.hidden = false;
    $('#globalSearch').value = '';
    $('#searchRes').innerHTML = '';
    setTimeout(() => $('#globalSearch').focus(), 100);
}
function closeSearch() { const m = $('#searchModal'); if (m) m.hidden = true; }
let searchSeq = 0;
async function doGlobalSearch(q) {
    const seq = ++searchSeq;
    q = nrm(q).trim();
    const res = $('#searchRes');
    if (!q) { res.innerHTML = ''; return; }
    let h = '';
    const stu = S.stu.filter(s => nrm(s.name).includes(q));
    if (stu.length) {
        h += '<h3>👤 Élèves</h3>' + stu.slice(0, 10).map(s => {
            const cname = (S.classes.find(c => c.id === s.class_id) || {}).name || '';
            return `<div class="card" onclick="closeSearch();menu('${s.id}')"><span>${esc(s.name)}<br><small>${esc(cname)}</small></span>${money() ? `<b class="${s.balance_cdf > 0 ? 'due' : 'ok'}">${fmt(s.balance_cdf)}</b>` : ''}</div>`;
        }).join('');
    }
    const cls = S.classes.filter(c => nrm(c.name).includes(q));
    if (cls.length) {
        h += '<h3>🏫 Classes</h3>' + cls.map(c => `<div class="card" onclick="closeSearch();openClass('${c.id}')"><span>${esc(c.name)}</span><small>${cy(c)}</small></div>`).join('');
    }
    const isRec = q.startsWith('rec') || /^\d+$/.test(q);
    res.innerHTML = h || '<p class=empty>' + (isRec ? 'Recherche…' : 'Aucun résultat.') + '</p>';
    if (isRec) {
        const num = q.replace('rec-', '').replace('rec', '');
        const rno = parseInt(num, 10);
        if (!isNaN(rno)) {
            const [{ data: p }, { data: f }] = await Promise.all([
                db.from('payments').select('*, students(name)').eq('receipt_no', rno).limit(1),
                db.from('fee_payments').select('*, students(name)').eq('receipt_no', rno).limit(1)
            ]);
            if (seq !== searchSeq) return;
            const found = (p && p.length ? p[0] : (f && f.length ? f[0] : null));
            if (!found && !h) res.innerHTML = '<p class=empty>Aucun résultat.</p>';
            if (found) {
                h += '<h3>🧾 Reçu trouvé</h3>' + `<div class="card" onclick="closeSearch();hist('${found.student_id}')"><span>REC-${String(found.receipt_no).padStart(4, '0')}<br><small>${esc(found.students ? found.students.name : '')}</small></span><b>${nf(found.amount)} ${found.currency}</b></div>`;
                res.innerHTML = h;
            }
        }
    }
}

// --- FIN DE LA TRANCHE 8. La tranche suivante (et dernière) commencera par : /* ---------- Bannière, sauvegarde, exports ---------- */ ---
/* ---------- Bannière, sauvegarde, exports ---------- */
document.querySelector('header').insertAdjacentHTML('afterend', '<div id=exb hidden></div>');
(function () {
    if (sessionStorage.orea_sp || matchMedia('(prefers-reduced-motion: reduce)').matches) return; sessionStorage.orea_sp = 1;
    document.body.insertAdjacentHTML('beforeend', '<div id=sp><div><img class=ld src=logo-dark.png alt=""><img class=ll src=logo-light.png alt=""><i></i></div></div>');
    setTimeout(() => { const e = $('#sp'); if (e) { e.classList.add('out'); setTimeout(() => e.remove(), 500); } }, 1300);
})();
const subLeft = () => S.school && S.school.sub_until ? Math.ceil((new Date(S.school.sub_until) - Date.now()) / 864e5) : 99;
const subWa = n => ADMIN_WA ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent('Bonjour ORÉA, je souhaite renouveler l’abonnement de ' + S.school.name + (n > 0 ? ' (il reste ' + n + ' jour' + (n > 1 ? 's' : '') + ').' : ' (abonnement expiré).'))}` : '';
// v88 : bandeau du haut selon l'état de l'abonnement
//  - 3 jours avant la fin : chef(s) d'établissement
//  - expiré (7 jours de grâce) puis lecture seule : TOUTE l'équipe, en rouge
function subBanner() {
    const b = $('#exb');
    if (!b) return;
    if (!S.me || !S.school || !S.school.sub_until) { b.hidden = true; return; }
    const ph = subPhase(), n = subLeft(), head = S.me.role === 'directeur';
    const end = new Date(S.school.sub_until), ro = new Date(end.getTime() + GRACE_J * 864e5);
    const fd = d => d.toLocaleDateString('fr-FR');
    const warn = 'Sans renouvellement, ORÉA pourrait cesser de fonctionner.';
    const renew = head && subWa(n) ? `<a href="${subWa(n)}" target=_blank rel=noopener>Renouveler</a>` : '';
    let h = '', cls = '';
    if (ph === 'actif' && n <= 3 && head) { h = `<span>⏳ Abonnement : il reste <b>${n} jour${n > 1 ? 's' : ''}</b> (fin le ${fd(end)}). Pensez à renouveler.</span>`; cls = 'warn'; }
    else if (ph === 'grace') { const k = Math.max(1, Math.ceil((ro - Date.now()) / 864e5)); h = `<span>⛔ <b>Abonnement expiré</b> le ${fd(end)}. Tout fonctionne encore <b>${k} jour${k > 1 ? 's' : ''}</b>, puis lecture seule le ${fd(ro)}. ${warn}</span>`; }
    else if (ph === 'lecture') h = `<span>🔒 <b>Lecture seule</b> depuis le ${fd(ro)} : consultation et encaissement uniquement. ${warn}</span>`;
    if (!h) { b.hidden = true; return; }
    b.className = cls; b.innerHTML = h + renew; b.hidden = false;
}
// v88 : signaler à ORÉA que le chef d'établissement a changé
function headChangeCard() {
    return `<div class="card col"><b>Changement de chef d’établissement</b><small>Le préfet ou le directeur a changé ? Signalez-le à ORÉA, qui nommera le nouveau chef dans l’équipe.</small><button class=ghost onclick=reportHeadChange()>Signaler à ORÉA</button></div>`;
}
function reportHeadChange() {
    ask('Changement de chef d’établissement', [{ n: 'note', l: 'Nom du nouveau chef et remarque (facultatif)', t: 'textarea', v: '', r: false }], async v => {
        const { error } = await db.rpc('v88_report_head_change', { p_note: (v.note || '').trim() || null });
        if (error) return toast(error.message);
        toast('Signalement envoyé à ORÉA ✓');
    });
}
const bkAge = () => { const t = +localStorage['orea_bk_' + S.school.id] || 0; return t ? Math.floor((Date.now() - t) / 864e5) : null; };
function bkCard() {
    const a = bkAge();
    const is1st = new Date().getDate() === 1;
    if (a !== null && a < 30 && !is1st) return '';
    return `<div class="card col"><b class=due>💾 Sauvegarde ${is1st ? 'du mois' : 'conseillée'}</b><small>${a === null ? 'Aucune sauvegarde faite.' : 'Dernière sauvegarde il y a ' + a + ' jours.'}</small><button class=ghost onclick="exRun(event.target,backupAll)">Sauvegarder maintenant</button></div>`;
}
const dl = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); };
const fnm = (k, e) => k + '-' + S.school.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '-' + tdy() + '.' + e;
const csvCell = v => { if (typeof v === 'number') return String(v).replace('.', ','); v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[;\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const toCsv = (h, r) => '\ufeff' + [h, ...r].map(x => x.map(csvCell).join(';')).join('\r\n');
const WIN = { '€': 128, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151, 'œ': 156, 'Œ': 140 };
const wenc = s => String(s ?? '').replace(/[\u202f\u00a0\u2009]/g, ' ').replace(/[\s\S]/g, c => { const k = c.charCodeAt(0); return WIN[c] ? String.fromCharCode(WIN[c]) : k < 32 ? ' ' : k < 256 ? c : '?'; }).replace(/[\\()]/g, '\\$&');
function mkPdf(o) {
    const W = 842, H = 595, M = 28, LH = 13, FS = 8, tw = o.w.reduce((a, b) => a + b, 0), cw = o.w.map(x => x * (W - 2 * M) / tw), rt = o.r || [];
    const tx = v => typeof v === 'number' ? nf(v, v % 1 ? 2 : 0) : String(v ?? ''), wd = s => [...s].reduce((t, c) => t + (c >= '0' && c <= '9' ? 4.45 : ' ,.'.includes(c) ? 2.3 : 4.6), 0);
    const items = o.rows.map(c => ({ c })).concat(o.tot ? [{ c: o.tot, b: 1 }] : []);
    const first = Math.floor((H - 2 * M - 48 - 2 * LH) / LH), other = Math.floor((H - 2 * M - 2 * LH) / LH), pages = [];
    let i = 0; do { const n = pages.length ? other : first; pages.push(items.slice(i, i + n)); i += n; } while (i < items.length);
    const out = []; let off = 0; const put = s => { out.push(s); off += s.length; }; const xr = [];
    const obj = (n, b) => { xr[n] = off; put(n + ' 0 obj\n' + b + '\nendobj\n'); };
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = pages.map((_, k) => 5 + 2 * k);
    obj(2, '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const T = (f, x, y, s) => `BT /${f} ${FS} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${wenc(s)}) Tj ET\n`;
    pages.forEach((pg, k) => {
        let s = '', y = H - M, x;
        if (!k) { s += `0.60 0.48 0.17 rg BT /F2 16 Tf ${M} ${y - 14} Td (${wenc(o.title)}) Tj ET\n0.4 g BT /F1 9 Tf ${M} ${y - 30} Td (${wenc(o.sub)}) Tj ET\n`; y -= 48; }
        y -= 10;
        s += `0.847 0.718 0.416 rg ${M} ${y - 3} ${W - 2 * M} ${LH} re f\n0.07 g\n`;
        x = M; o.head.forEach((h, j) => { s += T('F2', rt.includes(j) ? x + cw[j] - 3 - wd(h) : x + 3, y, h); x += cw[j]; });
        y -= LH;
        pg.forEach((it, r) => {
            if (r % 2 && !it.b) s += `0.97 0.95 0.90 rg ${M} ${y - 3} ${W - 2 * M} ${LH} re f\n`;
            if (it.b) s += `0.847 0.718 0.416 rg ${M} ${y + LH - 3} ${W - 2 * M} 0.8 re f\n`;
            s += '0.07 g\n'; x = M;
            it.c.forEach((v, j) => { let t = tx(v); const m = Math.floor((cw[j] - 6) / 4.3); if (t.length > m) t = t.slice(0, Math.max(1, m - 1)) + '…'; s += T(it.b ? 'F2' : 'F1', rt.includes(j) ? x + cw[j] - 3 - wd(t) : x + 3, y, t); x += cw[j]; });
            y -= LH;
        });
        s += `0.5 g BT /F1 7 Tf ${M} 16 Td (${wenc('ORÉA École · page ' + (k + 1) + '/' + pages.length)}) Tj ET\n`;
        obj(5 + 2 * k, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * k} 0 R >>`);
        obj(6 + 2 * k, `<< /Length ${s.length} >>\nstream\n${s}endstream`);
    });
    const n = 5 + 2 * pages.length, xo = off;
    put('xref\n0 ' + n + '\n0000000000 65535 f \n');
    for (let k = 1; k < n; k++) put(String(xr[k]).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xo}\n%%EOF`);
    const str = out.join(''), u = new Uint8Array(str.length); for (let k = 0; k < str.length; k++) u[k] = str.charCodeAt(k) & 255;
    return u;
}
async function ex(n) { const r = await pageAll(() => db.from(n).select('*')); if (r.error) throw new Error(r.error.message); return r.data; }
const cnm = id => (S.classes.find(c => c.id === id) || {}).name || '';
const stamp = () => 'Année ' + (S.year || '—') + ' · édité le ' + new Date().toLocaleDateString('fr-FR');
function exStu() {
    const l = ys().slice().sort(sorts.alpha), du = s => Number(s.due1_cdf || 0) + Number(s.due2_cdf || 0) + Number(s.due3_cdf || 0) + Number(s.fee_exp_cdf || 0);
    const rows = l.map(s => [s.name, cnm(s.class_id), s.parent_phone || '', Math.round(du(s)), Math.round(Number(s.paid_cdf || 0)), Math.round(Number(s.balance_cdf || 0))]);
    const a = k => rows.reduce((t, r) => t + r[k], 0);
    return { name: 'eleves', title: 'Élèves et soldes — ' + S.school.name, sub: stamp() + ' · ' + rows.length + ' élèves · montants en FC', head: ['Élève', 'Classe', 'Téléphone parent', 'Total dû (FC)', 'Payé (FC)', 'Reste (FC)'], rows, w: [34, 16, 20, 13, 13, 13], r: [3, 4, 5], tot: ['Total', '', '', a(3), a(4), a(5)] };
}
async function exPay() {
    const [p, f, pr] = await Promise.all([ex('payments'), ex('fee_payments'), db.from('profiles').select('id,full_name')]);
    const pn = Object.fromEntries((pr.data || []).map(x => [x.id, x.full_name])), ids = new Map(ys().map(s => [s.id, s]));
    const l = p.concat(f).filter(x => ids.has(x.student_id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const rows = l.map(x => [new Date(x.created_at).toLocaleString('fr-FR'), x.receipt_no ? rno(x) : '', ids.get(x.student_id).name, cnm(ids.get(x.student_id).class_id), x.fee_id ? (x.fee_name || 'Frais') : 'Scolarité T' + (x.term || 1), Number(x.amount), x.currency, Math.round(Number(x.amount_cdf || 0)), x.method === 'especes' ? 'Espèces' : 'Mobile Money', x.reference || '', pn[x.collector_id] || '']);
    return { name: 'paiements', title: 'Paiements — ' + S.school.name, sub: stamp() + ' · ' + rows.length + ' paiements', head: ['Date', 'Reçu', 'Élève', 'Classe', 'Objet', 'Montant', 'Devise', 'Montant (FC)', 'Mode', 'Référence', 'Perçu par'], rows, w: [22, 10, 26, 13, 19, 12, 8, 14, 14, 14, 20], r: [5, 7], tot: ['Total encaissé', '', '', '', '', '', '', rows.reduce((t, r) => t + r[7], 0), '', '', ''] };
}
async function exClo() {
    const [c, pr] = await Promise.all([ex('closures'), db.from('profiles').select('id,full_name')]);
    const pn = Object.fromEntries((pr.data || []).map(x => [x.id, x.full_name]));
    const rows = c.sort((a, b) => String(b.day).localeCompare(String(a.day))).map(k => [k.day, pn[k.collector_id] || '', Math.round(Number(k.expected_cash)), Math.round(Number(k.declared_cash)), Math.round(Number(k.declared_cash) - Number(k.expected_cash)), Math.round(Number(k.mobile_total || 0)), k.status === 'controlee' ? 'Contrôlée' : 'À contrôler', k.note || '']);
    const a = j => rows.reduce((t, r) => t + r[j], 0);
    return { name: 'caisse', title: 'Clôtures de caisse — ' + S.school.name, sub: 'Édité le ' + new Date().toLocaleDateString('fr-FR') + ' · ' + rows.length + ' clôtures', head: ['Jour', 'Percepteur', 'Attendu', 'Compté', 'Écart', 'Mobile Money', 'Statut', 'Remarque'], rows, w: [14, 26, 14, 14, 14, 15, 14, 30], r: [2, 3, 4, 5], tot: ['Total', '', a(2), a(3), a(4), a(5), '', ''] };
}
async function exportDo(k, f) {
    const r = await ({ stu: exStu, pay: exPay, clo: exClo }[k])();
    if (f === 'png') return pngOut(r);
    if (f === 'csv') dl(new Blob([toCsv(r.head, r.rows)], { type: 'text/csv;charset=utf-8' }), fnm(r.name, 'csv'));
    else dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf'));
    toast('Fichier enregistré dans Téléchargements');
}
async function exRun(b, fn) { const t = b.textContent; b.disabled = true; b.textContent = 'Préparation…'; try { await fn(); } catch (e) { toast(e.message || 'Export impossible'); } finally { b.disabled = false; b.textContent = t; } }
function exportMenu() {
    const d = show(`<h3>Exporter</h3><div class=col><small>${esc(stamp())}</small>${[['stu', 'Élèves et soldes'], ['pay', 'Paiements'], ['clo', 'Clôtures de caisse']].map(([k, l]) => `<div class="card col"><b>${l}</b><div class=row><button class=ghost data-x="${k}:csv">CSV (Excel)</button><button class=ghost data-x="${k}:pdf">PDF</button><button class=ghost data-x="${k}:png">PNG</button></div></div>`).join('')}<button class=ghost id=xc>Fermer</button></div>`);
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => exRun(b, () => exportDo(...b.dataset.x.split(':'))));
    d.querySelector('#xc').onclick = () => d.close();
}
async function backupAll() {
    const T = ['classes', 'students', 'payments', 'fee_payments', 'closures', 'extra_fees', 'attendance', 'sanctions', 'messages_log', 'change_requests', 'audit_log', 'expenses', 'events', 'assignments', 'timetable'], o = {}, er = {};
    await Promise.all(T.map(async n => { let r = await pageAll(() => db.from(n).select('*')); if (r.error) r = await db.from(n).select('*'); if (r.error) er[n] = r.error.message; else o[n] = r.data; }));
    const [t, pr] = await Promise.all([db.from('terms').select('*'), db.from('profiles').select('id,full_name,role,active')]);
    if (!t.error) o.terms = t.data; if (!pr.error) o.profiles = pr.data;
    if (!Object.keys(o).length) throw new Error('Pas de connexion internet.');
    const sc = S.school, b = { app: 'ORÉA École', format: 1, date: new Date().toISOString(), ecole: { id: sc.id, name: sc.name, rates: sc.rates }, donnees: o };
    if (Object.keys(er).length) b.erreurs = er;
    dl(new Blob([JSON.stringify(b)], { type: 'application/json' }), fnm('sauvegarde', 'json'));
    localStorage['orea_bk_' + sc.id] = Date.now(); toast('Sauvegarde enregistrée dans Téléchargements');
    if (S.tab === 'reglages') vReglages(); else render();
}

/* ---------- Relance des parents ---------- */
const ago = t => { const n = Math.floor((Date.now() - t) / 864e5); return n < 1 ? 'aujourd’hui' : 'il y a ' + n + ' j'; };
async function reminders() {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const r = await db.from('messages_log').select('student_id,created_at').eq('kind', 'frais').gte('created_at', since);
    const sent = new Map(); (r.data || []).forEach(m => { const t = +new Date(m.created_at); if (!(sent.get(m.student_id) > t)) sent.set(m.student_id, t); });
    const f = { cls: '', late: false, sms: localStorage.getItem('orea_relance_sms') === '1' };
    const go = s => {
        const m = getTpl('frais', s);
        if (f.sms) { if (!openSms(s.parent_phone, m)) return; }
        else { const u = waLink(s.parent_phone, m); if (!u) return toast('Numéro invalide'); window.open(u, '_blank'); }
        logMsg(s.id, 'frais', m); sent.set(s.id, Date.now()); draw();
    };
    const draw = () => {
        const all = ys().filter(s => s.balance_cdf > 0 && (!f.cls || s.class_id === f.cls) && (!f.late || status(s) === 'late')), no = all.filter(s => !s.parent_phone).length;
        const l = all.filter(s => s.parent_phone).sort((a, b) => (sent.has(a.id) - sent.has(b.id)) || b.balance_cdf - a.balance_cdf), done = l.filter(s => sent.has(s.id)).length, nx = l.find(s => !sent.has(s.id)), pc = l.length ? Math.round(100 * done / l.length) : 0;
        const d = show(`<h3>Relance des parents</h3><select id=rcl><option value="">Toutes les classes</option>${yc().map(c => `<option value="${c.id}" ${c.id === f.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>${hasTerms() ? `<div class=chips><button class="chip ${f.late ? '' : 'on'}" data-f=all>Tous les impayés</button><button class="chip ${f.late ? 'on' : ''}" data-f=late>En retard</button></div>` : ''}<div class=chips><button class="chip ${f.sms ? '' : 'on'}" data-v=wa>Par WhatsApp</button><button class="chip ${f.sms ? 'on' : ''}" data-v=sms>Par SMS</button></div><small>Relancés ces 7 derniers jours : <b>${done} / ${l.length}</b></small><div class=pbar style="margin:6px 0 10px"><i style="width:${pc}%;background:var(--gold)"></i></div>${nx ? `<button id=rn>▶ Relancer le suivant · ${esc(nx.name)}</button>` : l.length ? '<p class=ok style="text-align:center">✓ Tous les parents ont été relancés</p>' : ''}${l.length ? l.map(s => `<div class=card><span>${status(s) === 'late' ? '🔴 ' : ''}${esc(s.name)}<br><small>${fmt(s.balance_cdf)}${sent.has(s.id) ? ' · ✓ relancé ' + ago(sent.get(s.id)) : ''}</small></span><button class=ghost style=width:auto data-w=${s.id}>${sent.has(s.id) ? 'Renvoyer' : f.sms ? 'SMS' : 'WhatsApp'}</button></div>`).join('') : '<p class=empty>Aucun impayé avec numéro.</p>'}${no ? `<small>${no} élève(s) sans numéro ignoré(s).</small>` : ''}<button class=ghost id=rc2>Fermer</button>`);
        d.querySelector('#rcl').onchange = e => { f.cls = e.target.value; draw(); };
        d.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { f.late = b.dataset.f === 'late'; draw(); });
        d.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { f.sms = b.dataset.v === 'sms'; localStorage.setItem('orea_relance_sms', f.sms ? '1' : '0'); draw(); });
        const rn = d.querySelector('#rn'); if (rn) rn.onclick = () => go(nx);
        d.querySelectorAll('[data-w]').forEach(b => b.onclick = () => go(S.stu.find(x => x.id === b.dataset.w)));
        d.querySelector('#rc2').onclick = () => d.close();
    };
    draw();
}

/* ---------- MENU (REFONTE SVG) ---------- */
function doBackup() { exRun(event.target, backupAll); }
function yearMenu() {
    const y = yrs();
    const d = show(`<h3>Année scolaire</h3><div class=col><small>Année affichée : <b>${esc(S.year || '—')}</b></small><select id=ym>${y.map(v => `<option value="${esc(v)}" ${v === S.year ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select><div class=row><button class=ghost id=yc>Fermer</button><button id=yn>+ Nouvelle</button><button id=yp>Passage</button></div></div>`);
    d.querySelector('#yc').onclick = () => d.close();
    d.querySelector('#ym').onchange = e => { setYear(e.target.value); d.close(); };
    d.querySelector('#yn').onclick = () => { d.close(); setTimeout(newYear, 60); };
    d.querySelector('#yp').onclick = () => { d.close(); setTimeout(promote, 60); };
}
function menuCard(ic, label, sub, action) {
    return `<div class=menu-card onclick="${action}"><div class=menu-ic>${svgI(ic)}</div><div class=menu-label>${label}${sub ? `<small>${sub}</small>` : ''}</div><span class=menu-arrow>›</span></div>`;
}
function vMenu() {
    const R = S.me.role; let h = `<h3>Menu</h3>`;
    h += `<div class=menu-title>Gestion quotidienne</div>`;
    h += menuCard('presences', 'Présences', null, "menuGo('presences')");
    if (canCollect()) h += menuCard('caisse', 'Caisse', null, "menuGo('caisse')");
    if (fin()) h += menuCard('impayes', 'Finance', 'Impayés · Dépenses · Bilan', "menuGo('finance_home')");
    if (isCol()) { h += menuCard('graph', 'Ma perception', 'Ce que j’ai encaissé', "menuGo('perception')"); h += menuCard('impayes', 'Impayés', 'Mes classes', "menuGo('impayes')"); }
    h += `<div class=menu-title>Pédagogie</div>`;
    if (dir()) h += menuCard('absences', 'Suivi des absences', null, "menuGo('absences')");
    h += menuCard('sanctions', 'Sanctions', 'Avertissements · Sanctions', "menuGo('sanctions')");
    h += menuCard('calendrier', 'Programme', 'Calendrier · Horaires', "menuGo('programme_home')");
    h += menuCard('devoirs', 'Cahier de textes', 'Séances · Devoirs', "menuGo('cahier')");
    if (dir()) {
        h += `<div class=menu-title>Administration</div>`;
        h += menuCard('annees', 'Années scolaires', null, "yearMenu()");
        h += menuCard('equipe', 'Équipe & Cours', null, "team()");
        if (fin()) h += menuCard('exports', 'Données', 'Exports · Sauvegarde', "menuGo('donnees_home')");
        h += menuCard('messages', 'Messages des parents', null, "pAdminInbox()");
        h += menuCard('justificatifs', 'Justificatifs d’absence', null, "pAdminJustifs()");
        h += menuCard('annonces', 'Annonces', null, "pAdminAnnonce()");
        h += menuCard('messages', 'SMS aux parents', 'Par lots de 10 numéros', "oreaSmsGroup()");
    }
    h += `<div class=menu-title>Personnel</div>`;
    h += menuCard('calendrier', 'Pointage', dir() ? 'Arrivées et départs de l’équipe' : 'Mon arrivée · mon départ', "pointage()");
    h += menuCard('eleves', 'Mon espace parent', 'Suivre mes propres enfants', "location.href='parent.html'");
    h += `<div class=menu-title>Jeux</div>`;
    h += menuCard('alerte', 'Génie en Herbe', 'Quiz', "openQuiz()");
    $('#main').innerHTML = h;
}

/* ---------- Impayés ---------- */
// Élèves visibles dans les impayés : tous pour le directeur, ceux des classes confiées pour le percepteur
const impStu = () => ys().filter(s => colOK(s.class_id));
const impCls = () => yc().filter(c => colOK(c.id));
function vImpayes() {
    S.impcls = S.impcls || ''; S.impf = S.impf || 'all'; S.imps = S.imps || 'anciennete';
    if (S.impcls && !impCls().some(c => c.id === S.impcls)) S.impcls = '';
    let l = impStu().filter(s => s.balance_cdf > 0);
    if (S.impcls) l = l.filter(s => s.class_id === S.impcls);
    if (S.impf === '30j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 30 * 864e5; });
    if (S.impf === '60j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 60 * 864e5; });
    l.sort((a, b) => { if (S.imps === 'montant') return b.balance_cdf - a.balance_cdf; const la = a.last_pay ? new Date(a.last_pay).getTime() : 0, lb = b.last_pay ? new Date(b.last_pay).getTime() : 0; return la - lb; });
    const tot = l.reduce((a, s) => a + Number(s.balance_cdf || 0), 0);
    let h = subBack() + `<h3>Impayés${isCol() ? ' · mes classes' : ''}</h3>`;
    if (isCol() && !impCls().length) { subHost().innerHTML = h + '<p class=empty data-ic="🏫">Aucune classe ne vous a encore été confiée. Demandez au chef d’établissement de vous attribuer vos classes.</p>'; return; }
    if (isCol()) h += `<div class="card col"><b>Reste à payer par classe</b>${impCls().map(c => { const v = impStu().filter(s => s.class_id === c.id).reduce((a, s) => a + Math.max(0, Number(s.balance_cdf || 0)), 0); return `<div style="display:flex;justify-content:space-between;margin:3px 0"><span>${esc(c.name)}</span><b class="${v > 0 ? 'due' : 'ok'}">${fmt(v)}</b></div>`; }).join('')}</div>`;
    h += `<div class=bar><select id=icl><option value="">Toutes ${isCol() ? 'mes ' : ''}classes</option>${impCls().map(c => `<option value="${c.id}" ${S.impcls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
    h += `<div class=chips><button class="chip ${S.impf === 'all' ? 'on' : ''}" onclick="S.impf='all';render()">Tous</button><button class="chip ${S.impf === '30j' ? 'on' : ''}" onclick="S.impf='30j';render()">> 30j</button><button class="chip ${S.impf === '60j' ? 'on' : ''}" onclick="S.impf='60j';render()">> 60j</button></div>`;
    h += `<div class=card><span>${l.length} élève(s)</span><b class=due>${fmt(tot)}</b></div>`;
    h += `<div class=row><button class=ghost onclick=impayesPDF()>📄 PDF</button><button class=ghost onclick=impayesPNG()>🖼 PNG</button>${fin() ? `<button onclick=reminders()>💬 Relancer</button>` : ''}</div>`;
    h += l.length ? l.map(s => `<div class=card onclick="menu('${s.id}')"><span>${esc(s.name)}<br><small>${esc(cnm(s.class_id))} · ${s.last_pay ? 'Dernier paiement il y a ' + Math.floor((Date.now() - new Date(s.last_pay)) / 864e5) + 'j' : 'Jamais payé'}</small></span><b class=due>${fmt(s.balance_cdf)}</b></div>`).join('') : '<p class=empty>Aucun impayé pour ces critères.</p>';
    subHost().innerHTML = h;
    $('#icl').onchange = e => { S.impcls = e.target.value; render(); };
}
function impayesRep() {
    let l = impStu().filter(s => s.balance_cdf > 0);
    if (S.impcls) l = l.filter(s => s.class_id === S.impcls);
    if (S.impf === '30j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 30 * 864e5; });
    if (S.impf === '60j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 60 * 864e5; });
    l.sort((a, b) => { if (S.imps === 'montant') return b.balance_cdf - a.balance_cdf; const la = a.last_pay ? new Date(a.last_pay).getTime() : 0, lb = b.last_pay ? new Date(b.last_pay).getTime() : 0; return la - lb; });
    if (!l.length) return null;
    const rows = l.map(s => [s.name, cnm(s.class_id), s.last_pay ? new Date(s.last_pay).toLocaleDateString('fr-FR') : 'Jamais', Math.round(Number(s.balance_cdf))]);
    const r = { name: 'impayes', title: 'Impayés — ' + S.school.name, sub: stamp() + ' · ' + l.length + ' élèves · montants en FC', head: ['Élève', 'Classe', 'Dernier paiement', 'Reste dû (FC)'], rows, w: [40, 25, 20, 15], r: [3], tot: ['Total', '', '', rows.reduce((t, r) => t + r[3], 0)] };
    return r;
}
function impayesPDF() {
    const r = impayesRep(); if (!r) return toast('Aucun impayé à exporter.');
    try { dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf')); toast('PDF enregistré dans Téléchargements'); } catch (e) { toast(e.message); }
}
async function impayesPNG() {
    const r = impayesRep(); if (!r) return toast('Aucun impayé à exporter.');
    try { await pngOut(r); } catch (e) { toast(e.message); }
}

/* ---------- Dépenses ---------- */
function nextMonth(ym) { const [y, m] = ym.split('-').map(Number), d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
// Quand Impayés / Dépenses s'affichent dans l'onglet Finance (finance.js), on écrit dans #fin-content
const finEmb = () => S.tab === 'finance_home' ? $('#fin-content') : null;
const subHost = () => finEmb() || $('#main');
const subBack = () => finEmb() ? '' : '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>';
function failView(e) { $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div><p class=empty>' + esc((e && e.message) || e || 'Erreur') + '</p><div class=row><button onclick=render()>Réessayer</button></div>'; }
const monthRange = ym => { const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 1); return [ym + '-01', n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-01']; };
async function vDepenses() {
    subHost().innerHTML = subBack() + SK;
    const d = new Date(); if (!S.depDate) S.depDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const { data, error } = await db.from('expenses').select('*').gte('date', S.depDate + '-01').lt('date', nextMonth(S.depDate) + '-01').order('date', { ascending: false });
    if (error) { if (S.tab === 'depenses' || finEmb()) subHost().innerHTML = subBack() + '<p class=empty>' + esc(error.message) + '</p>'; return; }
    S.depenses = data;
    const tot = data.reduce((a, x) => a + Number(x.amount_cdf), 0);
    let h = subBack() + `<h3>Dépenses</h3>`;
    h += `<div class=bar><input type=month value="${S.depDate}" id=dpm></div>`;
    h += `<div class=card><span>Total du mois</span><b class=due>${fmt(tot)}</b></div><button onclick=addExpense()>+ Ajouter une dépense</button>`;
    h += data.length ? data.map(x => `<div class=card onclick="editExpense('${x.id}')"><span>${esc(x.label)}<br><small>${new Date(x.date + 'T00:00').toLocaleDateString('fr-FR')} · ${x.category}</small></span><b>${nf(x.amount)} ${SYM[x.currency]}</b></div>`).join('') : '<p class=empty>Aucune dépense ce mois-ci.</p>';
    if (S.tab !== 'depenses' && !(S.tab === 'finance_home' && S.finTab === 'depenses' && $('#fin-content'))) return;
    subHost().innerHTML = h;
    $('#dpm').onchange = e => { S.depDate = e.target.value; vDepenses(); };
}
function addExpense() {
    ask('Nouvelle dépense', [{ n: 'label', l: 'Libellé' }, { n: 'amount', l: 'Montant', t: 'number' }, { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur }, { n: 'cat', l: 'Catégorie', o: [['salaires', 'Salaires'], ['loyer', 'Loyer'], ['electricite', 'Électricité/Eau'], ['fournitures', 'Fournitures'], ['transport', 'Transport'], ['entretien', 'Entretien'], ['examens', 'Examens'], ['communication', 'Communication'], ['autre', 'Autre']] }, { n: 'date', l: 'Date', t: 'date', v: tdy() }], async v => {
        const rate = rateOf(v.cur), amount_cdf = +v.amount * rate;
        const { error } = await db.from('expenses').insert({ school_id: S.school.id, label: v.label.trim(), amount: +v.amount, currency: v.cur, amount_cdf, rate, category: v.cat, date: v.date });
        if (error) throw error; await vDepenses(); toast('Dépense ajoutée');
    });
}
function editExpense(id) {
    const x = S.depenses.find(z => z.id === id);
    const d = show(`<h3>${esc(x.label)}</h3><p>${nf(x.amount)} ${x.currency} · ${x.category} · ${new Date(x.date + 'T00:00').toLocaleDateString('fr-FR')}</p><div class=col><button id=e1>Modifier</button><button class=ghost id=e2>Supprimer</button><button class=ghost id=e3>Fermer</button></div>`);
    d.querySelector('#e3').onclick = () => d.close();
    d.querySelector('#e1').onclick = () => ask('Modifier la dépense', [{ n: 'label', l: 'Libellé', v: x.label }, { n: 'amount', l: 'Montant (' + x.currency + ')', t: 'number', v: x.amount }], async v => {
        const { error } = await db.from('expenses').update({ label: v.label.trim(), amount: +v.amount, amount_cdf: +v.amount * (x.rate || rateOf(x.currency)) }).eq('id', id);
        if (error) throw error; d.close(); await vDepenses(); toast('Dépense modifiée');
    });
    d.querySelector('#e2').onclick = async () => {
        if (!confirm('Supprimer cette dépense ?')) return;
        const { error } = await db.from('expenses').delete().eq('id', id);
        if (error) return toast(error.message); d.close(); await vDepenses(); toast('Dépense supprimée');
    };
}

/* ---------- Bilan mensuel ---------- */
// Retour depuis le Bilan. NB : ne jamais écrire dir() dans un onclick="..." HTML :
// là, « dir » désigne la propriété dir du bouton (sens du texte) et non notre fonction.
function finBack() { S.tab = fin() ? 'finance_home' : 'menu'; render(); }
async function vBilan() {
    const d = new Date(); if (!S.bilDate) S.bilDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="finBack()">← Finance</button></div>' + SK;
    const [y, m] = S.bilDate.split('-').map(Number), a = new Date(y, m - 1, 1), b = new Date(y, m, 1), nk = b.getFullYear() + '-' + String(b.getMonth() + 1).padStart(2, '0') + '-01';
    const [p, f, ex] = await Promise.all([
        pageAll(() => db.from('payments').select('amount_cdf,method').gte('created_at', a.toISOString()).lt('created_at', b.toISOString())),
        pageAll(() => db.from('fee_payments').select('amount_cdf,method').gte('created_at', a.toISOString()).lt('created_at', b.toISOString())),
        db.from('expenses').select('*').gte('date', S.bilDate + '-01').lt('date', nk)
    ]);
    if (p.error || f.error || ex.error) return failView(p.error || f.error || ex.error);
    const enc = p.data.concat(f.data), totEnc = sum(enc), esp = sum(enc.filter(x => x.method === 'especes')), mm = totEnc - esp;
    const dep = ex.data, totDep = dep.reduce((t, x) => t + Number(x.amount_cdf), 0);
    const solde = totEnc - totDep;
    S._bilan = { esp, mm, totEnc, dep, totDep, solde, date: S.bilDate };
    let h = `<div class=bar><button class=ghost onclick="finBack()">← Finance</button></div><h3>Bilan mensuel</h3>`;
    h += `<div class=bar><input type=month id=bm value="${S.bilDate}"></div>`;
    h += `<div class="card col"><b>Encaissé</b><span>Espèces : ${fmt(esp)}</span><span>Mobile Money : ${fmt(mm)}</span><b class=ok style="margin-top:6px">Total : ${fmt(totEnc)}</b></div>`;
    h += `<div class="card col"><b>Dépensé</b>${dep.length ? dep.map(x => `<span style="display:flex;justify-content:space-between"><small>${esc(x.label)}</small><small>${fmt(x.amount_cdf)}</small></span>`).join('') : '<small>Aucune dépense</small>'}<b class=due style="margin-top:6px">Total : ${fmt(totDep)}</b></div>`;
    h += `<div class="card hero col"><small>SOLDE DU MOIS</small><span class="big" style="color:${solde >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmt(solde)}</span></div>`;
    h += `<button class=ghost onclick=bilanPDF()>📄 Exporter en PDF</button>`;
    if (S.tab !== 'bilan') return;
    $('#main').innerHTML = h;
    $('#bm').onchange = e => { S.bilDate = e.target.value; vBilan(); };
}
function bilanPDF() {
    if (!S._bilan) return toast('Ouvrez d\'abord le bilan.');
    const b = S._bilan;
    const rows = [['Encaissements espèces', '', b.esp], ['Encaissements Mobile Money', '', b.mm], ['TOTAL ENCAISSÉ', '', b.totEnc]];
    b.dep.forEach(x => rows.push([x.label, x.category, Number(x.amount_cdf)]));
    rows.push(['TOTAL DÉPENSÉ', '', b.totDep]);
    rows.push(['SOLDE DU MOIS', '', b.solde]);
    const r = { name: 'bilan-' + b.date, title: 'Bilan mensuel — ' + S.school.name, sub: 'Mois : ' + b.date + ' · Montants en FC', head: ['Élément', 'Catégorie', 'Montant (FC)'], rows, w: [50, 30, 20], r: [2], tot: null };
    try { dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf')); toast('PDF enregistré'); } catch (e) { toast(e.message); }
}

/* ---------- Suivi des absences ---------- */
async function vAbsences() {
    const d = new Date(); if (!S.absM) S.absM = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const [mA, mB] = monthRange(S.absM);
    const { data, error } = await db.from('attendance').select('*').eq('status', 'absent').gte('day', mA).lt('day', mB);
    if (error) return failView(error);
    const abs = data || [], byStu = {}, byCls = {};
    abs.forEach(x => { byStu[x.student_id] = (byStu[x.student_id] || 0) + 1; const s = S.stu.find(z => z.id === x.student_id); if (s) byCls[s.class_id] = (byCls[s.class_id] || 0) + 1; });
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Suivi des absences</h3>`;
    h += `<div class=bar><input type=month id=am value="${S.absM}"></div>`;
    const l = Object.entries(byStu).map(([id, n]) => ({ s: S.stu.find(z => z.id === id), n })).filter(x => x.s && x.n >= 3).sort((a, b) => b.n - a.n);
    h += `<div class="card col"><b>Élèves à surveiller (≥ 3 absences)</b>${l.length ? l.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.s.name)} (${esc(cnm(x.s.class_id))})</span><b class=due>${x.n} fois</b></div>`).join('') : '<small>Aucun élève en dessous de la limite.</small>'}</div>`;
    const c = Object.entries(byCls).map(([id, n]) => ({ c: S.classes.find(z => z.id === id), n })).filter(x => x.c).sort((a, b) => b.n - a.n);
    h += `<div class="card col"><b>Absences par classe</b>${c.length ? c.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.c.name)}</span><b>${x.n} abs.</b></div>`).join('') : '<small>Aucune absence.</small>'}</div>`;
    if (S.tab !== 'absences') return;
    $('#main').innerHTML = h;
    $('#am').onchange = e => { S.absM = e.target.value; vAbsences(); };
}

/* ---------- Sanctions (vue globale) ---------- */
async function vSanctions() {
    const d = new Date(); if (!S.sanM) S.sanM = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const [mA, mB] = monthRange(S.sanM);
    const { data, error } = await db.from('sanctions').select('*').gte('day', mA).lt('day', mB).order('day', { ascending: false });
    if (error) return failView(error);
    const sanc = data || [], byStu = {}, byW = {};
    sanc.forEach(x => { if (isWarn(x.kind)) byW[x.student_id] = (byW[x.student_id] || 0) + 1; else byStu[x.student_id] = (byStu[x.student_id] || 0) + 1; });
    const nW = sanc.filter(x => isWarn(x.kind)).length;
    const rq = await db.from('sanction_requests').select('*').order('created_at', { ascending: false }).limit(100);
    const REQ = rq.error ? [] : (rq.data || []), pendR = REQ.filter(r => r.status === 'en_attente');
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Avertissements et sanctions</h3>`;
    if (dir()) h += `<div class="card col" style="border-color:var(--gold)"><b>À valider (${pendR.length})</b>${pendR.length ? pendR.map(r => { const st = S.stu.find(z => z.id === r.student_id); return `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${esc(st ? st.name : '?')} · ${esc(r.kind)}</b><br><small>${esc(cnm(st ? st.class_id : ''))} · ${fdate(r.day)}${r.note ? ' · ' + esc(r.note) : ''}</small><div class=row style="margin-top:6px"><button data-ok=${r.id}>Valider</button><button class=ghost data-no=${r.id}>Refuser</button></div></div>`; }).join('') : '<small>Aucune proposition en attente.</small>'}</div>`;
    else if (REQ.length) h += `<div class="card col"><b>Mes propositions</b>${REQ.slice(0, 10).map(r => { const st = S.stu.find(z => z.id === r.student_id); return `<div style="display:flex;justify-content:space-between;gap:8px;margin:4px 0"><span>${esc(st ? st.name : '?')} · ${esc(r.kind)}</span><small class="${r.status === 'refusee' ? 'due' : r.status === 'en_attente' ? '' : 'ok'}">${({ en_attente: 'En attente', validee: 'Validé', refusee: 'Refusé', traitee: 'Pris en compte' }[r.status] || 'En attente')}</small></div>`; }).join('')}</div>`;
    h += `<div class=bar><input type=month id=sm value="${S.sanM}"></div>`;
    const l = Object.entries(byStu).map(([id, n]) => ({ s: S.stu.find(z => z.id === id), n })).filter(x => x.s && x.n >= 3).sort((a, b) => b.n - a.n);
    const lw = Object.entries(byW).map(([id, n]) => ({ s: S.stu.find(z => z.id === id), n })).filter(x => x.s && x.n >= 3).sort((a, b) => b.n - a.n);
    h += `<div class="card col"><b>Élèves à dossier (≥ 3 sanctions)</b>${l.length ? l.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.s.name)} (${esc(cnm(x.s.class_id))})</span><b class=due>${x.n} fois</b></div>`).join('') : '<small>Aucun élève avec un tel dossier.</small>'}</div>`;
    h += `<div class="card col"><b>3 avertissements ou plus</b>${lw.length ? lw.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.s.name)} (${esc(cnm(x.s.class_id))})</span><b style="color:var(--gold)">${x.n} fois</b></div>`).join('') : '<small>Aucun élève concerné.</small>'}</div>`;
    h += `<h3>Ce mois : ${nW} avertissement(s) · ${sanc.length - nW} sanction(s)</h3>`;
    h += sanc.length ? sanc.map(x => { const s = S.stu.find(z => z.id === x.student_id); return `<div class="card col" style="border-left:3px solid ${isWarn(x.kind) ? 'var(--gold)' : 'var(--bad)'}"><b>${esc(s ? s.name : '?')} · ${esc(x.kind)}</b><small>${esc(cnm(s ? s.class_id : ''))} · ${new Date(x.day + 'T00:00').toLocaleDateString('fr-FR')}${x.note ? ' · ' + esc(x.note) : ''}</small></div>`; }).join('') : '<p class=empty>Aucun avertissement ni sanction ce mois-ci.</p>';
    if (S.tab !== 'sanctions') return;
    $('#main').innerHTML = h;
    $('#sm').onchange = e => { S.sanM = e.target.value; vSanctions(); };
    document.querySelectorAll('#main [data-ok]').forEach(b => b.onclick = async () => { b.disabled = true; await decideReq(REQ.find(r => r.id === b.dataset.ok), true); vSanctions(); });
    document.querySelectorAll('#main [data-no]').forEach(b => b.onclick = async () => { b.disabled = true; await decideReq(REQ.find(r => r.id === b.dataset.no), false); vSanctions(); });
}

// --- FIN DE LA TRANCHE 10. La tranche suivante commencera par : /* ---------- Calendrier scolaire ---------- */ ---
/* ---------- Calendrier scolaire ---------- */
async function vCalendrier() {
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const { data, error } = await db.from('events').select('*').gte('start_date', tdy()).order('start_date');
    if (error) return failView(error);
    const evs = data || [];
    S.calEvents = evs;
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Calendrier scolaire</h3>`;
    if (dir()) h += `<button onclick=addEvent()>+ Ajouter un événement</button>`;
    h += evs.length ? evs.map(x => `<div class="card col" onclick="editEvent('${x.id}')"><b>${esc(x.title)}</b><span>${fdate(x.start_date)}${x.end_date ? ' au ' + fdate(x.end_date) : ''}</span><small>${esc((x.type || '').toUpperCase())}${x.description ? ' · ' + esc(x.description) : ''}</small></div>`).join('') : '<p class=empty data-ic="📅">Aucun événement à venir.</p>';
    h += `<h3>Exporter</h3><button class=ghost onclick=icsEvents()>📅 Ajouter à mon agenda</button>`;
    if (S.tab !== 'calendrier') return;
    $('#main').innerHTML = h;
}
function addEvent() {
    ask('Nouvel événement', [{ n: 'title', l: 'Titre' }, { n: 'type', l: 'Type', o: [['rentree', 'Rentrée'], ['vacances', 'Vacances'], ['examens', 'Examens'], ['reunion', 'Réunion parents'], ['fete', 'Fête'], ['autre', 'Autre']] }, { n: 'start', l: 'Date de début', t: 'date', v: tdy() }, { n: 'end', l: 'Date de fin (facultatif)', t: 'date', r: false }, { n: 'desc', l: 'Description (facultatif)', t: 'textarea', r: false }], async v => {
        const { error } = await db.from('events').insert({ school_id: S.school.id, title: v.title.trim(), type: v.type, start_date: v.start, end_date: v.end || null, description: v.desc.trim() || null });
        if (error) throw error; await load(); vCalendrier(); toast('Événement ajouté');
    });
}
function editEvent(id) {
    const e = (S.calEvents || S.events || []).find(x => x.id === id);
    if (!e) return toast('Événement introuvable.');
    const d = show(`<h3>${esc(e.title)}</h3><p>${fdate(e.start_date)}${e.end_date ? ' au ' + fdate(e.end_date) : ''}</p><p><small>${esc(e.description || '')}</small></p><div class=col><button class=ghost id=e2>Supprimer</button><button class=ghost id=e3>Fermer</button></div>`);
    d.querySelector('#e3').onclick = () => d.close();
    d.querySelector('#e2').onclick = async () => { if (!confirm('Supprimer ?')) return; const { error } = await db.from('events').delete().eq('id', id); if (error) return toast(error.message); d.close(); await load(); vCalendrier(); toast('Supprimé'); };
}
function icsEvents() {
    const evs = S.calEvents && S.calEvents.length ? S.calEvents : S.events;
    if (!evs || !evs.length) return toast('Aucun événement.');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const esc2 = t => String(t || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const day = (iso, plus) => { const [y, m, d] = iso.split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d + (plus || 0))); return t.getUTCFullYear() + String(t.getUTCMonth() + 1).padStart(2, '0') + String(t.getUTCDate()).padStart(2, '0'); };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OREA Ecole//FR'];
    evs.forEach(e => lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@orea', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + day(e.start_date), 'DTEND;VALUE=DATE:' + day(e.end_date || e.start_date, 1), 'SUMMARY:' + esc2(e.title), 'DESCRIPTION:' + esc2(e.description), 'END:VEVENT'));
    lines.push('END:VCALENDAR');
    dl(new Blob([lines.join('\r\n')], { type: 'text/calendar' }), 'calendrier-orea.ics');
}

/* ---------- Rapport mensuel (image PNG partageable) ---------- */
const cnm2 = id => { const c = S.classes.find(x => x.id === id); return c ? c.name + (yrs().length > 1 ? ' · ' + cy(c) : '') : '—'; };
function monthReport() {
    const now = new Date(), ms = [];
    for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1), l = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); ms.push([d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l.charAt(0).toUpperCase() + l.slice(1)]); }
    const d = show(`<h3>Rapport mensuel</h3><div class=col><label>Mois<select id=rm>${ms.map(m => `<option value="${m[0]}">${m[1]}</option>`).join('')}</select></label><small>Montants affichés en ${S.cur}. L’état actuel concerne l’année ${esc(S.year || '—')}.</small><button id=rg>Générer le rapport</button><button class=ghost id=rx>Fermer</button></div>`);
    d.querySelector('#rx').onclick = () => d.close();
    d.querySelector('#rg').onclick = e => { const k = d.querySelector('#rm').value; exRun(e.currentTarget, () => reportImg(k, ms.find(m => m[0] === k)[1])); };
}
async function reportImg(key, label) {
    const [y, m] = key.split('-').map(Number), a = new Date(y, m - 1, 1), b = new Date(y, m, 1), nk = b.getFullYear() + '-' + String(b.getMonth() + 1).padStart(2, '0') + '-01';
    const q = n => pageAll(() => db.from(n).select('student_id,amount_cdf,method,created_at').gte('created_at', a.toISOString()).lt('created_at', b.toISOString()));
    const [p, f, c] = await Promise.all([q('payments'), q('fee_payments'), db.from('closures').select('expected_cash,declared_cash').gte('day', key + '-01').lt('day', nk)]);
    const er = p.error || f.error; if (er) throw new Error(er.message);
    const rows = p.data.concat(f.data), ids = new Map(S.stu.map(s => [s.id, s])), tot = sum(rows), esp = sum(rows.filter(r => r.method === 'especes')), by = {};
    rows.forEach(r => { const s = ids.get(r.student_id); if (s) by[s.class_id] = (by[s.class_id] || 0) + Number(r.amount_cdf); });
    const cl = Object.entries(by).map(([id, v]) => [cnm2(id), v]).sort((u, v) => v[1] - u[1]).slice(0, 8), mx = Math.max(...cl.map(z => z[1]), 1);
    const cs = c.data || [], ecart = cs.reduce((t, k) => t + Number(k.declared_cash) - Number(k.expected_cash), 0);
    const st = ys(), sm = k => st.reduce((t, s) => t + Number(s[k] || 0), 0), exp = sm('due1_cdf') + sm('due2_cdf') + sm('due3_cdf') + sm('fee_exp_cdf'), due = sm('balance_cdf'), pct = exp > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - due / exp)))) : 0, owe = st.filter(s => s.balance_cdf > 0).length;
    const R = [['Taux de recouvrement', pct + ' %'], ['Reste à encaisser', fmt(due)], ['Élèves avec un solde', owe + ' / ' + st.length]];
    if (hasTerms()) R.push(['Élèves en retard', String(st.filter(s => status(s) === 'late').length)]);
    if (cs.length) R.push(['Écart de caisse (' + cs.length + ' clôture' + (cs.length > 1 ? 's' : '') + ')', fmt(ecart)]);
    const W = 720, CH = Math.max(cl.length, 1), y0 = 545, yS = y0 + CH * 50 + 30, yF = yS + 45 + (R.length - 1) * 44 + 70, H = yF + 40;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.fillStyle = '#fffdf6'; x.fillRect(0, 0, W, H);
    const gg = x.createLinearGradient(0, 0, W, H); gg.addColorStop(0, '#e9cf86'); gg.addColorStop(.5, '#b08a30'); gg.addColorStop(1, '#8a6a1f');
    x.strokeStyle = gg; x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28); x.lineWidth = 1; x.strokeRect(24, 24, W - 48, H - 48);
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'logo-light.png'; });
    if (im) x.drawImage(im, 295, 44, 130, 130);
    x.textAlign = 'center'; x.fillStyle = '#111211'; x.font = 'bold 30px Georgia,serif'; x.fillText(S.school.name, W / 2, 215);
    x.fillStyle = '#6b6a60'; x.font = '20px Georgia,serif'; x.fillText('Rapport d’activité · ' + label, W / 2, 248);
    x.fillStyle = gg; x.fillRect(W / 2 - 130, 268, 260, 2);
    x.fillStyle = '#6b6a60'; x.font = '18px sans-serif'; x.fillText('Encaissé ce mois', W / 2, 330);
    const big = fmt(tot); let fs = 58; x.font = '600 ' + fs + 'px Georgia,serif'; while (x.measureText(big).width > 600 && fs > 30) { fs -= 2; x.font = '600 ' + fs + 'px Georgia,serif'; }
    x.fillStyle = '#9a7a2c'; x.fillText(big, W / 2, 400);
    x.fillStyle = '#111211'; x.font = '17px sans-serif'; x.fillText(rows.length + ' paiement' + (rows.length > 1 ? 's' : '') + ' · Espèces ' + fmt(esp) + ' · Mobile Money ' + fmt(tot - esp), W / 2, 440);
    x.textAlign = 'left'; x.fillStyle = '#111211'; x.font = 'bold 22px Georgia,serif'; x.fillText('Encaissements par classe', 50, 500);
    if (!cl.length) { x.fillStyle = '#6b6a60'; x.font = '17px sans-serif'; x.fillText('Aucun paiement ce mois-ci.', 50, y0 + 10); }
    cl.forEach((r, i) => { const yy = y0 + i * 50; x.textAlign = 'left'; x.fillStyle = '#111211'; x.font = '18px sans-serif'; x.fillText(r[0], 50, yy); x.textAlign = 'right'; x.font = 'bold 18px Georgia,serif'; x.fillText(fmt(r[1]), W - 50, yy); x.fillStyle = '#e8e0cc'; x.fillRect(50, yy + 10, W - 100, 8); x.fillStyle = gg; x.fillRect(50, yy + 10, Math.max(4, (W - 100) * r[1] / mx), 8); });
    x.textAlign = 'left'; x.fillStyle = '#111211'; x.font = 'bold 22px Georgia,serif'; x.fillText('État actuel · ' + (S.year || '—'), 50, yS);
    R.forEach((r, i) => { const yy = yS + 45 + i * 44; x.strokeStyle = '#e0d8c4'; x.lineWidth = 1; x.beginPath(); x.moveTo(50, yy + 14); x.lineTo(W - 50, yy + 14); x.stroke(); x.textAlign = 'left'; x.fillStyle = '#6b6a60'; x.font = '18px sans-serif'; x.fillText(r[0], 50, yy); x.textAlign = 'right'; x.fillStyle = '#111211'; x.font = 'bold 19px Georgia,serif'; x.fillText(r[1], W - 50, yy); });
    x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '15px sans-serif'; x.fillText('Édité le ' + new Date().toLocaleDateString('fr-FR') + ' — ORÉA École', W / 2, yF);
    const rep = { name: 'rapport-' + key, title: 'Rapport d’activité · ' + label + ' — ' + S.school.name, sub: 'Édité le ' + new Date().toLocaleDateString('fr-FR') + ' · montants en ' + S.cur,
        head: ['Élément', 'Valeur'], w: [65, 35], r: [1],
        rows: [['Encaissé ce mois', fmt(tot)], ['Nombre de paiements', String(rows.length)], ['Espèces', fmt(esp)], ['Mobile Money', fmt(tot - esp)], ...cl.map(z => ['Encaissé · ' + z[0], fmt(z[1])]), ...R.map(z => [z[0] + ' (' + (S.year || '—') + ')', String(z[1])])], tot: null };
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), url = URL.createObjectURL(blob), fn = 'rapport-' + key + '.png', file = new File([blob], fn, { type: 'image/png' }), can = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const d = show(`<h3>Rapport · ${esc(label)}</h3><div class=col><button id=ps>📤 Partager</button><a class="btn ghost" download="${fn}" href="${url}">Télécharger PNG</a><button class=ghost id=pdr>Télécharger PDF</button><button class=ghost id=pc>Fermer</button></div><img src="${url}" alt="Rapport">`);
    d.querySelector('#pdr').onclick = () => { try { dl(new Blob([mkPdf(rep)], { type: 'application/pdf' }), fnm(rep.name, 'pdf')); toast('PDF enregistré dans Téléchargements'); } catch (e) { toast(e.message); } };
    d.querySelector('#pc').onclick = () => d.close();
    d.querySelector('#ps').onclick = async () => { if (can) { try { await navigator.share({ files: [file], text: 'Rapport ' + label + ' — ' + S.school.name }); } catch (e) { if (e.name !== 'AbortError') toast('Partage impossible.'); } } else { dl(blob, fn); toast('Image enregistrée.'); } };
}
/* ========================================================
   PAQUET K5 — Devoirs & Emploi du temps
   ======================================================== */
function vDevoirs() {
    const R = S.me.role;
    if (!yc().length) { $('#main').innerHTML = ybar() + `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><p class=empty>Crée d'abord une classe.</p>`; return; }
    if (!yc().some(c => c.id === S.cls)) S.cls = yc()[0].id;
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Devoirs</h3>` + ybar();
    if (window.vCahier) h += `<div class=row style="margin-bottom:8px"><button type=button class=chip style="flex:1" onclick="menuGo('cahier')">Séances</button><button type=button class="chip on" style="flex:1">Devoirs</button></div>`;
    h += `<div class=bar><select id=dvc>${yc().map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
    if ((R === 'directeur' && !secr()) || R === 'enseignant' || R === 'percepteur') h += `<button onclick=addAssignment()>+ Nouveau devoir</button>`;
    h += `<div id=dvl><div class=sk></div><div class=sk></div><div class=sk></div></div>`;
    $('#main').innerHTML = h;
    $('#dvc').onchange = e => { S.cls = e.target.value; drawDevoirs(); };
    drawDevoirs();
}
async function drawDevoirs() {
    const { data, error } = await db.from('assignments').select('*').eq('class_id', S.cls).order('due_date', { ascending: false });
    if (S.tab !== 'devoirs') return;
    const el = $('#dvl'); if (!el) return;
    if (error) { el.innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
    const R = S.me.role, l = data || [];
    if (!l.length) { el.innerHTML = `<p class=empty data-ic="📝">${dir() ? 'Aucun devoir pour cette classe.' : 'Aucun devoir de vos cours pour cette classe.'}</p>`; return; }
    const ak = await ackMap('devoir', l.map(a => a.id)); if (S.tab !== 'devoirs') return;
    const today = tdy();
    el.innerHTML = l.map(a => {
        const late = String(a.due_date) < today;
        const can = (R === 'directeur' && !secr()) || R === 'enseignant' || R === 'percepteur';
        return `<div class="card col" style="${late ? 'border-left:3px solid var(--bad)' : 'border-left:3px solid var(--gold)'}"><b>${esc(a.subject)}</b><small>${late ? '⚠ Rendu' : 'À rendre'} le ${fdate(a.due_date)}</small><span>${esc(a.description)}</span>${ak.__n && ak.__n[a.id] ? `<small class=ok>👁 Vu par ${ak.__n[a.id]} parent(s)</small>` : ''}${can ? `<div class=row><button class=ghost data-e="${a.id}">✏️ Modifier</button><button class=ghost data-x="${a.id}">🗑</button></div>` : ''}</div>`;
    }).join('');
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editAssignment(b.dataset.e));
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer ce devoir ?')) return; const { error } = await db.from('assignments').delete().eq('id', b.dataset.x); if (error) return toast(error.message); toast('Supprimé'); drawDevoirs(); });
}
async function addAssignment() {
    if (!S.cls) return toast('Sélectionne une classe');
    const cn = (S.classes.find(c => c.id === S.cls) || {}).name || '';
    let subj = { n: 'subject', l: 'Matière / titre court' };
    if (!dir()) {
        const mc = await myCourses(); if (mc.error) return toast(mc.error.message);
        const L = mc.data.filter(x => x.class_id === S.cls && x.subjects).map(x => x.subjects.name);
        if (!L.length) return toast('Aucun cours ne vous est attribué dans ' + cn + '. Demandez à la direction.');
        subj = { n: 'subject', l: 'Cours', o: L.map(x => [x, esc(x)]) };
    }
    ask('Nouveau devoir — ' + esc(cn), [
        subj,
        { n: 'description', l: 'Description', t: 'textarea' },
        { n: 'due', l: 'À rendre le', t: 'date', v: tdy() }
    ], async v => {
        const { error } = await db.from('assignments').insert({ school_id: S.school.id, class_id: S.cls, subject: v.subject.trim(), description: v.description.trim(), due_date: v.due, year: S.year || '', created_by: S.me.id });
        if (error) throw error; toast('Devoir ajouté'); drawDevoirs();
    });
}
async function editAssignment(id) {
    const { data: a, error } = await db.from('assignments').select('*').eq('id', id).single();
    if (error || !a) return toast('Introuvable');
    ask('Modifier le devoir', [
        { n: 'subject', l: 'Matière / titre', v: a.subject },
        { n: 'description', l: 'Description', t: 'textarea', v: a.description },
        { n: 'due', l: 'À rendre le', t: 'date', v: a.due_date }
    ], async v => {
        const { error } = await db.from('assignments').update({ subject: v.subject.trim(), description: v.description.trim(), due_date: v.due }).eq('id', id);
        if (error) throw error; toast('Modifié'); drawDevoirs();
    });
}

const hhmmP = t => t ? String(t).slice(0, 5) : '';
function vEmploiTemps() {
    const R = S.me.role;
    if (!yc().length) { $('#main').innerHTML = ybar() + `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><p class=empty>Crée d'abord une classe.</p>`; return; }
    if (!yc().some(c => c.id === S.cls)) S.cls = yc()[0].id;
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Emploi du temps</h3>` + ybar();
    h += `<div class=bar><select id=ttc>${yc().map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
    if (R === 'directeur' || R === 'enseignant' || R === 'percepteur') h += `<button onclick=addSlot()>+ Créneau</button>`;
    h += `<div id=ttl><div class=sk></div><div class=sk></div><div class=sk></div></div>`;
    $('#main').innerHTML = h;
    $('#ttc').onchange = e => { S.cls = e.target.value; drawTT(); };
    drawTT();
}
async function drawTT() {
    const { data, error } = await db.from('timetable').select('*').eq('class_id', S.cls).order('day').order('start_time');
    if (S.tab !== 'emploi_temps') return;
    const el = $('#ttl'); if (!el) return;
    if (error) { el.innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
    const l = data || [], R = S.me.role;
    if (!l.length) { el.innerHTML = `<p class=empty data-ic="📅">Aucun créneau pour cette classe.</p>`; return; }
    const byDay = {}; l.forEach(t => (byDay[t.day] = byDay[t.day] || []).push(t));
    const days = Object.keys(byDay).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    el.innerHTML = days.map(d => `<h3>${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][d] || ''}</h3>` + byDay[d].map(t => {
        const can = R === 'directeur' || R === 'enseignant' || R === 'percepteur';
        return `<div class=card><span><b>${esc(t.subject)}</b><br><small>${hhmmP(t.start_time)} – ${hhmmP(t.end_time)}${t.room ? ' · ' + esc(t.room) : ''}</small></span>${can ? `<div class=row style="margin:0"><button class=ghost data-e="${t.id}" style="width:auto;min-height:36px;padding:6px 10px">✏️</button><button class=ghost data-x="${t.id}" style="width:auto;min-height:36px;padding:6px 10px">🗑</button></div>` : ''}</div>`;
    }).join('')).join('');
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editSlot(b.dataset.e));
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer ce créneau ?')) return; const { error } = await db.from('timetable').delete().eq('id', b.dataset.x); if (error) return toast(error.message); toast('Supprimé'); drawTT(); });
}
function addSlot() {
    if (!S.cls) return toast('Sélectionne une classe');
    ask('Nouveau créneau — ' + esc((S.classes.find(c => c.id === S.cls) || {}).name || ''), [
        { n: 'day', l: 'Jour', o: [['1', 'Lundi'], ['2', 'Mardi'], ['3', 'Mercredi'], ['4', 'Jeudi'], ['5', 'Vendredi'], ['6', 'Samedi'], ['0', 'Dimanche']], v: '1' },
        { n: 'start', l: 'Heure début', t: 'time', v: '08:00' },
        { n: 'end', l: 'Heure fin', t: 'time', v: '09:00' },
        { n: 'subject', l: 'Matière' },
        { n: 'room', l: 'Salle (facultatif)', r: false }
    ], async v => {
        if (v.end <= v.start) throw Error("L'heure de fin doit être après le début");
        const { error } = await db.from('timetable').insert({ school_id: S.school.id, class_id: S.cls, year: S.year || '', day: +v.day, start_time: v.start, end_time: v.end, subject: v.subject.trim(), room: v.room.trim() || null });
        if (error) throw error; toast('Créneau ajouté'); drawTT();
    });
}
async function editSlot(id) {
    const { data: t, error } = await db.from('timetable').select('*').eq('id', id).single();
    if (error || !t) return toast('Introuvable');
    ask('Modifier le créneau', [
        { n: 'day', l: 'Jour', o: [['1', 'Lundi'], ['2', 'Mardi'], ['3', 'Mercredi'], ['4', 'Jeudi'], ['5', 'Vendredi'], ['6', 'Samedi'], ['0', 'Dimanche']], v: String(t.day) },
        { n: 'start', l: 'Heure début', t: 'time', v: hhmmP(t.start_time) },
        { n: 'end', l: 'Heure fin', t: 'time', v: hhmmP(t.end_time) },
        { n: 'subject', l: 'Matière', v: t.subject },
        { n: 'room', l: 'Salle', r: false, v: t.room || '' }
    ], async v => {
        if (v.end <= v.start) throw Error("L'heure de fin doit être après le début");
        const { error } = await db.from('timetable').update({ day: +v.day, start_time: v.start, end_time: v.end, subject: v.subject.trim(), room: v.room.trim() || null }).eq('id', id);
        if (error) throw error; toast('Modifié'); drawTT();
    });
}

// --- FIN DE LA TRANCHE 11. La tranche suivante (et dernière) commencera par : /* ---------- Initialisation finale ---------- */ ---
/* ---------- Initialisation finale ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
window.addEventListener('online', () => { S.offline ? boot() : qsync(); });
window.addEventListener('offline', qui);
setInterval(qsync, 30000);
// v90 : démarrage APRÈS le chargement de tous les modules (ambadmin.js, test.js, personnel.js…),
// sinon un téléphone lent pouvait afficher l'ancien écran ORÉA ou ignorer un module.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot()); else boot();

/* ========================================================
   PAQUET K2 — Parents & Communication (admin côté école)
   ======================================================== */
window.pAdminInbox = async function() {
    const { data } = await db.from('parent_messages').select('*, students(name)').order('created_at', { ascending: false }).limit(50);
    if (!data) return;
    const grouped = {};
    data.forEach(m => { if (!grouped[m.student_id]) grouped[m.student_id] = []; grouped[m.student_id].push(m); });
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Messages Parents</h3>`;
    if (!Object.keys(grouped).length) h += `<p class=empty>Aucun message.</p>`;
    else {
        h += Object.entries(grouped).map(([sid, msgs]) => {
            const sname = msgs[0].students?.name || 'Élève';
            return `<div class="card col"><b>${esc(sname)}</b>${msgs.slice(0, 3).map(m => `<small>${m.sender_role === 'parent' ? '👤' : '🏫'} ${esc(m.content)}</small>`).join('')}<button class=ghost onclick="pAdminReply('${sid}')">Répondre</button></div>`;
        }).join('');
    }
    $('#main').innerHTML = h;
};

window.pAdminReply = function(sid) {
    const d = show(`<form method=dialog><h3>Répondre</h3><textarea name=txt rows=3 style="width:100%" required></textarea><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Envoyer</button></div></form>`);
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        e.preventDefault();
        const txt = e.target.txt.value.trim();
        const s = S.stu.find(x => x.id === sid);
        if (!s) return;
        const { data } = await db.from('parent_links').select('parent_id').eq('student_id', sid).limit(1).single();
        if (!data || !data.parent_id) return toast('Aucun parent lié');
        await db.from('parent_messages').insert({ school_id: S.school.id, student_id: sid, parent_id: data.parent_id, sender_role: 'ecole', content: txt });
        d.close(); toast('Envoyé ✓'); pAdminInbox();
    };
};

// --- MODIFICATION : Affichage détaillé des justificatifs ---
window.pAdminJustifs = async function() {
    const { data } = await db.from('absence_justifications').select('*, students(name)').eq('status', 'en_attente').order('created_at');
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Justificatifs en attente</h3>`;
    if (!data || !data.length) h += `<p class=empty>Aucun justificatif à traiter.</p>`;
    else h += data.map(j => {
        const typeLabel = j.type === 'absence' ? 'Absence' : j.type === 'retard' ? 'Retard' : j.type === 'depart' ? 'Départ anticipé' : 'Autre';
        const timeTxt = j.time ? ` à ${j.time}` : '';
        const endTxt = j.end_date ? ` (jusqu'au ${new Date(j.end_date + 'T00:00').toLocaleDateString('fr-FR')})` : '';
        return `<div class="card col"><b>${esc(j.students?.name || '')} · ${typeLabel} · ${new Date(j.day + 'T00:00').toLocaleDateString('fr-FR')}${timeTxt}${endTxt}</b><small>${esc(j.reason)}</small><div class=row><button onclick="pAdminJustifAct('${j.id}','approuve', '${j.student_id}', '${j.day}', '${j.end_date || ''}')">Approuver</button><button class=ghost onclick="pAdminJustifAct('${j.id}','refuse')">Refuser</button></div></div>`;
    }).join('');
    $('#main').innerHTML = h;
};

// --- MODIFICATION : Mise à jour de l'appel si approuvé ---
window.pAdminJustifAct = async function(id, st, studentId, day, endDate) {
    const { error: ue } = await db.from('absence_justifications').update({ status: st }).eq('id', id);
    if (ue) return toast(ue.message);
    if (st === 'approuve' && studentId && day) {
        // Mise à jour automatique de l'appel
        const dates = [day];
        if (endDate) {
            let d = new Date(day + 'T00:00');
            const end = new Date(endDate + 'T00:00');
            while (d < end) {
                d.setDate(d.getDate() + 1);
                if (d <= end && d.getDay() !== 0) dates.push(d.toLocaleDateString('sv-SE'));
            }
        }
        const rows = dates.map(d => ({ school_id: S.school.id, student_id: studentId, day: d, status: 'present' }));
        const { error: ae } = await db.from('attendance').upsert(rows, { onConflict: 'student_id,day' });
        toast(ae ? 'Justificatif accepté, mais l’appel n’a pas pu être mis à jour : ' + ae.message : 'Justificatif accepté et présence mise à jour ✓');
    } else {
        toast('Mis à jour');
    }
    pAdminJustifs();
};

// --- MODIFICATION : Date de fin pour les annonces ---
window.pAdminAnnonce = function() {
    const d = show(`<form method=dialog><h3>Nouvelle annonce</h3><label>Titre<input name=titre required></label><label>Contenu<textarea name=txt rows=4 style="width:100%" required></textarea></label><label>Date de fin (facultatif)<input type="date" name=end></label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Publier</button></div></form>`);
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        e.preventDefault();
        const f = e.target;
        await db.from('announcements').insert({ school_id: S.school.id, author_id: S.me.id, title: f.titre.value.trim(), content: f.txt.value.trim(), end_date: f.end.value || null });
        d.close(); toast('Annonce publiée ✓');
    };
};

/* ---------- Fonctions de classe (seront fournies dans une autre tranche) ---------- */
window.openDevoirsClasse = window.openDevoirsClasse || (() => menuGo('devoirs'));
window.openHoraireClasse = window.openHoraireClasse || (() => menuGo('emploi_temps'));
window.openSanctionsClasse = window.openSanctionsClasse || (() => menuGo('sanctions'));

/* ---------- Sous-menus (placeholders, remplacés plus tard) ---------- */
function subMenuPage(title, cards) { $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div><h3>' + title + '</h3>' + cards; }
// Repli pour les rôles autres que directeur (finance.js remplace cette page pour le directeur)
function vFinanceHome() {
    subMenuPage('Finance', menuCard('impayes', 'Impayés', 'Élèves à relancer', "menuGo('impayes')") + (fin() ? menuCard('depenses', 'Dépenses', null, "menuGo('depenses')") + menuCard('bilan', 'Bilan mensuel', null, "menuGo('bilan')") : ''));
}
function vProgrammeHome() {
    subMenuPage('Programme', menuCard('calendrier', 'Calendrier scolaire', 'Événements à venir', "menuGo('calendrier')") + menuCard('emploi_temps', 'Emploi du temps', 'Par classe', "menuGo('emploi_temps')"));
}
function vDonneesHome() {
    if (!fin()) { S.tab = 'menu'; return render(); }
    subMenuPage('Données', menuCard('exports', 'Exporter', 'Élèves · Paiements · Caisse (CSV / PDF / PNG)', 'exportMenu()') + menuCard('rapport', 'Rapport mensuel', 'PDF ou image', 'monthReport()') + menuCard('sauvegarde', 'Sauvegarde complète', 'Fichier JSON à garder', 'runBackup()') + menuCard('journal', 'Journal d’activité', 'Qui a modifié quoi', 'journal()'));
}
async function runBackup() { try { toast('Sauvegarde en cours…'); await backupAll(); } catch (e) { toast(e.message || 'Sauvegarde impossible'); } }
function openQuiz() { if (window.OreaQuizUI && OreaQuizUI.openNewGame) OreaQuizUI.openNewGame(); else toast('Le module Quiz n’est pas chargé.'); }


/* =====================================================================
   LOT 3 — Vue classe, présence, plan de paiement
   ===================================================================== */
// Boutons de la vue classe (sans emojis). Encaisser : directeur + percepteur ; le reste : directeur + enseignant
function classBtns() {
    const R = S.me.role, B = [];
    if (canCollect() && colOK(S.cls)) B.push(['classPay()', 'Encaisser', 1]);
    if (R === 'directeur' || R === 'enseignant' || R === 'percepteur') B.push(['classAtt()', 'Présence'], ['openCotation()', 'Cotation'], ['openDevoirsClasse()', 'Devoirs'], ['openHoraireClasse()', 'Horaire'], ['openSanctionsClasse()', 'Sanctions']);
    return B.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">${B.map(b => `<button class="${b[2] ? '' : 'ghost'}" style="width:auto" onclick="${b[0]}">${b[1]}</button>`).join('')}</div>` : '';
}
// Encaisser depuis la classe : liste des élèves, la plus grosse dette du trimestre en premier
function classPay() {
    const c = S.classes.find(x => x.id === S.cls); if (!c) return;
    const k0 = curTerm(cy(c)), k = Math.max(1, k0 || 1);
    const due = s => k0 === null ? Math.max(0, Number(s.balance_cdf || 0)) : trims(s)[k - 1][1];
    const l = S.stu.filter(s => s.class_id === c.id).sort((a, b) => due(b) - due(a) || a.name.localeCompare(b.name, 'fr'));
    const d = show(`<h3>Encaisser · ${esc(c.name)}</h3><small>${k0 === null ? 'Classés par solde dû' : 'Classés par dette du trimestre ' + k}</small><input id=cpq type=search placeholder="Rechercher un élève" autocomplete=off><div id=cpl></div><button class=ghost id=cpx>Fermer</button>`);
    const draw = () => {
        const q = nrm(d.querySelector('#cpq').value).trim(), L = l.filter(s => !q || nrm(s.name).includes(q));
        d.querySelector('#cpl').innerHTML = L.length ? L.map(s => `<div class=card data-s="${esc(s.id)}" style="cursor:pointer"><span>${esc(s.name)}</span>${due(s) > 0 ? `<b class=due>${fmt(due(s))}</b>` : '<b class=ok>✓</b>'}</div>`).join('') : '<p class=empty>Aucun élève.</p>';
        d.querySelectorAll('[data-s]').forEach(e => e.onclick = () => pay(e.dataset.s));
    };
    d.querySelector('#cpq').oninput = draw; d.querySelector('#cpx').onclick = () => d.close(); draw();
}
// Présence depuis la classe : ouvre l'appel de CETTE classe, le retour ramène à la classe
function classAtt() {
    history.pushState({ att: 1 }, '');
    S.attFromCls = true;
    menuGo('presences'); // S.cls est déjà la classe affichée
}
function attBack() { if (S.attFromCls && history.state && history.state.att) { history.back(); return; } attLeave(); }
function attLeave() { const f = S.attFromCls; S.attFromCls = false; if (f) { S.tab = 'eleves'; S.view = 'class'; } else S.tab = 'menu'; render(); }

// Horaire par défaut : appliqué automatiquement par la base à la création de chaque classe (déclencheur trg_classes_default_tt)

// ---------- Plan de paiement (échéances promises) ----------
const PPS0 = { prevu: ['Prévu', ''], tenu: ['Tenu ✓', 'ok'], non_tenu: ['Non tenu', 'due'] }, PPS = new Proxy(PPS0, { get: (o, k) => o[k] || o.prevu });
const addD = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE');
async function ppOpen(id) {
    const s = S.stu.find(x => x.id === id); if (!s) return;
    const { data, error } = await db.from('payment_plans').select('*').eq('student_id', id).order('due_date');
    if (error) return toast(error.message);
    const L = data || [], c = S.classes.find(x => x.id === s.class_id), yr = c ? cy(c) : S.year;
    const d = show(`<h3>Plan de paiement · ${esc(s.name)}</h3><small>Les versements promis par le parent. Si une échéance n’est pas versée à temps, un message ORÉA est envoyé automatiquement au parent le lendemain matin.</small>`
        + (L.length ? L.map(p => `<div class=card><span>${fdate(p.due_date)}<br><small class="${PPS[p.status][1]}">${PPS[p.status][0]}</small></span><span style="text-align:right"><b>${fmt(p.amount_cdf)}</b>${p.status === 'prevu' ? `<br><button class=ghost style="width:auto;min-height:0;padding:3px 10px;font-size:12px;margin-top:4px" data-del="${esc(p.id)}">Retirer</button>` : ''}</span></div>`).join('') : '<p class=empty data-ic="🗓️">Aucune échéance.</p>')
        + `<div class=col><button id=ppa>+ Ajouter une échéance</button><button class=ghost id=ppg>Créer un échéancier</button><button class=ghost id=ppb>Retour</button></div>`);
    const ins = async rows => {
        const k = curTerm(yr);
        const { error } = await db.from('payment_plans').insert(rows.map(r => ({ school_id: S.school.id, student_id: id, year: yr, term: k > 0 ? k : null, due_date: r.date, amount_cdf: Math.round(r.cdf * 100) / 100 })));
        if (error) throw error;
        toast(rows.length > 1 ? rows.length + ' échéances créées' : 'Échéance ajoutée'); ppOpen(id);
    };
    d.querySelector('#ppb').onclick = () => hist(id);
    d.querySelector('#ppa').onclick = () => ask('Nouvelle échéance', [{ n: 'date', l: 'Date promise', t: 'date', v: addD(7) }, { n: 'amount', l: 'Montant', t: 'number' }, { n: 'cur', l: 'Devise', o: CUR.map(x => [x, x]), v: S.cur }], async v => {
        if (!(+v.amount > 0)) throw Error('Montant invalide');
        if (v.date < tdy()) throw Error('La date est déjà passée');
        await ins([{ date: v.date, cdf: +v.amount * rateOf(v.cur) }]);
    });
    d.querySelector('#ppg').onclick = () => {
        const k0 = c ? curTerm(cy(c)) : null, dette = k0 === null ? Math.max(0, Number(s.balance_cdf || 0)) : trims(s)[Math.max(1, k0) - 1][1];
        ask('Créer un échéancier', [
            { n: 'total', l: 'Montant total à étaler', t: 'number', v: dette > 0 ? Math.round(dette / rateOf(S.cur) * 100) / 100 : '' },
            { n: 'cur', l: 'Devise', o: CUR.map(x => [x, x]), v: S.cur },
            { n: 'n', l: 'Nombre de versements', t: 'number', v: 3 },
            { n: 'first', l: 'Date du 1er versement', t: 'date', v: addD(7) },
            { n: 'step', l: 'Rythme', o: [['7', 'Chaque semaine'], ['14', 'Toutes les 2 semaines'], ['m', 'Chaque mois']], v: '14' }
        ], async v => {
            const n = Math.round(+v.n), tot = +v.total * rateOf(v.cur);
            if (!(tot > 0)) throw Error('Montant invalide');
            if (!(n >= 1 && n <= 24)) throw Error('Entre 1 et 24 versements');
            if (v.first < tdy()) throw Error('La première date est déjà passée');
            const part = Math.floor(tot / n * 100) / 100, rows = [];
            for (let i = 0; i < n; i++) {
                const [y, m, dd] = v.first.split('-').map(Number);
                const dt = v.step === 'm' ? new Date(y, m - 1 + i, dd) : new Date(y, m - 1, dd + i * +v.step);
                rows.push({ date: dt.toLocaleDateString('sv-SE'), cdf: i === n - 1 ? tot - part * (n - 1) : part });
            }
            await ins(rows);
        });
    };
    d.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (!confirm('Retirer cette échéance ?')) return;
        const { error } = await db.from('payment_plans').delete().eq('id', b.dataset.del);
        if (error) return toast(error.message);
        ppOpen(id);
    });
}
// Après un encaissement : coche « tenu » les échéances couvertes (même règle que le contrôle automatique du matin)
async function ppSync(id) {
    try {
        const { data: pl } = await db.from('payment_plans').select('*').eq('student_id', id).order('due_date');
        if (!pl || !pl.length) return;
        const years = [...new Set(pl.map(p => p.year))], ok = [];
        for (const y of years) {
            const L = pl.filter(p => p.year === y), from = L.map(p => p.created_at).sort()[0];
            const { data: py } = await db.from('payments').select('amount_cdf').eq('student_id', id).gte('created_at', from);
            const paid = (py || []).reduce((t, x) => t + Number(x.amount_cdf || 0), 0);
            let cum = 0;
            L.forEach(p => { cum += Number(p.amount_cdf); if (p.status !== 'tenu' && paid >= cum) ok.push(p.id); });
        }
        if (ok.length) { await db.from('payment_plans').update({ status: 'tenu' }).in('id', ok); toast(ok.length + ' échéance(s) du plan de paiement respectée(s) ✓'); }
    } catch (_) { }
}
// Accueil (directeur, percepteur) : échéances de demain + promesses non tenues
async function ppHome() {
    const { data, error } = await db.from('payment_plans').select('*').eq('school_id', S.school.id).in('status', ['prevu', 'non_tenu']).gte('due_date', addD(-30)).lte('due_date', addD(1)).order('due_date');
    if (error || S.tab !== 'accueil') return;
    const ids = new Set(S.stu.map(x => x.id)), L = (data || []).filter(p => ids.has(p.student_id) && (p.status === 'non_tenu' || p.due_date === addD(1)));
    if (!L.length || !$('#main') || $('#pph')) return;
    const nT = L.filter(p => p.status === 'prevu').length, nN = L.length - nT;
    $('#main').insertAdjacentHTML('afterbegin', `<div class=card id=pph style="cursor:pointer;border-color:var(--gold)"><span><b>Promesses de paiement</b><br><small>${nT ? nT + ' à verser demain' : ''}${nT && nN ? ' · ' : ''}${nN ? nN + ' non tenue' + (nN > 1 ? 's' : '') : ''}</small></span><b>›</b></div>`);
    $('#pph').onclick = () => {
        const D = fin(), nm = id => (S.stu.find(x => x.id === id) || {}).name || 'Élève';
        const msg = p => p.status === 'non_tenu'
            ? `Bonjour, ici ${S.school.name}. Le versement de ${fmt(p.amount_cdf)} prévu le ${fdate(p.due_date)} pour ${nm(p.student_id)} n’a pas encore été reçu. Merci de régulariser ou de contacter l’école.`
            : `Bonjour, ici ${S.school.name}. Petit rappel : le versement de ${fmt(p.amount_cdf)} pour ${nm(p.student_id)} est prévu demain (${fdate(p.due_date)}). Merci !`;
        const d = show(`<h3>Promesses de paiement</h3>${L.map((p, i) => { const st = S.stu.find(x => x.id === p.student_id) || {}; return `<div class="card col"><div style="display:flex;justify-content:space-between"><b>${esc(nm(p.student_id))}</b><b>${fmt(p.amount_cdf)}</b></div><small class="${PPS[p.status][1]}">${fdate(p.due_date)} · ${PPS[p.status][0]}</small><div class=row>${st.parent_phone ? `<button class=ghost data-w=${i}>WhatsApp</button><button class=ghost data-sm=${i}>SMS</button>` : ''}${D ? `<button class=ghost data-o=${i}>ORÉA</button>` : ''}<button class=ghost data-p=${i}>Paiement</button></div></div>`; }).join('')}<button class=ghost id=ppx>Fermer</button>`);
        d.querySelector('#ppx').onclick = () => d.close();
        d.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const p = L[b.dataset.w], st = S.stu.find(x => x.id === p.student_id), u = st && waLink(st.parent_phone, msg(p)); if (u) window.open(u, '_blank'); else toast('Numéro invalide'); });
        d.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => { const p = L[b.dataset.sm], st = S.stu.find(x => x.id === p.student_id); if (st) openSms(st.parent_phone, msg(p)); });
        d.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => {
            const p = L[b.dataset.o]; b.disabled = true;
            const { error } = await db.from('messages').insert({ school_id: S.school.id, channel: 'parent_ecole', thread_key: 'student:' + p.student_id, student_id: p.student_id, content: msg(p) });
            if (error) { b.disabled = false; return toast(error.message); }
            b.textContent = 'Envoyé ✓'; toast('Rappel envoyé dans ORÉA');
        });
        d.querySelectorAll('[data-p]').forEach(b => b.onclick = () => hist(L[b.dataset.p].student_id));
    };
}
const _vAccueil0 = vAccueil;
vAccueil = async function () {
    const r = await _vAccueil0.apply(this, arguments);
    try { if (canCollect() && S.tab === 'accueil') ppHome(); } catch (_) { }
    return r;
};

/* =====================================================================
   LOT 4 — Export PNG commun (même tableau que les PDF : titre, colonnes, lignes, total)
   ===================================================================== */
async function mkPng(o) {
    const cols = o.head.length, W = cols > 5 ? 1400 : 960, M = 50, RH = 40, PP = 30, rt = o.r || [];
    const tw = o.w.reduce((a, b) => a + b, 0), cw = o.w.map(x => x * (W - 2 * M) / tw);
    const tx = v => typeof v === 'number' ? nf(v, v % 1 ? 2 : 0) : String(v ?? '');
    const items = o.rows.map(c => ({ c })).concat(o.tot ? [{ c: o.tot, b: 1 }] : []);
    const N = Math.max(1, Math.ceil(items.length / PP));
    if (N > 15 && !confirm(N + ' images vont être créées. Continuer ?')) throw Error('Export annulé');
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'logo-light.png'; });
    const files = [], base = o.name || 'export';
    for (let p = 0; p < N; p++) {
        const rows = items.slice(p * PP, (p + 1) * PP), y0 = 170, H = y0 + (rows.length + 1) * RH + 100;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
        const cut = (t, w) => { if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
        x.fillStyle = '#fffdf6'; x.fillRect(0, 0, W, H);
        const gg = x.createLinearGradient(0, 0, W, H); gg.addColorStop(0, '#e9cf86'); gg.addColorStop(.5, '#b08a30'); gg.addColorStop(1, '#8a6a1f');
        x.strokeStyle = gg; x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28); x.lineWidth = 1; x.strokeRect(24, 24, W - 48, H - 48);
        if (im) x.drawImage(im, 44, 44, 70, 70);
        x.textAlign = 'left'; x.fillStyle = '#111211'; x.font = 'bold 26px Georgia,serif'; x.fillText(cut(o.title || '', W - 190), 130, 74);
        x.fillStyle = '#6b6a60'; x.font = '16px sans-serif'; x.fillText(cut(o.sub || '', W - 190), 130, 101);
        if (N > 1) x.fillText('Page ' + (p + 1) + ' / ' + N, 130, 125);
        x.fillStyle = '#d8b76a'; x.fillRect(M, y0, W - 2 * M, RH);
        const line = (cells, yy, bold) => {
            let cx = M;
            cells.forEach((v, j) => {
                x.font = (bold ? 'bold ' : '') + '15px sans-serif'; x.fillStyle = '#111211';
                const t = cut(tx(v), cw[j] - 12);
                if (rt.includes(j)) { x.textAlign = 'right'; x.fillText(t, cx + cw[j] - 6, yy); } else { x.textAlign = 'left'; x.fillText(t, cx + 6, yy); }
                cx += cw[j];
            });
        };
        line(o.head, y0 + 26, true);
        rows.forEach((it, i) => {
            const yy = y0 + (i + 1) * RH;
            if (it.b) { x.fillStyle = gg; x.fillRect(M, yy, W - 2 * M, 2); }
            else if (i % 2) { x.fillStyle = '#f7f1e0'; x.fillRect(M, yy, W - 2 * M, RH); }
            line(it.c, yy + 26, !!it.b);
        });
        x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '14px sans-serif'; x.fillText('Édité le ' + new Date().toLocaleDateString('fr-FR') + ' — ORÉA École', W / 2, H - 44);
        const blob = await new Promise(r => cv.toBlob(r, 'image/png')), fn = fnm(base + (N > 1 ? '-p' + (p + 1) : ''), 'png');
        files.push({ blob, fn, url: URL.createObjectURL(blob), file: new File([blob], fn, { type: 'image/png' }) });
    }
    return files;
}
// Fenêtre commune : Partager / Télécharger + aperçu
function pngShow(files, title) {
    const N = files.length, fl = files.map(f => f.file), can = !!(navigator.canShare && navigator.canShare({ files: fl }));
    const d = show(`<h3>${esc(title || 'Image')} · ${N} image${N > 1 ? 's' : ''}</h3><div class=col><button id=gs>📤 Partager</button><button class=ghost id=gd>Télécharger</button><button class=ghost id=gc>Fermer</button></div>${files.slice(0, 6).map(f => `<img src="${f.url}" alt="" style="width:100%;margin-top:8px;border-radius:8px">`).join('')}${N > 6 ? `<small>… et ${N - 6} autre(s) image(s)</small>` : ''}`);
    d.querySelector('#gc').onclick = () => d.close();
    d.querySelector('#gd').onclick = () => { files.forEach(f => dl(f.blob, f.fn)); toast(N > 1 ? 'Images enregistrées dans Téléchargements' : 'Image enregistrée dans Téléchargements'); };
    d.querySelector('#gs').onclick = async () => { if (can) { try { await navigator.share({ files: fl, text: (title || '') + ' — ' + S.school.name }); } catch (e) { if (e.name !== 'AbortError') toast('Partage impossible.'); } } else { files.forEach(f => dl(f.blob, f.fn)); toast('Image enregistrée.'); } };
}
async function pngOut(o) { pngShow(await mkPng(o), o.title); }


/* =====================================================================
   PAQUET 2 — Horaire du jour (enseignant / percepteur) et « Ma perception »
   ===================================================================== */
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const nrmS = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function myCourses() {
    const { data, error } = await db.from('teacher_subjects').select('class_id, subject_id, subjects(name), classes(name)').eq('teacher_id', S.me.id).eq('year', S.year || '');
    if (error) return { error };
    return { data: data || [] };
}
// Créneaux de l'enseignant : ceux qui lui sont attribués, ou ceux de ses classes dont la matière est l'un de ses cours
async function myDay(day) {
    const mc = await myCourses(); if (mc.error) return mc;
    const cls = [...new Set(mc.data.map(x => x.class_id))];
    const subs = new Set(mc.data.map(x => x.class_id + '|' + nrmS(x.subjects && x.subjects.name)));
    const [a, b] = await Promise.all([
        cls.length ? db.from('timetable').select('*').in('class_id', cls).eq('day', day) : { data: [] },
        db.from('timetable').select('*').eq('teacher_id', S.me.id).eq('day', day)
    ]);
    if (a.error || b.error) return { error: a.error || b.error };
    const seen = new Set(), out = [];
    (b.data || []).concat((a.data || []).filter(t => !t.is_special && subs.has(t.class_id + '|' + nrmS(t.subject)))).forEach(t => { if (!seen.has(t.id)) { seen.add(t.id); out.push(t); } });
    out.sort((x, y) => String(x.start_time).localeCompare(String(y.start_time)));
    return { data: out, courses: mc.data.length };
}
async function drawMyDay(day) {
    const el = document.getElementById('tday'); if (!el) return;
    const today = new Date().getDay(); if (day == null) day = S.tdDay != null ? S.tdDay : (today === 0 ? 1 : today);
    S.tdDay = day;
    const chips = [1, 2, 3, 4, 5, 6].map(d => `<button class="chip ${d === day ? 'on' : ''}" data-td=${d}>${DAYS[d].slice(0, 3)}</button>`).join('');
    el.innerHTML = `<div class="card col"><b>Mon horaire · ${DAYS[day]}${day === today ? ' (aujourd’hui)' : ''}</b><div class=chips style="margin:6px 0">${chips}</div><div id=tdl><div class=sk></div></div></div>`;
    el.querySelectorAll('[data-td]').forEach(b => b.onclick = () => drawMyDay(+b.dataset.td));
    const r = await myDay(day), l = document.getElementById('tdl'); if (!l || S.tdDay !== day) return;
    const hh = t => String(t || '').slice(0, 5), cn = id => (S.classes.find(c => c.id === id) || {}).name || '';
    if (r.error) { l.innerHTML = `<small>Horaire indisponible pour le moment.</small>`; return; }
    if (!r.courses && !r.data.length) { l.innerHTML = `<small>Aucun cours ne vous a encore été attribué. La direction peut le faire dans « Équipe & Cours ».</small>`; return; }
    l.innerHTML = r.data.length ? r.data.map(t => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span><b>${hh(t.start_time)} – ${hh(t.end_time)}</b> · ${esc(t.subject)}</span><small>${esc(cn(t.class_id))}${t.room ? ' · ' + esc(t.room) : ''}</small></div>`).join('') : `<small>Pas de cours ce ${DAYS[day].toLowerCase()}.</small>`;
}
const _vAccueil1 = vAccueil;
vAccueil = async function () {
    const r = await _vAccueil1.apply(this, arguments);
    try { if (isTeach() && S.tab === 'accueil') drawMyDay(); } catch (_) { }
    try { if (dir() && !secr() && S.tab === 'accueil') sancHome(); } catch (_) { }
    return r;
};

async function sancHome() {
    const { data, error } = await db.from('sanction_requests').select('id').eq('status', 'en_attente');
    if (error || !(data || []).length || S.tab !== 'accueil' || $('#sqh')) return;
    const n = data.length, m = $('#main'); if (!m) return;
    m.insertAdjacentHTML('afterbegin', `<div class=menu-card id=sqh onclick="menuGo('sanctions')" style="border-color:var(--gold)"><div class=menu-ic>${svgI('sanctions')}</div><div class=menu-label>Sanctions à valider<small>Proposées par les enseignants</small></div><b class=due style="font-family:var(--serif);font-size:18px">${n}</b><span class=menu-arrow>›</span></div>`);
}
// Suppression de son propre compte (confirmation : « SUPPRIMER MON COMPTE »)
function deleteAccount() {
    const d = show(`<h3>Supprimer mon compte</h3><p>Votre compte sera définitivement supprimé et vous serez déconnecté. Les paiements, reçus et notes déjà enregistrés restent dans l’école.</p><p>Vous pourrez créer un nouveau compte plus tard avec la même adresse e-mail.</p><label>Pour confirmer, tapez : <b>SUPPRIMER MON COMPTE</b><input id=dcx autocomplete=off autocapitalize=characters></label><div class=col><button id=dcok style="background:var(--bad);color:#fff" disabled>Supprimer définitivement</button><button class=ghost id=dcno>Annuler</button></div>`);
    const inp = d.querySelector('#dcx'), ok = d.querySelector('#dcok');
    inp.oninput = () => { ok.disabled = inp.value.trim() !== 'SUPPRIMER MON COMPTE'; };
    d.querySelector('#dcno').onclick = () => d.close();
    ok.onclick = async () => {
        ok.disabled = true;
        const { error } = await db.rpc('delete_my_account', { p_confirm: inp.value.trim() });
        if (error) { ok.disabled = false; return toast(error.message); }
        try { Object.keys(localStorage).filter(k => k.startsWith('orea')).forEach(k => localStorage.removeItem(k)); } catch (_) { }
        try { await db.auth.signOut(); } catch (_) { }
        alert('Votre compte a été supprimé.'); location.reload();
    };
}
// « Ma perception » : uniquement ce que le percepteur a lui-même encaissé
async function vPerception() {
    const back = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>';
    if (!canCollect()) { $('#main').innerHTML = back + '<p class=empty>Accès réservé au percepteur.</p>'; return; }
    $('#main').innerHTML = back + SK;
    S.perP = S.perP || 'mois';
    const now = new Date(), d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    let from = new Date(d0);
    if (S.perP === 'semaine') from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    if (S.perP === 'mois') from = new Date(now.getFullYear(), now.getMonth(), 1);
    if (S.perP === 'trimestre') { const tm = S.terms[S.year] || {}, k = curTerm(S.year) || 1, st = tm['t' + k]; from = st ? new Date(st + 'T00:00') : new Date(now.getFullYear(), now.getMonth(), 1); }
    if (S.perP === 'annee') { const tm = S.terms[S.year] || {}; from = tm.t1 ? new Date(tm.t1 + 'T00:00') : new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1); }
    const iso = from.toISOString();
    const [p, f] = await Promise.all([
        pageAll(() => db.from('payments').select('id,student_id,amount,currency,amount_cdf,method,term,receipt_no,created_at').eq('collector_id', S.me.id).gte('created_at', iso)),
        pageAll(() => db.from('fee_payments').select('id,student_id,amount,currency,amount_cdf,method,fee_name,receipt_no,created_at').eq('collector_id', S.me.id).gte('created_at', iso))
    ]);
    if (S.tab !== 'perception') return;
    if (p.error || f.error) { $('#main').innerHTML = back + `<p class=empty>${esc((p.error || f.error).message)}</p>`; return; }
    const L = p.data.map(x => Object.assign({ what: 'T' + x.term }, x)).concat(f.data.map(x => Object.assign({ what: x.fee_name || 'Autres frais' }, x))).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const tot = L.reduce((a, x) => a + Number(x.amount_cdf || 0), 0), esp = L.filter(x => x.method === 'especes').reduce((a, x) => a + Number(x.amount_cdf || 0), 0);
    const P = [['jour', 'Aujourd’hui'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année']];
    const nm = id => S.stu.find(s => s.id === id) || {};
    let h = back + `<h3>Ma perception</h3><div class=chips>${P.map(x => `<button class="chip ${S.perP === x[0] ? 'on' : ''}" data-pp=${x[0]}>${x[1]}</button>`).join('')}</div>`;
    h += `<div class="card hero"><small>Total encaissé par moi</small><span class=big>${fmt(tot)}</span></div>`;
    h += `<div class=stat-pair><div class="card stat"><span>Espèces</span><b>${fmt(esp)}</b></div><div class="card stat"><span>Mobile Money</span><b>${fmt(tot - esp)}</b></div></div>`;
    h += `<p style="margin:12px 0 4px"><small>QUI A PAYÉ QUOI · ${L.length} paiement(s)</small></p>`;
    h += L.length ? L.map(x => { const s = nm(x.student_id); return `<div class=card><span>${esc(s.name || 'Élève')}<br><small>${esc(cnm(s.class_id))} · ${esc(x.what)} · ${new Date(x.created_at).toLocaleDateString('fr-FR')}${x.receipt_no ? ' · REC-' + String(x.receipt_no).padStart(4, '0') : ''}</small></span><b>${fmt(Number(x.amount_cdf || 0))}</b></div>`; }).join('') : '<p class=empty>Aucun encaissement sur cette période.</p>';
    $('#main').innerHTML = h;
    document.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { S.perP = b.dataset.pp; vPerception(); });
}


/* =====================================================================
   PAQUET 4 — Pointage du personnel et code PIN
   ===================================================================== */
async function pointage() {
    const d0 = tdy(), hm = t => t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    if (!dir()) {
        const { data, error } = await db.from('staff_checkins').select('*').eq('user_id', S.me.id).order('day', { ascending: false }).limit(10);
        if (error) return toast(error.message);
        const t = (data || []).find(x => x.day === d0);
        const d = show(`<h3>Pointage</h3><div class=stat-pair><div class="card stat"><span>Arrivée</span><b>${hm(t && t.in_at)}</b></div><div class="card stat"><span>Départ</span><b>${hm(t && t.out_at)}</b></div></div><div class=col>${!t || !t.in_at ? '<button id=pin1>Je suis arrivé(e)</button>' : !t.out_at ? '<button id=pout>Je pars</button>' : '<p class=ok style="text-align:center">✓ Journée pointée</p>'}<button class=ghost id=pcx>Fermer</button></div><p style="margin:12px 0 4px"><small>MES DERNIERS JOURS</small></p>${(data || []).map(x => `<div class=card><span>${fdate(x.day)}</span><small>${hm(x.in_at)} → ${hm(x.out_at)}</small></div>`).join('') || '<small>Aucun pointage.</small>'}`);
        d.querySelector('#pcx').onclick = () => d.close();
        const go = async (field) => {
            const now = new Date().toISOString();
            const r = t ? await db.from('staff_checkins').update({ [field]: now }).eq('id', t.id) : await db.from('staff_checkins').insert({ school_id: S.school.id, user_id: S.me.id, day: d0, [field]: now });
            if (r.error) return toast(r.error.message);
            toast(field === 'in_at' ? 'Arrivée enregistrée ✓' : 'Départ enregistré ✓'); pointage();
        };
        const a = d.querySelector('#pin1'), b = d.querySelector('#pout');
        if (a) a.onclick = () => go('in_at'); if (b) b.onclick = () => go('out_at');
        return;
    }
    S.ptDay = S.ptDay || d0;
    const [{ data: pr, error: e1 }, { data: ck, error: e2 }] = await Promise.all([
        db.from('profiles').select('id,full_name,role,active,etudes').eq('school_id', S.school.id).in('role', ['enseignant', 'percepteur', 'directeur']).order('full_name'),
        db.from('staff_checkins').select('*').eq('day', S.ptDay)
    ]);
    if (e1 || e2) return toast((e1 || e2).message);
    const by = Object.fromEntries((ck || []).map(x => [x.user_id, x])), L = (pr || []).filter(p => p.active !== false && p.id !== S.me.id);
    const nIn = L.filter(p => by[p.id] && by[p.id].in_at).length;
    const d = show(`<h3>Pointage de l’équipe</h3><input type=date id=ptd value="${S.ptDay}"><small>${nIn} / ${L.length} présent(s)</small>${L.map(p => { const x = by[p.id]; return `<div class=card><span>${esc(p.full_name)}<br><small>${esc(roleTitle(p))}</small></span>${x && x.in_at ? `<small class=ok>${hm(x.in_at)} → ${hm(x.out_at)}</small>` : '<small class=due>Non pointé</small>'}</div>`; }).join('')}<button class=ghost id=pcx>Fermer</button>`);
    d.querySelector('#pcx').onclick = () => d.close();
    d.querySelector('#ptd').onchange = e => { S.ptDay = e.target.value; pointage(); };
}

// Code PIN : protège l'app sur un téléphone partagé (stocké chiffré sur CE téléphone uniquement)
const pinKey = () => 'orea_pin_' + (S.me ? S.me.id : '');
const pinGet = () => { try { return localStorage.getItem(pinKey()); } catch (_) { return null; } };
async function pinHash(p) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('orea:' + (S.me ? S.me.id : '') + ':' + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function pinSetup() {
    const has = !!pinGet();
    ask(has ? 'Modifier le code PIN' : 'Activer un code PIN', [{ n: 'p1', l: 'Nouveau code (4 chiffres) — laisser vide pour retirer le code', t: 'password', r: !has }, { n: 'p2', l: 'Confirmer le code', t: 'password', r: false }], async v => {
        const a = (v.p1 || '').trim(), b = (v.p2 || '').trim();
        if (!a && has) { localStorage.removeItem(pinKey()); toast('Code PIN retiré'); return render(); }
        if (!/^\d{4}$/.test(a)) throw Error('Le code doit contenir exactement 4 chiffres');
        if (a !== b) throw Error('Les deux codes ne sont pas identiques');
        localStorage.setItem(pinKey(), await pinHash(a)); toast('Code PIN activé ✓'); render();
    });
}
let pinHiddenAt = 0, pinShown = false;
function pinLock() {
    if (pinShown || !S.me || !pinGet()) return;
    pinShown = true;
    const ov = document.createElement('div');
    ov.id = 'pinov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px';
    ov.innerHTML = `<img src="icon-192.png" alt="" style="width:72px;height:72px;border-radius:16px"><b style="font-family:var(--serif);font-size:20px;color:var(--gold)">Code PIN</b><input id=pinin type=password inputmode=numeric maxlength=4 autocomplete=off style="max-width:200px;text-align:center;font-size:28px;letter-spacing:.5em"><small id=pinm></small><a href="#" id=pinout style="font-size:12px;color:var(--mut)">Code oublié ? Se déconnecter</a>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('#pinin'); setTimeout(() => inp.focus(), 100);
    inp.oninput = async () => {
        if (inp.value.length < 4) return;
        if (await pinHash(inp.value) === pinGet()) { ov.remove(); pinShown = false; }
        else { ov.querySelector('#pinm').textContent = 'Code incorrect'; inp.value = ''; if (navigator.vibrate) navigator.vibrate(120); }
    };
    ov.querySelector('#pinout').onclick = e => { e.preventDefault(); localStorage.removeItem(pinKey()); out(); };
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pinHiddenAt = Date.now();
    else if (pinHiddenAt && Date.now() - pinHiddenAt > 120000) pinLock(); // verrouillage après 2 min en arrière-plan
});
const _vAccueil2 = vAccueil;
let pinFirst = true;
vAccueil = async function () {
    if (pinFirst) { pinFirst = false; pinLock(); }
    return _vAccueil2.apply(this, arguments);
};

// --- FIN DU FICHIER APP.JS ---
