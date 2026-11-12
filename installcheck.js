/* =====================================================================
   ORÉA École — installcheck.js : « 🔎 Vérifier l'installation »
   Compare les fichiers en ligne (GitHub) avec ceux de la dernière livraison.
   Chaque livraison remet à jour la liste ci-dessous (empreintes SHA-256).
   Visible : Réglages du chef d'établissement + panneau ORÉA.
   ===================================================================== */
(function () {
    'use strict';
    const LIVRAISON = 'v103 · 12/11/2026';
    const FILES = {
        "index.html": "0fee65c8e8e2b62a2520a9990dafa199f4e05c48a73e1e5d228bbf0ce97730f9",
        "parent.html": "ecaaa0efb2216e455da331309b7eb8b51a26bac972760d05906b9402561ffdc9",
        "sw.js": "4809739f330a1b1eee624bdf15e65fd10b5c38f6bbe20306a8fc1c8ee97e232c",
        "manifest.json": "388e6d6df3e4442301f70f10241f49cc3d8d858251cf7aee9c9c4fbd7a23e72d",
        "manifest-parent.json": "08111dd3164a7162a8d84f267d2a04016d64c127b2951dfbfdde67227e3453cb",
        "ambadmin.js": "0ae5d5cfb8f5be9304e623b22d11eb8694ee97d2e7ad7a75dcdbec826bfe90bf",
        "ambassadeur.js": "713a86f600a64e98f5c1c397d29ca5aeedb521609db67cab22b4ca34b34a7845",
        "annee.js": "09d6e07e258194a464a08e6dc36af9f74810f6de608a6ea1aca18f93365f6532",
        "announcements.js": "a4e26ad07be6866df9eb5a57638b0eca7c54a6eff6b9989c401bcdeb0184c062",
        "app.js": "c324f24397e87fe44e411cfd4fbdb54487d5caff694ec2529b0d4690951b2220",
        "auth_ui.js": "890281e1af24f1c0236d3f81ab17cfa9962c4a68c470154594d13a4b775fcd71",
        "bulletins.js": "f766566048aecfb1717e16b3406ab3ced64dbe5c18c1d56561378f62e09e017b",
        "bureau.css": "0e5da3eff23bd80dda467f082ab88ea7ffb42179f922570decc2f86fccb6d6a9",
        "bureau.js": "ac9aa4f60075e110f8b3e5bdeb0310c2f71b6c1244f7dd7d81ac7797b7aa7761",
        "cahier.js": "213a99c89d1a646cbac4a437417bc8b102faa99334a744a42dcd21b16ef355d2",
        "config.js": "7c503db0a64d817511c27f337252c81e8811f3562a7d4be045b86190644f27f3",
        "enafep.js": "6a10ee7d964bd61315ef88c8eb8921196e524f579161e85e1551be08d1030080",
        "equipe.js": "5dbb34021b9ad41a1133ee959b94eb33f4fcd140ba85d341104d93089f59d97a",
        "famille.js": "6e17aea98c14ebec660b64231c20aeb59e4eb75ec51294d8049f32cc4fba75f9",
        "finance.js": "f925e04fe9ae5103b38b2398717365dcfdf1b4d512b21528d642c6e7129a8d3d",
        "inspecteur.js": "9aa34624368af542265e96a2879982a25d5360590a87ee777d261a38b3c0f287",
        "langues.js": "4d4a443804cf47c110f9526cc4c2cf79b97609ca26549821c3fe447f23861991",
        "listes.js": "5c5f44cfe1a09bf8c7a52d42b71efaea3f2213a19a85cdb1a0d6cfdce595138e",
        "ia.js": "d99801fe1910a7746831bfc42cd4b3bc54757fd70ce1f1487121814c311b645b",
        "messages.js": "bc9d79d90b93907768244926a394ef71a7b90d1e0d68da4e1b0d6a512ab9f506",
        "notes.js": "bd87dd04c98c50309124a0a3ac4136f16301285ca949a9e7639799d073e0dfd0",
        "notifications.js": "1b080c37ac646a8a0c9bc7532c436b70b96d830f9fca0288cd11af24c20e13ca",
        "offline.js": "5c32900b3daa413f918bb103c4f84d97aefbde1f23b48dcc55f2a68d4eccea6a",
        "options.js": "4e87574de18b7a54877a5b850b020af9a8aa09783d8d9cd6876a162cf6eee6c0",
        "parent.css": "9ba34fa4d47c51b909a2f16496c02aed2ae8763f2ad6b674d7773605725b12ca",
        "parent.js": "3b4b09ed605fca2a3555c53bee12ac75bfa090ef56342daa9b6f2fe7f1265dda",
        "parent_notes.js": "c7bd53e27af60ae6fa8c1a6f27b4c63e1573e80490ee96c98721af04785121e0",
        "parent_notifs.js": "61bfbfb772ac3382a924d5ab61d55737739284dd72de9ad6a5ec524f5cdb7f36",
        "personnel.js": "f224408abc4c65a4e270c89362379c523817b709ca84319da9ee7ee5bb752f7a",
        "preinscription.js": "391684872e0edd65cbae5f383624a85495da4bc95bb9d065e0b02a0b8c3a5a32",
        "push.js": "a4669c1001524a568aef31cd349618849da7de2f7632e650b1dad30ed310081a",
        "quiz_engine.js": "9df215c2a5382cca4944f4c8e93ad81393bc2821bec549df78b7ec85a20b6af6",
        "quiz_ui.js": "e6c29eedfdb4142578c3d65e88b7ff33aadce4f3bceacd32fb9adbf4105dc2a4",
        "quotidien.js": "fe290fc42c48333a1b12815244e7ad9f7fe1f9f4af43936d1bd408af192361d0",
        "reminders.js": "c8292532abbb8adf56475b610de9cc29fcfd28b1223158e44c30aabf203e6e6a",
        "risque.js": "707ce0f15a49fd50b2b188e6c9852cc7dd4766cbaab81f243846d0c89fc22dce",
        "scan.js": "e4e6f45dd2b972e02e8ef2215c0190ab0705bcf53d21457017c1f530df0348c8",
        "stats.js": "cfbc8e7cef5a87e5800a8a36736c951ebf5e2ecb4265af75daaf888f29ba6418",
        "style.css": "98cfafc2fed3f0551585ed8a1c82f84e5355bb318e424e046bee061c559951b7",
        "test.js": "b4544ed7a1a0782a668d8d96be5b29705fbcf7347b6652858e0476336352a3c7",
        "timetable.js": "ba798f2e7ef3dffe2b616d0dfd77b1e06c80c54111265e63847399042b1d61ab",
        "ui.js": "f033a325442cceb7e24db563b802c9cc8ff440e1c3d5a8933e7d2185b024f02e",
        "verif.html": "f0504b62cb4fd9109958a4249d8444d9c5c2609285548ab202c2a356a9ecf936",
        "villes.js": "e374caca1f8cb398cff2b08ee21596734b51e2d75a26354e3fead2d88f9f0876",
        "voix.js": "f74e4ead2adcf4a51c48a95d0e140dcf57ace3274139f7d786e120ace90875da",
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
