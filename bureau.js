/* =====================================================================
   ORÉA École v84 — bureau.js : version ORDINATEUR (écrans ≥ 1024 px)
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

    const oRender = window.render;
    if (typeof oRender === 'function' && !oRender.__desk) {
        window.render = function () { const r = oRender.apply(this, arguments); try { sync(); } catch (_) { } return r; };
        window.render.__desk = true;
    }
    (mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync));
    new MutationObserver(() => { try { sync(); } catch (_) { } }).observe(document.getElementById('nav') || document.body, { attributes: true, attributeFilter: ['hidden'] });
    window.oreaDeskSync = sync;
})();
