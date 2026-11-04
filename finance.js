/* =====================================================================
   ORÉA École v64 — finance.js
   Module complet de gestion financière pour le Directeur.
   - Tableau de bord (Encaissements vs Dépenses)
   - Budget prévisionnel (Programmé vs Réel)
   - Suivi des dettes (On doit / On nous doit)
   - Revenus divers
   - Publication automatique d'annonce lors de modification de frais
   ===================================================================== */
(function () {
    'use strict';

    const $ = s => document.querySelector(s);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nf = (n, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
    const fmt = n => nf(n / (S.school.rates[S.cur] || 1), S.cur === 'CDF' ? 0 : 2) + ' ' + SYM[S.cur];
    const tdy = () => new Date().toLocaleDateString('sv-SE');
    const thisMonth = () => tdy().slice(0, 7); // YYYY-MM

    // Hook pour s'accrocher au rendu de app.js sans le modifier
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__fin) return;
        const w = fn(o); w.__fin = true; window[name] = w;
    };

    // Remplace le placeholder laissé par Claude
    window.vFinanceHome = function () {
        if (S.me.role !== 'directeur') return toast('Accès réservé au directeur.');
        if (S.finTab === undefined) S.finTab = 'dash';
        S.tab = 'finance_home';
        renderFin();
    };

    function renderFin() {
        let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Finance</h3>`;
        
        // Onglets internes
        const tabs = [
            ['dash', 'Tableau de bord'],
            ['budget', 'Budget'],
            ['dettes', 'Dettes'],
            ['revenus', 'Revenus'],
            ['impayes', 'Impayés'],
            ['depenses', 'Dépenses']
        ];
        h += `<div class="chips" style="margin-bottom:15px">${tabs.map(t => `<button class="chip ${S.finTab === t[0] ? 'on' : ''}" onclick="S.finTab='${t[0]}';renderFin()">${t[1]}</button>`).join('')}</div>`;
        
        $('#main').innerHTML = h + `<div id="fin-content"><div class=sk></div><div class=sk></div></div>`;

        // Charge la vue correspondante
        if (S.finTab === 'dash') loadDash();
        else if (S.finTab === 'budget') loadBudget();
        else if (S.finTab === 'dettes') loadDettes();
        else if (S.finTab === 'revenus') loadRevenus();
        else if (S.finTab === 'impayes') { if (typeof vImpayes === 'function') vImpayes(); else $('#fin-content').innerHTML = '<p class=empty>Erreur de chargement.</p>'; }
        else if (S.finTab === 'depenses') { if (typeof vDepenses === 'function') vDepenses(); else $('#fin-content').innerHTML = '<p class=empty>Erreur de chargement.</p>'; }
    }

    // ==========================================
    // 1. TABLEAU DE BORD (DASHBOARD)
    // ==========================================
    async function loadDash() {
        const m = thisMonth();
        const [enc, dep, rev, det] = await Promise.all([
            db.from('payments').select('amount_cdf').gte('created_at', m + '-01'),
            db.from('expenses').select('amount_cdf').gte('date', m + '-01'),
            db.from('revenues').select('amount_cdf').gte('date', m + '-01'),
            db.from('debts').select('amount_cdf,type').eq('status', 'en_attente')
        ]);

        const totEnc = (enc.data || []).reduce((a, b) => a + Number(b.amount_cdf), 0);
        const totDep = (dep.data || []).reduce((a, b) => a + Number(b.amount_cdf), 0);
        const totRev = (rev.data || []).reduce((a, b) => a + Number(b.amount_cdf), 0);
        const solde = totEnc + totRev - totDep;

        const detAPayer = (det.data || []).filter(d => d.type === 'a_payer').reduce((a, b) => a + Number(b.amount_cdf), 0);
        const detARecevoir = (det.data || []).filter(d => d.type === 'a_recevoir').reduce((a, b) => a + Number(b.amount_cdf), 0);

        const h = `
            <div class="card hero" style="margin-bottom:15px">
                <small>Solde du mois (${m})</small>
                <span class="big" style="color:${solde >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmt(solde)}</span>
            </div>
            <div class="stat-pair">
                <div class="card stat"><span>Encaissements</span><b class=ok>${fmt(totEnc)}</b></div>
                <div class="card stat"><span>Dépenses</span><b class=due>${fmt(totDep)}</b></div>
            </div>
            <div class="stat-pair">
                <div class="card stat"><span>Revenus divers</span><b>${fmt(totRev)}</b></div>
                <div class="card stat"><span>Dettes (Net)</span><b class="${(detARecevoir - detAPayer) >= 0 ? 'ok' : 'due'}">${fmt(detARecevoir - detAPayer)}</b></div>
            </div>
            <h3>Actions rapides</h3>
            <div class="row">
                <button class="ghost" onclick="addRevenu()">+ Revenu</button>
                <button class="ghost" onclick="addDette('a_payer')">+ Dette (On doit)</button>
            </div>
            <div class="row">
                <button class="ghost" onclick="addDette('a_recevoir')">+ Créance (On nous doit)</button>
                <button class="ghost" onclick="S.finTab='budget';renderFin()">Gérer le budget</button>
            </div>
        `;
        $('#fin-content').innerHTML = h;
    }

    // ==========================================
    // 2. BUDGET PRÉVISIONNEL
    // ==========================================
    async function loadBudget() {
        const m = thisMonth();
        const [bud, dep] = await Promise.all([
            db.from('budgets').select('*').eq('month', m),
            db.from('expenses').select('category,amount_cdf').gte('date', m + '-01')
        ]);

        const budgets = bud.data || [];
        const depenses = dep.data || [];

        const cats = ['salaires', 'loyer', 'electricite', 'fournitures', 'transport', 'entretien', 'examens', 'communication', 'autre'];
        
        let h = `<div class="card col" style="margin-bottom:15px"><b>Budget de ${m}</b><small>Comparez ce que vous avez prévu avec ce que vous avez réellement dépensé.</small></div>`;

        cats.forEach(c => {
            const b = budgets.find(x => x.category === c);
            const prevu = b ? Number(b.planned_amount) : 0;
            const reel = depenses.filter(x => x.category === c).reduce((a, x) => a + Number(x.amount_cdf), 0);
            
            if (prevu === 0 && reel === 0) return; // On n'affiche pas les catégories vides

            const pct = prevu > 0 ? Math.min(100, Math.round((reel / prevu) * 100)) : (reel > 0 ? 100 : 0);
            const isOver = reel > prevu && prevu > 0;
            const color = isOver ? 'var(--bad)' : (pct > 80 ? 'var(--gold)' : 'var(--ok)');

            h += `
                <div class="card col" style="margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <b style="text-transform:capitalize">${c}</b>
                        <span style="font-size:12px">${fmt(reel)} / ${fmt(prevu)}</span>
                    </div>
                    <div class="pbar" style="margin:6px 0"><i style="width:${pct}%;background:${color}"></i></div>
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <small>${pct}% utilisé</small>
                        <button class="ghost" style="width:auto;padding:2px 8px;min-height:0;font-size:11px" onclick="editBudget('${c}', ${prevu})">Modifier</button>
                    </div>
                </div>
            `;
        });

        h += `<button class="ghost" style="margin-top:15px" onclick="editBudget('nouvelle', 0)">+ Ajouter une ligne de budget</button>`;
        $('#fin-content').innerHTML = h;
    }

    window.editBudget = function (cat, current) {
        const cats = ['salaires', 'loyer', 'electricite', 'fournitures', 'transport', 'entretien', 'examens', 'communication', 'autre'];
        const options = cats.map(c => [c, c.charAt(0).toUpperCase() + c.slice(1)]);
        
        ask('Budget prévisionnel', [
            { n: 'cat', l: 'Catégorie', o: options, v: cat !== 'nouvelle' ? cat : 'salaires' },
            { n: 'amount', l: 'Montant prévu (' + S.cur + ')', t: 'number', v: current || '' }
        ], async v => {
            const m = thisMonth();
            // Upsert (met à jour si existe, crée sinon)
            const { error } = await db.from('budgets').upsert({
                school_id: S.school.id,
                year: S.year,
                month: m,
                category: v.cat,
                planned_amount: +v.amount,
                currency: S.cur
            }, { onConflict: 'school_id,year,month,category' });
            
            if (error) throw error;
            toast('Budget mis à jour');
            loadBudget();
        });
    };

    // ==========================================
    // 3. DETTES (On doit / On nous doit)
    // ==========================================
    async function loadDettes() {
        const { data } = await db.from('debts').select('*').eq('status', 'en_attente').order('due_date');
        const dettes = data || [];
        const aPayer = dettes.filter(d => d.type === 'a_payer');
        const aRecevoir = dettes.filter(d => d.type === 'a_recevoir');

        const card = d => {
            const isLate = d.due_date < tdy();
            return `
                <div class="card col" style="margin-bottom:8px;border-left:3px solid ${isLate ? 'var(--bad)' : 'var(--line)'}">
                    <div style="display:flex;justify-content:space-between">
                        <b>${esc(d.label)}</b>
                        <b class="${d.type === 'a_payer' ? 'due' : 'ok'}">${fmt(d.amount_cdf)}</b>
                    </div>
                    <small>Échéance : ${new Date(d.due_date).toLocaleDateString('fr-FR')} ${isLate ? '⚠ En retard' : ''}</small>
                    ${d.contact_name ? `<small>Contact : ${esc(d.contact_name)}</small>` : ''}
                    <div class="row" style="margin-top:8px">
                        <button class="ghost" style="flex:1;padding:6px;font-size:12px" onclick="payDette('${d.id}')">Marquer comme payé/reçu</button>
                        ${d.contact_phone ? `<a class="btn ghost" style="flex:1;padding:6px;font-size:12px;text-decoration:none" href="https://wa.me/${d.contact_phone.replace(/[^0-9]/g, '')}?text=Bonjour, concernant ${encodeURIComponent(d.label)}..." target="_blank">WhatsApp</a>` : ''}
                    </div>
                </div>
            `;
        };

        let h = `<h3 style="margin-top:0">On nous doit (Créances)</h3>`;
        h += aRecevoir.length ? aRecevoir.map(card).join('') : '<small>Aucune créance.</small>';
        h += `<button class="ghost" style="margin:8px 0 20px" onclick="addDette('a_recevoir')">+ Ajouter une créance</button>`;

        h += `<h3>On doit (Dettes)</h3>`;
        h += aPayer.length ? aPayer.map(card).join('') : '<small>Aucune dette.</small>';
        h += `<button class="ghost" style="margin-top:8px" onclick="addDette('a_payer')">+ Ajouter une dette</button>`;

        $('#fin-content').innerHTML = h;
    }

    window.addDette = function (type) {
        ask(type === 'a_payer' ? 'Nouvelle dette' : 'Nouvelle créance', [
            { n: 'label', l: 'Objet (ex: Facture électricité)' },
            { n: 'amount', l: 'Montant', t: 'number' },
            { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur },
            { n: 'due_date', l: 'Date d\'échéance', t: 'date', v: tdy() },
            { n: 'contact_name', l: 'Nom du contact (facultatif)', r: false },
            { n: 'contact_phone', l: 'Téléphone WhatsApp (facultatif)', t: 'tel', r: false }
        ], async v => {
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
            toast('Enregistré'); loadDettes();
        });
    };

    window.payDette = async function (id) {
        if (!confirm('Marquer comme réglé ?')) return;
        const { error } = await db.from('debts').update({ status: 'paye' }).eq('id', id);
        if (error) return toast(error.message);
        toast('Réglé ✓'); loadDettes();
    };

    // ==========================================
    // 4. REVENUS DIVERS
    // ==========================================
    async function loadRevenus() {
        const { data } = await db.from('revenues').select('*').order('date', { ascending: false }).limit(30);
        const l = data || [];

        let h = `<div class="card col" style="margin-bottom:15px"><b>Derniers revenus</b><small>Dons, subventions, locations...</small></div>`;
        h += l.length ? l.map(r => `
            <div class="card" style="margin-bottom:6px">
                <span>${esc(r.label)}<br><small>${new Date(r.date).toLocaleDateString('fr-FR')}</small></span>
                <b class="ok">${fmt(r.amount_cdf)}</b>
            </div>
        `).join('') : '<p class=empty>Aucun revenu enregistré.</p>';
        
        h += `<button style="margin-top:15px" onclick="addRevenu()">+ Ajouter un revenu</button>`;
        $('#fin-content').innerHTML = h;
    }

    window.addRevenu = function () {
        ask('Nouveau revenu', [
            { n: 'label', l: 'Libellé (ex: Don, Location salle)' },
            { n: 'amount', l: 'Montant', t: 'number' },
            { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: S.cur },
            { n: 'date', l: 'Date', t: 'date', v: tdy() },
            { n: 'cat', l: 'Catégorie', o: [['dons', 'Dons'], ['subventions', 'Subventions'], ['locations', 'Locations'], ['autres', 'Autres']], v: 'dons' }
        ], async v => {
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
            toast('Revenu ajouté'); loadRevenus();
        });
    };

    // ==========================================
    // 5. AUTRES FONCTIONS (Reprise de app.js avec modif)
    // ==========================================
    
    // Remplace la fonction editFees de app.js pour ajouter la publication auto
    window.editFees = function (id) {
        const c = S.classes.find(x => x.id === id);
        ask('Frais — ' + esc(c.name), [{ n: 't1', l: '1er trimestre', t: 'number', v: c.fee_t1 }, { n: 't2', l: '2e trimestre', t: 'number', v: c.fee_t2 }, { n: 't3', l: '3e trimestre', t: 'number', v: c.fee_t3 }, { n: 'cur', l: 'Devise', o: CUR.map(x => [x, x]), v: c.fee_currency }], async v => {
            const { data, error } = await db.from('classes').update({ fee_t1: +v.t1, fee_t2: +v.t2, fee_t3: +v.t3, fee_currency: v.cur }).eq('id', id).select();
            if (error) throw error; 
            if (!data.length) throw Error('Modification refusée'); 
            
            await load(); render(); 
            toast('Frais enregistrés');
            
            // NOUVEAU : Publier automatiquement une annonce
            const changes = [];
            if (+v.t1 !== c.fee_t1) changes.push('T1: ' + nf(v.t1) + ' ' + v.cur);
            if (+v.t2 !== c.fee_t2) changes.push('T2: ' + nf(v.t2) + ' ' + v.cur);
            if (+v.t3 !== c.fee_t3) changes.push('T3: ' + nf(v.t3) + ' ' + v.cur);
            
            if (changes.length > 0 && typeof window.publishAnnonceWithNotif === 'function') {
                await window.publishAnnonceWithNotif(
                    `📢 Modification des frais : ${c.name}`,
                    `Les frais de la classe ${c.name} ont été mis à jour : ${changes.join(', ')}.`,
                    S.school.id
                );
            }
        });
    };

    // Initialisation : on expose renderFin pour les onclick
    window.renderFin = renderFin;

})();
