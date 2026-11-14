/* =====================================================================
   ORÉA École — installcheck.js : « 🔎 Vérifier l'installation »
   Compare les fichiers en ligne (GitHub) avec ceux de la dernière livraison.
   Chaque livraison remet à jour la liste ci-dessous (empreintes SHA-256).
   Visible : Réglages du chef d'établissement + panneau ORÉA.
   ===================================================================== */
(function () {
    'use strict';
    const LIVRAISON = 'v107 · 14/11/2026';
    const FILES = {
        "index.html": "b11f2aea4a9909d3ff84d5ac13b89590b558920efb4c7505022836528d7076ec",
        "parent.html": "220ff9646938f9e44b6bcd90d5408c2857a529fab2750fd29693d08694155679",
        "sw.js": "057fab9b7e85b915e9c9cf5af544c4d78a3d00a234a22e9c1f5b067eb2be575a",
        "manifest.json": "388e6d6df3e4442301f70f10241f49cc3d8d858251cf7aee9c9c4fbd7a23e72d",
        "manifest-parent.json": "08111dd3164a7162a8d84f267d2a04016d64c127b2951dfbfdde67227e3453cb",
        "ambadmin.js": "2cf5526c333fe6d96bdd776491754e2d481ba783e6d07ab7b14d921b695a1b7e",
        "ambassadeur.js": "f1fa1330f185d2c3a11e29c48085ffb532d5557244d9e27a6d67b1c32fdfd880",
        "annee.js": "09d6e07e258194a464a08e6dc36af9f74810f6de608a6ea1aca18f93365f6532",
        "announcements.js": "a4e26ad07be6866df9eb5a57638b0eca7c54a6eff6b9989c401bcdeb0184c062",
        "app.js": "622aab3c8275770ced7a68b617d502bfbd94b3d53e1b74a9c638a1a44be6c20c",
        "auth_ui.js": "890281e1af24f1c0236d3f81ab17cfa9962c4a68c470154594d13a4b775fcd71",
        "bulletins.js": "f766566048aecfb1717e16b3406ab3ced64dbe5c18c1d56561378f62e09e017b",
        "bureau.css": "0e5da3eff23bd80dda467f082ab88ea7ffb42179f922570decc2f86fccb6d6a9",
        "bureau.js": "ac9aa4f60075e110f8b3e5bdeb0310c2f71b6c1244f7dd7d81ac7797b7aa7761",
        "cahier.js": "213a99c89d1a646cbac4a437417bc8b102faa99334a744a42dcd21b16ef355d2",
        "config.js": "5ac18ecc4cd8323bb18a707ef70c1a5c9a13bc1a08b40220d4ae1b9a05581e9c",
        "enafep.js": "6a10ee7d964bd61315ef88c8eb8921196e524f579161e85e1551be08d1030080",
        "equipe.js": "fbab24355f6fcf028a2c72f83db25c966e1c76615d4d3bf23c47d948166274b0",
        "famille.js": "6e17aea98c14ebec660b64231c20aeb59e4eb75ec51294d8049f32cc4fba75f9",
        "finance.js": "f925e04fe9ae5103b38b2398717365dcfdf1b4d512b21528d642c6e7129a8d3d",
        "inspecteur.js": "9aa34624368af542265e96a2879982a25d5360590a87ee777d261a38b3c0f287",
        "langues.js": "4d4a443804cf47c110f9526cc4c2cf79b97609ca26549821c3fe447f23861991",
        "listes.js": "5c5f44cfe1a09bf8c7a52d42b71efaea3f2213a19a85cdb1a0d6cfdce595138e",
        "ia.js": "bdb5960ff721f28af86a91809cdd4d8dc3c0d2be46950380f767ad3ef795a78d",
        "messages.js": "bc9d79d90b93907768244926a394ef71a7b90d1e0d68da4e1b0d6a512ab9f506",
        "notes.js": "a45169f998f1b4f5bb8b496415b0245b385d6d01b8e8e752120f049b5afe2025",
        "releve.js": "1bfc144a969c99c1b771295cea6bec4f44805c27882010737261bfc08f906e5d",
        "notifications.js": "1b080c37ac646a8a0c9bc7532c436b70b96d830f9fca0288cd11af24c20e13ca",
        "offline.js": "5c32900b3daa413f918bb103c4f84d97aefbde1f23b48dcc55f2a68d4eccea6a",
        "options.js": "4e87574de18b7a54877a5b850b020af9a8aa09783d8d9cd6876a162cf6eee6c0",
        "parent.css": "9ba34fa4d47c51b909a2f16496c02aed2ae8763f2ad6b674d7773605725b12ca",
        "parent.js": "45af4a739db3e9c957ce188d9f8627200b3ea929fedb98c55e0ac6c244d77414",
        "parent_notes.js": "879560633dabb63677fda7f1b8d71b1448955c78a969882e20da443b2de600b9",
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
