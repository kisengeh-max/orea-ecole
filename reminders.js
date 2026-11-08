// ORÉA École v88 — reminders.js
// - window.subRenew() : ouvre WhatsApp pour renouveler l'abonnement
// - Les bandeaux d'abonnement (3 jours avant, expiré, lecture seule) sont gérés
//   par subBanner() dans app.js depuis la v88.
// À charger APRÈS app.js.
(function () {
    // Nécessaire à la pastille de messages sur le bouton Menu (messages.js)
    if (!document.getElementById('orea-rem-css')) {
        const st = document.createElement('style');
        st.id = 'orea-rem-css';
        st.textContent = '#nav button{position:relative}#exb.warn{background:linear-gradient(135deg,#6B5320 0%,#4A3A17 100%)}#exb span{display:inline;text-align:center;line-height:1.45}';
        document.head.appendChild(st);
    }
    window.subRenew = function () {
        const n = subLeft(), u = subWa(n);
        if (u) window.open(u, '_blank');
        else toast('Contacte ORÉA.');
    };
})();
