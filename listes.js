/* =====================================================================
   ORÉA École v97 — listes.js : « + Liste » (ajouter plusieurs élèves)
   1) Saisie libre, une ligne par élève, séparée par de simples espaces :
        Kabila Mwamba Grâce F 12/03/2014 0812345678
        Mbuyi Paul M 11 ans
      ORÉA reconnaît tout seul le nom, le sexe (M/F, garçon/fille…), la date
      de naissance (12/03/2014, 2014-03-12…) ou l'âge (« 11 ans »), et le
      téléphone du parent (0812345678, +243 81 234 5678…).
   2) Import d'un fichier : Excel (.xlsx, .xls), CSV, Word (.docx, tableau
      ou une ligne par élève) ou texte. Les colonnes sont reconnues par leur
      titre (Nom, Postnom, Prénom, Sexe, Date de naissance, Âge, Téléphone…).
   3) Aperçu avant d'ajouter : on retire une ligne d'un geste ; les noms déjà
      présents dans la classe sont ignorés.
   À charger APRÈS app.js (remplace bulkAdd).
   ===================================================================== */
(function () {
    'use strict';
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const strip = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const SEX = { m: 'M', masculin: 'M', masc: 'M', garcon: 'M', g: 'M', h: 'M', homme: 'M', male: 'M', f: 'F', feminin: 'F', fem: 'F', fille: 'F', femme: 'F', femelle: 'F' };
    const YEAR = new Date().getFullYear();
    const pad = n => String(n).padStart(2, '0');

    /* ---------- Reconnaissance d'une valeur ---------- */
    const RX_PHONE = /(?:\+\s?243|\b243|\b0)[\s.-]?[1-9](?:[\s.-]?\d){7,8}\b/;
    function phoneOf(s) {
        let d = String(s || '').replace(/[^\d+]/g, '');
        if (/^\+?243\d{9}$/.test(d)) return '+243' + d.slice(-9);
        if (/^0\d{9}$/.test(d)) return '+243' + d.slice(1);
        if (/^[1-9]\d{8}$/.test(d)) return '+243' + d;
        return null;
    }
    function dateOf(s) {
        s = String(s || '').trim();
        let m = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
        if (m) return check(+m[1], +m[2], +m[3]);
        m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
        if (m) { let y = +m[3]; if (y < 100) y += y <= YEAR % 100 ? 2000 : 1900; return check(y, +m[2], +m[1]); }
        return null;
    }
    function check(y, mo, d) {
        if (y < 1950 || y > YEAR || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        const dt = new Date(y, mo - 1, d); if (dt.getMonth() !== mo - 1) return null;
        return y + '-' + pad(mo) + '-' + pad(d);
    }
    // Date Excel (nombre de jours depuis 1900)
    const excelDate = n => { const d = new Date(Math.round((n - 25569) * 864e5)); return isNaN(d) ? null : check(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
    const cleanName = s => String(s || '').replace(/^\s*\d{1,3}\s*[.)\-–:]?\s+(?=[^\d\s])/, '').replace(/[;,|]+/g, ' ').replace(/\s+/g, ' ').trim();

    /* ---------- Une ligne de texte libre ---------- */
    // Ligne de titres : tous ses mots sont des mots de titre (n°, nom, sexe, date, naissance, téléphone…)
    const HW = new Set(['n', 'no', 'num', 'numero', 'nom', 'noms', 'postnom', 'post-nom', 'postnoms', 'prenom', 'prenoms', 'complet', 'complets', 'eleve', 'eleves', 'sexe', 'genre', 'date', 'de', 'du', 'des', 'la', 'le', 'naissance', 'ne', 'nee', 'age', 'ages', 'telephone', 'tel', 'phone', 'contact', 'contacts', 'parent', 'parents', 'tuteur', 'whatsapp', 'classe', 'et', 'identite', 'ddn', 'lieu', 'adresse']);
    const isHeader = line => { const w = strip(line).replace(/[°º#:/()|;,.\t-]+/g, ' ').split(/\s+/).filter(Boolean); return w.length >= 2 && w.every(x => HW.has(x)) && w.some(x => ['nom', 'noms', 'eleve', 'eleves'].includes(x)); };
    function parseLine(line) {
        if (isHeader(line)) return { name: '' };
        let s = ' ' + String(line || '').replace(/\t/g, ' ') + ' ';
        s = s.replace(/^\s*(?:n[°o]\s*)?\d{1,3}\s*[.)\-–:]?\s+(?=[^\d\s])/i, ' ');   // v97b : numérotation « 1 », « 1. », « 1) »
        const r = { name: '', sexe: null, dn: null, age: null, phone: null };
        const pm = s.match(RX_PHONE); if (pm) { r.phone = phoneOf(pm[0]); if (r.phone) s = s.replace(pm[0], ' '); }
        const dm = s.match(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/);
        if (dm) { r.dn = dateOf(dm[0]); if (r.dn) s = s.replace(dm[0], ' '); }
        const am = s.match(/\b(\d{1,2})\s*ans?\b/i);
        if (am) { r.age = +am[1]; s = s.replace(am[0], ' '); }
        const toks = s.split(/\s+/).filter(Boolean), keep = [];
        toks.forEach(t => {
            const k = strip(t).replace(/[.:,]/g, '');
            if (!r.sexe && SEX[k] && (k.length > 1 || t === t.toUpperCase())) { r.sexe = SEX[k]; return; }
            if (!r.dn && r.age == null && /^\d{1,2}$/.test(k) && +k >= 2 && +k <= 30) { r.age = +k; return; }
            keep.push(t);
        });
        r.name = cleanName(keep.join(' '));
        return r;
    }

    /* ---------- Un tableau (Excel, CSV, Word) ---------- */
    const HEAD = [
        ['name', /^(n°\s*)?(nom|noms|eleve|eleves|nom complet|noms complets|identite)$/],
        ['name2', /^(post-?nom|postnoms?)$/], ['name3', /^(prenom|prenoms)$/],
        ['sexe', /^(sexe|genre|s)$/], ['dn', /(naissance|ne le|ne\(e\) le|date de nais|ddn|date)/], ['age', /^(age|ages)$/],
        ['phone', /(tel|telephone|phone|contact|whatsapp|parent|tuteur|numero)/]
    ];
    function parseTable(rows) {
        rows = rows.map(r => (r || []).map(c => c == null ? '' : c)).filter(r => r.some(c => String(c).trim()));
        if (!rows.length) return [];
        // Ligne de titres ?
        let map = null, hi = -1;
        for (let i = 0; i < Math.min(rows.length, 5) && !map; i++) {
            const m = {};
            rows[i].forEach((c, j) => { const k = strip(c); const h = HEAD.find(x => x[1].test(k)); if (h && !(h[0] in m)) m[h[0]] = j; });
            if ('name' in m || ('name2' in m && 'name3' in m)) { map = m; hi = i; }
        }
        if (!map) return rows.map(r => parseLine(r.map(c => typeof c === 'number' && c > 20000 && c < 60000 ? excelDateTxt(c) : c).join('  ')));
        return rows.slice(hi + 1).map(r => {
            const g = k => (k in map ? r[map[k]] : '');
            const raw = [g('name'), g('name2'), g('name3')].map(x => String(x || '').trim()).filter(Boolean).join(' ');
            const o = { name: cleanName(raw), sexe: null, dn: null, age: null, phone: null };
            const sx = strip(g('sexe')).replace(/[.]/g, ''); if (SEX[sx]) o.sexe = SEX[sx];
            const dv = g('dn'); o.dn = typeof dv === 'number' ? excelDate(dv) : dateOf(dv);
            const av = String(g('age')).match(/\d{1,2}/); if (!o.dn && av) o.age = +av[0];
            o.phone = phoneOf(g('phone'));
            if (!o.sexe || !o.dn || !o.phone) { const x = parseLine(r.filter((_, j) => !Object.values(map).includes(j)).join('  ')); o.sexe = o.sexe || x.sexe; o.dn = o.dn || x.dn; o.phone = o.phone || x.phone; if (!o.dn && o.age == null) o.age = x.age; }
            return o;
        }).filter(o => o.name);
    }
    const excelDateTxt = n => { const d = excelDate(n); return d ? d.split('-').reverse().join('/') : String(n); };

    /* ---------- Lecture des fichiers ---------- */
    const libs = {};
    const lib = (k, url, glob) => libs[k] || (libs[k] = new Promise((ok, ko) => {
        if (window[glob]) return ok(window[glob]);
        const sc = document.createElement('script'); sc.src = url;
        sc.onload = () => window[glob] ? ok(window[glob]) : ko(new Error('Lecteur indisponible'));
        sc.onerror = () => { libs[k] = null; ko(new Error('Lecture du fichier impossible sans internet.')); };
        document.head.appendChild(sc);
    }));
    async function readFile(file) {
        const n = file.name.toLowerCase();
        if (/\.(xlsx|xls|ods)$/.test(n)) {
            const X = await lib('xlsx', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX');
            const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
            return parseTable(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }));
        }
        if (/\.docx$/.test(n)) {
            const M = await lib('mammoth', 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', 'mammoth');
            const { value } = await M.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
            const doc = new DOMParser().parseFromString(value, 'text/html'), tbl = doc.querySelector('table');
            if (tbl) return parseTable([...tbl.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.trim())));
            return [...doc.querySelectorAll('p,li')].map(p => parseLine(p.textContent)).filter(o => o.name);
        }
        if (/\.doc$/.test(n)) throw new Error('Ancien format Word (.doc) : enregistrez le fichier en .docx ou copiez la liste dans la zone de texte.');
        const t = (await file.text()).replace(/^\uFEFF/, '');
        // CSV / texte : lu directement, sans internet (séparateur ; tabulation ou virgule)
        const lines = t.split(/\r?\n/).filter(l => l.trim());
        const sep = /;/.test(t) ? ';' : /\t/.test(t) ? '\t' : (/\.csv$/.test(n) && lines.every(l => l.includes(','))) ? ',' : null;
        if (sep) return parseTable(lines.map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim())));
        return t.split(/\r?\n/).map(parseLine).filter(o => o.name);
    }

    /* ---------- Fenêtre « Ajouter une liste d'élèves » ---------- */
    window.bulkAdd = function () {
        const cls = yc(); if (!cls.length) return toast('Créez d’abord une classe.');
        const d = show(`<h3>Ajouter une liste d’élèves</h3>
<label>Classe<select id=bl-c>${cls.map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${E(cnm(c.id))}</option>`).join('')}</select></label>
<label>Une ligne par élève<textarea id=bl-t rows=6 placeholder="Kabila Mwamba Grâce F 12/03/2014 0812345678&#10;Mbuyi Paul M 11 ans&#10;Lukusa Ana fille 0991234567"></textarea></label>
<small>Écrivez simplement avec des espaces : ORÉA reconnaît le nom, le sexe (M / F, garçon / fille), la date de naissance ou l’âge (« 11 ans ») et le téléphone du parent. Seul le nom est obligatoire.</small>
<label>Ou importez un fichier<input type=file id=bl-f accept=".xlsx,.xls,.ods,.csv,.docx,.txt"></label>
<small>Excel, CSV, Word (.docx, tableau ou une ligne par élève). Les colonnes Nom, Postnom, Prénom, Sexe, Date de naissance, Âge, Téléphone sont reconnues.</small>
<div id=bl-p></div>
<div class=row><button type=button class=ghost id=bl-x>Fermer</button><button type=button id=bl-ok disabled>Ajouter</button></div>`);
        let rows = [];
        const box = d.querySelector('#bl-p'), ok = d.querySelector('#bl-ok');
        const dnTxt = r => r.dn ? r.dn.split('-').reverse().join('/') : r.age != null ? `≈ ${YEAR - r.age} (${r.age} ans)` : '—';
        const draw = () => {
            const cid = d.querySelector('#bl-c').value;
            const have = new Set(S.stu.filter(s => s.class_id === cid).map(s => strip(s.name)));
            rows.forEach(r => { r.dup = have.has(strip(r.name)); });
            const n = rows.filter(r => !r.dup && r.name).length;
            ok.disabled = !n; ok.textContent = n ? `Ajouter ${n} élève${n > 1 ? 's' : ''}` : 'Ajouter';
            box.innerHTML = rows.length ? `<div style="overflow-x:auto;margin:8px 0"><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="text-align:left;color:var(--mut)"><th>Nom</th><th>Sexe</th><th>Naissance</th><th>Téléphone</th><th></th></tr>${rows.map((r, i) => `<tr style="border-top:1px solid var(--line);${r.dup ? 'opacity:.45' : ''}"><td>${E(r.name)}${r.dup ? '<br><small>déjà dans la classe</small>' : ''}</td><td>${r.sexe || '—'}</td><td>${dnTxt(r)}</td><td>${r.phone ? E(r.phone) : '—'}</td><td><button type=button class=ghost data-rm=${i} aria-label="Retirer" style="width:auto;min-height:30px;padding:2px 8px">✕</button></td></tr>`).join('')}</table></div>${rows.some(r => r.age != null && !r.dn) ? `<label style="display:flex;gap:8px;align-items:center;text-transform:none"><input type=checkbox id=bl-age checked style="width:auto;margin:0"> Pour un âge, enregistrer une date approximative (1er janvier de l’année)</label>` : ''}` : '';
            box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { rows.splice(+b.dataset.rm, 1); draw(); });
        };
        const fromText = () => { rows = d.querySelector('#bl-t').value.split(/\r?\n/).map(parseLine).filter(r => r.name); draw(); };
        let tm = 0; d.querySelector('#bl-t').oninput = () => { clearTimeout(tm); tm = setTimeout(fromText, 300); };
        d.querySelector('#bl-c').onchange = draw;
        d.querySelector('#bl-f').onchange = async e => {
            const f = e.target.files && e.target.files[0]; if (!f) return;
            box.innerHTML = '<div class=sk></div>';
            try { rows = await readFile(f); d.querySelector('#bl-t').value = ''; draw(); if (!rows.length) box.innerHTML = '<p class=empty>Aucun élève trouvé dans ce fichier.</p>'; }
            catch (err) { box.innerHTML = `<p class=empty>${E(err.message || err)}</p>`; }
        };
        d.querySelector('#bl-x').onclick = () => d.close();
        ok.onclick = async () => {
            const cid = d.querySelector('#bl-c').value, est = d.querySelector('#bl-age') ? d.querySelector('#bl-age').checked : false;
            const L = rows.filter(r => !r.dup && r.name).map(r => ({ school_id: S.school.id, class_id: cid, name: r.name, sexe: r.sexe, date_naissance: r.dn || (est && r.age != null ? (YEAR - r.age) + '-01-01' : null), parent_phone: r.phone }));
            if (!L.length) return;
            ok.disabled = true;
            for (let i = 0; i < L.length; i += 200) {
                const { error } = await db.from('students').insert(L.slice(i, i + 200));
                if (error) { ok.disabled = false; return toast(error.message); }
            }
            d.close(); S.cls = cid; await load(); render();
            toast(L.length + ' élève(s) ajouté(s)' + (rows.length > L.length ? ' · ' + (rows.length - L.length) + ' ignoré(s)' : ''));
        };
    };
    window.oreaParseLine = parseLine;   // pour les tests
})();
