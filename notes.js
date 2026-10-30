// ORÉA École — Module NOTES (K3) — Tranche 2/6
// Interface de saisie des notes et génération des bulletins PDF.

// --- État local ---
S.notesSubjects = [];
S.notesTerm = 1;

// --- Redéfinition du Menu pour ajouter les boutons ---
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
    
    // NOUVEAU : Notes et Bulletins (Tranche 2)
    if (R === 'directeur' || R === 'enseignant') {
        h += menuCard('journal', 'Saisie des notes', 'Entrer les notes par classe', "menuGo('saisie_notes')");
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

// --- Interception du routeur de app.js ---
const _origRender = window.render;
window.render = function() {
    if (['saisie_notes', 'bulletins'].includes(S.tab)) {
        const realTab = S.tab;
        S.tab = 'menu'; // Force app.js à dessiner la barre de navigation normale
        _origRender();
        S.tab = realTab;
        if (realTab === 'saisie_notes') vSaisieNotes();
        else vBulletins();
        return;
    }
    _origRender();
};

// --- Vues ---
async function vSaisieNotes() {
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Saisie des notes</h3>`;
    $('#main').innerHTML = h + SK;
    
    if (!S.notesSubjects || !S.notesSubjects.length) {
        const { data } = await db.rpc('list_subjects');
        S.notesSubjects = data || [];
    }
    if (!S.notesSubjects.length) {
        $('#main').innerHTML = h + `<p class=empty>Aucune matière configurée. Vérifiez le script SQL.</p>`;
        return;
    }

    const cls = yc();
    if (!cls.length) { $('#main').innerHTML = h + `<p class=empty>Crée d'abord une classe.</p>`; return; }
    if (!S.notesCls || !cls.some(c => c.id === S.notesCls)) S.notesCls = cls[0].id;
    
    S.notesTerm = S.notesTerm || 1;
    S.notesSubj = S.notesSubj || S.notesSubjects[0].id;
    S.notesLabel = S.notesLabel || 'Interrogation';

    h += `<div class=bar>
        <select id=ns_cls>${cls.map(c => `<option value="${c.id}" ${c.id === S.notesCls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select id=ns_term>${[1,2,3].map(t => `<option value="${t}" ${t === S.notesTerm ? 'selected' : ''}>Trimestre ${t}</option>`).join('')}</select>
    </div>
    <div class=bar>
        <select id=ns_subj>${S.notesSubjects.map(s => `<option value="${s.id}" ${s.id === S.notesSubj ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        <input id=ns_label value="${esc(S.notesLabel)}" placeholder="Type (ex: Devoir 1)">
    </div>
    <div id=ns_list>${SK}</div>`;

    $('#main').innerHTML = h;
    
    $('#ns_cls').onchange = e => { S.notesCls = e.target.value; render(); };
    $('#ns_term').onchange = e => { S.notesTerm = +e.target.value; render(); };
    $('#ns_subj').onchange = e => { S.notesSubj = e.target.value; render(); };
    $('#ns_label').onchange = e => { S.notesLabel = e.target.value.trim() || 'Interrogation'; drawNotesList(); };

    drawNotesList();
}

async function drawNotesList() {
    const el = $('#ns_list'); if (!el) return;
    const { data: grades, error } = await db.from('grades')
        .select('*')
        .eq('class_id', S.notesCls)
        .eq('subject_id', S.notesSubj)
        .eq('term', S.notesTerm)
        .eq('label', S.notesLabel);
    
    if (error) { el.innerHTML = `<p class=empty>Erreur: ${esc(error.message)}</p>`; return; }
    
    const st = S.stu.filter(s => s.class_id === S.notesCls).sort((a,b) => a.name.localeCompare(b.name, 'fr'));
    const gMap = Object.fromEntries((grades || []).map(g => [g.student_id, g]));

    if (!st.length) { el.innerHTML = `<p class=empty>Aucun élève dans cette classe.</p>`; return; }

    el.innerHTML = `<div class=card><small>Notes sur 20. Laissez vide pour effacer.</small></div>` + 
        st.map(s => {
            const g = gMap[s.id];
            const val = g ? g.grade : '';
            return `<div class="card col" style="padding:10px 14px">
                <b style="font-size:14px;margin-bottom:6px">${esc(s.name)}</b>
                <div class=row style="margin:0">
                    <input type=number step=any min=0 max=20 value="${val}" placeholder="/ 20" 
                        style="margin:0;flex:1" onchange="saveNote('${s.id}', this.value)">
                </div>
            </div>`;
        }).join('');
}

async function saveNote(sid, val) {
    if (val === '') {
        const { error } = await db.from('grades').delete().match({ 
            student_id: sid, subject_id: S.notesSubj, term: S.notesTerm, label: S.notesLabel 
        });
        if (error) return toast(error.message);
        toast('Note effacée');
        return;
    }
    const grade = parseFloat(val);
    if (isNaN(grade) || grade < 0 || grade > 20) return toast('Note invalide (0-20)');
    
    const payload = {
        school_id: S.school.id, student_id: sid, class_id: S.notesCls,
        subject_id: S.notesSubj, term: S.notesTerm, label: S.notesLabel,
        grade: grade, max_grade: 20, weight: 1, created_by: S.me.id
    };
    
    const { data: existing } = await db.from('grades').select('id')
        .eq('student_id', sid).eq('subject_id', S.notesSubj).eq('term', S.notesTerm).eq('label', S.notesLabel).maybeSingle();
    
    let err;
    if (existing) {
        const { error: e } = await db.from('grades').update({ grade }).eq('id', existing.id);
        err = e;
    } else {
        const { error: e } = await db.from('grades').insert(payload);
        err = e;
    }
    if (err) toast(err.message);
    else toast('Note enregistrée');
}

async function vBulletins() {
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Bulletins</h3>`;
    $('#main').innerHTML = h + SK;
    
    if (!S.notesSubjects || !S.notesSubjects.length) {
        const { data } = await db.rpc('list_subjects');
        S.notesSubjects = data || [];
    }
    
    const cls = yc();
    if (!cls.length) { $('#main').innerHTML = h + `<p class=empty>Crée d'abord une classe.</p>`; return; }
    if (!S.bulCls || !cls.some(c => c.id === S.bulCls)) S.bulCls = cls[0].id;
    if (!S.bulTerm) S.bulTerm = 1;
    
    const st = S.stu.filter(s => s.class_id === S.bulCls).sort((a,b) => a.name.localeCompare(b.name, 'fr'));
    if (!S.bulStu || !st.some(s => s.id === S.bulStu)) S.bulStu = st[0]?.id || '';

    h += `<div class=bar>
        <select id=b_cls>${cls.map(c => `<option value="${c.id}" ${c.id === S.bulCls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select id=b_term>${[1,2,3].map(t => `<option value="${t}" ${t === S.bulTerm ? 'selected' : ''}>Trimestre ${t}</option>`).join('')}</select>
    </div>
    <div class=bar>
        <select id=b_stu>${st.map(s => `<option value="${s.id}" ${s.id === S.bulStu ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    </div>
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
    
    const { data: grades } = await db.from('grades').select('*').eq('student_id', S.bulStu).eq('term', S.bulTerm);
    if (!grades || !grades.length) { el.innerHTML = `<p class=empty>Aucune note pour ce trimestre.</p>`; return; }
    
    const bySubj = {};
    grades.forEach(g => { if (!bySubj[g.subject_id]) bySubj[g.subject_id] = []; bySubj[g.subject_id].push(g); });
    
    let html = `<div class="card col"><b>Aperçu des moyennes</b>`;
    let sumCoef = 0, sumAvgCoef = 0;
    
    S.notesSubjects.forEach(sub => {
        if (!bySubj[sub.id]) return;
        const list = bySubj[sub.id];
        let sumW = 0, sumGW = 0;
        list.forEach(g => { sumW += g.weight; sumGW += g.grade * g.weight; });
        const avg = sumW ? sumGW / sumW : 0;
        html += `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(sub.name)} (x${sub.coefficient})</span><b>${nf(avg, 2)} / 20</b></div>`;
        sumCoef += sub.coefficient;
        sumAvgCoef += avg * sub.coefficient;
    });
    html += `</div>`;
    
    const genAvg = sumCoef ? sumAvgCoef / sumCoef : 0;
    const appreciation = genAvg >= 16 ? 'Excellent travail' : genAvg >= 14 ? 'Très bien' : genAvg >= 12 ? 'Bien' : genAvg >= 10 ? 'Passable' : 'Insuffisant';
    
    html += `<div class="card col" style="margin-top:10px">
        <b>Moyenne Générale : ${nf(genAvg, 2)} / 20</b>
        <label style="margin-top:8px;font-size:12px;color:var(--mut)">Appréciation générale</label>
        <textarea id=ai_remark rows=2 style="width:100%;margin-top:4px">${appreciation}</textarea>
        <button class=ghost onclick="toast('L\'Assistant IA sera disponible dans la Tranche 4 !')" style="margin-top:6px;width:auto;align-self:flex-start">✨ Générer avec l'IA</button>
    </div>`;
    
    el.innerHTML = html;
}

async function genBulletin() {
    const s = S.stu.find(x => x.id === S.bulStu);
    if (!s) return toast('Sélectionne un élève');
    
    const { data: grades } = await db.from('grades').select('*').eq('student_id', S.bulStu).eq('term', S.bulTerm);
    if (!grades || !grades.length) return toast('Aucune note pour ce trimestre');
    
    const bySubj = {};
    grades.forEach(g => { if (!bySubj[g.subject_id]) bySubj[g.subject_id] = []; bySubj[g.subject_id].push(g); });
    
    const rows = [];
    let sumCoef = 0, sumAvgCoef = 0;
    
    S.notesSubjects.forEach(sub => {
        if (!bySubj[sub.id]) return;
        const list = bySubj[sub.id];
        let sumW = 0, sumGW = 0;
        list.forEach(g => { sumW += g.weight; sumGW += g.grade * g.weight; });
        const avg = sumW ? sumGW / sumW : 0;
        rows.push([sub.name, String(sub.coefficient), nf(avg, 2) + ' / 20', '']);
        sumCoef += sub.coefficient;
        sumAvgCoef += avg * sub.coefficient;
    });
    
    const genAvg = sumCoef ? sumAvgCoef / sumCoef : 0;
    const defaultApp = genAvg >= 16 ? 'Excellent' : genAvg >= 14 ? 'Très bien' : genAvg >= 12 ? 'Bien' : genAvg >= 10 ? 'Passable' : 'Insuffisant';
    const customRemark = $('#ai_remark')?.value || defaultApp;
    
    const r = {
        name: 'bulletin-' + s.name.replace(/\s+/g, '-'),
        title: 'Bulletin de notes — ' + s.name,
        sub: 'Classe : ' + (S.classes.find(c => c.id === s.class_id) || {}).name + ' · Trimestre ' + S.bulTerm + ' · Année ' + S.year,
        head: ['Matière', 'Coef', 'Moyenne', 'Appréciation'],
        rows: rows, w: [40, 15, 20, 25], r: [1, 2],
        tot: ['MOYENNE GÉNÉRALE', nf(sumCoef, 0), nf(genAvg, 2) + ' / 20', customRemark]
    };
    
    try {
        const pdfData = mkPdf(r);
        dl(new Blob([pdfData], { type: 'application/pdf' }), fnm(r.name, 'pdf'));
        toast('Bulletin généré dans Téléchargements');
    } catch (e) {
        toast('Erreur PDF : ' + e.message);
    }
         }
