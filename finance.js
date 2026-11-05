/* =====================================================================
   ORÉA École v67 — finance.js (lots 2 et 4 : Finance complète + exports PNG)
   Module de gestion financière du Directeur.
   - Navigation en grille : Tableau de bord + Budget, Dettes, Revenus, Impayés, Dépenses, Bilan
   - Tableau de bord : solde du trimestre en cours (+ mois et année)
   - Budget : semaine / mois / trimestre / année, dépenses ET recettes,
     répartition automatique (annuel -> trimestres -> mois -> semaines),
     consolidation inverse, alertes 80 % / 100 %, projection, reliquats,
     lignes récurrentes, copie de la période précédente, fonds de réserve
   - Revenus : paiements des frais comptés automatiquement + revenus divers
   - Bilan : trimestriel par défaut (mois / année au choix), export PDF et PNG
   - Budget : export PDF et PNG
   - Dépenses : justification obligatoire si le budget est dépassé
   - Publication automatique d'annonce lors de modification de frais
   Remplace : vFinanceHome (directeur), vBilan, bilanPDF, addExpense, editFees.
   Nécessite le script SQL « etape3_finance_budget.sql ».
   ===================================================================== */
(function () {
    'use strict';

    const $ = s => document.querySelector(s);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nf = (n, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
    const fmt = n => nf(n / (S.school.rates[S.cur] || 1), S.cur === 'CDF' ? 0 : 2) + ' ' + SYM[S.cur];
    const tdy = () => new Date().toLocaleDateString('sv-SE');
    const thisMonth = () => tdy().slice(0, 7); // YYYY-MM
    const dateFr = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '—';
    const isDir = () => S.me && S.me.role === 'directeur';
    const ratePct = (a, b) => b > 0 ? Math.round(a / b * 100) : (a > 0 ? 100 : 0);

    /* ---------- Styles propres au module ---------- */
    if (!document.getElementById('fin-css')) {
        const st = document.createElement('style');
        st.id = 'fin-css';
        st.textContent = `
.fin-dash{margin:6px 0 8px;min-height:48px}
.fin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.fin-grid button{min-height:44px;padding:10px 4px;font-size:13.5px}
.fin-per{display:flex;align-items:center;gap:8px;margin:2px 0 10px}
.fin-per button{width:auto;min-height:38px;padding:6px 14px}
.fin-per b{flex:1;text-align:center;font-size:14.5px}
.fin-sec{font-size:12.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.07em;margin:18px 2px 2px}
.fin-tag{font-size:11px;color:var(--mut);font-style:italic}
.fin-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.fin-mini{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;margin-top:6px;flex-wrap:wrap}
.fin-mini button{width:auto;min-height:0;padding:5px 10px;font-size:12px}
.fin-over{border-color:var(--bad)!important}
.fin-warn{border-color:var(--gold)!important}
.fin-note{font-size:11.5px;color:var(--mut);border-left:2px solid var(--bad);padding-left:8px;margin-top:4px}
.fin-small .card.stat > b{font-size:15px}
.fin-bars{display:flex;align-items:flex-end;gap:10px;height:110px;margin-top:8px}
.fin-bars .bcol{flex:1}
.fin-bars .bbar.dep{background:var(--bad)}
.fin-bars .bbar.ghost{opacity:.45}
.card.hero .big.neg{background:none;-webkit-text-fill-color:var(--bad);color:var(--bad)}
`;
        document.head.appendChild(st);
    }

    /* =====================================================================
       PÉRIODES (semaine, mois, trimestre, année scolaire)
       Toutes les bornes sont des dates locales 'YYYY-MM-DD', fin exclue.
       ===================================================================== */
    const DAY = 864e5;
    const pd = s => Date.parse(s + 'T00:00:00Z');
    const addDays = (s, n) => new Date(pd(s) + n * DAY).toISOString().slice(0, 10);
    const days = (a, b) => Math.max(0, Math.round((pd(b) - pd(a)) / DAY));
    const overlap = (A, B) => days(A[0] > B[0] ? A[0] : B[0], A[1] < B[1] ? A[1] : B[1]);
    const inR = (d, R) => d >= R[0] && d < R[1];
    const d2iso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toISOString(); };
    const yParse = y => { const m = /^(\d{4})\s*-\s*(\d{4})$/.exec(String(y || '')); return m ? [+m[1], +m[2]] : null; };
    const yShift = (y, n) => { const p = yParse(y); return p ? (p[0] + n) + '-' + (p[1] + n) : y; };
    const mShift = (k, n) => { const [y, m] = k.split('-').map(Number), d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const mRange = k => [k + '-01', mShift(k, 1) + '-01'];
    const monday = d => { const wd = (new Date(pd(d)).getUTCDay() + 6) % 7; return addDays(d, -wd); };

    // Années civiles d'une année scolaire (« 2026-2027 » -> [2026, 2027])
    function yy(y) {
        const p = yParse(y); if (p) return p;
        const n = new Date(), a = n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear() - 1;
        return [a, a + 1];
    }
    // Année scolaire : du début du T1 au début du T1 de l'année suivante (sinon 1er sept. -> 1er sept.)
    function yearRange(y) {
        const [y1, y2] = yy(y), T = S.terms || {}, t = T[y] || {}, nx = T[(y1 + 1) + '-' + (y2 + 1)] || {};
        const a = t.t1 || `${y1}-09-01`;
        let b = nx.t1 || `${y2}-09-01`;
        if (b <= a) b = addDays(a, 365);
        return [a, b];
    }
    // Trimestres : synchronisés avec les dates programmées par l'école (table terms)
    function termRange(y, k) {
        const [, y2] = yy(y), t = (S.terms || {})[y] || {}, YR = yearRange(y);
        const s = [t.t1 || YR[0], t.t2 || `${y2}-01-01`, t.t3 || `${y2}-04-01`];
        const a = s[k - 1];
        let b = k < 3 ? s[k] : YR[1];
        if (!b || b <= a) b = addDays(a, 91);
        return [a, b];
    }
    function termOf(y, d = tdy()) { for (let k = 1; k <= 3; k++) if (inR(d, termRange(y, k))) return k; return null; }
    // Année scolaire qui contient une date
    function yearOf(d) {
        const L = new Set([...Object.keys(S.terms || {}), ...(S.classes || []).map(c => c.year).filter(Boolean), S.year]);
        for (const y of L) if (yParse(y) && inR(d, yearRange(y))) return y;
        const [Y, M] = d.split('-').map(Number);
        return M >= 9 ? Y + '-' + (Y + 1) : (Y - 1) + '-' + Y;
    }

    const PT = { semaine: 'Semaine', mois: 'Mois', trimestre: 'Trimestre', annee: 'Année' };
    function pRange(p) {
        if (p.type === 'semaine') return [p.key, addDays(p.key, 7)];
        if (p.type === 'mois') return mRange(p.key);
        if (p.type === 'trimestre') return termRange(p.year, +p.key.slice(1));
        return yearRange(p.key);
    }
    function pLabel(p) {
        if (p.type === 'semaine') return 'Semaine du ' + dateFr(p.key);
        if (p.type === 'mois') { const s = new Date(p.key + '-01T00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); }
        if (p.type === 'trimestre') return 'Trimestre ' + p.key.slice(1) + ' · ' + p.year;
        return 'Année ' + p.key;
    }
    function pMake(type, year) {
        year = year || S.year;
        if (type === 'semaine') { const k = monday(tdy()); return { type, key: k, year: yearOf(k) }; }
        if (type === 'mois') { const k = thisMonth(); return { type, key: k, year: yearOf(k + '-01') }; }
        if (type === 'trimestre') return { type, key: 'T' + (termOf(year) || 1), year };
        return { type, key: year, year };
    }
    function pShift(p, n) {
        if (p.type === 'semaine') { const k = addDays(p.key, 7 * n); return { type: p.type, key: k, year: yearOf(k) }; }
        if (p.type === 'mois') { const k = mShift(p.key, n); return { type: p.type, key: k, year: yearOf(k + '-01') }; }
        if (p.type === 'trimestre') {
            let k = +p.key.slice(1) + n, y = p.year;
            while (k < 1) { k += 3; y = yShift(y, -1); }
            while (k > 3) { k -= 3; y = yShift(y, 1); }
            return { type: p.type, key: 'T' + k, year: y };
        }
        const y = yShift(p.key, n); return { type: p.type, key: y, year: y };
    }
    // État des sélecteurs de période (un par écran)
    function getP(name, def, types) {
        S.finP = S.finP || {};
        let p = S.finP[name];
        if (!p || !types.includes(p.type)) p = S.finP[name] = pMake(def);
        return p;
    }
    function periodBar(name, types) {
        const p = S.finP[name];
        return `<div class=chips>${types.map(t => `<button class="chip ${p.type === t ? 'on' : ''}" data-act=ptype data-pn=${name} data-pt=${t}>${PT[t]}</button>`).join('')}</div>`
            + `<div class=fin-per><button class=ghost data-act=pshift data-pn=${name} data-n=-1 aria-label="Période précédente">‹</button><b>${esc(pLabel(p))}</b><button class=ghost data-act=pshift data-pn=${name} data-n=1 aria-label="Période suivante">›</button></div>`;
    }

    /* =====================================================================
       DONNÉES : encaissements, autres frais, dépenses, revenus divers
       ===================================================================== */
    const localDay = ts => new Date(ts).toLocaleDateString('sv-SE');
    // R : période principale ; ER : période élargie pour les dépenses (ex. période précédente)
    async function loadMoney(R, ER) {
        const sid = S.school.id, E = ER || R;
        const [p, f, e, r] = await Promise.all([
            pageAll(() => db.from('payments').select('id,amount_cdf,method,created_at').eq('school_id', sid).gte('created_at', d2iso(R[0])).lt('created_at', d2iso(R[1]))),
            pageAll(() => db.from('fee_payments').select('id,amount_cdf,method,created_at').eq('school_id', sid).gte('created_at', d2iso(R[0])).lt('created_at', d2iso(R[1]))),
            pageAll(() => db.from('expenses').select('*').eq('school_id', sid).gte('date', E[0]).lt('date', E[1])),
            pageAll(() => db.from('revenues').select('*').eq('school_id', sid).gte('date', R[0]).lt('date', R[1]))
        ]);
        const error = p.error || f.error || e.error || r.error;
        if (error) return { error };
        const mp = x => ({ d: localDay(x.created_at), a: Number(x.amount_cdf) || 0, m: x.method });
        return {
            pay: p.data.map(mp),
            fee: f.data.map(mp),
            exp: e.data.map(x => ({ id: x.id, d: x.date, a: Number(x.amount_cdf) || 0, cat: x.category, label: x.label, note: x.overrun_note || null })),
            rev: r.data.map(x => ({ id: x.id, d: x.date, a: Number(x.amount_cdf) || 0, cat: x.category, label: x.label, amount: x.amount, currency: x.currency, rate: x.rate }))
        };
    }
    const sumIn = (L, R, f) => L.reduce((t, x) => t + (inR(x.d, R) && (!f || f(x)) ? x.a : 0), 0);
    function balance(M, R) {
        const enc = sumIn(M.pay, R) + sumIn(M.fee, R), dep = sumIn(M.exp, R), rev = sumIn(M.rev, R);
        return { enc, dep, rev, solde: enc + rev - dep };
    }

    /* =====================================================================
       NAVIGATION (grille)
       ===================================================================== */
    const still = tab => S.tab === 'finance_home' && S.finTab === tab && $('#fin-content');
    const finErr = e => {
        const m = String((e && e.message) || e || 'Erreur inconnue');
        const txt = /failed to fetch|networkerror|load failed/i.test(m) ? 'Pas de connexion internet.' : m;
        const box = $('#fin-content') || $('#main');
        box.innerHTML = `<p class=empty>${esc(txt)}</p><div class=row><button data-act=retry>Réessayer</button></div>`;
    };

    const baseFin = window.vFinanceHome;
    window.vFinanceHome = function () {
        if (!isDir()) return baseFin();
        if (S.finTab === undefined) S.finTab = 'dash';
        S.tab = 'finance_home';
        renderFin();
    };

    const GRID = [['budget', 'Budget'], ['dettes', 'Dettes'], ['revenus', 'Revenus'], ['impayes', 'Impayés'], ['depenses', 'Dépenses'], ['bilan', 'Bilan']];
    function renderFin() {
        const on = t => S.finTab === t;
        let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Finance</h3>`;
        h += `<button class="fin-dash ${on('dash') ? '' : 'ghost'}" data-ft=dash>Tableau de bord</button>`;
        h += `<div class=fin-grid>${GRID.map(t => `<button class="${on(t[0]) ? '' : 'ghost'}" data-ft=${t[0]}>${t[1]}</button>`).join('')}</div>`;
        $('#main').innerHTML = h + `<div id="fin-content"><div class=sk></div><div class=sk></div></div>`;
        document.querySelectorAll('#main [data-ft]').forEach(b => b.onclick = () => { S.finTab = b.dataset.ft; renderFin(); });
        $('#fin-content').onclick = onAct;

        if (S.finTab === 'dash') loadDash();
        else if (S.finTab === 'budget') loadBudget();
        else if (S.finTab === 'dettes') loadDettes();
        else if (S.finTab === 'revenus') loadRevenus();
        else if (S.finTab === 'bilan') window.vBilan();
        else if (S.finTab === 'impayes') { if (typeof vImpayes === 'function') vImpayes(); else finErr('Erreur de chargement.'); }
        else if (S.finTab === 'depenses') { if (typeof vDepenses === 'function') vDepenses(); else finErr('Erreur de chargement.'); }
    }
    // Recharge l'onglet affiché (Finance intégrée ou Bilan seul)
    const reload = () => { if (S.tab === 'finance_home') renderFin(); else render(); };

    // Toutes les actions des écrans Finance passent par data-act (pas de noms dans les onclick)
    async function onAct(e) {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act, d = b.dataset;
        if (a === 'retry') return reload();
        if (a === 'ptype') { S.finP[d.pn] = pMake(d.pt, (S.finP[d.pn] || {}).year); return reload(); }
        if (a === 'pshift') { S.finP[d.pn] = pShift(S.finP[d.pn], +d.n); return reload(); }
        if (a === 'goto') { S.finTab = d.tab; return renderFin(); }
        if (a === 'addRev') return window.addRevenu();
        if (a === 'editRev') return editRevenu(d.id);
        if (a === 'addDebt') return window.addDette(d.type);
        if (a === 'payDebt') return window.payDette(d.id);
        if (a === 'bLine') return editLine(d.kind, d.cat || null);
        if (a === 'bReport') return reportLine(d.cat, +d.amt, d.from);
        if (a === 'bCopy') return copyPrev();
        if (a === 'gNew') return goalNew();
        if (a === 'gAdd') return goalMove(d.id, 1);
        if (a === 'gSub') return goalMove(d.id, -1);
        if (a === 'gDel') return goalDel(d.id);
        if (a === 'bilPdf') return window.bilanPDF();
        if (a === 'bilPng') { const r = bilanRep(); if (!r) return toast('Ouvrez d’abord le bilan.'); return pngOut(r).catch(x => toast(x.message)); }
        if (a === 'budPdf' || a === 'budPng') {
            const r = S._budRep; if (!r) return;
            if (a === 'budPng') return pngOut(r).catch(x => toast(x.message));
            try { dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf')); toast('PDF enregistré dans Téléchargements'); } catch (x) { toast(x.message); }
        }
    }

    /* =====================================================================
       1. TABLEAU DE BORD
       ===================================================================== */
    async function loadDash() {
        const y = S.year, YR = yearRange(y), k = termOf(y), TR = k ? termRange(y, k) : null;
        const m = thisMonth(), MR = mRange(m);
        const R = [YR[0] < MR[0] ? YR[0] : MR[0], YR[1] > MR[1] ? YR[1] : MR[1]];
        const [M, det] = await Promise.all([
            loadMoney(R),
            db.from('debts').select('amount_cdf,type').eq('school_id', S.school.id).eq('status', 'en_attente')
        ]);
        if (!still('dash')) return;
        if (M.error || det.error) return finErr(M.error || det.error);

        const T = TR ? balance(M, TR) : null, Mo = balance(M, MR), Y = balance(M, YR), main = T || Y;
        const dl = det.data || [];
        const detNet = dl.filter(x => x.type === 'a_recevoir').reduce((a, x) => a + Number(x.amount_cdf), 0)
            - dl.filter(x => x.type === 'a_payer').reduce((a, x) => a + Number(x.amount_cdf), 0);
        const col = v => v >= 0 ? 'var(--ok)' : 'var(--bad)';

        let h = `<div class="card hero col" style="margin-bottom:12px">
                <small>${T ? 'Solde du trimestre ' + k : 'Solde de l’année ' + esc(y)}</small>
                <span class="big ${main.solde < 0 ? 'neg' : ''}">${fmt(main.solde)}</span>
                <small>${T ? 'Du ' + dateFr(TR[0]) + ' au ' + dateFr(addDays(TR[1], -1)) : 'Aucun trimestre en cours'}</small>
            </div>
            <div class="stat-pair">
                <div class="card stat"><span>Encaissements</span><b class=ok>${fmt(main.enc)}</b></div>
                <div class="card stat"><span>Dépenses</span><b class=due>${fmt(main.dep)}</b></div>
            </div>
            <div class="stat-pair">
                <div class="card stat"><span>Revenus divers</span><b>${fmt(main.rev)}</b></div>
                <div class="card stat"><span>Dettes (net)</span><b class="${detNet >= 0 ? 'ok' : 'due'}">${fmt(detNet)}</b></div>
            </div>`;
        if (!hasTerms()) h += `<div class="card col"><small>Astuce : enregistrez les dates des trimestres (Réglages) pour suivre le solde par trimestre.</small></div>`;
        h += `<p class=fin-sec>Autres périodes</p>
            <div class="stat-pair fin-small">
                <div class="card stat"><span>Solde du mois</span><b style="color:${col(Mo.solde)}">${fmt(Mo.solde)}</b></div>
                <div class="card stat"><span>Solde de l’année</span><b style="color:${col(Y.solde)}">${fmt(Y.solde)}</b></div>
            </div>
            <p class=fin-sec>Actions rapides</p>
            <div class="row">
                <button class="ghost" data-act=addRev>+ Revenu</button>
                <button class="ghost" data-act=addDebt data-type=a_payer>+ Dette</button>
            </div>
            <div class="row">
                <button class="ghost" data-act=addDebt data-type=a_recevoir>+ Créance</button>
                <button class="ghost" data-act=goto data-tab=budget>Gérer le budget</button>
            </div>`;
        $('#fin-content').innerHTML = h;
    }

    /* =====================================================================
       2. BUDGET (cœur de la finance)
       ===================================================================== */
    const DEP = [['salaires', 'Salaires'], ['loyer', 'Loyer'], ['electricite', 'Électricité/Eau'], ['fournitures', 'Fournitures'], ['transport', 'Transport'], ['entretien', 'Entretien'], ['examens', 'Examens'], ['communication', 'Communication'], ['autre', 'Autre']];
    const REV_MAN = [['dons', 'Dons'], ['subventions', 'Subventions'], ['locations', 'Locations'], ['ventes', 'Ventes'], ['autres', 'Autres']];
    const REC = [['scolarite', 'Scolarité'], ['frais', 'Autres frais'], ...REV_MAN];
    const lbl = (L, c) => (L.find(x => x[0] === c) || [c, c])[1];
    const BTYPES = ['semaine', 'mois', 'trimestre', 'annee'];
    const LV = { semaine: 'la semaine', mois: 'le mois', trimestre: 'le trimestre', annee: 'l’annuel' };
    const LVP = { semaine: 'semaines', mois: 'mois', trimestre: 'trimestres' };
    const DOWN = { semaine: ['mois', 'trimestre', 'annee'], mois: ['trimestre', 'annee'], trimestre: ['annee'], annee: [] };
    const UP = { annee: ['trimestre', 'mois'], trimestre: ['mois', 'semaine'], mois: ['semaine'], semaine: [] };

    function lineRange(x) {
        if (x.period_type === 'semaine') return [x.period_key, addDays(x.period_key, 7)];
        if (x.period_type === 'mois') return mRange(x.period_key);
        if (x.period_type === 'trimestre') return termRange(x.year, +String(x.period_key).slice(1));
        return yearRange(x.period_key);
    }
    // Montant prévu « effectif » d'une catégorie sur une période :
    // 1) ligne saisie pour cette période ; 2) sinon réparti depuis une période plus large ;
    // 3) sinon somme des périodes plus courtes (consolidation).
    function eff(lines, kind, cat, p, R) {
        const L = lines.filter(x => x.kind === kind && x.category === cat);
        const ex = L.find(x => x.period_type === p.type && x.period_key === p.key && (p.type !== 'trimestre' || x.year === p.year));
        if (ex) return { v: Number(ex.planned_cdf), src: '', line: ex };
        const w = arr => arr.reduce((t, x) => { const r = lineRange(x), n = days(r[0], r[1]); return t + (n ? Number(x.planned_cdf) * overlap(r, R) / n : 0); }, 0);
        for (const lv of DOWN[p.type]) {
            const arr = L.filter(x => x.period_type === lv && overlap(lineRange(x), R) > 0);
            if (arr.length) return { v: w(arr), src: 'réparti depuis ' + LV[lv] };
        }
        for (const lv of UP[p.type]) {
            const arr = L.filter(x => x.period_type === lv && overlap(lineRange(x), R) > 0);
            if (arr.length) return { v: w(arr), src: 'somme des ' + LVP[lv] };
        }
        return { v: 0, src: '' };
    }
    // Recettes attendues calculées automatiquement à partir des frais × élèves
    function autoRec(cat, R, year) {
        const ids = new Set((S.classes || []).filter(c => c.year === year).map(c => c.id));
        const st = (S.stu || []).filter(s => ids.has(s.class_id));
        if (cat === 'scolarite') {
            let t = 0;
            for (let k = 1; k <= 3; k++) {
                const TR = termRange(year, k), n = days(TR[0], TR[1]);
                const due = st.reduce((a, s) => a + Number(s['due' + k + '_cdf'] || 0), 0);
                if (n) t += due * overlap(R, TR) / n;
            }
            return t;
        }
        if (cat === 'frais') {
            const YR = yearRange(year), n = days(YR[0], YR[1]);
            return n ? st.reduce((a, s) => a + Number(s.fee_exp_cdf || 0), 0) * overlap(R, YR) / n : 0;
        }
        return 0;
    }
    function recReal(M, R, cat) {
        if (cat === 'scolarite') return sumIn(M.pay, R);
        if (cat === 'frais') return sumIn(M.fee, R);
        return sumIn(M.rev, R, x => x.cat === cat);
    }

    const upsertLine = (p, kind, cat, cdf, recurring, note) => db.from('budgets').upsert({
        school_id: S.school.id, year: p.year, period_type: p.type, period_key: p.key,
        kind, category: cat, planned_cdf: Math.round(cdf * 100) / 100, recurring: !!recurring, note: note || null
    }, { onConflict: 'school_id,year,period_type,period_key,kind,category' });

    // Lignes récurrentes : reprises automatiquement dans une période en cours ou à venir encore vide
    async function carryRecurring(p) {
        const R = pRange(p), ck = p.type + '|' + p.year + '|' + p.key;
        S._finCarry = S._finCarry || {};
        if (S._finCarry[ck] || R[1] <= tdy()) return 0;
        S._finCarry[ck] = 1;
        const sid = S.school.id;
        const cur = await db.from('budgets').select('id').eq('school_id', sid).eq('period_type', p.type).eq('period_key', p.key).eq('year', p.year).limit(1);
        if (cur.error || (cur.data || []).length) return 0;
        const rec = await db.from('budgets').select('*').eq('school_id', sid).eq('period_type', p.type).eq('recurring', true)
            .order('year', { ascending: false }).order('period_key', { ascending: false }).limit(200);
        if (rec.error) return 0;
        const before = (rec.data || []).filter(x => (x.year + '|' + x.period_key) < (p.year + '|' + p.key));
        if (!before.length) return 0;
        const top = before[0].year + '|' + before[0].period_key;
        const src = before.filter(x => (x.year + '|' + x.period_key) === top);
        const rows = src.map(x => ({ school_id: sid, year: p.year, period_type: p.type, period_key: p.key, kind: x.kind, category: x.category, planned_cdf: x.planned_cdf, recurring: true, note: null }));
        const { error } = await db.from('budgets').upsert(rows, { onConflict: 'school_id,year,period_type,period_key,kind,category' });
        return error ? 0 : rows.length;
    }

    async function loadBudget() {
        const p = getP('bud', 'mois', BTYPES), R = pRange(p), pp = pShift(p, -1), PR = pRange(pp), sid = S.school.id;
        const carried = await carryRecurring(p).catch(() => 0);
        if (!still('budget')) return;
        const [lr, prv, M, gl] = await Promise.all([
            db.from('budgets').select('*').eq('school_id', sid).eq('year', p.year),
            db.from('budgets').select('*').eq('school_id', sid).eq('period_type', pp.type).eq('period_key', pp.key).eq('year', pp.year).eq('kind', 'depense'),
            loadMoney(R, [PR[0] < R[0] ? PR[0] : R[0], R[1]]),
            db.from('finance_goals').select('*').eq('school_id', sid).order('created_at')
        ]);
        if (!still('budget')) return;
        const err = lr.error || prv.error || M.error;
        if (err) return finErr(err);
        if (carried) toast(carried + ' ligne(s) récurrente(s) reprise(s) automatiquement');

        const lines = lr.data || [], prevLines = prv.data || [];
        S._bud = { p, lines };
        const today = tdy(), running = inR(today, R);
        const el = running ? days(R[0], addDays(today, 1)) / Math.max(1, days(R[0], R[1])) : 1;
        const hasOwn = lines.some(x => x.period_type === p.type && x.period_key === p.key);

        // ----- Dépenses -----
        let depPlan = 0, depReal = 0, nOver = 0, nWarn = 0, hDep = '';
        const xr = []; // lignes de l'export PDF / PNG
        DEP.forEach(([c, name]) => {
            const e = eff(lines, 'depense', c, p, R), plan = e.v, real = sumIn(M.exp, R, x => x.cat === c);
            if (plan <= 0 && real <= 0 && !e.line) return;
            depPlan += plan; depReal += real;
            xr.push([name, 'Dépense', Math.round(plan), Math.round(real), plan > 0 ? ratePct(real, plan) + ' %' : '—']);
            const pct = ratePct(real, plan), over = plan > 0 && real > plan, warn = !over && plan > 0 && pct >= 80;
            if (over) nOver++; else if (warn) nWarn++;
            const color = over ? 'var(--bad)' : warn ? 'var(--gold)' : 'var(--ok)';
            const proj = running && el < 1 && real > 0 ? real / el : 0;
            // Reliquat de la période précédente (prévu non dépensé)
            const pl = prevLines.find(x => x.category === c);
            const prevReal = sumIn(M.exp, PR, x => x.cat === c);
            const rel = pl ? Number(pl.planned_cdf) - prevReal : 0;
            const reported = e.line && String(e.line.note || '').includes('report:' + pp.key);
            const notes = M.exp.filter(x => x.cat === c && x.note && inR(x.d, R));
            hDep += `<div class="card col ${over ? 'fin-over' : warn ? 'fin-warn' : ''}" style="margin-bottom:8px">
                <div class=fin-head><b>${esc(name)}${e.line && e.line.recurring ? ' <span class=fin-tag>· récurrent</span>' : ''}</b><span style="font-size:12px">${fmt(real)} / ${fmt(plan)}</span></div>
                ${e.src ? `<span class=fin-tag>Prévu ${esc(e.src)}</span>` : ''}
                <div class="pbar" style="margin:6px 0"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></div>
                <div class=fin-mini>
                    <small>${plan > 0 ? pct + ' % utilisé' + (over ? ' · <b class=due>dépassé de ' + fmt(real - plan) + '</b>' : warn ? ' · <b style="color:var(--gold)">attention</b>' : '') : 'Aucun montant prévu'}</small>
                    <button class=ghost data-act=bLine data-kind=depense data-cat=${c}>Modifier</button>
                </div>
                ${proj ? `<small class=fin-tag>À ce rythme, fin de période : <b class="${plan > 0 && proj > plan ? 'due' : ''}">${fmt(proj)}</b></small>` : ''}
                ${rel > 0 && !reported ? `<div class=fin-mini><small>Non dépensé période précédente : ${fmt(rel)}</small><button class=ghost data-act=bReport data-cat=${c} data-amt=${rel} data-from=${esc(pp.key)}>Reporter</button></div>` : ''}
                ${notes.map(x => `<div class=fin-note>Dépassement justifié · ${esc(x.label)} (${fmt(x.a)}) : ${esc(x.note)}</div>`).join('')}
            </div>`;
        });

        // ----- Recettes -----
        let recPlan = 0, recRl = 0, hRec = '';
        REC.forEach(([c, name]) => {
            let e = eff(lines, 'recette', c, p, R);
            if (!e.line && !e.src && (c === 'scolarite' || c === 'frais')) { const v = autoRec(c, R, p.year); if (v > 0) e = { v, src: 'calculé : frais × élèves' }; }
            const plan = e.v, real = recReal(M, R, c);
            if (plan <= 0 && real <= 0 && !e.line) return;
            recPlan += plan; recRl += real;
            xr.push([name, 'Recette', Math.round(plan), Math.round(real), plan > 0 ? ratePct(real, plan) + ' %' : '—']);
            const pct = ratePct(real, plan), color = pct >= 100 ? 'var(--ok)' : pct >= 50 ? 'var(--gold)' : 'var(--bad)';
            hRec += `<div class="card col" style="margin-bottom:8px">
                <div class=fin-head><b>${esc(name)}${c === 'scolarite' || c === 'frais' ? ' <span class=fin-tag>· automatique</span>' : ''}</b><span style="font-size:12px">${fmt(real)} / ${fmt(plan)}</span></div>
                ${e.src ? `<span class=fin-tag>Prévu ${esc(e.src)}</span>` : ''}
                <div class="pbar" style="margin:6px 0"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></div>
                <div class=fin-mini><small>${plan > 0 ? pct + ' % encaissé' : 'Aucun montant prévu'}</small><button class=ghost data-act=bLine data-kind=recette data-cat=${c}>Modifier</button></div>
            </div>`;
        });

        const resPlan = recPlan - depPlan, resReal = recRl - depReal, mx = Math.max(recPlan, recRl, depPlan, depReal, 1);
        S._budRep = { name: 'budget-' + p.type + '-' + p.key + (p.type === 'trimestre' ? '-' + p.year : ''), title: 'Budget — ' + S.school.name, sub: pLabel(p) + ' · édité le ' + new Date().toLocaleDateString('fr-FR') + ' · montants en FC',
            head: ['Catégorie', 'Type', 'Prévu (FC)', 'Réel (FC)', '%'], w: [34, 14, 19, 19, 10], r: [2, 3, 4], rows: xr, tot: ['Résultat (recettes − dépenses)', '', Math.round(resPlan), Math.round(resReal), ''] };
        const bar = (v, cls, t) => `<div class=bcol><small>${short(v)}</small><div class="bbar ${cls}" style="height:${Math.max(2, Math.round(v / mx * 70))}px"></div><small>${t}</small></div>`;
        let h = periodBar('bud', BTYPES);
        h += `<div class="card hero col" style="margin-bottom:10px">
                <small>Résultat prévu</small>
                <span class="big ${resPlan < 0 ? 'neg' : ''}">${fmt(resPlan)}</span>
                <small>Réel à ce jour : <b style="color:${resReal >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmt(resReal)}</b>${running ? ' · ' + Math.round(el * 100) + ' % de la période écoulée' : ''}</small>
            </div>`;
        if (nOver || nWarn) h += `<div class="card col fin-over"><b>${nOver ? '⚠ ' + nOver + ' catégorie(s) dépassée(s)' : ''}${nOver && nWarn ? ' · ' : ''}${nWarn ? nWarn + ' à plus de 80 %' : ''}</b></div>`;
        h += `<div class="card col"><div class=fin-bars>${bar(recPlan, 'ghost', 'Rec. prévues')}${bar(recRl, '', 'Rec. réelles')}${bar(depPlan, 'dep ghost', 'Dép. prévues')}${bar(depReal, 'dep', 'Dép. réelles')}</div></div>`;
        h += `<div class="row"><button class=ghost data-act=budPdf>📄 PDF</button><button class=ghost data-act=budPng>🖼 PNG</button></div>`;
        if (!hasOwn) h += `<div class="row"><button class=ghost data-act=bCopy>Copier ${esc(pLabel(pp).toLowerCase())}</button></div>`;

        h += `<p class=fin-sec>Dépenses</p>` + (hDep || '<p class=empty>Aucune dépense prévue ni réalisée sur cette période.</p>')
            + `<button class=ghost data-act=bLine data-kind=depense>+ Ligne de dépense</button>`;
        h += `<p class=fin-sec>Recettes</p>` + (hRec || '<p class=empty>Aucune recette prévue ni réalisée sur cette période.</p>')
            + `<button class=ghost data-act=bLine data-kind=recette>+ Ligne de recette</button>`;

        // Répartition par trimestre (vue annuelle)
        if (p.type === 'annee') {
            h += `<p class=fin-sec>Dépenses par trimestre</p><div class="card col">`;
            for (let k = 1; k <= 3; k++) {
                const tp = { type: 'trimestre', key: 'T' + k, year: p.year }, TR = termRange(p.year, k);
                const pl = DEP.reduce((t, [c]) => t + eff(lines, 'depense', c, tp, TR).v, 0), rl = sumIn(M.exp, TR);
                h += `<div class=fin-head style="margin:4px 0"><span>Trimestre ${k}</span><small>${fmt(rl)} / ${fmt(pl)}</small></div>
                      <div class="pbar"><i style="width:${Math.min(100, ratePct(rl, pl))}%;background:${pl > 0 && rl > pl ? 'var(--bad)' : 'var(--ok)'}"></i></div>`;
            }
            h += `</div>`;
        }

        // Fonds de réserve
        h += `<p class=fin-sec>Fonds de réserve</p>`;
        if (gl.error) h += `<div class="card col"><small>Indisponible : exécutez le script SQL « etape3_finance_budget.sql ».</small></div>`;
        else {
            h += (gl.data || []).map(g => {
                const pct = ratePct(Number(g.saved_cdf), Number(g.target_cdf));
                return `<div class="card col" style="margin-bottom:8px">
                    <div class=fin-head><b>${esc(g.label)}</b><span style="font-size:12px">${fmt(g.saved_cdf)} / ${fmt(g.target_cdf)}</span></div>
                    <div class="pbar" style="margin:6px 0"><i style="width:${Math.min(100, pct)}%"></i></div>
                    <div class=fin-mini><small>${pct} %${g.deadline ? ' · objectif le ' + dateFr(g.deadline) : ''}</small>
                    <span><button class=ghost data-act=gAdd data-id=${g.id}>+ Épargner</button> <button class=ghost data-act=gSub data-id=${g.id}>− Retirer</button> <button class=ghost data-act=gDel data-id=${g.id}>Suppr.</button></span></div>
                </div>`;
            }).join('') + `<button class=ghost data-act=gNew>+ Nouvel objectif d’épargne</button>`;
        }
        $('#fin-content').innerHTML = h;
    }

    function editLine(kind, cat) {
        const B = S._bud; if (!B) return;
        const p = B.p, R = pRange(p), L = kind === 'depense' ? DEP : REC;
        const e = cat ? eff(B.lines, kind, cat, p, R) : { v: 0 };
        const rate = S.school.rates[S.cur] || 1;
        const fields = [];
        if (!cat) fields.push({ n: 'cat', l: 'Catégorie', o: L.map(x => [x[0], esc(x[1])]), v: L[0][0] });
        fields.push({ n: 'amount', l: 'Montant prévu (' + S.cur + ') — 0 pour revenir au calcul automatique', t: 'number', v: e.v ? Math.round(e.v / rate * 100) / 100 : '' });
        fields.push({ n: 'rec', l: 'Ligne récurrente (reprise automatiquement)', o: [['0', 'Non'], ['1', 'Oui']], v: e.line && e.line.recurring ? '1' : '0' });
        ask(esc((kind === 'depense' ? 'Dépense prévue' : 'Recette prévue') + (cat ? ' — ' + lbl(L, cat) : '') + ' · ' + pLabel(p)), fields, async v => {
            const c = cat || v.cat, amt = +v.amount;
            if (!(amt >= 0)) throw Error('Montant invalide');
            let error;
            if (amt === 0) ({ error } = await db.from('budgets').delete().eq('school_id', S.school.id).eq('year', p.year).eq('period_type', p.type).eq('period_key', p.key).eq('kind', kind).eq('category', c));
            else ({ error } = await upsertLine(p, kind, c, amt * rate, v.rec === '1', e.line ? e.line.note : null));
            if (error) throw error;
            toast(amt === 0 ? 'Ligne supprimée' : 'Budget enregistré'); reload();
        });
    }
    async function reportLine(cat, amt, fromKey) {
        const B = S._bud; if (!B || !(amt > 0)) return;
        const p = B.p, e = eff(B.lines, 'depense', cat, p, pRange(p));
        if (!confirm('Ajouter ' + fmt(amt) + ' (non dépensé) au budget « ' + lbl(DEP, cat) + ' » de cette période ?')) return;
        const note = ((e.line && e.line.note) ? e.line.note + ' ' : '') + 'report:' + fromKey;
        const { error } = await upsertLine(p, 'depense', cat, e.v + amt, e.line ? e.line.recurring : false, note);
        if (error) return toast(error.message);
        toast('Reliquat reporté'); reload();
    }
    async function copyPrev() {
        const B = S._bud; if (!B) return;
        const p = B.p, pp = pShift(p, -1);
        const { data, error } = await db.from('budgets').select('*').eq('school_id', S.school.id).eq('period_type', pp.type).eq('period_key', pp.key).eq('year', pp.year);
        if (error) return toast(error.message);
        if (!(data || []).length) return toast('Rien à copier : la période précédente n’a pas de lignes saisies.');
        const rows = data.map(x => ({ school_id: S.school.id, year: p.year, period_type: p.type, period_key: p.key, kind: x.kind, category: x.category, planned_cdf: x.planned_cdf, recurring: x.recurring, note: null }));
        const r = await db.from('budgets').upsert(rows, { onConflict: 'school_id,year,period_type,period_key,kind,category' });
        if (r.error) return toast(r.error.message);
        toast(rows.length + ' ligne(s) copiée(s)'); reload();
    }

    // ----- Fonds de réserve -----
    function goalNew() {
        const rate = S.school.rates[S.cur] || 1;
        ask('Nouvel objectif d’épargne', [
            { n: 'label', l: 'Nom (ex : Réserve de sécurité, Nouveau toit)' },
            { n: 'target', l: 'Montant visé (' + S.cur + ')', t: 'number' },
            { n: 'deadline', l: 'Date visée (facultatif)', t: 'date', r: false }
        ], async v => {
            if (!(+v.target > 0)) throw Error('Montant invalide');
            const { error } = await db.from('finance_goals').insert({ school_id: S.school.id, label: v.label.trim().slice(0, 80), target_cdf: +v.target * rate, deadline: v.deadline || null });
            if (error) throw error;
            toast('Objectif créé'); reload();
        });
    }
    async function goalMove(id, sign) {
        const rate = S.school.rates[S.cur] || 1;
        ask(sign > 0 ? 'Mettre de côté' : 'Retirer de la réserve', [{ n: 'amount', l: 'Montant (' + S.cur + ')', t: 'number' }], async v => {
            if (!(+v.amount > 0)) throw Error('Montant invalide');
            const { data: g, error: e1 } = await db.from('finance_goals').select('saved_cdf').eq('id', id).single();
            if (e1) throw e1;
            const nv = Number(g.saved_cdf) + sign * (+v.amount * rate);
            if (nv < 0) throw Error('Montant supérieur à la réserve disponible');
            const { error } = await db.from('finance_goals').update({ saved_cdf: nv }).eq('id', id);
            if (error) throw error;
            toast(sign > 0 ? 'Montant mis de côté' : 'Montant retiré'); reload();
        });
    }
    async function goalDel(id) {
        if (!confirm('Supprimer cet objectif d’épargne ?')) return;
        const { error } = await db.from('finance_goals').delete().eq('id', id);
        if (error) return toast(error.message);
        toast('Objectif supprimé'); reload();
    }

    /* =====================================================================
       3. DETTES (On doit / On nous doit)
       ===================================================================== */
    async function loadDettes() {
        const { data, error } = await db.from('debts').select('*').eq('school_id', S.school.id).eq('status', 'en_attente').order('due_date');
        if (!still('dettes')) return;
        if (error) return finErr(error);
        const dettes = data || [];
        const aPayer = dettes.filter(d => d.type === 'a_payer');
        const aRecevoir = dettes.filter(d => d.type === 'a_recevoir');

        const card = d => {
            const isLate = d.due_date && d.due_date < tdy();
            const wl = d.contact_phone ? waLink(d.contact_phone, 'Bonjour, concernant « ' + d.label + ' ».') : null;
            return `
                <div class="card col" style="margin-bottom:8px;border-left:3px solid ${isLate ? 'var(--bad)' : 'var(--line)'}">
                    <div style="display:flex;justify-content:space-between">
                        <b>${esc(d.label)}</b>
                        <b class="${d.type === 'a_payer' ? 'due' : 'ok'}">${fmt(d.amount_cdf)}</b>
                    </div>
                    <small>Échéance : ${dateFr(d.due_date)} ${isLate ? '⚠ En retard' : ''}</small>
                    ${d.contact_name ? `<small>Contact : ${esc(d.contact_name)}</small>` : ''}
                    <div class="row" style="margin-top:8px">
                        <button class="ghost" style="flex:1;padding:6px;font-size:12px" data-act=payDebt data-id=${d.id}>Marquer comme payé/reçu</button>
                        ${wl ? `<a class="btn ghost" style="flex:1;padding:6px;font-size:12px;text-decoration:none" href="${esc(wl)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
                    </div>
                </div>
            `;
        };

        let h = `<h3 style="margin-top:0">On nous doit (créances)</h3>`;
        h += aRecevoir.length ? aRecevoir.map(card).join('') : '<small>Aucune créance.</small>';
        h += `<button class="ghost" style="margin:8px 0 20px" data-act=addDebt data-type=a_recevoir>+ Ajouter une créance</button>`;
        h += `<h3>On doit (dettes)</h3>`;
        h += aPayer.length ? aPayer.map(card).join('') : '<small>Aucune dette.</small>';
        h += `<button class="ghost" style="margin-top:8px" data-act=addDebt data-type=a_payer>+ Ajouter une dette</button>`;
        $('#fin-content').innerHTML = h;
    }

    window.addDette = function (type) {
        ask(type === 'a_payer' ? 'Nouvelle dette' : 'Nouvelle créance', [
            { n: 'label', l: 'Objet (ex : Facture électricité)' },
            { n: 'amount', l: 'Montant', t: 'number' },
            { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur },
            { n: 'due_date', l: 'Date d’échéance', t: 'date', v: tdy() },
            { n: 'contact_name', l: 'Nom du contact (facultatif)', r: false },
            { n: 'contact_phone', l: 'Téléphone WhatsApp (facultatif)', t: 'tel', r: false }
        ], async v => {
            if (!(+v.amount > 0)) throw Error('Montant invalide');
            const rate = S.school.rates[v.cur] || 1;
            const { error } = await db.from('debts').insert({
                school_id: S.school.id,
                type,
                label: v.label.trim(),
                amount: +v.amount,
                currency: v.cur,
                amount_cdf: +v.amount * rate,
                due_date: v.due_date,
                contact_name: v.contact_name.trim() || null,
                contact_phone: v.contact_phone.trim() || null
            });
            if (error) throw error;
            toast('Enregistré'); reload();
        });
    };

    window.payDette = async function (id) {
        if (!confirm('Marquer comme réglé ?')) return;
        const { error } = await db.from('debts').update({ status: 'paye' }).eq('id', id);
        if (error) return toast(error.message);
        toast('Réglé ✓'); reload();
    };

    /* =====================================================================
       4. REVENUS : paiements des frais (automatiques) + revenus divers
       ===================================================================== */
    const RTYPES = ['mois', 'trimestre', 'annee'];
    async function loadRevenus() {
        const p = getP('rev', 'trimestre', RTYPES), R = pRange(p);
        const M = await loadMoney(R);
        if (!still('revenus')) return;
        if (M.error) return finErr(M.error);
        const scol = sumIn(M.pay, R), frais = sumIn(M.fee, R), div = M.rev.slice().sort((a, b) => b.d.localeCompare(a.d));
        const totDiv = div.reduce((t, x) => t + x.a, 0);
        S._rev = div;

        let h = periodBar('rev', RTYPES);
        h += `<div class="card hero col" style="margin-bottom:12px"><small>Total des revenus</small><span class="big">${fmt(scol + frais + totDiv)}</span></div>
            <div class="stat-pair">
                <div class="card stat"><span>Scolarité (auto)</span><b class=ok>${fmt(scol)}</b></div>
                <div class="card stat"><span>Autres frais (auto)</span><b class=ok>${fmt(frais)}</b></div>
            </div>
            <div class="card col"><small>Tout paiement de frais (scolarité et autres frais) est compté automatiquement comme revenu. Ajoutez ici uniquement les <b>autres revenus</b> : dons, location, vente…</small></div>
            <p class=fin-sec>Revenus divers · ${fmt(totDiv)}</p>`;
        h += div.length ? div.map(r => `
            <div class="card" style="margin-bottom:6px" data-act=editRev data-id=${r.id}>
                <span>${esc(r.label)}<br><small>${dateFr(r.d)} · ${esc(lbl(REV_MAN, r.cat))}</small></span>
                <b class="ok">${fmt(r.a)}</b>
            </div>`).join('') : '<p class=empty>Aucun revenu divers sur cette période.</p>';
        h += `<button style="margin-top:12px" data-act=addRev>+ Ajouter un revenu</button>`;
        $('#fin-content').innerHTML = h;
    }

    window.addRevenu = function () {
        ask('Nouveau revenu', [
            { n: 'label', l: 'Libellé (ex : Don, Location de salle)' },
            { n: 'amount', l: 'Montant', t: 'number' },
            { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur },
            { n: 'date', l: 'Date', t: 'date', v: tdy() },
            { n: 'cat', l: 'Catégorie', o: REV_MAN.map(x => [x[0], x[1]]), v: 'dons' }
        ], async v => {
            if (!(+v.amount > 0)) throw Error('Montant invalide');
            const rate = S.school.rates[v.cur] || 1;
            const { error } = await db.from('revenues').insert({
                school_id: S.school.id,
                label: v.label.trim(),
                amount: +v.amount,
                currency: v.cur,
                amount_cdf: +v.amount * rate,
                rate: rate,
                date: v.date,
                category: v.cat
            });
            if (error) throw error;
            toast('Revenu ajouté'); reload();
        });
    };

    function editRevenu(id) {
        const r = (S._rev || []).find(x => x.id === id); if (!r) return;
        const d = show(`<h3>${esc(r.label)}</h3><p>${nf(r.amount, 2)} ${esc(r.currency)} · ${esc(lbl(REV_MAN, r.cat))} · ${dateFr(r.d)}</p><div class=col><button id=rv1>Modifier</button><button class=ghost id=rv2>Supprimer</button><button class=ghost id=rv3>Fermer</button></div>`);
        d.querySelector('#rv3').onclick = () => d.close();
        d.querySelector('#rv1').onclick = () => ask('Modifier le revenu', [{ n: 'label', l: 'Libellé', v: r.label }, { n: 'amount', l: 'Montant (' + esc(r.currency) + ')', t: 'number', v: r.amount }], async v => {
            if (!(+v.amount > 0)) throw Error('Montant invalide');
            const rate = Number(r.rate) || S.school.rates[r.currency] || 1;
            const { error } = await db.from('revenues').update({ label: v.label.trim(), amount: +v.amount, amount_cdf: +v.amount * rate }).eq('id', id);
            if (error) throw error;
            toast('Revenu modifié'); reload();
        });
        d.querySelector('#rv2').onclick = async () => {
            if (!confirm('Supprimer ce revenu ?')) return;
            const { error } = await db.from('revenues').delete().eq('id', id);
            if (error) return toast(error.message);
            d.close(); toast('Revenu supprimé'); reload();
        };
    }

    /* =====================================================================
       5. BILAN (trimestriel par défaut) — remplace vBilan / bilanPDF de app.js
       ===================================================================== */
    window.vBilan = async function () {
        const emb = S.tab === 'finance_home' && $('#fin-content');
        const host = () => (S.tab === 'finance_home' ? $('#fin-content') : $('#main'));
        const back = emb ? '' : `<div class=bar><button class=ghost onclick="finBack()">← ${isDir() ? 'Finance' : 'Menu'}</button></div>`;
        const ok = () => S.tab === 'bilan' || (S.tab === 'finance_home' && S.finTab === 'bilan' && $('#fin-content'));
        if (!emb) $('#main').onclick = onAct;
        host().innerHTML = back + '<div class=sk></div><div class=sk></div>';
        const p = getP('bil', 'trimestre', RTYPES), R = pRange(p);
        const M = await loadMoney(R);
        if (!ok()) return;
        if (M.error) { host().innerHTML = back + `<p class=empty>${esc(M.error.message || 'Erreur')}</p><div class=row><button data-act=retry>Réessayer</button></div>`; return; }

        const enc = M.pay.concat(M.fee), totEnc = enc.reduce((t, x) => t + x.a, 0);
        const esp = enc.filter(x => x.m === 'especes').reduce((t, x) => t + x.a, 0), mm = totEnc - esp;
        const rev = M.rev.reduce((t, x) => t + x.a, 0), totRec = totEnc + rev;
        const byCat = {};
        M.exp.forEach(x => { const o = byCat[x.cat] || (byCat[x.cat] = { a: 0, n: 0 }); o.a += x.a; o.n++; });
        const totDep = M.exp.reduce((t, x) => t + x.a, 0), solde = totRec - totDep;
        const cats = Object.entries(byCat).sort((a, b) => b[1].a - a[1].a);
        S._bilan = { label: pLabel(p), key: p.type + '-' + p.key + (p.type === 'trimestre' ? '-' + p.year : ''), esp, mm, rev, totEnc, totRec, cats, exp: M.exp, totDep, solde, type: p.type };

        let h = back + `<h3>Bilan</h3>` + periodBar('bil', RTYPES);
        h += `<div class="card col"><b>Recettes</b>
                <span class=fin-head><small>Espèces</small><small>${fmt(esp)}</small></span>
                <span class=fin-head><small>Mobile Money / autres</small><small>${fmt(mm)}</small></span>
                <span class=fin-head><small>Revenus divers</small><small>${fmt(rev)}</small></span>
                <b class=ok style="margin-top:6px">Total : ${fmt(totRec)}</b></div>`;
        h += `<div class="card col"><b>Dépenses</b>`;
        if (p.type === 'mois') h += M.exp.length ? M.exp.slice().sort((a, b) => a.d.localeCompare(b.d)).map(x => `<span class=fin-head><small>${esc(x.label)}</small><small>${fmt(x.a)}</small></span>`).join('') : '<small>Aucune dépense</small>';
        else h += cats.length ? cats.map(([c, o]) => `<span class=fin-head><small>${esc(lbl(DEP, c))} (${o.n})</small><small>${fmt(o.a)}</small></span>`).join('') : '<small>Aucune dépense</small>';
        h += `<b class=due style="margin-top:6px">Total : ${fmt(totDep)}</b></div>`;
        h += `<div class="card hero col"><small>SOLDE · ${esc(pLabel(p).toUpperCase())}</small><span class="big ${solde < 0 ? 'neg' : ''}">${fmt(solde)}</span></div>`;
        h += `<div class=row><button class=ghost data-act=bilPdf>📄 PDF</button><button class=ghost data-act=bilPng>🖼 PNG</button></div>`;
        host().innerHTML = h;
    };

    function bilanRep() {
        const b = S._bilan;
        if (!b) return null;
        const rows = [['Encaissements espèces', '', b.esp], ['Encaissements Mobile Money / autres', '', b.mm], ['Revenus divers', '', b.rev], ['TOTAL RECETTES', '', b.totRec]];
        if (b.type === 'mois') b.exp.forEach(x => rows.push([x.label, lbl(DEP, x.cat), x.a]));
        else b.cats.forEach(([c, o]) => rows.push([lbl(DEP, c) + ' (' + o.n + ' dépense' + (o.n > 1 ? 's' : '') + ')', c, o.a]));
        rows.push(['TOTAL DÉPENSÉ', '', b.totDep]);
        rows.push(['SOLDE', '', b.solde]);
        return { name: 'bilan-' + b.key, title: 'Bilan — ' + S.school.name, sub: b.label + ' · Montants en FC', head: ['Élément', 'Catégorie', 'Montant (FC)'], rows, w: [50, 30, 20], r: [2], tot: null };
    }
    window.bilanPDF = function () {
        const r = bilanRep();
        if (!r) return toast('Ouvrez d’abord le bilan.');
        try { dl(new Blob([mkPdf(r)], { type: 'application/pdf' }), fnm(r.name, 'pdf')); toast('PDF enregistré'); } catch (e) { toast(e.message); }
    };

    /* =====================================================================
       6. DÉPENSES : justification obligatoire en cas de dépassement du budget
       ===================================================================== */
    async function overrunCheck(cat, date, amt) {
        const p = { type: 'mois', key: date.slice(0, 7), year: yearOf(date) }, R = pRange(p), sid = S.school.id;
        const { data, error } = await db.from('budgets').select('*').eq('school_id', sid).eq('year', p.year).eq('kind', 'depense').eq('category', cat);
        if (error || !(data || []).length) return null; // pas de budget (ou accès refusé) : pas de contrôle
        const e = eff(data, 'depense', cat, p, R);
        if (!(e.v > 0)) return null;
        const sp = await pageAll(() => db.from('expenses').select('id,amount_cdf').eq('school_id', sid).eq('category', cat).gte('date', R[0]).lt('date', R[1]));
        if (sp.error) return null;
        const spent = sp.data.reduce((t, x) => t + Number(x.amount_cdf || 0), 0);
        return spent + amt > e.v ? { plan: e.v, spent, label: pLabel(p) } : null;
    }
    window.addExpense = function () {
        ask('Nouvelle dépense', [{ n: 'label', l: 'Libellé' }, { n: 'amount', l: 'Montant', t: 'number' }, { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur }, { n: 'cat', l: 'Catégorie', o: DEP.map(x => [x[0], x[1]]) }, { n: 'date', l: 'Date', t: 'date', v: tdy() }], async v => {
            const rate = rateOf(v.cur), amount_cdf = +v.amount * rate;
            if (!(amount_cdf > 0)) throw Error('Montant invalide');
            let note = null;
            const o = await overrunCheck(v.cat, v.date, amount_cdf).catch(() => null);
            if (o) {
                const why = prompt(`Dépassement du budget « ${lbl(DEP, v.cat)} » (${o.label})\nPrévu : ${fmt(o.plan)}\nDéjà dépensé : ${fmt(o.spent)}\nAvec cette dépense : ${fmt(o.spent + amount_cdf)}\n\nJustification obligatoire :`);
                if (!why || !why.trim()) throw Error('Dépense non enregistrée : une justification est obligatoire en cas de dépassement.');
                note = why.trim().slice(0, 300);
            }
            const row = { school_id: S.school.id, label: v.label.trim(), amount: +v.amount, currency: v.cur, amount_cdf, rate, category: v.cat, date: v.date };
            if (note) row.overrun_note = note;
            const { error } = await db.from('expenses').insert(row);
            if (error) throw error;
            await vDepenses(); toast(note ? 'Dépense ajoutée (dépassement justifié)' : 'Dépense ajoutée');
        });
    };

    /* =====================================================================
       7. FRAIS DE CLASSE (remplace editFees de app.js) + annonce automatique
       ===================================================================== */
    window.editFees = function (id) {
        const c = S.classes.find(x => x.id === id);
        ask('Frais — ' + esc(c.name), [{ n: 't1', l: '1er trimestre', t: 'number', v: c.fee_t1 }, { n: 't2', l: '2e trimestre', t: 'number', v: c.fee_t2 }, { n: 't3', l: '3e trimestre', t: 'number', v: c.fee_t3 }, { n: 'cur', l: 'Devise', o: CUR.map(x => [x, x]), v: c.fee_currency }], async v => {
            const { data, error } = await db.from('classes').update({ fee_t1: +v.t1, fee_t2: +v.t2, fee_t3: +v.t3, fee_currency: v.cur }).eq('id', id).select();
            if (error) throw error;
            if (!data.length) throw Error('Modification refusée');

            await load(); render();
            toast('Frais enregistrés');

            // Publier automatiquement une annonce
            const changes = [];
            if (+v.t1 !== Number(c.fee_t1)) changes.push('T1: ' + nf(v.t1) + ' ' + v.cur);
            if (+v.t2 !== Number(c.fee_t2)) changes.push('T2: ' + nf(v.t2) + ' ' + v.cur);
            if (+v.t3 !== Number(c.fee_t3)) changes.push('T3: ' + nf(v.t3) + ' ' + v.cur);

            if (changes.length > 0 && typeof window.publishAnnonceWithNotif === 'function') {
                await window.publishAnnonceWithNotif(
                    `📢 Modification des frais : ${c.name}`,
                    `Les frais de la classe ${c.name} ont été mis à jour : ${changes.join(', ')}.`,
                    S.school.id
                );
            }
        });
    };

    // Exposés pour les onclick existants et les prochains lots
    window.renderFin = renderFin;
    window.FinP = { yearRange, termRange, termOf, yearOf, pRange, pLabel, pMake, pShift, loadMoney, balance, sumIn, eff, autoRec, DEP, REC };
})();
