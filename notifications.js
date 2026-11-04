/* =====================================================================
   ORÉA École v64 — notifications.js
   Gère les vraies notifications push (Web Push) côté école et parent.
   S'accroche à la clé VAPID pour s'enregistrer.
   ===================================================================== */
(function () {
    'use strict';

    // ⚠️ REMPLACE CES CLÉS PAR CELLES DE TON PROJET SUPABASE
    // Va dans Supabase > Project Settings > API > Web Push (ou demande-les moi si tu ne les as pas)
    const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8E'; 

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    async function initPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push non supporté par ce navigateur.');
            return;
        }

        const { data: { user } } = await db.auth.getUser();
        if (!user) return;

        try {
            const reg = await navigator.serviceWorker.ready;
            
            // Vérifier si on a déjà une souscription
            let sub = await reg.pushManager.getSubscription();
            
            if (!sub) {
                // Si l'utilisateur n'a pas encore accepté, on lui demande gentiment au bout de 5 secondes
                setTimeout(async () => {
                    if (Notification.permission === 'default') {
                        const perm = await Notification.requestPermission();
                        if (perm !== 'granted') return; // L'utilisateur a refusé
                    }

                    if (Notification.permission === 'granted') {
                        sub = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                        });
                        
                        // On sauvegarde la souscription dans Supabase
                        const subJSON = sub.toJSON();
                        await db.from('push_subscriptions').upsert({
                            user_id: user.id,
                            endpoint: subJSON.endpoint,
                            p256dh: subJSON.keys.p256dh,
                            auth: subJSON.keys.auth
                        }, { onConflict: 'user_id, endpoint' });
                        
                        console.log('✅ Abonné aux notifications push');
                    }
                }, 5000);
            }
        } catch (e) {
            console.error('Erreur Push:', e);
        }
    }

    // On lance l'initialisation quand l'utilisateur est connecté
    db.auth.onAuthStateChange((event, session) => {
        if (session) setTimeout(initPush, 2000);
    });

    // --- FONCTION POUR PUBLIER UNE ANNONCE ET ENVOYER UNE NOTIF ---
    window.publishAnnonceWithNotif = async function (title, content, schoolId) {
        // 1. Créer l'annonce
        const { data, error } = await db.from('announcements').insert({
            school_id: schoolId,
            title: title,
            content: content,
            status: 'published'
        }).select().single();
        
        if (error) return toast(error.message);

        // 2. (Optionnel) Déclencher l'envoi push via une Edge Function Supabase
        // Pour l'instant, on laisse Supabase Realtime faire le travail sur l'appareil des parents
        // Si tu veux du vrai push quand l'app est fermée, il faudra une Edge Function (je te l'expliquerai).
        
        toast('Annonce publiée ✓');
        return data;
    };

})();
