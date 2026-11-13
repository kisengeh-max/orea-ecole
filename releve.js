// ORÉA École v105 — RELEVÉ DE NOTES (document interne, organisé comme le bulletin officiel)
// Ce n'est PAS le bulletin officiel : ni drapeau, ni armoiries, ni en-tête du Ministère, ni code IGE.
// Secondaire : 2 semestres (P1, P2, examen, total) + T.G. Primaire : 3 trimestres (2 périodes + examen).
// Une période = somme des points de la période ramenée au maxima du cours. Examen = 2 × maxima.
// Utilisé par l'espace école (index.html), l'espace parent (parent.html), l'Espace ORÉA et les ambassadeurs (aperçu).
(function () {
    'use strict';
    const G = window;
    const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fr = (n, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 1 : d }).format(n);
    const r1 = n => Math.round(n * 10) / 10;
    const NOTES = ['TB', 'B', 'AB', 'M', 'Mv'];
    const NOTE_L = { TB: 'Très bon', B: 'Bon', AB: 'Assez bon', M: 'Médiocre', Mv: 'Mauvais' };

    // ---------- Structure des colonnes ----------
    const isSec = lv => (lv || 'secondaire') === 'secondaire';
    const nTerms = lv => isSec(lv) ? 2 : 3;
    const termName = (lv, t) => isSec(lv) ? (t === 1 ? '1er semestre' : '2e semestre') : (t === 1 ? '1er trimestre' : t + 'e trimestre');
    // Étapes de publication : P1=1, P2=2, Ex1=3, P3=4, P4=5, Ex2=6, P5=7, P6=8, Ex3=9
    function steps(lv) {
        const L = [];
        for (let t = 1; t <= nTerms(lv); t++) L.push({ k: 'P' + (2 * t - 1), l: 'P' + (2 * t - 1) }, { k: 'P' + 2 * t, l: 'P' + 2 * t }, { k: 'E' + t, l: 'Examen ' + (isSec(lv) ? 'S' : 'T') + t });
        return L;
    }
    function columns(lv) {
        const C = [];
        for (let t = 1; t <= nTerms(lv); t++) C.push({ k: 'P' + (2 * t - 1), h: (2 * t - 1) + (t === 1 ? 're' : 'e') + ' P.', t, per: 2 * t - 1 }, { k: 'P' + 2 * t, h: 2 * t + 'e P.', t, per: 2 * t }, { k: 'E' + t, h: 'Exam.', t, ex: true }, { k: 'T' + t, h: 'Tot.', t, tot: true });
        C.push({ k: 'TG', h: 'T.G.', tg: true });
        return C;
    }
    const colMax = (c, m) => c.tg ? null : c.tot ? null : c.ex ? (m.with_exam ? 2 * m.maxima : null) : m.maxima;
    function courseMax(c, m, lv) {
        if (c.ex) return m.with_exam ? 2 * m.maxima : null;
        if (c.tot) return 2 * m.maxima + (m.with_exam ? 2 * m.maxima : 0);
        if (c.tg) return nTerms(lv) * (2 * m.maxima + (m.with_exam ? 2 * m.maxima : 0));
        return m.maxima;
    }

    // ---------- Calcul pour UN élève ----------
    // rows : [{b: subject_id, t: term, p: period, k: kind, g: grade, m: max_grade}]
    function compute(D, sid) {
        const lv = D.class.level, C = columns(lv);
        const courses = (D.courses || []).filter(x => Number(x.maxima) > 0).map(x => ({ ...x, maxima: Number(x.maxima) }));
        const missing = (D.courses || []).filter(x => !(Number(x.maxima) > 0));
        const raw = {};
        (D.grades || []).filter(g => g.s === sid).forEach(g => {
            const key = g.k === 'Examen' ? 'E' + g.t : (g.p ? 'P' + g.p : null); if (!key) return;
            const o = (raw[g.b] = raw[g.b] || {}), z = (o[key] = o[key] || { p: 0, m: 0 });
            z.p += Number(g.g); z.m += Number(g.m);
        });
        const lines = courses.map(m => {
            const v = {};
            C.forEach(c => {
                if (c.tot || c.tg) return;
                const z = raw[m.id] && raw[m.id][c.k];
                if (c.ex && !m.with_exam) { v[c.k] = null; return; }
                v[c.k] = z && z.m > 0 ? r1(z.p / z.m * (c.ex ? 2 * m.maxima : m.maxima)) : undefined;
            });
            let tg = undefined;
            for (let t = 1; t <= nTerms(lv); t++) {
                const parts = ['P' + (2 * t - 1), 'P' + 2 * t, 'E' + t].map(k => v[k]).filter(x => typeof x === 'number');
                v['T' + t] = parts.length ? r1(parts.reduce((a, b) => a + b, 0)) : undefined;
                if (typeof v['T' + t] === 'number') tg = (tg || 0) + v['T' + t];
            }
            v.TG = tg === undefined ? undefined : r1(tg);
            return { m, v };
        });
        // Totaux (règle : on ne compte que les cours cotés dans la colonne ; sinon « incomplet »)
        const tot = {};
        C.forEach(c => {
            if (c.tot || c.tg) return;
            let p = 0, mx = 0, n = 0, holes = 0;
            lines.forEach(L => {
                const cm = courseMax(c, L.m, lv); if (cm == null) return;
                if (typeof L.v[c.k] === 'number') { p += L.v[c.k]; mx += cm; n++; } else holes++;
            });
            tot[c.k] = n ? { p: r1(p), m: mx, pct: mx > 0 ? p / mx * 100 : null, inc: holes > 0 } : null;
        });
        // Total du semestre / trimestre et T.G. : somme des colonnes déjà cotées (pas de pourcentage faussé par une période à venir)
        const sum = L => { L = L.filter(Boolean); if (!L.length) return null; const p = L.reduce((a, b) => a + b.p, 0), m = L.reduce((a, b) => a + b.m, 0); return { p: r1(p), m, pct: m > 0 ? p / m * 100 : null, inc: L.some(x => x.inc) }; };
        for (let t = 1; t <= nTerms(lv); t++) tot['T' + t] = sum(['P' + (2 * t - 1), 'P' + 2 * t, 'E' + t].map(k => tot[k]));
        tot.TG = sum(Array.from({ length: nTerms(lv) }, (_, i) => tot['T' + (i + 1)]));
        const cond = {};
        (D.conduct || []).filter(x => x.s === sid).forEach(x => { cond['P' + x.p] = { a: x.a, c: x.c }; });
        const dec = (D.decisions || []).find(x => x.s === sid) || null;
        return { lv, C, lines, missing, tot, cond, dec };
    }

    // ---------- Places dans la classe ----------
    function ranks(D, sid, R) {
        const out = {};
        let list;
        if (D.stats) {   // parent : totaux anonymes calculés par la base
            list = D.stats.map(x => {
                const t = {}, C = R.C;
                C.forEach(c => {
                    if (c.tot || c.tg) return;
                    const z = x.c && x.c[c.k]; if (z) t[c.k] = { p: Number(z[0]), m: Number(z[1]) };
                });
                for (let k = 1; k <= nTerms(R.lv); k++) {
                    const parts = ['P' + (2 * k - 1), 'P' + 2 * k, 'E' + k].map(q => t[q]).filter(Boolean);
                    if (parts.length) t['T' + k] = { p: parts.reduce((a, b) => a + b.p, 0), m: parts.reduce((a, b) => a + b.m, 0) };
                }
                const all = Object.keys(t).filter(k => k[0] === 'T').map(k => t[k]);
                if (all.length) t.TG = { p: all.reduce((a, b) => a + b.p, 0), m: all.reduce((a, b) => a + b.m, 0) };
                return { me: x.me, t };
            });
        } else {         // direction / titulaire : calcul pour chaque élève de la classe
            const ids = [...new Set((D.grades || []).map(g => g.s))];
            list = ids.map(id => { const X = id === sid ? R : compute(D, id), t = {}; Object.keys(X.tot).forEach(k => { if (X.tot[k]) t[k] = { p: X.tot[k].p, m: X.tot[k].m }; }); return { me: id === sid, t }; });
        }
        R.C.forEach(c => {
            const vals = list.filter(x => x.t[c.k] && x.t[c.k].m > 0).map(x => ({ me: x.me, v: x.t[c.k].p / x.t[c.k].m }));
            const mine = vals.find(x => x.me); if (!mine) return;
            out[c.k] = { place: 1 + vals.filter(x => x.v > mine.v + 1e-9).length, n: vals.length };
        });
        return out;
    }

    // ---------- Regroupement des cours ----------
    function groups(R) {
        const G2 = {}, order = [];
        const sec = isSec(R.lv);
        R.lines.forEach(L => {
            const k = (!sec && L.m.grp) ? 'g:' + L.m.grp : 'm:' + String(L.m.maxima).padStart(4, '0');
            if (!G2[k]) { G2[k] = { k, label: (!sec && L.m.grp) ? L.m.grp : null, maxima: L.m.maxima, lines: [] }; order.push(k); }
            G2[k].lines.push(L);
        });
        order.sort((a, b) => a[0] !== b[0] ? (a[0] === 'g' ? -1 : 1) : a.localeCompare(b, 'fr'));
        return order.map(k => G2[k]);
    }

    const cell = (v, hatch) => hatch ? { h: true } : { s: typeof v === 'number' ? fr(v) : '' };
    // Modèle commun (écran + PDF) : en-têtes, lignes, bas du relevé
    function model(D, sid, info) {
        const R = compute(D, sid), rk = ranks(D, sid, R), C = R.C, lv = R.lv, sec = isSec(lv);
        const rows = [];
        groups(R).forEach(g => {
            if (sec || !g.label) {
                // « MAXIMA » comme sur le bulletin officiel : maxima de chaque colonne pour ce groupe
                const m0 = g.lines[0].m;
                rows.push({ type: 'max', name: 'MAXIMA', cells: C.map(c => { const v = courseMax(c, m0, lv); return v == null ? { h: true } : { s: fr(v) }; }) });
            } else rows.push({ type: 'grp', name: g.label });
            g.lines.forEach(L => rows.push({ type: 'line', name: L.m.name, mx: !sec ? L.m.maxima : null, cells: C.map(c => cell(L.v[c.k], c.ex && !L.m.with_exam)) }));
            if (!sec && g.label) {
                rows.push({
                    type: 'sub', name: 'Sous-total', cells: C.map(c => {
                        let p = 0, m = 0, n = 0; g.lines.forEach(L => { const cm = courseMax(c, L.m, lv); if (cm != null && typeof L.v[c.k] === 'number') { p += L.v[c.k]; m += cm; n++; } });
                        return n ? { s: fr(r1(p)) + ' / ' + fr(m) } : { s: '' };
                    })
                });
            }
        });
        const T = R.tot;
        const foot = [
            { name: 'MAXIMA GÉNÉRAUX', cells: C.map(c => ({ s: T[c.k] ? fr(T[c.k].m) : '' })) },
            { name: 'TOTAUX', cells: C.map(c => ({ s: T[c.k] ? fr(T[c.k].p) : '' })) },
            { name: 'POURCENTAGE', cells: C.map(c => ({ s: T[c.k] && T[c.k].pct != null ? fr(r1(T[c.k].pct)) + ' %' + (T[c.k].inc ? '*' : '') : '' })) },
            { name: 'PLACE / NBRE D’ÉLÈVES', cells: C.map(c => ({ s: rk[c.k] ? rk[c.k].place + ' / ' + rk[c.k].n : '' })) },
            { name: 'APPLICATION', cells: C.map(c => c.per ? { s: (R.cond[c.k] && R.cond[c.k].a) || '' } : { h: true }) },
            { name: 'CONDUITE', cells: C.map(c => c.per ? { s: (R.cond[c.k] && R.cond[c.k].c) || '' } : { h: true }) }
        ];
        const inc = C.some(c => T[c.k] && T[c.k].inc);
        // Fin d'année
        const grade = Number(D.class.grade) || 0, tg = T.TG;
        let end = null;
        if (sec && grade === 4) {
            const x = (R.dec && R.dec.exetat) || {};
            end = { kind: 'exetat', mec: x.mec != null ? x.mec : '', pts: x.pts != null ? x.pts : '', max: x.max != null ? x.max : '', pct: x.pct != null ? x.pct : '', res: x.res || '' };
        } else if (!sec && grade === 6) {
            const moy = tg && tg.pct != null ? r1(tg.pct / 2) : null, en = R.dec && R.dec.enafep != null ? Number(R.dec.enafep) : null;
            end = { kind: 'enafep', moy, en, tot: moy != null && en != null ? r1(moy + en) : null, dec: R.dec && R.dec.decision };
        } else end = { kind: 'dec', dec: R.dec && R.dec.decision, rep: (R.dec && R.dec.repech) || [], courses: D.courses || [] };
        return { R, C, lv, sec, rows, foot, inc, end, info, D, missing: R.missing };
    }

    // ---------- Affichage écran ----------
    const CSS = '.rn-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px;margin:10px 0}'
        + '.rn{border-collapse:collapse;width:100%;min-width:640px;font-size:12.5px;font-variant-numeric:tabular-nums}'
        + '.rn th,.rn td{border:1px solid var(--line);padding:5px 6px;text-align:center;white-space:nowrap}'
        + '.rn td.n{text-align:left;white-space:normal;min-width:150px}.rn th{font-size:11px;color:var(--mut);font-weight:700}'
        + '.rn tr.max td,.rn tr.ft td{font-weight:700}.rn tr.max td{background:rgba(199,163,75,.10);color:var(--gold)}'
        + '.rn tr.grp td{font-weight:800;text-align:left;background:rgba(199,163,75,.07)}.rn tr.sub td{font-weight:700;font-size:11.5px}'
        + '.rn td.h,.rn tr.max td.h{background:repeating-linear-gradient(90deg,var(--line) 0 2px,transparent 2px 5px)}.rn .tg{background:rgba(199,163,75,.06)}'
        + '.rn-head{text-align:center;margin:6px 0 4px}.rn-head b{font-family:var(--serif);font-size:20px;color:var(--gold);letter-spacing:.08em}'
        + '.rn-legal{font-size:11.5px;color:var(--mut);text-align:center;margin:2px 0 8px}'
        + '.rn-id{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;font-size:13px;margin:6px 0}.rn-id span{color:var(--mut)}'
        + '.rn-end{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:10px 0;font-size:13.5px}'
        + '.rn-warn{border:1px solid var(--gold);border-radius:12px;padding:10px 14px;margin:8px 0;font-size:13px}'
        + '.rn-tools{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.rn-tools button{width:auto;flex:1 1 150px;margin:0}'
        + '.rn-grid{display:grid;grid-template-columns:1fr auto auto;gap:6px 8px;align-items:center}.rn-grid select{margin:0;min-height:38px;padding:4px 8px;width:auto}';
    if (!document.getElementById('rn-css')) document.head.insertAdjacentHTML('beforeend', '<style id="rn-css">' + CSS + '</style>');

    function html(M) {
        const { C, info } = M, nt = nTerms(M.lv);
        let h = `<div class=rn-head><b>RELEVÉ DE NOTES</b></div><div class=rn-legal>Document interne de l’école — ne remplace pas le bulletin officiel.</div>`
            + `<div class=rn-id><div><span>École :</span> ${E(info.school)}</div><div><span>Année scolaire :</span> ${E(info.year || '')}</div><div><span>Élève :</span> <b>${E(info.student)}</b></div><div><span>Classe :</span> ${E(info.cls)}${info.sexe ? ' · <span>Sexe :</span> ' + E(info.sexe) : ''}</div></div>`;
        if (M.missing.length) h += `<div class=rn-warn>Maxima à régler pour : ${M.missing.map(x => E(x.name)).join(', ')}. Ces cours n’apparaissent pas encore (Menu → Cours des classes).</div>`;
        h += `<div class=rn-wrap><table class=rn><thead><tr><th rowspan=2>BRANCHES</th>${M.sec ? '' : '<th rowspan=2>Max</th>'}`;
        for (let t = 1; t <= nt; t++) h += `<th colspan=4>${termName(M.lv, t).toUpperCase()}</th>`;
        h += `<th rowspan=2>T.G.</th></tr><tr>${C.filter(c => !c.tg).map(c => `<th>${c.h}</th>`).join('')}</tr></thead><tbody>`;
        const td = (x, c) => x.h ? '<td class=h></td>' : `<td${c && c.tg ? ' class=tg' : ''}>${E(x.s)}</td>`;
        M.rows.forEach(r => {
            if (r.type === 'grp') { h += `<tr class=grp><td colspan=${C.length + (M.sec ? 1 : 2)}>${E(r.name)}</td></tr>`; return; }
            h += `<tr class="${r.type}"><td class=n>${E(r.name)}</td>${M.sec ? '' : `<td>${r.mx != null ? fr(r.mx) : ''}</td>`}${r.cells.map((x, i) => td(x, C[i])).join('')}</tr>`;
        });
        M.foot.forEach(r => { h += `<tr class=ft><td class=n>${E(r.name)}</td>${M.sec ? '' : '<td></td>'}${r.cells.map((x, i) => td(x, C[i])).join('')}</tr>`; });
        h += `</tbody></table></div>`;
        if (M.inc) h += `<small>* Pourcentage calculé sur les cours cotés (relevé incomplet).</small>`;
        h += endHtml(M);
        h += `<div class=rn-id style="margin-top:10px"><div><span>Le titulaire</span></div><div><span>Le chef d’établissement · Sceau de l’école</span></div></div>`;
        return h;
    }
    function endHtml(M) {
        const e = M.end; if (!e) return '';
        if (e.kind === 'exetat') return `<div class=rn-end><b>Examen d’État</b><br>MEC : ${E(e.mec) || '—'} · Points obtenus : ${E(e.pts) || '—'} / ${E(e.max) || '—'} · ${e.pct !== '' ? E(e.pct) + ' %' : '—'}<br>Résultat final : ${e.res === 'diplome' ? 'Diplôme avec ' + E(e.pct) + ' %' : e.res === 'echec' ? 'A échoué' : '—'}</div>`;
        if (e.kind === 'enafep') return `<div class=rn-end><b>Résultat final</b><br>Moyenne école : ${e.moy != null ? fr(e.moy) : '—'} / 50 · ENAFEP : ${e.en != null ? fr(e.en) : '—'} / 50 · Total : ${e.tot != null ? fr(e.tot) : '—'} / 100${e.dec ? '<br>Décision : ' + decTxt(e.dec) : ''}</div>`;
        const rep = (e.rep || []).map(x => { const c = e.courses.find(y => y.id === x.b); return (c ? c.name : 'Cours') + (x.pct != null && x.pct !== '' ? ' (' + fr(Number(x.pct)) + ' %)' : ''); });
        return `<div class=rn-end><b>Décision</b> : ${e.dec ? decTxt(e.dec) : '—'}${e.dec === 'repechage' && rep.length ? '<br>Repêchage en : ' + E(rep.join(', ')) : ''}</div>`;
    }
    const decTxt = d => d === 'passe' ? 'L’élève passe dans la classe supérieure' : d === 'double' ? 'L’élève double la classe' : d === 'repechage' ? 'Examen de repêchage' : '—';

    // ---------- PDF (A4, sans bibliothèque) ----------
    const PW = 595, PH = 842;
    const win = s => String(s == null ? '' : s).replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/œ/g, 'oe').replace(/\u202f|\u00a0/g, ' ').replace(/[^\x20-\xff]/g, '');
    const pesc = s => win(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const tw = (s, z, b) => win(s).length * z * (b ? 0.56 : 0.52);
    function page(M) {
        const o = [], C = M.C, nt = nTerms(M.lv), x0 = 28, wTot = PW - 56;
        const txt = (s, x, y, z, b, al) => { const w = tw(s, z, b); const xx = al === 'c' ? x - w / 2 : al === 'r' ? x - w : x; o.push(`BT /${b ? 'F2' : 'F1'} ${z} Tf ${xx.toFixed(1)} ${y.toFixed(1)} Td (${pesc(s)}) Tj ET`); };
        const rect = (x, y, w, h, fill) => o.push(fill ? `${fill} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f 0 g` : `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S`);
        o.push('0.5 w 0 g');
        let y = PH - 40;
        txt(M.info.school, PW / 2, y, 12, true, 'c'); y -= 20;
        txt('RELEVÉ DE NOTES', PW / 2, y, 15, true, 'c'); y -= 13;
        txt('Document interne de l\'école - ne remplace pas le bulletin officiel.', PW / 2, y, 7.5, false, 'c'); y -= 18;
        txt('Élève : ' + M.info.student, x0, y, 9.5, true); txt('Année scolaire : ' + (M.info.year || ''), PW - x0, y, 9, false, 'r'); y -= 13;
        txt('Classe : ' + M.info.cls + (M.info.sexe ? '   Sexe : ' + M.info.sexe : ''), x0, y, 9, false); y -= 14;
        const wName = M.sec ? 168 : 150, wMax = M.sec ? 0 : 24, wc = (wTot - wName - wMax) / C.length, rh = 12.5, z = M.sec ? 7.5 : 6.8;
        const colX = i => x0 + wName + wMax + i * wc;
        // En-têtes
        const top = y; rect(x0, y - 2 * rh, wName, 2 * rh); txt('BRANCHES', x0 + wName / 2, y - rh - 3, 7.5, true, 'c');
        if (!M.sec) { rect(x0 + wName, y - 2 * rh, wMax, 2 * rh); txt('Max', x0 + wName + wMax / 2, y - rh - 3, z, true, 'c'); }
        for (let t = 1; t <= nt; t++) { const i = (t - 1) * 4; rect(colX(i), y - rh, 4 * wc, rh); txt(termName(M.lv, t).toUpperCase(), colX(i) + 2 * wc, y - rh + 3.5, z, true, 'c'); }
        rect(colX(C.length - 1), y - 2 * rh, wc, 2 * rh); txt('T.G.', colX(C.length - 1) + wc / 2, y - rh - 3, z, true, 'c');
        C.forEach((c, i) => { if (c.tg) return; rect(colX(i), y - 2 * rh, wc, rh); txt(c.h, colX(i) + wc / 2, y - 2 * rh + 3.5, z, true, 'c'); });
        y = top - 2 * rh;
        const line = (r, bold, fill) => {
            if (fill) rect(x0, y - rh, wTot, rh, fill);
            rect(x0, y - rh, wName, rh);
            let nm = r.name, fz = r.type === 'grp' ? 7.5 : z; while (tw(nm, fz, bold) > wName - 6 && nm.length > 4) nm = nm.slice(0, -2);
            txt(nm === r.name ? nm : nm + '.', x0 + 3, y - rh + 3.6, fz, bold);
            if (r.type === 'grp') { rect(x0 + wName, y - rh, wTot - wName, rh); y -= rh; return; }
            if (!M.sec) { rect(x0 + wName, y - rh, wMax, rh); if (r.mx != null) txt(fr(r.mx), x0 + wName + wMax / 2, y - rh + 3.6, z, false, 'c'); }
            r.cells.forEach((x, i) => { if (x.h) rect(colX(i), y - rh, wc, rh, '0.82 0.82 0.82'); rect(colX(i), y - rh, wc, rh); if (!x.h && x.s) txt(x.s, colX(i) + wc / 2, y - rh + 3.6, r.type === 'sub' ? z - 0.6 : z, bold, 'c'); });
            y -= rh;
        };
        M.rows.forEach(r => line(r, r.type !== 'line', r.type === 'max' ? '0.93 0.9 0.82' : r.type === 'grp' ? '0.95 0.93 0.87' : null));
        M.foot.forEach(r => line(r, true, null));
        y -= 6;
        if (M.inc) { txt('* Pourcentage calculé sur les cours cotés (relevé incomplet).', x0, y - 8, 7); y -= 12; }
        // Fin d'année
        const e = M.end; y -= 8;
        if (e && e.kind === 'exetat') {
            txt('EXAMEN D\'ÉTAT', x0, y, 9, true); y -= 12;
            txt('MEC : ' + (e.mec || '-') + '    Points obtenus : ' + (e.pts || '-') + ' / ' + (e.max || '-') + '    ' + (e.pct !== '' ? e.pct + ' %' : ''), x0, y, 8.5); y -= 12;
            txt('Résultat final : ' + (e.res === 'diplome' ? 'Diplôme avec ' + e.pct + ' %' : e.res === 'echec' ? 'A échoué' : '-'), x0, y, 8.5); y -= 14;
        } else if (e && e.kind === 'enafep') {
            txt('RÉSULTAT FINAL', x0, y, 9, true); y -= 12;
            txt('Moyenne école : ' + (e.moy != null ? fr(e.moy) : '-') + ' / 50    ENAFEP : ' + (e.en != null ? fr(e.en) : '-') + ' / 50    Total : ' + (e.tot != null ? fr(e.tot) : '-') + ' / 100', x0, y, 8.5); y -= 12;
            if (e.dec) { txt('Décision : ' + decTxt(e.dec), x0, y, 8.5); y -= 14; }
        } else if (e) {
            const rep = (e.rep || []).map(q => { const c = e.courses.find(w => w.id === q.b); return (c ? c.name : 'Cours') + (q.pct != null && q.pct !== '' ? ' (' + fr(Number(q.pct)) + ' %)' : ''); });
            txt('Décision : ' + (e.dec ? decTxt(e.dec) : '-'), x0, y, 8.5); y -= 12;
            if (e.dec === 'repechage' && rep.length) { txt('Repêchage en : ' + rep.join(', '), x0, y, 8); y -= 12; }
        }
        y -= 16;
        txt('Fait à ........................................, le ..... / ..... / ..........', PW - x0, y, 8, false, 'r'); y -= 22;
        txt('Le titulaire', x0 + 60, y, 9, true, 'c'); txt('Sceau de l\'école', PW / 2, y, 9, true, 'c'); txt('Le chef d\'établissement', PW - x0 - 70, y, 9, true, 'c');
        txt('Relevé de notes ORÉA École - document interne, sans valeur officielle.', PW / 2, 22, 6.5, false, 'c');
        return o.join('\n') + '\n';
    }
    function pdf(models) {
        const out = []; let off = 0; const put = s => { out.push(s); off += s.length; }; const xr = [];
        const obj = (n, b) => { xr[n] = off; put(n + ' 0 obj\n' + b + '\nendobj\n'); };
        put('%PDF-1.4\n');
        obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
        obj(2, '<< /Type /Pages /Kids [' + models.map((_, k) => (5 + 2 * k) + ' 0 R').join(' ') + '] /Count ' + models.length + ' >>');
        obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        models.forEach((M, k) => {
            const s = page(M);
            obj(5 + 2 * k, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * k} 0 R >>`);
            obj(6 + 2 * k, `<< /Length ${s.length} >>\nstream\n${s}endstream`);
        });
        const n = 5 + 2 * models.length, xo = off;
        put('xref\n0 ' + n + '\n0000000000 65535 f \n');
        for (let k = 1; k < n; k++) put(String(xr[k]).padStart(10, '0') + ' 00000 n \n');
        put(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xo}\n%%EOF`);
        const str = out.join(''), u = new Uint8Array(str.length);
        for (let k = 0; k < str.length; k++) u[k] = str.charCodeAt(k) & 255;
        return u;
    }
    function savePdf(models, name) {
        const u = pdf(models);
        if (typeof OB !== 'undefined' && OB && typeof OB.save === 'function') return OB.save(u, name);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type: 'application/pdf' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    }
    const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'releve';

    // ---------- Aperçu (exemple fictif, sans cotes réelles) ----------
    function demoData(lv) {
        const sec = isSec(lv);
        const C = sec
            ? [['Religion', 10, true], ['Éducation à la vie', 10, true], ['Éducation civique et morale', 10, true], ['Géographie économique', 20, true], ['Fiscalité', 20, true], ['Mathématiques générales', 20, true], ['Activités complémentaires', 20, false], ['Anglais', 40, true], ['Français', 60, true], ['Informatique', 60, true], ['Comptabilité générale', 100, true], ['Pratique professionnelle', 100, false]]
            : [['Grammaire et conjugaison', 10, true, 'Langues congolaises'], ['Orthographe et rédaction', 10, true, 'Langues congolaises'], ['Expression orale et vocabulaire', 10, true, 'Français'], ['Orthographe', 10, true, 'Français'], ['Grammaire, conjugaison, analyse', 20, true, 'Français'], ['Numération', 10, true, 'Mathématiques'], ['Opérations', 10, true, 'Mathématiques'], ['Problèmes', 20, true, 'Mathématiques'], ['Sciences', 10, true, 'Sciences'], ['Histoire', 10, true, 'Univers social'], ['Géographie', 10, true, 'Univers social']];
        const courses = C.map((c, i) => ({ id: 'd' + i, name: c[0], maxima: c[1], with_exam: c[2], grp: c[3] || '' }));
        let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
        const grades = [], studs = ['me', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
        studs.forEach((s, si) => courses.forEach(c => {
            for (let t = 1; t <= nTerms(lv); t++) {
                [2 * t - 1, 2 * t].forEach(p => { [10, 10].forEach(m => grades.push({ s, b: c.id, t, p, k: 'Devoir', g: Math.round((0.45 + rnd() * 0.5 - si * 0.02) * m), m })); });
                if (c.with_exam) grades.push({ s, b: c.id, t, p: null, k: 'Examen', g: Math.round((0.45 + rnd() * 0.5 - si * 0.02) * 40), m: 40 });
            }
        }));
        const conduct = [];
        for (let p = 1; p <= 2 * nTerms(lv); p++) conduct.push({ s: 'me', p, a: NOTES[Math.floor(rnd() * 3)], c: NOTES[Math.floor(rnd() * 2)] });
        return { class: { name: sec ? '1re Commerciale A' : '6e A', year: '2026-2027', level: lv, grade: sec ? 1 : 6, option: sec ? 'Commerciale et gestion' : '', school: 'École exemple' }, staff: true, upto: 9, courses, grades, conduct, decisions: [{ s: 'me', decision: 'passe', repech: [], enafep: sec ? null : 38, exetat: {} }], stats: null };
    }
    function demo(lv0) {
        let lv = lv0 || 'secondaire';
        const draw = () => {
            const D = demoData(lv), M = model(D, 'me', { school: 'École exemple', year: '2026-2027', student: 'Élève exemple', cls: D.class.name, sexe: 'F' });
            const d = show(`<h3>Aperçu du relevé de notes</h3><small>Exemple fictif : aucune vraie cote. Il montre comment le relevé se présente.</small>
                <div class=chips style="margin:8px 0"><button class="chip ${isSec(lv) ? 'on' : ''}" data-lv=secondaire>Secondaire</button><button class="chip ${isSec(lv) ? '' : 'on'}" data-lv=primaire>Primaire (6e)</button></div>
                ${html(M)}<div class=rn-tools><button id=rn_dpdf>Télécharger l’exemple (PDF)</button><button class=ghost onclick="this.closest('dialog').close()">Fermer</button></div>`);
            d.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { lv = b.dataset.lv; draw(); });
            d.querySelector('#rn_dpdf').onclick = () => savePdf([M], 'releve-exemple-' + lv + '.pdf');
        };
        draw();
    }
    G.oreaReleveDemo = demo;
    G.oreaReleveDemoBtn = () => '<div class="card col" style="gap:8px"><b>Relevé de notes</b><small>Voir à quoi ressemble le relevé, avec un exemple fictif.</small><button class=ghost onclick="oreaReleveDemo()">Aperçu du relevé de notes</button></div>';
    G.oreaReleve = { compute, model, html, pdf, savePdf, steps, columns, termName, NOTES, NOTE_L, slug, isSec };

    // =====================================================================
    //  ESPACE PARENT (parent.html) : relevé de son enfant, tel que publié par l'école
    // =====================================================================
    if (typeof P !== 'undefined' && document.getElementById('pmain')) {
        G.parentReleve = async function (kidId) {
            const kid = (P.children || []).find(c => c.id === kidId); if (!kid) return;
            const el = document.getElementById('p_notes_list'); if (!el) return;
            el.innerHTML = '<div class=sk></div><div class=sk></div>';
            const { data, error } = await db.rpc('v105_releve', { p_class: null, p_student: kidId });
            if (error) { el.innerHTML = `<p class=p-empty>${E(error.message)}</p>`; return; }
            if (!data.upto) { el.innerHTML = '<p class=p-empty>L’école n’a pas encore publié le relevé de notes.</p>'; return; }
            const st = steps(data.class.level);
            const M = model(data, kidId, { school: data.class.school, year: data.class.year, student: kid.name, cls: data.class.name + (data.class.option ? ' · ' + data.class.option : ''), sexe: '' });
            el.innerHTML = `<small>Publié jusqu’à : ${E(st[data.upto - 1].l)}</small>` + html(M) + `<button id=rn_ppdf>Télécharger le relevé (PDF)</button>`;
            document.getElementById('rn_ppdf').onclick = () => { try { savePdf([M], 'releve-' + slug(kid.name) + '.pdf'); } catch (x) { toast('Erreur PDF : ' + x.message); } };
        };
    }

    // =====================================================================
    //  ESPACE ÉCOLE (index.html)
    // =====================================================================
    if (typeof S === 'undefined' || typeof show !== 'function' || !document.getElementById('main')) return;
    const isDirection = () => S.me && S.me.role === 'directeur';
    const isTit = c => c && S.me && c.titulaire_id === S.me.id;
    const myClasses = () => (typeof yc === 'function' ? yc() : (S.classes || [])).filter(c => isDirection() || isTit(c));
    S.rn = { D: null, cls: null, stu: null, tok: 0 };

    // Menu → « Relevés de notes »
    G.oreaRelevesMenu = function () {
        const L = myClasses();
        if (!L.length) return toast(isDirection() ? 'Créez d’abord une classe.' : 'Vous n’êtes titulaire d’aucune classe. La direction vous désigne dans « Équipe & Cours ».');
        const d = show(`<h3>Relevés de notes</h3><small>Choisissez une classe.</small><div class=cc-list style="max-height:56vh;overflow-y:auto;margin:10px 0">${L.map(c => `<button type=button class="card cc-cls" data-c="${E(c.id)}"><b>${E(c.name)}</b><small>${E(c.option || '')}</small></button>`).join('')}</div>
            ${isDirection() ? '<button class=ghost onclick="oreaReleveDemo()">Aperçu avec un exemple</button>' : ''}<button class=ghost onclick="this.closest('dialog').close()">Fermer</button>`);
        d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { d.close(); S.cls = b.dataset.c; S.rn.stu = null; S.rn.D = null; setTimeout(() => G.openBulletins(), 60); });
    };
    G.openBulletins = function () {
        const c = (S.classes || []).find(x => x.id === S.cls);
        if (!c || !(isDirection() || isTit(c))) return toast('Réservé à la direction et au titulaire de la classe.');
        if (S.offline) return toast('Hors connexion : le relevé de notes demande internet.');
        S.rn.D = null; history.pushState({ cot: 1 }, ''); S.tab = 'bulletins'; render();
    };
    async function load(force) {
        if (S.rn.D && S.rn.cls === S.cls && !force) return S.rn.D;
        const { data, error } = await db.rpc('v105_releve', { p_class: S.cls, p_student: null });
        if (error) throw error;
        S.rn.D = data; S.rn.cls = S.cls; return data;
    }
    const stuOf = id => (S.stu || []).find(s => s.id === id);
    const classStudents = () => (S.stu || []).filter(s => s.class_id === S.cls).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const infoOf = (D, s) => ({ school: (S.school && S.school.name) || D.class.school || '', year: D.class.year, student: s ? s.name : '', cls: D.class.name + (D.class.option ? ' · ' + D.class.option : ''), sexe: s && (s.sexe || s.sex) ? String(s.sexe || s.sex).toUpperCase().slice(0, 1) : '' });

    G.vBulletins = async function () {
        const c = (S.classes || []).find(x => x.id === S.cls); if (!c) { S.tab = 'eleves'; return render(); }
        const tok = ++S.rn.tok;
        let h = `<div class=bar><button class=ghost style="width:auto" onclick="cotBack()">← ${E(c.name)}</button><b class=ctitle>Relevé de notes</b></div>`;
        $('#main').innerHTML = h + SK;
        let D;
        try { D = await load(); } catch (x) { if (tok === S.rn.tok) $('#main').innerHTML = h + `<p class=empty>${E(x.message || x)}</p>`; return; }
        if (tok !== S.rn.tok || S.tab !== 'bulletins') return;
        const L = classStudents();
        if (!S.rn.stu || !L.some(s => s.id === S.rn.stu)) S.rn.stu = L[0] ? L[0].id : null;
        const st = steps(D.class.level), dirx = isDirection() && !S.me.secretariat;
        h += `<div class=rn-tools>`
            + `<button class=ghost onclick="rnConduct()">Application et conduite</button>`
            + (dirx ? `<button class=ghost onclick="rnDecisions()">Décisions de fin d’année</button><button class=ghost onclick="rnPublish()">Publication aux parents</button>` : '')
            + `<button class=ghost onclick="oreaReleveDemo('${E(D.class.level)}')">Aperçu avec un exemple</button></div>`
            + `<small>Visible par les parents : ${D.upto ? 'jusqu’à ' + E(st[D.upto - 1].l) : 'pas encore publié'}.</small>`;
        if (!L.length) { $('#main').innerHTML = h + '<p class=empty>Aucun élève dans cette classe.</p>'; return; }
        h += `<label style="display:block;margin-top:12px">Élève<select id=rn_stu>${L.map(s => `<option value="${E(s.id)}" ${s.id === S.rn.stu ? 'selected' : ''}>${E(s.name)}</option>`).join('')}</select></label>`;
        const s = stuOf(S.rn.stu), M = model(D, S.rn.stu, infoOf(D, s));
        h += html(M) + `<div class=rn-tools><button onclick="rnPdf(false)">PDF de cet élève</button><button class=ghost onclick="rnPdf(true)">PDF de toute la classe</button></div>`;
        $('#main').innerHTML = h;
        $('#rn_stu').onchange = e => { S.rn.stu = e.target.value; G.vBulletins(); };
    };
    G.rnPdf = function (all) {
        const D = S.rn.D; if (!D) return;
        const L = all ? classStudents() : [stuOf(S.rn.stu)].filter(Boolean);
        try { savePdf(L.map(s => model(D, s.id, infoOf(D, s))), 'releve-' + slug(D.class.name) + (all ? '' : '-' + slug(L[0] && L[0].name)) + '.pdf'); toast(`✓ ${L.length} relevé(s) dans le PDF`); }
        catch (x) { toast('Erreur PDF : ' + x.message); }
    };

    // Application et conduite : par période, pour toute la classe
    G.rnConduct = function (per0) {
        const D = S.rn.D; if (!D) return;
        const n = 2 * nTerms(D.class.level), L = classStudents();
        let per = per0 || 1;
        const cur = {}; (D.conduct || []).forEach(x => { if (x.p === per) cur[x.s] = x; });
        const opt = v => `<option value="">—</option>` + NOTES.map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${k}</option>`).join('');
        const d = show(`<h3>Application et conduite</h3><small>TB = Très bon · B = Bon · AB = Assez bon · M = Médiocre · Mv = Mauvais</small>
            <div class=chips style="margin:8px 0;flex-wrap:wrap">${Array.from({ length: n }, (_, i) => i + 1).map(p => `<button class="chip ${p === per ? 'on' : ''}" data-p=${p}>P${p}</button>`).join('')}</div>
            <div class=rn-grid style="max-height:48vh;overflow-y:auto"><small><b>Élève</b></small><small><b>Applic.</b></small><small><b>Conduite</b></small>
            ${L.map(s => `<span>${E(s.name)}</span><select data-a="${E(s.id)}">${opt(cur[s.id] && cur[s.id].a)}</select><select data-c="${E(s.id)}">${opt(cur[s.id] && cur[s.id].c)}</select>`).join('')}</div>
            <div class=row style="margin-top:10px"><button class=ghost onclick="this.closest('dialog').close()">Fermer</button><button id=rn_csave>Enregistrer P${per}</button></div>`);
        d.querySelectorAll('[data-p]').forEach(b => b.onclick = () => G.rnConduct(+b.dataset.p));
        d.querySelector('#rn_csave').onclick = async e => {
            const rows = L.map(s => ({ school_id: S.school.id, class_id: S.cls, student_id: s.id, period: per, application: d.querySelector(`[data-a="${s.id}"]`).value || null, conduite: d.querySelector(`[data-c="${s.id}"]`).value || null, updated_by: S.me.id, updated_at: new Date().toISOString() }))
                .filter(r => r.application || r.conduite || cur[r.student_id]);
            if (!rows.length) return toast('Rien à enregistrer.');
            e.target.disabled = true;
            const { error } = await db.from('student_conduct').upsert(rows, { onConflict: 'student_id,class_id,period' });
            e.target.disabled = false;
            if (error) return toast(error.message);
            toast('Enregistré ✓'); d.close(); await load(true); G.vBulletins();
        };
    };

    // Publication : jusqu'à quelle étape les parents voient le relevé
    G.rnPublish = function () {
        const D = S.rn.D; if (!D) return;
        const st = steps(D.class.level);
        const d = show(`<h3>Publication aux parents</h3><small>Les parents voient le relevé jusqu’à l’étape choisie. Les décisions de fin d’année n’apparaissent qu’après la dernière étape.</small>
            <label>Visible jusqu’à<select id=rn_up><option value=0>Rien (pas encore publié)</option>${st.map((x, i) => `<option value=${i + 1} ${D.upto === i + 1 ? 'selected' : ''}>${E(x.l)}</option>`).join('')}</select></label>
            <div class=row><button class=ghost onclick="this.closest('dialog').close()">Annuler</button><button id=rn_pok>Publier</button></div>`);
        d.querySelector('#rn_pok').onclick = async e => {
            e.target.disabled = true;
            const { error } = await db.from('class_report').upsert({ class_id: S.cls, school_id: S.school.id, upto: +d.querySelector('#rn_up').value, updated_at: new Date().toISOString() }, { onConflict: 'class_id' });
            e.target.disabled = false;
            if (error) return toast(error.message);
            toast('Publication enregistrée ✓'); d.close(); await load(true); G.vBulletins();
        };
    };

    // Décisions de fin d'année (+ repêchage, ENAFEP, examen d'État)
    G.rnDecisions = function () {
        const D = S.rn.D; if (!D) return;
        const L = classStudents(), sec = isSec(D.class.level), g = Number(D.class.grade) || 0;
        const ex = sec && g === 4, en = !sec && g === 6;
        const decOf = id => (D.decisions || []).find(x => x.s === id) || {};
        const sugg = id => { const M = compute(D, id), t = M.tot.TG; return t && t.pct != null ? (t.pct >= 50 ? 'passe' : 'double') : ''; };
        const d = show(`<h3>Décisions de fin d’année</h3><small>${ex ? 'Examen d’État : saisissez MEC, points obtenus et maximum à la sortie des résultats.' : en ? 'ENAFEP : saisissez les points sur 50. La moyenne de l’école est calculée seule.' : 'ORÉA propose : 50 % ou plus au T.G. = passe. Confirmez élève par élève.'}</small>
            <div style="max-height:52vh;overflow-y:auto;margin:8px 0">${L.map(s => {
            const x = decOf(s.id), sg = sugg(s.id), M = compute(D, s.id), t = M.tot.TG;
            const head = `<b>${E(s.name)}</b> <small>· T.G. ${t && t.pct != null ? fr(r1(t.pct)) + ' %' : '—'}</small>`;
            if (ex) { const e2 = x.exetat || {}; return `<div class="card col" style="gap:6px;padding:10px 12px;margin:5px 0">${head}<div class=row style="margin:0;flex-wrap:wrap"><input data-mec="${s.id}" placeholder="MEC" value="${E(e2.mec != null ? e2.mec : '')}" style="flex:1;min-width:70px;margin:0"><input data-pts="${s.id}" inputmode=decimal placeholder="Points" value="${E(e2.pts != null ? e2.pts : '')}" style="flex:1;min-width:70px;margin:0"><input data-max="${s.id}" inputmode=decimal placeholder="Max" value="${E(e2.max != null ? e2.max : '')}" style="flex:1;min-width:70px;margin:0"></div><select data-res="${s.id}" style="margin:0"><option value="">Résultat : —</option><option value=diplome ${e2.res === 'diplome' ? 'selected' : ''}>Diplôme</option><option value=echec ${e2.res === 'echec' ? 'selected' : ''}>A échoué</option></select></div>`; }
            const dv = x.decision || sg;
            return `<div class="card col" style="gap:6px;padding:10px 12px;margin:5px 0">${head}<select data-d="${s.id}" style="margin:0"><option value="">Décision : —</option><option value=passe ${dv === 'passe' ? 'selected' : ''}>Passe${sg === 'passe' && !x.decision ? ' (proposé)' : ''}</option><option value=double ${dv === 'double' ? 'selected' : ''}>Double${sg === 'double' && !x.decision ? ' (proposé)' : ''}</option>${en ? '' : `<option value=repechage ${dv === 'repechage' ? 'selected' : ''}>Repêchage</option>`}</select>`
                + (en ? `<input data-en="${s.id}" inputmode=decimal placeholder="Points ENAFEP sur 50" value="${E(x.enafep != null ? x.enafep : '')}" style="margin:0">` : `<input data-rep="${s.id}" placeholder="Repêchage : cours et % (ex : Français 55, Anglais)" value="${E((x.repech || []).map(q => { const c = (D.courses || []).find(w => w.id === q.b); return (c ? c.name : '') + (q.pct != null && q.pct !== '' ? ' ' + q.pct : ''); }).join(', '))}" style="margin:0">`)
                + `</div>`;
        }).join('')}</div><div class=row><button class=ghost onclick="this.closest('dialog').close()">Fermer</button><button id=rn_dsave>Enregistrer</button></div>`);
        const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
        const parseRep = txt => String(txt || '').split(',').map(p => p.trim()).filter(Boolean).map(p => {
            const m = p.match(/^(.*?)(\s+(\d+(?:[.,]\d+)?))?\s*%?$/), nm = (m ? m[1] : p).trim().toLowerCase();
            const c = (D.courses || []).find(w => w.name.toLowerCase() === nm) || (D.courses || []).find(w => w.name.toLowerCase().startsWith(nm));
            return c ? { b: c.id, pct: m && m[3] ? num(m[3]) : null } : null;
        }).filter(Boolean);
        d.querySelector('#rn_dsave').onclick = async e => {
            const rows = [];
            for (const s of L) {
                const r = { school_id: S.school.id, class_id: S.cls, student_id: s.id, updated_by: S.me.id, updated_at: new Date().toISOString() };
                if (ex) {
                    r.exetat = { mec: d.querySelector(`[data-mec="${s.id}"]`).value.trim() || null, pts: num(d.querySelector(`[data-pts="${s.id}"]`).value), max: num(d.querySelector(`[data-max="${s.id}"]`).value), res: d.querySelector(`[data-res="${s.id}"]`).value || null };
                    r.exetat.pct = r.exetat.pts != null && r.exetat.max > 0 ? r1(r.exetat.pts / r.exetat.max * 100) : null;
                    r.decision = r.exetat.res === 'diplome' ? 'passe' : r.exetat.res === 'echec' ? 'double' : null;
                } else {
                    r.decision = d.querySelector(`[data-d="${s.id}"]`).value || null;
                    if (en) { const v = num(d.querySelector(`[data-en="${s.id}"]`).value); if (v != null && (v < 0 || v > 50)) return toast('ENAFEP : de 0 à 50 (' + s.name + ').'); r.enafep = v; }
                    else { const t = d.querySelector(`[data-rep="${s.id}"]`).value; r.repech = r.decision === 'repechage' ? parseRep(t) : []; if (r.decision === 'repechage' && t.trim() && !r.repech.length) return toast('Cours de repêchage introuvable pour ' + s.name + ' : écrivez le nom du cours comme dans la liste.'); }
                }
                rows.push(r);
            }
            e.target.disabled = true;
            const { error } = await db.from('student_decision').upsert(rows, { onConflict: 'student_id,class_id' });
            e.target.disabled = false;
            if (error) return toast(error.message);
            toast('Décisions enregistrées ✓'); d.close(); await load(true); G.vBulletins();
        };
    };
})();
