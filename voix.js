/* =====================================================================
   ORÉA École v94 — voix.js : lecture à voix haute pour les parents
   Un bouton 🔊 sur les devoirs, le cahier de textes, les annonces, les
   messages et les notifications : le téléphone lit le texte à voix haute
   (synthèse vocale du téléphone, gratuite, sans internet sur la plupart
   des Android). Toucher à nouveau arrête la lecture.
   Chargé par parent.html (après parent.js et langues.js).
   ===================================================================== */
(function () {
    'use strict';
    if (!('speechSynthesis' in window)) return;
    const SEL = '.p-assign, .an-card, .p-chat-bubble, .om-b, .pn-it, .p-card.p-news';
    let cur = null;
    const voiceFor = () => {
        const lang = (document.documentElement.lang || 'fr').slice(0, 2), V = speechSynthesis.getVoices();
        // Kiswahili si le téléphone a une voix ; sinon français (le lingala n'a pas encore de voix)
        return (lang === 'sw' && V.find(v => /^sw/i.test(v.lang))) || V.find(v => /^fr/i.test(v.lang)) || null;
    };
    function stop() { speechSynthesis.cancel(); if (cur) { cur.classList.remove('on'); cur.setAttribute('aria-label', 'Écouter'); } cur = null; }
    function speak(el, btn) {
        if (cur === btn) return stop();
        stop();
        const t = (el.innerText || '').replace(/🔊|⏹/g, '').replace(/\s+/g, ' ').trim();
        if (!t) return;
        const u = new SpeechSynthesisUtterance(t), v = voiceFor();
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'fr-FR';
        u.rate = 0.95;
        u.onend = u.onerror = () => { if (cur === btn) stop(); };
        cur = btn; btn.classList.add('on'); btn.setAttribute('aria-label', 'Arrêter la lecture');
        speechSynthesis.speak(u);
    }
    const css = document.createElement('style');
    css.textContent = '.vx-b{float:right;width:36px!important;min-width:36px;height:36px;min-height:36px!important;margin:-4px -4px 4px 8px!important;padding:0!important;border-radius:50%!important;border:1px solid var(--gold,#c7a34b)!important;background:transparent!important;color:var(--gold,#c7a34b)!important;font-size:16px;line-height:1;box-shadow:none!important;display:inline-flex;align-items:center;justify-content:center}.vx-b.on{background:var(--gold,#c7a34b)!important;color:#1a1303!important}';
    document.head.appendChild(css);
    function add(root) {
        (root.querySelectorAll ? root.querySelectorAll(SEL) : []).forEach(el => {
            if (el.querySelector(':scope > .vx-b')) return;
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'vx-b no-ico'; b.textContent = '🔊'; b.setAttribute('aria-label', 'Écouter'); b.dataset.notr = '1';
            b.onclick = e => { e.stopPropagation(); e.preventDefault(); speak(el, b); };
            el.prepend(b);
        });
    }
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => add(document.body), 120); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    speechSynthesis.getVoices();
    add(document.body);
})();
