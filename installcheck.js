/* =====================================================================
   ORÉA École — installcheck.js : « 🔎 Vérifier l'installation »
   Compare les fichiers en ligne (GitHub) avec ceux de la dernière livraison.
   Chaque livraison remet à jour la liste ci-dessous (empreintes SHA-256).
   Visible : Réglages du chef d'établissement + panneau administrateur.
   ===================================================================== */
(function () {
    'use strict';
    const LIVRAISON = 'v84 · 06/11/2026';
    const FILES = {
        "index.html": "02674e6ba9690e7949688bca0c2c163619f5d4e1a84d0cdb84347cd89fedde43",
        "parent.html": "6f9e450d6b2d969c2e0832313666a011318c39ce60bcdac32719b074052630d2",
        "sw.js": "0f7943d37a055ac50e697869f6e3cddff631b7a317b2550baf71544d4e98daae",
        "app.js": "b9c583118dc768a2a3faabf8b48fbaae2aa4705d760414974129765d16690217",
        "equipe.js": "67a2d76dca407a6f673122ede923b22f6bdf6faa43ce66f4e35f95ee143352fe",
        "timetable.js": "9377fa445308a300b67ebed9be8576c04596908537c1c8ac075907880412775d",
        "finance.js": "fa9823a07d98229905c7ffa568999226800ae806e39f302ee363591eab2cb7b6",
        "announcements.js": "a4e26ad07be6866df9eb5a57638b0eca7c54a6eff6b9989c401bcdeb0184c062",
        "messages.js": "a726359da88a224f8b59e7f6373cde0462b23dc5108220bee2be1c9a3491bf94",
        "reminders.js": "5f016523e930d2b8cb7e98608d07baa3abd1b23d833840aa1def77231fa041bf",
        "notes.js": "86c0909904e88af921acc18871b084685d9f8087c32b336ff397e523244cd427",
        "bulletins.js": "f766566048aecfb1717e16b3406ab3ced64dbe5c18c1d56561378f62e09e017b",
        "ambassadeur.js": "713a86f600a64e98f5c1c397d29ca5aeedb521609db67cab22b4ca34b34a7845",
        "parent.js": "1285401df525a458cf3e86d7cb8da5bc7175159f3a66f1e9211484aedbd85b51",
        "quiz_ui.js": "11ebf273dead7e68a9afb63145c747c20a5bd18f5d52527fb191e4fa8d46a575",
        "quiz_engine.js": "590951f3a188f618743f73e9441e66fd50a9e31dba9cd1040925eb923d151fe0",
        "push.js": "a4669c1001524a568aef31cd349618849da7de2f7632e650b1dad30ed310081a",
        "notifications.js": "1b080c37ac646a8a0c9bc7532c436b70b96d830f9fca0288cd11af24c20e13ca",
        "quotidien.js": "fe290fc42c48333a1b12815244e7ad9f7fe1f9f4af43936d1bd408af192361d0",
        "famille.js": "addf6edf0428c4feaacbe20a889335cf69bcb938eed333417b94b3c8334474f4",
        "stats.js": "d00b33b3aaf59018711db143525f590e59f113d08aecda07f259b4f1153ce198",
        "enafep.js": "6a10ee7d964bd61315ef88c8eb8921196e524f579161e85e1551be08d1030080",
        "ui.js": "2065291bc29b3d23e74e91840ec68b1e0e313cc9c1d65355e89e67193940444b",
        "bureau.js": "bd04dd6661fb4bf6abed0173909cae6f43272324e4e7fb221a4c61f03da245d2",
        "bureau.css": "6a8fd8a0ec1b2008b804cee2a7d730961ed37225291edd0efab4e5f47943cd13"
};

    async function sha(buf) {
        const h = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    window.oreaInstallCheck = async function () {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;inset:0;z-index:600;background:var(--bg,#14110d);color:var(--tx,#f0eee6);overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 16px 30px;font-family:inherit';
        box.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><button id="ic-x" style="width:42px;min-height:42px;border-radius:12px;border:1px solid var(--line,#444);background:transparent;color:inherit">✕</button><b style="font-size:18px">🔎 Vérifier l’installation</b></div><p style="color:var(--mut,#999);font-size:13px">Livraison attendue : <b>${LIVRAISON}</b>. Si un fichier vient d’être déposé sur GitHub, attends 10 minutes avant de vérifier.</p><div id="ic-l">Vérification en cours…</div>`;
        box.className = 'ic-ov';
        document.body.appendChild(box);
        history.pushState({ ic: 1 }, '');
        const onPop = e => { e.stopImmediatePropagation(); box.remove(); window.removeEventListener('popstate', onPop); };
        window.addEventListener('popstate', onPop);
        box.querySelector('#ic-x').onclick = () => history.back();
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
