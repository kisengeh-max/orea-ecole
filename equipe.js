/* =====================================================================
   ORÉA École v70 — equipe.js (classes confiées au percepteur, « Mes cours » réparé)
   Module de gestion de l'équipe (Directeur uniquement).
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

    // Remplacer la fonction team() de app.js par la nouvelle
    window.team = async function () {
        if (S.me.role !== 'directeur') return toast('Accès réservé au directeur.');
        
        const { data, error } = await db.from('profiles').select('*').eq('school_id', S.school.id).order('full_name');
        if (error) return toast(error.message);
        
        const l = data || [];
        
        const d = show(`<h3>Équipe & Cours</h3>
            <div class="card col" style="margin-bottom:15px">
                <small>Code d'invitation de l'école : <b>${esc(S.school.code)}</b></small>
                <small>Partagez ce code pour que les enseignants rejoignent l'école.</small>
            </div>
            <div style="max-height:60vh;overflow-y:auto">
                ${l.map(p => {
                    const isMe = p.id === S.me.id;
                    const isPercepteur = p.role === 'percepteur';
                    const isEnseignant = p.role === 'enseignant';
                    return `
                    <div class="card col" style="margin-bottom:10px; ${isMe ? 'border-color:var(--gold)' : ''}">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start">
                            <b>${esc(p.full_name)} ${isMe ? '(Moi)' : ''}</b>
                            <span class="chip ${p.active === false ? 'due' : 'ok'}" style="padding:2px 8px;min-height:0;font-size:11px">${p.active === false ? 'Désactivé' : 'Actif'}</span>
                        </div>
                        <small>Rôle : <b style="color:var(--gold)">${p.role}</b></small>
                        
                        ${!isMe ? `
                        <div class="row" style="margin-top:8px;flex-wrap:wrap">
                            ${isEnseignant || isPercepteur ? `
                                <button class="ghost" style="width:auto;flex:1;padding:6px;min-height:36px;font-size:12px" onclick="toggleRole('${p.id}', '${p.role}')">
                                    ${isPercepteur ? '❌ Retirer Percepteur' : '💰 Nommer Percepteur'}
                                </button>
                            ` : ''}
                            ${isEnseignant || isPercepteur ? `
                                <button class="ghost" style="width:auto;flex:1;padding:6px;min-height:36px;font-size:12px" data-mtc="${p.id}">
                                    📚 Gérer les cours
                                </button>
                            ` : ''}
                            ${isPercepteur ? `
                                <button class="ghost" style="width:auto;flex:1;padding:6px;min-height:36px;font-size:12px" data-pcl="${p.id}">
                                    🏫 Classes à percevoir
                                </button>
                            ` : ''}
                            <button class="ghost" style="width:auto;padding:6px 12px;min-height:36px;font-size:12px;color:${p.active === false ? 'var(--ok)' : 'var(--bad)'}" onclick="toggleActive('${p.id}', ${p.active})">
                                ${p.active === false ? 'Réactiver' : 'Désactiver'}
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    `;
                }).join('')}
            </div>
            <button class="ghost" style="margin-top:15px" onclick="this.closest('dialog').close()">Fermer</button>
        `);
        d.querySelectorAll('[data-mtc]').forEach(b => b.onclick = () => {
            const p = l.find(x => x.id === b.dataset.mtc);
            if (p) manageTeacherCourses(p.id, p.full_name);
        });
        d.querySelectorAll('[data-pcl]').forEach(b => b.onclick = () => {
            const p = l.find(x => x.id === b.dataset.pcl);
            if (p) manageCollectorClasses(p.id, p.full_name);
        });
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
            `).join('') : '<p class="empty">Aucun cours créé dans cette école. Allez dans "Cotation" pour en créer.</p>';
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
            h += '<p class=empty data-ic="📚">Aucun cours ne vous a encore été attribué pour cette année.<br>Le directeur peut le faire dans « Équipe & Cours ».</p>';
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
