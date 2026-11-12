/* =====================================================================
   ORÉA École v89 — equipe.js (onglets Personnel / Dossiers / Parents, recherche, Secrétariat)
   v89 : onglet « Dossiers » (personnel avec ou sans compte, non enseignants, paie) → personnel.js
   Module de gestion de l'équipe (direction).
   - Le chef d'établissement (Préfet / Directeur) nomme : percepteurs, Directeur des études.
   - Le Directeur des études gère les cours, mais pas les nominations ni l'argent.
   - Nommer / Révoquer un Percepteur
   - Attribuer des cours à un enseignant
   - Interface "Mes cours" pour les enseignants
   ===================================================================== */
(function () {
    'use strict';

    const $ = s => document.querySelector(s);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nf = (n, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
    const fmt = n => nf(n / (S.school.rates[S.cur] || 1), S.cur === 'CDF' ? 0 : 2) + ' ' + SYM[S.cur];
    const tdy = () => new Date().toLocaleDateString('sv-SE');

    // Hook d'accroche
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__eq) return;
        const w = fn(o); w.__eq = true; window[name] = w;
    };

    // Équipe & Cours (v83) : deux onglets — Personnel / Parents — avec recherche
    const TEAM = { tab: 'staff', q: '', dq: '', pq: '', poff: 0, prows: [], ptotal: null, timer: null };
    window.team = async function (tab) {
        if (S.me.role !== 'directeur') return toast('Accès réservé à la direction.');
        if (tab) TEAM.tab = tab;
        if (TEAM.tab === 'dossiers' && (S.me.secretariat || typeof oreaDossiers !== 'function')) TEAM.tab = 'staff';
        const FIN = typeof fin === 'function' ? fin() : (!S.me.etudes && !S.me.secretariat);
        const SEC = !!S.me.secretariat;
        const ttl = p => typeof roleTitle === 'function' ? roleTitle(p) : p.role;
        const deOK = ['secondaire', 'complexe'].includes((S.school && S.school.school_type) || 'secondaire');

        const { data, error } = await db.from('profiles').select('*').eq('school_id', S.school.id).order('full_name');
        if (error) return toast(error.message);
        const staff = (data || []).filter(p => p.role !== 'parent');

        const d = show(`<h3>Équipe & Cours</h3>
            <div class="card col" style="margin-bottom:10px">
                <small>Code d'invitation de l'école : <b>${esc(S.school.code)}</b></small>
                <small>Partagez ce code pour que le personnel rejoigne l'école.</small>
            </div>
            ${!SEC ? `<button type="button" class="ghost" style="margin-bottom:10px" onclick="oreaCoursClasses()">📚 Cours des classes</button>` : ''}
            <div class="row" style="margin-bottom:8px">
                <button type="button" class="chip ${TEAM.tab === 'staff' ? 'on' : ''}" data-tb="staff" style="flex:1">Comptes · ${staff.length}</button>
                ${!SEC && typeof oreaDossiers === 'function' ? `<button type="button" class="chip ${TEAM.tab === 'dossiers' ? 'on' : ''}" data-tb="dossiers" style="flex:1">Dossiers</button>` : ''}
                <button type="button" class="chip ${TEAM.tab === 'parents' ? 'on' : ''}" data-tb="parents" style="flex:1">Parents · <span id="tm-pn">${TEAM.ptotal == null ? '…' : TEAM.ptotal}</span></button>
            </div>
            <input id="tm-q" type="search" autocomplete="off" style="margin-bottom:8px">
            <div id="tm-list" style="max-height:56vh;overflow-y:auto"></div>
            <button class="ghost" style="margin-top:12px" onclick="this.closest('dialog').close()">Fermer</button>`);
        const q = d.querySelector('#tm-q'), box = d.querySelector('#tm-list');
        const bs = 'width:auto;flex:1;padding:6px;min-height:36px;font-size:12px';

        function drawStaff() {
            q.placeholder = '🔍 Rechercher : nom ou fonction';
            const f = TEAM.q.toLowerCase();
            const L = staff.filter(p => !f || (p.full_name || '').toLowerCase().includes(f) || ttl(p).toLowerCase().includes(f));
            box.innerHTML = L.length ? L.map(p => {
                const isMe = p.id === S.me.id, isPercepteur = p.role === 'percepteur', isEnseignant = p.role === 'enseignant';
                const isDE = p.role === 'directeur' && !!p.etudes, isSec = p.role === 'directeur' && !!p.secretariat;
                const isHead = p.role === 'directeur' && !p.etudes && !p.secretariat;
                return `<div class="card col" style="margin-bottom:10px;${isMe ? 'border-color:var(--gold)' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start"><b>${esc(p.full_name)} ${isMe ? '(Moi)' : ''}</b>
                    <span class="chip ${p.active === false ? 'due' : 'ok'}" style="padding:2px 8px;min-height:0;font-size:11px">${p.active === false ? 'Désactivé' : 'Actif'}</span></div>
                    <small>Fonction : <b style="color:var(--gold)">${esc(ttl(p))}${(isDE || isSec) && p.collector ? ' · Percepteur' : ''}${p.gardien ? ' · Gardien' : ''}</b></small>
                    ${(isMe || isHead) && !SEC && p.role === 'directeur' ? `<div class="row" style="margin-top:8px"><button class="ghost" style="${bs}" data-mtc="${p.id}">📚 ${isMe ? 'Gérer mes cours' : 'Gérer les cours'}</button></div>` : ''}
                    ${!isMe && !isHead ? `<div class="row" style="margin-top:8px;flex-wrap:wrap">
                        ${FIN && deOK && (isEnseignant || isPercepteur) ? `<button class="ghost" style="${bs}" onclick="setEtudes('${p.id}', true)">🎓 Nommer Directeur des études</button>` : ''}
                        ${FIN && (isEnseignant || isPercepteur) ? `<button class="ghost" style="${bs}" onclick="setSecr('${p.id}', true)">📋 Nommer Secrétariat</button>` : ''}
                        ${FIN && isDE ? `<button class="ghost" style="${bs}" onclick="setEtudes('${p.id}', false)">❌ Retirer Directeur des études</button>` : ''}
                        ${FIN && isSec ? `<button class="ghost" style="${bs}" onclick="setSecr('${p.id}', false)">❌ Retirer Secrétariat</button>` : ''}
                        ${FIN && (isDE || isSec) ? `<button class="ghost" style="${bs}" onclick="toggleCollector('${p.id}', ${!!p.collector})">${p.collector ? '❌ Retirer Percepteur' : '💰 Nommer aussi Percepteur'}</button>` : ''}
                        ${FIN && (isEnseignant || isPercepteur) ? `<button class="ghost" style="${bs}" onclick="toggleRole('${p.id}', '${p.role}')">${isPercepteur ? '❌ Retirer Percepteur' : '💰 Nommer Percepteur'}</button>` : ''}
                        ${FIN && p.active !== false ? `<button class="ghost" style="${bs}" data-gd="${p.id}" data-on="${p.gardien ? 0 : 1}">${p.gardien ? '❌ Retirer Gardien' : '🛡 Nommer Gardien'}</button>` : ''}
                        ${!SEC && (isEnseignant || isPercepteur || isDE) ? `<button class="ghost" style="${bs}" data-mtc="${p.id}">📚 Gérer les cours</button>` : ''}
                        ${FIN && (isPercepteur || ((isDE || isSec) && p.collector)) ? `<button class="ghost" style="${bs}" data-pcl="${p.id}">🏫 Classes à percevoir</button>` : ''}
                        ${FIN || (!SEC && !isDE && !isSec) ? `<button class="ghost" style="width:auto;padding:6px 12px;min-height:36px;font-size:12px;color:${p.active === false ? 'var(--ok)' : 'var(--bad)'}" onclick="toggleActive('${p.id}', ${p.active})">${p.active === false ? 'Réactiver' : 'Désactiver'}</button>` : ''}
                    </div>` : ''}
                </div>`;
            }).join('') : '<p class="empty">Aucun résultat.</p>';
            box.querySelectorAll('[data-gd]').forEach(b => b.onclick = async () => {
                const on = b.dataset.on === '1';
                if (!confirm(on ? 'Nommer Gardien ? Il pourra scanner les cartes à l’entrée et à la sortie.' : 'Retirer la marque Gardien ?')) return;
                const { error } = await db.rpc('v91_set_gardien', { p_uid: b.dataset.gd, p_on: on });
                if (error) return toast(error.message);
                toast(on ? 'Gardien nommé ✓' : 'Marque retirée'); team();
            });
            box.querySelectorAll('[data-mtc]').forEach(b => b.onclick = () => { const p = staff.find(x => x.id === b.dataset.mtc); if (p) manageTeacherCourses(p.id, p.full_name); });
            box.querySelectorAll('[data-pcl]').forEach(b => b.onclick = () => { const p = staff.find(x => x.id === b.dataset.pcl); if (p) manageCollectorClasses(p.id, p.full_name); });
        }

        async function loadParents(more) {
            if (!more) { TEAM.poff = 0; TEAM.prows = []; box.innerHTML = '<p class="empty">Chargement…</p>'; }
            const { data: r, error: e } = await db.rpc('v130_parents', { p_q: TEAM.pq || null, p_offset: TEAM.poff, p_limit: 30 });
            if (e) { box.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }
            TEAM.prows = TEAM.prows.concat(r.rows || []); TEAM.poff = TEAM.prows.length;
            if (!TEAM.pq) { TEAM.ptotal = r.total; const n = d.querySelector('#tm-pn'); if (n) n.textContent = r.total; }
            if (TEAM.tab !== 'parents') return;
            const ago = t => { if (!t) return 'jamais connecté'; const j = Math.floor((Date.now() - new Date(t)) / 864e5); return j <= 0 ? 'vu aujourd’hui' : j === 1 ? 'vu hier' : 'vu il y a ' + j + ' j'; };
            box.innerHTML = (TEAM.prows.length ? `<small style="display:block;margin-bottom:6px">${r.total} parent(s)${TEAM.pq ? ' trouvé(s)' : ''}</small>` + TEAM.prows.map(p => `<div class="card col" style="margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p.name)}</b><small>${ago(p.last_seen)}</small></div>
                    ${p.contact ? `<small>${esc(p.contact)}</small>` : ''}
                    <small>👧 ${(p.kids || []).map(k => esc(k.name) + (k.class ? ' · ' + esc(k.class) : '')).join(' — ')}</small>
                    <div class="row" style="margin-top:6px"><button class="ghost" style="${bs};color:var(--bad)" data-rv="${p.id}">Retirer l’accès</button></div>
                </div>`).join('') : `<p class="empty">${TEAM.pq ? 'Aucun parent trouvé.' : 'Aucun parent n’a encore de compte.'}</p>`)
                + (TEAM.prows.length < r.total ? '<button class="ghost" id="tm-more" style="width:100%">Voir plus</button>' : '');
            const m = box.querySelector('#tm-more'); if (m) m.onclick = () => { m.disabled = true; loadParents(true); };
            box.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => {
                const p = TEAM.prows.find(x => x.id === b.dataset.rv);
                if (!confirm(`Retirer l’accès de ${p ? p.name : 'ce parent'} ?\nIl ne verra plus ses enfants dans l’application (il pourra être relié à nouveau avec un code parent).`)) return;
                const { error: e2 } = await db.rpc('v130_revoke_parent', { p_parent: b.dataset.rv });
                if (e2) return toast(e2.message);
                toast('Accès retiré ✓'); TEAM.ptotal = null; loadParents();
            });
        }
        function drawParents() { q.placeholder = '🔍 Rechercher : parent, téléphone ou élève'; loadParents(); }
        const draw = () => {
            q.value = TEAM.tab === 'staff' ? TEAM.q : TEAM.tab === 'dossiers' ? TEAM.dq : TEAM.pq;
            if (TEAM.tab === 'dossiers') { q.placeholder = '🔍 Rechercher : nom ou fonction'; return oreaDossiers(box, TEAM.dq); }
            TEAM.tab === 'staff' ? drawStaff() : drawParents();
        };
        d.querySelectorAll('[data-tb]').forEach(b => b.onclick = () => { TEAM.tab = b.dataset.tb; d.querySelectorAll('[data-tb]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
        q.oninput = () => {
            if (TEAM.tab === 'staff') { TEAM.q = q.value.trim(); return drawStaff(); }
            if (TEAM.tab === 'dossiers') { clearTimeout(TEAM.timer); TEAM.timer = setTimeout(() => { TEAM.dq = q.value.trim(); oreaDossiers(box, TEAM.dq); }, 250); return; }
            clearTimeout(TEAM.timer); TEAM.timer = setTimeout(() => { TEAM.pq = q.value.trim(); loadParents(); }, 350);
        };
        draw();
        if (TEAM.tab === 'staff' && TEAM.ptotal == null) db.rpc('v130_parents', { p_q: null, p_offset: 0, p_limit: 1 }).then(({ data: r }) => { if (r) { TEAM.ptotal = r.total; const n = d.querySelector('#tm-pn'); if (n) n.textContent = r.total; } });
    };

    // Secrétariat (tous les niveaux) : nommé / retiré par le chef d'établissement
    window.setSecr = async function (id, on) {
        if (!confirm(on ? 'Nommer cette personne au Secrétariat ?\nElle pourra gérer les élèves, les classes, les fiches, les présences, les annonces et les messages aux parents. Elle consultera les cotes sans les modifier, et n’aura accès ni à l’argent ni aux nominations.' : 'Retirer le rôle de Secrétariat ? La personne redevient enseignant.')) return;
        const p = on ? { role: 'directeur', secretariat: true, etudes: false, collector: false } : { role: 'enseignant', secretariat: false, collector: false };
        const { error } = await db.from('profiles').update(p).eq('id', id);
        if (error) return toast(error.message);
        if (!on) await db.from('collector_classes').delete().eq('collector_id', id);
        toast(on ? 'Secrétariat nommé ✓' : 'Rôle retiré ✓');
        team('staff');
    };

    // Changer le rôle (enseignant <-> percepteur)
    window.toggleRole = async function (id, currentRole) {
        const newRole = currentRole === 'percepteur' ? 'enseignant' : 'percepteur';
        if (!confirm(`Changer le rôle en ${newRole} ?`)) return;
        const { error } = await db.from('profiles').update({ role: newRole }).eq('id', id);
        if (error) return toast(error.message);
        toast('Rôle mis à jour ✓');
        if (newRole === 'percepteur') {
            // Nomination : on choisit tout de suite les classes qu'il perçoit
            const { data: p } = await db.from('profiles').select('full_name').eq('id', id).maybeSingle();
            return manageCollectorClasses(id, (p && p.full_name) || 'Percepteur', true);
        }
        team(); // Rafraîchir la modale
    };

    // Directeur des études (secondaire et complexe) : nommé / retiré par le chef d'établissement
    window.setEtudes = async function (id, on) {
        const p = on
            ? { role: 'directeur', etudes: true, secretariat: false, collector: false }
            : { role: 'enseignant', etudes: false, collector: false };
        if (!confirm(on ? 'Nommer cette personne Directeur des études ?\nElle pourra tout gérer (élèves, classes, cotes, horaires, annonces…) sauf l’argent et les nominations.' : 'Retirer le rôle de Directeur des études ? La personne redevient enseignant.')) return;
        const { error } = await db.from('profiles').update(p).eq('id', id);
        if (error) return toast(error.message);
        if (!on) await db.from('collector_classes').delete().eq('collector_id', id);
        toast(on ? 'Directeur des études nommé ✓' : 'Rôle retiré ✓');
        team();
    };

    // Directeur des études qui encaisse aussi : uniquement les droits du percepteur
    window.toggleCollector = async function (id, current) {
        if (!confirm(current ? 'Retirer le rôle de percepteur ?' : 'Nommer aussi percepteur ?\nIl pourra encaisser dans les classes que tu lui confies.')) return;
        const { error } = await db.from('profiles').update({ collector: !current }).eq('id', id);
        if (error) return toast(error.message);
        if (current) { await db.from('collector_classes').delete().eq('collector_id', id); toast('Rôle retiré ✓'); return team(); }
        const { data: p } = await db.from('profiles').select('full_name').eq('id', id).maybeSingle();
        return manageCollectorClasses(id, (p && p.full_name) || 'Percepteur', true);
    };

    // Classes confiées à un percepteur : il ne voit et n'encaisse que les élèves de ces classes
    window.manageCollectorClasses = async function (collectorId, name, isNew) {
        const [{ data: classes, error: e1 }, { data: mine, error: e2 }] = await Promise.all([
            db.from('classes').select('id,name,year').eq('school_id', S.school.id).eq('year', S.year).order('name'),
            db.from('collector_classes').select('class_id').eq('collector_id', collectorId)
        ]);
        if (e1 || e2) return toast((e1 || e2).message);
        const on = new Set((mine || []).map(x => x.class_id));
        const d = show(`<h3>Classes à percevoir · ${esc(name)}</h3>
            <small>${isNew ? 'Nommé percepteur ✓ — ' : ''}Coche les classes dont il encaisse les frais. Il ne verra que les impayés de ces classes.</small>
            <div style="max-height:50vh;overflow-y:auto;margin-top:8px">${(classes || []).length ? classes.map(c => `
                <label class="card" style="padding:10px;margin:5px 0;justify-content:flex-start;gap:10px;cursor:pointer">
                    <input type="checkbox" data-cc="${c.id}" ${on.has(c.id) ? 'checked' : ''} style="width:auto;margin:0;transform:scale(1.4)">
                    <span>${esc(c.name)}</span>
                </label>`).join('') : '<p class="empty">Aucune classe pour l’année ' + esc(S.year || '') + '.</p>'}</div>
            <div class=row style="margin-top:12px"><button class=ghost id=ccall>Tout cocher</button><button id=ccok>Terminé</button></div>`);
        const save = async (cid, val) => {
            const r = val
                ? await db.from('collector_classes').insert({ school_id: S.school.id, collector_id: collectorId, class_id: cid })
                : await db.from('collector_classes').delete().match({ collector_id: collectorId, class_id: cid });
            if (r.error && !/duplicate/i.test(r.error.message)) toast(r.error.message);
        };
        d.querySelectorAll('[data-cc]').forEach(b => b.onchange = () => save(b.dataset.cc, b.checked));
        d.querySelector('#ccall').onclick = async () => { for (const b of d.querySelectorAll('[data-cc]')) if (!b.checked) { b.checked = true; await save(b.dataset.cc, true); } };
        d.querySelector('#ccok').onclick = () => team();
    };

    // Activer / Désactiver
    window.toggleActive = async function (id, currentActive) {
        const newActive = currentActive === false ? true : false;
        if (!confirm(newActive ? 'Réactiver ce compte ?' : 'Désactiver ce compte ?')) return;
        const { error } = await db.from('profiles').update({ active: newActive }).eq('id', id);
        if (error) return toast(error.message);
        toast(newActive ? 'Compte réactivé' : 'Compte désactivé');
        team(); // Rafraîchir
    };

    // Gérer les cours d'un enseignant (Attribution)
    window.manageTeacherCourses = async function (teacherId, teacherName) {
        const { data: classes } = await db.from('classes').select('*').eq('school_id', S.school.id).eq('year', S.year).order('name');
        const { data: subjects } = await db.from('subjects').select('*').eq('school_id', S.school.id).order('name');


        // On va créer une modale avec une liste déroulante pour la classe, puis une liste de checkboxes pour les cours
        const d = show(`<h3>Cours de ${esc(teacherName)}</h3>
            <div class="card col" style="margin-bottom:15px">
                <label>Classe<select id="course_class">${(classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
            </div>
            <div id="course_list" style="max-height:50vh;overflow-y:auto"><div class="sk"></div></div>
            <div class="row" style="margin-top:15px">
                <button class="ghost" onclick="this.closest('dialog').close()">Fermer</button>
            </div>
        `);

        const drawCourses = async () => {
            const classId = $('#course_class').value;
            const box = $('#course_list');
            if (!classId) { box.innerHTML = '<p class="empty">Aucune classe pour l’année ' + esc(S.year || '') + '.</p>'; return; }
            box.innerHTML = '<div class="sk"></div>';
            
            // Récupérer les cours attribués à cette classe spécifiquement
            const { data: currentAssigned } = await db.from('teacher_subjects').select('subject_id').eq('teacher_id', teacherId).eq('class_id', classId).eq('year', S.year);
            const assignedIds = new Set((currentAssigned || []).map(a => a.subject_id));

            box.innerHTML = (subjects || []).length ? (subjects || []).map(sub => `
                <div class="card" style="padding:10px;margin:5px 0;flex-direction:row;justify-content:flex-start;gap:10px">
                    <input type="checkbox" id="sub_${sub.id}" ${assignedIds.has(sub.id) ? 'checked' : ''} style="width:auto;margin:0;transform:scale(1.5)" onchange="toggleCourse('${teacherId}', '${classId}', '${sub.id}', this.checked)">
                    <label for="sub_${sub.id}" style="margin:0;text-transform:none;font-size:14px;color:var(--tx);font-weight:500">${esc(sub.name)}</label>
                </div>
            `).join('') : '<p class="empty">Aucun cours créé dans cette école.</p><button class="ghost" onclick="oreaCoursClasses()">Créer les cours des classes</button>';
        };

        $('#course_class').onchange = drawCourses;
        drawCourses();
    };

    window.toggleCourse = async function (teacherId, classId, subjectId, isChecked) {
        if (isChecked) {
            // Ajouter
            const { error } = await db.from('teacher_subjects').insert({
                school_id: S.school.id,
                teacher_id: teacherId,
                class_id: classId,
                subject_id: subjectId,
                year: S.year
            });
            if (error) toast(error.message);
        } else {
            // Retirer
            const { error } = await db.from('teacher_subjects').delete().match({
                teacher_id: teacherId,
                class_id: classId,
                subject_id: subjectId,
                year: S.year
            });
            if (error) toast(error.message);
        }
    };

    // Vue "Mes cours" pour l'enseignant (Ajoutée au menu)
    window.vMesCours = async function () {
        $('#main').innerHTML = '<div class=bar><button class=ghost onclick="S.tab=\'menu\';render()">← Menu</button></div>' + SK;
        
        const { data, error } = await db.from('teacher_subjects')
            .select('*, classes(name), subjects(name)')
            .eq('teacher_id', S.me.id)
            .eq('year', S.year);
            
        if (error) {
            $('#main').innerHTML = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Mes cours</h3><p class=empty data-ic="📚">Vos cours ne peuvent pas être affichés pour le moment. Vérifiez votre connexion, puis réessayez.</p><button class=ghost onclick="vMesCours()">Réessayer</button>`;
            return;
        }
        
        const l = data || [];
        
        // On regroupe par classe
        const byClass = {};
        l.forEach(t => {
            const cName = t.classes ? t.classes.name : 'Classe inconnue';
            if (!byClass[cName]) byClass[cName] = [];
            byClass[cName].push(t.subjects ? t.subjects.name : 'Cours inconnu');
        });

        let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Mes cours · ${esc(S.year)}</h3>`;
        
        if (Object.keys(byClass).length === 0) {
            h += '<p class=empty data-ic="📚">Aucun cours ne vous a encore été attribué pour cette année.<br>La direction peut le faire dans « Équipe & Cours ».</p>';
        } else {
            h += Object.entries(byClass).map(([className, subjects]) => `
                <div class="card col">
                    <b style="color:var(--gold);font-size:16px">${esc(className)}</b>
                    <div class="chips" style="margin-top:8px">
                        ${subjects.map(s => `<span class="chip on" style="padding:4px 12px">${esc(s)}</span>`).join('')}
                    </div>
                </div>
            `).join('');
        }

        $('#main').innerHTML = h;
    };

    // Accroche au menu pour ajouter "Mes cours" (Enseignant uniquement)
    hook('vMenu', function(orig) {
        return function() {
            orig.apply(this, arguments);
            if (['enseignant', 'percepteur'].includes(S.me.role) && S.tab === 'menu') {
                const main = $('#main');
                const h3 = main.querySelector('h3');
                const card = `<div class="menu-card" onclick="vMesCours()"><div class="menu-ic">${svgI('devoirs')}</div><div class="menu-label">Mes cours<small>Voir mes attributions</small></div><span class="menu-arrow">›</span></div>`;
                
                // On l'insère juste après le titre "Pédagogie"
                const titles = main.querySelectorAll('.menu-title');
                for (let t of titles) {
                    if (t.textContent.includes('Pédagogie')) {
                        t.insertAdjacentHTML('afterend', card);
                        break;
                    }
                }
            }
        };
    });

    // Accroche au menu pour le Directeur (ajout de la carte "Équipe & Cours" est déjà faite dans app.js)
    
})();
