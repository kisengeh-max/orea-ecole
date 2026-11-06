/* =====================================================================
   ORÉA École v81 — enafep.js : 🎓 ENAFEP (fin du primaire)
   ÉCOLE (écoles primaires et complexes, classes de 6e primaire)
     - Finalistes : importés depuis les classes de 6e, ajout / retrait
     - Date de l'examen + compte à rebours
     - Épreuves blanches : saisie des points, progression, alerte < 50 %
     - Résultats officiels : réussi / échoué (+ %), taux de réussite, F / G
     - Tableau d'honneur (image) · Révision avec Génie en Herbe (primaire)
   PARENT : compte à rebours, épreuves blanches, résultat de son enfant.
   Tables : enafep_settings, enafep_candidates, enafep_mocks (étape 16).
   ===================================================================== */
(function () {
    'use strict';
    if (typeof db === 'undefined') return;
    const PARENT = !!document.getElementById('pmain');
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const say = m => { try { if (typeof toast === 'function') return toast(m); } catch (_) { } alert(m); };
    const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Kinshasa' });
    const dfr = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '—';
    const daysTo = d => d ? Math.round((new Date(d + 'T00:00') - new Date(today() + 'T00:00')) / 864e5) : null;
    const countdown = d => { const n = daysTo(d); return n == null ? 'Date de l’examen non fixée' : n > 1 ? `J-${n} · examen le ${dfr(d)}` : n === 1 ? `Demain · examen le ${dfr(d)}` : n === 0 ? 'C’est aujourd’hui ! Bonne chance 🍀' : `Examen passé (${dfr(d)})`; };
    const pc = (s, m) => m > 0 ? Math.round(1000 * s / m) / 10 : null;
    const P = v => v == null ? '—' : String(v).replace('.', ',') + ' %';
    function revise() {
        try { const k = 'orea_fam_cfg', c = JSON.parse(localStorage.getItem(k) || '{}'); c.niv = 'primaire'; localStorage.setItem(k, JSON.stringify(c)); } catch (_) { }
        if (typeof oreaFamille === 'function') oreaFamille(); else say('Génie en Herbe n’est pas chargé.');
    }
    window.enafepRevise = revise;

    /* =================================================================
       ÉCOLE
       ================================================================= */
    if (!PARENT) {
        if (typeof S === 'undefined') return;
        const isDir = () => S.me && S.me.role === 'directeur';
        const is6 = c => (c.level || 'secondaire') === 'primaire' && /^\s*6/.test(c.name || '');
        const visible = () => (S.classes || []).some(is6) || ['primaire', 'complexe'].includes((S.school && S.school.school_type) || '');
        const stu = id => (S.stu || []).find(x => x.id === id);
        const D = { cand: [], mocks: [], set: null };

        async function load() {
            const y = S.year || '';
            const [c, m, st] = await Promise.all([
                db.from('enafep_candidates').select('*').eq('school_id', S.school.id).eq('year', y),
                db.from('enafep_mocks').select('*').eq('school_id', S.school.id).eq('year', y).order('day'),
                db.from('enafep_settings').select('*').eq('school_id', S.school.id).eq('year', y).maybeSingle()
            ]);
            if (c.error) throw c.error;
            D.cand = (c.data || []).filter(x => stu(x.student_id)).sort((a, b) => stu(a.student_id).name.localeCompare(stu(b.student_id).name, 'fr'));
            D.mocks = m.data || []; D.set = st.data || null;
        }
        const avgOf = sid => { const L = D.mocks.filter(x => x.student_id === sid); return L.length ? pc(L.reduce((a, x) => a + Number(x.score), 0), L.reduce((a, x) => a + Number(x.max_score), 0)) : null; };

        window.vEnafep = async function () {
            const back = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>`;
            $('#main').innerHTML = back + '<h3>🎓 ENAFEP</h3>' + (typeof SK !== 'undefined' ? SK : '');
            try { await load(); } catch (e) { $('#main').innerHTML = back + `<p class=empty>${E(e.message)}</p>`; return; }
            const known = D.cand.filter(c => c.resultat), ok = known.filter(c => c.resultat === 'reussi');
            const sx = (L, s) => L.filter(c => (stu(c.student_id) || {}).sexe === s).length;
            const labels = [...new Set(D.mocks.map(m => m.label))];
            let h = back + `<h3>🎓 ENAFEP · ${E(S.year || '')}</h3>`;
            h += `<div class="card col" style="border-color:var(--gold)"><b>⏳ ${E(countdown(D.set && D.set.exam_date))}</b>${isDir() ? '<button class=ghost onclick="enafepDate()">Régler la date de l’examen</button>' : ''}</div>`;
            h += `<div class=row><button class=ghost onclick="enafepRevise()">📚 Réviser (Génie en Herbe)</button>${D.cand.length ? '<button class=ghost onclick="enafepMock()">➕ Épreuve blanche</button>' : ''}</div>`;
            if (known.length) h += `<div class="card col"><b>Résultats officiels</b><span>${ok.length} réussi(s) sur ${known.length} · <b>${P(pc(ok.length, known.length))}</b></span><small>Filles : ${sx(ok, 'F')} / ${sx(known, 'F')} · Garçons : ${sx(ok, 'M')} / ${sx(known, 'M')}</small>${ok.length ? '<button class=ghost onclick="enafepHonneur()">🏆 Tableau d’honneur (image)</button>' : ''}</div>`;
            if (labels.length) h += `<div class="card col"><b>Épreuves blanches</b>${labels.map(l => { const L = D.mocks.filter(m => m.label === l); return `<div style="display:flex;justify-content:space-between"><span>${E(l)} <small>${dfr(L[0].day)}</small></span><b>${P(pc(L.reduce((a, x) => a + Number(x.score), 0), L.reduce((a, x) => a + Number(x.max_score), 0)))}</b></div>`; }).join('')}</div>`;
            h += `<h3>Finalistes (${D.cand.length})</h3>`;
            if (!D.cand.length) h += `<p class=empty data-ic="🎓">Aucun finaliste pour ${E(S.year || 'cette année')}.</p>`;
            h += D.cand.map(c => { const s = stu(c.student_id), a = avgOf(c.student_id);
                return `<div class=card ${isDir() ? `onclick="enafepEdit('${c.id}')" style="cursor:pointer"` : ''}><span><b>${E(s.name)}</b><br><small>${E([c.numero && 'N° ' + c.numero, c.centre].filter(Boolean).join(' · ') || ((S.classes || []).find(k => k.id === s.class_id) || {}).name || '')}</small></span><span style="text-align:right"><small class="${a != null && a < 50 ? 'due' : ''}">${a == null ? '' : (a < 50 ? '⚠️ ' : '') + 'Blanc : ' + P(a)}</small><br>${c.resultat ? `<b class="${c.resultat === 'reussi' ? 'ok' : 'due'}">${c.resultat === 'reussi' ? '✓ Réussi' : '✗ Échoué'}${c.pourcentage != null ? ' · ' + P(c.pourcentage) : ''}</b>` : ''}</span></div>`; }).join('');
            if (isDir()) h += `<div class=row style="margin-top:8px"><button onclick="enafepImport()">⬇ Importer les élèves de 6e</button><button class=ghost onclick="enafepAdd()">+ Ajouter un élève</button></div>`;
            $('#main').innerHTML = h;
        };

        window.enafepDate = () => ask('Date de l’examen ENAFEP', [{ n: 'd', l: 'Date', t: 'date', v: (D.set && D.set.exam_date) || '' }], async v => {
            const { error } = await db.from('enafep_settings').upsert({ school_id: S.school.id, year: S.year || '', exam_date: v.d || null }, { onConflict: 'school_id,year' });
            if (error) throw error; $('#dlg').close?.(); vEnafep();
        });

        window.enafepImport = async function () {
            const cls = (S.classes || []).filter(c => is6(c) && (typeof cy !== 'function' || cy(c) === S.year));
            const L = (S.stu || []).filter(s => cls.some(c => c.id === s.class_id) && !D.cand.some(x => x.student_id === s.id));
            if (!cls.length) return say('Aucune classe de 6e primaire pour cette année (le nom de la classe doit commencer par « 6 »).');
            if (!L.length) return say('Tous les élèves de 6e sont déjà dans la liste.');
            if (!confirm(`Ajouter ${L.length} élève(s) de ${cls.map(c => c.name).join(', ')} comme finalistes ?`)) return;
            const { error } = await db.from('enafep_candidates').upsert(L.map(s => ({ student_id: s.id, year: S.year || '' })), { onConflict: 'student_id,year', ignoreDuplicates: true });
            if (error) return say(error.message);
            say(L.length + ' finaliste(s) ajouté(s) ✓'); vEnafep();
        };
        window.enafepAdd = function () {
            const L = (S.stu || []).filter(s => { const c = (S.classes || []).find(k => k.id === s.class_id); return c && (c.level || 'secondaire') === 'primaire' && (typeof cy !== 'function' || cy(c) === S.year) && !D.cand.some(x => x.student_id === s.id); }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            if (!L.length) return say('Aucun autre élève du primaire à ajouter.');
            ask('Ajouter un finaliste', [{ n: 's', l: 'Élève', o: L.map(s => [s.id, E(s.name)]) }], async v => {
                const { error } = await db.from('enafep_candidates').insert({ student_id: v.s, year: S.year || '' });
                if (error) throw error; $('#dlg').close?.(); vEnafep();
            });
        };
        window.enafepEdit = function (id) {
            const c = D.cand.find(x => x.id === id); if (!c) return;
            const s = stu(c.student_id);
            const d = show(`<h3>🎓 ${E(s.name)}</h3><div class=col><label>N° de candidat<input id=en1 value="${E(c.numero || '')}"></label><label>Centre d’examen<input id=en2 value="${E(c.centre || '')}"></label><label>Résultat officiel<select id=en3><option value="">— pas encore connu —</option><option value="reussi" ${c.resultat === 'reussi' ? 'selected' : ''}>Réussi</option><option value="echoue" ${c.resultat === 'echoue' ? 'selected' : ''}>Échoué</option></select></label><label>Pourcentage (facultatif)<input id=en4 type=number min=0 max=100 step=0.1 value="${c.pourcentage ?? ''}"></label><small>Quand le résultat est saisi, les parents reçoivent une notification.</small><div class=row><button class=ghost id=enx>Retirer de la liste</button><button id=ens>Enregistrer</button></div></div>`);
            d.querySelector('#ens').onclick = async () => {
                const p = d.querySelector('#en4').value;
                const { error } = await db.from('enafep_candidates').update({ numero: d.querySelector('#en1').value.trim() || null, centre: d.querySelector('#en2').value.trim() || null, resultat: d.querySelector('#en3').value || null, pourcentage: p === '' ? null : Math.max(0, Math.min(100, +p)) }).eq('id', id);
                if (error) return say(error.message); d.close(); vEnafep();
            };
            d.querySelector('#enx').onclick = async () => {
                if (!confirm('Retirer ' + s.name + ' des finalistes ?')) return;
                const { error } = await db.from('enafep_candidates').delete().eq('id', id);
                if (error) return say(error.message); d.close(); vEnafep();
            };
        };
        window.enafepMock = function () {
            ask('Nouvelle épreuve blanche', [{ n: 'l', l: 'Nom (ex : Épreuve blanche n°1)', v: 'Épreuve blanche n°' + ([...new Set(D.mocks.map(m => m.label))].length + 1) }, { n: 'd', l: 'Date', t: 'date', v: today() }, { n: 'm', l: 'Noté sur', t: 'number', v: '100' }], async v => {
                const mx = +v.m > 0 ? +v.m : 100, L = D.cand.map(c => stu(c.student_id));
                await new Promise(ok => setTimeout(ok, 80));   // laisse le formulaire se fermer
                const d = show(`<h3>${E(v.l)}</h3><small>Points sur ${mx} · laisse vide si l’élève était absent</small><div style="max-height:60vh;overflow-y:auto">${L.map(s => `<div class=card><span>${E(s.name)}</span><input type=number min=0 max=${mx} step=0.5 data-sc="${s.id}" style="width:90px;margin:0"></div>`).join('')}</div><div class=row><button class=ghost id=mkx>Annuler</button><button id=mks>Enregistrer</button></div>`);
                d.querySelector('#mkx').onclick = () => d.close();
                d.querySelector('#mks').onclick = async () => {
                    const rows = [...d.querySelectorAll('[data-sc]')].filter(i => i.value !== '').map(i => ({ student_id: i.dataset.sc, year: S.year || '', label: v.l.trim(), day: v.d || today(), score: Math.min(mx, Math.max(0, +i.value)), max_score: mx }));
                    if (!rows.length) return say('Aucune note saisie.');
                    const { error } = await db.from('enafep_mocks').upsert(rows, { onConflict: 'student_id,year,label' });
                    if (error) return say(error.message);
                    d.close(); say(rows.length + ' note(s) enregistrée(s) ✓'); vEnafep();
                };
            });
        };
        window.enafepHonneur = async function () {
            const L = D.cand.filter(c => c.resultat === 'reussi').map(c => ({ n: stu(c.student_id).name, p: c.pourcentage })).sort((a, b) => (b.p ?? -1) - (a.p ?? -1) || a.n.localeCompare(b.n, 'fr'));
            const W = 720, H = 230 + L.length * 40, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
            x.fillStyle = '#fffdf6'; x.fillRect(0, 0, W, H); x.strokeStyle = '#b08a30'; x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28);
            x.textAlign = 'center'; x.fillStyle = '#8a6a1f'; x.font = 'bold 30px Georgia,serif'; x.fillText('🏆 Tableau d’honneur ENAFEP', W / 2, 70);
            x.fillStyle = '#333'; x.font = '18px sans-serif'; x.fillText(S.school.name + ' · ' + (S.year || ''), W / 2, 102);
            x.fillText(`${L.length} lauréat(s)`, W / 2, 130);
            x.textAlign = 'left'; x.font = '20px sans-serif';
            L.forEach((r, i) => { const y = 180 + i * 40; x.fillStyle = i < 3 ? '#8a6a1f' : '#111'; x.fillText((i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : (i + 1) + '. ') + r.n, 60, y); if (r.p != null) { x.textAlign = 'right'; x.fillText(String(r.p).replace('.', ',') + ' %', W - 60, y); x.textAlign = 'left'; } });
            x.fillStyle = '#888'; x.font = '13px sans-serif'; x.fillText('ORÉA École', 30, H - 26);
            cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'tableau-honneur-enafep.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); say('Image enregistrée dans Téléchargements'); }, 'image/png');
        };

        // Menu → Pédagogie : « ENAFEP » (écoles avec 6e primaire)
        const oMenu = window.vMenu;
        if (typeof oMenu === 'function' && !oMenu.__en) {
            window.vMenu = function () {
                const r = oMenu.apply(this, arguments);
                try {
                    const main = document.getElementById('main'), t = main && main.querySelector('[onclick*="devoirs"]');
                    if (t && visible() && !main.querySelector('[onclick*="menuGo(\'enafep\')"]')) {
                        const d = document.createElement('div'); d.innerHTML = menuCard('calendrier', 'ENAFEP', 'Finalistes · Épreuves blanches · Résultats', "menuGo('enafep')"); t.after(d.firstElementChild);
                    }
                } catch (_) { }
                return r;
            };
            window.vMenu.__en = true;
        }
        return;
    }

    /* =================================================================
       PARENT : section ENAFEP dans la fiche de l'enfant finaliste
       ================================================================= */
    const oDetail = window.childDetail;
    if (typeof oDetail === 'function' && !oDetail.__en) {
        window.childDetail = async function (id) {
            const r = await oDetail.apply(this, arguments);
            try {
                const { data: c } = await db.from('enafep_candidates').select('*').eq('student_id', id).order('year', { ascending: false }).limit(1).maybeSingle();
                if (!c) return r;
                const [{ data: m }, { data: st }] = await Promise.all([
                    db.from('enafep_mocks').select('*').eq('student_id', id).eq('year', c.year).order('day'),
                    db.from('enafep_settings').select('exam_date').eq('school_id', c.school_id).eq('year', c.year).maybeSingle()
                ]);
                const main = document.getElementById('pmain'); if (!main || main.querySelector('#en-sec')) return r;
                const h = `<div class=p-sec id=en-sec><h4>🎓 ENAFEP ${E(c.year)}</h4><div class=p-row><b>⏳ ${E(countdown(st && st.exam_date))}</b></div>`
                    + (c.resultat ? `<div class=p-row><span>Résultat officiel</span><b class="${c.resultat === 'reussi' ? 'p-ok' : 'p-due'}">${c.resultat === 'reussi' ? '✓ Réussi' : '✗ Échoué'}${c.pourcentage != null ? ' · ' + P(c.pourcentage) : ''}</b></div>` : '')
                    + (m || []).map(x => { const p = pc(+x.score, +x.max_score); return `<div class=p-row><span>${E(x.label)} <small>${dfr(x.day)}</small></span><b class="${p < 50 ? 'p-due' : 'p-ok'}">${x.score} / ${x.max_score} · ${P(p)}</b></div>`; }).join('')
                    + `<div class=p-row><button style="padding:10px 12px;border-radius:10px;border:1px solid var(--gold);background:transparent;color:var(--gold)" onclick="enafepRevise()">📚 Réviser avec Génie en Herbe</button></div></div>`;
                const hello = main.querySelector('.p-hello');
                hello ? hello.insertAdjacentHTML('afterend', h) : main.insertAdjacentHTML('afterbegin', h);
            } catch (e) { console.warn('ENAFEP parent :', e); }
            return r;
        };
        window.childDetail.__en = true;
    }
})();
