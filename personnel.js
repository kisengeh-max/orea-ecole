/* =====================================================================
   ORÉA École v89 — personnel.js : Dossiers du personnel + Paie
   1) Dossiers (Équipe & Cours → onglet « Dossiers ») — chef d'établissement
      et Directeur des études :
      - une fiche pour chaque membre, AVEC ou SANS compte (enseignants,
        direction, personnel non enseignant : gardien, ménage, comptable…)
      - cours d'un enseignant sans compte, pointage fait par la direction
      - « Relier à un compte » quand la personne crée son compte : ses cours
        passent sur son compte, rien n'est perdu
      - les cotes saisies par la direction pour un cours sont enregistrées
        « pour » l'enseignant du cours (automatique, côté base)
   2) Paie (Finance → Paie) — chef d'établissement seul :
      - statut (École / État / N.U.), devise et salaire de base par personne,
        avec historique
      - fiches de paie mensuelles : primes, retenues (type au choix),
        remboursement d'avance, net à payer, image à partager
      - avances / prêts : remboursés en une fois ou chaque mois
      - Dépenses : on compte l'argent qui sort de la caisse (avance versée,
        net payé). Payé par l'État : pas de salaire de base, seulement primes.
   À charger APRÈS app.js, finance.js et equipe.js.
   ===================================================================== */
