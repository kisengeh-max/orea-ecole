/* =====================================================================
   ORÉA École v40 — auth_ui.js
   Connexion · Création de compte · Code à 6 chiffres · Mot de passe oublié
   À charger APRÈS app.js / ambassadeur.js (école) ou parent.js (parent).
   Remplace authView() sans toucher à app.js ni parent.js.
   Utilise les globales existantes : db, toast, boot.
   ===================================================================== */
(function () {
    'use strict';

    const PARENT = !!document.getElementById('pmain');
    const root = () => document.getElementById(PARENT ? 'pmain' : 'main');
    const q = (s, r) => (r || document).querySelector(s);
    const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const say = m => { try { toast(m); } catch (_) { /* pas de toast */ } };
    const goBoot = () => { try { boot(); } catch (_) { location.reload(); } };

    const CODE_TTL = 10 * 60 * 1000;   // le code vaut 10 minutes
    const RESEND_SEC = 120;            // renvoi possible après 120 s
    const MAX_TRIES = 5;
    const PENDING_KEY = 'orea_auth_pending';
    const FLAG_KEY = 'orea_just_signed';

    const ST = { mode: 'signup', email: '', sentAt: 0, tries: 0, timer: null, busy: false };

    /* ---------------------------------------------------------------
       Style (injecté une seule fois, thème sombre/clair automatique)
       --------------------------------------------------------------- */
    function injectCss() {
        if (document.getElementById('oa-css')) return;
        const s = document.createElement('style');
        s.id = 'oa-css';
        s.textContent = `
.oa-wrap{display:flex;flex-direction:column;gap:12px;padding-top:8px;overflow-x:hidden}
.oa-wrap input{margin:0}
.oa-logo{display:flex;justify-content:center}
.oa-logo img{width:100%;max-width:240px;border-radius:16px}
.oa-h{font-family:var(--serif);margin:2px 0 0;font-size:22px;text-align:center}
.oa-p{color:var(--mut);margin:0;text-align:center;font-size:14px;line-height:1.5}
.oa-p b{color:var(--tx);word-break:break-all}
.oa-small{color:var(--mut);font-size:12.5px;margin:0;text-align:center;line-height:1.4}
.oa-col{display:flex;flex-direction:column;gap:10px}
.oa-screen{display:flex;flex-direction:column;gap:12px}
.oa-fwd{animation:oaFwd .32s cubic-bezier(.2,.8,.2,1)}
.oa-back{animation:oaBack .32s cubic-bezier(.2,.8,.2,1)}
@keyframes oaFwd{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
@keyframes oaBack{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
.oa-pw{position:relative}
.oa-pw input{padding-right:54px}
.oa-wrap .oa-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:42px;min-height:42px;height:42px;padding:0;background:transparent;box-shadow:none;border:0;font-size:19px;color:var(--mut);line-height:1}
.oa-wrap .oa-link{background:none;box-shadow:none;border:0;color:var(--gold);min-height:40px;padding:8px 10px;font-weight:600;font-size:14px;width:auto;align-self:center}
.oa-wrap button:disabled{opacity:.5;cursor:not-allowed}
.oa-err{color:var(--bad);font-weight:600;font-size:13.5px;margin:0;text-align:center;line-height:1.4}
.oa-err:empty{display:none}
.oa-ok{color:var(--ok);font-weight:600;font-size:13px;margin:0}
.oa-or{display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px}
.oa-or::before,.oa-or::after{content:"";flex:1;height:1px;background:var(--line)}
.oa-steps{display:flex;justify-content:space-between;gap:4px;margin-top:2px}
.oa-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:11.5px;color:var(--mut);text-align:center;line-height:1.2}
.oa-step i{font-style:normal;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line);font-weight:700;font-size:12px;transition:all .3s}
.oa-step.on{color:var(--tx);font-weight:600}
.oa-step.on i{background:var(--gl);color:#1a1710;border-color:transparent;box-shadow:0 0 0 4px rgba(199,163,75,.18)}
.oa-step.done i{background:var(--ok);color:#fff;border-color:transparent}
.oa-bar{height:4px;border-radius:4px;background:var(--line);overflow:hidden}
.oa-bar b{display:block;height:100%;background:var(--gl);border-radius:4px;animation:oaBar .6s ease both}
@keyframes oaBar{from{width:var(--f)}to{width:var(--t)}}
.oa-gauge{display:flex;gap:5px}
.oa-gauge i{flex:1;height:6px;border-radius:3px;background:var(--line);transition:background .25s}
.oa-gauge[data-l="1"] i:nth-child(-n+1){background:#C0564A}
.oa-gauge[data-l="2"] i:nth-child(-n+2){background:#D9902F}
.oa-gauge[data-l="3"] i:nth-child(-n+3){background:#B7B83A}
.oa-gauge[data-l="4"] i:nth-child(-n+4){background:var(--ok)}
.oa-gl{font-size:12.5px;color:var(--mut);margin:-4px 0 0}
.oa-rules{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--mut)}
.oa-rules li::before{content:"○ "}
.oa-rules li.ok{color:var(--ok)}
.oa-rules li.ok::before{content:"✓ "}
.oa-otp{display:flex;gap:8px;justify-content:center}
.oa-wrap .oa-box{flex:1;min-width:0;max-width:54px;height:58px;padding:0;text-align:center;font-size:25px;font-weight:700;border-radius:12px;caret-color:var(--gold);transition:border-color .15s,transform .15s}
.oa-wrap .oa-box.f{border-color:var(--gold);transform:scale(1.04)}
.oa-wrap .oa-box.e{border-color:var(--bad)}
.oa-shake{animation:oaShake .45s}
@keyframes oaShake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
@media (prefers-reduced-motion:reduce){.oa-fwd,.oa-back,.oa-shake,.oa-bar b{animation:none}}
`;
        document.head.appendChild(s);
    }

    /* ---------------------------------------------------------------
       Messages d'erreur en français
       --------------------------------------------------------------- */
    const isNetErr = e => !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0 ||
        /failed to fetch|network|abort|load failed|timed? ?out/i.test(e.message || ''));

    function fr(e) {
        if (!e) return 'Une erreur est survenue. Réessaie dans un instant.';
        const c = e.code || '', m = (e.message || '').toLowerCase(), st = e.status;
        if (isNetErr(e) || !navigator.onLine) return 'Pas de connexion internet. Vérifie ton réseau puis réessaie.';
        if (c === 'user_already_exists' || /already (been )?registered|already exists/.test(m))
            return 'Cette adresse e-mail est déjà utilisée. Connecte-toi, ou touche « Mot de passe oublié ? ».';
        if (c === 'weak_password' || /password (is )?(too )?(weak|short)|should be at least|weak/.test(m))
            return 'Mot de passe trop faible. Utilise au moins 8 caractères avec des lettres et des chiffres.';
        if (c === 'same_password' || /different from the old/.test(m))
            return 'Choisis un mot de passe différent de l’ancien.';
        const wait = /after (\d+) second/.exec(m);
        if (wait) return 'Patiente ' + wait[1] + ' secondes avant de demander un nouveau code.';
        if (c === 'over_email_send_rate_limit' || /email rate limit/.test(m))
            return 'Limite d’envoi d’e-mails atteinte. Patiente un moment (jusqu’à 1 heure) puis réessaie.';
        if (c === 'over_request_rate_limit' || st === 429 || /rate limit|too many|security purposes/.test(m))
            return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
        if (c === 'invalid_credentials' || /invalid login/.test(m)) return 'E-mail ou mot de passe incorrect.';
        if (c === 'email_not_confirmed' || /not confirmed/.test(m)) return 'Ton e-mail n’est pas encore confirmé.';
        if (c === 'validation_failed' || /unable to validate email|invalid format|invalid email/.test(m))
            return 'Adresse e-mail invalide. Vérifie-la.';
        if (c === 'signup_disabled' || /signups? not allowed|disabled/.test(m)) return 'Les inscriptions sont fermées pour le moment.';
        if (c === 'session_not_found' || /session/.test(m)) return 'Ta session a expiré. Recommence depuis la connexion.';
        console.error('auth', e);
        return 'Une erreur est survenue. Réessaie dans un instant.';
    }

    /* ---------------------------------------------------------------
       Outils : mot de passe, progression, état en attente
       --------------------------------------------------------------- */
    const COMMON = ['12345678', '123456789', 'password', 'motdepasse', 'azerty123', 'azertyuiop', 'qwerty123', '00000000', '11111111', 'password1'];

    function passInfo(p) {
        const len = p.length >= 8, let_ = /[A-Za-z]/.test(p), num = /\d/.test(p);
        const common = COMMON.includes(p.toLowerCase());
        let score = 0;
        if (len) score++;
        if (p.length >= 12) score++;
        if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
        if (num) score++;
        if (/[^A-Za-z0-9]/.test(p)) score++;
        let lvl = !p ? 0 : score <= 1 ? 1 : score === 2 ? 2 : score === 3 ? 3 : 4;
        if (common) lvl = 1;
        const label = ['—', 'Faible', 'Moyen', 'Bon', 'Excellent'][lvl];
        return { len, let_, num, common, lvl, label, valid: len && let_ && num && !common };
    }

    const STEP_LABELS = {
        signup: ['E-mail', 'Code', PARENT ? 'Accès' : 'Profil'],
        recovery: ['E-mail', 'Code', 'Mot de passe']
    };
    function progress(mode, n) {
        const L = STEP_LABELS[mode] || STEP_LABELS.signup;
        const pct = k => [0, 33, 66, 100][k];
        return '<div class="oa-steps">' + L.map((t, i) => {
            const k = i + 1, cls = k < n ? 'done' : k === n ? 'on' : '';
            return `<div class="oa-step ${cls}"><i>${k < n ? '✓' : k}</i><span>${k}. ${escH(t)}</span></div>`;
        }).join('') + `</div><div class="oa-bar"><b style="--f:${pct(n - 1)}%;--t:${pct(n)}%"></b></div>`;
    }

    const savePending = () => { try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: ST.email, mode: ST.mode, sentAt: ST.sentAt })); } catch (_) { } };
    const clearPending = () => { try { sessionStorage.removeItem(PENDING_KEY); } catch (_) { } };
    const loadPending = () => {
        try {
            const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
            return p && p.email && Date.now() - p.sentAt < CODE_TTL ? p : null;
        } catch (_) { return null; }
    };
    const maskEmail = e => { const [a, b] = e.split('@'); return (a.length > 2 ? a.slice(0, 2) + '***' : a + '***') + '@' + (b || ''); };
    const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
    const cleanEmail = v => String(v || '').trim().toLowerCase();
    const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) { } };
    const clearTimer = () => { if (ST.timer) { clearInterval(ST.timer); ST.timer = null; } };

    function paint(inner, opt) {
        opt = opt || {};
        const r = root(); if (!r) return;
        injectCss();
        clearTimer();
        const nav = document.getElementById('nav'); if (nav) nav.hidden = true;
        const hs = document.getElementById('hs'); if (hs && !PARENT) hs.textContent = 'ORÉA École';
        r.innerHTML = '<div class="oa-wrap"><div class="oa-logo"><img class="ld" src="logo-dark.png" alt="ORÉA École"><img class="ll" src="logo-light.png" alt=""></div>'
            + (opt.step ? progress(opt.mode, opt.step) : '')
            + `<div class="oa-screen ${opt.back ? 'oa-back' : 'oa-fwd'}">${inner}</div></div>`;
        window.scrollTo(0, 0);
    }

    const pwField = (name, ph, ac) =>
        `<div class="oa-pw"><input name="${name}" type="password" placeholder="${ph}" autocomplete="${ac}" autocapitalize="off" required><button type="button" class="oa-eye" data-eye aria-label="Afficher le mot de passe">👁</button></div>`;

    function bindEyes() {
        const r = root();
        r.querySelectorAll('[data-eye]').forEach(b => {
            b.onclick = () => {
                const i = b.previousElementSibling, show = i.type === 'password';
                i.type = show ? 'text' : 'password';
                b.textContent = show ? '🙈' : '👁';
                b.setAttribute('aria-label', show ? 'Cacher le mot de passe' : 'Afficher le mot de passe');
                i.focus();
            };
        });
    }

    const gaugeHtml = () =>
        '<div class="oa-gauge" id="oa-gauge" data-l="0"><i></i><i></i><i></i><i></i></div>'
        + '<p class="oa-gl" id="oa-gl">Force du mot de passe : —</p>'
        + '<ul class="oa-rules"><li data-r="len">8 caractères minimum</li><li data-r="let">Une lettre</li><li data-r="num">Un chiffre</li></ul>';

    // Branche la jauge + la vérification « identiques » ; renvoie une fonction qui dit si tout est valide.
    function bindPassword(form, btn) {
        const p1 = form.elements.pw, p2 = form.elements.pw2, m = q('#oa-match');
        const upd = () => {
            const i = passInfo(p1.value);
            q('#oa-gauge').dataset.l = i.lvl;
            q('#oa-gl').textContent = 'Force du mot de passe : ' + i.label + (i.common ? ' (trop courant)' : '');
            form.querySelector('[data-r=len]').classList.toggle('ok', i.len);
            form.querySelector('[data-r=let]').classList.toggle('ok', i.let_);
            form.querySelector('[data-r=num]').classList.toggle('ok', i.num);
            const same = p2.value.length > 0 && p1.value === p2.value;
            if (m) {
                m.textContent = !p2.value ? '' : same ? '✓ Les mots de passe sont identiques' : '✗ Les mots de passe sont différents';
                m.className = 'oa-ok';
                m.style.color = same ? '' : 'var(--bad)';
            }
            const ok = i.valid && same;
            if (btn) btn.disabled = !ok || ST.busy;
            return ok;
        };
        p1.addEventListener('input', upd);
        p2.addEventListener('input', upd);
        upd();
        return upd;
    }

    const setErr = m => { const e = q('#oa-err'); if (e) e.textContent = m || ''; };
    function busy(btn, on, txt) {
        ST.busy = on;
        if (!btn) return;
        if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt || 'Patiente…'; btn.disabled = true; }
        else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; }
    }

    /* ---------------------------------------------------------------
       ÉCRAN 1 : Connexion
       --------------------------------------------------------------- */
    function loginScreen(back) {
        const pend = loadPending();
        paint(
            (PARENT ? '<h2 class="oa-h">Espace Parent</h2>' : '')
            + (pend ? `<button type="button" class="ghost" id="oa-resume">✉️ Continuer avec le code envoyé à ${escH(maskEmail(pend.email))}</button>` : '')
            + '<form id="oa-f" class="oa-col" novalidate>'
            + '<input name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" placeholder="E-mail" required>'
            + pwField('pw', 'Mot de passe', 'current-password')
            + '<p class="oa-err" id="oa-err" role="alert"></p>'
            + '<button id="oa-go">Se connecter</button></form>'
            + '<button type="button" class="oa-link" id="oa-forgot">Mot de passe oublié ?</button>'
            + '<div class="oa-or"><span>ou</span></div>'
            + '<button type="button" class="ghost" id="oa-new">Créer un compte</button>'
            + (PARENT ? '<button type="button" class="oa-link" id="oa-home">← Retour à l’école</button>' : ''),
            { back });
        const f = q('#oa-f');
        if (ST.email) f.elements.email.value = ST.email;
        bindEyes();
        q('#oa-forgot').onclick = () => { ST.email = cleanEmail(f.elements.email.value) || ST.email; forgotScreen(); };
        q('#oa-new').onclick = () => { ST.email = cleanEmail(f.elements.email.value) || ST.email; signupScreen(); };
        if (PARENT) q('#oa-home').onclick = () => { location.href = './'; };
        if (pend) q('#oa-resume').onclick = () => { ST.email = pend.email; ST.mode = pend.mode; ST.sentAt = pend.sentAt; ST.tries = 0; otpScreen(); };

        f.onsubmit = async e => {
            e.preventDefault();
            if (ST.busy) return;
            const email = cleanEmail(f.elements.email.value), pw = f.elements.pw.value;
            if (!validEmail(email)) return setErr('Entre une adresse e-mail valide.');
            if (!pw) return setErr('Entre ton mot de passe.');
            setErr(''); ST.email = email;
            const btn = q('#oa-go'); busy(btn, true, 'Connexion…');
            const { error } = await db.auth.signInWithPassword({ email, password: pw });
            busy(btn, false);
            if (!error) { clearPending(); return goBoot(); }
            if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '')) {
                // Compte créé mais jamais confirmé : on renvoie un code et on ouvre l'écran des 6 cases.
                const r = await db.auth.resend({ type: 'signup', email });
                ST.mode = 'signup'; ST.tries = 0;
                if (!r.error) { ST.sentAt = Date.now(); savePending(); say('Un code de confirmation vient de t’être envoyé.'); }
                else { ST.sentAt = Date.now() - (RESEND_SEC - 5) * 1000; setTimeout(() => setErr(fr(r.error)), 50); }
                return otpScreen();
            }
            vibrate([70, 40, 70]); setErr(fr(error));
        };
    }

    /* ---------------------------------------------------------------
       ÉCRAN : Créer un compte  (étape 1)
       --------------------------------------------------------------- */
    function signupScreen() {
        paint(
            '<h2 class="oa-h">Créer un compte</h2>'
            + '<form id="oa-f" class="oa-col" novalidate>'
            + '<input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="E-mail" required>'
            + pwField('pw', 'Mot de passe', 'new-password')
            + gaugeHtml()
            + pwField('pw2', 'Confirmer le mot de passe', 'new-password')
            + '<p class="oa-ok" id="oa-match"></p>'
            + '<p class="oa-err" id="oa-err" role="alert"></p>'
            + '<button id="oa-go" disabled>Recevoir mon code</button></form>'
            + '<p class="oa-small">Nous t’envoyons un code à 6 chiffres par e-mail pour confirmer ton adresse.</p>'
            + '<button type="button" class="oa-link" id="oa-bk">← J’ai déjà un compte</button>',
            { step: 1, mode: 'signup' });
        const f = q('#oa-f'), btn = q('#oa-go');
        if (ST.email) f.elements.email.value = ST.email;
        bindEyes();
        bindPassword(f, btn);
        q('#oa-bk').onclick = () => { ST.email = cleanEmail(f.elements.email.value) || ST.email; loginScreen(true); };

        f.onsubmit = async e => {
            e.preventDefault();
            if (ST.busy) return;
            const email = cleanEmail(f.elements.email.value), pw = f.elements.pw.value;
            if (!validEmail(email)) return setErr('Entre une adresse e-mail valide.');
            const pi = passInfo(pw);
            if (!pi.valid) return setErr('Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.');
            if (pw !== f.elements.pw2.value) return setErr('Les deux mots de passe ne sont pas identiques.');
            setErr(''); ST.email = email;
            busy(btn, true, 'Création…');
            const { data, error } = await db.auth.signUp({ email, password: pw });
            busy(btn, false);
            if (error) { vibrate([70, 40, 70]); return setErr(fr(error)); }
            // E-mail déjà pris : Supabase répond sans erreur mais sans « identities ».
            if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                vibrate([70, 40, 70]);
                return setErr('Cette adresse e-mail est déjà utilisée. Connecte-toi, ou touche « J’ai déjà un compte » puis « Mot de passe oublié ? ».');
            }
            if (data && data.session) {            // confirmation e-mail désactivée côté Supabase
                try { sessionStorage.setItem(FLAG_KEY, String(Date.now())); } catch (_) { }
                return goBoot();
            }
            ST.mode = 'signup'; ST.sentAt = Date.now(); ST.tries = 0; savePending();
            otpScreen();
        };
    }

    /* ---------------------------------------------------------------
       ÉCRAN : Mot de passe oublié  (étape 1)
       --------------------------------------------------------------- */
    function forgotScreen() {
        paint(
            '<h2 class="oa-h">Mot de passe oublié</h2>'
            + '<p class="oa-p">Entre ton adresse e-mail. Nous t’envoyons un code à 6 chiffres pour choisir un nouveau mot de passe.</p>'
            + '<form id="oa-f" class="oa-col" novalidate>'
            + '<input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="E-mail" required>'
            + '<p class="oa-err" id="oa-err" role="alert"></p>'
            + '<button id="oa-go">Recevoir mon code</button></form>'
            + '<button type="button" class="oa-link" id="oa-bk">← Retour à la connexion</button>',
            { step: 1, mode: 'recovery' });
        const f = q('#oa-f'), btn = q('#oa-go');
        if (ST.email) f.elements.email.value = ST.email;
        q('#oa-bk').onclick = () => loginScreen(true);
        f.onsubmit = async e => {
            e.preventDefault();
            if (ST.busy) return;
            const email = cleanEmail(f.elements.email.value);
            if (!validEmail(email)) return setErr('Entre une adresse e-mail valide.');
            setErr(''); ST.email = email;
            busy(btn, true, 'Envoi…');
            const { error } = await db.auth.resetPasswordForEmail(email);
            busy(btn, false);
            if (error) { vibrate([70, 40, 70]); return setErr(fr(error)); }
            ST.mode = 'recovery'; ST.sentAt = Date.now(); ST.tries = 0; savePending();
            otpScreen();
        };
    }

    /* ---------------------------------------------------------------
       ÉCRAN : Code à 6 cases  (étape 2)
       --------------------------------------------------------------- */
    function otpScreen() {
        const mode = ST.mode;
        paint(
            '<h2 class="oa-h">Entre ton code</h2>'
            + `<p class="oa-p">Un code à 6 chiffres a été envoyé à <b>${escH(ST.email)}</b>.<br>Il est valable 10 minutes.</p>`
            + '<div class="oa-otp" id="oa-otp">'
            + [0, 1, 2, 3, 4, 5].map(i => `<input class="oa-box" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" aria-label="Chiffre ${i + 1} sur 6">`).join('')
            + '</div>'
            + '<p class="oa-err" id="oa-err" role="alert"></p>'
            + '<button id="oa-ok" disabled>Valider</button>'
            + '<button type="button" class="ghost" id="oa-resend" disabled>Renvoyer le code</button>'
            + '<button type="button" class="oa-link" id="oa-chg">← Changer d’e-mail</button>'
            + '<p class="oa-small">Rien reçu ? Regarde aussi dans les courriers indésirables (spam).</p>',
            { step: 2, mode });

        const boxes = [...document.querySelectorAll('.oa-box')];
        const okBtn = q('#oa-ok'), reBtn = q('#oa-resend'), wrap = q('#oa-otp');
        const code = () => boxes.map(b => b.value).join('');
        const mark = () => boxes.forEach(b => b.classList.toggle('f', !!b.value));
        const reset = () => { boxes.forEach(b => { b.value = ''; b.disabled = false; b.classList.remove('f', 'e'); }); okBtn.disabled = true; boxes[0].focus(); };

        function fill(start, digits) {
            for (let k = 0; k < digits.length && start + k < 6; k++) boxes[start + k].value = digits[k];
            boxes[Math.min(start + digits.length, 5)].focus();
            check();
        }
        function check() {
            mark();
            const full = code().length === 6;
            okBtn.disabled = !full || ST.busy;
            if (full) submit();
        }

        boxes.forEach((b, i) => {
            b.addEventListener('focus', () => b.select());
            b.addEventListener('input', () => {
                const d = b.value.replace(/\D/g, '');
                if (!d) { b.value = ''; mark(); okBtn.disabled = true; return; }
                b.value = d[0];
                if (d.length > 1) return fill(i, d);   // collage / saisie automatique
                if (i < 5) boxes[i + 1].focus();
                check();
            });
            b.addEventListener('keydown', e => {
                if (e.key === 'Backspace') {
                    if (b.value) { b.value = ''; mark(); okBtn.disabled = true; e.preventDefault(); }
                    else if (i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); mark(); okBtn.disabled = true; e.preventDefault(); }
                } else if (e.key === 'ArrowLeft' && i > 0) { boxes[i - 1].focus(); e.preventDefault(); }
                else if (e.key === 'ArrowRight' && i < 5) { boxes[i + 1].focus(); e.preventDefault(); }
                else if (e.key === 'Enter') { e.preventDefault(); if (code().length === 6) submit(); }
            });
            b.addEventListener('paste', e => {
                const t = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '');
                if (!t) return;
                e.preventDefault();
                if (t.length >= 6) { boxes.forEach(x => x.value = ''); fill(0, t.slice(0, 6)); } else fill(i, t);
            });
        });

        function fail(msg) {
            vibrate([80, 50, 80]);
            boxes.forEach(b => { b.classList.remove('f'); b.classList.add('e'); });
            wrap.classList.remove('oa-shake'); void wrap.offsetWidth; wrap.classList.add('oa-shake');
            setErr(msg);
            setTimeout(() => { if (q('#oa-otp')) reset(); }, 450);
        }

        async function submit() {
            if (ST.busy) return;
            const token = code();
            if (token.length !== 6) return;
            if (Date.now() - ST.sentAt > CODE_TTL) {
                return fail('Ce code a expiré (10 minutes). Touche « Renvoyer le code » pour en recevoir un nouveau.');
            }
            if (ST.tries >= MAX_TRIES) {
                return fail('Trop d’essais. Demande un nouveau code avec « Renvoyer le code ».');
            }
            setErr(''); boxes.forEach(b => b.disabled = true);
            busy(okBtn, true, 'Vérification…');
            const { error } = await db.auth.verifyOtp({ email: ST.email, token, type: mode === 'recovery' ? 'recovery' : 'signup' });
            ST.busy = false; okBtn.textContent = 'Valider';
            if (error) {
                boxes.forEach(b => b.disabled = false);
                if (isNetErr(error) || !navigator.onLine) { setErr(fr(error)); okBtn.disabled = false; return; }
                if (error.status === 429 || error.code === 'over_request_rate_limit') return fail(fr(error));
                ST.tries++;
                const left = MAX_TRIES - ST.tries;
                if (Date.now() - ST.sentAt > CODE_TTL) return fail('Ce code a expiré (10 minutes). Demande un nouveau code.');
                return fail(left > 0
                    ? `Code incorrect ou expiré. Vérifie les 6 chiffres (il te reste ${left} essai${left > 1 ? 's' : ''}).`
                    : 'Trop d’essais. Demande un nouveau code avec « Renvoyer le code ».');
            }
            clearPending(); ST.tries = 0;
            if (mode === 'recovery') { say('Code validé ✓'); return newPassScreen(); }
            try { sessionStorage.setItem(FLAG_KEY, String(Date.now())); } catch (_) { }
            say('E-mail confirmé ✓');
            goBoot();
        }

        okBtn.onclick = submit;

        // Renvoi : compte à rebours de 120 secondes
        const tick = () => {
            const el = q('#oa-resend');
            if (!el) return clearTimer();
            const left = Math.max(0, RESEND_SEC - Math.floor((Date.now() - ST.sentAt) / 1000));
            if (left > 0) {
                el.disabled = true;
                el.textContent = `Renvoyer le code (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})`;
            } else {
                el.disabled = false; el.textContent = 'Renvoyer le code'; clearTimer();
            }
        };
        ST.timer = setInterval(tick, 1000); tick();

        reBtn.onclick = async () => {
            if (ST.busy) return;
            setErr('');
            ST.busy = true; reBtn.disabled = true; reBtn.textContent = 'Envoi…';
            // Pour « mot de passe oublié », Supabase n'a pas de « resend » : on redemande un code.
            const r = mode === 'recovery'
                ? await db.auth.resetPasswordForEmail(ST.email)
                : await db.auth.resend({ type: 'signup', email: ST.email });
            ST.busy = false;
            if (r.error) {
                reBtn.disabled = false; reBtn.textContent = 'Renvoyer le code';
                return setErr(fr(r.error));
            }
            ST.sentAt = Date.now(); ST.tries = 0; savePending();
            reset(); say('Nouveau code envoyé ✓');
            clearTimer(); ST.timer = setInterval(tick, 1000); tick();
        };

        q('#oa-chg').onclick = () => { clearPending(); mode === 'recovery' ? forgotScreen() : signupScreen(); };
        boxes[0].focus();
    }

    /* ---------------------------------------------------------------
       ÉCRAN : Nouveau mot de passe  (étape 3 du mot de passe oublié)
       --------------------------------------------------------------- */
    function newPassScreen() {
        paint(
            '<h2 class="oa-h">Nouveau mot de passe</h2>'
            + '<form id="oa-f" class="oa-col" novalidate>'
            + pwField('pw', 'Nouveau mot de passe', 'new-password')
            + gaugeHtml()
            + pwField('pw2', 'Confirmer le mot de passe', 'new-password')
            + '<p class="oa-ok" id="oa-match"></p>'
            + '<p class="oa-err" id="oa-err" role="alert"></p>'
            + '<button id="oa-go" disabled>Enregistrer</button></form>'
            + '<button type="button" class="oa-link" id="oa-cancel">Annuler</button>',
            { step: 3, mode: 'recovery' });
        const f = q('#oa-f'), btn = q('#oa-go');
        bindEyes();
        bindPassword(f, btn);
        q('#oa-cancel').onclick = async () => { try { await db.auth.signOut(); } catch (_) { } loginScreen(true); };
        f.onsubmit = async e => {
            e.preventDefault();
            if (ST.busy) return;
            const pw = f.elements.pw.value;
            if (!passInfo(pw).valid) return setErr('Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.');
            if (pw !== f.elements.pw2.value) return setErr('Les deux mots de passe ne sont pas identiques.');
            setErr('');
            busy(btn, true, 'Enregistrement…');
            const { error } = await db.auth.updateUser({ password: pw });
            busy(btn, false);
            if (error) { vibrate([70, 40, 70]); return setErr(fr(error)); }
            say('Mot de passe modifié ✓');
            goBoot();
        };
    }

    /* ---------------------------------------------------------------
       Étape 3 « Profil » : barre de progression sur l'écran « Vous êtes : »
       (ambChoice vient d'ambassadeur.js, que l'on n'altère pas : on l'enveloppe)
       --------------------------------------------------------------- */
    function decorateChoice() {
        let t = 0;
        try { t = +sessionStorage.getItem(FLAG_KEY) || 0; } catch (_) { }
        if (!t || Date.now() - t > 30 * 60 * 1000) return;
        const box = q('#main .auth');
        if (!box || box.querySelector('.oa-steps')) return;
        injectCss();
        box.insertAdjacentHTML('afterbegin', progress('signup', 3));
        // dès que la personne choisit un profil, on retire le repère
        box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { try { sessionStorage.removeItem(FLAG_KEY); } catch (_) { } }));
    }
    if (!PARENT && typeof window.ambChoice === 'function' && !window.ambChoice.__oa) {
        const orig = window.ambChoice;
        window.ambChoice = function () { const r = orig.apply(this, arguments); try { decorateChoice(); } catch (_) { } return r; };
        window.ambChoice.__oa = true;
    }

    /* ---------------------------------------------------------------
       Branchement : remplace authView() de app.js / parent.js
       --------------------------------------------------------------- */
    window.authView = function () { loginScreen(); };

    // app.js / parent.js peuvent avoir déjà dessiné l'ancien écran avant le chargement de ce fichier.
    const redrawIfOld = () => { if (document.getElementById('paf') || document.getElementById('af')) loginScreen(); };
    redrawIfOld();
    setTimeout(redrawIfOld, 0);
    setTimeout(redrawIfOld, 350);
})();
