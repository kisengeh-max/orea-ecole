// ORÉA École — Module NOTES V2 (Saisie ultra-rapide sans coefficients)

S.notesView = 'classes'; // 'classes', 'courses', 'cotation'
S.notesTerm = 1;
S.noteType = 'Devoir';
S.noteBase = 20;

// --- Redéfinition du Menu ---
window.vMenu = function() {
    const R = S.me.role; let h = `<h3>Menu</h3>`;
    h += `<div class=menu-title>Gestion quotidienne</div>`;
    h += menuCard('presences', 'Présences', null, "menuGo('presences')");
    if (R !== 'enseignant') h += menuCard('caisse', 'Caisse', null, "menuGo('caisse')");
    if (R !== 'enseignant') {
        h += menuCard('impayes', 'Impayés', null, "menuGo('impayes')");
        if (R === 'directeur') {
            h += menuCard('depenses', 'Dépenses', null, "menuGo('depenses')");
            h += menuCard('bilan', 'Bilan mensuel', null, "menuGo('bilan')");
        }
    }
    h += `<div class=menu-title>Pédagogie</div>`;
    h += menuCard('absences', 'Suivi des absences', null, "menuGo('absences')");
    h += menuCard('sanctions', 'Sanctions', null, "menuGo('sanctions')");
    h += menuCard('calendrier', 'Calendrier', null, "menuGo('calendrier')");
    h += menuCard('devoirs', 'Devoirs', null, "menuGo('devoirs')");
    h += menuCard('emploi_temps', 'Emploi du temps', null, "menuGo('emploi_temps')");
    
    if (R === 'directeur' || R === 'enseignant') {
        h += menuCard('journal', 'Saisie des notes', 'Coter les élèves par cours', "S.notesView='classes'; menuGo('saisie_notes')");
    }
    if (R === 'directeur') {
        h += menuCard('rapport', 'Bulletins', 'Générer les bulletins PDF', "menuGo('bulletins')");
    }

    if (dir()) {
        h += `<div class=menu-title>Administration</div>`;
        h += menuCard('annees', 'Années scolaires', null, "yearMenu()");
        h += menuCard('equipe', 'Équipe', null, "team()");
        h += menuCard('journal', 'Journal d’activité', null, "journal()");
        h += menuCard('exports', 'Exports (CSV / PDF)', null, "exportMenu()");
        h += menuCard('sauvegarde', 'Sauvegarde complète', null, "doBackup()");
        h += menuCard('rapport', 'Rapport mensuel', null, "monthReport()");
        h += `<div class=menu-title>Parents & Communication</div>`;
        h += menuCard('messages', 'Messages des parents', null, "pAdminInbox()");
        h += menuCard('justificatifs', 'Justificatifs d’absence', null, "pAdminJustifs()");
        h += menuCard('annonces', 'Publier une annonce', null, "pAdminAnnonce()");
    }
    $('#main').innerHTML = h;
};

// --- Interception du routeur ---
const _origRender = window.render;
window.render = function() {
    if (['saisie_notes', 'bulletins'].includes(S.tab)) {
        const realTab = S.tab;
        S.tab = 'menu'; 
        _origRender();
        S.tab = realTab;
        if (realTab === 'saisie_notes') routeSaisieNotes();
        else vBulletins();
        return;
    }
    _origRender();
};

function routeSaisieNotes() {
    if (S.notesView === 'classes') vNotesClasses();
    else if (S.notesView === 'courses') vNotesCourses();
    else if (S.notesView === 'cotation') vNotesCotation();
}

// --- Initialisation des cours RDC ---
async function seedDefaultCourses() {
    const defaults = ['Français', 'Anglais', 'Mathématiques', 'Géographie', 'Histoire', 'Civisme', 'Éducation physique', 'Éducation à la vie', 'Éducation civique', 'Chimie', 'Physique'];
    const rows = defaults.map(name => ({ school_id: S.school.id, name }));
    const { error } = await db.from('subjects').insert(rows);
    if (error) return toast('Erreur: ' + error.message);
    toast('Cours de base créés');
    render();
}

