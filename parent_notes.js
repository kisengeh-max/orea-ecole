// ORÉA École — Module NOTES pour l'Espace Parent (Lecture & Bulletins)

// 1) Ajout de l'onglet "Notes" dans la navigation du parent
const _origNavView = window.navView;
window.navView = function() {
    let html = _origNavView();
    // On ajoute l'onglet Notes avant l'onglet Scolarité
    if (html.includes('Scolarité')) {
        const notesTab = `<button style="flex:1;background:none;border:none;padding:10px 0;color:${P.tab === 'notes' ? 'var(--gold,#b08a30)' : 'var(--muted,#a8a495)'};font-size:10.5px;font-weight:${P.tab === 'notes' ? 'bold' : 'normal'};cursor:pointer" onclick="P.tab='notes';render()"><div style="font-size:19px;margin-bottom:2px">📝</div>Notes</button>`;
        // On insère avant le bouton Scolarité
        html = html.replace(/<button[^>]*onclick="P\.tab='scolarite'[^>]*>.*?<\/button>/s, notesTab + '$&');
    }
    return html;
};

// 2) Interception du routeur pour afficher la vue Notes
const _origRenderParent = window.render;
window.render = function() {
    if (P.tab === 'notes') {
        parentNotesView();
        return;
    }
    _origRenderParent();
};

// 3) Vue principale des notes pour le parent
async function parentNotesView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">📝 Notes & Bulletins</h2>`;
    
    if (!P.children.length) {
        h += `<div class=p-empty>Ajoutez un enfant pour voir ses notes.</div>`;
        $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
        return;
    }

    // Si un enfant est sélectionné
    if (P.noteChild) {
        const kid = P.children.find(c => c.id === P.noteChild);
        P.noteTerm = P.noteTerm || 1;

        h += `<div class="p-row" style="margin-bottom:10px">
            <button class=ghost style="width:auto;padding:6px 12px;min-height:36px" onclick="P.noteChild=null;render()">← Retour</button>
            <b>${esc(kid.name)}</b>
        </div>`;
        
        h += `<div class="p-row" style="gap:10px;margin-bottom:15px">
            ${[1,2,3].map(t => `<button class="${P.noteTerm === t ? '' : 'ghost'}" style="flex:1;padding:8px;min-height:36px" onclick="P.noteTerm=${t};render()">Trimestre ${t}</button>`).join('')}
        </div>`;

        h += `<div id="p_notes_list">${SK}</div>`;
        $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
        
        drawParentNotes(kid.id, P.noteTerm);
        return;
    }

    // Liste des enfants
    h += P.children.map(c => `
        <div class=p-card onclick="P.noteChild='${c.id}';render()">
            <h3>👤 ${esc(c.name)}</h3>
            <div class=p-line>Voir les notes et bulletins →</div>
        </div>
    `).join('');

    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

// 4) Affichage des notes et calcul des moyennes
async function drawParentNotes(studentId, term) {
    const el = $('#p_notes_list');
    if (!el) return;

    // On récupère les notes avec le nom des matières
    const { data: grades, error } = await db.from('grades').select('*, subjects(name)').eq('student_id', studentId).eq('term', term);
    
    if (error) { el.innerHTML = `<p class=p-empty>Erreur de chargement.</p>`; return; }
    if (!grades || !grades.length) { el.innerHTML = `<p class=p-empty>Aucune note pour ce trimestre.</p>`; return; }

    const bySubj = {};
    grades.forEach(g => { 
        const sName = g.subjects?.name || 'Inconnu';
        if (!bySubj[sName]) bySubj[sName] = [];
        bySubj[sName].push(g); 
    });

    let sumAvg = 0, countSubj = 0;
    
    el.innerHTML = `<div class="p-sec"><h4>Moyennes par cours</h4>` + 
        Object.keys(bySubj).sort().map(subName => {
            const list = bySubj[subName];
            let totalOn20 = 0;
            list.forEach(g => { totalOn20 += (g.grade / g.max_grade) * 20; });
            const avg = totalOn20 / list.length;
            sumAvg += avg;
            countSubj++;
            
            return `<div class=p-row>
                <span>${esc(subName)}</span>
                <b class="${avg >= 10 ? 'p-ok' : 'p-due'}">${nf(avg, 2)} / 20</b>
            </div>`;
        }).join('') + `</div>`;

    const genAvg = countSubj ? sumAvg / countSubj : 0;
    el.innerHTML += `<div class="p-sec" style="text-align:center;margin-top:15px">
        <h4 style="margin-bottom:5px">Moyenne Générale</h4>
        <div style="font-size:32px;font-weight:bold;color:${genAvg >= 10 ? 'var(--ok)' : 'var(--bad)'};font-family:serif">${nf(genAvg, 2)} / 20</div>
    </div>`;

    el.innerHTML += `<div style="margin-top:15px;display:flex;flex-direction:column;gap:10px">
        <button onclick="parentGenBulletin('${studentId}', ${term})">📄 Télécharger le bulletin PDF</button>
    </div>`;

    // On sauvegarde les données pour le PDF
    S.parentBulletinData = { studentId, term, bySubj, genAvg, name: P.children.find(c => c.id === studentId).name };
}

// 5) Fonctions utilitaires pour le PDF (copiées de app.js)
const _pWin = { '€': 128, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151, 'œ': 156, 'Œ': 140 };
const _pWenc = s => String(s ?? '').replace(/[\u202f\u00a0\u2009]/g, ' ').replace(/[\s\S]/g, c => { const k = c.charCodeAt(0); return _pWin[c] ? String.fromCharCode(_pWin[c]) : k < 32 ? ' ' : k < 256 ? c : '?'; }).replace(/[\\()]/g, '\\$&');
const _pDl = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); };
const _pFnm = (k, e) => k + '-' + P.school.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '-' + new Date().toLocaleDateString('sv-SE') + '.' + e;

