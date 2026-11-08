/* =====================================================================
   ORÉA École v91 — cahier.js
   1) Cahier de textes (Menu → Cahier de textes) : la matière vue chaque jour,
      par classe et par cours. Un devoir éventuel est enregistré UNE seule
      fois, dans « Devoirs » (pas de doublon). Visible par les parents.
      Marche hors connexion (envoi au retour du réseau).
   2) SMS groupés (Menu → SMS aux parents) : ouvre l'application SMS du
      téléphone, message prêt, par lots de 10 numéros.
   3) Cantine, transport… (Finance → Cantine/transport) : services payés
      chaque mois par les élèves inscrits. Chaque mois, une ligne
      « Autres frais » est créée automatiquement pour chaque inscrit.
   À charger APRÈS app.js et finance.js.
   ===================================================================== */
(function () {
    'use strict';
    const back = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>`;
    const tdy0 = () => new Date().toLocaleDateString('sv-SE');
    const fdate = d => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const pedago = () => S.me.role === 'directeur' && !S.me.secretariat;
    const canWrite = () => pedago() || S.me.role === 'enseignant' || S.me.role === 'percepteur';

    /* ================= 1) CAHIER DE TEXTES ================= */
    const CT = { cls: null };
    async function myCourses() {
        // Cours que la personne peut remplir : tous (direction) ou ceux qui lui sont attribués
        if (pedago()) {
            const { data } = await db.from('class_subjects').select('class_id,subject_id,subjects(name)').eq('school_id', S.school.id);
            return (data || []).map(r => ({ class_id: r.class_id, subject_id: r.subject_id, name: r.subjects ? r.subjects.name : '' }));
        }
        const { data } = await db.from('teacher_subjects').select('class_id,subject_id,subjects(name)').eq('teacher_id', S.me.id).eq('year', S.year);
        return (data || []).map(r => ({ class_id: r.class_id, subject_id: r.subject_id, name: r.subjects ? r.subjects.name : '' }));
    }
    window.vCahier = async function () {
        const cls = yc();
        if (!cls.length) { $('#main').innerHTML = back + '<h3>Cahier de textes</h3><p class=empty>Créez d’abord une classe.</p>'; return; }
        const courses = canWrite() ? await myCourses() : [];
        const mine = pedago() || !canWrite() ? cls : cls.filter(c => courses.some(x => x.class_id === c.id));
        const list = mine.length ? mine : cls;
        if (!list.some(c => c.id === CT.cls)) CT.cls = (list.find(c => c.id === S.cls) || list[0]).id;
        let h = back + `<h3>Cahier de textes</h3><div class=row style="margin-bottom:8px"><button type=button class="chip on" style="flex:1">Séances</button><button type=button class=chip style="flex:1" onclick="menuGo('devoirs')">Devoirs</button></div>
<div class=bar><select id=ct-c>${list.map(c => `<option value="${c.id}" ${c.id === CT.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
        const cc = courses.filter(x => x.class_id === CT.cls);
        if (canWrite() && cc.length) h += `<button id=ct-new>+ Nouvelle séance</button>`;
        else if (canWrite()) h += `<p class=empty style="padding:8px">Aucun cours attribué dans cette classe.</p>`;
        h += `<div id=ct-l><div class=sk></div><div class=sk></div></div>`;
        $('#main').innerHTML = h;
        $('#ct-c').onchange = e => { CT.cls = e.target.value; vCahier(); };
        const nb = $('#ct-new'); if (nb) nb.onclick = () => newLesson(cc);
        const { data, error } = await db.from('lesson_log').select('*').eq('class_id', CT.cls).order('day', { ascending: false }).order('created_at', { ascending: false }).limit(60);
        const box = $('#ct-l'); if (!box) return;
        if (error) { box.innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
        const L = data || [];
        box.innerHTML = L.length ? L.map(x => `<div class="card col"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(x.subject)}</b><small>${fdate(x.day)}</small></div><span>${esc(x.title)}</span>${x.content ? `<small>${esc(x.content)}</small>` : ''}${x.assignment_id ? '<small class=due>📝 Devoir donné (voir Devoirs)</small>' : ''}${x.created_by === S.me.id || pedago() ? `<button type=button class=ghost data-del="${x.id}" style="width:auto;align-self:flex-end;padding:4px 10px">Supprimer</button>` : ''}</div>`).join('') : '<p class=empty data-ic="📖">Aucune séance notée pour cette classe.</p>';
        box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
            if (!confirm('Supprimer cette séance ? (le devoir éventuel reste dans Devoirs)')) return;
            const { error: e } = await db.from('lesson_log').delete().eq('id', b.dataset.del);
            if (e) return toast(e.message);
            toast('Séance supprimée'); vCahier();
        });
    };
    function newLesson(cc) {
        const d = show(`<form method=dialog><h3>Nouvelle séance</h3>
<label>Cours<select name=sb>${cc.map(x => `<option value="${x.subject_id}">${esc(x.name)}</option>`).join('')}</select></label>
<label>Date<input name=day type=date value="${tdy0()}" max="${tdy0()}"></label>
<label>Matière vue (titre / chapitre)<input name=title required maxlength=160 placeholder="Ex. : Les fractions — addition"></label>
<label>Résumé (facultatif)<textarea name=content rows=3 maxlength=1500></textarea></label>
<label style="display:flex;gap:8px;align-items:center;text-transform:none"><input type=checkbox name=hw style="width:auto;margin:0"> Donner un devoir</label>
<div id=ct-hw hidden><label>Devoir<textarea name=hwt rows=2 maxlength=800></textarea></label><label>À rendre le<input name=due type=date></label></div>
<div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Enregistrer</button></div></form>`);
        const f = d.querySelector('form');
        f.hw.onchange = () => { d.querySelector('#ct-hw').hidden = !f.hw.checked; f.hwt.required = f.due.required = f.hw.checked; };
        f.onsubmit = async e => {
            if (!e.submitter || e.submitter.value !== 'ok') return;
            const sub = cc.find(x => x.subject_id === f.sb.value) || {};
            let aid = null;
            if (f.hw.checked) {
                const r = await db.from('assignments').insert({ school_id: S.school.id, class_id: CT.cls, subject: sub.name || '', description: f.hwt.value.trim(), due_date: f.due.value, year: S.year || '' }).select().single();
                if (r.error) return toast(r.error.message);
                aid = r.data && r.data.id;
            }
            const { error } = await db.from('lesson_log').insert({ school_id: S.school.id, class_id: CT.cls, subject_id: f.sb.value, subject: sub.name || '', day: f.day.value || tdy0(), title: f.title.value.trim(), content: f.content.value.trim() || null, assignment_id: aid, year: S.year || '', created_by: S.me.id });
            if (error) return toast(error.message);
            toast(window.oreaOffline && oreaOffline.isOff() ? 'Séance gardée : envoi au retour du réseau' : 'Séance enregistrée ✓'); vCahier();
        };
    }

    /* ================= 2) SMS GROUPÉS ================= */
    const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const smsHref = (nums, body) => isIOS() ? `sms:/open?addresses=${nums.join(',')}&body=${encodeURIComponent(body)}` : `sms:${nums.join(',')}?body=${encodeURIComponent(body)}`;
    const cleanNum = p => { let n = String(p || '').replace(/[^\d+]/g, ''); if (/^0\d{9}$/.test(n)) n = '+243' + n.slice(1); return n.length >= 9 ? n : ''; };
    window.oreaSmsGroup = function () {
        const cls = yc();
        const d = show(`<h3>SMS aux parents</h3><small>Le message s’ouvre dans l’application SMS du téléphone, par lots de 10 numéros (au-delà, beaucoup de téléphones refusent). Les messages personnels, comme le solde d’un élève, se font un par un depuis sa fiche.</small>
<label>Destinataires<select id=sg-to><option value=all>Tous les parents</option>${cls.map(c => `<option value="${c.id}">Parents de ${esc(c.name)}</option>`).join('')}<option value=due>Parents avec un solde à payer</option></select></label>
<label>Message<textarea id=sg-msg rows=4 maxlength=480 placeholder="Ex. : Réunion des parents samedi à 9 h. — ${esc(S.school.name)}"></textarea></label>
<small id=sg-n></small><div id=sg-lots class=col></div><form method=dialog><button class=ghost>Fermer</button></form>`);
        const to = d.querySelector('#sg-to'), msg = d.querySelector('#sg-msg'), lots = d.querySelector('#sg-lots');
        const draw = () => {
            const v = to.value;
            const st = S.stu.filter(s => v === 'all' ? true : v === 'due' ? Number(s.balance_cdf || 0) > 0 : s.class_id === v);
            const nums = [...new Set(st.map(s => cleanNum(s.parent_phone)).filter(Boolean))];
            d.querySelector('#sg-n').textContent = nums.length + ' numéro(s) · ' + Math.ceil(nums.length / 10) + ' lot(s)';
            const L = []; for (let i = 0; i < nums.length; i += 10) L.push(nums.slice(i, i + 10));
            lots.innerHTML = L.map((l, i) => `<a class="btn ghost" data-lot="${i}" href="${smsHref(l, msg.value)}" style="text-align:center;text-decoration:none">Lot ${i + 1} · ${l.length} numéro(s)</a>`).join('') || '<p class=empty>Aucun numéro de parent.</p>';
            lots.querySelectorAll('[data-lot]').forEach(a => a.onclick = e => { if (!msg.value.trim()) { e.preventDefault(); return toast('Écrivez d’abord le message.'); } setTimeout(() => { a.textContent = '✓ ' + a.textContent.replace(/^✓ /, ''); a.style.opacity = .6; }, 400); });
        };
        to.onchange = draw; msg.oninput = draw; draw();
    };

    /* ================= 3) CANTINE, TRANSPORT… ================= */
    const curM = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);
    window.oreaServices = async function (box) {
        if (!fin()) { box.innerHTML = '<p class=empty>Réservé au chef d’établissement.</p>'; return; }
        box.innerHTML = '<div class=sk></div>';
        const [{ data: sv, error }, { data: mb }] = await Promise.all([
            db.from('fee_services').select('*').eq('school_id', S.school.id).order('name'),
            db.from('fee_service_members').select('service_id,student_id').eq('school_id', S.school.id)
        ]);
        if (error) { box.innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
        const n = {}; (mb || []).forEach(m => n[m.service_id] = (n[m.service_id] || 0) + 1);
        let h = `<small style="display:block;margin-bottom:8px">Un service (cantine, transport…) est payé chaque mois par les élèves inscrits. Au début de chaque mois, ORÉA ajoute automatiquement le montant dans « Autres frais » de chaque inscrit : il s’encaisse et apparaît chez les parents comme les autres frais.</small><button type=button id=sv-new>+ Nouveau service</button>`;
        h += (sv || []).length ? sv.map(x => `<div class="card col" style="${x.active ? '' : 'opacity:.6'}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(x.name)}</b><b>${nf(x.amount, x.currency === 'CDF' ? 0 : 2)} ${SYM[x.currency] || x.currency} / mois</b></div><small>${n[x.id] || 0} élève(s) inscrit(s)${x.active ? '' : ' · arrêté'}</small>
<div class=row style="flex-wrap:wrap"><button type=button class=ghost data-mb="${x.id}" style="width:auto;flex:1">👥 Inscrits</button><button type=button class=ghost data-bill="${x.id}" style="width:auto;flex:1">Facturer ${new Date().toLocaleDateString('fr-FR', { month: 'long' })}</button><button type=button class=ghost data-on="${x.id}" style="width:auto;flex:1">${x.active ? 'Arrêter' : 'Reprendre'}</button></div></div>`).join('') : '<p class=empty>Aucun service.</p>';
        box.innerHTML = h;
        const again = () => window.oreaServices(box);
        box.querySelector('#sv-new').onclick = () => ask('Nouveau service', [{ n: 'name', l: 'Nom (ex. : Cantine, Transport)', v: '' }, { n: 'amount', l: 'Montant par mois', t: 'number', v: '' }, { n: 'cur', l: 'Devise', o: CUR.map(c => [c, c]), v: 'CDF' }], async v => {
            const { error: e } = await db.from('fee_services').insert({ school_id: S.school.id, name: v.name.trim(), amount: +v.amount, currency: v.cur, year: S.year || '' });
            if (e) return toast(e.message); toast('Service créé ✓'); again();
        });
        box.querySelectorAll('[data-on]').forEach(b => b.onclick = async () => { const x = sv.find(y => y.id === b.dataset.on); const { error: e } = await db.from('fee_services').update({ active: !x.active }).eq('id', x.id); if (e) return toast(e.message); again(); });
        box.querySelectorAll('[data-bill]').forEach(b => b.onclick = async () => {
            b.disabled = true; const { data, error: e } = await db.rpc('v91_bill_service', { p_service: b.dataset.bill, p_month: curM() }); b.disabled = false;
            if (e) return toast(e.message); toast((data || 0) + ' ligne(s) ajoutée(s) dans Autres frais' + (data ? '' : ' (déjà facturé ce mois)')); if (data && typeof load === 'function') load();
        });
        box.querySelectorAll('[data-mb]').forEach(b => b.onclick = () => members(sv.find(y => y.id === b.dataset.mb), (mb || []).filter(m => m.service_id === b.dataset.mb).map(m => m.student_id), again));
    };
    function members(x, ids, after) {
        const on = new Set(ids), cls = yc();
        let cl = cls[0] ? cls[0].id : null;
        const d = show(`<h3>Inscrits · ${esc(x.name)}</h3><select id=sm-c>${cls.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><div id=sm-l style="max-height:55vh;overflow-y:auto"></div><button type=button class=ghost id=sm-x style="margin-top:10px">Fermer</button>`);
        const draw = () => {
            const st = S.stu.filter(s => s.class_id === cl);
            d.querySelector('#sm-l').innerHTML = st.length ? st.map(s => `<label class=card style="padding:10px;margin:5px 0;flex-direction:row;justify-content:flex-start;gap:10px;text-transform:none;font-size:14px;color:var(--tx)"><input type=checkbox data-st="${s.id}" ${on.has(s.id) ? 'checked' : ''} style="width:auto;margin:0;transform:scale(1.3)">${esc(s.name)}</label>`).join('') : '<p class=empty>Aucun élève.</p>';
            d.querySelectorAll('[data-st]').forEach(cb => cb.onchange = async () => {
                const r = cb.checked ? await db.from('fee_service_members').insert({ service_id: x.id, student_id: cb.dataset.st, school_id: S.school.id })
                    : await db.from('fee_service_members').delete().match({ service_id: x.id, student_id: cb.dataset.st });
                if (r.error) { cb.checked = !cb.checked; return toast(r.error.message); }
                cb.checked ? on.add(cb.dataset.st) : on.delete(cb.dataset.st);
            });
        };
        d.querySelector('#sm-c').onchange = e => { cl = e.target.value; draw(); };
        d.querySelector('#sm-x').onclick = () => { d.close(); after(); };
        draw();
    }
})();
