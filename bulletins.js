// ORÉA École — Moteur des bulletins (v40)
// Partagé par l'espace école et l'espace parent. Aucune dépendance à S, P ou db.
// Logique congolaise : pas de coefficients. Moyenne = somme des points / somme des bases.
const OB = (function () {
    const fr = (n, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
    const num = n => fr(Math.round(n * 100) / 100, 2);
    const pctTxt = p => p == null ? '—' : fr(Math.round(p * 10) / 10, 1) + ' %';
    const pctOf = (p, m) => m > 0 ? p / m * 100 : null;
    const apprOf = p => p == null ? '' : p >= 80 ? 'Excellent travail' : p >= 70 ? 'Très bien' : p >= 60 ? 'Bien' : p >= 50 ? 'Passable' : 'Insuffisant';
    const NAMES = { 1: 'Trimestre 1', 2: 'Trimestre 2', 3: 'Trimestre 3', A: 'Année complète' };

    // rows : notes d'UN élève [{subject_id, subject_name, term, grade, max_grade}]
    function agg(rows) {
        const subs = {}, tot = { 1: { p: 0, m: 0 }, 2: { p: 0, m: 0 }, 3: { p: 0, m: 0 } };
        (rows || []).forEach(g => {
            const t = Number(g.term), p = Number(g.grade), m = Number(g.max_grade);
            if (!(t >= 1 && t <= 3) || isNaN(p) || !(m > 0)) return;
            const k = g.subject_id || g.subject_name || '?';
            const o = subs[k] || (subs[k] = { name: g.subject_name || 'Cours', t: { 1: { p: 0, m: 0 }, 2: { p: 0, m: 0 }, 3: { p: 0, m: 0 } } });
            o.t[t].p += p; o.t[t].m += m; tot[t].p += p; tot[t].m += m;
        });
        return { subs, tot };
    }

    // period : '1' | '2' | '3' | 'A'
    function view(a, period) {
        const list = Object.values(a.subs).sort((x, y) => x.name.localeCompare(y.name, 'fr'));
        if (period === 'A') {
            const rows = []; let tp = 0, tm = 0;
            list.forEach(s => {
                const p = s.t[1].p + s.t[2].p + s.t[3].p, m = s.t[1].m + s.t[2].m + s.t[3].m;
                if (!(m > 0)) return;
                rows.push({ name: s.name, pct: pctOf(p, m), cells: [1, 2, 3].map(t => s.t[t].m > 0 ? num(s.t[t].p) + ' / ' + num(s.t[t].m) : '—').concat([num(p) + ' / ' + num(m), pctTxt(pctOf(p, m))]) });
            });
            [1, 2, 3].forEach(t => { tp += a.tot[t].p; tm += a.tot[t].m; });
            return { mode: 'year', rows, tp, tm, pct: pctOf(tp, tm), terms: [1, 2, 3].map(t => pctOf(a.tot[t].p, a.tot[t].m)), totCells: [1, 2, 3].map(t => a.tot[t].m > 0 ? num(a.tot[t].p) + ' / ' + num(a.tot[t].m) : '—').concat([num(tp) + ' / ' + num(tm), pctTxt(pctOf(tp, tm))]) };
        }
        const t = Number(period), rows = [];
        list.forEach(s => { const x = s.t[t]; if (x.m > 0) rows.push({ name: s.name, pct: pctOf(x.p, x.m), cells: [num(x.p), num(x.m), pctTxt(pctOf(x.p, x.m))] }); });
        const tp = a.tot[t].p, tm = a.tot[t].m;
        return { mode: 'term', rows, tp, tm, pct: pctOf(tp, tm), totCells: [num(tp), num(tm), pctTxt(pctOf(tp, tm))] };
    }

    // Prépare un bulletin prêt pour le PDF
    function make(studentRows, period, meta) {
        const v = view(agg(studentRows), period);
        return { school: meta.school || '', cls: meta.cls || '', year: meta.year || '', name: meta.name || '', period: NAMES[period] || '', view: v, appr: meta.appr != null && meta.appr !== '' ? meta.appr : apprOf(v.pct) };
    }

    // ---------- PDF portrait A4 ----------
    const W = 595, H = 842, M = 36;
    const WIN = { '€': 128, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151, 'œ': 156, 'Œ': 140 };
    const enc = s => String(s == null ? '' : s).replace(/[\u202f\u00a0\u2009]/g, ' ').replace(/[\s\S]/g, c => { const k = c.charCodeAt(0); return WIN[c] ? String.fromCharCode(WIN[c]) : k < 32 ? ' ' : k < 256 ? c : '?'; }).replace(/[\\()]/g, '\\$&');
    const wd = (s, z) => [...String(s)].reduce((t, c) => t + (c >= '0' && c <= '9' ? .556 : ' ,.;:/'.includes(c) ? .278 : c >= 'A' && c <= 'Z' ? .68 : c === 'm' || c === 'w' || c === 'M' || c === 'W' ? .8 : .5), 0) * z;
    const cut = (s, max, z) => { s = String(s); if (wd(s, z) <= max) return s; while (s.length > 1 && wd(s + '…', z) > max) s = s.slice(0, -1); return s + '…'; };
    const wrap = (s, max, z) => { const out = []; let cur = ''; String(s).split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (wd(t, z) > max && cur) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur); return out; };
    const GOLD = '0.847 0.718 0.416 rg', DK = '0.07 g', MUT = '0.4 g', ALT = '0.97 0.95 0.90 rg', OK = '0.25 0.48 0.36 rg', BAD = '0.66 0.35 0.31 rg', DG = '0.60 0.48 0.17 rg';

    function pageStream(b, k, n) {
        let s = '';
        const T = (f, z, x, y, t, col) => { s += `${col || DK} BT /${f} ${z} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${enc(t)}) Tj ET\n`; };
        const C = (f, z, y, t, col) => T(f, z, (W - wd(t, z)) / 2, y, t, col);
        const R = (f, z, xr, y, t, col) => T(f, z, xr - wd(t, z), y, t, col);
        let y = H - M - 10;
        C('F2', 18, y, cut(b.school, W - 2 * M, 18), DG); y -= 20;
        C('F2', 12, y, 'BULLETIN SCOLAIRE — ' + b.period.toUpperCase(), DK); y -= 15;
        C('F1', 10, y, 'Année scolaire ' + b.year, MUT); y -= 10;
        s += `${GOLD} ${M} ${y} ${W - 2 * M} 1.2 re f\n`; y -= 20;
        T('F2', 12, M, y, 'Élève : ' + cut(b.name, W - 2 * M - 60, 12)); y -= 16;
        T('F1', 11, M, y, 'Classe : ' + b.cls); y -= 20;

        const v = b.view, year = v.mode === 'year';
        const fr_ = year ? [.26, .15, .15, .15, .17, .12] : [.46, .18, .18, .18];
        const head = year ? ['Cours', 'T1', 'T2', 'T3', 'Total année', '%'] : ['Cours', 'Points', 'Base', '%'];
        const cw = fr_.map(f => f * (W - 2 * M)), reserve = 230;
        const rh = Math.max(13, Math.min(19, (y - reserve - 40) / (v.rows.length + 2)));
        const z = rh < 15 ? 8.5 : 10;
        const row = (cells, yy, bold, lastCol) => {
            let x = M;
            cells.forEach((c, j) => {
                const t = cut(c, cw[j] - 8, z), f = bold ? 'F2' : 'F1', col = j === cells.length - 1 && lastCol ? lastCol : DK;
                if (j === 0) T(f, z, x + 4, yy, t, DK); else R(f, z, x + cw[j] - 4, yy, t, col);
                x += cw[j];
            });
        };
        s += `${GOLD} ${M} ${y - 5} ${W - 2 * M} ${rh + 2} re f\n`;
        row(head, y, true); y -= rh + 2;
        if (!v.rows.length) { T('F1', 10, M + 4, y, 'Aucune note enregistrée pour cette période.', MUT); y -= rh; }
        v.rows.forEach((r, i) => {
            if (i % 2) s += `${ALT} ${M} ${y - 4} ${W - 2 * M} ${rh} re f\n`;
            row([r.name].concat(r.cells), y, false, r.pct != null && r.pct < 50 ? BAD : null);
            y -= rh;
        });
        s += `${GOLD} ${M} ${y + rh - 5} ${W - 2 * M} 1 re f\n`;
        row(['TOTAL'].concat(v.totCells), y, true); y -= rh + 16;

        const pc = pctTxt(v.pct), col = v.pct == null ? MUT : v.pct >= 50 ? OK : BAD;
        s += `${ALT} ${M} ${y - 12} ${W - 2 * M} 34 re f\n`;
        T('F2', 12, M + 10, y, 'POURCENTAGE GÉNÉRAL', DK);
        R('F2', 16, W - M - 10, y - 2, pc, col);
        y -= 20;
        if (year) { T('F1', 9, M + 10, y - 2, 'T1 : ' + pctTxt(v.terms[0]) + '   ·   T2 : ' + pctTxt(v.terms[1]) + '   ·   T3 : ' + pctTxt(v.terms[2]), MUT); y -= 10; }
        y -= 22;
        T('F2', 11, M, y, 'Appréciation', DG); y -= 15;
        wrap(b.appr || '', W - 2 * M, 10).slice(0, 5).forEach(l => { T('F1', 10, M, y, l); y -= 13; });

        const sy = 96, labels = ['Le titulaire', 'Le directeur', 'Les parents'], sw = (W - 2 * M) / 3;
        labels.forEach((l, i) => { const x = M + i * sw; T('F2', 9, x + 6, sy, l, DK); s += `0.6 g ${x + 6} ${sy - 40} ${sw - 24} 0.6 re f\n`; });
        T('F1', 7, M, 22, 'ORÉA École · édité le ' + new Date().toLocaleDateString('fr-FR') + ' · page ' + (k + 1) + '/' + n, '0.5 g');
        return s;
    }

    // bulletins : tableau de bulletins (OB.make) → un PDF, une page par élève
    function pdf(bulletins) {
        const out = []; let off = 0; const put = s => { out.push(s); off += s.length; }; const xr = [];
        const obj = (n, b) => { xr[n] = off; put(n + ' 0 obj\n' + b + '\nendobj\n'); };
        put('%PDF-1.4\n');
        obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
        obj(2, '<< /Type /Pages /Kids [' + bulletins.map((_, k) => (5 + 2 * k) + ' 0 R').join(' ') + '] /Count ' + bulletins.length + ' >>');
        obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        bulletins.forEach((b, k) => {
            const s = pageStream(b, k, bulletins.length);
            obj(5 + 2 * k, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * k} 0 R >>`);
            obj(6 + 2 * k, `<< /Length ${s.length} >>\nstream\n${s}endstream`);
        });
        const n = 5 + 2 * bulletins.length, xo = off;
        put('xref\n0 ' + n + '\n0000000000 65535 f \n');
        for (let k = 1; k < n; k++) put(String(xr[k]).padStart(10, '0') + ' 00000 n \n');
        put(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xo}\n%%EOF`);
        const str = out.join(''), u = new Uint8Array(str.length);
        for (let k = 0; k < str.length; k++) u[k] = str.charCodeAt(k) & 255;
        return u;
    }

    function save(bytes, name) {
        const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), a = document.createElement('a');
        a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 5000);
    }
    const slug = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

    return { NAMES, agg, view, make, pdf, save, slug, pctOf, pctTxt, apprOf, num };
})();
