/* =====================================================================
   ORÉA École v81 — stats.js : 📊 Statistiques de l'école (direction)
   Effectifs (sexe, nouveaux, redoublants), âges, présences, personnel,
   résultats par trimestre, ENAFEP. Export Excel (CSV) et impression / PDF.
   Données : RPC school_stats (étape 16). Menu → Administration.
   ===================================================================== */
(function () {
    'use strict';
    if (typeof db === 'undefined' || typeof S === 'undefined') return;
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const LV = { maternelle: 'Maternelle', primaire: 'Primaire', secondaire: 'Secondaire' };
    const ROLE = r => r === 'directeur_etudes' ? 'Directeur des études' : r === 'directeur' ? (typeof headTitle === 'function' ? headTitle() : 'Chef d’établissement') : ({ enseignant: 'Enseignant', percepteur: 'Percepteur' }[r] || r);
    const pct = (a, b) => b > 0 ? Math.round(1000 * a / b) / 10 : null;
    const P = v => v == null ? '—' : String(v).replace('.', ',') + ' %';
    const MOIS = m => { const [y, k] = m.split('-'); return ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][+k - 1] + ' ' + y; };
    let LAST = null;

    // Tableaux : [{ title, head:[], rows:[[]], foot?:[] , note? }]
    function build(d) {
        const T = [];
        const cl = d.classes || [], sum = k => cl.reduce((a, c) => a + Number(c[k] || 0), 0);
        T.push({ title: 'Effectifs par classe', head: ['Classe', 'Niveau', 'Total', 'Garçons (M)', 'Filles (F)', 'Sexe non précisé', 'Nouveaux', 'Redoublants'],
            rows: cl.map(c => [c.name, LV[c.lvl] || c.lvl, c.total, c.M, c.F, c.nc, c.nouveau, c.redoublant]),
            foot: ['TOTAL', '', sum('total'), sum('M'), sum('F'), sum('nc'), sum('nouveau'), sum('redoublant')],
            note: sum('nc') || sum('sans_naissance') ? `⚠️ À compléter : ${sum('nc')} élève(s) sans sexe, ${sum('sans_naissance')} sans date de naissance (bouton « Fiches élèves » dans chaque classe).` : '' });
        const ag = d.ages || [];
        [...new Set(ag.map(a => a.lvl))].forEach(l => {
            const L = ag.filter(a => a.lvl === l);
            T.push({ title: 'Âges · ' + (LV[l] || l), head: ['Âge', 'Garçons (M)', 'Filles (F)', 'Non précisé', 'Total'],
                rows: L.map(a => [a.age + ' ans', a.M, a.F, a.nc, a.M + a.F + a.nc]),
                foot: ['TOTAL', L.reduce((s, a) => s + a.M, 0), L.reduce((s, a) => s + a.F, 0), L.reduce((s, a) => s + a.nc, 0), L.reduce((s, a) => s + a.M + a.F + a.nc, 0)] });
        });
        const pr = d.presence || [];
        if (pr.length) T.push({ title: 'Présences par classe et par mois', head: ['Classe', 'Mois', 'Présents', 'Retards', 'Absents', 'Taux de présence'],
            rows: pr.map(p => [p.name, MOIS(p.mois), p.presents, p.retards, p.absents, P(pct(p.presents + p.retards, p.total))]) });
        const pe = d.personnel || [];
        T.push({ title: 'Personnel', head: ['Fonction', 'Nombre'], rows: pe.map(p => [ROLE(p.role), p.n]), foot: ['TOTAL', pe.reduce((a, p) => a + p.n, 0)] });
        const po = d.pointage || [];
        if (po.length) T.push({ title: 'Pointage du personnel', head: ['Mois', 'Arrivées enregistrées', 'Personnes'], rows: po.map(p => [MOIS(p.mois), p.jours, p.personnes]) });
        const re = d.resultats || [];
        if (re.length) T.push({ title: 'Résultats (cotes approuvées)', head: ['Classe', 'Trimestre', 'Moyenne', 'Élèves notés', 'Élèves ≥ 50 %', '% de réussite'],
            rows: re.map(r => [r.name, 'T' + r.term, P(r.moyenne), r.eleves, r.reussite, P(pct(r.reussite, r.eleves))]) });
        const en = d.enafep || [];
        if (en.length) T.push({ title: 'ENAFEP', head: ['Année', 'Candidats', 'dont filles', 'Résultats connus', 'Réussis', 'dont filles', 'Taux de réussite'],
            rows: en.map(e => [e.year, e.candidats, e.F, e.connus, e.reussis, e.reussis_F, P(pct(e.reussis, e.connus))]) });
        return T;
    }
    const tableHtml = t => `<div class="card col" style="overflow-x:auto"><b>${E(t.title)}</b>${t.note ? `<small class=due>${E(t.note)}</small>` : ''}<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px"><tr>${t.head.map(h => `<th style="text-align:left;padding:5px;border-bottom:1px solid var(--line)">${E(h)}</th>`).join('')}</tr>${t.rows.length ? t.rows.map(r => `<tr>${r.map(c => `<td style="padding:5px;border-bottom:1px solid var(--line)">${E(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan=${t.head.length} style="padding:6px;color:var(--mut)">Aucune donnée.</td></tr>`}${t.foot ? `<tr>${t.foot.map(c => `<td style="padding:5px;font-weight:700">${E(c)}</td>`).join('')}</tr>` : ''}</table></div>`;

    window.vStats = async function () {
        const back = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>`;
        $('#main').innerHTML = back + `<h3>📊 Statistiques · ${E(S.year || '')}</h3>` + (typeof SK !== 'undefined' ? SK : 'Chargement…');
        const { data, error } = await db.rpc('school_stats', { p_year: S.year || '' });
        if (error) { $('#main').innerHTML = back + `<p class=empty>${E(error.message)}</p>`; return; }
        LAST = { year: S.year, tables: build(data || {}) };
        $('#main').innerHTML = back + `<h3>📊 Statistiques · ${E(S.year || '')}</h3><small>${E(S.school.name)} · calculées le ${new Date().toLocaleDateString('fr-FR')}</small>`
            + `<div class=row style="margin:10px 0"><button class=ghost onclick="statsCsv()">📊 Excel (CSV)</button><button class=ghost onclick="statsPrint()">🖨 Imprimer / PDF</button></div>`
            + (typeof oreaReports === 'function' ? `<button onclick="oreaReports()" style="margin-bottom:10px">📄 Mes rapports statistiques (créer, modifier, imprimer)</button>` : '')
            + LAST.tables.map(tableHtml).join('');
    };
    window.statsCsv = function () {
        if (!LAST) return;
        const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const lines = [[S.school.name, 'Statistiques ' + LAST.year].map(q).join(';'), ''];
        LAST.tables.forEach(t => { lines.push(q(t.title)); lines.push(t.head.map(q).join(';')); t.rows.forEach(r => lines.push(r.map(q).join(';'))); if (t.foot) lines.push(t.foot.map(q).join(';')); lines.push(''); });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        a.download = 'statistiques-' + String(LAST.year || '').replace(/[^0-9a-z-]/gi, '') + '.csv';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        if (typeof toast === 'function') toast('Fichier enregistré dans Téléchargements');
    };
    window.statsPrint = function () { if (LAST) printTables(S.school.name, 'Statistiques ' + (LAST.year || ''), LAST.tables, ''); };
    // v92 : impression commune (statistiques, rapports de l'école, inspecteur)
    function printTables(school, title, tables, comment) {
        const LAST = { year: title, tables };
        const w = window.open('', '_blank'); if (!w) return toast('Autorise les fenêtres pour imprimer.');
        w.document.write(`<!doctype html><html><head><meta charset=utf-8><title>${E(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}tr.f td{font-weight:bold}small{color:#555}</style></head><body><h1>${E(school)}</h1><small>${E(title)} · édité le ${new Date().toLocaleDateString('fr-FR')} · ORÉA École</small>${comment ? `<p style="white-space:pre-wrap;border-left:3px solid #b08a30;padding:6px 10px;background:#faf6ea">${E(comment)}</p>` : ''}`
            + LAST.tables.map(t => `<h2>${E(t.title)}</h2><table><tr>${t.head.map(h => `<th>${E(h)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map(c => `<td>${E(c)}</td>`).join('')}</tr>`).join('')}${t.foot ? `<tr class=f>${t.foot.map(c => `<td>${E(c)}</td>`).join('')}</tr>` : ''}</table>`).join('')
            + `<script>setTimeout(()=>print(),300)<\/script></body></html>`);
        w.document.close();
    };

    window.OreaStats = { build, tableHtml, print: printTables };

    // Menu → Administration : « Statistiques » (direction)
    const oMenu = window.vMenu;
    if (typeof oMenu === 'function' && !oMenu.__st) {
        window.vMenu = function () {
            const r = oMenu.apply(this, arguments);
            try {
                const main = document.getElementById('main'), t = main && main.querySelector('[onclick*="team()"]');
                if (t && typeof dir === 'function' && dir() && !main.querySelector('[onclick*="menuGo(\'stats\')"]')) {
                    const d = document.createElement('div'); d.innerHTML = menuCard('graph', 'Statistiques', 'Effectifs · Présences · Résultats · ENAFEP', "menuGo('stats')"); t.after(d.firstElementChild);
                }
            } catch (_) { }
            return r;
        };
        window.vMenu.__st = true;
    }
})();
