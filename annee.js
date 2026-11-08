/* =====================================================================
   ORÉA École v93 — annee.js
   1) Fin d'année (remplace l'ancien « Passage de classe ») : décision par élève
      (Admis · Redouble · Change d'option · Quitte · Exclu) et classe de
      destination au choix. L'élève GARDE son dossier : mêmes parents, même
      code d'accès, historique relié (person_id).
   2) À tout moment de l'année : changer de classe (1ère A → 1ère B), d'option,
      faire redoubler (décision des parents), départ / exclusion / retour.
      Les cotes déjà données suivent l'élève dans sa nouvelle classe.
   3) Réglages (chef d'établissement) : « Mon abonnement », statut de l'école
      (privée / publique / conventionnée → gratuité du primaire public),
      liste des options du secondaire, élèves partis ou exclus.
   À charger APRÈS app.js.
   ===================================================================== */
(function () {
    'use strict';
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fd = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
    const pedago = () => S.me && S.me.role === 'directeur' && !S.me.secretariat;
    const STATUTS = [['privee', 'Privée'], ['publique', 'Publique non conventionnée'], ['conventionnee', 'Publique conventionnée (confessionnelle)']];

    /* ---------- Élèves partis / exclus : retirés des listes, gardés dans les archives ---------- */
    S.gone = [];
    const oLoad = window.load;
    if (typeof oLoad === 'function') window.load = async function () {
        const r = await oLoad.apply(this, arguments);
        try {
            const { data } = await db.from('students').select('id,name,class_id,statut,left_at').eq('school_id', S.school.id).neq('statut', 'actif');
            S.gone = data || [];
            if (S.gone.length) { const g = new Set(S.gone.map(x => x.id)); S.stu = S.stu.filter(s => !g.has(s.id)); }
        } catch (_) { }
        return r;
    };

    /* ================= 1) FIN D'ANNÉE ================= */
    const DEC = [['admis', 'Admis'], ['redouble', 'Redouble'], ['option', 'Change d’option'], ['parti', 'Quitte l’école'], ['exclu', 'Exclu']];
    // Classe supérieure proposée : même lettre, même option, chiffre + 1 (1ère A → 2e A)
    const num = n => { const m = String(n).match(/(\d+)/); return m ? +m[1] : null; };
    function guessUp(c, tc) {
        const n = num(c.name); if (n == null) return '';
        const want = String(c.name).replace(/\d+\s*(ère|re|er|e|ème|eme)?/i, '').trim().toLowerCase();
        const cand = tc.filter(t => num(t.name) === n + 1 && (t.option || '') === (c.option || ''));
        const best = cand.find(t => String(t.name).replace(/\d+\s*(ère|re|er|e|ème|eme)?/i, '').trim().toLowerCase() === want) || cand[0];
        return best ? best.id : '';
    }
    const guessSame = (c, tc) => { const t = tc.find(x => x.name.toLowerCase() === c.name.toLowerCase() && (x.option || '') === (c.option || '')); return t ? t.id : ''; };

    window.promote = async function () {
        const oth = yrs().filter(y => y !== S.year);
        if (!oth.length) return toast('Créez d’abord l’année suivante (+ Nouvelle année).');
        const src = yc(); if (!src.length) return toast('Aucune classe dans cette année.');
        const { data: st0 } = await db.from('students').select('id,successor_id,statut').in('class_id', src.map(c => c.id));
        const done = new Set((st0 || []).filter(x => x.successor_id || x.statut !== 'actif').map(x => x.id));
        let tg = oth.find(y => y > S.year) || oth[0];
        const d = show(`<h3>Fin d’année</h3><small>De ${E(S.year)} vers <select id=fy-y style="width:auto;display:inline-block">${oth.map(y => `<option ${y === tg ? 'selected' : ''}>${E(y)}</option>`).join('')}</select></small>
<p><small>Par défaut, tout le monde est <b>admis</b> dans la classe supérieure. Changez seulement les exceptions : redoublement, changement d’option ou de classe, départ. Chaque élève garde son dossier, ses parents et son code.</small></p>
<div id=fy-l></div>${fin() ? '<label style="display:flex;gap:8px;align-items:center;text-transform:none"><input type=checkbox id=fy-arr checked style="width:auto;margin:0"> Reporter les impayés en « Arriérés »</label>' : ''}
<div class=row><button type=button class=ghost id=fy-x>Annuler</button><button type=button id=fy-ok>Valider la fin d’année</button></div>`);
        const draw = () => {
            const tc = S.classes.filter(c => cy(c) === tg);
            const opt = (sel) => `<option value="">— choisir —</option>` + tc.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${E(cnm(t.id))}</option>`).join('');
            d.querySelector('#fy-l').innerHTML = src.map(c => {
                const L = S.stu.filter(s => s.class_id === c.id && !done.has(s.id)), up = guessUp(c, tc), same = guessSame(c, tc);
                return `<details class=card style="display:block" ${L.length ? '' : 'hidden'}><summary><b>${E(cnm(c.id))}</b> · ${L.length} élève(s) → <select data-cd="${c.id}" style="width:auto;display:inline-block" onclick="event.stopPropagation()">${opt(up)}</select></summary>
${L.map(s => `<div class=row style="align-items:center;gap:6px;margin:6px 0;flex-wrap:wrap" data-st="${s.id}" data-cls="${c.id}" data-up="${up}" data-same="${same}"><span style="flex:1 1 40%">${E(s.name)}</span><select data-dec style="flex:1 1 25%">${DEC.map(x => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select><select data-to style="flex:1 1 30%">${opt(up)}</select></div>`).join('')}</details>`;
            }).join('') + (done.size ? `<small>${done.size} élève(s) déjà traité(s) sont masqués.</small>` : '');
            // Classe de destination de toute la classe → recopiée sur les élèves « Admis »
            d.querySelectorAll('[data-cd]').forEach(sel => sel.onchange = () => d.querySelectorAll(`[data-cls="${sel.dataset.cd}"]`).forEach(r => { r.dataset.up = sel.value; if (r.querySelector('[data-dec]').value === 'admis') r.querySelector('[data-to]').value = sel.value; }));
            d.querySelectorAll('[data-st]').forEach(r => {
                const dec = r.querySelector('[data-dec]'), to = r.querySelector('[data-to]');
                dec.onchange = () => { const v = dec.value; to.disabled = v === 'parti' || v === 'exclu'; if (v === 'admis') to.value = r.dataset.up; if (v === 'redouble') to.value = r.dataset.same; if (v === 'option') to.value = ''; };
            });
        };
        draw();
        d.querySelector('#fy-y').onchange = e => { tg = e.target.value; draw(); };
        d.querySelector('#fy-x').onclick = () => d.close();
        d.querySelector('#fy-ok').onclick = async e => {
            const items = [], leave = [], miss = [];
            const arr = fin() && d.querySelector('#fy-arr') && d.querySelector('#fy-arr').checked;
            d.querySelectorAll('[data-st]').forEach(r => {
                const dec = r.querySelector('[data-dec]').value, to = r.querySelector('[data-to]').value, s = S.stu.find(x => x.id === r.dataset.st);
                if (dec === 'parti' || dec === 'exclu') return leave.push({ id: s.id, st: dec });
                if (!to) return miss.push(s.name);
                items.push({ student_id: s.id, decision: dec, to_class: to, arrears_cdf: arr && s.balance_cdf > 0 ? Math.round(s.balance_cdf) : 0 });
            });
            if (miss.length) return toast('Choisissez la classe de : ' + miss.slice(0, 3).join(', ') + (miss.length > 3 ? '…' : ''));
            if (!items.length && !leave.length) return toast('Aucun élève à traiter.');
            if (!confirm(`${items.length} élève(s) inscrit(s) en ${tg}${leave.length ? ' · ' + leave.length + ' départ(s)' : ''}. Continuer ?`)) return;
            e.currentTarget.disabled = true;
            let n = 0;
            for (let i = 0; i < items.length; i += 150) {
                const { data, error } = await db.rpc('v93_year_close', { p_items: items.slice(i, i + 150) });
                if (error) { e.currentTarget.disabled = false; return toast(error.message); }
                n += data || 0;
            }
            for (const l of leave) await db.rpc('v93_set_student_statut', { p_student: l.id, p_statut: l.st, p_note: 'Fin d’année ' + S.year });
            d.close(); S.year = tg; localStorage['orea_year_' + S.school.id] = tg; S.cls = null; await load(); render();
            toast(n + ' élève(s) inscrit(s) en ' + tg + (leave.length ? ' · ' + leave.length + ' départ(s)' : ''));
        };
    };

    /* ================= 2) À TOUT MOMENT : changer de classe, départ ================= */
    const oMenu = window.menu;
    if (typeof oMenu === 'function') window.menu = function (id) {
        const r = oMenu.apply(this, arguments);
        setTimeout(() => {
            const dlg = document.getElementById('dlg'); if (!dlg || !dlg.open || dlg.querySelector('#mv-box')) return;
            const s = S.stu.find(x => x.id === id); if (!s || S.ro) return;
            const box = document.createElement('div'); box.id = 'mv-box'; box.className = 'row'; box.style.cssText = 'flex-wrap:wrap;margin-top:8px';
            box.innerHTML = (pedago() ? '<button type=button class=ghost data-mv style="flex:1">🔁 Changer de classe</button>' : '') + (S.me.role === 'directeur' ? '<button type=button class=ghost data-lv style="flex:1;color:var(--bad)">Départ / exclusion</button>' : '');
            if (!box.innerHTML) return;
            const anchor = dlg.querySelector('form[method=dialog]') || dlg.lastElementChild;
            anchor ? anchor.before(box) : dlg.appendChild(box);
            const mv = box.querySelector('[data-mv]'); if (mv) mv.onclick = () => moveStudent(s);
            const lv = box.querySelector('[data-lv]'); if (lv) lv.onclick = () => leaveStudent(s);
        }, 0);
        return r;
    };
    function moveStudent(s) {
        const cur = S.classes.find(c => c.id === s.class_id), yr = cur ? cy(cur) : S.year;
        const tc = S.classes.filter(c => cy(c) === yr && c.id !== s.class_id);
        if (!tc.length) return toast('Aucune autre classe cette année.');
        ask('Changer de classe · ' + E(s.name), [
            { n: 'to', l: 'Nouvelle classe (même année)', o: tc.map(c => [c.id, cnm(c.id)]), v: tc[0].id },
            { n: 'k', l: 'Raison', o: [['changement_classe', 'Changement de classe (ex. 1ère A → 1ère B)'], ['changement_option', 'Changement d’option'], ['redoublement', 'Redoublement (décision de l’école ou des parents)'], ['passage', 'Passage dans une classe supérieure']], v: 'changement_classe' },
            { n: 'note', l: 'Remarque (facultatif)', r: false }
        ], async v => {
            const { error } = await db.rpc('v93_move_student', { p_student: s.id, p_to_class: v.to, p_kind: v.k, p_note: v.note || null });
            if (error) throw error;
            await load(); render(); toast(s.name + ' est maintenant en ' + cnm(v.to) + ' · ses cotes l’ont suivi(e)');
        });
    }
    function leaveStudent(s) {
        ask('Départ · ' + E(s.name), [
            { n: 'st', l: 'Situation', o: [['parti', 'Quitte l’école'], ['exclu', 'Exclu']], v: 'parti' },
            { n: 'note', l: 'Motif (facultatif)', r: false }
        ], async v => {
            const { error } = await db.rpc('v93_set_student_statut', { p_student: s.id, p_statut: v.st, p_note: v.note || null });
            if (error) throw error;
            await load(); render(); toast(s.name + ' : retiré(e) des listes, gardé(e) dans les archives (Réglages → Anciens élèves).');
        });
    }

    /* ================= 3) RÉGLAGES ================= */
    const oReg = window.vReglages;
    if (typeof oReg === 'function') window.vReglages = function () {
        const r = oReg.apply(this, arguments);
        setTimeout(addCards, 0);
        return r;
    };
    async function addCards() {
        const m = document.getElementById('main'); if (!m || S.tab !== 'reglages' || m.querySelector('#yr-cards')) return;
        const wrap = document.createElement('div'); wrap.id = 'yr-cards';
        const first = m.querySelector('.card'); first ? m.insertBefore(wrap, first) : m.appendChild(wrap);
        if (fin()) {
            // --- Mon abonnement ---
            const ab = document.createElement('div'); ab.className = 'card col'; ab.innerHTML = '<b>Mon abonnement</b><div class=sk></div>'; wrap.appendChild(ab);
            db.rpc('v93_my_subscription').then(({ data, error }) => {
                if (error || !data) { ab.innerHTML = '<b>Mon abonnement</b><small>' + E(error ? error.message : 'Indisponible') + '</small>'; return; }
                const end = data.sub_until ? new Date(data.sub_until) : null, P = data.payments || [];
                const left = end ? Math.ceil((end - Date.now()) / 864e5) : 0;
                const start = P.length ? new Date(P[0].at) : new Date(data.created_at);
                const total = end ? Math.max(1, (end - start) / 864e5) : 1, pct = Math.max(0, Math.min(100, Math.round(left / total * 100)));
                const ph = { actif: ['ok', 'Actif'], grace: ['due', 'Expiré · période de grâce (7 jours)'], lecture: ['due', 'Lecture seule'], bloquee: ['due', 'Suspendu par ORÉA'] }[data.phase] || ['', data.phase];
                const wa = typeof subWa === 'function' ? subWa(left) : '';
                ab.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px"><b>Mon abonnement</b><b class="${ph[0]}">${ph[1]}</b></div>
<small>${P.length ? 'Dernier renouvellement' : 'Début (essai)'} : ${fd(start)} · Fin : <b>${fd(end)}</b></small>
<div style="height:8px;border-radius:6px;background:var(--line);overflow:hidden;margin:6px 0"><i style="display:block;height:100%;width:${pct}%;background:${left > 7 ? 'var(--ok)' : 'var(--bad)'}"></i></div>
<b class="${left > 7 ? 'ok' : 'due'}">${left > 0 ? left + ' jour' + (left > 1 ? 's' : '') + ' restant' + (left > 1 ? 's' : '') : 'Expiré depuis ' + Math.abs(left) + ' jour(s)'}</b>
${wa ? `<a class=btn href="${wa}" target=_blank rel=noopener style="text-align:center;text-decoration:none;margin-top:6px">Renouveler l’abonnement</a>` : ''}
${P.length ? `<details><summary>Historique (${P.length})</summary>${P.map(p => `<small style="display:block;padding:3px 0">${fd(p.at)} · ${p.months} mois${+p.amount ? ' · ' + nf(p.amount, 2) + ' ' + E(p.currency) : ''}</small>`).join('')}<small>Les montants payés apparaissent aussi dans vos Dépenses (« Abonnement ORÉA »).</small></details>` : ''}`;
            });
            // --- Statut de l'école ---
            const sc = document.createElement('div'); sc.className = 'card col';
            sc.innerHTML = `<b>Statut de l’école</b><small>Dans une école publique (conventionnée ou non), le primaire est gratuit : ORÉA ne demande pas de frais de scolarité pour ces classes.</small><select id=yr-st>${STATUTS.map(x => `<option value="${x[0]}" ${(S.school.statut || 'privee') === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select>`;
            wrap.appendChild(sc);
            sc.querySelector('#yr-st').onchange = async e => {
                const { error } = await db.from('schools').update({ statut: e.target.value }).eq('id', S.school.id);
                if (error) return toast(error.message);
                S.school.statut = e.target.value; toast('Statut enregistré ✓'); render();
            };
        }
        // --- Options du secondaire ---
        if (pedago() && ['secondaire', 'complexe'].includes(schoolKind())) {
            const op = document.createElement('div'); op.className = 'card col';
            const draw = () => {
                const L = classOptions();
                op.innerHTML = `<b>Options du secondaire</b><small>Proposées à la création d’une classe (ex. : 1ère Pédagogie générale).</small><div class=row style="flex-wrap:wrap;gap:6px">${L.map((o, i) => `<span class=chip style="display:inline-flex;gap:6px;align-items:center">${E(o)}${fin() ? ` <button type=button data-rm="${i}" aria-label="Retirer" style="width:auto;min-height:0;padding:0 6px;background:none;border:0;color:var(--bad);box-shadow:none">✕</button>` : ''}</span>`).join('')}</div>${fin() ? '<div class=row><input id=op-new placeholder="Nouvelle option" maxlength=60><button type=button id=op-add style="width:auto">Ajouter</button></div>' : ''}`;
                const save = async L2 => { const { error } = await db.from('schools').update({ class_options: L2 }).eq('id', S.school.id); if (error) return toast(error.message); S.school.class_options = L2; draw(); };
                op.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const L2 = classOptions().slice(); L2.splice(+b.dataset.rm, 1); save(L2); });
                const ad = op.querySelector('#op-add'); if (ad) ad.onclick = () => { const v = op.querySelector('#op-new').value.trim(); if (!v) return; if (classOptions().some(x => x.toLowerCase() === v.toLowerCase())) return toast('Cette option existe déjà.'); save(classOptions().concat([v])); };
            };
            draw(); wrap.appendChild(op);
        }
        // --- Anciens élèves ---
        if (S.me.role === 'directeur' && S.gone.length) {
            const g = document.createElement('div'); g.className = 'card col';
            g.innerHTML = `<b>Anciens élèves (${S.gone.length})</b><small>Partis ou exclus : retirés des listes, gardés dans les archives.</small><details><summary>Voir la liste</summary>${S.gone.map(x => `<div class=row style="align-items:center"><span style="flex:1">${E(x.name)}<br><small>${x.statut === 'exclu' ? 'Exclu' : 'Parti'} le ${fd(x.left_at)} · ${E(cnm(x.class_id))}</small></span>${S.ro ? '' : `<button type=button class=ghost style="width:auto" data-back="${x.id}">Réintégrer</button>`}</div>`).join('')}</details>`;
            wrap.appendChild(g);
            g.querySelectorAll('[data-back]').forEach(b => b.onclick = async () => {
                const { error } = await db.rpc('v93_set_student_statut', { p_student: b.dataset.back, p_statut: 'actif', p_note: 'Réintégration' });
                if (error) return toast(error.message); await load(); render(); toast('Élève réintégré ✓');
            });
        }
    }
})();