(function () {
    'use strict';

    const KIND = { direction: 'Direction', enseignant: 'Enseignant', non_enseignant: 'Personnel non enseignant' };
    const PST = { ecole: 'Payé par l’école', etat: 'Payé par l’État', nu: 'N.U.' };
    const RET = [['absence', 'Absence'], ['retard', 'Retard'], ['autre', 'Autre (préciser)']];
    const money = (n, c) => nf(Number(n || 0), c === 'CDF' ? 0 : 2) + ' ' + (SYM[c] || c || '');
    const curMonth = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);
    const monthLbl = m => { const [y, mo] = String(m).split('-'); return new Date(+y, +mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
    const hm = t => t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const isPedago = () => !!(S.me && S.me.role === 'directeur' && !S.me.secretariat);
    const isFin = () => typeof fin === 'function' && fin();
    const today = () => new Date().toLocaleDateString('sv-SE');
    const err = e => toast((e && e.message) || 'Erreur');

    /* ================================================================
       1) DOSSIERS
       ================================================================ */
    const DS = { q: '', f: 'all' };

    // Appelé par equipe.js (onglet « Dossiers ») : box = zone de liste, reload = redessiner l'équipe
    window.oreaDossiers = async function (box, q) {
        if (!isPedago()) { box.innerHTML = '<p class="empty">Réservé au chef d’établissement et au Directeur des études.</p>'; return; }
        if (q !== undefined) DS.q = q;
        box.innerHTML = '<div class="sk"></div><div class="sk"></div>';
        const [rf, rp, rk] = await Promise.all([
            db.from('staff_files').select('*').eq('school_id', S.school.id).order('full_name'),
            db.from('profiles').select('id,full_name,role,etudes,secretariat,active').eq('school_id', S.school.id).neq('role', 'parent').order('full_name'),
            db.from('staff_file_checkins').select('*').eq('school_id', S.school.id).eq('day', today())
        ]);
        if (rf.error) { box.innerHTML = `<p class="empty">${esc(rf.error.message)}</p>`; return; }
        const files = rf.data || [], accs = rp.data || [], chk = Object.fromEntries((rk.data || []).map(c => [c.file_id, c]));
        const linked = new Set(files.filter(f => f.profile_id).map(f => f.profile_id));
        const noFile = accs.filter(a => !linked.has(a.id) && a.active !== false);
        const f = DS.q.toLowerCase();
        const L = files.filter(x => (DS.f === 'all' || (DS.f === 'sans' ? !x.profile_id : x.kind === DS.f)) && (!f || (x.full_name + ' ' + (x.fonction || '') + ' ' + KIND[x.kind]).toLowerCase().includes(f)));
        const chip = (k, l) => `<button type="button" class="chip ${DS.f === k ? 'on' : ''}" data-df="${k}">${l}</button>`;
        let h = `<div class="row" style="margin-bottom:8px"><button type="button" data-new="1" style="flex:1">+ Nouveau dossier</button></div>`;
        h += `<div class="chips" style="margin-bottom:8px">${chip('all', 'Tous · ' + files.length)}${chip('enseignant', 'Enseignants')}${chip('non_enseignant', 'Non enseignants')}${chip('direction', 'Direction')}${chip('sans', 'Sans compte')}</div>`;
        if (noFile.length) h += `<div class="card col" style="border-color:var(--gold)"><b>${noFile.length} compte${noFile.length > 1 ? 's' : ''} sans dossier</b><small>${noFile.map(a => esc(a.full_name)).join(' · ')}</small><small>Si la personne avait déjà un dossier sans compte, ouvrez ce dossier et touchez « Relier à un compte ». Sinon, créez son dossier.</small><button type="button" class="ghost" data-sync="1">Créer leurs dossiers</button></div>`;
        h += L.length ? L.map(x => {
            const c = chk[x.id];
            return `<div class="card col" style="margin-bottom:10px;${x.active ? '' : 'opacity:.6'}">
<div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(x.full_name)}</b><span class="chip ${x.profile_id ? 'ok' : ''}" style="padding:2px 8px;min-height:0;font-size:11px">${x.profile_id ? 'Compte relié' : 'Sans compte'}</span></div>
<small>${KIND[x.kind] || ''}${x.fonction ? ' · ' + esc(x.fonction) : ''}${x.active ? '' : ' · inactif'}</small>
${!x.profile_id && x.active ? `<small>Pointage du jour : arrivée ${hm(c && c.in_at)} · départ ${hm(c && c.out_at)}</small>` : ''}
<div class="row" style="margin-top:6px;flex-wrap:wrap">
<button type="button" class="ghost" data-ed="${x.id}" style="width:auto;flex:1">✏️ Dossier</button>
${!x.profile_id && x.kind !== 'non_enseignant' ? `<button type="button" class="ghost" data-co="${x.id}" style="width:auto;flex:1">📚 Cours</button>` : ''}
${!x.profile_id && x.active ? `<button type="button" class="ghost" data-in="${x.id}" style="width:auto;flex:1">Arrivée</button><button type="button" class="ghost" data-out="${x.id}" style="width:auto;flex:1">Départ</button>` : ''}
${!x.profile_id ? `<button type="button" class="ghost" data-ln="${x.id}" style="width:auto;flex:1">🔗 Relier à un compte</button>` : ''}
${isFin() ? `<button type="button" class="ghost" data-py="${x.id}" style="width:auto;flex:1">💰 Paie</button>` : ''}
</div></div>`;
        }).join('') : '<p class="empty">Aucun dossier.</p>';
        box.innerHTML = h;
        const again = () => window.oreaDossiers(box);
        const byId = id => files.find(x => x.id === id);
        box.querySelectorAll('[data-df]').forEach(b => b.onclick = () => { DS.f = b.dataset.df; again(); });
        box.querySelector('[data-new]').onclick = () => editFile(null, again);
        const sy = box.querySelector('[data-sync]');
        if (sy) sy.onclick = async () => { sy.disabled = true; const { data, error } = await db.rpc('v89_files_sync'); if (error) { sy.disabled = false; return err(error); } toast((data || 0) + ' dossier(s) créé(s)'); again(); };
        box.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editFile(byId(b.dataset.ed), again));
        box.querySelectorAll('[data-co]').forEach(b => b.onclick = () => fileCourses(byId(b.dataset.co)));
        box.querySelectorAll('[data-in],[data-out]').forEach(b => b.onclick = async () => {
            const id = b.dataset.in || b.dataset.out;
            b.disabled = true;
            const { error } = await db.rpc('v89_file_checkin', { p_file: id, p_kind: b.dataset.in ? 'in' : 'out' });
            if (error) { b.disabled = false; return err(error); }
            toast((b.dataset.in ? 'Arrivée' : 'Départ') + ' enregistré(e) ✓'); again();
        });
        box.querySelectorAll('[data-ln]').forEach(b => b.onclick = () => linkAccount(byId(b.dataset.ln), accs, files, again));
        box.querySelectorAll('[data-py]').forEach(b => b.onclick = () => paySettings(byId(b.dataset.py)));
    };

    // Les fenêtres des dossiers s'ouvrent dans la fenêtre de l'équipe : à la fermeture, on rouvre l'équipe
    const backToTeam = () => { if (typeof team === 'function') team('dossiers'); };

    function editFile(x, after) {
        const isNew = !x;
        const v = x || { full_name: '', kind: 'enseignant', fonction: '', phone: '', sexe: '', note: '', active: true };
        const d = show(`<form method=dialog><h3>${isNew ? 'Nouveau dossier' : 'Dossier · ' + esc(v.full_name)}</h3>
<label>Nom complet<input name=full_name required maxlength=120 value="${esc(v.full_name)}"></label>
<label>Catégorie<select name=kind>${Object.entries(KIND).map(([k, l]) => `<option value=${k} ${v.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<label>Fonction (facultatif)<input name=fonction maxlength=80 placeholder="Ex. : Gardien, Ménage, Comptable, Titulaire 3e A" value="${esc(v.fonction || '')}"></label>
<label>Téléphone (facultatif)<input name=phone type=tel maxlength=30 value="${esc(v.phone || '')}"></label>
<label>Sexe<select name=sexe>${SEXES.map(o => `<option value="${o[0]}" ${(v.sexe || '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
<label>Remarque (facultatif)<textarea name=note rows=2 maxlength=500>${esc(v.note || '')}</textarea></label>
${isNew ? '' : `<label style="display:flex;gap:8px;align-items:center;text-transform:none"><input type=checkbox name=active ${v.active ? 'checked' : ''} style="width:auto;margin:0"> Toujours en poste</label>`}
<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Enregistrer</button></div>
${!isNew && isFin() ? '<button type=button class=ghost data-del=1 style="margin-top:8px;color:var(--bad)">Supprimer ce dossier</button>' : ''}</form>`);
        const fm = d.querySelector('form');
        fm.onsubmit = async e => {
            if (!e.submitter || e.submitter.value !== 'ok') { setTimeout(backToTeam, 0); return; }
            const row = { full_name: fm.full_name.value.trim(), kind: fm.kind.value, fonction: fm.fonction.value.trim() || null, phone: fm.phone.value.trim() || null, sexe: fm.sexe.value || null, note: fm.note.value.trim() || null };
            if (!isNew) row.active = fm.active.checked;
            const r = isNew ? await db.from('staff_files').insert({ ...row, school_id: S.school.id }) : await db.from('staff_files').update(row).eq('id', x.id);
            if (r.error) return err(r.error);
            toast('Dossier enregistré ✓'); setTimeout(backToTeam, 0);
        };
        const del = d.querySelector('[data-del]');
        if (del) del.onclick = async () => {
            if (!confirm('Supprimer le dossier de ' + v.full_name + ' ?\nSes fiches de paie et son pointage seront aussi supprimés. Pour garder l’historique, décochez plutôt « Toujours en poste ».')) return;
            const { error } = await db.from('staff_files').delete().eq('id', x.id);
            if (error) return err(error);
            toast('Dossier supprimé'); backToTeam();
        };
    }

    async function fileCourses(x) {
        if (!x) return;
        const [{ data: classes }, { data: subjects }] = await Promise.all([
            db.from('classes').select('id,name').eq('school_id', S.school.id).eq('year', S.year).order('name'),
            db.from('subjects').select('id,name').eq('school_id', S.school.id).order('name')
        ]);
        const C = classes || [], Sb = subjects || [];
        const d = show(`<h3>Cours de ${esc(x.full_name)}</h3><small>Enseignant sans compte : la direction saisit ses cotes. Quand il créera son compte, ses cours passeront sur son compte.</small>
<label>Classe<select id=fc-cl>${C.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
<div id=fc-list style="max-height:50vh;overflow-y:auto"></div><button type=button class=ghost id=fc-x style="margin-top:12px">Fermer</button>`);
        const box = d.querySelector('#fc-list'), sel = d.querySelector('#fc-cl');
        d.querySelector('#fc-x').onclick = backToTeam;
        const draw = async () => {
            if (!sel.value) { box.innerHTML = `<p class=empty>Aucune classe pour l’année ${esc(S.year || '')}.</p>`; return; }
            const { data } = await db.from('staff_file_courses').select('subject_id').eq('file_id', x.id).eq('class_id', sel.value);
            const on = new Set((data || []).map(r => r.subject_id));
            box.innerHTML = Sb.length ? Sb.map(s => `<label class=card style="padding:10px;margin:5px 0;flex-direction:row;justify-content:flex-start;gap:10px;text-transform:none;font-size:14px;color:var(--tx)"><input type=checkbox data-sb="${s.id}" ${on.has(s.id) ? 'checked' : ''} style="width:auto;margin:0;transform:scale(1.4)">${esc(s.name)}</label>`).join('') : '<p class=empty>Aucun cours créé dans cette école.</p>';
            box.querySelectorAll('[data-sb]').forEach(cb => cb.onchange = async () => {
                const r = cb.checked
                    ? await db.from('staff_file_courses').insert({ school_id: S.school.id, file_id: x.id, class_id: sel.value, subject_id: cb.dataset.sb, year: S.year || '' })
                    : await db.from('staff_file_courses').delete().match({ file_id: x.id, class_id: sel.value, subject_id: cb.dataset.sb });
                if (r.error) { cb.checked = !cb.checked; err(r.error); }
            });
        };
        sel.onchange = draw; draw();
    }

    function linkAccount(x, accs, files, after) {
        if (!x) return;
        const mine = new Map(files.filter(f => f.profile_id).map(f => [f.profile_id, f]));
        const opts = accs.filter(a => a.active !== false && a.role !== 'parent').map(a => [a.id, a.full_name + (mine.has(a.id) ? ' (a déjà un dossier vide : fusion)' : '')]);
        if (!opts.length) return toast('Aucun compte du personnel. La personne doit d’abord rejoindre l’école avec le code ' + S.school.code + '.');
        ask('Relier ' + esc(x.full_name) + ' à un compte', [{ n: 'p', l: 'Compte de la personne', o: opts, v: opts[0][0] }], async v => {
            const { error } = await db.rpc('v89_link_account', { p_file: x.id, p_profile: v.p });
            if (error) return err(error);
            toast('Dossier relié au compte ✓'); setTimeout(backToTeam, 0);
        });
    }

    /* ================================================================
       2) PAIE
       ================================================================ */
    const PA = { month: curMonth() };

    // Réglages de paie d'une personne + avances
    async function paySettings(x) {
        if (!x || !isFin()) return;
        const [{ data: p }, { data: hist }, { data: adv }] = await Promise.all([
            db.from('staff_pay').select('*').eq('file_id', x.id).maybeSingle(),
            db.from('staff_pay_history').select('*').eq('file_id', x.id).order('created_at', { ascending: false }).limit(12),
            db.from('staff_advances').select('*').eq('file_id', x.id).order('given_on', { ascending: false })
        ]);
        const v = p || { pay_status: 'ecole', currency: 'CDF', base_salary: 0 };
        const A = adv || [];
        const open = A.filter(a => Number(a.remaining) > 0);
        const d = show(`<h3>Paie · ${esc(x.full_name)}</h3>
<form id=pf class=col>
<label>Statut<select name=st>${Object.entries(PST).map(([k, l]) => `<option value=${k} ${v.pay_status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<label>Devise de paie<select name=cur>${CUR.map(c => `<option ${v.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
<label id=pf-bl>Salaire de base par mois<input name=base type=number min=0 step=any value="${Number(v.base_salary || 0)}"></label>
<small id=pf-help></small>
<button type=submit>Enregistrer</button></form>
<h3 style="margin-top:16px">Avances et prêts</h3>
${open.length ? `<small>En cours : <b>${money(open.reduce((t, a) => t + Number(a.remaining), 0), v.currency)}</b> à rembourser</small>` : '<small>Aucune avance en cours.</small>'}
${A.map(a => `<div class="card col"><span>${new Date(a.given_on + 'T00:00').toLocaleDateString('fr-FR')} · ${money(a.amount, a.currency)} · ${a.mode === 'mensuel' ? 'retenue ' + money(a.monthly, a.currency) + ' / mois' : 'remboursée en une fois'}</span><small>${Number(a.remaining) > 0 ? 'Reste ' + money(a.remaining, a.currency) : '✓ Soldée'}${a.note ? ' · ' + esc(a.note) : ''}</small>${Number(a.remaining) === Number(a.amount) ? `<button type=button class=ghost data-cx="${a.id}" style="width:auto">Annuler cette avance</button>` : ''}</div>`).join('')}
<button type=button class=ghost id=pf-adv>+ Donner une avance / un prêt</button>
${(hist || []).length ? `<details style="margin-top:12px"><summary>Historique du statut</summary>${hist.map(hh => `<small style="display:block;padding:4px 0">${new Date(hh.created_at).toLocaleDateString('fr-FR')} · ${PST[hh.pay_status] || hh.pay_status} · ${money(hh.base_salary, hh.currency)}</small>`).join('')}</details>` : ''}
<button type=button class=ghost id=pf-x style="margin-top:12px">Fermer</button>`);
        const fm = d.querySelector('#pf');
        const help = () => {
            const etat = fm.st.value === 'etat';
            d.querySelector('#pf-bl').hidden = etat;
            d.querySelector('#pf-help').textContent = etat ? 'Payé par l’État : l’école ne verse pas de salaire de base. Seuls les primes, avances et autres versements comptent comme dépenses.' : 'Le net payé chaque mois compte comme dépense (catégorie Salaires).';
        };
        fm.st.onchange = help; help();
        fm.onsubmit = async e => {
            e.preventDefault();
            const row = { file_id: x.id, school_id: S.school.id, pay_status: fm.st.value, currency: fm.cur.value, base_salary: fm.st.value === 'etat' ? 0 : Math.max(0, +fm.base.value || 0) };
            if (p && p.currency !== row.currency && open.length) return toast('Une avance est en cours dans l’ancienne devise : soldez-la avant de changer de devise.');
            const { error } = await db.from('staff_pay').upsert(row, { onConflict: 'file_id' });
            if (error) return err(error);
            toast('Réglages de paie enregistrés ✓'); paySettings(x);
        };
        d.querySelector('#pf-adv').onclick = () => giveAdvance(x, v.currency);
        d.querySelectorAll('[data-cx]').forEach(b => b.onclick = async () => {
            if (!confirm('Annuler cette avance ? Sa dépense sera aussi supprimée.')) return;
            const { error } = await db.rpc('v89_cancel_advance', { p_id: b.dataset.cx });
            if (error) return err(error);
            toast('Avance annulée'); paySettings(x);
        });
        d.querySelector('#pf-x').onclick = () => (S.tab === 'finance_home' && S.finTab === 'paie') ? (d.close(), window.oreaPaieRefresh && oreaPaieRefresh()) : backToTeam();
    }

    function giveAdvance(x, cur) {
        const d = show(`<form method=dialog><h3>Avance / prêt · ${esc(x.full_name)}</h3>
<label>Montant (${esc(cur)})<input name=amount type=number min=0 step=any required></label>
<label>Remboursement<select name=mode><option value=une_fois>En une fois, sur la prochaine paie</option><option value=mensuel>Chaque mois (montant fixe)</option></select></label>
<label id=ga-m hidden>Montant retenu chaque mois (${esc(cur)})<input name=monthly type=number min=0 step=any></label>
<label>Remarque (facultatif)<input name=note maxlength=200></label>
<small>L’argent sort de la caisse aujourd’hui : une dépense « Salaires » est créée.</small>
<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Donner</button></div></form>`);
        const fm = d.querySelector('form');
        fm.mode.onchange = () => { d.querySelector('#ga-m').hidden = fm.mode.value !== 'mensuel'; };
        fm.onsubmit = async e => {
            if (!e.submitter || e.submitter.value !== 'ok') { setTimeout(() => paySettings(x), 0); return; }
            const { error } = await db.rpc('v89_give_advance', { p_file: x.id, p_amount: +fm.amount.value, p_mode: fm.mode.value, p_monthly: fm.mode.value === 'mensuel' ? +fm.monthly.value : null, p_note: fm.note.value.trim() || null });
            if (error) return err(error);
            toast('Avance enregistrée ✓'); setTimeout(() => paySettings(x), 0);
        };
    }

    // Écran Finance → Paie
    window.oreaPaie = async function (box) {
        if (!isFin()) { box.innerHTML = '<p class=empty>Réservé au chef d’établissement.</p>'; return; }
        box.innerHTML = '<div class=sk></div><div class=sk></div>';
        const [rf, rp, rs, ra] = await Promise.all([
            db.from('staff_files').select('id,full_name,kind,fonction,active').eq('school_id', S.school.id).eq('active', true).order('full_name'),
            db.from('staff_pay').select('*').eq('school_id', S.school.id),
            db.from('payslips').select('*').eq('school_id', S.school.id).eq('month', PA.month),
            db.from('staff_advances').select('file_id,remaining,currency').eq('school_id', S.school.id).gt('remaining', 0)
        ]);
        if (rf.error) { box.innerHTML = `<p class=empty>${esc(rf.error.message)}</p>`; return; }
        const F = rf.data || [], P = Object.fromEntries((rp.data || []).map(p => [p.file_id, p])), SL = Object.fromEntries((rs.data || []).map(s => [s.file_id, s]));
        const ADV = {}; (ra.data || []).forEach(a => { ADV[a.file_id] = (ADV[a.file_id] || 0) + Number(a.remaining); });
        const tot = {}, totPaid = {};
        F.forEach(f => {
            const sl = SL[f.id], p = P[f.id]; if (!p && !sl) return;
            const c = (sl || p).currency, n = sl ? Number(sl.net) : (p.pay_status === 'etat' ? 0 : Number(p.base_salary || 0));
            tot[c] = (tot[c] || 0) + n; if (sl && sl.status === 'paye') totPaid[c] = (totPaid[c] || 0) + n;
        });
        const sum = o => Object.entries(o).filter(x => x[1]).map(x => money(x[1], x[0])).join(' · ') || '0';
        let h = `<label>Mois<input type=month id=pa-m value="${PA.month}"></label>
<div class=card><span>À payer en ${monthLbl(PA.month)}</span><b>${sum(tot)}</b></div>
<div class=card><span>Déjà payé</span><b>${sum(totPaid)}</b></div>
<small style="display:block;margin:6px 0 10px">Touchez une personne pour préparer ou payer sa fiche. Les réglages (statut, devise, salaire) se font dans « Réglages de paie ».</small>`;
        h += F.length ? F.map(f => {
            const p = P[f.id], sl = SL[f.id];
            const st = sl ? (sl.status === 'paye' ? `<span class=ok>✓ Payé · ${money(sl.net, sl.currency)}</span>` : `<span class=due>Brouillon · ${money(sl.net, sl.currency)}</span>`) : p ? `<span>${p.pay_status === 'etat' ? 'Primes seulement' : 'Base ' + money(p.base_salary, p.currency)}</span>` : '<span class=due>Paie non réglée</span>';
            return `<div class="card col" data-sl="${f.id}" style="cursor:pointer"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(f.full_name)}</b><small>${p ? PST[p.pay_status] : ''}</small></div><small>${KIND[f.kind] || ''}${f.fonction ? ' · ' + esc(f.fonction) : ''}${ADV[f.id] ? ' · avance en cours ' + money(ADV[f.id], p ? p.currency : 'CDF') : ''}</small>${st}</div>`;
        }).join('') : '<p class=empty>Aucun dossier du personnel. Créez-les dans Menu → Équipe & Cours → Dossiers.</p>';
        box.innerHTML = h;
        box.querySelector('#pa-m').onchange = e => { if (e.target.value) { PA.month = e.target.value; window.oreaPaie(box); } };
        box.querySelectorAll('[data-sl]').forEach(c => c.onclick = () => {
            const f = F.find(x => x.id === c.dataset.sl);
            if (!P[f.id]) return paySettings(f);
            openSlip(f, P[f.id], SL[f.id], () => window.oreaPaie(box));
        });
        window.oreaPaieRefresh = () => window.oreaPaie(box);
    };

    // Fiche de paie d'une personne pour le mois choisi
    async function openSlip(f, p, sl, after) {
        const { data: adv } = await db.from('staff_advances').select('*').eq('file_id', f.id).gt('remaining', 0).order('given_on');
        const A = (adv || []).filter(a => a.currency === p.currency);
        const openAdv = A.reduce((t, a) => t + Number(a.remaining), 0);
        const suggest = A.reduce((t, a) => t + (a.mode === 'mensuel' ? Math.min(Number(a.monthly || 0), Number(a.remaining)) : Number(a.remaining)), 0);
        const etat = (sl ? sl.pay_status : p.pay_status) === 'etat', cur = sl ? sl.currency : p.currency;
        const paid = sl && sl.status === 'paye';
        let lines = sl ? (sl.lines || []).map(l => ({ ...l })) : [];
        const base0 = sl ? Number(sl.base) : (etat ? 0 : Number(p.base_salary || 0));
        const rep0 = sl ? Number(sl.advance_repay) : Math.min(suggest, openAdv);
        const d = show(`<h3>Fiche de paie · ${esc(f.full_name)}</h3><small>${monthLbl(PA.month)} · ${PST[sl ? sl.pay_status : p.pay_status]} · ${cur}</small>
<div id=sl-body></div>`);
        const body = d.querySelector('#sl-body');
        const total = (base, rep) => base + lines.filter(l => l.k === 'prime').reduce((t, l) => t + Number(l.amount || 0), 0) - lines.filter(l => l.k === 'retenue').reduce((t, l) => t + Number(l.amount || 0), 0) - rep;
        if (paid) {
            body.innerHTML = `${slipTable(base0, lines, Number(sl.advance_repay), cur, etat)}<div class=card><span>Net payé le ${new Date(sl.paid_on + 'T00:00').toLocaleDateString('fr-FR')}</span><b>${money(sl.net, cur)}</b></div>
<div class=col><button type=button id=sl-img>🖼 Image de la fiche (partager / imprimer)</button><button type=button class=ghost id=sl-un>Annuler le paiement (correction)</button><button type=button class=ghost id=sl-x>Fermer</button></div>`;
            body.querySelector('#sl-img').onclick = () => slipImage(f, sl, etat);
            body.querySelector('#sl-un').onclick = async () => {
                if (!confirm('Annuler le paiement ? La dépense sera supprimée et l’avance remboursée sera remise comme avant. La fiche redevient un brouillon.')) return;
                const { error } = await db.rpc('v89_unpay_slip', { p_id: sl.id });
                if (error) return err(error);
                toast('Paiement annulé'); d.close(); after();
            };
            body.querySelector('#sl-x').onclick = () => { d.close(); after(); };
            return;
        }
        const draw = () => {
            body.innerHTML = `<form id=sl-f class=col>
${etat ? '<small>Payé par l’État : pas de salaire de base versé par l’école.</small>' : `<label>Salaire de base<input name=base type=number min=0 step=any value="${base0}"></label>`}
<b style="margin-top:6px">Primes et retenues</b>
<div id=sl-lines>${lines.map((l, i) => `<div class=card style="gap:8px;align-items:center"><span style="flex:1">${l.k === 'prime' ? '+ Prime' : '− ' + esc(l.type === 'autre' ? (l.label || 'Retenue') : (RET.find(r => r[0] === l.type) || [0, 'Retenue'])[1])}${l.k === 'prime' && l.label ? ' · ' + esc(l.label) : ''}${l.k === 'retenue' && l.type !== 'autre' && l.label ? ' · ' + esc(l.label) : ''}</span><b>${money(l.amount, cur)}</b><button type=button class=ghost data-rm=${i} style="width:auto;padding:4px 10px">✕</button></div>`).join('') || '<small>Aucune ligne.</small>'}</div>
<div class=row><button type=button class=ghost id=sl-p>+ Prime</button><button type=button class=ghost id=sl-r>− Retenue</button></div>
${openAdv > 0 ? `<label>Remboursement d’avance (en cours : ${money(openAdv, cur)})<input name=rep type=number min=0 max=${openAdv} step=any value="${rep0}"></label>` : ''}
<div class=card><span>Net à payer</span><b id=sl-net></b></div>
<div class=row><button type=button class=ghost id=sl-s>Enregistrer le brouillon</button><button type=button id=sl-pay>Payer</button></div>
${sl ? '<button type=button class=ghost id=sl-del style="color:var(--bad)">Supprimer le brouillon</button>' : ''}
<button type=button class=ghost id=sl-x>Fermer</button></form>`;
            const fm = body.querySelector('#sl-f');
            const vals = () => ({ base: etat ? 0 : Math.max(0, +(fm.base && fm.base.value) || 0), rep: fm.rep ? Math.min(openAdv, Math.max(0, +fm.rep.value || 0)) : 0 });
            const upd = () => { const v = vals(), n = total(v.base, v.rep); const e = body.querySelector('#sl-net'); e.textContent = money(n, cur); e.className = n < 0 ? 'due' : ''; return n; };
            fm.oninput = upd; upd();
            body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { keep(); lines.splice(+b.dataset.rm, 1); redraw(); });
            body.querySelector('#sl-p').onclick = () => addLine('prime');
            body.querySelector('#sl-r').onclick = () => addLine('retenue');
            const keep = () => { const v = vals(); state.base = v.base; state.rep = v.rep; };
            const save = async () => {
                const v = vals();
                if (total(v.base, v.rep) < 0) { toast('Le net à payer ne peut pas être négatif.'); return null; }
                const row = { base: v.base, lines, advance_repay: v.rep };
                const r = sl ? await db.from('payslips').update(row).eq('id', sl.id).select().single()
                    : await db.from('payslips').insert({ ...row, file_id: f.id, school_id: S.school.id, month: PA.month }).select().single();
                if (r.error) { err(r.error); return null; }
                sl = r.data; return sl;
            };
            body.querySelector('#sl-s').onclick = async () => { if (await save()) { toast('Brouillon enregistré ✓'); d.close(); after(); } };
            body.querySelector('#sl-pay').onclick = async () => {
                const n = upd();
                if (!confirm('Payer ' + money(n, cur) + ' à ' + f.full_name + ' pour ' + monthLbl(PA.month) + ' ?\nUne dépense « Salaires » sera créée.')) return;
                const s2 = await save(); if (!s2) return;
                const { error } = await db.rpc('v89_pay_slip', { p_id: s2.id });
                if (error) return err(error);
                toast('Paie enregistrée ✓'); d.close(); after();
            };
            const del = body.querySelector('#sl-del');
            if (del) del.onclick = async () => { if (!confirm('Supprimer ce brouillon ?')) return; const { error } = await db.from('payslips').delete().eq('id', sl.id); if (error) return err(error); d.close(); after(); };
            body.querySelector('#sl-x').onclick = () => { d.close(); after(); };
        };
        const state = { base: base0, rep: rep0 };
        // Ajout d'une prime ou d'une retenue (dans la même fenêtre)
        const addLine = k => {
            const fm = body.querySelector('#sl-f'); if (fm) { if (fm.base) state.base = +fm.base.value || 0; if (fm.rep) state.rep = +fm.rep.value || 0; }
            body.innerHTML = `<form id=al class=col><b>${k === 'prime' ? 'Ajouter une prime' : 'Ajouter une retenue'}</b>
${k === 'retenue' ? `<label>Type<select name=type>${RET.map(r => `<option value=${r[0]}>${r[1]}</option>`).join('')}</select></label>` : ''}
<label id=al-lb>${k === 'prime' ? 'Libellé (ex. : prime de fin de trimestre)' : 'Précision (facultatif)'}<input name=label maxlength=80></label>
<label>Montant (${cur})<input name=amount type=number min=0 step=any required></label>
<div class=row><button type=button class=ghost id=al-x>Annuler</button><button type=submit>Ajouter</button></div></form>`;
            const af = body.querySelector('#al');
            if (af.type) af.type.onchange = () => { body.querySelector('#al-lb').firstChild.textContent = af.type.value === 'autre' ? 'Type de retenue (à préciser)' : 'Précision (facultatif)'; af.label.required = af.type.value === 'autre'; };
            body.querySelector('#al-x').onclick = () => { redraw(); };
            af.onsubmit = e => {
                e.preventDefault();
                const amt = +af.amount.value;
                if (!(amt > 0)) return toast('Montant invalide');
                lines.push({ k, type: k === 'prime' ? 'prime' : af.type.value, label: af.label.value.trim(), amount: amt });
                redraw();
            };
        };
        const redraw = () => { draw(); const fm = body.querySelector('#sl-f'); if (fm.base) fm.base.value = state.base; if (fm.rep) fm.rep.value = state.rep; fm.oninput(); };
        draw();
    }

    function slipTable(base, lines, rep, cur, etat) {
        const row = (l, v, cls) => `<div class=card style="padding:8px 12px"><span>${l}</span><b class="${cls || ''}">${v}</b></div>`;
        return (etat ? '' : row('Salaire de base', money(base, cur)))
            + lines.map(l => row(l.k === 'prime' ? 'Prime' + (l.label ? ' · ' + esc(l.label) : '') : 'Retenue · ' + esc(l.type === 'autre' ? (l.label || 'Autre') : ((RET.find(r => r[0] === l.type) || [0, ''])[1] + (l.label ? ' · ' + l.label : ''))), (l.k === 'prime' ? '+ ' : '− ') + money(l.amount, cur), l.k === 'prime' ? 'ok' : 'due')).join('')
            + (rep > 0 ? row('Remboursement d’avance', '− ' + money(rep, cur), 'due') : '');
    }

    // Image de la fiche (comme les reçus) : partager ou enregistrer
    async function slipImage(f, sl, etat) {
        const L = [];
        if (!etat) L.push(['Salaire de base', money(sl.base, sl.currency)]);
        (sl.lines || []).forEach(l => L.push([l.k === 'prime' ? 'Prime' + (l.label ? ' · ' + l.label : '') : 'Retenue · ' + (l.type === 'autre' ? (l.label || 'Autre') : ((RET.find(r => r[0] === l.type) || [0, ''])[1] + (l.label ? ' · ' + l.label : ''))), (l.k === 'prime' ? '+ ' : '− ') + money(l.amount, sl.currency)]));
        if (Number(sl.advance_repay) > 0) L.push(['Remboursement d’avance', '− ' + money(sl.advance_repay, sl.currency)]);
        const H = 520 + L.length * 44;
        const cv = document.createElement('canvas'); cv.width = 640; cv.height = H; const x = cv.getContext('2d');
        x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 640, H);
        x.strokeStyle = '#b08a30'; x.lineWidth = 4; x.strokeRect(14, 14, 612, H - 28);
        const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = 'logo-light.png'; });
        if (im) x.drawImage(im, 260, 30, 120, 120);
        x.textAlign = 'center'; x.fillStyle = '#1a1713';
        x.font = 'bold 26px Georgia, serif'; x.fillText('FICHE DE PAIE', 320, 186);
        x.font = '18px system-ui, sans-serif'; x.fillText(S.school.name, 320, 216);
        x.fillStyle = '#6b6760'; x.fillText(monthLbl(sl.month), 320, 244);
        x.textAlign = 'left'; x.fillStyle = '#1a1713'; x.font = 'bold 20px system-ui, sans-serif';
        x.fillText(f.full_name, 50, 296);
        x.font = '16px system-ui, sans-serif'; x.fillStyle = '#6b6760';
        x.fillText((KIND[f.kind] || '') + (f.fonction ? ' · ' + f.fonction : '') + ' · ' + PST[sl.pay_status], 50, 322);
        let y = 370;
        L.forEach(([a, b]) => { x.fillStyle = '#1a1713'; x.textAlign = 'left'; x.fillText(a.slice(0, 48), 50, y); x.textAlign = 'right'; x.fillText(b, 590, y); x.strokeStyle = '#e8e0cc'; x.lineWidth = 1; x.beginPath(); x.moveTo(50, y + 14); x.lineTo(590, y + 14); x.stroke(); y += 44; });
        x.font = 'bold 22px system-ui, sans-serif'; x.fillStyle = '#8a6a1f'; x.textAlign = 'left'; x.fillText('NET PAYÉ', 50, y + 20); x.textAlign = 'right'; x.fillText(money(sl.net, sl.currency), 590, y + 20);
        x.font = '15px system-ui, sans-serif'; x.fillStyle = '#6b6760'; x.textAlign = 'left';
        x.fillText('Payé le ' + new Date(sl.paid_on + 'T00:00').toLocaleDateString('fr-FR'), 50, y + 70);
        x.fillText('Signature du chef d’établissement :', 50, y + 110);
        x.fillText('Signature de l’intéressé(e) :', 340, y + 110);
        const blob = await new Promise(r => cv.toBlob(r, 'image/png')), url = URL.createObjectURL(blob);
        const fn = 'fiche-paie-' + sl.month + '-' + f.full_name.replace(/[^\p{L}\p{N}]+/gu, '-') + '.png';
        const d = show(`<h3>Fiche de paie</h3><img src="${url}" alt="" style="width:100%;border-radius:10px;border:1px solid var(--line)"><div class=col style="margin-top:10px">${navigator.canShare ? '<button type=button id=si-sh>📤 Partager</button>' : ''}<a class="btn ghost" download="${esc(fn)}" href="${url}" style="text-align:center;text-decoration:none">💾 Enregistrer l’image</a><form method=dialog><button class=ghost>Fermer</button></form></div>`);
        const sh = d.querySelector('#si-sh');
        if (sh) sh.onclick = async () => { try { const file = new File([blob], fn, { type: 'image/png' }); if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Fiche de paie' }); else toast('Partage impossible sur ce téléphone : enregistrez l’image.'); } catch (_) { } };
    }
})();
