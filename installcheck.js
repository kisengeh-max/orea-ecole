/* =====================================================================
   ORÉA École — installcheck.js : « 🔎 Vérifier l'installation »
   Compare les fichiers en ligne (GitHub) avec ceux de la dernière livraison.
   Chaque livraison remet à jour la liste ci-dessous (empreintes SHA-256).
   Visible : Réglages du chef d'établissement + panneau ORÉA.
   ===================================================================== */
(function () {
    'use strict';
    const LIVRAISON = 'v92 · 08/11/2026';
    const FILES = {
        "index.html": "b16c8bf1d1287f7c46b0a324149440b71ba8fcaa77fe49867edac5333d69524c",
        "parent.html": "3a7c38a66698d27c67ef4ad470e4186f7a8ebb3576e69308a5fb68c6740ba042",
        "sw.js": "47951d1b1f8c4b73c13a937527976cbbd66a3b1f761595a6ab345c439e784446",
        "manifest.json": "388e6d6df3e4442301f70f10241f49cc3d8d858251cf7aee9c9c4fbd7a23e72d",
        "manifest-parent.json": "08111dd3164a7162a8d84f267d2a04016d64c127b2951dfbfdde67227e3453cb",
        "ambadmin.js": "c6e0ff9d8bcf401127e1e8eb140ce05d91c4120c536f5ebb1ce087ae77d23bc7",
        "ambassadeur.js": "713a86f600a64e98f5c1c397d29ca5aeedb521609db67cab22b4ca34b34a7845",
        "announcements.js": "a4e26ad07be6866df9eb5a57638b0eca7c54a6eff6b9989c401bcdeb0184c062",
        "app.js": "67294bc2103015228de657a673b8438cbc7af238e0cdc4b36c2436127e296483",
        "auth_ui.js": "890281e1af24f1c0236d3f81ab17cfa9962c4a68c470154594d13a4b775fcd71",
        "bulletins.js": "f766566048aecfb1717e16b3406ab3ced64dbe5c18c1d56561378f62e09e017b",
        "bureau.css": "15d86119d3c3f0ff9cc3b1b7a543f3e30dd2c1b8fa913da1cb4529caf176fa7f",
        "bureau.js": "ac9aa4f60075e110f8b3e5bdeb0310c2f71b6c1244f7dd7d81ac7797b7aa7761",
        "cahier.js": "213a99c89d1a646cbac4a437417bc8b102faa99334a744a42dcd21b16ef355d2",
        "config.js": "1389cfd9c8cc40393b4490966a91e5f582a8c33b17932f28ae134774596b4a5a",
        "enafep.js": "6a10ee7d964bd61315ef88c8eb8921196e524f579161e85e1551be08d1030080",
        "equipe.js": "bd608393e81e943e40efc1de429dddf7a820754e803d6e3d39c40959aafb7849",
        "famille.js": "6e17aea98c14ebec660b64231c20aeb59e4eb75ec51294d8049f32cc4fba75f9",
        "finance.js": "3b7aac443467a923fb38cddb204ccbb45d5babf63ac743bc0044f34829f1c820",
        "inspecteur.js": "9aa34624368af542265e96a2879982a25d5360590a87ee777d261a38b3c0f287",
        "langues.js": "4d4a443804cf47c110f9526cc4c2cf79b97609ca26549821c3fe447f23861991",
        "messages.js": "bc9d79d90b93907768244926a394ef71a7b90d1e0d68da4e1b0d6a512ab9f506",
        "notes.js": "9c366fc806ae511ca83b0453db8f339f99d627e37b51a5b827288b3aa7f26885",
        "notifications.js": "1b080c37ac646a8a0c9bc7532c436b70b96d830f9fca0288cd11af24c20e13ca",
        "offline.js": "6854fafbdfc87aceb000502be1c43a4686338fc0a3137b8e69f089ea911456cd",
        "parent.css": "7acaae4680a3e9bceb3488d5c0a167dde74a01ac09784785c8c84911951ef175",
        "parent.js": "d9b81b190ab6e7be16fad4d6a810e00826b1a1d5cf5dd3d02e381ee7332dca44",
        "parent_notes.js": "c7bd53e27af60ae6fa8c1a6f27b4c63e1573e80490ee96c98721af04785121e0",
        "parent_notifs.js": "61bfbfb772ac3382a924d5ab61d55737739284dd72de9ad6a5ec524f5cdb7f36",
        "personnel.js": "f224408abc4c65a4e270c89362379c523817b709ca84319da9ee7ee5bb752f7a",
        "preinscription.js": "3df7403ee4b88cf107e4a328569c3a2bc41f9455096dc6869573f3a175f72af8",
        "push.js": "a4669c1001524a568aef31cd349618849da7de2f7632e650b1dad30ed310081a",
        "quiz_engine.js": "9df215c2a5382cca4944f4c8e93ad81393bc2821bec549df78b7ec85a20b6af6",
        "quiz_ui.js": "e6c29eedfdb4142578c3d65e88b7ff33aadce4f3bceacd32fb9adbf4105dc2a4",
        "quotidien.js": "fe290fc42c48333a1b12815244e7ad9f7fe1f9f4af43936d1bd408af192361d0",
        "reminders.js": "c8292532abbb8adf56475b610de9cc29fcfd28b1223158e44c30aabf203e6e6a",
        "scan.js": "e4e6f45dd2b972e02e8ef2215c0190ab0705bcf53d21457017c1f530df0348c8",
        "stats.js": "cfbc8e7cef5a87e5800a8a36736c951ebf5e2ecb4265af75daaf888f29ba6418",
        "style.css": "98cfafc2fed3f0551585ed8a1c82f84e5355bb318e424e046bee061c559951b7",
        "test.js": "5cc83866b5d7d3f6fcce75530b64c52613f2a856e0eadbce274ef31e9c083d3b",
        "timetable.js": "9377fa445308a300b67ebed9be8576c04596908537c1c8ac075907880412775d",
        "ui.js": "e643f1f006731cf55ab61f8aaf757650db0646363559c3b40f27fdf9a72e00e3",
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
