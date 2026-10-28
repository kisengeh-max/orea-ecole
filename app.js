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
    me: null, school: null, classes: [], stu: [], cls: null, sort: 'alpha', tab: 'accueil',
    cur: localStorage.cur || 'CDF', year: null, q: '', ft: 'all', offline: false,
    fees: [], fpaid: {}, terms: {}, depenses: [], depDate: null, bilDate: null,
    impcls: '', impf: 'all', imps: 'anciennete', _bilan: null, events: [], evMonth: null,
    absM: null, sanM: null
};

document.documentElement.dataset.theme = localStorage.theme || 'dark';

const dir = () => S.me.role === 'directeur';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n, d = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
const fmt = n => nf(n / (S.school.rates[S.cur] || 1), S.cur === 'CDF' ? 0 : 2) + ' ' + SYM[S.cur];
const isNet = e => !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0 || /fetch|network|abort|load failed|timed? ?out/i.test(e.message || ''));
const toast = m => {
    m = /failed to fetch|networkerror|network request|abort|load failed/i.test(m) ? 'Pas de connexion internet.' : m;
    const t = $('#toast');
    t.textContent = m;
    t.hidden = false;
    setTimeout(() => t.hidden = true, 4000);
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
    const d = $('#dlg');
    if (d.open) {
        dlgPushed = false;
        d.close();
        return;
    }
    if (S.me && !['accueil', 'menu'].includes(S.tab)) {
        if (['impayes', 'depenses', 'bilan', 'presences', 'caisse', 'absences', 'sanctions', 'calendrier'].includes(S.tab)) {
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
    show('<h3>Installer ORÉA École</h3><p>Dans Chrome, touche le menu <b>⋮</b> en haut à droite, puis <b>Ajouter à l’écran d’accueil</b>.</p><form method=dialog><button>OK</button></form>');
}

function ask(title, fields, ok) {
    const d = show(`<form method=dialog><h3>${title}</h3>${fields.map(f => `<label>${f.l}${f.o ? `<select name=${f.n}>${f.o.map(o => `<option value="${o[0]}" ${o[0] === f.v ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>` : f.t === 'textarea' ? `<textarea name=${f.n} rows=4 style="width:100%" ${f.r === false ? '' : 'required'}>${esc(f.v)}</textarea>` : `<input name=${f.n} type=${f.t || 'text'} step=any value="${esc(f.v)}" ${f.r === false ? '' : 'required'}>`}</label>`).join('')}<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Valider</button></div></form>`);
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

const yc = () => { pickYear(); return S.classes.filter(c => cy(c) === S.year); };
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
        const rows = yc().map(c => ({ school_id: S.school.id, name: c.name, year: y, fee_t1: c.fee_t1, fee_t2: c.fee_t2, fee_t3: c.fee_t3, fee_currency: c.fee_currency }));
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

/* ---------- Hors connexion ---------- */
function saveSnap() { try { localStorage.orea_snap = JSON.stringify({ uid: S.me.id, me: S.me, school: S.school, classes: S.classes, stu: S.stu, fees: S.fees, fpaid: S.fpaid, terms: S.terms, at: Date.now() }); } catch { } }
function readSnap() { try { return JSON.parse(localStorage.orea_snap || 'null'); } catch { return null; } }
function goOffline(sn) { S.me = sn.me; S.school = sn.school; S.classes = sn.classes; S.stu = sn.stu; S.fees = sn.fees || []; S.fpaid = sn.fpaid || {}; S.terms = sn.terms || {}; S.offline = true; $('#hs').textContent = sn.school.name; render(); toast('Mode hors connexion : tu peux encaisser et faire l’appel.'); }
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
    if (!navigator.onLine && snap && snap.uid === session.user.id) return goOffline(snap);
    const { data: adm, error: ea } = await db.rpc('is_platform_admin');
    if (isNet(ea)) return snap && snap.uid === session.user.id ? goOffline(snap) : netView();
    if (adm === true) { $('#hs').textContent = 'Administration'; return adminView(); }
    const { data: p, error: ep } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (isNet(ep)) return snap && snap.uid === session.user.id ? goOffline(snap) : netView();
    if (!p) return setupView();
    if (p.active === false) { $('#nav').hidden = true; $('#main').innerHTML = '<div class=auth><h2>Compte désactivé</h2><p>Contacte le directeur de ton école.</p><button class=ghost onclick=out()>Déconnexion</button></div>'; return; }
    S.me = p;
    db.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', p.id).then(() => { }, () => { });
    const { data: s, error: es } = await db.from('schools').select('*').eq('id', p.school_id).single();
    if (!s) return isNet(es) && snap && snap.uid === p.id ? goOffline(snap) : netView();
    S.school = s; $('#hs').textContent = s.name;
    if (s.sub_until) { const left = Math.ceil((new Date(s.sub_until) - Date.now()) / 864e5); if (left <= 0) return lockView(); }
    await autoRate(); await qsync(); await load(); render();
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
function status(s) {
    if (s.balance_cdf <= 0) return 'paid';
    const c = S.classes.find(x => x.id === s.class_id), k = c ? curTerm(cy(c)) : null;
    if (k === null) return 'due';
    return trims(s).slice(0, k).some(t => t[1] > 0) ? 'late' : 'ok';
}
function stTag(s) {
    const st = status(s);
    if (st === 'paid') return '<span class=ok>✓ Soldé</span>';
    if (st === 'ok') return `<span class=ok>✅ À jour<br><small>reste ${fmt(s.balance_cdf)}</small></span>`;
    if (st === 'late') return `<span class=due>🔴 En retard<br><small>Doit ${fmt(s.balance_cdf)}</small></span>`;
    return `<span class=due>Doit ${fmt(s.balance_cdf)}</span>`;
}
function lateCard() {
    if (!hasTerms()) return '';
    const n = ys().filter(s => status(s) === 'late').length;
    return `<div class=card onclick="menuGo('impayes')"><span>🔴 Élèves en retard</span><b class="${n ? 'due' : 'ok'}">${n}</b></div>`;
}
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
    if (t === S.tab) return;
    if (t === 'accueil' && history.state && history.state.t) { history.back(); return; }
    if (S.tab === 'accueil' && t !== 'accueil' && !(history.state && history.state.t)) history.pushState({ t: 1 }, '');
    S.tab = t; render();
}
function menuGo(t) {
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
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const svgI = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

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
    augment(); S.offline = false; overlayQ(); saveSnap();
}
async function autoRate() {
    const s = S.school;
    if (!dir() || !s.auto_rates || Date.now() - new Date(s.rates_at) < 432e5) return;
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
    $('#main').innerHTML = `<div class=auth><h2>Bienvenue</h2><button id=c1>Je crée mon école (directeur)</button><button class=ghost id=c2>Je rejoins une école avec un code</button><button class=ghost id=lo>Déconnexion</button></div>`;
    $('#lo').onclick = out;
    $('#c1').onclick = () => ask('Nouvelle école', [{ n: 'school', l: 'Nom de l’école' }, { n: 'me', l: 'Ton nom' }], async v => { const { error } = await db.rpc('create_school', { school_name: v.school, my_name: v.me }); if (error) throw error; boot(); });
    $('#c2').onclick = () => ask('Rejoindre', [{ n: 'code', l: 'Code d’invitation' }, { n: 'me', l: 'Ton nom' }], async v => { const { error } = await db.rpc('join_school', { invite: v.code.trim(), my_name: v.me }); if (error) throw error; boot(); });
}

/* ---------- Écrans ---------- */
function render() {
    $('#nav').hidden = false; subBanner();
    const R = S.me.role, tabs = [['accueil', 'Accueil'], ['eleves', 'Élèves'], ['menu', 'Menu'], ['reglages', 'Réglages']];
    if (!tabs.some(x => x[0] === S.tab) && !['impayes', 'depenses', 'bilan', 'presences', 'caisse', 'absences', 'sanctions', 'calendrier'].includes(S.tab)) S.tab = 'accueil';
    let activeTab = ['impayes', 'depenses', 'bilan', 'presences', 'caisse', 'absences', 'sanctions', 'calendrier'].includes(S.tab) ? 'menu' : S.tab;
    $('#nav').innerHTML = tabs.map(x => `<button data-t=${x[0]}>${svgI(x[0])}<span>${x[1]}</span></button>`).join('');
    document.querySelectorAll('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.t === activeTab); b.onclick = () => goTab(b.dataset.t); });
    
    // Ajout de la barre de recherche globale dans l'en-tête
    const hs = $('#hs');
    if (hs && !$('#searchBtn')) {
        hs.insertAdjacentHTML('afterend', `<button id="searchBtn" class="ghost" style="width:auto;min-height:40px;padding:8px;margin-left:auto;border:none" onclick="openSearch()">🔍</button>`);
    }

    ({ accueil: vAccueil, eleves: vEleves, menu: vMenu, reglages: vReglages, impayes: vImpayes, depenses: vDepenses, bilan: vBilan, presences: vPresences, caisse: vCaisse, absences: vAbsences, sanctions: vSanctions, calendrier: vCalendrier })[S.tab]();
    qui();
}
const sorts = {
    alpha: (a, b) => a.name.localeCompare(b.name, 'fr'),
    solde: (a, b) => b.balance_cdf - a.balance_cdf,
    retard: (a, b) => { const k = s => s.balance_cdf > 0 ? (s.last_pay ? +new Date(s.last_pay) : 0) : 9e15; return k(a) - k(b); }
};
function vEleves() {
    const cl = yc(); let h = ybar();
    if (!cl.length) h += '<p class=empty data-ic="🏫">Aucune classe pour le moment.</p>';
    else {
        if (!cl.some(c => c.id === S.cls)) S.cls = cl[0].id;
        if (S.ft === 'late' && !hasTerms()) S.ft = 'all';
        const FT = [['all', 'Tous'], ...(hasTerms() ? [['late', 'En retard']] : []), ['due', 'À payer'], ['paid', 'Soldés'], ['nophone', 'Sans n°']];
        h += `<input id=q type=search placeholder="🔍 Rechercher un élève" value="${esc(S.q)}"><div class=bar><select id=cs>${cl.map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><select id=so><option value=alpha>Alphabétique A → Z</option><option value=solde>Plus grand solde dû</option><option value=retard>Retard de paiement</option></select></div><div class=chips>${FT.map(f => `<button class="chip ${S.ft === f[0] ? 'on' : ''}" data-f=${f[0]}>${f[1]}</button>`).join('')}</div><div id=lst></div>`;
    }
    if (dir()) h += `<div class=row><button class=ghost onclick=addClass()>+ Classe</button>${cl.length ? '<button onclick=addStudent()>+ Élève</button><button class=ghost onclick=bulkAdd()>+ Liste</button>' : ''}</div>`;
    $('#main').innerHTML = h;
    if ($('#cs')) {
        $('#so').value = S.sort;
        $('#cs').onchange = e => { S.cls = e.target.value; drawList(); };
        $('#so').onchange = e => { S.sort = e.target.value; drawList(); };
        $('#q').oninput = e => { S.q = e.target.value; drawList(); };
        document.querySelectorAll('.chip').forEach(b => b.onclick = () => { S.ft = b.dataset.f; document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); drawList(); });
        drawList();
    }
}
function drawList() {
    const cn = Object.fromEntries(S.classes.map(c => [c.id, c.name])), q = nrm(S.q).trim(), qd = q.replace(/\D/g, '');
    let l = q ? ys() : ys().filter(s => s.class_id === S.cls);
    if (q) l = l.filter(s => nrm(s.name).includes(q) || (qd && String(s.parent_phone || '').replace(/\D/g, '').includes(qd)));
    if (S.ft === 'due') l = l.filter(s => s.balance_cdf > 0);
    else if (S.ft === 'late') l = l.filter(s => status(s) === 'late');
    else if (S.ft === 'paid') l = l.filter(s => s.balance_cdf <= 0);
    else if (S.ft === 'nophone') l = l.filter(s => !s.parent_phone);
    l.sort(sorts[S.sort]);
    const tot = l.reduce((t, s) => t + Number(s.balance_cdf || 0), 0);
    $('#lst').innerHTML = l.length ? `<small>${l.length} élève(s) · reste dû ${fmt(tot)}</small>` + l.map(s => `<div class=card onclick="menu('${s.id}')"><span><b>${esc(s.name)}</b>${q ? '<br><small>' + esc(cn[s.class_id] || '') + '</small>' : ''}</span>${stTag(s)}</div>`).join('') : `<p class=empty>${q || S.ft !== 'all' ? 'Aucun élève trouvé.' : 'Aucun élève dans cette classe.'}</p>`;
}
function addClass(yr) {
    ask('Nouvelle classe', [{ n: 'name', l: 'Nom (ex : 3e A)' }, { n: 'year', l: 'Année scolaire', v: yr || S.year || '' }, { n: 't1', l: 'Frais 1er trimestre', t: 'number' }, { n: 't2', l: 'Frais 2e trimestre', t: 'number' }, { n: 't3', l: 'Frais 3e trimestre', t: 'number' }, { n: 'cur', l: 'Devise des frais', o: CUR.map(c => [c, c]), v: S.cur }], async v => {
        const { error } = await db.from('classes').insert({ school_id: S.school.id, name: v.name.trim(), year: v.year.trim(), fee_t1: +v.t1, fee_t2: +v.t2, fee_t3: +v.t3, fee_currency: v.cur });
        if (error) throw error; S.year = cy({ year: v.year.trim() }); S.cls = null; localStorage['orea_year_' + S.school.id] = S.year; await load(); render();
    });
}
function addStudent() {
    ask('Nouvel élève', [{ n: 'name', l: 'Nom complet' }, { n: 'phone', l: 'WhatsApp du parent', t: 'tel', r: false }, { n: 'cls', l: 'Classe', o: yc().map(c => [c.id, esc(c.name)]), v: S.cls }], async v => {
        const { error } = await db.from('students').insert({ school_id: S.school.id, class_id: v.cls, name: v.name.trim(), parent_phone: v.phone.trim() || null });
        if (error) throw error; S.cls = v.cls; await load(); render();
    });
}
function menu(id) {
    const s = S.stu.find(x => x.id === id), R = S.me.role;
    const d = show(`<h3>${esc(s.name)}</h3><p>${stTag(s)}</p><p><small>${trims(s).map(t => 'T' + t[0] + ' : ' + (t[2] > 0 ? (t[1] > 0 ? 'reste ' + fmt(t[1]) : '✓') : '—')).join(' · ')}</small></p>${fees4(s).length ? '<p><small>' + fees4(s).map(f => esc(f.name) + ' : ' + (feeRem(s, f) > 0 ? 'reste ' + fmt(feeRemCdf(s, f)) : '✓')).join(' · ') + '</small></p>' : ''}<div class=col>${R !== 'enseignant' ? '<button id=m1>Encaisser un paiement</button><button class=ghost id=m2>Historique et reçus</button>' : ''}${R !== 'percepteur' ? '<button class=ghost id=m7>Sanctions</button>' : ''}${dir() ? '<button class=ghost id=m6>Message WhatsApp au parent</button><button class=ghost id=m4>Modifier l’élève</button><button class=ghost id=m5>Supprimer l’élève</button>' : ''}<button class=ghost id=m3>Fermer</button></div>`);
    const b = (k, f) => { const e = d.querySelector('#' + k); if (e) e.onclick = f; };
    b('m1', () => pay(id)); b('m2', () => hist(id)); b('m3', () => d.close()); b('m4', () => editStudent(id)); b('m5', () => { d.close(); delStudent(id); }); b('m6', () => wa(id)); b('m7', () => sanc(id));
}

/* ---------- Trimestres et WhatsApp ---------- */
const COUNTRY = '243';
const trims = s => [1, 2, 3].map(i => { const due = Number(s['due' + i + '_cdf'] || 0), paid = Number(s['p' + i + '_cdf'] || 0); return [i, Math.max(0, due - paid), due, paid]; });
function waLink(phone, msg) {
    let n = String(phone || '').replace(/[^\d]/g, '');
    if (!n) return null;
    if (n.startsWith('00')) n = n.slice(2); else if (n.startsWith('0')) n = COUNTRY + n.slice(1);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
}
const logMsg = (sid, kind, body) => db.from('messages_log').insert({ school_id: S.school.id, student_id: sid, kind, body }).then(() => { }, () => { });
const feeMsg = s => { const hi = `Bonjour, ici ${S.school.name}. `, rest = trims(s).filter(t => t[1] > 0).map(t => 'T' + t[0] + ' : ' + fmt(t[1])).concat(fees4(s).filter(f => feeRem(s, f) > 0).map(f => f.name + ' : ' + fmt(feeRemCdf(s, f)))).join(', '); return s.balance_cdf > 0 ? `${hi}Concernant ${s.name} : il reste ${fmt(s.balance_cdf)} à payer (${rest}). Merci de régulariser.` : `${hi}Les frais de ${s.name} sont entièrement soldés. Merci !`; };

function getTpl(kind, s) {
    const tpl = S.school.message_templates || {};
    const def = tpl[kind] || (kind === 'frais' ? feeMsg(s) : '');
    return def.replace(/{eleve}/g, s.name).replace(/{classe}/g, cnm(s.class_id)).replace(/{reste}/g, fmt(s.balance_cdf)).replace(/{ecole}/g, S.school.name);
}

async function wa(id) {
    const s = S.stu.find(x => x.id === id);
    if (!s.parent_phone) { toast('Ajoute d’abord le numéro du parent.'); return; }
    const [{ data: ab }, { data: sa }] = await Promise.all([db.from('attendance').select('day').eq('student_id', id).eq('status', 'absent').order('day', { ascending: false }).limit(5), db.from('sanctions').select('*').eq('student_id', id).order('created_at', { ascending: false }).limit(1)]);
    const A = ab || [], X = sa || [], fd = x => new Date(x + 'T00:00').toLocaleDateString('fr-FR'), hi = `Bonjour, ici ${S.school.name}. `;
    const M = {
        frais: getTpl('frais', s),
        absence: A.length ? `${hi}${s.name} a été absent(e) le ${A.map(a => fd(a.day)).join(', ')}. Merci de nous en indiquer la raison.` : `${hi}${s.name} n’a pas d’absence récente.`,
        sanction: X.length ? `${hi}${s.name} a reçu la sanction suivante le ${fd(X[0].day)} : ${X[0].kind}${X[0].note ? ' (' + X[0].note + ')' : ''}. Merci de passer à l’école.` : `${hi}Aucune sanction enregistrée pour ${s.name}.`,
        libre: hi
    };
    const d = show(`<h3>Message à ${esc(s.name)}</h3><label>Sujet<select id=wk><option value=frais>Frais restants</option><option value=absence>Absences</option><option value=sanction>Sanction</option><option value=libre>Message libre</option></select></label><label>Message<textarea id=wm rows=6 style="width:100%">${esc(M.frais)}</textarea></label><div class=col><button id=ws>Ouvrir WhatsApp</button><button class=ghost id=wc>Annuler</button></div>`);
    d.querySelector('#wk').onchange = e => { d.querySelector('#wm').value = M[e.target.value]; };
    d.querySelector('#wc').onclick = () => d.close();
    d.querySelector('#ws').onclick = () => { const m = d.querySelector('#wm').value, u = waLink(s.parent_phone, m); if (!u) return toast('Numéro invalide'); window.open(u, '_blank'); logMsg(id, d.querySelector('#wk').value, m); d.close(); };
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
    ask('Modifier l’élève', [{ n: 'name', l: 'Nom complet', v: s.name }, { n: 'phone', l: 'WhatsApp du parent', t: 'tel', r: false, v: s.parent_phone }, { n: 'cls', l: 'Classe', o: yc().map(c => [c.id, esc(c.name)]), v: s.class_id }], async v => {
        const { data, error } = await db.from('students').update({ name: v.name.trim(), parent_phone: v.phone.trim() || null, class_id: v.cls }).eq('id', id).select();
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
    $('#main').innerHTML = `<div class=auth><h2>Abonnement expiré</h2><p>L’accès de ${esc(S.school.name)} est suspendu. Contacte l’administrateur.</p>${ADMIN_WA ? `<a class=btn style="text-align:center;text-decoration:none" href="https://wa.me/${ADMIN_WA}?text=${encodeURIComponent('Bonjour, je souhaite renouveler l’abonnement de ' + S.school.name)}">Contacter l’administrateur</a>` : ''}<button class=ghost onclick=out()>Déconnexion</button></div>`;
}

async function adminView() {
    $('#nav').hidden = true;
    const [{ data, error }, { data: pays = [] }] = await Promise.all([db.rpc('admin_list_schools'), db.from('sub_payments').select('amount,currency,created_at')]);
    if (error) return toast(error.message);
    const now = Date.now(), act = data.filter(s => new Date(s.sub_until) > now).length;
    const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonth = pays.filter(p => new Date(p.created_at) >= m0);
    const totCur = list => { const m = {}; list.forEach(p => { m[p.currency] = (m[p.currency] || 0) + Number(p.amount); }); return Object.entries(m).filter(x => x[1] > 0).map(x => nf(x[1]) + ' ' + SYM[x[0]]).join(' · ') || '0 FC'; };
    
        // Calcul du graphique 6 mois
    const ms = []; for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); ms.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), v: 0 }); }
    pays.forEach(p => { if (p.currency === 'USD') { const d = new Date(p.created_at), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), m = ms.find(x => x.k === k); if (m) m.v += Number(p.amount); } });
    const mx = Math.max(...ms.map(x => x.v), 1);

    let h = `<h3>Espace administrateur</h3><div class=card><span>Écoles actives / total</span><b>${act} / ${data.length}</b></div><div class=card><span>Revenus ce mois</span><b>${totCur(thisMonth)}</b></div>`;
    h += `<div class="card col"><b>Revenus USD (6 derniers mois)</b><div class="admin-bar">${ms.map(x => `<div style="height:${Math.max(4, Math.round(x.v / mx * 80))}px" title="${nf(x.v)} $"><small>${x.l}</small></div>`).join('')}</div></div>`;
    h += `<div class=row><button onclick=adminHistory()>Historique des encaissements</button></div>`;
    
    h += '<h3>Écoles</h3>' + (data.length ? data.map(s => {
        const d = s.sub_until ? new Date(s.sub_until) : null;
        const left = d ? Math.ceil((d - now) / 864e5) : -999;
        const ok = left > 0;
        const waMsg = ok ? `Bonjour, l’abonnement de ${s.name} arrive à échéance dans ${left} jour(s).` : `Bonjour, l’abonnement de ${s.name} est arrivé à échéance.`;
        const waUrl = s.phone ? waLink(s.phone, waMsg) : null;
        return `<div class="card col"><b>${esc(s.name)}</b><span>${esc(s.director_name || '—')} · ${esc(s.director_email || '')}</span><small>${s.students} élèves · ${s.members} compte(s) · code ${esc(s.code)}</small><span class="${ok && left > 7 ? 'ok' : 'due'}">${ok ? 'Actif jusqu’au ' + d.toLocaleDateString('fr-FR') + ' (' + left + ' j)' : '⛔ Expiré'}</span><div class=row>${waUrl ? `<a class="btn ghost" style="width:auto;text-decoration:none" href="${waUrl}" target="_blank">💬 Relance WhatsApp</a>` : `<button class=ghost style="width:auto" onclick="setSchoolPhone('${s.id}')">📞 Ajouter WhatsApp</button>`}${s.phone ? `<button class=ghost style="width:auto" onclick="setSchoolPhone('${s.id}','${esc(s.phone)}')">✏</button>` : ''}</div><div class=row>${[1, 2, 3, 6].map(n => `<button class=ghost onclick="extModal('${s.id}','${esc(s.name)}',${n})">+${n} m</button>`).join('')}</div></div>`;
    }).join('') : '<p class=empty>Aucune école pour le moment.</p>') + installCard() + '<button class=ghost onclick=out()>Déconnexion</button>';
    $('#main').innerHTML = h;
}

function extModal(sid, sname, n) {
    ask('Prolonger ' + sname + ' (+' + n + ' mois)', [{ n: 'amount', l: 'Montant perçu', t: 'number', v: '0' }, { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: 'USD' }, { n: 'note', l: 'Remarque', r: false }], async v => {
        const { error } = await db.rpc('admin_extend', { sid, n: +n, pay_amount: +v.amount || 0, pay_cur: v.cur, pay_note: v.note.trim() || null });
        if (error) return toast(error.message);
        toast('Abonnement prolongé de ' + n + ' mois'); adminView();
    });
}
function setSchoolPhone(sid, curr = '') {
    ask('Numéro WhatsApp', [{ n: 'phone', l: 'Numéro', t: 'tel', v: curr }], async v => {
        const { error } = await db.rpc('admin_set_school_phone', { sid, p: v.phone.trim() || null });
        if (error) return toast(error.message);
        toast('Numéro enregistré'); adminView();
    });
}
async function adminHistory() {
    const [{ data: p = [], error }, { data: sc = [] }] = await Promise.all([db.from('sub_payments').select('*').order('created_at', { ascending: false }).limit(100), db.from('schools').select('id,name')]);
    if (error) return toast(error.message);
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
    ask('Encaisser — ' + esc(s.name), [{ n: 'target', l: 'Paiement pour', o: opts, v: def }, { n: 'amount', l: 'Montant', t: 'number' }, { n: 'currency', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur }, { n: 'method', l: 'Mode', o: [['especes', 'Espèces'], ['mobile_money', 'Mobile Money']] }, { n: 'reference', l: 'Réf. Mobile Money (si applicable)', r: false }], async v => {
        const mm = v.method === 'mobile_money';
        if (mm && !v.reference.trim()) throw Error('Référence Mobile Money obligatoire');
        const isF = v.target[0] === 'f', fid = v.target.slice(1);
        const base = { id: crypto.randomUUID(), student_id: id, amount: +v.amount, currency: v.currency, method: v.method, reference: mm ? v.reference.trim() : null };
        const row = isF ? { ...base, fee_id: fid, fee_name: (S.fees.find(f => f.id === fid) || {}).name } : { ...base, term: +fid };
        if (!navigator.onLine) return payOffline(row);
        const { data, error } = await db.from(isF ? 'fee_payments' : 'payments').insert(row).select().single();
        if (isNet(error)) return payOffline(row);
        if (error) throw error.code === '23505' ? Error('Cette référence existe déjà') : error;
        await load(); render(); receipt(data, id);
    });
}
async function hist(id) {
    const [{ data: d1, error: e1 }, { data: d2 }] = await Promise.all([db.from('payments').select('*').eq('student_id', id), db.from('fee_payments').select('*').eq('student_id', id)]);
    if (e1) return toast(e1.message);
    const data = [...d1.map(p => ({ ...p, _f: 0 })), ...(d2 || []).map(p => ({ ...p, _f: 1 }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const ids = d1.map(p => p.id);
    const fids = (d2 || []).map(p => p.id);
    const [{ data: pend = [] }, { data: fpend = [] }] = await Promise.all([
        ids.length ? db.from('change_requests').select('payment_id').eq('status', 'en_attente').in('payment_id', ids) : { data: [] },
        fids.length ? db.from('change_requests').select('fee_payment_id').eq('status', 'en_attente').in('fee_payment_id', fids) : { data: [] }
    ]);
    const pe = new Set(pend.map(r => r.payment_id));
    const fpe = new Set(fpend.map(r => r.fee_payment_id));
    
    const d = show(`<h3>Reçus</h3>${data.length ? data.map((p, i) => {
        const isP = pe.has(p.id) || fpe.has(p.id);
        return `<div class="card col"><span>${rno(p)} · ${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${p._f ? esc(p.fee_name || 'Frais') : 'T' + p.term} · ${nf(p.amount)} ${p.currency}</span><div class=row><button class=ghost data-i=${i}>Reçu</button>${p._f ? (dir() ? `<button class=ghost data-x=${i}>Supprimer</button>` : '') : pe.has(p.id) ? '<small>⏳ demande en attente</small>' : `<button class=ghost data-c=${i}>${dir() ? 'Corriger' : 'Demander correction'}</button>`}</div></div>`;
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
}
function fixPay(p, sid) {
    const T = [['1', '1er trimestre'], ['2', '2e trimestre'], ['3', '3e trimestre']], D = dir();
    const d = show(`<h3>Paiement de ${nf(p.amount)} ${p.currency} (${p._f ? (p.fee_name || 'Frais') : 'T' + p.term})</h3><div class=col><button id=f1>${D ? 'Modifier' : 'Demander modification'}</button><button class=ghost id=f2>${D ? 'Supprimer' : 'Demander suppression'}</button><button class=ghost id=f3>Retour</button></div>`);
    d.querySelector('#f3').onclick = () => hist(sid);
    d.querySelector('#f1').onclick = () => ask(D ? 'Modifier' : 'Demande de modification', [{ n: 'amount', l: 'Montant', t: 'number', v: p.amount }, ...(p._f ? [] : [{ n: 'term', l: 'Trimestre', o: T, v: String(p.term) }]), ...(D ? [] : [{ n: 'reason', l: 'Motif', r: false }])], async v => {
        if (D) {
            if (p._f) { const { data, error } = await db.from('fee_payments').update({ amount: +v.amount, amount_cdf: +v.amount * p.rate, fee_paid: (+v.amount * p.rate) / rateOf(S.fees.find(f => f.id === p.fee_id).currency) }).eq('id', p.id).select(); if (error) throw error; if (!data.length) throw Error('Refusé'); }
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
    const [{ data: a = [] }, { data: pr = [] }] = await Promise.all([db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(60), db.from('profiles').select('id,full_name')]);
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
async function receipt(p, sid) {
    const s = S.stu.find(x => x.id === sid), c = S.classes.find(x => x.id === s.class_id);
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 900; const x = cv.getContext('2d');
    x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 640, 900); const gg = x.createLinearGradient(0, 0, 640, 900); gg.addColorStop(0, '#e9cf86'); gg.addColorStop(.5, '#b08a30'); gg.addColorStop(1, '#8a6a1f'); x.strokeStyle = gg; x.lineWidth = 4; x.strokeRect(14, 14, 612, 872); x.lineWidth = 1; x.strokeRect(24, 24, 592, 852);
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
    x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '16px sans-serif'; x.fillText('Merci — ORÉA École', 320, 870);
    const nm = p.receipt_no ? rno(p) : 'provisoire-' + p.id.slice(0, 6), fn = 'recu-' + nm + '.png';
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), url = URL.createObjectURL(blob);
    const file = new File([blob], fn, { type: 'image/png' });
    const txt = 'Reçu ' + (p.receipt_no ? rno(p) : 'provisoire') + ' — ' + S.school.name + '\n' + s.name + ' : ' + nf(p.amount) + ' ' + p.currency;
    const can = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const d = show(`<h3>Reçu ${p.receipt_no ? rno(p) : 'provisoire'}</h3><div class=col><button id=rw>📤 Envoyer sur WhatsApp</button><a class="btn ghost" download="${fn}" href="${url}">Télécharger PNG</a><button class=ghost id=rc>Fermer</button></div><img src="${url}" alt="Reçu">`);
    d.querySelector('#rc').onclick = () => d.close();
    d.querySelector('#rw').onclick = async () => {
        if (can) { try { await navigator.share({ files: [file], text: txt }); } catch (e) { if (e.name !== 'AbortError') toast('Partage impossible.'); } }
        else { const a = document.createElement('a'); a.href = url; a.download = fn; a.click(); const u = waLink(s.parent_phone, txt); if (u) window.open(u, '_blank'); else toast('Image téléchargée.'); }
    };
}

/* ---------- Accueil ---------- */
const tdy = () => new Date().toLocaleDateString('sv-SE');
function previsionCard() {
    const t = curTerm(S.year);
    if (!t) return '';
    const st = ys();
    const due = st.reduce((a, s) => a + Number(s['due' + t + '_cdf'] || 0), 0);
    const paid = st.reduce((a, s) => a + Number(s['p' + t + '_cdf'] || 0), 0);
    const rem = Math.max(0, due - paid);
    const tm = S.terms[S.year];
    const dt = tm ? tm['t' + t] : null;
    return `<div class="card col"><b>📈 Prévision T${t}</b><small>Encaissé ${fmt(paid)} / ${fmt(due)}</small><small class=due>Reste à encaisser : ${fmt(rem)}</small><small>Fin du trimestre : ${dt ? fdate(dt) : '—'}</small></div>`;
}
async function vAccueil() {
    $('#main').innerHTML = SK;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); const R = S.me.role;
    const [pp, aa, rq, ml] = await Promise.all([
        R === 'enseignant' ? { data: [] } : todayPay(t0),
        db.from('attendance').select('status').eq('day', tdy()),
        R === 'directeur' ? db.from('change_requests').select('id').eq('status', 'en_attente') : { data: [] },
        R === 'directeur' ? db.from('messages_log').select('*').order('created_at', { ascending: false }).limit(5) : { data: [] }
    ]);
    const st = ys(), sm = k => st.reduce((a, s) => a + Number(s[k] || 0), 0), A = aa.data || [], cnt = k => A.filter(a => a.status === k).length;
    const tod = sum((pp.data || []).filter(p => R === 'directeur' || p.collector_id === S.me.id)) + qToday(), pend = (rq.data || []).length;
    const exp = sm('due1_cdf') + sm('due2_cdf') + sm('due3_cdf') + sm('fee_exp_cdf'), due = sm('balance_cdf');
    let h = ybar() + `<h3>Bonjour ${esc(S.me.full_name)}</h3>`;

    if (S.events && S.events.length) {
        const ev = S.events[0];
        h += `<div class="card col" style="border-color:var(--gold)"><b>📅 Prochain événement</b><span>${esc(ev.title)}</span><small>Le ${fdate(ev.start_date)}</small></div>`;
    }

    const left = S.school.sub_until ? Math.ceil((new Date(S.school.sub_until) - Date.now()) / 864e5) : 99;
    if (R === 'directeur' && left > 7 && left <= 14) h += `<div class="card col"><b class=due>⚠ Abonnement : ${left} jours restants</b><small>Pense à renouveler.</small>${subWa(left) ? `<a class=btn href="${subWa(left)}" target=_blank rel=noopener>Contacter l’administrateur</a>` : ''}</div>`;
    if (R === 'directeur') h += bkCard();
    if (pend) h += `<div class="card" onclick="menuGo('caisse')"><span>Demandes à approuver</span><b class=due>${pend}</b></div>`;
    if (R !== 'enseignant') {
        h += lateCard();
        if (R === 'directeur') h += previsionCard();
        const pct = exp > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - due / exp)))) : 0;
        h += `<div class="card hero"><small>Encaissé aujourd’hui ${R === 'directeur' ? '(école)' : '(ma caisse)'}</small><span class=big>${fmt(tod)}</span></div><div class=card><span>Total encaissé</span><b>${fmt(sm('paid_cdf'))}</b></div><div class=card><span>Reste à encaisser</span><b class=due>${fmt(due)}</b></div><div class=card><span>Taux de recouvrement</span><div class=ring style="--p:${pct}"><b>${pct} %</b></div></div>`;
        h += '<h3>Par trimestre</h3>' + [1, 2, 3].map(i => `<div class=card><span>T${i}</span><b>${fmt(sm('p' + i + '_cdf'))} / ${fmt(sm('due' + i + '_cdf'))}</b></div>`).join('');
        h += classBars() + (R === 'directeur' ? '<div id=ch></div>' : '');
    }
    h += `<h3>Présences du jour</h3><div class=card><span>Présents · Absents · Retards</span><b>${cnt('present')} · ${cnt('absent')} · ${cnt('retard')}</b></div><div class=card><span>Élèves inscrits</span><b>${st.length}</b></div><div class=row><button onclick="menuGo('presences')">Faire l’appel</button>${R === 'directeur' ? '<button class=ghost onclick=reminders()>Relance des parents</button>' : ''}</div>`;
    const ms = ml.data || [], K = { frais: 'Frais', absence: 'Absence', sanction: 'Sanction', libre: 'Message' };
    if (R === 'directeur') h += '<h3>Derniers messages</h3>' + (ms.length ? ms.map(m => { const s = st.find(x => x.id === m.student_id); return `<div class="card col"><b>${esc(s ? s.name : '')} · ${K[m.kind] || m.kind}</b><small>${new Date(m.created_at).toLocaleString('fr-FR')}</small></div>`; }).join('') : '<p class=empty>Aucun message envoyé.</p>');
    if (S.tab !== 'accueil') return;
    $('#main').innerHTML = h;
    if (R === 'directeur') monthChart();
}
/* ---------- Présences ---------- */
async function vPresences() {
    if (!yc().length) { $('#main').innerHTML = ybar() + `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><p class=empty>Crée d’abord une classe.</p>`; return; }
    if (!yc().some(c => c.id === S.cls)) S.cls = yc()[0].id;
    S.day = S.day || tdy();
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const { data } = await db.from('attendance').select('student_id,status').eq('day', S.day);
    if (data) { S.att = Object.fromEntries(data.map(a => [a.student_id, a.status])); S.attDay = S.day; } else if (S.attDay !== S.day) S.att = {};
    qget().filter(x => x.k === 'att' && x.day === S.day).forEach(x => S.att[x.student_id] = x.status);
    if (S.tab !== 'presences') return;
    drawAtt();
}
function drawAtt() {
    const l = S.stu.filter(s => s.class_id === S.cls).sort(sorts.alpha), A = S.att || {};
    const n = k => l.filter(s => A[s.id] === k).length, un = l.filter(s => !A[s.id]).length, B = [['present', 'Présent'], ['absent', 'Absent'], ['retard', 'Retard']];
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>` + ybar() + `<div class=bar><select id=cs>${yc().map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><input id=dy type=date value="${S.day}" max="${tdy()}"></div><div class=card><small>Présents ${n('present')} · Absents ${n('absent')} · Retards ${n('retard')} · Non marqués ${un}</small></div>`;
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
async function sanc(id) {
    const s = S.stu.find(x => x.id === id);
    const { data, error } = await db.from('sanctions').select('*').eq('student_id', id).order('created_at', { ascending: false });
    if (error) return toast(error.message);
    const d = show(`<h3>Sanctions — ${esc(s.name)}</h3>${data.length ? data.map(x => `<div class="card col"><b>${esc(x.kind)}</b><small>${new Date(x.day + 'T00:00').toLocaleDateString('fr-FR')}${x.note ? ' · ' + esc(x.note) : ''}</small>${dir() ? `<button class=ghost data-x=${x.id}>Supprimer</button>` : ''}</div>`).join('') : '<p class=empty>Aucune sanction.</p>'}<div class=col><button id=sa>+ Ajouter</button><button class=ghost id=sc>Fermer</button></div>`);
    d.querySelector('#sc').onclick = () => d.close();
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { if (!confirm('Supprimer ?')) return; const { error } = await db.from('sanctions').delete().eq('id', b.dataset.x); error ? toast(error.message) : sanc(id); });
    d.querySelector('#sa').onclick = () => ask('Nouvelle sanction', [{ n: 'kind', l: 'Type', o: ['Avertissement', 'Retenue', 'Exclusion temporaire', 'Autre'].map(k => [k, k]) }, { n: 'day', l: 'Date', t: 'date', v: tdy() }, { n: 'note', l: 'Détail', r: false }], async v => {
        const { error } = await db.from('sanctions').insert({ school_id: S.school.id, student_id: id, kind: v.kind, day: v.day, note: v.note.trim() || null });
        if (error) throw error; toast('Enregistrée'); sanc(id);
    });
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

/* ---------- Caisse ---------- */
async function vCaisse() {
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const { data: ps0, error: pe0 } = await todayFull(t0);
    if (pe0 || !ps0) { $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div><p class=empty>La caisse demande une connexion.</p>'; return; }
    const ps = ps0;
    const mine = ps.filter(p => p.collector_id === S.me.id);
    const tot = a => [sum(a.filter(p => p.method === 'especes')), sum(a.filter(p => p.method === 'mobile_money'))];
    const [c, m] = tot(dir() ? ps : mine);
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Aujourd’hui ${dir() ? '(toute l’école)' : '(ma caisse)'}</h3><div class=card><span>Espèces</span><b>${fmt(c)}</b></div><div class=card><span>Mobile Money</span><b>${fmt(m)}</b></div><div class=card><span>Paiements</span><b>${(dir() ? ps : mine).length}</b></div>`;
    if (S.me.role === 'percepteur') h += '<button onclick=closeDay()>Clôturer ma journée</button>';
    const { data: cl = [] } = await db.from('closures').select('*').order('created_at', { ascending: false }).limit(30);
    const { data: pr = [] } = await db.from('profiles').select('id,full_name');
    const nm = Object.fromEntries(pr.map(p => [p.id, p.full_name]));
    const { data: rq = [] } = await db.from('change_requests').select('*').order('created_at', { ascending: false }).limit(20);
    const st = { en_attente: '⏳ En attente', approuvee: '✓ Approuvée', refusee: '✗ Refusée' };
    const reqHtml = rq.length ? '<h3>Demandes de correction</h3>' + rq.map(r => `<div class="card col"><b>${esc(r.info || 'Paiement supprimé')}</b><span>${r.kind === 'delete_payment' ? 'Suppression' : 'Correction → ' + nf(r.new_amount) + ' · T' + r.new_term}${nm[r.requested_by] ? ' · ' + esc(nm[r.requested_by]) : ''}</span><small>${st[r.status]}${r.reason ? ' · ' + esc(r.reason) : ''}</small>${dir() && r.status === 'en_attente' ? `<div class=row><button onclick="decide('${r.id}',true)">Approuver</button><button class=ghost onclick="decide('${r.id}',false)">Refuser</button></div>` : ''}</div>`).join('') : '';
    h += reqHtml + '<h3>Clôtures</h3>' + (cl.length ? cl.map(k => {
        const e = k.declared_cash - k.expected_cash, bad = Math.abs(e) > 0.5;
        return `<div class="card col"><b>${k.day} · ${esc(nm[k.collector_id] || '')}</b><span>Attendu ${fmt(k.expected_cash)} · Compté ${fmt(k.declared_cash)}</span><span class="${bad ? 'due' : 'ok'}">${bad ? '⚠ Écart : ' + fmt(e) : '✓ Aucun écart'}</span><small>${k.status === 'controlee' ? 'Contrôlée' : 'À contrôler'}${k.note ? ' · ' + esc(k.note) : ''}</small>${dir() && k.status === 'enregistree' ? `<button class=ghost onclick="ctl('${k.id}')">Marquer comme contrôlée</button>` : ''}</div>`;
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
    if (dir()) h += `<div class="card col"><b>Taux de change (1 unité en FC)</b><label>USD<input id=r1 type=number step=any value="${sc.rates.USD}"></label><label>EUR<input id=r2 type=number step=any value="${sc.rates.EUR}"></label><label><input id=au type=checkbox style=width:auto ${sc.auto_rates ? 'checked' : ''}> Mise à jour automatique</label><button id=sr>Enregistrer les taux</button><small>Code d’invitation : <b>${sc.code}</b></small></div>`;
    if (dir()) h += `<div class="card col"><b>Frais par trimestre</b>${yc().length ? yc().map(c => `<button class=ghost onclick="editFees('${c.id}')">${esc(c.name)} · T1: ${nf(c.fee_t1 || 0)} / T2: ${nf(c.fee_t2 || 0)} / T3: ${nf(c.fee_t3 || 0)} ${c.fee_currency}</button>`).join('') : '<small>Aucune classe.</small>'}<small>Touche une classe pour modifier T1, T2 et T3.</small></div>`;
    if (dir()) {
        const yf = S.fees.filter(f => cy(f) === S.year && !f.student_id), tm = S.terms[S.year] || {};
        h += `<div class="card col"><b>Autres frais · ${esc(S.year || '—')}</b>${yf.length ? yf.map(f => `<button class=ghost onclick="editFee('${f.id}')">${esc(f.name)} · ${nf(f.amount)} ${f.currency} · ${f.class_id ? esc((S.classes.find(c => c.id === f.class_id) || {}).name || '') : 'Toutes'}</button>`).join('') : '<small>Aucun frais supplémentaire.</small>'}<button class=ghost onclick=addFee()>+ Frais (inscription, uniforme…)</button></div>`;
        h += `<div class="card col"><b>Dates des trimestres</b><small>${hasTerms() ? 'T1 dès le ' + fdate(tm.t1) + ' · T2 dès le ' + fdate(tm.t2) + ' · T3 dès le ' + fdate(tm.t3) : 'Non réglées : le statut « en retard » est désactivé.'}</small><button class=ghost onclick=setTerms()>Régler les dates · ${esc(S.year || '—')}</button></div>`;
        h += `<div class="card col"><b>Modèles de messages</b><small>Personnalise les messages WhatsApp (frais).</small><button class=ghost onclick=editTemplates()>✏️ Modifier les modèles</button></div>`;
    }
    h += `<details><summary>Guide rapide</summary><p><b>Encaisser</b> : Élèves → touche l’élève → Encaisser.<br><b>Reçu</b> : Élève → Historique et reçus → Envoyer le reçu.<br><b>Clôture</b> : Menu → Caisse → Clôturer.<br><b>Sans réseau</b> : tu peux encaisser et faire l’appel.<br><b>Correction</b> : Élève → Historique et reçus → Corriger.</p></details><button class=ghost id=lo>Déconnexion</button>`;
    $('#main').innerHTML = h;
    $('#lo').onclick = out;
    $('#cu').onchange = e => { S.cur = e.target.value; localStorage.cur = S.cur; toast('Devise : ' + S.cur); };
    $('#th').onclick = () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = localStorage.theme = t; };
    if (dir()) $('#sr').onclick = async () => {
        const rates = { CDF: 1, USD: +$('#r1').value, EUR: +$('#r2').value };
        const { data, error } = await db.from('schools').update({ rates, auto_rates: $('#au').checked, rates_at: new Date().toISOString() }).eq('id', sc.id).select().single();
        if (error) return toast(error.message); S.school = data; await load(); toast('Taux enregistrés');
    };
}
function editTemplates() {
    const t = S.school.message_templates || {};
    const d = show(`<h3>Modèles de messages</h3><small>Variables : <b>{eleve}</b>, <b>{classe}</b>, <b>{reste}</b>, <b>{ecole}</b></small><form id=tf class=col><label>Relance des frais<textarea name=frais rows=4 style="width:100%">${esc(t.frais || feeMsg({ name: '{eleve}', class_id: '', balance_cdf: 0 }))}</textarea></label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Enregistrer</button></div></form>`);
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        e.preventDefault();
        const nt = { frais: e.target.frais.value.trim() };
        const { error } = await db.from('schools').update({ message_templates: nt }).eq('id', S.school.id);
        if (error) return toast(error.message);
        S.school.message_templates = nt;
        d.close(); toast('Modèles mis à jour');
    };
}

/* ---------- Recherche Globale ---------- */
function openSearch() {
    let m = $('#searchModal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'searchModal';
        m.innerHTML = `
            <header>
                <input type="search" id="globalSearch" placeholder="Rechercher un élève, une classe, REC-0042..." oninput="doGlobalSearch(this.value)">
                <button class="ghost" style="width:auto;margin-top:10px" onclick="closeSearch()">Fermer</button>
            </header>
            <div class="res" id="searchRes"></div>
        `;
        document.body.appendChild(m);
    }
    m.hidden = false;
    $('#globalSearch').value = '';
    $('#searchRes').innerHTML = '';
    setTimeout(() => $('#globalSearch').focus(), 100);
}

function closeSearch() {
    const m = $('#searchModal');
    if (m) m.hidden = true;
}

async function doGlobalSearch(q) {
    q = nrm(q).trim();
    const res = $('#searchRes');
    if (!q) { res.innerHTML = ''; return; }
    
    let h = '';
    const stu = S.stu.filter(s => nrm(s.name).includes(q));
    if (stu.length) {
        h += '<h3>👤 Élèves</h3>' + stu.slice(0, 10).map(s => {
            const cname = (S.classes.find(c => c.id === s.class_id) || {}).name || '';
            return `<div class="card" onclick="closeSearch();menu('${s.id}')"><span>${esc(s.name)}<br><small>${esc(cname)}</small></span><b class="${s.balance_cdf > 0 ? 'due' : 'ok'}">${fmt(s.balance_cdf)}</b></div>`;
        }).join('');
    }
    
    const cls = S.classes.filter(c => nrm(c.name).includes(q));
    if (cls.length) {
        h += '<h3>🏫 Classes</h3>' + cls.map(c => `<div class="card" onclick="closeSearch();S.cls='${c.id}';S.tab='eleves';render()"><span>${esc(c.name)}</span><small>${cy(c)}</small></div>`).join('');
    }

    const isRec = q.startsWith('rec') || /^\d+$/.test(q);
    if (!h) res.innerHTML = '<p class=empty>Recherche...</p>';
    else res.innerHTML = h;

    if (isRec) {
        const num = q.replace('rec-', '').replace('rec', '');
        const rno = parseInt(num, 10);
        if (!isNaN(rno)) {
            const [{ data: p }, { data: f }] = await Promise.all([
                db.from('payments').select('*, students(name)').eq('receipt_no', rno).limit(1),
                db.from('fee_payments').select('*, students(name)').eq('receipt_no', rno).limit(1)
            ]);
            const found = (p && p.length ? p[0] : (f && f.length ? f[0] : null));
            if (found) {
                h += '<h3>🧾 Reçu trouvé</h3>' + `<div class="card" onclick="closeSearch();hist('${found.student_id}')"><span>REC-${String(found.receipt_no).padStart(4, '0')}<br><small>${esc(found.students ? found.students.name : '')}</small></span><b>${nf(found.amount)} ${found.currency}</b></div>`;
                res.innerHTML = h;
            }
        }
    }
}
/* ---------- Paquet D : exports, sauvegarde, bannière ---------- */
document.querySelector('header').insertAdjacentHTML('afterend', '<div id=exb hidden></div>');
(function () {
    if (sessionStorage.orea_sp || matchMedia('(prefers-reduced-motion: reduce)').matches) return; sessionStorage.orea_sp = 1;
    document.body.insertAdjacentHTML('beforeend', '<div id=sp><div><img class=ld src=logo-dark.png alt=""><img class=ll src=logo-light.png alt=""><i></i></div></div>');
    setTimeout(() => { const e = $('#sp'); if (e) { e.classList.add('out'); setTimeout(() => e.remove(), 500); } }, 1300);
})();
const subLeft = () => S.school && S.school.sub_until ? Math.ceil((new Date(S.school.sub_until) - Date.now()) / 864e5) : 99;
const subWa = n => ADMIN_WA ? `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent('Bonjour, je souhaite renouveler l’abonnement de ' + S.school.name + ' (il reste ' + n + ' jour' + (n > 1 ? 's' : '') + ').')}` : '';
function subBanner() {
    const b = $('#exb'), n = subLeft();
    if (!b) return;
    if (!S.me || !dir() || n > 7 || n <= 0) { b.hidden = true; return; }
    b.innerHTML = `<span>⏳ Abonnement : il reste <b>${n} jour${n > 1 ? 's' : ''}</b></span>${subWa(n) ? `<a href="${subWa(n)}" target=_blank rel=noopener>Renouveler</a>` : ''}`; b.hidden = false;
}
const bkAge = () => { const t = +localStorage['orea_bk_' + S.school.id] || 0; return t ? Math.floor((Date.now() - t) / 864e5) : null; };
function bkCard() {
    const a = bkAge();
    // Rappel automatique le 1er du mois
    const is1st = new Date().getDate() === 1;
    if (a !== null && a < 30 && !is1st) return '';
    return `<div class="card col"><b class=due>💾 Sauvegarde ${is1st ? 'du mois' : 'conseillée'}</b><small>${a === null ? 'Aucune sauvegarde faite.' : 'Dernière sauvegarde il y a ' + a + ' jours.'}</small><button class=ghost onclick="exRun(event.target,backupAll)">Sauvegarder maintenant</button></div>`;
}
const dl = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); };
const fnm = (k, e) => k + '-' + S.school.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '-' + tdy() + '.' + e;
const csvCell = v => { if (typeof v === 'number') return String(v).replace('.', ','); v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
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
    if (f === 'csv') dl(new Blob([toCsv(r.head, r.rows)], { type: 'text/csv;charset=utf-8' }), fnm(r.name, 'csv'));
    else dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf'));
    toast('Fichier enregistré dans Téléchargements');
}
async function exRun(b, fn) { const t = b.textContent; b.disabled = true; b.textContent = 'Préparation…'; try { await fn(); } catch (e) { toast(e.message || 'Export impossible'); } finally { b.disabled = false; b.textContent = t; } }
function exportMenu() {
    const d = show(`<h3>Exporter</h3><div class=col><small>${esc(stamp())}</small>${[['stu', 'Élèves et soldes'], ['pay', 'Paiements'], ['clo', 'Clôtures de caisse']].map(([k, l]) => `<div class="card col"><b>${l}</b><div class=row><button class=ghost data-x="${k}:csv">CSV (Excel)</button><button class=ghost data-x="${k}:pdf">PDF</button></div></div>`).join('')}<button class=ghost id=xc>Fermer</button></div>`);
    d.querySelectorAll('[data-x]').forEach(b => b.onclick = () => exRun(b, () => exportDo(...b.dataset.x.split(':'))));
    d.querySelector('#xc').onclick = () => d.close();
}
async function backupAll() {
    const T = ['classes', 'students', 'payments', 'fee_payments', 'closures', 'extra_fees', 'attendance', 'sanctions', 'messages_log', 'change_requests', 'audit_log', 'expenses', 'events'], o = {}, er = {};
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

/* ---------- Paquet E : relance ---------- */
const ago = t => { const n = Math.floor((Date.now() - t) / 864e5); return n < 1 ? 'aujourd’hui' : 'il y a ' + n + ' j'; };
async function reminders() {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const r = await db.from('messages_log').select('student_id,created_at').eq('kind', 'frais').gte('created_at', since);
    const sent = new Map(); (r.data || []).forEach(m => { const t = +new Date(m.created_at); if (!(sent.get(m.student_id) > t)) sent.set(m.student_id, t); });
    const f = { cls: '', late: false };
    const go = s => { const m = getTpl('frais', s), u = waLink(s.parent_phone, m); if (!u) return toast('Numéro invalide'); window.open(u, '_blank'); logMsg(s.id, 'frais', m); sent.set(s.id, Date.now()); draw(); };
    const draw = () => {
        const all = ys().filter(s => s.balance_cdf > 0 && (!f.cls || s.class_id === f.cls) && (!f.late || status(s) === 'late')), no = all.filter(s => !s.parent_phone).length;
        const l = all.filter(s => s.parent_phone).sort((a, b) => (sent.has(a.id) - sent.has(b.id)) || b.balance_cdf - a.balance_cdf), done = l.filter(s => sent.has(s.id)).length, nx = l.find(s => !sent.has(s.id)), pc = l.length ? Math.round(100 * done / l.length) : 0;
        const d = show(`<h3>Relance des parents</h3><select id=rcl><option value="">Toutes les classes</option>${yc().map(c => `<option value="${c.id}" ${c.id === f.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>${hasTerms() ? `<div class=chips><button class="chip ${f.late ? '' : 'on'}" data-f=all>Tous les impayés</button><button class="chip ${f.late ? 'on' : ''}" data-f=late>En retard</button></div>` : ''}<small>Relancés ces 7 derniers jours : <b>${done} / ${l.length}</b></small><div class=pbar style="margin:6px 0 10px"><i style="width:${pc}%;background:var(--gold)"></i></div>${nx ? `<button id=rn>▶ Relancer le suivant · ${esc(nx.name)}</button>` : l.length ? '<p class=ok style="text-align:center">✓ Tous les parents ont été relancés</p>' : ''}${l.length ? l.map(s => `<div class=card><span>${status(s) === 'late' ? '🔴 ' : ''}${esc(s.name)}<br><small>${fmt(s.balance_cdf)}${sent.has(s.id) ? ' · ✓ relancé ' + ago(sent.get(s.id)) : ''}</small></span><button class=ghost style=width:auto data-w=${s.id}>${sent.has(s.id) ? 'Renvoyer' : 'WhatsApp'}</button></div>`).join('') : '<p class=empty>Aucun impayé avec numéro.</p>'}${no ? `<small>${no} élève(s) sans numéro ignoré(s).</small>` : ''}<button class=ghost id=rc2>Fermer</button>`);
        d.querySelector('#rcl').onchange = e => { f.cls = e.target.value; draw(); };
        d.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { f.late = b.dataset.f === 'late'; draw(); });
        const rn = d.querySelector('#rn'); if (rn) rn.onclick = () => go(nx);
        d.querySelectorAll('[data-w]').forEach(b => b.onclick = () => go(S.stu.find(x => x.id === b.dataset.w)));
        d.querySelector('#rc2').onclick = () => d.close();
    };
    draw();
}
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
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), url = URL.createObjectURL(blob), fn = 'rapport-' + key + '.png', file = new File([blob], fn, { type: 'image/png' }), can = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const d = show(`<h3>Rapport · ${esc(label)}</h3><div class=col><button id=ps>📤 Partager</button><a class="btn ghost" download="${fn}" href="${url}">Télécharger PNG</a><button class=ghost id=pc>Fermer</button></div><img src="${url}" alt="Rapport">`);
    d.querySelector('#pc').onclick = () => d.close();
    d.querySelector('#ps').onclick = async () => { if (can) { try { await navigator.share({ files: [file], text: 'Rapport ' + label + ' — ' + S.school.name }); } catch (e) { if (e.name !== 'AbortError') toast('Partage impossible.'); } } else { dl(blob, fn); toast('Image enregistrée.'); } };
}
/* ---------- PAQUET F & G : MENU, FINANCES, PÉDAGOGIE ---------- */
function doBackup() { exRun(event.target, backupAll); }
function yearMenu() {
    const y = yrs(), tm = S.terms[S.year] || {};
    const d = show(`<h3>Année scolaire</h3><div class=col><small>Année affichée : <b>${esc(S.year || '—')}</b></small><select id=ym>${y.map(v => `<option value="${esc(v)}" ${v === S.year ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select><div class=row><button class=ghost id=yc>Fermer</button><button id=yn>+ Nouvelle</button><button id=yp>Passage</button></div></div>`);
    d.querySelector('#yc').onclick = () => d.close();
    d.querySelector('#ym').onchange = e => { setYear(e.target.value); d.close(); };
    d.querySelector('#yn').onclick = () => { d.close(); setTimeout(newYear, 60); };
    d.querySelector('#yp').onclick = () => { d.close(); setTimeout(promote, 60); };
}
function vMenu() {
    const R = S.me.role; let h = `<h3>Menu</h3>`;
    h += `<div class=card onclick="menuGo('presences')"><span>📋 Présences</span><b>›</b></div>`;
    if (R !== 'enseignant') h += `<div class=card onclick="menuGo('caisse')"><span>💰 Caisse</span><b>›</b></div>`;
    if (R !== 'enseignant') {
        h += `<div class=card onclick="menuGo('impayes')"><span>🔴 Impayés</span><b>›</b></div>`;
        if (R === 'directeur') {
            h += `<div class=card onclick="menuGo('depenses')"><span>📉 Dépenses</span><b>›</b></div>`;
            h += `<div class=card onclick="menuGo('bilan')"><span>📊 Bilan mensuel</span><b>›</b></div>`;
        }
    }
    h += `<h3>Pédagogie</h3>`;
    h += `<div class=card onclick="menuGo('absences')"><span>📉 Suivi des absences</span><b>›</b></div>`;
    h += `<div class=card onclick="menuGo('sanctions')"><span>⚖️ Sanctions</span><b>›</b></div>`;
    h += `<div class=card onclick="menuGo('calendrier')"><span>📅 Calendrier</span><b>›</b></div>`;
    if (dir()) {
        h += `<h3>Administration</h3>`;
        h += `<div class=card onclick="yearMenu()"><span>🗓️ Années scolaires</span><b>›</b></div>`;
        h += `<div class=card onclick="team()"><span>👥 Équipe</span><b>›</b></div>`;
        h += `<div class=card onclick="journal()"><span>📋 Journal d'activité</span><b>›</b></div>`;
        h += `<div class=card onclick="exportMenu()"><span>📤 Exports (CSV / PDF)</span><b>›</b></div>`;
        h += `<div class=card onclick="doBackup()"><span>💾 Sauvegarde complète</span><b>›</b></div>`;
        h += `<div class=card onclick="monthReport()"><span>🖼️ Rapport mensuel</span><b>›</b></div>`;
    }
    $('#main').innerHTML = h;
}
function vImpayes() {
    S.impcls = S.impcls || ''; S.impf = S.impf || 'all'; S.imps = S.imps || 'anciennete';
    let l = ys().filter(s => s.balance_cdf > 0);
    if (S.impcls) l = l.filter(s => s.class_id === S.impcls);
    if (S.impf === '30j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 30 * 864e5; });
    if (S.impf === '60j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 60 * 864e5; });
    l.sort((a, b) => { if (S.imps === 'montant') return b.balance_cdf - a.balance_cdf; const la = a.last_pay ? new Date(a.last_pay).getTime() : 0, lb = b.last_pay ? new Date(b.last_pay).getTime() : 0; return la - lb; });
    const tot = l.reduce((a, s) => a + Number(s.balance_cdf || 0), 0);
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Impayés</h3>`;
    h += `<div class=bar><select id=icl><option value="">Toutes classes</option>${yc().map(c => `<option value="${c.id}" ${S.impcls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
    h += `<div class=chips><button class="chip ${S.impf === 'all' ? 'on' : ''}" onclick="S.impf='all';render()">Tous</button><button class="chip ${S.impf === '30j' ? 'on' : ''}" onclick="S.impf='30j';render()">> 30j</button><button class="chip ${S.impf === '60j' ? 'on' : ''}" onclick="S.impf='60j';render()">> 60j</button></div>`;
    h += `<div class=card><span>${l.length} élève(s)</span><b class=due>${fmt(tot)}</b></div>`;
    h += `<div class=row><button class=ghost onclick=impayesPDF()>📄 PDF</button>${dir() ? `<button onclick=reminders()>💬 Relancer</button>` : ''}</div>`;
    h += l.length ? l.map(s => `<div class=card onclick="menu('${s.id}')"><span>${esc(s.name)}<br><small>${esc(cnm(s.class_id))} · ${s.last_pay ? 'Dernier paiement il y a ' + Math.floor((Date.now() - new Date(s.last_pay)) / 864e5) + 'j' : 'Jamais payé'}</small></span><b class=due>${fmt(s.balance_cdf)}</b></div>`).join('') : '<p class=empty>Aucun impayé pour ces critères.</p>';
    $('#main').innerHTML = h;
    $('#icl').onchange = e => { S.impcls = e.target.value; render(); };
}
function impayesPDF() {
    let l = ys().filter(s => s.balance_cdf > 0);
    if (S.impcls) l = l.filter(s => s.class_id === S.impcls);
    if (S.impf === '30j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 30 * 864e5; });
    if (S.impf === '60j') l = l.filter(s => { const last = s.last_pay ? new Date(s.last_pay).getTime() : 0; return Date.now() - last > 60 * 864e5; });
    l.sort((a, b) => { if (S.imps === 'montant') return b.balance_cdf - a.balance_cdf; const la = a.last_pay ? new Date(a.last_pay).getTime() : 0, lb = b.last_pay ? new Date(b.last_pay).getTime() : 0; return la - lb; });
    if (!l.length) return toast('Aucun impayé à exporter.');
    const rows = l.map(s => [s.name, cnm(s.class_id), s.last_pay ? new Date(s.last_pay).toLocaleDateString('fr-FR') : 'Jamais', Math.round(Number(s.balance_cdf))]);
    const r = { name: 'impayes', title: 'Impayés — ' + S.school.name, sub: stamp() + ' · ' + l.length + ' élèves · montants en FC', head: ['Élève', 'Classe', 'Dernier paiement', 'Reste dû (FC)'], rows, w: [40, 25, 20, 15], r: [3], tot: ['Total', '', '', rows.reduce((t, r) => t + r[3], 0)] };
    try { dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf')); toast('PDF enregistré dans Téléchargements'); } catch (e) { toast(e.message); }
}
function nextMonth(ym) { const [y, m] = ym.split('-').map(Number), d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
async function vDepenses() {
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const d = new Date(); if (!S.depDate) S.depDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const { data, error } = await db.from('expenses').select('*').gte('date', S.depDate + '-01').lt('date', nextMonth(S.depDate) + '-01').order('date', { ascending: false });
    if (error) return toast(error.message);
    S.depenses = data;
    const tot = data.reduce((a, x) => a + Number(x.amount_cdf), 0);
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Dépenses</h3>`;
    h += `<div class=bar><input type=month value="${S.depDate}" id=dpm></div>`;
    h += `<div class=card><span>Total du mois</span><b class=due>${fmt(tot)}</b></div><button onclick=addExpense()>+ Ajouter une dépense</button>`;
    h += data.length ? data.map(x => `<div class=card onclick="editExpense('${x.id}')"><span>${esc(x.label)}<br><small>${new Date(x.date + 'T00:00').toLocaleDateString('fr-FR')} · ${x.category}</small></span><b>${nf(x.amount)} ${SYM[x.currency]}</b></div>`).join('') : '<p class=empty>Aucune dépense ce mois-ci.</p>';
    if (S.tab !== 'depenses') return;
    $('#main').innerHTML = h;
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
        const { error } = await db.from('expenses').update({ label: v.label.trim(), amount: +v.amount, amount_cdf: +v.amount * x.rate }).eq('id', id);
        if (error) throw error; d.close(); await vDepenses(); toast('Dépense modifiée');
    });
    d.querySelector('#e2').onclick = async () => {
        if (!confirm('Supprimer cette dépense ?')) return;
        const { error } = await db.from('expenses').delete().eq('id', id);
        if (error) return toast(error.message); d.close(); await vDepenses(); toast('Dépense supprimée');
    };
}
async function vBilan() {
    const d = new Date(); if (!S.bilDate) S.bilDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const [y, m] = S.bilDate.split('-').map(Number), a = new Date(y, m - 1, 1), b = new Date(y, m, 1), nk = b.getFullYear() + '-' + String(b.getMonth() + 1).padStart(2, '0') + '-01';
    const [p, f, ex] = await Promise.all([
        pageAll(() => db.from('payments').select('amount_cdf,method').gte('created_at', a.toISOString()).lt('created_at', b.toISOString())),
        pageAll(() => db.from('fee_payments').select('amount_cdf,method').gte('created_at', a.toISOString()).lt('created_at', b.toISOString())),
        db.from('expenses').select('*').gte('date', S.bilDate + '-01').lt('date', nk)
    ]);
    if (p.error || f.error || ex.error) return toast((p.error || f.error || ex.error).message);
    const enc = p.data.concat(f.data), totEnc = sum(enc), esp = sum(enc.filter(x => x.method === 'especes')), mm = totEnc - esp;
    const dep = ex.data, totDep = dep.reduce((t, x) => t + Number(x.amount_cdf), 0);
    const solde = totEnc - totDep;
    S._bilan = { esp, mm, totEnc, dep, totDep, solde, date: S.bilDate };
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Bilan mensuel</h3>`;
    h += `<div class=bar><input type=month id=bm value="${S.bilDate}"></div>`;
    h += `<div class=card col"><b>Encaissé</b><span>Espèces : ${fmt(esp)}</span><span>Mobile Money : ${fmt(mm)}</span><b class=ok style="margin-top:6px">Total : ${fmt(totEnc)}</b></div>`;
    h += `<div class=card col"><b>Dépensé</b>${dep.length ? dep.map(x => `<span style="display:flex;justify-content:space-between"><small>${esc(x.label)}</small><small>${fmt(x.amount_cdf)}</small></span>`).join('') : '<small>Aucune dépense</small>'}<b class=due style="margin-top:6px">Total : ${fmt(totDep)}</b></div>`;
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
async function vAbsences() {
    const d = new Date(); if (!S.absM) S.absM = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const [y, m] = S.absM.split('-').map(Number), a = new Date(y, m - 1, 1), b = new Date(y, m, 1);
    const { data, error } = await db.from('attendance').select('*').eq('status', 'absent').gte('day', a.toISOString().split('T')[0]).lt('day', b.toISOString().split('T')[0]);
    if (error) return toast(error.message);
    const abs = data || [], byStu = {}, byCls = {};
    abs.forEach(x => { byStu[x.student_id] = (byStu[x.student_id] || 0) + 1; const s = S.stu.find(z => z.id === x.student_id); if (s) byCls[s.class_id] = (byCls[s.class_id] || 0) + 1; });
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Suivi des absences</h3>`;
    h += `<div class=bar><input type=month id=am value="${S.absM}"></div>`;
    const l = Object.entries(byStu).map(([id, n]) => ({ s: S.stu.find(z => z.id === id), n })).filter(x => x.s && x.n >= 3).sort((a, b) => b.n - a.n);
    h += `<div class=card col"><b>Élèves à surveiller (≥ 3 absences)</b>${l.length ? l.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.s.name)} (${esc(cnm(x.s.class_id))})</span><b class=due>${x.n} fois</b></div>`).join('') : '<small>Aucun élève en dessous de la limite.</small>'}</div>`;
    const c = Object.entries(byCls).map(([id, n]) => ({ c: S.classes.find(z => z.id === id), n })).filter(x => x.c).sort((a, b) => b.n - a.n);
    h += `<div class="card col"><b>Absences par classe</b>${c.length ? c.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.c.name)}</span><b>${x.n} abs.</b></div>`).join('') : '<small>Aucune absence.</small>'}</div>`;
    if (S.tab !== 'absences') return;
    $('#main').innerHTML = h;
    $('#am').onchange = e => { S.absM = e.target.value; vAbsences(); };
}

async function vSanctions() {
    const d = new Date(); if (!S.sanM) S.sanM = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const [y, m] = S.sanM.split('-').map(Number), a = new Date(y, m - 1, 1), b = new Date(y, m, 1);
    const { data, error } = await db.from('sanctions').select('*').gte('day', a.toISOString().split('T')[0]).lt('day', b.toISOString().split('T')[0]).order('day', { ascending: false });
    if (error) return toast(error.message);
    const sanc = data || [], byStu = {};
    sanc.forEach(x => byStu[x.student_id] = (byStu[x.student_id] || 0) + 1);
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Vue globale des sanctions</h3>`;
    h += `<div class=bar><input type=month id=sm value="${S.sanM}"></div>`;
    const l = Object.entries(byStu).map(([id, n]) => ({ s: S.stu.find(z => z.id === id), n })).filter(x => x.s && x.n >= 3).sort((a, b) => b.n - a.n);
    h += `<div class="card col"><b>Élèves à dossier (≥ 3 sanctions)</b>${l.length ? l.map(x => `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(x.s.name)} (${esc(cnm(x.s.class_id))})</span><b class=due>${x.n} fois</b></div>`).join('') : '<small>Aucun élève avec un tel dossier.</small>'}</div>`;
    h += `<h3>Sanctions du mois (${sanc.length})</h3>`;
    h += sanc.length ? sanc.map(x => { const s = S.stu.find(z => z.id === x.student_id); return `<div class="card col"><b>${esc(s ? s.name : '?')} · ${esc(x.kind)}</b><small>${esc(cnm(s ? s.class_id : ''))} · ${new Date(x.day + 'T00:00').toLocaleDateString('fr-FR')}${x.note ? ' · ' + esc(x.note) : ''}</small></div>`; }).join('') : '<p class=empty>Aucune sanction enregistrée.</p>';
    if (S.tab !== 'sanctions') return;
    $('#main').innerHTML = h;
    $('#sm').onchange = e => { S.sanM = e.target.value; vSanctions(); };
}

async function vCalendrier() {
    $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
    const { data, error } = await db.from('events').select('*').gte('start_date', tdy()).order('start_date');
    if (error) return toast(error.message);
    const evs = data || [];
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Calendrier scolaire</h3>`;
    if (dir()) h += `<button onclick=addEvent()>+ Ajouter un événement</button>`;
    h += evs.length ? evs.map(x => `<div class="card col" onclick="editEvent('${x.id}')"><b>${esc(x.title)}</b><span>${fdate(x.start_date)}${x.end_date ? ' au ' + fdate(x.end_date) : ''}</span><small>${x.type.toUpperCase()}${x.description ? ' · ' + esc(x.description) : ''}</small></div>`).join('') : '<p class=empty data-ic="📅">Aucun événement à venir.</p>';
    h += `<h3>Exporter</h3><button class=ghost onclick=icsEvents()>📅 Ajouter à mon agenda (.ics)</button>`;
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
    const e = S.events.find(x => x.id === id);
    const d = show(`<h3>${esc(e.title)}</h3><p>${fdate(e.start_date)}${e.end_date ? ' au ' + fdate(e.end_date) : ''}</p><p><small>${esc(e.description || '')}</small></p><div class=col><button class=ghost id=e2>Supprimer</button><button class=ghost id=e3>Fermer</button></div>`);
    d.querySelector('#e3').onclick = () => d.close();
    d.querySelector('#e2').onclick = async () => { if (!confirm('Supprimer ?')) return; const { error } = await db.from('events').delete().eq('id', id); if (error) return toast(error.message); d.close(); await load(); vCalendrier(); toast('Supprimé'); };
}
function icsEvents() {
    if (!S.events || !S.events.length) return toast('Aucun événement.');
    const p = n => String(n).padStart(2, '0'), stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OREA Ecole//FR'];
    S.events.forEach(e => { const d = e.start_date.split('-'), ds = d[0] + d[1] + d[2]; lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@orea', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ds, 'SUMMARY:' + e.title, 'DESCRIPTION:' + (e.description || ''), 'END:VEVENT'); });
    lines.push('END:VCALENDAR');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' })); a.download = 'calendrier-orea.ics'; a.click();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
window.addEventListener('online', () => { S.offline ? boot() : qsync(); });
window.addEventListener('offline', qui);
setInterval(qsync, 30000);
boot();
