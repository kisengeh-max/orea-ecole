/* =====================================================================
   ORÉA École — installcheck.js : « 🔎 Vérifier l'installation »
   Compare les fichiers en ligne (GitHub) avec ceux de la dernière livraison.
   Chaque livraison remet à jour la liste ci-dessous (empreintes SHA-256).
   Visible : Réglages du chef d'établissement + panneau administrateur.
   ===================================================================== */
(function () {
    'use strict';
    const LIVRAISON = 'v81 · 06/11/2026';
    const FILES = {
        "index.html": "83344bd40d9f19c4bf67fe7573091475626e753bac6b18f1ec71496547ddef90",
        "parent.html": "54cf6d73cb3938026b5c9d09a30f697152058248661cf8580caaca850f3b90a0",
        "sw.js": "3fa80c726eb1d1788b19d7b61b57913d966356325d79db29acf3de9c8d2716a6",
        "app.js": "f8dd33096e7a81ce80d50ab0a9d43d0a4cba1350e4dd5c54426fe9d6572b47df",
        "equipe.js": "149237f01167aad61a79af92ebe76b0758d665e3d14f9248a00918a00302bcef",
        "timetable.js": "e91b643442ddb6280e12e7d9afdb2af436bead51946cf1598f91147d7bd858a5",
        "finance.js": "fa9823a07d98229905c7ffa568999226800ae806e39f302ee363591eab2cb7b6",
        "announcements.js": "a4e26ad07be6866df9eb5a57638b0eca7c54a6eff6b9989c401bcdeb0184c062",
        "messages.js": "a726359da88a224f8b59e7f6373cde0462b23dc5108220bee2be1c9a3491bf94",
        "reminders.js": "5f016523e930d2b8cb7e98608d07baa3abd1b23d833840aa1def77231fa041bf",
        "notes.js": "e867c68a935b7e74c08c61713635f85828ab8ca41a97757b0325e052095c8ac5",
        "bulletins.js": "f766566048aecfb1717e16b3406ab3ced64dbe5c18c1d56561378f62e09e017b",
        "ambassadeur.js": "713a86f600a64e98f5c1c397d29ca5aeedb521609db67cab22b4ca34b34a7845",
        "parent.js": "1285401df525a458cf3e86d7cb8da5bc7175159f3a66f1e9211484aedbd85b51",
        "quiz_ui.js": "11ebf273dead7e68a9afb63145c747c20a5bd18f5d52527fb191e4fa8d46a575",
        "quiz_engine.js": "590951f3a188f618743f73e9441e66fd50a9e31dba9cd1040925eb923d151fe0",
        "push.js": "a4669c1001524a568aef31cd349618849da7de2f7632e650b1dad30ed310081a",
        "notifications.js": "1b080c37ac646a8a0c9bc7532c436b70b96d830f9fca0288cd11af24c20e13ca",
        "quotidien.js": "f8d722fa03c864618a36a1f83c4b6fc4b5ef662829a025d5d5413b8518c0704f",
        "famille.js": "78989a335452be2af637045983dcf301640faad4b11c99222736200cffd4c289",
        "stats.js": "1665f7db94af6c140c8a0592fa82c9504a9589d68d507c784a9ade75deeb55ae",
        "enafep.js": "4654b15386ffda534ff435d4b7749b0ee11358b370bbd4cb22adf53678a71502"
};

    async function sha(buf) {
        const h = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    window.oreaInstallCheck = async function () {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;inset:0;z-index:600;background:var(--bg,#14110d);color:var(--tx,#f0eee6);overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 16px 30px;font-family:inherit';
        box.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><button id="ic-x" style="width:42px;min-height:42px;border-radius:12px;border:1px solid var(--line,#444);background:transparent;color:inherit">✕</button><b style="font-size:18px">🔎 Vérifier l’installation</b></div><p style="color:var(--mut,#999);font-size:13px">Livraison attendue : <b>${LIVRAISON}</b>. Si un fichier vient d’être déposé sur GitHub, attends 10 minutes avant de vérifier.</p><div id="ic-l">Vérification en cours…</div>`;
        document.body.appendChild(box);
        box.querySelector('#ic-x').onclick = () => box.remove();
        const out = [];
        for (const [f, h] of Object.entries(FILES)) {
            let st = 'bad';
            try {
                const r = await fetch(f + (f.includes('?') ? '&' : '?') + 'ic=' + Date.now(), { cache: 'no-store' });
                st = !r.ok ? 'miss' : (await sha(await r.arrayBuffer())) === h ? 'ok' : 'bad';
            } catch (_) { st = 'net'; }
            out.push([f, st]);
            box.querySelector('#ic-l').innerHTML = out.map(([n, s]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line,#333)"><span>${n}</span><b style="color:${s === 'ok' ? 'var(--ok,#3fae6a)' : 'var(--bad,#d0574b)'}">${{ ok: '✅ à jour', bad: '❌ ancienne version', miss: '❌ absent', net: '⚠️ pas de réseau' }[s]}</b></div>`).join('');
        }
        const bad = out.filter(x => x[1] !== 'ok').map(x => x[0]);
        box.querySelector('#ic-l').insertAdjacentHTML('afterbegin', `<div style="padding:12px;border-radius:12px;margin:10px 0;border:1px solid ${bad.length ? 'var(--bad,#d0574b)' : 'var(--ok,#3fae6a)'}"><b>${bad.length ? bad.length + ' fichier(s) à déposer à nouveau sur GitHub :' : '✅ Tous les fichiers sont à jour.'}</b>${bad.length ? '<br>' + bad.join(', ') : ''}</div>`);
    };

    const card = () => `<div class="card col" id="ic-card"><b>🔎 Vérifier l’installation</b><small>Contrôle que tous les fichiers de la dernière livraison sont bien sur GitHub.</small><button class="ghost" onclick="oreaInstallCheck()">Vérifier</button></div>`;
    const oReg = window.vReglages;
    if (typeof oReg === 'function' && !oReg.__ic) {
        window.vReglages = function () {
            const r = oReg.apply(this, arguments);
            try {
                const main = document.getElementById('main');
                const head = typeof fin === 'function' ? fin() : (typeof S !== 'undefined' && S.me && S.me.role === 'directeur');
                if (main && head && !main.querySelector('#ic-card')) {
                    const det = main.querySelector('details');
                    det ? det.insertAdjacentHTML('beforebegin', card()) : main.insertAdjacentHTML('beforeend', card());
                }
            } catch (_) { }
            return r;
        };
        window.vReglages.__ic = true;
    }
    const oAdm = window.admRender;
    if (typeof oAdm === 'function' && !oAdm.__ic) {
        window.admRender = function () {
            const r = oAdm.apply(this, arguments);
            try { const main = document.getElementById('main'); if (main && !main.querySelector('#ic-card')) main.insertAdjacentHTML('afterbegin', card()); } catch (_) { }
            return r;
        };
        window.admRender.__ic = true;
    }
})();
