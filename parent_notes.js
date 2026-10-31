// ORÉA École — Notes pour l'Espace Parent (v41) — LECTURE SEULE
// Dépend de parent.js (P, db, esc, nf, fdate, toast, navView) et de bulletins.js (OB).

P.noteChild = null; P.noteTerm = null; P.grades = null;
const P_SK = '<div class=sk></div>'.repeat(3);
const P_KINDS = ['Interrogation', 'Devoir', 'Examen'];

async function parentLoadGrades() {
    const { data, error } = await db.rpc('parent_grades');
    if (error) return error;
    P.grades = data || []; return null;
}
const pGradesOf = id => (P.grades || []).filter(g => g.student_id === id);

async function parentNotesView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">📝 Notes & Bulletins</h2>`;
    const done = html => { $('#pmain').innerHTML = html + navView() + '<div style="height:90px"></div>'; };
    if (!P.children.length) return done(h + `<div class=p-empty>Ajoutez un enfant pour voir ses notes.</div>`);

    if (!P.noteChild) {
        return done(h + P.children.map(c => `<div class=p-card onclick="P.noteChild='${c.id}';render()"><h3>👤 ${esc(c.name)}</h3><div class=p-line>Voir les notes et bulletins →</div></div>`).join(''));
    }
    const kid = P.children.find(c => c.id === P.noteChild);
    if (!kid) { P.noteChild = null; return parentNotesView(); }
    if (!P.noteTerm) P.noteTerm = '1';
    h += `<div class=p-row style="margin-bottom:10px"><button class=ghost style="width:auto;padding:6px 12px;min-height:36px" onclick="P.noteChild=null;render()">← Retour</button><b>${esc(kid.name)}</b></div>`
        + `<div class=p-row style="gap:6px;margin-bottom:15px">${['1', '2', '3', 'A'].map(t => `<button class="${P.noteTerm === t ? '' : 'ghost'}" style="flex:1;padding:8px 2px;min-height:36px" onclick="P.noteTerm='${t}';render()">${t === 'A' ? 'Année' : 'T' + t}</button>`).join('')}</div>`
        + `<div id=p_notes_list>${P_SK}</div>`;
    done(h);
    if (!P.grades) {
        const err = await parentLoadGrades();
        if (err) { const el = $('#p_notes_list'); if (el) el.innerHTML = `<p class=p-empty>Impossible de charger les notes.</p>`; return; }
    }
    drawParentNotes(kid);
}

function drawParentNotes(kid) {
    const el = $('#p_notes_list'); if (!el || P.noteChild !== kid.id) return;
    const rows = pGradesOf(kid.id);
    if (!rows.length) { el.innerHTML = `<p class=p-empty>Aucune note enregistrée pour le moment.</p>`; return; }
    const period = P.noteTerm, v = OB.view(OB.agg(rows), period), year = period === 'A';
    if (!v.rows.length) { el.innerHTML = `<p class=p-empty>Aucune note pour cette période.</p>`; return; }
    const detail = {};
    rows.filter(g => year || String(g.term) === period).forEach(g => { (detail[g.subject_name] = detail[g.subject_name] || []).push(g); });
    let h = `<div class=p-sec><h4>Moyennes par cours</h4>` + v.rows.map(r => {
        const list = (detail[r.name] || []).slice().sort((a, b) => a.term - b.term || P_KINDS.indexOf(a.kind) - P_KINDS.indexOf(b.kind) || a.num - b.num);
        return `<details style="margin:4px 0"><summary style="display:flex;justify-content:space-between;gap:8px;cursor:pointer;color:inherit"><span>${esc(r.name)}</span><b class="${r.pct != null && r.pct < 50 ? 'p-due' : 'p-ok'}">${year ? r.cells[3] : r.cells[0] + ' / ' + r.cells[1]} · ${OB.pctTxt(r.pct)}</b></summary>`
            + list.map(g => `<div class=p-row style="font-size:13px;padding-left:10px"><span>${year ? 'T' + g.term + ' · ' : ''}${esc(g.kind)} ${g.num}${g.eval_date ? ' · ' + fdate(g.eval_date) : ''}</span><b>${nf(g.grade)} / ${nf(g.max_grade)}</b></div>`).join('') + `</details>`;
    }).join('') + `</div>`;
    h += `<div class=p-sec style="text-align:center;margin-top:15px"><h4 style="margin-bottom:5px">Pourcentage général</h4><div style="font-size:32px;font-weight:bold;color:${v.pct != null && v.pct >= 50 ? 'var(--ok)' : 'var(--bad)'};font-family:serif">${OB.pctTxt(v.pct)}</div><small>${OB.num(v.tp)} / ${OB.num(v.tm)} points</small><div style="margin-top:6px">${OB.apprOf(v.pct)}</div></div>`
        + `<div style="margin-top:15px"><button onclick="parentGenBulletin('${kid.id}')">📄 Télécharger le bulletin PDF</button></div>`;
    el.innerHTML = h;
}

function parentGenBulletin(studentId) {
    const kid = P.children.find(c => c.id === studentId), rows = pGradesOf(studentId);
    if (!kid || !rows.length) return toast('Aucune note à imprimer.');
    try {
        const b = OB.make(rows, P.noteTerm, { school: (P.school && P.school.name) || 'ORÉA École', cls: rows[0].class_name || '', year: rows[0].class_year || '', name: kid.name });
        OB.save(OB.pdf([b]), 'bulletin-' + OB.slug(kid.name) + '-' + P.noteTerm + '.pdf');
        toast('Bulletin téléchargé');
    } catch (e) { toast('Erreur PDF'); }
}
