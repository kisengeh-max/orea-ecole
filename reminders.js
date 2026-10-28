// ORÉA École — Rappels in-app (Option B, sans Push serveur)
// Ce fichier complète app.js : bannière de rappel en haut, point sur l'onglet Menu,
// badge sur l'icône de l'app. À charger APRÈS app.js (voir README V12).
(function () {
    // CSS du point rouge sur l'onglet Menu
    if (!document.getElementById('orea-rem-css')) {
        const st = document.createElement('style');
        st.id = 'orea-rem-css';
        st.textContent = '#nav button{position:relative}.orea-dot{position:absolute;top:5px;left:calc(50% + 7px);width:8px;height:8px;border-radius:50%;background:#e85454;box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none}';
        document.head.appendChild(st);
    }

    // Liste des rappels actifs (triés par urgence, priorité 0 = plus urgent)
    function computeReminders() {
        const r = [];
        if (typeof S === 'undefined' || !S.me || !S.school) return r;
        const R = S.me.role, dow = new Date().getDay();

        // 1) Impayés (directeur + percepteur) — accent le lundi
        if (R === 'directeur' || R === 'percepteur') {
            const st = ys(), n = st.filter(s => Number(s.balance_cdf || 0) > 0).length;
            if (n > 0) {
                const tot = st.reduce((a, s) => a + Number(s.balance_cdf || 0), 0);
                r.push({
                    id: 'impayes', icon: '💰',
                    title: dow === 1 ? 'Relance du lundi' : 'Impayés',
                    body: n + ' élève(s) · ' + fmt(tot) + ' à récupérer',
                    action: "menuGo('impayes')",
                    priority: dow === 1 ? 1 : 3
                });
            }
        }

        // 2) Abonnement (directeur seulement) — à partir de J-7
        if (R === 'directeur') {
            const n = subLeft();
            if (n <= 0) {
                r.push({ id: 'abo0', icon: '⛔', title: 'Abonnement expiré', body: "Contacte l'administrateur", action: 'subRenew()', priority: 0 });
            } else if (n <= 7) {
                r.push({ id: 'abo' + n, icon: '⏳', title: 'Abonnement : ' + n + ' jour' + (n > 1 ? 's' : '') + ' restant' + (n > 1 ? 's' : ''), body: 'Pense à renouveler', action: 'subRenew()', priority: 1 });
            }
        }

        // 3) Trimestre (veille et jour J) — tout le monde
        if (hasTerms()) {
            const t = S.terms[S.year], today = tdy(), tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE');
            const trimAct = R === 'enseignant' ? "menuGo('presences')" : "menuGo('caisse')";
            [t.t1, t.t2, t.t3].forEach((d, i) => {
                if (!d) return;
                if (d === today) r.push({ id: 'trim' + i, icon: '📅', title: 'Début T' + (i + 1), body: "Le trimestre commence aujourd'hui", action: trimAct, priority: 1 });
                else if (d === tomorrow) r.push({ id: 'trim' + i + '_j1', icon: '📅', title: 'Début T' + (i + 1) + ' demain', body: 'Prépare les encaissements', action: trimAct, priority: 2 });
            });
        }

        // 4) Sauvegarde (directeur seulement) — tous les 30 jours ou le 1er du mois
        if (R === 'directeur') {
            const a = bkAge(), is1st = new Date().getDate() === 1;
            if (a === null || a >= 30 || (is1st && a > 0)) {
                r.push({ id: 'bk', icon: '💾', title: 'Sauvegarde' + (is1st ? ' du mois' : ' conseillée'), body: a === null ? 'Aucune sauvegarde faite' : 'Dernière il y a ' + a + ' jours', action: 'doBackup()', priority: is1st ? 1 : 3 });
            }
        }

        return r.sort((a, b) => a.priority - b.priority);
    }

    // Ouvre WhatsApp pour renouveler l'abonnement (appelé depuis la bannière)
    window.subRenew = function () {
        const n = subLeft(), u = subWa(n);
        if (u) window.open(u, '_blank');
        else toast('Contacte l’administrateur.');
    };

    // Bannière en haut (#exb) — remplace la bannière d'abonnement d'origine
    function reminderBanner() {
        const b = document.getElementById('exb');
        if (!b) return;
        if (!S || !S.me) { b.hidden = true; return; }
        const R = computeReminders();
        if (!R.length) { b.hidden = true; return; }
        const top = R[0];
        b.innerHTML = '<span>' + top.icon + ' <b>' + esc(top.title) + '</b> — ' + esc(top.body) + '</span><a href="javascript:void(0)" onclick="' + top.action + '">Voir</a>';
        b.hidden = false;
    }

    // Point rouge sur l'onglet Menu
    function applyDot() {
        const REM = computeReminders();
        document.querySelectorAll('#nav button').forEach(btn => {
            btn.querySelectorAll('.orea-dot').forEach(x => x.remove());
            if (btn.dataset.t === 'menu' && REM.length) {
                const i = document.createElement('i');
                i.className = 'orea-dot';
                btn.appendChild(i);
            }
        });
    }

    // Badge numérique sur l'icône de l'app (Chrome Android)
    function refreshBadge() {
        try {
            const n = computeReminders().length;
            if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(Math.min(n, 99));
            else if (navigator.clearAppBadge) navigator.clearAppBadge();
        } catch (e) { }
    }

    // Branchement : on attend que app.js soit chargé, puis on remplace subBanner
    // et on enveloppe render pour mettre à jour bannière + point + badge.
    function hook() {
        if (typeof S === 'undefined' || typeof render === 'undefined' || typeof subBanner === 'undefined') {
            setTimeout(hook, 100);
            return;
        }

        // Remplace la bannière d'abonnement d'origine par la nôtre
        subBanner = reminderBanner;

        // Enveloppe render pour rafraîchir point + badge après chaque rendu
        const _origRender = render;
        render = function () {
            _origRender();
            try { applyDot(); refreshBadge(); } catch (e) { console.error('[reminders]', e); }
        };

        // Force un rendu dès que boot() a fini (S.me + S.school disponibles)
        const poll = setInterval(() => {
            if (S && S.me && S.school) {
                clearInterval(poll);
                try { render(); } catch (e) { console.error('[reminders]', e); }
            }
        }, 300);
        setTimeout(() => clearInterval(poll), 20000);
    }
    hook();
})();
