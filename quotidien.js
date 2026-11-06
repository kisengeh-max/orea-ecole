/* =====================================================================
   ORÉA École v75 — quotidien.js (étape C : la vie de tous les jours)
   Chargé par index.html (école) ET parent.html (parent).
   ÉCOLE
     - Fiche élève : 🩺 Santé (tous) · 🚸 Personnes autorisées (maternelle, primaire)
                     · 📒 Cahier de liaison (maternelle) · alerte allergie
     - Vue classe : « Sorties » (maternelle, primaire) · « Liaison » (maternelle)
   PARENT
     - Fiche enfant : santé (modifiable), personnes autorisées (ajout / retrait),
       derniers mots du cahier de liaison, dernières sorties.
   Tables : student_health, pickup_people, pickups, liaison_notes (étape 11).
   À charger APRÈS app.js (école) / APRÈS parent.js (parent).
   ===================================================================== */
(function () {
    'use strict';
    if (typeof db === 'undefined') return;
    const PARENT = !!document.getElementById('pmain');
    const q = s => document.querySelector(s);
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const say = m => { try { if (typeof toast === 'function') return toast(m); } catch (_) { } alert(m); };
    const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Kinshasa' });
    const dfr = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '—';
    const hm = t => t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

    const HF = [
        ['allergies', 'Allergies (aliments, médicaments…)', 'textarea'],
        ['conditions', 'Maladies connues (asthme, drépanocytose…)', 'textarea'],
        ['treatments', 'Traitement en cours', 'textarea'],
        ['blood_group', 'Groupe sanguin', 'text'],
        ['vaccines', 'Vaccins', 'textarea'],
        ['doctor', 'Médecin ou centre de santé', 'text'],
        ['emergency_name', 'Personne à prévenir en urgence', 'text'],
        ['emergency_phone', 'Téléphone en urgence', 'tel'],
        ['notes', 'Autres informations', 'textarea']
    ];
    const LIA = {
        meal: ['Repas', [['bien', '🍽️ Bien mangé'], ['peu', '🍽️ Peu mangé'], ['rien', '🍽️ Rien mangé']]],
        nap: ['Sieste', [['oui', '😴 A dormi'], ['non', '😴 Pas dormi']]],
        mood: ['Humeur', [['content', '😊 Content'], ['calme', '🙂 Calme'], ['triste', '😢 Triste'], ['agite', '😣 Agité']]],
        hygiene: ['Propreté', [['ok', '🚽 RAS'], ['incident', '🚽 Petit accident']]]
    };
    const liaTxt = n => Object.keys(LIA).map(k => { const o = LIA[k][1].find(x => x[0] === n[k]); return o ? o[1] : ''; }).filter(Boolean).join(' · ');
    const healthLines = h => HF.filter(f => h && String(h[f[0]] || '').trim()).map(f => `<b>${E(f[1])}</b> : ${E(h[f[0]])}`);

    /* =================================================================
       ÉCOLE
       ================================================================= */
    if (!PARENT) {
        const isDir = () => typeof S !== 'undefined' && S.me && S.me.role === 'directeur';
        const lvl = cid => (((typeof S !== 'undefined' && S.classes) || []).find(c => c.id === cid) || {}).level || 'secondaire';
        const stu = id => (S.stu || []).find(x => x.id === id);
        const openDlg = () => document.querySelector('dialog[open]');

        // ----- Fiche élève : boutons + alerte allergie -----
        const origMenu = window.menu;
        if (typeof origMenu === 'function' && !origMenu.__q) {
            window.menu = function (id) {
                const r = origMenu.apply(this, arguments);
                try {
                    const s = stu(id), d = openDlg(); if (!s || !d) return r;
                    const L = lvl(s.class_id), col = d.querySelector('.col'), close = d.querySelector('#m3');
                    if (col) {
                        const add = (txt, fn) => { const b = document.createElement('button'); b.className = 'ghost'; b.type = 'button'; b.textContent = txt; b.onclick = fn; col.insertBefore(b, close || null); };
                        add('🩺 Santé', () => healthDlg(id));
                        if (L === 'maternelle' || L === 'primaire') add('🚸 Personnes autorisées', () => peopleDlg(id));
                        if (L === 'maternelle') add('📒 Cahier de liaison', () => liaisonForm(id, () => menu(id)));
                    }
                    db.from('student_health').select('allergies,conditions').eq('student_id', id).maybeSingle().then(({ data }) => {
                        if (!data || !d.open) return;
                        const a = [data.allergies, data.conditions].filter(x => String(x || '').trim());
                        if (a.length) d.querySelector('h3').insertAdjacentHTML('afterend', `<div class="card col" style="border-color:var(--bad)"><b class=due>⚠️ Santé</b><small>${a.map(E).join(' · ')}</small></div>`);
                    }, () => { });
                } catch (e) { console.warn('quotidien menu :', e); }
                return r;
            };
            window.menu.__q = true;
        }

        // ----- Vue classe : boutons Sorties / Liaison -----
        const origBtns = window.classBtns;
        if (typeof origBtns === 'function' && !origBtns.__q) {
            window.classBtns = function () {
                let h = origBtns.apply(this, arguments);
                try {
                    const L = lvl(S.cls), B = [];
                    if (L === 'maternelle' || L === 'primaire') B.push(['qSorties()', '🚸 Sorties']);
                    if (L === 'maternelle') B.push(['qLiaison()', '📒 Liaison']);
                    if (B.length) h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px">${B.map(b => `<button class=ghost style="width:auto" onclick="${b[0]}">${b[1]}</button>`).join('')}</div>`;
                } catch (_) { }
                return h;
            };
            window.classBtns.__q = true;
        }

        // ----- Santé -----
        async function healthDlg(id) {
            const s = stu(id); if (!s) return;
            const { data: h, error } = await db.from('student_health').select('*').eq('student_id', id).maybeSingle();
            if (error) return say(error.message);
            if (!isDir()) {
                const L = healthLines(h);
                show(`<h3>🩺 Santé · ${E(s.name)}</h3><div class="card col">${L.length ? L.map(x => `<small>${x}</small>`).join('') : '<small>Aucune information de santé.</small>'}</div><small>Seuls la direction et les parents peuvent modifier cette fiche.</small><button class=ghost onclick="this.closest('dialog').close()">Fermer</button>`);
                return;
            }
            const d = show(`<h3>🩺 Santé · ${E(s.name)}</h3><div class=col>${HF.map(f => `<label>${E(f[1])}${f[2] === 'textarea' ? `<textarea data-h="${f[0]}" rows=2 style="width:100%">${E(h && h[f[0]])}</textarea>` : `<input data-h="${f[0]}" type=${f[2]} value="${E(h && h[f[0]])}">`}</label>`).join('')}<small>Les parents peuvent aussi compléter cette fiche depuis leur espace.</small><div class=row><button class=ghost id=qhx>Fermer</button><button id=qhs>Enregistrer</button></div></div>`);
            d.querySelector('#qhx').onclick = () => d.close();
            d.querySelector('#qhs').onclick = async () => {
                const row = { student_id: id };
                d.querySelectorAll('[data-h]').forEach(x => row[x.dataset.h] = x.value.trim() || null);
                const { error: e2 } = await db.from('student_health').upsert(row, { onConflict: 'student_id' });
                if (e2) return say(e2.message);
                say('Fiche santé enregistrée ✓'); d.close();
            };
        }

        // ----- Personnes autorisées -----
        async function peopleDlg(id) {
            const s = stu(id); if (!s) return;
            const { data, error } = await db.from('pickup_people').select('*').eq('student_id', id).order('created_at');
            if (error) return say(error.message);
            const L = data || [];
            const d = show(`<h3>🚸 Personnes autorisées · ${E(s.name)}</h3><small>Seules ces personnes peuvent récupérer l’enfant. Les parents peuvent aussi en ajouter.</small>`
                + (L.length ? L.map(p => `<div class="card col"><b>${E(p.full_name)}</b><small>${E([p.relation, p.phone, p.id_doc && ('Pièce : ' + p.id_doc)].filter(Boolean).join(' · '))}</small>${isDir() ? `<button class=ghost data-del="${p.id}">Retirer</button>` : ''}</div>`).join('') : '<p class=empty>Aucune personne inscrite.</p>')
                + `<div class=row>${isDir() ? '<button id=qpa>+ Ajouter</button>' : ''}<button class=ghost id=qpx>Fermer</button></div>`);
            d.querySelector('#qpx').onclick = () => d.close();
            d.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
                if (!confirm('Retirer cette personne ?')) return;
                const { error: e2 } = await db.from('pickup_people').delete().eq('id', b.dataset.del);
                if (e2) return say(e2.message); peopleDlg(id);
            });
            const a = d.querySelector('#qpa');
            if (a) a.onclick = () => ask('Nouvelle personne autorisée', [{ n: 'n', l: 'Nom complet' }, { n: 'r', l: 'Lien avec l’enfant (mère, oncle…)', r: false }, { n: 'p', l: 'Téléphone', t: 'tel', r: false }, { n: 'i', l: 'N° de pièce d’identité', r: false }], async v => {
                const { error: e3 } = await db.from('pickup_people').insert({ student_id: id, full_name: v.n.trim(), relation: v.r.trim() || null, phone: v.p.trim() || null, id_doc: v.i.trim() || null });
                if (e3) throw e3; say('Personne ajoutée ✓'); peopleDlg(id);
            });
        }

        // ----- Sorties de la classe -----
        window.qSorties = async function () {
            const cls = (S.classes || []).find(c => c.id === S.cls); if (!cls) return;
            const L = (S.stu || []).filter(s => s.class_id === cls.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            const ids = L.map(s => s.id);
            if (!ids.length) return say('Aucun élève dans cette classe.');
            const [{ data: pk, error }, { data: pp }] = await Promise.all([
                db.from('pickups').select('*').in('student_id', ids).eq('day', today()),
                db.from('pickup_people').select('id,student_id,full_name,relation').in('student_id', ids)
            ]);
            if (error) return say(error.message);
            const done = {}; (pk || []).forEach(p => done[p.student_id] = p);
            const d = show(`<h3>🚸 Sorties · ${E(cls.name)}</h3><small>${dfr(today())} · ${Object.keys(done).length} / ${L.length} sorti(s)</small><div style="max-height:60vh;overflow-y:auto">${L.map(s => {
                const p = done[s.id];
                return `<div class=card><span><b>${E(s.name)}</b>${p ? `<br><small class="${p.authorized ? 'ok' : 'due'}">${p.authorized ? '✓' : '⚠️'} ${hm(p.at)} · ${E(p.picked_by)}</small>` : ''}</span>${p ? '' : `<button class=ghost style="width:auto" data-s="${s.id}">Sortie</button>`}</div>`;
            }).join('')}</div><button class=ghost id=qsx>Fermer</button>`);
            d.querySelector('#qsx').onclick = () => d.close();
            d.querySelectorAll('[data-s]').forEach(b => b.onclick = () => pickDlg(b.dataset.s, (pp || []).filter(x => x.student_id === b.dataset.s)));
        };

        function pickDlg(sid, people) {
            const s = stu(sid); if (!s) return;
            const d = show(`<h3>Qui récupère ${E(s.name)} ?</h3><div class=col>${people.length ? people.map(p => `<button data-p="${p.id}">${E(p.full_name)}${p.relation ? ' · ' + E(p.relation) : ''}</button>`).join('') : '<small class=due>Aucune personne autorisée n’est inscrite pour cet enfant.</small>'}<label>Autre personne (non inscrite)<input id=qon placeholder="Nom de la personne"></label><input id=qnt placeholder="Remarque (facultatif)"><div class=row><button class=ghost id=qpx>Annuler</button><button class=ghost id=qok>Valider l’autre personne</button></div></div>`);
            const save = async row => {
                const { error } = await db.from('pickups').insert(Object.assign({ student_id: sid, note: d.querySelector('#qnt').value.trim() || null }, row));
                if (error) return say(error.message);
                say(row.authorized ? 'Sortie enregistrée ✓ Parents prévenus' : 'Sortie enregistrée ⚠️ Parents et direction prévenus');
                qSorties();
            };
            d.querySelector('#qpx').onclick = () => qSorties();
            d.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const p = people.find(x => x.id === b.dataset.p); save({ person_id: p.id, picked_by: p.full_name, authorized: true }); });
            d.querySelector('#qok').onclick = () => {
                const n = d.querySelector('#qon').value.trim();
                if (!n) return say('Écris le nom de la personne.');
                if (!confirm(n + ' n’est pas sur la liste des personnes autorisées.\nLes parents et la direction seront prévenus. Continuer ?')) return;
                save({ picked_by: n, authorized: false });
            };
        }

        // ----- Cahier de liaison de la classe -----
        window.qLiaison = async function () {
            const cls = (S.classes || []).find(c => c.id === S.cls); if (!cls) return;
            const L = (S.stu || []).filter(s => s.class_id === cls.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            if (!L.length) return say('Aucun élève dans cette classe.');
            const { data, error } = await db.from('liaison_notes').select('*').in('student_id', L.map(s => s.id)).eq('day', today());
            if (error) return say(error.message);
            const by = {}; (data || []).forEach(n => by[n.student_id] = n);
            const d = show(`<h3>📒 Cahier de liaison · ${E(cls.name)}</h3><small>${dfr(today())} · ${Object.keys(by).length} / ${L.length} rempli(s). Les parents sont prévenus au premier enregistrement.</small><div style="max-height:60vh;overflow-y:auto">${L.map(s => `<div class=card data-l="${s.id}" style="cursor:pointer"><span><b>${E(s.name)}</b>${by[s.id] ? `<br><small class=ok>✓ ${E(liaTxt(by[s.id]) || 'Mot écrit')}</small>` : ''}</span><b>›</b></div>`).join('')}</div><button class=ghost id=qlx>Fermer</button>`);
            d.querySelector('#qlx').onclick = () => d.close();
            d.querySelectorAll('[data-l]').forEach(b => b.onclick = () => liaisonForm(b.dataset.l, qLiaison, by[b.dataset.l]));
        };

        async function liaisonForm(sid, back, cur) {
            const s = stu(sid); if (!s) return;
            if (cur === undefined) {
                const { data } = await db.from('liaison_notes').select('*').eq('student_id', sid).eq('day', today()).maybeSingle();
                cur = data || null;
            }
            const v = Object.assign({ meal: null, nap: null, mood: null, hygiene: null, note: '' }, cur || {});
            const d = show(`<h3>📒 ${E(s.name)}</h3><small>${dfr(today())}</small>${Object.keys(LIA).map(k => `<div class=menu-title>${LIA[k][0]}</div><div class=chips>${LIA[k][1].map(o => `<button type=button class="chip ${v[k] === o[0] ? 'on' : ''}" data-k="${k}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`).join('')}<label>Mot pour les parents<textarea id=qln rows=3 style="width:100%">${E(v.note)}</textarea></label><div class=row><button class=ghost id=qlb>Retour</button><button id=qls>Enregistrer</button></div>`);
            d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
                const k = b.dataset.k, on = v[k] !== b.dataset.v;
                v[k] = on ? b.dataset.v : null;
                d.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.classList.toggle('on', on && x === b));
            });
            d.querySelector('#qlb').onclick = () => back ? back() : d.close();
            d.querySelector('#qls').onclick = async () => {
                const row = { student_id: sid, day: today(), meal: v.meal, nap: v.nap, mood: v.mood, hygiene: v.hygiene, note: d.querySelector('#qln').value.trim() || null };
                const { error } = await db.from('liaison_notes').upsert(row, { onConflict: 'student_id,day' });
                if (error) return say(error.message);
                say('Cahier de liaison enregistré ✓');
                back ? back() : d.close();
            };
        }
        return;
    }

    /* =================================================================
       PARENT
       ================================================================= */
    function modal(html) {
        let m = document.getElementById('q-modal');
        if (m) m.remove();
        m = document.createElement('div');
        m.id = 'q-modal';
        m.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px';
        m.innerHTML = `<div style="background:var(--card,#fff);color:var(--tx,#111);border-radius:16px;padding:16px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto">${html}</div>`;
        m.onclick = e => { if (e.target === m) m.remove(); };
        document.body.appendChild(m);
        return m;
    }
    const BTN = 'padding:10px 12px;border-radius:10px;border:1px solid var(--gold);background:transparent;color:var(--gold)';
    const FLD = 'width:100%;box-sizing:border-box;margin:4px 0 10px;padding:10px;border-radius:10px;border:1px solid var(--line,#ccc);background:transparent;color:inherit;font:inherit';

    async function parentSections(id) {
        const [h, pp, ln, pk] = await Promise.all([
            db.from('student_health').select('*').eq('student_id', id).maybeSingle(),
            db.from('pickup_people').select('*').eq('student_id', id).order('created_at'),
            db.from('liaison_notes').select('*').eq('student_id', id).order('day', { ascending: false }).limit(7),
            db.from('pickups').select('*').eq('student_id', id).order('at', { ascending: false }).limit(7)
        ]);
        const H = h.data, PP = pp.data || [], LN = ln.data || [], PK = pk.data || [];
        const hl = healthLines(H);
        let s = `<div class=p-sec id=q-sec><h4>🩺 Santé</h4>${hl.length ? hl.map(x => `<div class=p-row><small>${x}</small></div>`).join('') : '<div class=p-row><small>Aucune information. Ajoutez les allergies et la personne à prévenir en urgence.</small></div>'}<div class=p-row><button style="${BTN}" onclick="qPHealth('${id}')">✏️ ${hl.length ? 'Modifier' : 'Remplir'} la fiche santé</button></div></div>`;
        s += `<div class=p-sec><h4>🚸 Personnes autorisées à récupérer l’enfant</h4>${PP.length ? PP.map(p => `<div class=p-row><span>${E(p.full_name)}<br><small>${E([p.relation, p.phone].filter(Boolean).join(' · '))}</small></span><button style="${BTN};padding:6px 10px" onclick="qPDel('${p.id}','${id}')">Retirer</button></div>`).join('') : '<div class=p-row><small>Personne n’est encore inscrit.</small></div>'}<div class=p-row><button style="${BTN}" onclick="qPAdd('${id}')">+ Ajouter une personne</button></div></div>`;
        if (LN.length) s += `<div class=p-sec><h4>📒 Cahier de liaison</h4>${LN.map(n => `<div class=p-row style="flex-direction:column;align-items:flex-start"><b>${dfr(n.day)}</b><small>${E(liaTxt(n))}</small>${n.note ? `<small>« ${E(n.note)} »</small>` : ''}</div>`).join('')}</div>`;
        if (PK.length) s += `<div class=p-sec><h4>🚪 Sorties</h4>${PK.map(p => `<div class=p-row><span>${dfr(p.day)} · ${hm(p.at)}</span><b class="${p.authorized ? 'p-ok' : 'p-due'}">${p.authorized ? '' : '⚠️ '}${E(p.picked_by)}</b></div>`).join('')}</div>`;
        return s;
    }

    const origDetail = window.childDetail;
    if (typeof origDetail === 'function' && !origDetail.__q) {
        window.childDetail = async function (id) {
            const r = await origDetail.apply(this, arguments);
            try {
                const html = await parentSections(id);
                const main = document.getElementById('pmain'); if (!main || document.getElementById('q-sec')) return r;
                const secs = [...main.querySelectorAll('.p-sec')];
                const att = secs.find(x => /Présences/.test(x.textContent));
                const anchor = att || main.querySelector('.p-hello');
                if (anchor) anchor.insertAdjacentHTML('afterend', html);
            } catch (e) { console.warn('quotidien parent :', e); }
            return r;
        };
        window.childDetail.__q = true;
    }

    window.qPHealth = async function (id) {
        const { data: h } = await db.from('student_health').select('*').eq('student_id', id).maybeSingle();
        const m = modal(`<h3 style="margin-top:0">🩺 Fiche santé</h3>${HF.map(f => `<label style="font-size:13px">${E(f[1])}${f[2] === 'textarea' ? `<textarea data-h="${f[0]}" rows=2 style="${FLD}">${E(h && h[f[0]])}</textarea>` : `<input data-h="${f[0]}" type=${f[2]} style="${FLD}" value="${E(h && h[f[0]])}">`}</label>`).join('')}<div style="display:flex;gap:8px"><button style="${BTN};flex:1" id=qhx>Annuler</button><button style="${BTN};flex:1;background:var(--gold);color:#1a1710" id=qhs>Enregistrer</button></div>`);
        m.querySelector('#qhx').onclick = () => m.remove();
        m.querySelector('#qhs').onclick = async () => {
            const row = { student_id: id };
            m.querySelectorAll('[data-h]').forEach(x => row[x.dataset.h] = x.value.trim() || null);
            const { error } = await db.from('student_health').upsert(row, { onConflict: 'student_id' });
            if (error) return say(error.message);
            m.remove(); say('Fiche santé enregistrée ✓'); childDetail(id);
        };
    };

    window.qPAdd = function (id) {
        const m = modal(`<h3 style="margin-top:0">🚸 Nouvelle personne autorisée</h3><label style="font-size:13px">Nom complet<input id=qa1 style="${FLD}"></label><label style="font-size:13px">Lien avec l’enfant (mère, oncle, chauffeur…)<input id=qa2 style="${FLD}"></label><label style="font-size:13px">Téléphone<input id=qa3 type=tel style="${FLD}"></label><label style="font-size:13px">N° de pièce d’identité (facultatif)<input id=qa4 style="${FLD}"></label><div style="display:flex;gap:8px"><button style="${BTN};flex:1" id=qax>Annuler</button><button style="${BTN};flex:1;background:var(--gold);color:#1a1710" id=qas>Ajouter</button></div>`);
        m.querySelector('#qax').onclick = () => m.remove();
        m.querySelector('#qas').onclick = async () => {
            const v = k => m.querySelector(k).value.trim();
            if (!v('#qa1')) return say('Écris le nom de la personne.');
            const { error } = await db.from('pickup_people').insert({ student_id: id, full_name: v('#qa1'), relation: v('#qa2') || null, phone: v('#qa3') || null, id_doc: v('#qa4') || null });
            if (error) return say(error.message);
            m.remove(); say('Personne ajoutée ✓'); childDetail(id);
        };
    };

    window.qPDel = async function (pid, id) {
        if (!confirm('Retirer cette personne de la liste ?')) return;
        const { error } = await db.from('pickup_people').delete().eq('id', pid);
        if (error) return say(error.message);
        childDetail(id);
    };
})();
