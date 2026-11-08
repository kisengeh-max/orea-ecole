/* =====================================================================
   ORÉA École v94 — risque.js : alerte « élève à risque »
   - Menu → « Élèves à suivre » (chef d'établissement, Directeur des études) :
     une seule liste qui réunit, sur les 4 dernières semaines, les absences,
     les retards, la chute ou la faiblesse des cotes, les impayés, les
     signalements des enseignants et les sanctions. Chaque élève a ses raisons.
   - Un geste : « Prévenir le parent » (message humain, jamais de « score »),
     dans son espace parent + WhatsApp / SMS si son numéro est connu.
   - Fiche de l'élève → « ⚠ Signaler » : tout membre du personnel signale un
     changement de comportement, un travail en baisse, un souci de santé…
   À charger APRÈS app.js et annee.js.
   ===================================================================== */
(function () {
    'use strict';
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pedago = () => S.me && S.me.role === 'directeur' && !S.me.secretariat;
    const KINDS = [['comportement', 'Changement de comportement'], ['travail', 'Travail en baisse'], ['sante', 'Santé'], ['famille', 'Situation familiale'], ['autre', 'Autre']];

    /* ---------- Liste ---------- */
    window.oreaRisk = async function () {
        const d = show(`<h3>Élèves à suivre</h3><small>4 dernières semaines : absences, retards, cotes, impayés, signalements et sanctions. Seuls les élèves qui cumulent plusieurs signaux apparaissent.</small><div id=rk-l><div class=sk></div><div class=sk></div></div><form method=dialog><button class=ghost>Fermer</button></form>`);
        const { data, error } = await db.rpc('v94_risk_list', { p_days: 28 });
        const box = d.querySelector('#rk-l'); if (!box) return;
        if (error) { box.innerHTML = `<p class=empty>${E(error.message)}</p>`; return; }
        const L = data || [];
        if (!L.length) { box.innerHTML = '<p class=empty>Aucun élève à risque pour le moment. 👍</p>'; return; }
        const money = typeof fin === 'function' && fin();
        const why = x => {
            const r = [];
            if (x.abs) r.push(`${x.abs} absence${x.abs > 1 ? 's' : ''}`);
            if (x.ret >= 4) r.push(`${x.ret} retards`);
            if (x.pct != null && x.pct < 50) r.push(`cotes ${x.pct} %`);
            if (x.pct != null && x.prev != null && x.prev - x.pct >= 10) r.push(`baisse ${x.prev} → ${x.pct} %`);
            if (x.bal > 0) r.push(money ? 'solde ' + fmt(x.bal) : 'impayé');
            if (x.beh) r.push(`${x.beh} signalement${x.beh > 1 ? 's' : ''}`);
            if (x.sanc) r.push(`${x.sanc} sanction${x.sanc > 1 ? 's' : ''}`);
            return r;
        };
        box.innerHTML = L.map(x => `<div class="card col" style="border-color:${x.score >= 6 ? 'var(--bad)' : 'var(--gold)'}">
<div style="display:flex;justify-content:space-between;gap:8px"><b>${E(x.name)}</b><small>${E(x.classe)}${x.finaliste ? ' · <b class=due>finaliste</b>' : ''}</small></div>
<div class=row style="flex-wrap:wrap;gap:4px">${why(x).map(t => `<span class=chip style="min-height:0;padding:2px 8px;font-size:12px">${E(t)}</span>`).join('')}</div>
${x.notes ? `<small>« ${E(x.notes)} »</small>` : ''}
<div class=row><button type=button class=ghost data-fi="${x.id}">Fiche</button><button type=button data-pa="${x.id}">Prévenir le parent</button></div></div>`).join('');
        box.querySelectorAll('[data-fi]').forEach(b => b.onclick = () => { d.close(); setTimeout(() => menu(b.dataset.fi), 60); });
        box.querySelectorAll('[data-pa]').forEach(b => b.onclick = () => tellParent(L.find(x => x.id === b.dataset.pa), why));
    };

    /* ---------- Message au parent ---------- */
    function tellParent(x, why) {
        const s = S.stu.find(y => y.id === x.id) || {};
        const tpl = {
            suivi: `Bonjour, nous souhaitons vous parler de ${x.name}. Nous avons remarqué quelques difficultés ces dernières semaines et voulons l’aider à réussir. Merci de passer à l’école ou de nous rappeler.`,
            presence: `Bonjour, ${x.name} a été absent(e) plusieurs fois ces dernières semaines. Pouvez-vous nous en indiquer la raison ? Merci.`,
            convoc: `Bonjour, vous êtes invité(e) à passer à l’école cette semaine pour parler de ${x.name} avec la direction. Merci.`
        };
        const d = show(`<form method=dialog><h3>Prévenir le parent · ${E(x.name)}</h3>
<label>Modèle<select name=t><option value=suivi>Suivi général</option><option value=presence>Absences</option><option value=convoc>Invitation à l’école</option></select></label>
<label>Message (modifiable)<textarea name=msg rows=5 maxlength=600>${E(tpl.suivi)}</textarea></label>
<small>Le parent reçoit ce message dans son espace ORÉA. ${s.parent_phone ? 'Vous pouvez aussi l’envoyer par WhatsApp ou SMS.' : 'Aucun numéro de parent enregistré.'}</small>
<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Envoyer</button></div>
${s.parent_phone ? `<div class=row><a class="btn ghost" id=tp-wa target=_blank rel=noopener style="text-align:center;text-decoration:none">WhatsApp</a><a class="btn ghost" id=tp-sms style="text-align:center;text-decoration:none">SMS</a></div>` : ''}</form>`);
        const f = d.querySelector('form');
        const links = () => {
            const wa = d.querySelector('#tp-wa'), sm = d.querySelector('#tp-sms');
            if (wa && typeof waLink === 'function') wa.href = waLink(s.parent_phone, f.msg.value);
            if (sm && typeof smsLink === 'function') sm.href = smsLink(s.parent_phone, f.msg.value);
        };
        f.t.onchange = () => { f.msg.value = tpl[f.t.value]; links(); };
        f.msg.oninput = links; links();
        f.onsubmit = async e => {
            if (!e.submitter || e.submitter.value !== 'ok') return;
            const { data, error } = await db.rpc('v94_notify_parent', { p_student: x.id, p_title: 'Message de ' + S.school.name, p_body: f.msg.value.trim() });
            if (error) return toast(error.message);
            toast(data ? 'Message envoyé dans l’espace parent ✓' : 'Aucun parent relié dans ORÉA : utilisez WhatsApp ou SMS.');
        };
    }

    /* ---------- Fiche élève : « ⚠ Signaler » ---------- */
    const oMenu = window.menu;
    if (typeof oMenu === 'function') window.menu = function (id) {
        const r = oMenu.apply(this, arguments);
        setTimeout(() => {
            const dlg = document.getElementById('dlg'); if (!dlg || !dlg.open || dlg.querySelector('#rk-sig') || S.ro) return;
            if (!S.me || !['directeur', 'enseignant', 'percepteur'].includes(S.me.role)) return;
            const s = S.stu.find(x => x.id === id); if (!s) return;
            const b = document.createElement('button'); b.type = 'button'; b.id = 'rk-sig'; b.className = 'ghost'; b.textContent = '⚠ Signaler (comportement, travail, santé…)';
            b.onclick = () => ask('Signaler · ' + E(s.name), [{ n: 'k', l: 'Type', o: KINDS, v: 'comportement' }, { n: 'note', l: 'Ce que vous avez remarqué', t: 'textarea', v: '' }], async v => {
                const { error } = await db.from('behavior_reports').insert({ school_id: S.school.id, student_id: s.id, by_id: S.me.id, kind: v.k, note: (v.note || '').trim() || null });
                if (error) throw error;
                toast('Signalement transmis à la direction ✓');
            });
            const anchor = dlg.querySelector('#mv-box') || dlg.querySelector('form[method=dialog]') || dlg.lastElementChild;
            anchor ? anchor.before(b) : dlg.appendChild(b);
        }, 10);
        return r;
    };

    /* ---------- Menu → « Élèves à suivre » ---------- */
    const oVM = window.vMenu;
    if (typeof oVM === 'function') window.vMenu = function () {
        const r = oVM.apply(this, arguments);
        if (pedago()) {
            const m = document.getElementById('main');
            const a = m && (m.querySelector('#pre-menu') || m.querySelector('[onclick*="pAdminAnnonce"]'));
            if (a && !m.querySelector('#rk-menu')) {
                const t = document.createElement('div'); t.innerHTML = menuCard('alerte', 'Élèves à suivre', 'Absences, cotes, impayés, signalements', 'oreaRisk()');
                const c = t.firstElementChild; c.id = 'rk-menu'; a.after(c);
            }
        }
        return r;
    };
})();