// ==========================================
// VUE 1 : GRILLE DES CLASSES
// ==========================================
async function vNotesClasses() {
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Notes - Choisir une classe</h3>`;
    $('#main').innerHTML = h + SK;
    
    const { count } = await db.from('subjects').select('*', { count: 'exact', head: true });
    if (count === 0) {
        $('#main').innerHTML = h + `<div class="card col" style="text-align:center;padding:20px">
            <p>Aucun cours configuré pour votre école.</p>
            <button onclick="seedDefaultCourses()">Créer les cours de base (RDC)</button>
        </div>`;
        return;
    }

    const cl = yc();
    if (!cl.length) return $('#main').innerHTML = h + `<p class=empty>Crée d'abord une classe.</p>`;

    h += `<div class=cgrid>` + cl.map(c => {
        return `<div class=ccard onclick="S.noteClass='${c.id}'; S.notesView='courses'; render();"><b>${esc(c.name)}</b></div>`;
    }).join('') + `</div>`;
    $('#main').innerHTML = h;
}

// ==========================================
// VUE 2 : GRILLE DES COURS DE LA CLASSE
// ==========================================
async function vNotesCourses() {
    const cName = (S.classes.find(c => c.id === S.noteClass) || {}).name || '';
    let h = `<div class=bar><button class=ghost onclick="S.notesView='classes';render()">← Classes</button><b class=ctitle>${esc(cName)}</b></div><h3>Cours</h3>`;
    $('#main').innerHTML = h + SK;

    const { data: cs } = await db.from('class_subjects').select('subject_id, subjects(name)').eq('class_id', S.noteClass);
    const list = cs || [];

    h += `<div class=bar style="margin-bottom:10px"><button class=ghost onclick="manageClassCourses()">⚙️ Gérer les cours de cette classe</button></div>`;
    
    if (!list.length) {
        h += `<p class=empty>Aucun cours assigné à cette classe.</p>`;
    } else {
        h += `<div class=cgrid>` + list.map(x => {
            return `<div class=ccard onclick="askNoteParams('${x.subject_id}', '${esc(x.subjects.name)}')">
                <b style="font-size:14px; white-space:normal">${esc(x.subjects.name)}</b>
            </div>`;
        }).join('') + `</div>`;
    }
    $('#main').innerHTML = h;
}

function askNoteParams(subjId, subjName) {
    S.noteSubject = subjId;
    const d = show(`<h3>${esc(subjName)}</h3>
        <div class="card col" style="padding:15px">
            <label>Type d'évaluation</label>
            <select id=np_type>
                <option value="Interrogation">Interrogation</option>
                <option value="Devoir" selected>Devoir</option>
                <option value="Examen">Examen</option>
            </select>
            <label style="margin-top:10px">Base (note maximale)</label>
            <select id=np_base">
                <option value="5">Sur 5</option>
                <option value="10">Sur 10</option>
                <option value="20" selected>Sur 20</option>
                <option value="100">Sur 100</option>
            </select>
            <label style="margin-top:10px">Trimestre</label>
            <select id=np_term">
                <option value="1">Trimestre 1</option>
                <option value="2">Trimestre 2</option>
                <option value="3">Trimestre 3</option>
            </select>
        </div>
        <div class=row><button class=ghost onclick="this.closest('dialog').close()">Annuler</button><button onclick="startCotation()">Continuer →</button></div>
    `);
}

function startCotation() {
    S.noteType = $('#np_type').value;
    S.noteBase = parseFloat($('#np_base').value);
    S.notesTerm = parseInt($('#np_term').value);
    $('#dlg').close();
    S.notesView = 'cotation';
    render();
}

