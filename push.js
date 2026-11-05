/* =====================================================================
   ORÉA École v73 — push.js
   Notifications système (même quand l'application est fermée).
   Chargé par index.html (personnel, administrateur) ET parent.html (parents).
   - Si l'utilisateur a déjà autorisé : abonnement mis à jour en silence.
   - Sinon : petit bandeau « Activer » (le navigateur exige un toucher).
   - Après activation : notification de test « ✅ Notifications activées ».
   L'abonnement est enregistré par la fonction sécurisée push_save (Supabase).
   À charger APRÈS app.js (page école) / APRÈS parent.js (page parent).
   ===================================================================== */
(function () {
    'use strict';
    if (typeof db === 'undefined') return;

    // Clé PUBLIQUE VAPID d'ORÉA (la clé privée est dans les secrets de la fonction send-push)
    const VAPID_PUBLIC_KEY = 'BC4UPgvHKyK0vA0PX7TayLczJjIG_h5TQegdYK1jcsZpk61RA8sBPbFth3_A6BqwYOxVA35tNRq9xKvsH0yo9AQ';

    const SUPPORTED = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const LS = {
        get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { } },
        del: k => { try { localStorage.removeItem(k); } catch (_) { } }
    };
    const say = m => { try { if (typeof toast === 'function') return toast(m); } catch (_) { } alert(m); };

    function b64ToU8(s) {
        const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
        const u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        return u;
    }
    // Le service worker est enregistré par app.js / parent.js : on limite l'attente.
    const swReady = () => Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('service worker indisponible')), 10000))
    ]);
    // L'abonnement existant a-t-il été fait avec NOTRE clé ? (sinon il ne recevrait rien)
    function sameKey(sub) {
        try {
            const k = sub.options && sub.options.applicationServerKey;
            if (!k) return true;
            const a = new Uint8Array(k), b = b64ToU8(VAPID_PUBLIC_KEY);
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
            return true;
        } catch (_) { return true; }
    }

    let uid = null, busy = false;

    // Enregistre l'abonnement (au plus une fois par semaine si rien n'a changé : économise la connexion)
    async function save(sub, force) {
        const j = sub.toJSON(), mark = uid + '|' + j.endpoint;
        if (!force && LS.get('orea_push_saved') === mark && Date.now() - Number(LS.get('orea_push_saved_at') || 0) < 7 * 864e5) return true;
        const { error } = await db.rpc('push_save', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
        if (error) { console.warn('push_save :', error.message); return false; }
        LS.set('orea_push_saved', mark);
        LS.set('orea_push_saved_at', String(Date.now()));
        return true;
    }

    async function subscribe(force) {
        const reg = await swReady();
        let sub = await reg.pushManager.getSubscription();
        if (sub && !sameKey(sub)) { await sub.unsubscribe().catch(() => { }); sub = null; }
        if (!sub) {
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) });
            force = true;
        }
        return save(sub, force);
    }

    // Bouton « Activer » (peut aussi être appelé depuis un menu : oreaPushEnable())
    window.oreaPushEnable = async function () {
        hideBanner();
        if (!SUPPORTED) return say('Ce téléphone ne permet pas les notifications. Sur iPhone, ajoute d’abord ORÉA à l’écran d’accueil.');
        let perm = Notification.permission;
        if (perm === 'default') perm = await Notification.requestPermission();
        if (perm !== 'granted') return say('Notifications refusées. Tu peux les autoriser plus tard dans les réglages du navigateur.');
        if (busy) return;
        busy = true;
        try {
            if (!await subscribe(true)) return say('Activation impossible pour le moment. Réessaie plus tard.');
            const { error } = await db.rpc('v90_push_test');
            if (error) console.warn('v90_push_test :', error.message);
            say('Notifications activées ✓');
        } catch (e) {
            console.warn('push :', e);
            say('Activation impossible : ' + (e && e.message ? e.message : e));
        } finally { busy = false; }
    };

    /* ----- Bandeau d'invitation ----- */
    function hideBanner() { const b = document.getElementById('orea-push-bn'); if (b) b.remove(); }
    function showBanner() {
        if (document.getElementById('orea-push-bn') || document.getElementById('pinin')) return; // pas pendant le code PIN
        if (Number(LS.get('orea_push_later') || 0) > Date.now()) return;
        if (!document.getElementById('orea-push-css')) {
            const st = document.createElement('style');
            st.id = 'orea-push-css';
            st.textContent = '#orea-push-bn{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:150;'
                + 'background:var(--card,#2a2320);color:var(--tx,#F0EEE6);border:1px solid var(--line,rgba(199,163,75,.35));border-radius:14px;'
                + 'padding:12px 14px;box-shadow:0 10px 28px rgba(0,0,0,.35);font-size:14px;line-height:1.45}'
                + '#orea-push-bn .pb-r{display:flex;gap:8px;margin-top:10px}'
                + '#orea-push-bn button{flex:1;min-height:40px;margin:0}';
            document.head.appendChild(st);
        }
        const b = document.createElement('div');
        b.id = 'orea-push-bn';
        b.innerHTML = '🔔 <b>Recevoir les nouveautés sur ce téléphone ?</b><br><small>Messages, annonces, événements et rappels, même quand ORÉA est fermée.</small>'
            + '<div class="pb-r"><button type="button" id="pb-ok">Activer</button><button type="button" class="ghost" id="pb-no">Plus tard</button></div>';
        document.body.appendChild(b);
        b.querySelector('#pb-ok').onclick = () => window.oreaPushEnable();
        b.querySelector('#pb-no').onclick = () => { LS.set('orea_push_later', String(Date.now() + 7 * 864e5)); hideBanner(); };
    }

    // Vérification discrète à l'ouverture et au retour dans l'application
    async function check() {
        if (!SUPPORTED || !uid || busy) return;
        if (Notification.permission === 'granted') {
            busy = true;
            try { await subscribe(false); } catch (e) { console.warn('push :', e); } finally { busy = false; }
        } else if (Notification.permission === 'default') {
            showBanner();
        }
    }

    let timer = null;
    function later(ms) { clearTimeout(timer); timer = setTimeout(check, ms); }

    db.auth.onAuthStateChange((ev, ses) => {
        const id = ses && ses.user ? ses.user.id : null;
        if (!id) { uid = null; hideBanner(); LS.del('orea_push_saved'); return; }
        if (id === uid) return;
        uid = id;
        later(8000); // laisse l'application se charger d'abord (connexion faible)
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && uid) later(3000); });
})();
