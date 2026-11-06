/* =====================================================================
   ORÉA École v82 — ui.js : finitions visuelles communes (école + parent)
   1) Icônes SVG à la place des emojis, PARTOUT dans l'interface
      (conversion automatique de l'affichage ; les messages écrits par les
       utilisateurs, les champs de saisie et les notifications du téléphone
       ne sont pas touchés).
   2) Transitions douces : pages, fenêtres, panneaux.
   3) Bouton retour du téléphone dans l'espace parent + « ← Retour » en haut
      de la fiche d'un enfant.
   4) Génie en Herbe : boutons Pause / Son plus grands et sobres.
   À charger EN DERNIER dans index.html et parent.html.
   ===================================================================== */
(function () {
    'use strict';
    const PARENT = !!document.getElementById('pmain');

    /* ---------- 1) Jeu d'icônes (trait fin, couleur du texte) ---------- */
    const I = {
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
        trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        left: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
        right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
        down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
        chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        pin: '<path d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
        alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
        flag: '<path d="M4 22V4M4 4h12l-2 4 2 4H4"/>',
        okc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        xc: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
        school: '<path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5M12 10h.01"/>',
        cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
        note: '<path d="M4 4a2 2 0 0 1 2-2h12v20H6a2 2 0 0 1-2-2z"/><path d="M8 2v20M12 7h4M12 11h4"/>',
        clip: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 12h6M9 16h4"/>',
        receipt: '<path d="M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
        grad: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
        phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
        money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
        walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 3-6 3 2v4M7 12l4-4 3 2 3 1"/>',
        door: '<path d="M3 21h18M6 21V3h12v18M14 12h.01"/>',
        eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        eyeoff: '<path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 7"/>',
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
        steth: '<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
        chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17V9"/>',
        cake: '<path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1 4 1 6 0s4-1 6 0 3 1 4 0M12 11V7M12 4h.01"/>',
        spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
        star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.4l-5.4 3 1.2-6-4.5-4.1 6.1-.7z"/>',
        gift: '<rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M5 12v9h14v-9M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
        dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
        up: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
        dl: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
        lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
        unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
        mega: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
        bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
        mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
        print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
        save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
        robot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
        ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/>',
        food: '<path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M18 22V2c-2 0-4 2-4 6v6h4"/>',
        game: '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
        refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        vol: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
        mute: '<path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',
        moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
        drop: '<path d="M12 2.7s7 7.3 7 12.3a7 7 0 0 1-14 0c0-5 7-12.3 7-12.3z"/>',
        smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
        calm: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 .7 2.2 1 3.5 1s2.5-.3 3.5-1M9 9h.01M15 9h.01"/>',
        sad: '<circle cx="12" cy="12" r="9"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/>',
        upset: '<circle cx="12" cy="12" r="9"/><path d="M8 16c1-1 2 1 3 0s2 1 3 0 2 1 2 0M8 9l2 1M16 9l-2 1"/>',
        wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 20h.01"/>',
        wifioff: '<path d="M2 2l20 20M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.4M2 9a15 15 0 0 1 4.6-3M12 20h.01M16.7 11a10 10 0 0 1 2.3 1.5M10.7 5.1A15 15 0 0 1 22 9"/>',
        scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
        swap: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
        pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
        help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
        leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.2-6"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
        send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
        hand: '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5M10 10V3.5a1.5 1.5 0 0 1 3 0V10M13 10V5a1.5 1.5 0 0 1 3 0v6M16 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3 15a1.5 1.5 0 0 1 2.3-1.9L7 15"/>'
    };
    const svg = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
    window.ico = svg;

    // Emoji -> icône (+ couleur éventuelle)
    const E = {
        '🔍': 'search', '🔎': 'search', '🔔': 'bell', '🗑': 'trash', '✏': 'edit', '✎': 'edit', '✓': 'check', '✔': 'check',
        '✗': 'x', '✕': 'x', '←': 'left', '→': 'right', '↓': 'down', '⬇': 'dl', '👇': 'down', '👉': 'right', '➤': 'send',
        '💬': 'chat', '⏳': 'hourglass', '⏰': 'clock', '🕒': 'clock', '🕓': 'clock', '🕐': 'clock',
        '📌': 'pin', '📍': 'pin', '⚠': 'alert', '⛔': 'ban', '🚩': 'flag', '⚑': 'flag',
        '✅': 'okc', '❌': 'xc', '🏫': 'school', '📅': 'cal', '🗓': 'cal', '📄': 'file', '📝': 'edit', '📋': 'clip',
        '🧾': 'receipt', '📒': 'note', '📘': 'book', '📚': 'book', '📇': 'clip', '🎓': 'grad', '📞': 'phone', '📲': 'phone',
        '🖼': 'image', '💰': 'money', '🚸': 'walk', '🚶': 'walk', '🚪': 'door', '👁': 'eye', '🙈': 'eyeoff',
        '👤': 'user', '🧑': 'user', '👩': 'user', '👨': 'user', '👦': 'user', '👧': 'user', '👥': 'users', '👪': 'users', '🤝': 'users',
        '🏆': 'trophy', '🥇': 'trophy', '🥈': 'trophy', '🥉': 'trophy', '🩺': 'steth', '📊': 'chart', '🎂': 'cake',
        '🎉': 'spark', '🎊': 'spark', '✨': 'spark', '🌟': 'star', '⭐': 'star', '★': 'star', '🎁': 'gift', '🎈': 'spark',
        '🔴': ['dot', 'var(--bad)'], '🟠': ['dot', '#E3A33B'], '🟢': ['dot', 'var(--ok)'],
        '📤': 'up', '📥': 'dl', '🔒': 'lock', '🔓': 'unlock', '📢': 'mega', '📣': 'mega', '💡': 'bulb', '✉': 'mail',
        '🖨': 'print', '💾': 'save', '🤖': 'robot', '⚽': 'ball', '🍽': 'food', '🎮': 'game', '🛡': 'shield', '⚙': 'gear',
        '↻': 'refresh', '🔁': 'refresh', '↩': 'left', '➕': 'plus', '⚡': 'bolt', '🗂': 'folder', '🔊': 'vol', '🔇': 'mute',
        '😴': 'moon', '🚽': 'drop', '😊': 'smile', '🙂': 'calm', '😢': 'sad', '😣': 'upset', '📶': 'wifi', '📴': 'wifioff',
        '⚖': 'scale', '↔': 'swap', '⏸': 'pause', '❓': 'help', '🌱': 'leaf', '🍀': 'leaf', '🎯': 'target', '⚔': 'swords',
        '🧤': 'shield', '👋': 'hand'
    };
    const KEYS = Object.keys(E).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const RX = new RegExp('(' + KEYS.join('|') + ')\\uFE0F?', 'g');
    const TEST = new RegExp('(' + KEYS.join('|') + ')');
    const SKIP = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SCRIPT', 'STYLE', 'svg', 'SVG', 'CANVAS', 'TITLE', 'CODE', 'PRE']);
    const skipEl = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (SKIP.has(e.tagName) || e.isContentEditable || (e.classList && (e.classList.contains('om-b') || e.classList.contains('no-ico')))) return true; } return false; };

    function convertText(node) {
        const t = node.nodeValue;
        if (!t || !TEST.test(t) || skipEl(node.parentElement)) return;
        const frag = document.createDocumentFragment();
        let last = 0;
        t.replace(RX, (m, k, off) => {
            if (off > last) frag.appendChild(document.createTextNode(t.slice(last, off)));
            const v = E[k], name = Array.isArray(v) ? v[0] : v, col = Array.isArray(v) ? v[1] : '';
            const sp = document.createElement('span');
            sp.className = 'icw'; if (col) sp.style.color = col;
            sp.innerHTML = svg(name);
            frag.appendChild(sp);
            last = off + m.length;
            return m;
        });
        if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
        node.parentNode.replaceChild(frag, node);
    }
    function scan(root) {
        if (!root) return;
        if (root.nodeType === 3) return convertText(root);
        if (root.nodeType !== 1 || skipEl(root)) return;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), L = [];
        while (w.nextNode()) L.push(w.currentNode);
        L.forEach(convertText);
        // Infobulles et libellés des boutons : on garde un texte propre
        if (root.querySelectorAll) root.querySelectorAll('[title],[aria-label]').forEach(el => ['title', 'aria-label'].forEach(a => { const v = el.getAttribute(a); if (v && TEST.test(v)) el.setAttribute(a, v.replace(RX, '').trim()); }));
    }
    let queue = new Set(), planned = false;
    const flush = () => { planned = false; const q = [...queue]; queue.clear(); q.forEach(n => { if (n.isConnected) scan(n); }); };
    const mo = new MutationObserver(ms => {
        ms.forEach(m => { if (m.type === 'characterData') queue.add(m.target); else m.addedNodes.forEach(n => queue.add(n)); });
        if (!planned) { planned = true; requestAnimationFrame(flush); }
    });
    const start = () => { scan(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();

    /* ---------- 2) Styles : icônes, transitions, boutons du jeu ---------- */
    const st = document.createElement('style');
    st.textContent = `
.icw{display:inline-flex;align-items:center;justify-content:center;vertical-align:-0.2em;line-height:1}
.icw .ic{width:1.15em;height:1.15em;flex:none}
button .icw,.qz-btn-icon .icw{vertical-align:-0.22em}
/* Pages : apparition douce et en cascade */
#main>*,#pmain>*{animation:uiIn .32s cubic-bezier(.2,.7,.2,1) both}
#main>*:nth-child(2),#pmain>*:nth-child(2){animation-delay:.03s}
#main>*:nth-child(3),#pmain>*:nth-child(3){animation-delay:.06s}
#main>*:nth-child(4),#pmain>*:nth-child(4){animation-delay:.09s}
#main>*:nth-child(5),#pmain>*:nth-child(5){animation-delay:.12s}
#main>*:nth-child(n+6),#pmain>*:nth-child(n+6){animation-delay:.15s}
@keyframes uiIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
/* Fenêtres */
dialog[open]{animation:uiDlg .22s cubic-bezier(.2,.7,.2,1)}
dialog[open]::backdrop{animation:uiFade .22s ease}
@keyframes uiDlg{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@keyframes uiFade{from{opacity:0}to{opacity:1}}
/* Panneaux plein écran */
.om-ov,.nt-ov,.fm-ov,.ic-ov,#q-modal{animation:uiPanel .26s cubic-bezier(.2,.7,.2,1)}
@keyframes uiPanel{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
/* Génie en Herbe : boutons Pause / Son grands et sobres */
.qz-bar .qz-btn-icon{width:52px;height:52px;border-radius:14px;border:1.5px solid var(--gold);color:var(--gold);font-size:24px;background:rgba(199,163,75,.08)}
.qz-bar .qz-btn-icon .ic{width:26px;height:26px;stroke-width:2}
.qz-pause-overlay button{width:min(320px,80vw)!important;min-height:60px;font-size:18px;border-radius:16px}
.qz-pause-overlay h2{font-size:36px}
/* Retour en haut de la fiche d'un enfant (parent) */
.ui-back{display:inline-flex;align-items:center;gap:6px;margin:4px 0 10px;padding:8px 12px;border-radius:10px;border:1px solid var(--line,#3a3328);background:transparent;color:var(--gold,#c7a34b);font:inherit;font-size:14px;cursor:pointer}
@media (prefers-reduced-motion:reduce){#main>*,#pmain>*,dialog[open],dialog[open]::backdrop,.om-ov,.nt-ov,.fm-ov,.ic-ov,#q-modal{animation:none!important}}
`;
    document.head.appendChild(st);

    /* ---------- 3) Espace parent : bouton retour du téléphone ---------- */
    if (PARENT && typeof P !== 'undefined') {
        let guard = false;
        const push = () => { if (!guard) { history.pushState({ pnav: 1 }, ''); guard = true; } };
        const oRender = window.render;
        if (typeof oRender === 'function') {
            window.render = function () {
                P.__detail = false;
                const r = oRender.apply(this, arguments);
                if (P.tab !== 'accueil') push();
                return r;
            };
        }
        const oDetail = window.childDetail;
        if (typeof oDetail === 'function') {
            window.childDetail = async function () {
                P.__detail = true; push();
                const r = await oDetail.apply(this, arguments);
                try {
                    const main = document.getElementById('pmain');
                    if (main && !main.querySelector('.ui-back')) main.insertAdjacentHTML('afterbegin', `<button class="ui-back" onclick="history.back()">${svg('left')} Retour</button>`);
                } catch (_) { }
                return r;
            };
        }
        // Une fenêtre (fiche santé, personne autorisée…) s'ouvre : le retour la fermera
        new MutationObserver(() => { if (document.getElementById('q-modal')) push(); }).observe(document.body, { childList: true });
        window.addEventListener('popstate', () => {
            guard = false;
            const m = document.getElementById('q-modal');
            if (m) { m.remove(); if (P.__detail || P.tab !== 'accueil') push(); return; }
            if (P.__detail || P.tab !== 'accueil') { P.tab = 'accueil'; render(); window.scrollTo(0, 0); }
        });
    }
})();