// ==========================================
// VUE 3 : SAISIE DES NOTES (ULTRA RAPIDE)
// ==========================================
async function vNotesCotation() {
    const cName = (S.classes.find(c => c.id === S.noteClass) || {}).name || '';
    const sName = (S.notesCoursesList?.find(x => x.subject_id === S.noteSubject)?.subjects?.name) || 'Cours';
    
    let h = `<div class=bar><button class=ghost onclick="S.notesView='courses';render()">← Cours</button>
        <b class=ctitle>${esc(cName)} · ${esc(sName)}</b></div>
        <div class="card" style="text-align:center;padding:10px;margin-bottom:15px">
            <small>${S.noteType} · Base : ${S.noteBase}</small>
        </div>`;
    $('#main').innerHTML = h + SK;

    const { data: grades } = await db.from('grades')
        .select('student_id, grade')
        .eq('class_id', S.noteClass)
        .eq('subject_id', S.noteSubject)
        .eq('term', S.notesTerm)
        .eq('label', S.noteType);
    
    const gMap = Object.fromEntries((grades || []).map(g => [g.student_id, g.grade]));
    const st = S.stu.filter(s => s.class_id === S.noteClass).sort((a,b) => a.name.localeCompare(b.name, 'fr'));

    h += `<div id=nc_list>` + st.map((s, i) => {
        const val = gMap[s.id] !== undefined ? gMap[s.id] : '';
        const nextId = i < st.length - 1 ? `g_${st[i+1].id}` : '';
        return `<div class="card" style="padding:10px 14px; margin:5px 0; display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:15px">${esc(s.name)}</b>
            <div style="display:flex; align-items:center; gap:5px;">
                <input id="g_${s.id}" type=number step=any min=0 max="${S.noteBase}" value="${val}" 
                    style="margin:0;width:70px;text-align:center;font-weight:bold;font-size:16px" 
                    onchange="saveNote('${s.id}', this.value)"
                    onkeydown="if(event.key==='Enter'){ this.blur(); ${nextId ? `document.getElementById('${nextId}').focus();` : ''} }">
                <small style="color:var(--mut)">/ ${S.noteBase}</small>
            </div>
        </div>`;
    }).join('') + `</div>`;
    
    $('#main').innerHTML = h;
}

async function saveNote(sid, val) {
    if (val === '') {
        await db.from('grades').delete().match({ 
            student_id: sid, subject_id: S.noteSubject, term: S.notesTerm, label: S.noteType 
        });
        toast('Effacé'); return;
    }
    const grade = parseFloat(val);
    if (isNaN(grade) || grade < 0 || grade > S.noteBase) return toast('Note invalide');
    
    const payload = {
        school_id: S.school.id, student_id: sid, class_id: S.noteClass,
        subject_id: S.noteSubject, term: S.notesTerm, label: S.noteType,
        grade: grade, max_grade: S.noteBase, created_by: S.me.id
    };
    
    const { data: existing } = await db.from('grades').select('id')
        .eq('student_id', sid).eq('subject_id', S.noteSubject).eq('term', S.notesTerm).eq('label', S.noteType).maybeSingle();
    
    if (existing) await db.from('grades').update({ grade, max_grade: S.noteBase }).eq('id', existing.id);
    else await db.from('grades').insert(payload);
    
    // Toast discret pour ne pas gêner la saisie
    const t = $('#toast'); if(t){ t.textContent = '✓ Enregistré'; t.hidden = false; setTimeout(()=>t.hidden=true, 1000); }
}