function _pMkPdf(o) {
    const W = 842, H = 595, M = 28, LH = 13, FS = 8, tw = o.w.reduce((a, b) => a + b, 0), cw = o.w.map(x => x * (W - 2 * M) / tw), rt = o.r || [];
    const tx = v => typeof v === 'number' ? nf(v, v % 1 ? 2 : 0) : String(v ?? ''), wd = s => [...s].reduce((t, c) => t + (c >= '0' && c <= '9' ? 4.45 : ' ,.'.includes(c) ? 2.3 : 4.6), 0);
    const items = o.rows.map(c => ({ c })).concat(o.tot ? [{ c: o.tot, b: 1 }] : []);
    const first = Math.floor((H - 2 * M - 48 - 2 * LH) / LH), other = Math.floor((H - 2 * M - 2 * LH) / LH), pages = [];
    let i = 0; do { const n = pages.length ? other : first; pages.push(items.slice(i, i + n)); i += n; } while (i < items.length);
    const out = []; let off = 0; const put = s => { out.push(s); off += s.length; }; const xr = [];
    const obj = (n, b) => { xr[n] = off; put(n + ' 0 obj\n' + b + '\nendobj\n'); };
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = pages.map((_, k) => 5 + 2 * k);
    obj(2, '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const T = (f, x, y, s) => `BT /${f} ${FS} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${_pWenc(s)}) Tj ET\n`;
    pages.forEach((pg, k) => {
        let s = '', y = H - M, x;
        if (!k) { s += `0.60 0.48 0.17 rg BT /F2 16 Tf ${M} ${y - 14} Td (${_pWenc(o.title)}) Tj ET\n0.4 g BT /F1 9 Tf ${M} ${y - 30} Td (${_pWenc(o.sub)}) Tj ET\n`; y -= 48; }
        y -= 10;
        s += `0.847 0.718 0.416 rg ${M} ${y - 3} ${W - 2 * M} ${LH} re f\n0.07 g\n`;
        x = M; o.head.forEach((h, j) => { s += T('F2', rt.includes(j) ? x + cw[j] - 3 - wd(h) : x + 3, y, h); x += cw[j]; });
        y -= LH;
        pg.forEach((it, r) => {
            if (r % 2 && !it.b) s += `0.97 0.95 0.90 rg ${M} ${y - 3} ${W - 2 * M} ${LH} re f\n`;
            if (it.b) s += `0.847 0.718 0.416 rg ${M} ${y + LH - 3} ${W - 2 * M} 0.8 re f\n`;
            s += '0.07 g\n'; x = M;
            it.c.forEach((v, j) => { let t = tx(v); const m = Math.floor((cw[j] - 6) / 4.3); if (t.length > m) t = t.slice(0, Math.max(1, m - 1)) + '…'; s += T(it.b ? 'F2' : 'F1', rt.includes(j) ? x + cw[j] - 3 - wd(t) : x + 3, y, t); x += cw[j]; });
            y -= LH;
        });
        s += `0.5 g BT /F1 7 Tf ${M} 16 Td (${_pWenc('ORÉA École · page ' + (k + 1) + '/' + pages.length)}) Tj ET\n`;
        obj(5 + 2 * k, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * k} 0 R >>`);
        obj(6 + 2 * k, `<< /Length ${s.length} >>\nstream\n${s}endstream`);
    });
    const n = 5 + 2 * pages.length, xo = off;
    put('xref\n0 ' + n + '\n0000000000 65535 f \n');
    for (let k = 1; k < n; k++) put(String(xr[k]).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xo}\n%%EOF`);
    const str = out.join(''), u = new Uint8Array(str.length); for (let k = 0; k < str.length; k++) u[k] = str.charCodeAt(k) & 255;
    return u;
}

// 6) Génération du PDF côté Parent
function parentGenBulletin(studentId, term) {
    const data = S.parentBulletinData;
    if (!data || data.studentId !== studentId) return toast('Données introuvables');

    const rows = [];
    Object.keys(data.bySubj).sort().forEach(subName => {
        const list = data.bySubj[subName];
        let totalOn20 = 0;
        list.forEach(g => { totalOn20 += (g.grade / g.max_grade) * 20; });
        const avg = totalOn20 / list.length;
        rows.push([subName, nf(avg, 2) + ' / 20', '']);
    });

    const genAvg = data.genAvg;
    const appreciation = genAvg >= 16 ? 'Excellent travail' : genAvg >= 14 ? 'Très bien' : genAvg >= 12 ? 'Bien' : genAvg >= 10 ? 'Passable' : 'Insuffisant';

    const r = {
        name: 'bulletin-' + data.name.replace(/\s+/g, '-'),
        title: 'Bulletin de notes — ' + data.name,
        sub: 'Classe : ' + (P.children.find(c => c.id === studentId)?.class_name || '') + ' · Trimestre ' + term,
        head: ['Cours', 'Moyenne / 20', 'Appréciation'],
        rows: rows, w: [45, 25, 30], r: [1],
        tot: ['MOYENNE GÉNÉRALE', nf(genAvg, 2) + ' / 20', appreciation]
    };

    try {
        const pdfData = _pMkPdf(r);
        _pDl(new Blob([pdfData], { type: 'application/pdf' }), _pFnm(r.name, 'pdf'));
        toast('Bulletin téléchargé');
    } catch (e) { toast('Erreur PDF'); }
           }
