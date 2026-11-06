/* =====================================================================
   ORÉA École v85 — bureau.js : version ORDINATEUR (écrans ≥ 1024 px)
   v86 : Ctrl+K · raccourcis clavier (?) · glisser-déposer Excel/CSV d'élèves ·
         mode vidéoprojecteur pour Génie en Herbe (école et Famille)
   v85 : fiche élève à droite · messages sur 2 colonnes · tableaux triables ·
         cotes « façon Excel » (Entrée / flèches / collage d'une colonne, aussi sur téléphone)
   Active la mise en page « bureau » (bureau.css) quand l'écran est large
   et qu'un utilisateur est connecté : menu latéral, barre du haut,
   tableau de bord en colonnes. Sur téléphone : ne fait rien.
   ===================================================================== */
(function () {
    'use strict';
    if (typeof S === 'undefined') return;
    const mq = window.matchMedia('(min-width:1024px)');
    const GRID = ['menu', 'finance_home', 'programme_home', 'donnees_home'];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function sync() {
        const nav = document.getElementById('nav');
        const on = mq.matches && !!S.me && nav && !nav.hidden;
        const b = document.body;
        b.classList.toggle('desk', on);
        [...b.classList].filter(c => c.startsWith('tab-')).forEach(c => b.classList.remove(c));
        let brand = document.getElementById('deskbrand'), foot = document.getElementById('deskfoot');
        const dl = document.getElementById('dlg'); if (dl && !dl.open) { document.body.classList.remove('side-open'); }
        if (!on) { if (brand) brand.remove(); if (foot) foot.remove(); return; }
        b.classList.add('tab-' + S.tab);
        if (GRID.includes(S.tab)) b.classList.add('tab-grid');
        if (!brand) { brand = document.createElement('div'); brand.id = 'deskbrand'; b.appendChild(brand); }
        brand.innerHTML = `<img src="icon-192.png" alt=""><div><b>ORÉA École</b><small>${esc((S.school && S.school.name) || '')}</small></div>`;
        if (!foot) { foot = document.createElement('div'); foot.id = 'deskfoot'; b.appendChild(foot); }
        const title = typeof roleTitle === 'function' ? roleTitle(S.me) : S.me.role;
        foot.innerHTML = `<b>${esc(S.me.full_name || '')}</b>${esc(title)}${S.year ? ' · ' + esc(S.year) : ''}`;
        // Le menu latéral s'arrête au-dessus du pied
        nav.style.bottom = foot.offsetHeight + 'px';
    }


    const isDesk = () => document.body.classList.contains('desk');

    /* ---------- École : fiche de l'élève en panneau à droite ---------- */
    const dlg = document.getElementById('dlg');
    const sideOff = () => { document.body.classList.remove('side-open'); document.querySelectorAll('#lst .card.sel').forEach(c => c.classList.remove('sel')); };
    const oMenu = window.menu;
    if (typeof oMenu === 'function' && dlg && !oMenu.__desk) {
        window.menu = function (id) {
            const r = oMenu.apply(this, arguments);
            if (isDesk() && S.tab === 'eleves' && dlg.open) {
                dlg.classList.add('side'); document.body.classList.add('side-open');
                document.querySelectorAll('#lst .card.sel').forEach(c => c.classList.remove('sel'));
                const c = document.querySelector(`#lst .card[onclick*="menu('${id}')"]`); if (c) c.classList.add('sel');
            }
            return r;
        };
        window.menu.__desk = true;
        dlg.addEventListener('close', () => { dlg.classList.remove('side'); sideOff(); });
        // Clic sur un autre élève de la liste : on passe directement à sa fiche
        dlg.addEventListener('click', e => {
            if (e.target !== dlg || !dlg.classList.contains('side')) return;
            const b = dlg.getBoundingClientRect();
            if (e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) return;
            const hit = [...document.querySelectorAll('#main .card[onclick*="menu("]')].find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
            dlg.close();
            const id = hit && ((hit.getAttribute('onclick') || '').match(/menu\('([^']+)'\)/) || [])[1];
            if (id) setTimeout(() => window.menu(id), 250);
        });
    }

    /* ---------- Messages : la page dessous s'estompe quand la liste est ouverte ---------- */
    new MutationObserver(() => document.body.classList.toggle('om-inbox-open', !!document.querySelector('.om-ov.om-inbox')))
        .observe(document.body, { childList: true });

    /* ---------- Tableaux triables (clic sur un en-tête) ---------- */
    const num = t => { const s = String(t).replace(/\s/g, '').replace(/[^\d,.\-]/g, '').replace(',', '.'); return s && !isNaN(+s) ? +s : null; };
    document.addEventListener('click', e => {
        const th = e.target.closest && e.target.closest('#main table th');
        if (!th || !isDesk()) return;
        const tr0 = th.parentElement, table = th.closest('table'), idx = [...tr0.children].indexOf(th);
        const rows = [...table.querySelectorAll('tr')].filter(r => r !== tr0 && r.querySelector('td'));
        const foot = rows.filter(r => /^total$/i.test(((r.children[0] || {}).textContent || '').trim()));
        const body = rows.filter(r => !foot.includes(r));
        const dir = th.dataset.sort === '▲' ? -1 : 1;
        tr0.querySelectorAll('th').forEach(x => delete x.dataset.sort);
        th.dataset.sort = dir === 1 ? '▲' : '▼';
        const val = r => (r.children[idx] || {}).textContent || '';
        body.sort((a, b) => { const x = num(val(a)), y = num(val(b)); return dir * ((x !== null && y !== null) ? x - y : val(a).localeCompare(val(b), 'fr', { numeric: true })); });
        const parent = body.length ? body[0].parentElement : null;
        if (parent) { body.forEach(r => parent.appendChild(r)); foot.forEach(r => parent.appendChild(r)); }
    });

    /* ---------- Cotes « façon Excel » (ordinateur ET téléphone) ---------- */
    const cg = () => [...document.querySelectorAll('input[id^="cg_"]')].filter(i => !i.disabled);
    document.addEventListener('keydown', e => {
        const t = e.target;
        if (!t || !t.id || !t.id.startsWith('cg_')) return;
        const L = cg(), i = L.indexOf(t);
        if (i < 0) return;
        let j = null;
        if (e.key === 'Enter' || e.key === 'ArrowDown') j = i + 1;
        else if (e.key === 'ArrowUp') j = i - 1;
        if (j === null) return;
        e.preventDefault();
        if (j >= 0 && j < L.length) { L[j].focus(); L[j].select && L[j].select(); }
        else if (j >= L.length) { const s = document.getElementById('cot_save'); if (s) s.focus(); }
    });
    document.addEventListener('paste', e => {
        const t = e.target;
        if (!t || !t.id || !t.id.startsWith('cg_')) return;
        const txt = (e.clipboardData || window.clipboardData).getData('text');
        if (!/[\r\n\t]/.test(txt)) return;   // une seule valeur : collage normal
        e.preventDefault();
        const vals = txt.replace(/\r/g, '').split(/\n/).map(l => l.split('\t')[0].trim()).filter((v, k, a) => !(k === a.length - 1 && v === ''));
        const L = cg(), i = L.indexOf(t);
        vals.forEach((v, k) => { const el = L[i + k]; if (el) { el.value = v.replace(',', '.'); el.dispatchEvent(new Event('input', { bubbles: true })); } });
        const last = L[Math.min(L.length - 1, i + vals.length - 1)]; if (last) last.focus();
        if (typeof toast === 'function') toast(Math.min(vals.length, L.length - i) + ' cote(s) collée(s) — vérifie puis Enregistre');
    });


    /* =================================================================
       v86 — Clavier : Ctrl+K (recherche) et raccourcis
       ================================================================= */
    const typing = el => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    const anyOverlay = () => document.querySelector('dialog[open], .om-ov, .nt-ov, .qz-ov, .fm-ov, .ic-ov, #searchModal:not([hidden])');
    const go = t => { if (typeof menuGo === 'function') menuGo(t); };
    const KEYS = [
        ['Ctrl + K', 'Rechercher (élève, reçu, classe…)'],
        ['A', 'Accueil'], ['G', 'École (classes et élèves)'], ['M', 'Menu'], ['R', 'Réglages'],
        ['P', 'Présences'], ['C', 'Caisse'], ['N', 'Nouvel élève'], ['?', 'Afficher cette aide'],
        ['Échap', 'Fermer la fenêtre ou le panneau']
    ];
    function help() {
        if (typeof show !== 'function') return;
        show(`<h3>Raccourcis clavier</h3><div class=col>${KEYS.map(k => `<div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(k[1])}</span><kbd style="font-family:inherit;font-weight:700;color:var(--gold);border:1px solid var(--line);border-radius:6px;padding:2px 8px;white-space:nowrap">${esc(k[0])}</kbd></div>`).join('')}<small style="margin-top:8px">Génie en Herbe : 1 à 4 (ou A à D) pour répondre, Entrée pour valider / continuer, Espace pour la pause, F pour le plein écran, V pour le mode vidéoprojecteur.</small><button class=ghost onclick="this.closest('dialog').close()">Fermer</button></div>`);
    }
    document.addEventListener('keydown', e => {
        if (!S.me) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (typeof openSearch === 'function' && !document.querySelector('.qz-ov, .fm-ov')) openSearch();
            return;
        }
        if (!isDesk() || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || anyOverlay()) return;
        const k = e.key.toLowerCase();
        const act = {
            a: () => goTab && goTab('accueil'), g: () => goTab && goTab('eleves'), m: () => goTab && goTab('menu'), r: () => goTab && goTab('reglages'),
            p: () => go('presences'),
            c: () => (typeof canCollect === 'function' && canCollect()) && go('caisse'),
            n: () => (typeof dir === 'function' && dir() && typeof addStudent === 'function') && addStudent(),
            '?': help
        }[k];
        if (act) { e.preventDefault(); act(); }
    });

    /* =================================================================
       v86 — Glisser-déposer un fichier Excel / CSV d'élèves dans une classe
       Colonnes reconnues (en-têtes) : Nom · Sexe (M/F) · Date de naissance · Téléphone
       ================================================================= */
    let XLSX_P = null;
    const loadXlsx = () => XLSX_P || (XLSX_P = new Promise((ok, ko) => {
        if (window.XLSX) return ok(window.XLSX);
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        sc.onload = () => ok(window.XLSX); sc.onerror = () => { XLSX_P = null; ko(new Error('Lecture Excel indisponible (réseau).')); };
        document.head.appendChild(sc);
    }));
    function csvRows(t) {
        const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
        return t.replace(/\r/g, '').split('\n').filter(l => l.trim()).map(l => {
            const out = []; let cur = '', q = false;
            for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
            out.push(cur); return out.map(x => x.trim());
        });
    }
    async function readRows(file) {
        if (/\.csv$|\.txt$/i.test(file.name)) return csvRows(await file.text());
        const X = await loadXlsx(), wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }).map(r => r.map(x => String(x ?? '').trim()));
    }
    const isoDate = v => {
        v = String(v || '').trim(); if (!v) return null;
        let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? (+m[3] > 30 ? '19' : '20') + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
        return null;
    };
    async function importFile(file) {
        const cls = (S.classes || []).find(c => c.id === S.cls);
        if (!cls) return toast('Ouvre d’abord la classe dans laquelle importer les élèves.');
        let rows;
        try { rows = await readRows(file); } catch (e) { return toast(e.message || 'Fichier illisible'); }
        if (!rows.length) return toast('Fichier vide.');
        const h = rows[0].map(x => x.toLowerCase());
        const col = re => h.findIndex(x => re.test(x));
        let iN = col(/nom|élève|eleve|name/), iS = col(/sexe|genre/), iD = col(/naiss|date/), iT = col(/t[ée]l|whatsapp|phone|parent/);
        const hasHead = iN >= 0;
        if (!hasHead) { iN = 0; iS = iD = iT = -1; }
        const have = new Set((S.stu || []).filter(s => s.class_id === cls.id).map(s => s.name.toLowerCase().replace(/\s+/g, ' ')));
        const seen = new Set(), ok = [], skip = [];
        rows.slice(hasHead ? 1 : 0).forEach(r => {
            const name = String(r[iN] || '').replace(/\s+/g, ' ').trim(); if (!name) return;
            const key = name.toLowerCase();
            if (have.has(key) || seen.has(key)) { skip.push(name); return; }
            seen.add(key);
            const sx = String(iS >= 0 ? r[iS] : '').trim().toUpperCase().charAt(0);
            ok.push({ school_id: S.school.id, class_id: cls.id, name, sexe: sx === 'M' || sx === 'G' ? 'M' : sx === 'F' ? 'F' : null, date_naissance: iD >= 0 ? isoDate(r[iD]) : null, parent_phone: iT >= 0 ? (String(r[iT] || '').trim() || null) : null });
        });
        if (!ok.length) return toast(skip.length ? 'Tous ces élèves sont déjà dans la classe.' : 'Aucun nom d’élève trouvé.');
        const d = show(`<h3>Importer dans ${esc(cls.name)}</h3><small>${ok.length} élève(s) à ajouter${skip.length ? ' · ' + skip.length + ' déjà présent(s), ignoré(s)' : ''}</small>
            <div style="max-height:50vh;overflow-y:auto;margin:8px 0"><table style="width:100%;font-size:13px;border-collapse:collapse"><tr><th style="text-align:left">Nom</th><th>Sexe</th><th>Naissance</th><th>Téléphone</th></tr>${ok.map(o => `<tr><td>${esc(o.name)}</td><td style="text-align:center">${o.sexe || '—'}</td><td style="text-align:center">${o.date_naissance || '—'}</td><td>${esc(o.parent_phone || '—')}</td></tr>`).join('')}</table></div>
            <div class=row><button class=ghost id=imx>Annuler</button><button id=imo>Ajouter ${ok.length} élève(s)</button></div>`);
        d.querySelector('#imx').onclick = () => d.close();
        d.querySelector('#imo').onclick = async ev => {
            ev.currentTarget.disabled = true;
            for (let i = 0; i < ok.length; i += 200) {
                const { error } = await db.from('students').insert(ok.slice(i, i + 200));
                if (error) { toast(error.message); ev.currentTarget.disabled = false; return; }
            }
            d.close(); toast(ok.length + ' élève(s) ajouté(s) ✓');
            if (typeof load === 'function') await load(); render();
        };
    }
    let dragN = 0;
    const dropOk = () => isDesk() && S.tab === 'eleves' && S.view === 'class' && typeof dir === 'function' && dir() && !anyOverlay();
    document.addEventListener('dragenter', e => { if (!dropOk() || ![...(e.dataTransfer.types || [])].includes('Files')) return; dragN++; document.body.classList.add('drop-on'); });
    document.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('drop-on'); } });
    document.addEventListener('dragover', e => { if (dropOk()) e.preventDefault(); });
    document.addEventListener('drop', e => {
        dragN = 0; document.body.classList.remove('drop-on');
        if (!dropOk()) return;
        e.preventDefault();
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) importFile(f);
    });

    /* =================================================================
       v86 — Génie en Herbe : mode vidéoprojecteur + commandes au clavier
       ================================================================= */
    const gameOn = () => document.querySelector('.qz-ov, .fm-ov');
    const projBtn = () => {
        let b = document.getElementById('proj-btn');
        if (!gameOn() || !isDesk()) { if (b) b.remove(); document.documentElement.classList.remove('proj'); return; }
        if (!b) {
            b = document.createElement('button'); b.id = 'proj-btn'; b.type = 'button';
            b.onclick = toggleProj; document.body.appendChild(b);
        }
        b.textContent = document.documentElement.classList.contains('proj') ? 'Quitter le mode vidéoprojecteur' : 'Mode vidéoprojecteur';
    };
    function toggleProj() {
        const on = document.documentElement.classList.toggle('proj');
        try { if (on && !document.fullscreenElement) document.documentElement.requestFullscreen(); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch (_) { }
        projBtn();
    }
    new MutationObserver(projBtn).observe(document.body, { childList: true });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { document.documentElement.classList.remove('proj'); projBtn(); } });
    document.addEventListener('keydown', e => {
        if (!gameOn() || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
        const k = e.key.toLowerCase(), click = sel => { const b = [...document.querySelectorAll(sel)].find(x => !x.disabled && x.offsetParent !== null); if (b) { e.preventDefault(); b.click(); return true; } return false; };
        const n = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 }[k];
        if (n !== undefined) {
            const L = [...document.querySelectorAll('.qz-ans, .fm-ans[data-a]')].filter(x => !x.disabled && x.offsetParent !== null);
            if (L[n]) { e.preventDefault(); L[n].click(); }
            return;
        }
        if (k === 'enter') { click('#qz-ok, #qz-next, #qz-start, #fm-nx, #fm-n, #fm-start, #qz-res'); return; }
        if (k === ' ') { if (!click('#qz-btn-pause')) click('#qz-res'); return; }
        if (k === 'f') { e.preventDefault(); try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (_) { } return; }
        if (k === 'v' && isDesk()) { e.preventDefault(); toggleProj(); }
    });

    const oRender = window.render;
    if (typeof oRender === 'function' && !oRender.__desk) {
        window.render = function () { const r = oRender.apply(this, arguments); try { sync(); } catch (_) { } return r; };
        window.render.__desk = true;
    }
    (mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync));
    new MutationObserver(() => { try { sync(); } catch (_) { } }).observe(document.getElementById('nav') || document.body, { attributes: true, attributeFilter: ['hidden'] });
    window.oreaDeskSync = sync;
})();