// ==========================================
// GESTION DES COURS (Ajouter/Retirer)
// ==========================================
async function manageClassCourses() {
    const { data: allSubj } = await db.from('subjects').select('*').order('name');
    const { data: assigned } = await db.from('class_subjects').select('subject_id').eq('class_id', S.noteClass);
    const assignedIds = new Set((assigned || []).map(a => a.subject_id));

    const d = show(`<h3>Cours de la classe</h3>
        <div style="max-height:50vh; overflow-y:auto; margin-bottom:15px">
            ${allSubj.map(sub => `
                <div class="card" style="padding:10px;margin:5px 0">
                    <b>${esc(sub.name)}</b>
                    <button class="${assignedIds.has(sub.id) ? 'ghost' : ''}" style="width:auto;padding:5px 15px;min-height:30px" 
                        onclick="toggleClassCourse('${sub.id}', ${assignedIds.has(sub.id)})">
                        ${assignedIds.has(sub.id) ? 'Retirer' : 'Ajouter'}
                    </button>
                </div>
            `).join('')}
        </div>
        <div class="bar" style="margin-top:10px">
            <input id=mc_new placeholder="Nouveau cours..." style="flex:1;margin:0">
            <button class=ghost style="width:auto" onclick="addNewSubject()">+</button>
        </div>
        <button class=ghost style="margin-top:15px" onclick="this.closest('dialog').close(); render();">Fermer</button>
    `);
}

async function toggleClassCourse(subjId, isAssigned) {
    if (isAssigned) {
        await db.from('class_subjects').delete().match({ class_id: S.noteClass, subject_id: subjId });
    } else {
        await db.from('class_subjects').insert({ school_id: S.school.id, class_id: S.noteClass, subject_id: subjId });
    }
    $('#dlg').close();
    setTimeout(() => manageClassCourses(), 50); // Rouvre le dialogue
}

async function addNewSubject() {
    const name = $('#mc_new').value.trim();
    if (!name) return;
    await db.from('subjects').insert({ school_id: S.school.id, name });
    $('#dlg').close();
    setTimeout(() => manageClassCourses(), 50);
}

