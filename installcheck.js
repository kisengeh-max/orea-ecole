/* =====================================================================
   ORÉA École — installcheck.js : « 🔎 Vérifier l'installation »
   Compare les fichiers en ligne (GitHub) avec ceux de la dernière livraison.
   Chaque livraison remet à jour la liste ci-dessous (empreintes SHA-256).
   Visible : Réglages du chef d'établissement + panneau ORÉA.
   ===================================================================== */
(function () {
    'use strict';
    const LIVRAISON = 'v87 · 08/11/2026';
    const FILES = {
        "index.html": "07db7734f037027cbbee6f1a3b9b3d91d4633e4d28cf32690d4b838ee2c7eb2e",
        "parent.html": "1d287828fe8a2356c57efe3a808f6e31d0dc2304fcdd4dbaff87640a8ca942b2",
        "sw.js": "f6cd31a40b863f1d2df3b1d7b7a7f50e7d8f5a8771e94f506161701ec6a5e2ec",
        "manifest.json": "388e6d6df3e4442301f70f10241f49cc3d8d858251cf7aee9c9c4fbd7a23e72d",
        "manifest-parent.json": "08111dd3164a7162a8d84f267d2a04016d64c127b2951dfbfdde67227e3453cb",
        "ambadmin.js": "6e698da5457e1c9cc4c89b5460bb3dee724c909bce5b6a74abab564367c56df8",
        "ambassadeur.js": "713a86f600a64e98f5c1c397d29ca5aeedb521609db67cab22b4ca34b34a7845",
        "announcements.js": "a4e26ad07be6866df9eb5a57638b0eca7c54a6eff6b9989c401bcdeb0184c062",
        "app.js": "4fa5ebf97004834bc25bf493ab8f0c5dc6bf7ab60d0a7c087a162b4eaf7b4bef",
        "auth_ui.js": "890281e1af24f1c0236d3f81ab17cfa9962c4a68c470154594d13a4b775fcd71",
        "bulletins.js": "f766566048aecfb1717e16b3406ab3ced64dbe5c18c1d56561378f62e09e017b",
        "bureau.css": "15d86119d3c3f0ff9cc3b1b7a543f3e30dd2c1b8fa913da1cb4529caf176fa7f",
        "bureau.js": "ac9aa4f60075e110f8b3e5bdeb0310c2f71b6c1244f7dd7d81ac7797b7aa7761",
        "config.js": "c2a84a45684546ed0a45caaeabfc206189e0b5889975e5debe54d77abd4aec89",
        "enafep.js": "6a10ee7d964bd61315ef88c8eb8921196e524f579161e85e1551be08d1030080",
        "equipe.js": "67a2d76dca407a6f673122ede923b22f6bdf6faa43ce66f4e35f95ee143352fe",
        "famille.js": "addf6edf0428c4feaacbe20a889335cf69bcb938eed333417b94b3c8334474f4",
        "finance.js": "fa9823a07d98229905c7ffa568999226800ae806e39f302ee363591eab2cb7b6",
        "messages.js": "bc9d79d90b93907768244926a394ef71a7b90d1e0d68da4e1b0d6a512ab9f506",
        "notes.js": "86c0909904e88af921acc18871b084685d9f8087c32b336ff397e523244cd427",
        "notifications.js": "1b080c37ac646a8a0c9bc7532c436b70b96d830f9fca0288cd11af24c20e13ca",
        "parent.css": "7acaae4680a3e9bceb3488d5c0a167dde74a01ac09784785c8c84911951ef175",
        "parent.js": "3d8b02f1d1d9f0650c970d271f29c10e74652244565f13001430c22ad21d054e",
        "parent_notes.js": "c7bd53e27af60ae6fa8c1a6f27b4c63e1573e80490ee96c98721af04785121e0",
        "parent_notifs.js": "61bfbfb772ac3382a924d5ab61d55737739284dd72de9ad6a5ec524f5cdb7f36",
        "push.js": "a4669c1001524a568aef31cd349618849da7de2f7632e650b1dad30ed310081a",
        "quiz_engine.js": "590951f3a188f618743f73e9441e66fd50a9e31dba9cd1040925eb923d151fe0",
        "quiz_ui.js": "a9c15edc009d7ec278a6cb04d53157f33a7b5a66044c50935f0df2b39c7e0f1e",
        "quotidien.js": "fe290fc42c48333a1b12815244e7ad9f7fe1f9f4af43936d1bd408af192361d0",
        "reminders.js": "1aa57525229e32371ec59568987c8a65583835bcb72ad4e3856cc72afc4718f3",
        "scan.js": "892a0ea84735a525f55fc1e1d62df8fbb78ada6db6237d46109bda6c33e5d510",
        "stats.js": "d00b33b3aaf59018711db143525f590e59f113d08aecda07f259b4f1153ce198",
        "style.css": "98cfafc2fed3f0551585ed8a1c82f84e5355bb318e424e046bee061c559951b7",
        "timetable.js": "9377fa445308a300b67ebed9be8576c04596908537c1c8ac075907880412775d",
        "ui.js": "7b0efe3fee3580e569e08a8e6281412a62c2f445ee683aafc0011af6e84f3002",
        "verif.html": "f0504b62cb4fd9109958a4249d8444d9c5c2609285548ab202c2a356a9ecf936",
        "villes.js": "e374caca1f8cb398cff2b08ee21596734b51e2d75a26354e3fead2d88f9f0876",
        "icon-maskable-192.png": "7eb94d68f3773775e7cd584786cc5df35ebcbda5912f464d1fe1646969f562ef",
        "icon-maskable-512.png": "82d0c96a597324cfc67a0c1f5498a50a4037f65a9e764a9757a618d4d225a45b"
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
