// ORÉA École v40 — reminders.js (version allégée)
// Les rappels (sauvegarde, fin d'abonnement, début de trimestre) sont maintenant
// gérés par notifications.js : cloche 🔔 en haut + panneau.
// Ce fichier ne garde que :
//   - window.subRenew()  : ouvre WhatsApp pour renouveler l'abonnement
//   - la bannière du haut, UNIQUEMENT quand l'abonnement est expiré (directeur)
// Supprimés : rappels d'impayés, point rouge sur l'onglet Menu, badge calculé ici.
// À charger APRÈS app.js.
(function () {
    // Nécessaire à la pastille de messages sur le bouton Menu (messages.js)
    if (!document.getElementById('orea-rem-css')) {
        const st = document.createElement('style');
        st.id = 'orea-rem-css';
        st.textContent = '#nav button{position:relative}';
        document.head.appendChild(st);
    }

    // Ouvre WhatsApp pour renouveler l'abonnement
    window.subRenew = function () {
        const n = subLeft(), u = subWa(n);
        if (u) window.open(u, '_blank');
        else toast('Contacte l’administrateur.');
    };

    // Bannière du haut (#exb) : seulement si l'abonnement est expiré
    function expiredBanner() {
        const b = document.getElementById('exb');
        if (!b) return;
        if (typeof S === 'undefined' || !S.me || S.me.role !== 'directeur' || S.me.etudes || !S.school || subLeft() > 0) { b.hidden = true; return; }
        b.innerHTML = '<span>⛔ <b>Abonnement expiré</b> — Contacte l’administrateur</span><a href="javascript:void(0)" onclick="subRenew()">Renouveler</a>';
        b.hidden = false;
    }

    // On enveloppe la bannière d'origine d'app.js (appelée à chaque render) :
    // abonnement expiré -> bannière « expiré » ; 1 à 7 jours restants -> bannière d'origine « il reste X jours ».
    function hook() {
        if (typeof subBanner === 'undefined') { setTimeout(hook, 100); return; }
        if (subBanner.__rem) return;
        const orig = subBanner;
        const wrapped = function () {
            if (typeof S !== 'undefined' && S.me && S.school && subLeft() <= 0) return expiredBanner();
            return orig.apply(this, arguments);
        };
        wrapped.__rem = true;
        subBanner = wrapped;
    }
    hook();
})();