// ==========================================
// BULLETINS (Mise à jour pour le format sans coefficient)
// ==========================================
async function vBulletins() {
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Bulletins</h3>`;
    $('#main').innerHTML = h + SK;
    
    const cls = yc();
    if (!cls.length) return $('#main').innerHTML = h + `<p class=empty>Crée d'abord une classe.</p>`;
    if (!S.bulCls || !cls.some(c => c.id === S.bulCls)) S.bulCls = cls[0].id;
    if (!S.bulTerm) S.bulTerm = 1;
    
    const st = S.stu.filter(s => s.class_id === S.bulCls).sort((a,b) => a.name.localeCompare(b.name, 'fr'));
    if (!S.bulStu || !st.some(s => s.id === S.bulStu)) S.bulStu = st[0]?.id || '';

    h += `<div class=bar>
        <select id=b_cls style="flex:1">${cls.map(c => `<option value="${c.id}" ${c.id === S.bulCls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select id=b_term style="flex:1">${[1,2,3].map(t => `<option value="${t}" ${t === S.bulTerm ? 'selected' : ''}>Trimestre ${t}</option>`).join('')}</select>
    </div>
    <div class=bar><select id=b_stu>${st.map(s => `<option value="${s.id}" ${s.id === S.bulStu ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <button onclick=genBulletin() style="margin-top:10px">Générer le bulletin PDF</button>
    <div id=b_prev style="margin-top:20px"></div>`;

    $('#main').innerHTML = h;
    $('#b_cls').onchange = e => { S.bulCls = e.target.value; S.bulStu = ''; render(); };
    $('#b_term').onchange = e => { S.bulTerm = +e.target.value; render(); };
    $('#b_stu').onchange = e => { S.bulStu = e.target.value; previewBulletin(); };
    
    previewBulletin();
}

async function previewBulletin() {
    const el = $('#b_prev'); if (!el) return;
    el.innerHTML = SK;
    if (!S.bulStu) { el.innerHTML = '<p class=empty>Aucun élève.</p>'; return; }
    
    const { data: grades } = await db.from('grades').select('*, subjects(name)').eq('student_id', S.bulStu).eq('term', S.bulTerm);
    if (!grades || !grades.length) { el.innerHTML = `<p class=empty>Aucune note pour ce trimestre.</p>`; return; }
    
    // Regroupement par cours
    const bySubj = {};
    grades.forEach(g => { 
        const sName = g.subjects?.name || 'Inconnu';
        if (!bySubj[sName]) bySubj[sName] = [];
        bySubj[sName].push(g); 
    });
    
    let html = `<div class="card col"><b>Aperçu des moyennes</b>`;
    let sumAvg = 0, countSubj = 0;
    
    Object.keys(bySubj).sort().forEach(subName => {
        const list = bySubj[subName];
        // On ramène chaque note sur 20
        let totalOn20 = 0;
        list.forEach(g => { totalOn20 += (g.grade / g.max_grade) * 20; });
        const avg = totalOn20 / list.length;
        
        html += `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(subName)}</span><b>${nf(avg, 2)} / 20</b></div>`;
        sumAvg += avg;
        countSubj++;
    });
    html += `</div>`;
    
    const genAvg = countSubj ? sumAvg / countSubj : 0;
    const appreciation = genAvg >= 16 ? 'Excellent travail' : genAvg >= 14 ? 'Très bien' : genAvg >= 12 ? 'Bien' : genAvg >= 10 ? 'Passable' : 'Insuffisant';
    
    html += `<div class="card col" style="margin-top:10px">
        <b>Moyenne Générale : ${nf(genAvg, 2)} / 20</b>
        <label style="margin-top:8px;font-size:12px;color:var(--mut)">Appréciation générale</label>
        <textarea id=ai_remark rows=2 style="width:100%;margin-top:4px">${appreciation}</textarea>
        <button class=ghost onclick="toast('L\'IA arrive bientôt !')" style="margin-top:6px;width:auto;align-self:flex-start">✨ Générer avec l'IA</button>
    </div>`;
    
    el.innerHTML = html;
}

async function genBulletin() {
    const s = S.stu.find(x => x.id === S.bulStu);
    if (!s) return toast('Sélectionne un élève');
    
    const { data: grades } = await db.from('grades').select('*, subjects(name)').eq('student_id', S.bulStu).eq('term', S.bulTerm);
    if (!grades || !grades.length) return toast('Aucune note pour ce trimestre');
    
    const bySubj = {};
    grades.forEach(g => { 
        const sName = g.subjects?.name || 'Inconnu';
        if (!bySubj[sName]) bySubj[sName] = [];
        bySubj[sName].push(g); 
    });
    
    const rows = []; let sumAvg = 0, countSubj = 0;
    
    Object.keys(bySubj).sort().forEach(subName => {
        const list = bySubj[subName];
        let totalOn20 = 0;
        list.forEach(g => { totalOn20 += (g.grade / g.max_grade) * 20; });
        const avg = totalOn20 / list.length;
        rows.push([subName, nf(avg, 2) + ' / 20', '']);
        sumAvg += avg;
        countSubj++;
    });
    
    const genAvg = countSubj ? sumAvg / countSubj : 0;
    const customRemark = $('#ai_remark')?.value || 'Insuffisant';
    
    const r = {
        name: 'bulletin-' + s.name.replace(/\s+/g, '-'),
        title: 'Bulletin de notes — ' + s.name,
        sub: 'Classe : ' + (S.classes.find(c => c.id === s.class_id) || {}).name + ' · Trimestre ' + S.bulTerm + ' · Année ' + S.year,
        head: ['Cours', 'Moyenne / 20', 'Appréciation'],
        rows: rows, w: [45, 25, 30], r: [1],
        tot: ['MOYENNE GÉNÉRALE', nf(genAvg, 2) + ' / 20', customRemark]
    };
    
    try {
        const pdfData = mkPdf(r);
        dl(new Blob([pdfData], { type: 'application/pdf' }), fnm(r.name, 'pdf'));
        toast('Bulletin généré');
    } catch (e) { toast('Erreur PDF : ' + e.message); }
        }
