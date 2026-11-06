/* =====================================================================
   ORÉA École v85 — bureau.js : version ORDINATEUR (écrans ≥ 1024 px)
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

    const oRender = window.render;
    if (typeof oRender === 'function' && !oRender.__desk) {
        window.render = function () { const r = oRender.apply(this, arguments); try { sync(); } catch (_) { } return r; };
        window.render.__desk = true;
    }
    (mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync));
    new MutationObserver(() => { try { sync(); } catch (_) { } }).observe(document.getElementById('nav') || document.body, { attributes: true, attributeFilter: ['hidden'] });
    window.oreaDeskSync = sync;
})();
