/* =====================================================================
   ORÉA École v40 — quiz_ui.js (Partie 1/2)
   Interface animateur du Génie en Herbe.
   ===================================================================== */
(function () {
    'use strict';
    if (document.getElementById('pmain')) return;

    const $ = s => document.querySelector(s);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const QUIZ = {
        game: null, players: [], state: null, timer: null, timeLeft: 0,
        startTime: 0, isAnswering: false, soundOn: localStorage.getItem('orea_quiz_sound') !== 'off',
        audioCtx: null, wakeLock: null, ov: null, currentStep: null, currentQ: null
    };

    function injectCss() {
        if (document.getElementById('qz-css')) return;
        const style = document.createElement('style');
        style.id = 'qz-css';
        style.textContent = `
        .qz-ov{position:fixed;inset:0;z-index:100;background:var(--bg);color:var(--tx);display:flex;flex-direction:column;animation:qzIn .3s ease}
        @keyframes qzIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .qz-head{display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top)) 16px 12px;background:var(--card);border-bottom:1px solid var(--line);box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:2}
        .qz-head b{flex:1;font-size:16.5px;font-family:var(--serif);color:var(--gold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .qz-btn-icon{width:40px;height:40px;border-radius:50%;background:transparent;border:1px solid var(--line);color:var(--tx);display:flex;align-items:center;justify-content:center;font-size:18px}
        .qz-btn-icon:active{background:rgba(199,163,75,.15)}
        .qz-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch}
        .qz-form label{display:block;font-size:13px;color:var(--mut);margin-bottom:4px;font-weight:600}
        .qz-form select,.qz-form input{width:100%;padding:14px;background:var(--bg);border:1px solid var(--line);border-radius:12px;color:var(--tx);font-size:15px;margin-bottom:10px}
        .qz-choices{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px}
        .qz-ch{flex:1;padding:12px;text-align:center;border:1px solid var(--line);border-radius:12px;font-weight:700;color:var(--mut);background:transparent;font-size:14px}
        .qz-ch.on{background:rgba(199,163,75,.15);border-color:var(--gold);color:var(--gold)}
        .qz-btn-bottom{position:sticky;bottom:0;padding:16px;background:var(--bg);border-top:1px solid var(--line);display:flex;gap:10px}
        .qz-btn-bottom button{flex:1;padding:16px;font-size:16px;border-radius:12px;font-weight:700}
        .qz-players{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .qz-pl-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px}
        .qz-pl-card label{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--tx);font-weight:500}
        .qz-pl-card input{width:auto;margin:0}
        .qz-game{display:flex;flex-direction:column;height:100%;background:radial-gradient(circle at 50% 0%, rgba(199,163,75,.1), transparent 60%),var(--bg)}
        .qz-top{display:flex;justify-content:space-between;padding:12px 16px;font-size:14px;font-weight:700;color:var(--mut);background:var(--card);border-bottom:1px solid var(--line)}
        .qz-top .A{color:#3b82f6}.qz-top .B{color:#ef4444}
        .qz-scores{display:flex;gap:10px;font-size:20px;font-family:var(--serif)}
        .qz-q-box{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;gap:20px}
        .qz-theme{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);font-weight:700}
        .qz-question{font-size:22px;font-weight:700;line-height:1.3;font-family:var(--serif)}
        .qz-choices-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:600px}
        .qz-ans{padding:16px;background:var(--card);border:2px solid var(--line);border-radius:14px;font-size:16px;font-weight:600;color:var(--tx);text-align:left;display:flex;align-items:center;gap:10px;transition:all .2s;cursor:pointer}
        .qz-ans span{width:26px;height:26px;border-radius:50%;background:var(--line);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--mut);flex-shrink:0}
        .qz-ans:active{background:rgba(199,163,75,.1)}
        .qz-ans.correct{background:rgba(107,168,133,.15);border-color:var(--ok);animation:qzPop .3s}
        .qz-ans.correct span{background:var(--ok);color:#fff}
        .qz-ans.wrong{background:rgba(168,90,78,.15);border-color:var(--bad);animation:qzShake .4s}
        .qz-ans.wrong span{background:var(--bad);color:#fff}
        .qz-ans.disabled{pointer-events:none;opacity:.5}
        .qz-exp{position:absolute;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;animation:qzFade .3s}
        .qz-exp-box{background:var(--card);padding:24px;border-radius:16px;max-width:400px;border:1px solid var(--gold);box-shadow:0 10px 30px rgba(0,0,0,.5)}
        .qz-exp-box h3{color:var(--gold);margin-top:0;font-size:20px}
        .qz-exp-box p{font-size:16px;line-height:1.5;color:var(--tx)}
        .qz-timer{position:relative;width:70px;height:70px;display:flex;align-items:center;justify-content:center}
        .qz-timer svg{position:absolute;inset:0;transform:rotate(-90deg);width:100%;height:100%}
        .qz-timer circle{fill:none;stroke-width:6;stroke-linecap:round}
        .qz-timer .bg{stroke:var(--line)}
        .qz-timer .fg{stroke:var(--ok);transition:stroke-dasharray .3s, stroke .3s}
        .qz-timer span{font-size:24px;font-weight:800;font-family:monospace;color:var(--tx)}
        .qz-jokers{display:flex;gap:10px;margin-top:10px;justify-content:center}
        .qz-jk{padding:10px 16px;background:var(--card);border:1px solid var(--gold);border-radius:20px;font-size:13px;font-weight:700;color:var(--gold)}
        .qz-jk:disabled{opacity:.3;border-color:var(--line);color:var(--mut)}
        @keyframes qzPop{0%{transform:scale(.95)}50%{transform:scale(1.02)}100%{transform:scale(1)}}
        @keyframes qzShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes qzFade{from{opacity:0}to{opacity:1}}
        .qz-pause-overlay{position:absolute;inset:0;background:rgba(0,0,0,.8);z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .qz-pause-overlay h2{font-size:32px;color:var(--gold);margin-bottom:20px}
        `;
        document.head.appendChild(style);
    }

    function initAudio() {
        if (!QUIZ.audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) QUIZ.audioCtx = new AC();
        }
        if (QUIZ.audioCtx && QUIZ.audioCtx.state === 'suspended') QUIZ.audioCtx.resume();
    }

    function playTone(freq, type, duration, vol) {
        if (!QUIZ.soundOn || !QUIZ.audioCtx) return;
        const osc = QUIZ.audioCtx.createOscillator();
        const gain = QUIZ.audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, QUIZ.audioCtx.currentTime);
        gain.gain.setValueAtTime(vol || 0.1, QUIZ.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, QUIZ.audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(QUIZ.audioCtx.destination);
        osc.start(); osc.stop(QUIZ.audioCtx.currentTime + duration);
    }

    const sound = {
        success: () => { playTone(440, 'sine', 0.15); setTimeout(() => playTone(660, 'sine', 0.2), 150); setTimeout(() => playTone(880, 'sine', 0.3), 300); },
        buzzer: () => { playTone(150, 'sawtooth', 0.4, 0.2); },
        tick: () => { playTone(800, 'square', 0.05, 0.05); },
        fanfare: () => { [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.4, 0.15), i * 150)); }
    };

    function startConfetti() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute'; canvas.style.inset = '0'; canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '5';
        const box = document.getElementById('qz-podium-box');
        if (!box) return;
        box.appendChild(canvas);
        canvas.width = box.clientWidth; canvas.height = box.clientHeight;
        const ctx = canvas.getContext('2d');
        const colors = ['#C7A34B', '#E3C978', '#3b82f6', '#ef4444', '#6BA885'];
        const particles = [];
        for (let i = 0; i < 100; i++) {
            particles.push({ x: Math.random() * canvas.width, y: -20 - Math.random() * 100, w: 6 + Math.random() * 6, h: 6 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)], vy: 2 + Math.random() * 4, vx: -2 + Math.random() * 4, rot: Math.random() * 360, vr: -5 + Math.random() * 10 });
        }
        function update() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.vy; p.x += p.vx; p.rot += p.vr;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
                ctx.fillStyle = p.c; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
                ctx.restore();
            });
            if (particles.some(p => p.y < canvas.height)) requestAnimationFrame(update); else canvas.remove();
        }
        update();
    }

    function showOverlay(html) {
        injectCss();
        if (QUIZ.ov) QUIZ.ov.remove();
        const ov = document.createElement('div');
        ov.className = 'qz-ov'; ov.innerHTML = html;
        document.body.appendChild(ov); QUIZ.ov = ov;
        history.pushState({ qz: 1 }, '');
        return ov;
    }

    window.addEventListener('popstate', e => {
        if (QUIZ.ov) {
            if (QUIZ.state && QUIZ.state.level > 0 && !confirm('Quitter le quiz en cours ? La partie sera perdue.')) {
                history.pushState({ qz: 1 }, ''); return;
            }
            closeQuiz();
        }
    });

    function closeQuiz() {
        if (QUIZ.timer) { clearInterval(QUIZ.timer); QUIZ.timer = null; }
        if (QUIZ.wakeLock) { QUIZ.wakeLock.release().catch(()=>{}); QUIZ.wakeLock = null; }
        if (QUIZ.ov) { QUIZ.ov.remove(); QUIZ.ov = null; }
        QUIZ.game = null; QUIZ.players = []; QUIZ.state = null;
        document.body.style.overflow = '';
    }

    async function keepAwake() {
        try { if ('wakeLock' in navigator) QUIZ.wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
    }

    async function openNewGame() {
        initAudio();
        showOverlay(`<div class="qz-head"><button class="qz-btn-icon" onclick="history.back()">←</button><b>Nouvelle partie</b></div><div class="qz-body qz-form" id="qz-cfg-body"><p style="text-align:center;color:var(--mut)">Chargement...</p></div>`);

        const classes = S.classes.filter(c => cy(c) === S.year).sort(classSort);
        if (classes.length < 2) {
            $('#qz-cfg-body').innerHTML = `<p class="empty">Il faut au moins 2 classes pour lancer une partie.</p><button class="ghost" style="margin-top:10px" onclick="history.back()">Retour</button>`;
            return;
        }

        $('#qz-cfg-body').innerHTML = `
            <label>Niveau scolaire</label>
            <div class="qz-choices" id="qz-lvl"><button class="qz-ch" data-v="primaire">Primaire</button><button class="qz-ch on" data-v="secondaire">Secondaire</button></div>
            <label>Équipe A (Classe)</label>
            <select id="qz-cls-a">${classes.map((c, i) => `<option value="${c.id}" ${i===0?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
            <label>Équipe B (Classe)</label>
            <select id="qz-cls-b">${classes.map((c, i) => `<option value="${c.id}" ${i===1?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
            <label>Chronomètre par question</label>
            <div class="qz-choices" id="qz-tm"><button class="qz-ch" data-v="30">30 s</button><button class="qz-ch on" data-v="45">45 s</button><button class="qz-ch" data-v="60">1 min</button></div>
            <div id="qz-pl-area" style="margin-top:20px"></div>
            <div class="qz-btn-bottom"><button id="qz-start" disabled>Lancer le Quiz</button></div>
        `;

        let niveau = 'secondaire', timer = 45;
        $('#qz-lvl').onclick = e => { if (!e.target.classList.contains('qz-ch')) return; [...$('#qz-lvl').children].forEach(b => b.classList.remove('on')); e.target.classList.add('on'); niveau = e.target.dataset.v; };
        $('#qz-tm').onclick = e => { if (!e.target.classList.contains('qz-ch')) return; [...$('#qz-tm').children].forEach(b => b.classList.remove('on')); e.target.classList.add('on'); timer = +e.target.dataset.v; };

        function renderPlayers() {
            const ca = S.classes.find(c => c.id === $('#qz-cls-a').value);
            const cb = S.classes.find(c => c.id === $('#qz-cls-b').value);
            if (!ca || !cb || ca.id === cb.id) { 
                $('#qz-pl-area').innerHTML = `<p class="due" style="text-align:center">Choisissez deux classes différentes.</p>`; 
                $('#qz-start').disabled = true; 
                return; 
            }
            
            const stA = S.stu.filter(s => s.class_id === ca.id).sort((a,b)=>a.name.localeCompare(b.name));
            const stB = S.stu.filter(s => s.class_id === cb.id).sort((a,b)=>a.name.localeCompare(b.name));
            
            $('#qz-pl-area').innerHTML = `
                <div class="qz-players">
                    <div class="qz-pl-card">
                        <b style="color:#3b82f6;margin-bottom:8px;display:block">${esc(ca.name)}</b>
                        <div style="max-height: 150px; overflow-y: auto; padding-right: 5px;">
                            ${stA.map(s => `<label style="margin-bottom:6px;"><input type="checkbox" class="plA" value="${s.id}"> ${esc(s.name)}</label>`).join('')}
                        </div>
                    </div>
                    <div class="qz-pl-card">
                        <b style="color:#ef4444;margin-bottom:8px;display:block">${esc(cb.name)}</b>
                        <div style="max-height: 150px; overflow-y: auto; padding-right: 5px;">
                            ${stB.map(s => `<label style="margin-bottom:6px;"><input type="checkbox" class="plB" value="${s.id}"> ${esc(s.name)}</label>`).join('')}
                        </div>
                    </div>
                </div>
                <p style="font-size:12px;color:var(--mut);margin-top:8px;text-align:center">Sélectionnez 5 élèves par équipe.</p>`;
            
            const check = () => { 
                const na = document.querySelectorAll('.plA:checked').length; 
                const nb = document.querySelectorAll('.plB:checked').length; 
                $('#qz-start').disabled = !(na === 5 && nb === 5); 
            };
            $('#qz-pl-area').onchange = check; 
            check();
        }

        $('#qz-cls-a').onchange = renderPlayers; 
        $('#qz-cls-b').onchange = renderPlayers; 
        renderPlayers();

        $('#qz-start').onclick = async e => {
            const btn = e.target; btn.textContent = 'Préparation...'; btn.disabled = true;
            try {
                const ca = S.classes.find(c => c.id === $('#qz-cls-a').value);
                const cb = S.classes.find(c => c.id === $('#qz-cls-b').value);
                const plA = [...document.querySelectorAll('.plA:checked')].map(i => ({ id: i.value, name: i.nextSibling.textContent.trim() }));
                const plB = [...document.querySelectorAll('.plB:checked')].map(i => ({ id: i.value, name: i.nextSibling.textContent.trim() }));
                const res = await QuizEngine.createGame({ school_id: S.school.id, created_by: S.me.id, niveau_scolaire: niveau, timer_seconds: timer, class_a: ca, class_b: cb, team_a_players: plA, team_b_players: plB });
                QUIZ.game = res.game; QUIZ.players = res.players; QUIZ.state = res.game.state; startGameScreen();
            } catch (err) { alert(err.message); btn.textContent = 'Lancer le Quiz'; btn.disabled = false; }
        };
    }
       async function startGameScreen() {
        if (QUIZ.game.status !== 'en_cours') QUIZ.game.status = 'en_cours';
        showOverlay(`
            <div class="qz-game">
                <div class="qz-head"><button class="qz-btn-icon" id="qz-btn-pause">⏸</button><b>Niveau <span id="qz-h-lvl">1</span> · <span id="qz-h-name">Échauffement</span></b><button class="qz-btn-icon" id="qz-btn-snd">${QUIZ.soundOn ? '🔊' : '🔇'}</button></div>
                <div class="qz-top"><div class="A" id="qz-h-a">${esc(QUIZ.game.class_a_name)} <span class="qz-scores">0</span></div><div class="B" id="qz-h-b">${esc(QUIZ.game.class_b_name)} <span class="qz-scores">0</span></div></div>
                <div class="qz-q-box" id="qz-main-area"><div class="sk" style="width:80%;height:80px"></div></div>
            </div>
        `);
        keepAwake();
        $('#qz-btn-pause').onclick = pauseGame;
        $('#qz-btn-snd').onclick = e => { QUIZ.soundOn = !QUIZ.soundOn; localStorage.setItem('orea_quiz_sound', QUIZ.soundOn ? 'on' : 'off'); e.target.textContent = QUIZ.soundOn ? '🔊' : '🔇'; };
        loadNextStep();
    }

    function updateScores() {
        if (!QUIZ.state) return;
        $('#qz-h-a .qz-scores').textContent = QUIZ.state.scores.A;
        $('#qz-h-b .qz-scores').textContent = QUIZ.state.scores.B;
        const n = QUIZ.state.level;
        $('#qz-h-lvl').textContent = n;
        $('#qz-h-name').textContent = QuizEngine.LEVELS.find(l => l.n === n)?.nom || '';
    }

    async function loadNextStep() {
        const main = $('#qz-main-area');
        main.innerHTML = `<div class="sk" style="width:80%;height:80px"></div>`;
        try {
            const step = await QuizEngine.nextQuestion({ game: QUIZ.game, players: QUIZ.players, state: QUIZ.state });
            if (step.finished) return endGame(step.winner);
            if (step.tie) return showTieScreen();
            if (step.error) throw new Error(step.error);
            updateScores(); renderQuestion(step);
        } catch (e) { main.innerHTML = `<p class="due" style="text-align:center;padding:20px">Erreur : ${esc(e.message)}</p><button class="ghost" style="margin-top:10px" onclick="history.back()">Quitter</button>`; }
    }

    function renderQuestion(step) {
        QUIZ.currentStep = step; QUIZ.currentQ = step.q;
        const q = step.q, tm = QUIZ.game.timer_seconds, main = $('#qz-main-area');
        const teamColor = step.team === 'A' ? '#3b82f6' : '#ef4444';
        const teamName = step.team === 'A' ? QUIZ.game.class_a_name : QUIZ.game.class_b_name;
        const letters = ['A', 'B', 'C', 'D'];
        main.innerHTML = `
            <div style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:10px 20px">
                <div style="color:${teamColor};font-weight:800;font-size:14px">👤 ${esc(step.player.name)} <small>(${esc(teamName)})</small></div>
                <div class="qz-timer" id="qz-timer"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="40"></circle><circle class="fg" cx="50" cy="50" r="40" id="qz-circle" stroke-dasharray="251.2" stroke-dashoffset="0"></circle></svg><span id="qz-txt-time">${tm}</span></div>
            </div>
            <div class="qz-q-box" style="flex:1;padding-top:0">
                <div class="qz-theme">${esc(q.theme || 'Culture Générale')} · Niveau ${QUIZ.state.level}</div>
                <div class="qz-question">${esc(q.question)}</div>
                <div class="qz-choices-grid" id="qz-grid">${q.choix.map((c, i) => `<div class="qz-ans" data-i="${i}"><span>${letters[i]}</span> ${esc(c)}</div>`).join('')}</div>
            </div>`;
        if (QUIZ.state.level !== 5) {
            const jokers = QUIZ.state.jokers_used[step.team];
            main.insertAdjacentHTML('beforeend', `<div class="qz-jokers"><button class="qz-jk" id="jk-ami" ${jokers.ami || QUIZ.isAnswering ? 'disabled' : ''}>📞 Appel à un ami (${jokers.ami ? 'utilisé' : '1'})</button><button class="qz-jk" id="jk-50" ${jokers.cinquante || QUIZ.isAnswering ? 'disabled' : ''}>50/50 (${jokers.cinquante ? 'utilisé' : '1'})</button></div>`);
            if (!jokers.ami) $('#jk-ami').onclick = () => useJoker('ami', step, q);
            if (!jokers.cinquante) $('#jk-50').onclick = () => useJoker('cinquante', step, q);
        }
        QUIZ.isAnswering = false; QUIZ.timeLeft = tm; QUIZ.startTime = Date.now();
        $('#qz-grid').querySelectorAll('.qz-ans').forEach(el => { el.onclick = () => submitAnswer(+el.dataset.i, step, q); });
        const circle = $('#qz-circle'), perimeter = 251.2;
        if (QUIZ.timer) clearInterval(QUIZ.timer);
        QUIZ.timer = setInterval(() => {
            QUIZ.timeLeft -= 0.1;
            if (QUIZ.timeLeft <= 0) { clearInterval(QUIZ.timer); submitAnswer(-1, step, q); return; }
            const pct = QUIZ.timeLeft / tm; circle.style.strokeDashoffset = perimeter - (perimeter * pct);
            if (QUIZ.timeLeft <= 5) { circle.style.stroke = 'var(--bad)'; if (Math.floor(QUIZ.timeLeft * 10) % 10 === 0 && Math.floor(QUIZ.timeLeft) !== Math.floor(QUIZ.timeLeft + 0.1)) { sound.tick(); } }
            else if (QUIZ.timeLeft <= tm / 2) { circle.style.stroke = 'orange'; }
            else { circle.style.stroke = 'var(--ok)'; }
            $('#qz-txt-time').textContent = Math.ceil(QUIZ.timeLeft);
        }, 100);
    }

    async function useJoker(type, step, q) {
        if (QUIZ.isAnswering) return;
        if (type === 'ami') { QUIZ.timeLeft += 30; $('#jk-ami').disabled = true; $('#jk-ami').textContent = '📞 Appel à un ami (+30s)'; }
        else if (type === 'cinquante') {
            $('#jk-50').disabled = true; $('#jk-50').textContent = '50/50 utilisé';
            const wrongIndices = [0,1,2,3].filter(i => i !== q.bonne_reponse);
            QuizEngine.shuffle(wrongIndices).slice(0, 2).forEach(i => { $(`#qz-grid .qz-ans[data-i="${i}"]`).classList.add('disabled'); });
        }
        try { await QuizStorage.useJoker(QUIZ.game.id, step.team, type); QUIZ.state.jokers_used[step.team][type] = true; await QuizEngine.saveState(QUIZ.game.id, QUIZ.state); } catch(e) { console.error(e); }
    }

    async function submitAnswer(selectedIdx, step, q) {
        if (QUIZ.isAnswering) return; QUIZ.isAnswering = true; if (QUIZ.timer) clearInterval(QUIZ.timer);
        const timeMs = Date.now() - QUIZ.startTime, isCorrect = selectedIdx === q.bonne_reponse;
        $('#qz-grid').querySelectorAll('.qz-ans').forEach((el, i) => { el.classList.add('disabled'); if (i === q.bonne_reponse) el.classList.add('correct'); else if (i === selectedIdx && !isCorrect) el.classList.add('wrong'); });
        if (isCorrect) sound.success(); else sound.buzzer();
        try { await QuizEngine.recordAnswer({ game: QUIZ.game, players: QUIZ.players, state: QUIZ.state }, { team: step.team, player_id: step.player.id, correct: isCorrect, time_ms: timeMs, question_id: q.id }); updateScores(); } catch(e) { console.error(e); }
        setTimeout(() => {
            const ov = document.createElement('div'); ov.className = 'qz-exp';
            ov.innerHTML = `<div class="qz-exp-box"><h3 style="color:${isCorrect ? 'var(--ok)' : 'var(--bad)'}">${isCorrect ? '✅ Bonne réponse !' : (selectedIdx === -1 ? '⏰ Temps écoulé !' : '❌ Mauvaise réponse')}</h3><p>${esc(q.explication || 'La bonne réponse était : ' + q.choix[q.bonne_reponse])}</p><button class="ghost" style="margin-top:15px;width:100%" id="qz-next">Question suivante →</button></div>`;
            $('#qz-main-area').appendChild(ov); $('#qz-next').onclick = () => { ov.remove(); QUIZ.isAnswering = false; loadNextStep(); };
        }, 1500);
    }

    function resumeTimer(step, q) {
        QUIZ.startTime = Date.now() - (QUIZ.game.timer_seconds - QUIZ.timeLeft) * 1000;
        QUIZ.timer = setInterval(() => {
            QUIZ.timeLeft -= 0.1;
            if (QUIZ.timeLeft <= 0) { clearInterval(QUIZ.timer); submitAnswer(-1, step, q); return; }
            const circle = $('#qz-circle');
            if (circle) {
                const pct = QUIZ.timeLeft / QUIZ.game.timer_seconds; circle.style.strokeDashoffset = 251.2 - (251.2 * pct);
                if (QUIZ.timeLeft <= 5) { circle.style.stroke = 'var(--bad)'; } else if (QUIZ.timeLeft <= QUIZ.game.timer_seconds/2) { circle.style.stroke = 'orange'; }
                $('#qz-txt-time').textContent = Math.ceil(QUIZ.timeLeft);
            }
        }, 100);
    }

    function pauseGame() {
        if (QUIZ.timer) clearInterval(QUIZ.timer);
        const step = QUIZ.currentStep, q = QUIZ.currentQ;
        const ov = document.createElement('div'); ov.className = 'qz-pause-overlay';
        ov.innerHTML = `<h2>PAUSE</h2><button id="qz-res" style="width:200px;margin-bottom:10px">Reprendre</button><button class="ghost" id="qz-quit" style="width:200px">Quitter (abandonner)</button>`;
        $('#qz-main-area').appendChild(ov);
        QuizStorage.pauseGame(QUIZ.game.id, QUIZ.state).catch(console.error);
        $('#qz-res').onclick = () => { ov.remove(); QuizStorage.resumeGame(QUIZ.game.id, QUIZ.state).catch(console.error); if (step && q) resumeTimer(step, q); };
        $('#qz-quit').onclick = () => { if(confirm('Abandonner la partie ?')) { QuizEngine.abort(QUIZ.game.id, QUIZ.state); history.back(); } };
    }

    function showTieScreen() {
        $('#qz-main-area').innerHTML = `<div style="text-align:center;padding:40px 20px"><h2 style="font-size:40px;color:var(--gold);margin-bottom:10px">ÉGALITÉ !</h2><p style="font-size:18px">Il va falloir un <b>Tir au But</b> pour désigner le vainqueur.</p><button style="margin-top:30px;width:100%;max-width:300px" id="qz-start-tab">Commencer le Tir au But</button></div>`;
        $('#qz-start-tab').onclick = () => { QUIZ.state.level = 5; QUIZ.state.order = ['A', 'B']; QUIZ.state.order_idx = 0; loadNextStep(); };
    }

    async function endGame(winnerTeam) {
        if (QUIZ.timer) clearInterval(QUIZ.timer);
        if (QUIZ.wakeLock) QUIZ.wakeLock.release().catch(()=>{});
        await QuizEngine.finish(QUIZ.game.id, { game: QUIZ.game, players: QUIZ.players, state: QUIZ.state });
        await QuizEngine.awardEndTitles({ game: QUIZ.game, players: QUIZ.players, state: QUIZ.state });
        sound.fanfare(); showPodium();
    }

    function showPodium() {
        const winner = QUIZ.state.winner || (QUIZ.state.scores.A > QUIZ.state.scores.B ? 'A' : 'B');
        const wName = winner === 'A' ? QUIZ.game.class_a_name : QUIZ.game.class_b_name;
        const wColor = winner === 'A' ? '#3b82f6' : '#ef4444';
        const top3 = QUIZ.players.slice().sort((a,b) => b.points - a.points).slice(0, 3);
        showOverlay(`
            <div class="qz-game" id="qz-podium-box" style="background:radial-gradient(circle at 50% 30%, ${wColor}22, var(--bg) 70%)">
                <div class="qz-body" style="align-items:center;justify-content:center;text-align:center;">
                    <div style="font-size:60px;margin-bottom:10px">🏆</div>
                    <h2 style="font-family:var(--serif);font-size:32px;color:${wColor};margin:0">${esc(wName)}</h2>
                    <p style="font-size:16px;color:var(--mut);margin-top:5px">Grand Vainqueur</p>
                    <div class="card col" style="width:100%;max-width:400px;margin-top:30px;background:var(--card);border-color:${wColor};box-shadow:0 10px 30px ${wColor}44">
                        <h3 style="color:var(--gold);margin:0 0 15px;text-align:center">🌟 Meilleurs Buteurs</h3>
                        ${top3.map((p, i) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:20px;font-weight:900;color:var(--gold);width:24px">#${i+1}</span><span style="flex:1;font-weight:600">${esc(p.name)}</span><span style="font-size:14px;color:var(--mut)">${p.points} pts</span></div>`).join('')}
                    </div>
                    <div class="qz-btn-bottom" style="width:100%;max-width:400px;margin-top:30px;background:transparent;border:0">
                        <button onclick="OreaQuizUI.printCert()" class="ghost" style="border-color:var(--gold);color:var(--gold)">🖨️ Certificat</button>
                        <button onclick="history.back()">Terminer</button>
                    </div>
                </div>
            </div>`);
        startConfetti();
    }

    function printCert() {
        const winner = QUIZ.state.winner || (QUIZ.state.scores.A > QUIZ.state.scores.B ? 'A' : 'B');
        const wName = winner === 'A' ? QUIZ.game.class_a_name : QUIZ.game.class_b_name;
        const top3 = QUIZ.players.slice().sort((a,b) => b.points - a.points).slice(0, 3);
        const fastest = QUIZ.players.filter(p => p.correct_answers > 0).map(p => ({p, avg: p.correct_time_ms/p.correct_answers})).sort((a,b)=>a.avg-b.avg).slice(0,3);
        const win = window.open('', '_blank');
        win.document.write(`
            <html><head><title>Certificat - ORÉA École</title>
            <style>
                body{font-family:serif;text-align:center;background:#fffdf6;color:#111;padding:40px;margin:0}
                .cert{border:10px double #C7A34B;border-radius:20px;padding:40px;max-width:700px;margin:0 auto;position:relative}
                h1{color:#C7A34B;font-size:36px;margin-bottom:5px}
                h2{font-size:24px;margin-bottom:30px}
                .name{font-size:28px;font-weight:bold;color:#222;margin:10px 0;border-bottom:2px solid #C7A34B;display:inline-block;padding:0 20px}
                p{font-size:16px;line-height:1.6;color:#444}
                .grid{display:flex;justify-content:space-around;margin-top:30px;text-align:left}
                ul{padding-left:20px} li{font-size:18px;margin-bottom:5px}
                .sig{margin-top:50px;display:flex;justify-content:space-between}
                .sig div{border-top:1px solid #aaa;width:200px;padding-top:10px;font-size:14px;color:#666}
                @media print{body{padding:0} .cert{border-width:5px}}
            </style></head><body>
            <div class="cert">
                <h1>ORÉA École</h1><h2>Certificat du Génie en Herbe</h2>
                <p>Ce certificat est décerné à la classe de</p><div class="name">${wName}</div>
                <p>Pour sa brillante victoire lors du tournoi du ${new Date().toLocaleDateString('fr-FR')}.</p>
                <div class="grid">
                    <div><h3>🌟 Meilleurs Buteurs</h3><ul>${top3.map((p,i)=>`<li>${i+1}. ${p.name} (${p.points} pts)</li>`).join('')}</ul></div>
                    <div><h3>⚡ Les Plus Rapides</h3><ul>${fastest.map((p,i)=>`<li>${i+1}. ${p.p_name} (${(p.avg/1000).toFixed(1)}s)</li>`).join('')}</ul></div>
                </div>
                <div class="sig"><div>Le Directeur</div><div>L'Enseignant</div></div>
            </div>
            <script>setTimeout(()=>window.print(), 500);<\/script>
            </body></html>`);
        win.document.close();
    }

    window.OreaQuizUI = { injectCss, initAudio, sound, startConfetti, QUIZ, $, esc, sleep, openNewGame, printCert };
})();
