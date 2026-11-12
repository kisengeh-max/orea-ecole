/* =====================================================================
   ORÉA École v94 — test.js : espace Test d'ORÉA
   - Espace ORÉA → onglet « Test » : créer des écoles TEST (maternelle,
     primaire, secondaire, complexe) remplies de données fictives,
     puis « Voir comme… » un rôle : l'application s'ouvre exactement comme
     pour cette personne (les règles de sécurité du vrai rôle s'appliquent).
   - Ne marche QUE dans les écoles TEST : les vraies écoles ne sont jamais touchées.
   - Bandeau « MODE TEST » toujours visible, avec « Revenir à ORÉA ».
   Chargé par index.html ET parent.html (après app.js / parent.js).
   ===================================================================== */
(function () {
    'use strict';
    const KEY = 'orea_test';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const TYPES = [['secondaire', 'Secondaire'], ['primaire', 'Primaire'], ['maternelle', 'Maternelle'], ['complexe', 'Complexe scolaire']];
    const headName = t => ['primaire', 'maternelle'].includes(t) ? 'Directeur' : 'Préfet';
    const ROLES = t => [['chef', headName(t)]]
        .concat(['secondaire', 'complexe'].includes(t) ? [['etudes', 'Directeur des études']] : [])
        .concat([['secretariat', 'Secrétariat'], ['enseignant', 'Enseignant'], ['percepteur', 'Percepteur'], ['gardien', 'Gardien'], ['parent', 'Parent'], ['ambassadeur', 'Ambassadeur'], ['inspecteur', 'Inspecteur']]);

    window.oreaTest = { read, active: () => !!read() };

    /* ---------- Bandeau « MODE TEST » ---------- */
    // v102 : petit bouton « TEST » dans la barre du haut, à côté du nom de l'école
    // (l'ancien bandeau violet sur toute la largeur cachait des boutons). Un appui ouvre une petite carte :
    // rôle, école, « Revenir à ORÉA ». Sans barre du haut visible : bouton flottant en haut au centre.
    function banner() {
        const t = read(); if (!t || document.getElementById('ts-bar')) return;
        const st = document.createElement('style');
        st.textContent = '#ts-bar{position:relative;flex:none;display:inline-flex;font:600 13px/1.3 system-ui,sans-serif;z-index:60}'
            + '#ts-bar.fly{position:fixed;top:calc(8px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:950}'
            + '#ts-pill{width:auto;min-height:28px;margin:0;padding:4px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.5);background:repeating-linear-gradient(135deg,#6d28d9 0 10px,#5b21b6 10px 20px);color:#fff;-webkit-text-fill-color:#fff;font:700 11.5px/1 system-ui,sans-serif;letter-spacing:.05em;box-shadow:0 3px 10px rgba(0,0,0,.3);cursor:pointer;white-space:nowrap}'
            + '#ts-pill .ts-r{font-weight:600;letter-spacing:0}'
            + '#ts-card{position:fixed;z-index:960;padding:12px 14px;border-radius:14px;background:#2e1065;color:#fff;-webkit-text-fill-color:#fff;border:1px solid rgba(255,255,255,.3);box-shadow:0 10px 30px rgba(0,0,0,.45);text-align:center;width:max-content;min-width:220px;max-width:80vw}'
            + '#ts-card[hidden]{display:none}#ts-card b{display:block;background:none;-webkit-text-fill-color:#fff;color:#fff;font:700 14px/1.3 system-ui,sans-serif;letter-spacing:0}#ts-card small{display:block;opacity:.85;margin:2px 0 10px;font-weight:500}'
            + '#ts-card button{width:100%;min-height:38px;margin:0;border-radius:10px;border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.15);color:#fff;-webkit-text-fill-color:#fff;font:700 13px system-ui,sans-serif;box-shadow:none;cursor:pointer}'
            + 'header #hs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
            + '@media(max-width:600px){#ts-pill .ts-r{display:none}}';
        document.head.appendChild(st);
        const b = document.createElement('div'); b.id = 'ts-bar';
        b.innerHTML = `<button type="button" id="ts-pill" class="no-ico" aria-expanded="false" title="Mode test">TEST<span class="ts-r"> · ${E(t.label)}</span></button>`;
        const card = document.createElement('div'); card.id = 'ts-card'; card.hidden = true;
        card.innerHTML = `<b>Mode test · ${E(t.label)}</b><small>${E(t.school)}</small><button type="button" id="ts-out">Revenir à ORÉA</button>`;
        document.body.appendChild(card);
        const place = () => {
            const h = document.querySelector('body>header');
            const vis = h && getComputedStyle(h).display !== 'none';
            b.classList.toggle('fly', !vis);
            if (vis) { const hs = h.querySelector('#hs'); const at = hs ? hs.nextSibling : null; if (b.parentNode !== h) h.insertBefore(b, at); }
            else if (b.parentNode !== document.body) document.body.appendChild(b);
        };
        place(); addEventListener('resize', place);
        const pill = b.querySelector('#ts-pill');
        const tog = on => {
            card.hidden = !on; pill.setAttribute('aria-expanded', on ? 'true' : 'false');
            if (!on) return;
            const r = pill.getBoundingClientRect(), w = card.offsetWidth;
            card.style.top = (r.bottom + 8) + 'px';
            card.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
        };
        pill.onclick = e => { e.stopPropagation(); tog(card.hidden); };
        document.addEventListener('click', e => { if (!card.hidden && !b.contains(e.target) && !card.contains(e.target)) tog(false); });
        addEventListener('resize', () => tog(false));
        card.querySelector('#ts-out').onclick = exit;
    }
    async function exit() {
        const b = document.getElementById('ts-out'); if (b) b.disabled = true;
        try { await db.rpc('v90_test_exit'); } catch (_) { }
        localStorage.removeItem(KEY);
        try { localStorage.setItem('orea_adm_tab', 'test'); } catch (_) { }
        location.href = './';
    }
    window.oreaTestExit = exit;
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', banner) : banner();

    /* ---------- Onglet « Test » (ORÉA) et « Écoles de démonstration » (ambassadeurs) — v94 ---------- */
    const CTX = { amb: false, after: null };
    window.oreaTestSection = function () {
        return `<h3>${CTX.amb ? 'Écoles de démonstration' : 'Espace Test'}</h3><p class="amb-sum">${CTX.amb ? 'Montrez ORÉA à un promoteur sur une école remplie de données fictives (5 au maximum ; supprimée après 90 jours sans usage).' : 'Créez des écoles TEST et ouvrez l’application comme n’importe quel rôle. Les vraies écoles ne sont jamais touchées. Les écoles des ambassadeurs apparaissent aussi ici.'}</p>
<div class="card col"><b>Nouvelle école test</b><input id="ts-name" placeholder="Nom (ex. : Primaire Kintambo)" maxlength="60"><select id="ts-type">${TYPES.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select><button type="button" id="ts-new">Créer l’école test</button></div><div id="ts-list"><div class="sk"></div></div>`;
    };
    window.oreaTestBind = async function (_list, opts) {
        if (opts) Object.assign(CTX, opts);
        const m = document.getElementById('ts-list') ? document : null; if (!m) return;
        const again = () => CTX.after ? CTX.after() : (typeof adminView === 'function' ? adminView() : location.reload());
        const nb = document.getElementById('ts-new');
        if (nb) nb.onclick = async () => {
            nb.disabled = true; nb.textContent = 'Création…';
            const { error } = await db.rpc('v90_test_create', { p_name: document.getElementById('ts-name').value.trim(), p_type: document.getElementById('ts-type').value });
            if (error) { nb.disabled = false; nb.textContent = 'Créer l’école test'; return toast(error.message); }
            toast('École test créée ✓'); again();
        };
        const { data, error } = await db.rpc('v94_test_schools');
        const box = document.getElementById('ts-list'); if (!box) return;
        if (error) { box.innerHTML = `<p class="empty">${E(error.message)}</p>`; return; }
        const L = data || [];
        box.innerHTML = L.length ? L.map(s => `<div class="card col"><b>${E(s.name)}</b><small>${E((TYPES.find(t => t[0] === s.school_type) || [0, s.school_type || 'Secondaire'])[1])} · ${s.students} élèves · code ${E(s.code)}${CTX.amb ? '' : ' · créée par ' + E(s.owner_name)}${s.last_used ? ' · utilisée le ' + new Date(s.last_used).toLocaleDateString('fr-FR') : ''}</small>
<span class="amb-sum">Voir comme :</span><div class="row" style="flex-wrap:wrap">${ROLES(s.school_type).filter(r => !(CTX.amb && r[0] === 'ambassadeur')).map(r => `<button type="button" class="ghost" style="width:auto;flex:1 1 40%" data-tv="${s.id}" data-r="${r[0]}" data-l="${E(r[1])}">${E(r[1])}</button>`).join('')}</div>
<button type="button" class="ghost" style="color:var(--bad)" data-td="${s.id}">Supprimer cette école test</button></div>`).join('') : '<p class="empty">Aucune école test pour le moment.</p>';
        box.querySelectorAll('[data-tv]').forEach(b => b.onclick = async () => {
            const s = L.find(x => x.id === b.dataset.tv); if (!s) return;
            b.disabled = true;
            const { error: e } = await db.rpc('v90_test_view', { p_school: s.id, p_role: b.dataset.r });
            if (e) { b.disabled = false; return toast(e.message); }
            localStorage.setItem(KEY, JSON.stringify({ sid: s.id, school: s.name, type: s.school_type, role: b.dataset.r, label: b.dataset.l }));
            location.href = b.dataset.r === 'parent' ? 'parent.html' : './';
        });
        box.querySelectorAll('[data-td]').forEach(b => b.onclick = async () => {
            const s = L.find(x => x.id === b.dataset.td); if (!s) return;
            if (!confirm('Supprimer « ' + s.name + ' » et toutes ses données de test ?')) return;
            b.disabled = true;
            const { error: e } = await db.rpc('v90_test_delete', { p_school: s.id });
            if (e) { b.disabled = false; return toast(e.message); }
            toast('École test supprimée'); again();
        });
    };
    // Espace ambassadeur : section « Écoles de démonstration » sous son tableau de bord
    const oAmb = window.ambDraw;
    if (typeof oAmb === 'function') window.ambDraw = async function () {
        const r = await oAmb.apply(this, arguments);
        const m = document.getElementById('main');
        if (m && !document.getElementById('ts-amb')) {
            const w = document.createElement('div'); w.id = 'ts-amb';
            CTX.amb = true; CTX.after = () => window.ambDraw();
            w.innerHTML = oreaTestSection();
            const last = m.querySelector('button[onclick="out()"]') || m.querySelector('button[onclick=out\\(\\)]');
            last ? m.insertBefore(w, last) : m.appendChild(w);
            oreaTestBind(null, { amb: true, after: () => window.ambDraw() });
        }
        return r;
    };
})();
