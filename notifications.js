/* =====================================================================
   ORÉA École v64 — notifications.js (corrigé)
   1) window.OreaOv : écrans plein écran + bouton Retour Android + toast.
      -> Utilisé par announcements.js (écran « Annonces » du directeur).
         Ce module avait disparu quand notifications.js a été remplacé par la
         version « Push » : le directeur voyait « notifications.js manquant ».
   2) Notifications Web Push (école).
   3) publishAnnonceWithNotif() : annonce automatique lors d'un changement de frais.
   ===================================================================== */
(function () {
    'use strict';

    /* ================================================================
       1) OreaOv — écrans plein écran
       ================================================================ */
    const STACK = [];

    function injectCss() {
        if (document.getElementById('nt-css')) return;
        const s = document.createElement('style');
        s.id = 'nt-css';
        s.textContent = `
.nt-ov{position:fixed;left:0;top:0;width:100%;height:100%;z-index:80;background:var(--bg);color:var(--tx);display:flex;flex-direction:column;animation:ntIn .22s ease;will-change:transform}
@keyframes ntIn{from{opacity:.4;transform:translateX(24px)}to{opacity:1;transform:none}}
.nt-head{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:var(--card);border-bottom:1px solid var(--line)}
.nt-head .nt-t{flex:1;min-width:0}
.nt-head b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nt-head small{display:block;color:var(--mut);font-size:12px}
.nt-ov button.nt-ic{width:40px!important;min-height:40px!important;height:40px;padding:0!important;background:transparent!important;box-shadow:none!important;border:0;color:var(--tx);font-size:22px;line-height:1;flex:none}
.nt-list{flex:1;overflow-y:auto;padding:8px 12px calc(16px + env(safe-area-inset-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.nt-empty{text-align:center;color:var(--mut);padding:50px 20px;font-size:15px;line-height:1.7}
.nt-toast{position:fixed;left:14px;right:14px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:200;background:#3a2a26;color:#F0EEE6;padding:11px 16px;border-radius:12px;text-align:center;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
@media (prefers-reduced-motion:reduce){.nt-ov{animation:none}}
`;
        document.head.appendChild(s);
    }

    function overlay(cls) {
        injectCss();
        const el = document.createElement('div');
        el.className = 'nt-ov ' + (cls || '');
        document.body.appendChild(el);
        // le clavier mobile ne doit pas masquer le bas de l'écran
        const vv = window.visualViewport;
        if (vv) {
            const f = () => { el.style.height = vv.height + 'px'; el.style.transform = 'translateY(' + vv.offsetTop + 'px)'; };
            f();
            vv.addEventListener('resize', f); vv.addEventListener('scroll', f);
            el._fit = () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
        }
        STACK.push(el);
        history.pushState({ nt: STACK.length }, '');
        return el;
    }

    function closeTop() {
        const el = STACK.pop();
        if (!el) return;
        if (el._cleanup) { try { el._cleanup(); } catch (_) { } }
        if (el._fit) el._fit();
        el.remove();
    }

    // Phase de capture : on bloque le gestionnaire « retour » de app.js tant qu'un écran est ouvert.
    window.addEventListener('popstate', e => {
        if (STACK.length) { e.stopImmediatePropagation(); closeTop(); }
    }, true);

    function ovToast(m) {
        injectCss();
        const t = document.createElement('div');
        t.className = 'nt-toast'; t.textContent = m;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    window.OreaOv = { overlay, back: () => history.back(), toast: ovToast };

    /* ================================================================
       2) Notifications Web Push
       ================================================================ */
    // ⚠️ Cette clé est la clé D'EXEMPLE de la documentation web-push : ce n'est PAS la tienne.
    // Génère ta paire de clés VAPID (npx web-push generate-vapid-keys), mets la clé PUBLIQUE ici
    // et la clé PRIVÉE dans ton Edge Function / serveur d'envoi.
    // Tant que la clé d'exemple est là, les abonnements push sont désactivés (ils ne pourraient jamais recevoir de message).
    const VAPID_SAMPLE = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8E';
    const VAPID_PUBLIC_KEY = VAPID_SAMPLE;

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    };

    // navigator.serviceWorker.ready ne se résout jamais si aucun service worker n'est enregistré : on limite l'attente.
    const swReady = () => Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('service worker indisponible')), 8000))
    ]);

    async function initPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            console.log('Push non supporté par ce navigateur.');
            return;
        }
        if (VAPID_PUBLIC_KEY === VAPID_SAMPLE) {
            console.warn('Push désactivé : remplace VAPID_PUBLIC_KEY par ta propre clé publique (notifications.js).');
            return;
        }
        if (Notification.permission === 'denied') return;

        const { data: { user } } = await db.auth.getUser();
        if (!user) return;

        try {
            const reg = await swReady();
            let sub = await reg.pushManager.getSubscription();
            if (sub) return;

            if (Notification.permission === 'default') {
                const perm = await Notification.requestPermission();
                if (perm !== 'granted') return;
            }
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            const j = sub.toJSON();
            const { error } = await db.from('push_subscriptions').upsert({
                user_id: user.id,
                endpoint: j.endpoint,
                p256dh: j.keys.p256dh,
                auth: j.keys.auth
            }, { onConflict: 'user_id,endpoint' });
            if (error) console.error('push_subscriptions:', error.message);
            else console.log('✅ Abonné aux notifications push');
        } catch (e) {
            console.error('Erreur Push:', e);
        }
    }

    // Une seule initialisation par utilisateur (avant : une par évènement d'authentification, y compris les rafraîchissements de jeton)
    let pushUid = null;
    db.auth.onAuthStateChange((event, session) => {
        if (!session) { pushUid = null; return; }
        if (pushUid === session.user.id) return;
        pushUid = session.user.id;
        setTimeout(initPush, 5000);
    });

    /* ================================================================
       3) Annonce automatique (ex. : modification des frais)
       ================================================================ */
    window.publishAnnonceWithNotif = async function (title, content, schoolId) {
        const { data, error } = await db.from('announcements').insert({
            school_id: schoolId,
            author_id: (typeof S !== 'undefined' && S.me) ? S.me.id : null,
            title: title,
            content: content,
            status: 'published'
        }).select().single();

        if (error) return toast(error.message);

        // Pour du vrai push quand l'application est fermée, il faut en plus une Edge Function qui lit
        // push_subscriptions et envoie le message avec la clé VAPID privée.
        toast('Annonce publiée ✓');
        return data;
    };
})();
