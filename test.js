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
    function banner() {
        const t = read(); if (!t || document.getElementById('ts-bar')) return;
        const st = document.createElement('style');
        st.textContent = '#ts-bar{position:sticky;top:0;z-index:950;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;padding:calc(6px + env(safe-area-inset-top)) 10px 6px;background:repeating-linear-gradient(135deg,#6d28d9 0 14px,#5b21b6 14px 28px);color:#fff;font:600 13px/1.3 system-ui,sans-serif;text-align:center}#ts-bar button{width:auto;min-height:32px;padding:4px 12px;margin:0;border-radius:8px;border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.15);color:#fff;font:700 12.5px system-ui,sans-serif;box-shadow:none}';
        document.head.appendChild(st);
        const b = document.createElement('div'); b.id = 'ts-bar';
        b.innerHTML = `<span>🧪 MODE TEST · <b>${E(t.label)}</b> · ${E(t.school)}</span><button type="button" id="ts-out">Revenir à ORÉA</button>`;
        document.body.prepend(b);
        b.querySelector('#ts-out').onclick = exit;
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
