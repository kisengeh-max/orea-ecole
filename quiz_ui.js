/* =====================================================================
   ORÉA École v58 — quiz_ui.js (Livraison 4 : Banque + Import + Modération)
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
        audioCtx: null, wakeLock: null, ov: null, currentStep: null, currentQ: null,
        sel: null, deadline: 0, lastSec: -1, sc: { A: 0, B: 0 }, quitting: false, jokerUsedQ: false
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
        .qz-form select,.qz-form input,.qz-form textarea{width:100%;padding:14px;background:var(--bg);border:1px solid var(--line);border-radius:12px;color:var(--tx);font-size:15px;margin-bottom:10px;font-family:inherit}
        .qz-choices{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px}
        .qz-ch{flex:1;padding:12px;text-align:center;border:1px solid var(--line);border-radius:12px;font-weight:700;color:var(--mut);background:transparent;font-size:14px}
        .qz-ch.on{background:rgba(199,163,75,.15);border-color:var(--gold);color:var(--gold)}
        .qz-btn-bottom{position:sticky;bottom:0;padding:16px;background:var(--bg);border-top:1px solid var(--line);display:flex;gap:10px}
        .qz-btn-bottom button{flex:1;padding:16px;font-size:16px;border-radius:12px;font-weight:700}
        .qz-players{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .qz-pl-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px}
        .qz-pl-card label{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--tx);font-weight:500}
        .qz-pl-card input{width:auto;margin:0}
        .qz-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .qz-tm .qz-ch{padding:12px 4px;min-width:0}
        .qz-stock{font-size:12.5px;color:var(--mut);margin:-6px 0 12px}
        .qz-stock.warn{color:var(--bad);font-weight:600}
        .qz-pl-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px}
        .qz-pl-list{max-height:46vh;overflow-y:auto;padding-right:4px;-webkit-overflow-scrolling:touch}
        .qz-pl-list label{padding:7px 0;margin:0}
        .qz-pl-card input[type=checkbox]{width:20px;height:20px;flex-shrink:0}
        /* ===== ÉCRAN DE JEU ===== */
        .qz-game{--bg:#0a0a0f;--card:#15121f;--line:rgba(227,201,120,.28);--tx:#f6f1e3;--mut:#a89fbd;--gold:#E3C978;--ok:#3ddc84;--bad:#ff4d5e;--vio:#a78bfa;position:relative;overflow:hidden;display:flex;flex-direction:column;height:100%;color:var(--tx);background:radial-gradient(circle at 50% 0%,rgba(139,92,246,.16),transparent 55%),#0a0a0f}
        .qz-rays{position:absolute;inset:-25%;pointer-events:none;z-index:0;background:conic-gradient(from 0deg at 50% 22%,transparent 0 6%,rgba(227,201,120,.11) 9%,transparent 13% 27%,rgba(139,92,246,.13) 30%,transparent 34% 48%,rgba(227,201,120,.09) 51%,transparent 55% 70%,rgba(139,92,246,.11) 73%,transparent 77%);animation:qzRays 6s ease-in-out infinite alternate}
        .qz-bar{position:relative;z-index:2;display:flex;align-items:center;gap:12px;padding:calc(8px + env(safe-area-inset-top)) 14px 4px}
        .qz-bar b{flex:1;text-align:center;font-family:var(--serif);letter-spacing:.2em;font-size:12.5px;color:var(--gold)}
        .qz-hud{position:relative;z-index:2;display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:6px;padding:4px 12px 10px}
        .qz-side{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border-radius:14px;border:1px solid transparent;transition:all .25s;min-width:0}
        .qz-side.A .qz-tname{color:#60a5fa}
        .qz-side.B .qz-tname{color:#f87171}
        .qz-side.act{border-color:var(--gold);background:rgba(227,201,120,.06);box-shadow:0 0 18px rgba(227,201,120,.35)}
        .qz-tname{font-size:12px;font-weight:800;letter-spacing:.06em;text-align:center;line-height:1.15;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
        .qz-score{font-family:var(--serif);font-weight:900;font-size:clamp(44px,13vw,60px);line-height:1;color:var(--gold);text-shadow:0 0 16px rgba(227,201,120,.45)}
        .qz-score.bump{animation:qzBump .5s}
        .qz-mid{display:flex;flex-direction:column;align-items:center;gap:3px}
        .qz-lvl{font-size:13px;font-weight:800;letter-spacing:.14em;color:var(--gold);white-space:nowrap}
        .qz-lvlname{font-size:11px;color:var(--mut);text-align:center;max-width:120px;min-height:13px;line-height:1.2}
        .qz-timer{position:relative;width:96px;height:96px;display:flex;align-items:center;justify-content:center}
        .qz-timer svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
        .qz-timer circle{fill:none;stroke-width:6;stroke-linecap:round}
        .qz-timer .bg{stroke:rgba(227,201,120,.15)}
        .qz-timer .fg{stroke:var(--gold);transition:stroke-dashoffset .12s linear,stroke .3s;filter:drop-shadow(0 0 5px rgba(227,201,120,.6))}
        .qz-timer span{font-family:var(--serif);font-size:38px;font-weight:900;line-height:1;color:#ff3b4d;text-shadow:0 0 12px rgba(255,59,77,.5)}
        .qz-timer.low{animation:qzBlink .7s ease-in-out infinite}
        .qz-timer.low .fg{stroke:#ff3b4d}
        .qz-q-box{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
        .qz-q-box>.sk{margin:40px auto}
        .qz-qwrap{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 16px calc(14px + env(safe-area-inset-bottom));text-align:center;animation:qzFlip .3s ease}
        .qz-turn{font-size:12px;letter-spacing:.12em;color:var(--mut);font-weight:700}
        .qz-turn b{color:var(--tc);font-size:14px;margin-left:4px}
        .qz-who-p{font-size:15px;font-weight:800;color:var(--tx);margin-top:2px;letter-spacing:0}
        .qz-theme{font-size:11.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--vio);font-weight:700}
        .qz-qframe{width:100%;max-width:640px;border:2px solid var(--gold);border-radius:20px;padding:16px 14px;background:linear-gradient(180deg,rgba(227,201,120,.07),rgba(139,92,246,.06));box-shadow:0 0 24px rgba(227,201,120,.18),inset 0 0 18px rgba(0,0,0,.4)}
        .qz-question{font-family:var(--serif);font-size:clamp(18px,5.2vw,24px);font-weight:700;line-height:1.3}
        .qz-choices-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:640px}
        .qz-ans{min-height:68px;padding:10px;border-radius:14px;border:2px solid var(--gold);background:linear-gradient(180deg,rgba(227,201,120,.14),rgba(227,201,120,.04));color:var(--tx);font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;text-align:left;cursor:pointer;transition:transform .15s,box-shadow .2s,background .2s;-webkit-tap-highlight-color:transparent}
        .qz-ans span{width:28px;height:28px;border-radius:50%;background:var(--gold);color:#1a1303;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0}
        .qz-ans em{font-style:normal;flex:1;min-width:0;word-break:break-word;line-height:1.2}
        .qz-ans.sel{border-color:var(--vio);background:rgba(139,92,246,.22);box-shadow:0 0 0 2px rgba(139,92,246,.5),0 0 22px rgba(139,92,246,.7);transform:scale(1.02)}
        .qz-ans.sel span{background:var(--vio);color:#120a2a}
        .qz-ans.locked{pointer-events:none}
        .qz-ans.disabled{pointer-events:none;opacity:.15}
        .qz-ans.correct{background:rgba(61,220,132,.2);border-color:var(--ok);box-shadow:0 0 22px rgba(61,220,132,.6);animation:qzPop .35s}
        .qz-ans.correct span{background:var(--ok);color:#04210f}
        .qz-ans.wrong{background:rgba(255,77,94,.18);border-color:var(--bad);box-shadow:0 0 22px rgba(255,77,94,.55);animation:qzShake .4s}
        .qz-ans.wrong span{background:var(--bad);color:#fff}
        .qz-validate{width:100%;max-width:640px;padding:15px;border-radius:14px;border:0;font-size:16px;font-weight:800;letter-spacing:.06em;color:#1a1303;background:linear-gradient(180deg,#f3de93,#c7a34b);box-shadow:0 4px 16px rgba(199,163,75,.4)}
        .qz-validate:disabled{opacity:.3;box-shadow:none}
        .qz-jokers{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .qz-jk{padding:10px 16px;background:transparent;border:1px solid var(--gold);border-radius:20px;font-size:13px;font-weight:700;color:var(--gold)}
        .qz-jk:disabled{opacity:.3;border-color:var(--line);color:var(--mut)}
        .qz-exp{position:absolute;inset:0;background:rgba(5,5,10,.88);backdrop-filter:blur(4px);z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;animation:qzFade .3s}
        .qz-exp-box{background:var(--card);padding:24px;border-radius:16px;max-width:400px;width:100%;border:1px solid var(--gold);box-shadow:0 10px 30px rgba(0,0,0,.6)}
        .qz-exp-box h3{margin-top:0;font-size:20px}
        .qz-exp-box p{font-size:16px;line-height:1.5;color:var(--tx)}
        .qz-pause-overlay{position:absolute;inset:0;background:rgba(5,5,10,.97);z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .qz-pause-overlay h2{font-size:32px;color:var(--gold);margin-bottom:20px;letter-spacing:.2em}
        .qz-flash{position:absolute;inset:0;z-index:30;pointer-events:none;animation:qzFlash .7s ease-out forwards}
        .qz-flash.ok{background:radial-gradient(circle,rgba(61,220,132,.55),rgba(61,220,132,.15) 60%,transparent)}
        .qz-flash.bad{background:radial-gradient(circle,rgba(255,77,94,.55),rgba(255,77,94,.15) 60%,transparent)}
        .qz-jkc{align-self:center;font-size:13px;font-weight:700;color:var(--gold)}
        .qz-note{font-size:12px;color:var(--mut)}
        .qz-pts{color:var(--gold);font-weight:800;font-size:18px;margin:4px 0}
        .qz-intro{justify-content:center;gap:14px}
        .qz-intro-k{font-size:14px;letter-spacing:.3em;color:var(--gold);font-weight:800}
        .qz-intro-t{font-family:var(--serif);font-size:clamp(26px,8vw,38px);font-weight:900;color:var(--tx);text-shadow:0 0 18px rgba(227,201,120,.5)}
        .qz-intro ul{list-style:none;padding:0;margin:0 0 8px;display:flex;flex-direction:column;gap:8px;color:var(--mut);font-size:16px}
        .qz-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:640px}
        .qz-opt{min-height:96px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;border:2px solid var(--gold);border-radius:16px;background:linear-gradient(180deg,rgba(227,201,120,.14),rgba(227,201,120,.04));font-weight:800;font-size:16px;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .qz-opt:active{border-color:var(--vio);box-shadow:0 0 22px rgba(139,92,246,.7)}
        .qz-opt.myst{border-color:var(--vio);background:rgba(139,92,246,.18)}
        .qz-admin-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px}
        .qz-admin-tbl th,.qz-admin-tbl td{border:1px solid var(--line);padding:8px;text-align:center}
        .qz-admin-tbl th{background:rgba(227,201,120,.1);color:var(--gold)}
        .qz-admin-tbl td.ok{color:var(--ok);font-weight:700}
        .qz-admin-tbl td.low{color:var(--bad);font-weight:700}
        @keyframes qzPop{0%{transform:scale(.95)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
        @keyframes qzShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes qzFade{from{opacity:0}to{opacity:1}}
        @keyframes qzFlip{from{opacity:0;transform:perspective(800px) rotateX(-18deg) scale(.94)}to{opacity:1;transform:none}}
        @keyframes qzBump{0%{transform:scale(1)}40%{transform:scale(1.3)}100%{transform:scale(1)}}
        @keyframes qzBlink{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes qzRays{from{opacity:.5;transform:rotate(-4deg) scale(1)}to{opacity:1;transform:rotate(4deg) scale(1.08)}}
        @keyframes qzFlash{from{opacity:1}to{opacity:0}}
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
          if (QUIZ.state && QUIZ.state.level > 0 && !QUIZ.quitting && !confirm('Quitter le quiz en cours ? La partie sera perdue.')) {
              history.pushState({ qz: 1 }, ''); return;
          }
          closeQuiz();
      }
  });

  function closeQuiz() {
      if (QUIZ.timer) { clearInterval(QUIZ.timer); QUIZ.timer = null; }
      if (QUIZ.wakeLock) { QUIZ.wakeLock.release().catch(()=>{}); QUIZ.wakeLock = null; }
      if (QUIZ.ov) { QUIZ.ov.remove(); QUIZ.ov = null; }
      QUIZ.game = null; QUIZ.players = []; QUIZ.state = null; QUIZ.quitting = false;
      document.body.style.overflow = '';
  }

  async function keepAwake() {
      try { if ('wakeLock' in navigator) QUIZ.wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
  }

  /* =========================================================
     BANQUE DE QUESTIONS (admin)
     ========================================================= */
  
  function openBank() {
      showOverlay(`
          <div class="qz-head">
              <button class="qz-btn-icon" onclick="history.back()">←</button>
              <b>Banque de questions</b>
          </div>
          <div class="qz-body" style="padding-bottom:0">
              <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
                  <button class="ghost" style="flex:1" onclick="OreaQuizUI.openImport()">📥 Importer du JSON</button>
                  <button class="ghost" style="flex:1" onclick="OreaQuizUI.openReports()">🚩 Signalements</button>
              </div>
              <div id="qz-stock-area" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px;overflow-x:auto">
                  <p style="text-align:center;color:var(--mut);margin:0">Chargement du stock...</p>
              </div>
              <div style="font-size:12px;color:var(--mut);line-height:1.4">
                  <p><b>Gabarit JSON attendu :</b></p>
                  <pre style="background:var(--bg);padding:10px;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-all">{ "niveau_scolaire": "secondaire",
"questions": [
  { "matiere": "Géographie", "theme": "Hydrographie", "niveau_difficulte": 1,
    "question": "Quel est le plus long fleuve de la RDC ?",
    "choix": ["Le Congo", "Le Kasaï", "L'Ubangi", "Le Lualaba"],
    "bonne_reponse": 0,
    "explication": "Le fleuve Congo traverse le pays." } ] }</pre>
                  <p>Limite : 4 choix distincts, difficulté 1-3, niveau "primaire" ou "secondaire".</p>
              </div>
          </div>
      `);
      loadStockAdmin();
  }

  async function loadStockAdmin() {
      const area = $('#qz-stock-area');
      if (!area) return;
      try {
          const data = await db.rpc('quiz_stock');
          if (data.error) throw data.error;
          const stock = data.data;
          const levels = ['primaire', 'secondaire'];
          const diffs = [1, 2, 3];
          let html = `<h3 style="margin-top:0;color:var(--gold);text-align:center;font-size:16px">Stock actuel (Objectif: 2000/case)</h3>`;
          html += `<table class="qz-admin-tbl"><tr><th>Niveau</th><th>Diff 1</th><th>Diff 2</th><th>Diff 3</th></tr>`;
          levels.forEach(lvl => {
              html += `<tr><td style="text-transform:capitalize">${lvl}</td>`;
              diffs.forEach(d => {
                  const key = `${lvl}|${d}`;
                  const n = (stock.by_level && stock.by_level[key]) ? stock.by_level[key].n : 0;
                  let cls = n >= 2000 ? 'ok' : (n < 100 ? 'low' : '');
                  html += `<td class="${cls}">${n}</td>`;
              });
              html += `</tr>`;
          });
          html += `</table>`;
          
          if (stock.by_matiere && Object.keys(stock.by_matiere).length > 0) {
              html += `<h4 style="margin:15px 0 5px;color:var(--gold);font-size:14px;text-align:center">Par matière</h4>`;
              html += `<table class="qz-admin-tbl"><tr><th>Matière</th><th>Total</th></tr>`;
              Object.values(stock.by_matiere).sort((a,b) => b.n - a.n).forEach(m => {
                  html += `<tr><td style="text-align:left">${esc(m.matiere)}</td><td>${m.n}</td></tr>`;
              });
              html += `</table>`;
          }
          area.innerHTML = html;
      } catch (e) {
          area.innerHTML = `<p style="color:var(--bad);text-align:center;margin:0">Erreur de chargement du stock : ${esc(e.message)}</p>`;
      }
  }

  function openImport() {
      let parsedData = null;
      showOverlay(`
          <div class="qz-head"><button class="qz-btn-icon" onclick="history.back()">←</button><b>Importer des questions</b></div>
          <div class="qz-body qz-form">
              <label>1. Choisir un fichier .json</label>
              <input type="file" id="qz-file" accept=".json,application/json" style="padding:10px;background:var(--card)">
              
              <label>OU coller le JSON ici :</label>
              <textarea id="qz-json-text" rows="6" placeholder='{"niveau_scolaire":"secondaire", "questions":[...]}'></textarea>
              
              <button class="ghost" id="qz-btn-preview" style="margin-bottom:15px">Analyser le JSON</button>
              
              <div id="qz-preview-area" hidden style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:15px">
                  <h4 style="margin-top:0;color:var(--gold)">Aperçu</h4>
                  <div id="qz-preview-content"></div>
              </div>
              
              <div id="qz-import-actions" hidden>
                  <button id="qz-btn-do-import" style="width:100%;padding:15px;font-size:16px;font-weight:800;background:var(--gold);color:#111;border:0;border-radius:12px">Lancer l'importation</button>
              </div>
          </div>
      `);

      $('#qz-file').onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => { $('#qz-json-text').value = ev.target.result; };
          reader.readAsText(file);
      };

      $('#qz-btn-preview').onclick = () => {
          const txt = $('#qz-json-text').value.trim();
          if (!txt) return alert('Collez ou chargez un fichier JSON d\'abord.');
          
          let raw;
          try { raw = JSON.parse(txt); } catch (err) { return alert('JSON invalide. Vérifiez la syntaxe.\n\n' + err.message); }
          
          const defNiveau = raw.niveau_scolaire || 'secondaire';
          let list = Array.isArray(raw) ? raw : (raw.questions || []);
          
          if (!Array.isArray(list) || list.length === 0) return alert('Aucune question trouvée dans le JSON.');
          
          const valid = [];
          const seenHashes = new Set();
          const errors = { manque_champ: 0, choix_invalides: 0, mauvaise_reponse: 0, difficulte_invalide: 0, question_longue: 0, niveau_invalide: 0, interdit: 0, doublon_interne: 0 };
          
          list.forEach((q, idx) => {
              const errLine = `Ligne ${idx+1} : `;
              const n = (q.niveau_scolaire || defNiveau).toLowerCase();
              if (!['primaire','secondaire'].includes(n)) { errors.niveau_invalide++; return; }
              const diff = parseInt(q.niveau_difficulte, 10);
              if (isNaN(diff) || diff < 1 || diff > 3) { errors.difficulte_invalide++; return; }
              if (!q.question || typeof q.question !== 'string') { errors.manque_champ++; return; }
              if (q.question.length > 250) { errors.question_longue++; return; }
              if (!Array.isArray(q.choix) || q.choix.length !== 4) { errors.choix_invalides++; return; }
              const choicesClean = q.choix.map(c => String(c || '').trim());
              if (choicesClean.some(c => c === '')) { errors.choix_invalides++; return; }
              if (new Set(choicesClean).size < 4) { errors.choix_invalides++; return; }
              const br = parseInt(q.bonne_reponse, 10);
              if (isNaN(br) || br < 0 || br > 3) { errors.mauvaise_reponse++; return; }
              
              const lowerAll = choicesClean.map(c => c.toLowerCase());
              if (lowerAll.some(c => c.includes('toutes les réponses') || c.includes('aucune de ces réponses') || c.includes('toutes ces réponses'))) {
                  errors.interdit++; return;
              }
              
              const hash = hashString(n + '|' + q.question);
              if (seenHashes.has(hash)) { errors.doublon_interne++; return; }
              seenHashes.add(hash);
              
              valid.push({
                  niveau_scolaire: n,
                  matiere: String(q.matiere || '').trim(),
                  theme: String(q.theme || '').trim(),
                  niveau_difficulte: diff,
                  question: q.question.trim(),
                  choix: choicesClean,
                  bonne_reponse: br,
                  explication: String(q.explication || '').trim(),
                  _hash: hash
              });
          });

          if (valid.length === 0) {
              $('#qz-preview-content').innerHTML = `<p style="color:var(--bad)">Aucune question valide trouvée. Vérifiez le format.</p>`;
              $('#qz-preview-area').hidden = false;
              $('#qz-import-actions').hidden = true;
              return;
          }

          parsedData = { valid, errors, total: list.length };
          
          let errHtml = '';
          Object.keys(errors).forEach(k => {
              if (errors[k] > 0) {
                  const label = { manque_champ:'Champs manquants', choix_invalides:'Choix invalides', mauvaise_reponse:'Bonne réponse incorrecte', difficulte_invalide:'Difficulté invalide (1-3)', question_longue:'Question > 250 car.', niveau_invalide:'Niveau scolaire invalide', interdit:'Mention "toutes les réponses"', doublon_interne:'Doublons dans le lot' }[k];
                  errHtml += `<li>${label} : ${errors[k]}</li>`;
              }
          });

          $('#qz-preview-content').innerHTML = `
              <p><b>${list.length}</b> question(s) lue(s).</p>
              <p style="color:var(--ok);font-weight:bold">${valid.length} prête(s) à être importée(s).</p>
              ${errHtml ? `<p style="color:var(--bad)">Rejetées :</p><ul style="margin-top:0;font-size:13px">${errHtml}</ul>` : ''}
              <p style="font-size:12px;color:var(--mut);margin-bottom:0">Les doublons (même question pour le même niveau) seront ignorés automatiquement par la base.</p>
          `;
          $('#qz-preview-area').hidden = false;
          $('#qz-import-actions').hidden = false;
      };

      $('#qz-btn-do-import').onclick = async e => {
          if (!parsedData || parsedData.valid.length === 0) return;
          const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Envoi en cours...';
          const lots = [];
          for (let i = 0; i < parsedData.valid.length; i += 200) lots.push(parsedData.valid.slice(i, i + 200));
          
          let totalIns = 0, totalDup = 0, errStr = '';
          
          for (let i = 0; i < lots.length; i++) {
              btn.textContent = `Envoi lot ${i+1}/${lots.length}...`;
              const lotClean = lots[i].map(q => { const { _hash, ...rest } = q; return rest; });
              try {
                  const { data, error } = await db.rpc('quiz_import', { p_rows: lotClean });
                  if (error) throw error;
                  totalIns += data.inserted || 0;
                  totalDup += data.duplicates || 0;
              } catch (err) { errStr += `Erreur lot ${i+1}: ${err.message}\n`; }
          }
          
          btn.textContent = 'Lancer l\'importation'; btn.disabled = false;
          if (errStr) alert('Importation terminée avec des erreurs :\n\n' + errStr);
          
          $('#qz-preview-content').innerHTML = `<h4 style="color:var(--ok)">Terminé !</h4>
              <p>Nouvelles questions ajoutées : <b>${totalIns}</b></p>
              <p>Doublons ignorés : <b>${totalDup}</b></p>`;
          $('#qz-import-actions').hidden = true;
          loadStockAdmin(); // Refresh stock in background
      };
  }

  function hashString(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); }
      return h.toString(16);
  }

  async function openReports() {
      showOverlay(`
          <div class="qz-head"><button class="qz-btn-icon" onclick="history.back()">←</button><b>Signalements</b></div>
          <div class="qz-body" id="qz-reports-list">
              <p style="text-align:center;color:var(--mut)">Chargement...</p>
          </div>
      `);
      
      try {
          const { data, error } = await db.from('quiz_reports')
              .select('id, created_at, motif, commentaire, quiz_questions(id, question, choix, bonne_reponse, explication, est_active)')
              .order('created_at', { ascending: false });
              
          if (error) throw error;
          
          const list = $('#qz-reports-list');
          if (!data || data.length === 0) {
              list.innerHTML = `<p style="text-align:center;color:var(--mut)">Aucun signalement pour l'instant.</p>`;
              return;
          }
          
          list.innerHTML = data.map(r => {
              const q = r.quiz_questions;
              if (!q) return '';
              const d = new Date(r.created_at).toLocaleDateString('fr-FR');
              return `<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
                  <div style="font-size:11px;color:var(--mut);margin-bottom:6px">Signalé le ${d} (${r.motif})</div>
                  <div style="font-weight:bold;font-size:15px;margin-bottom:8px">${esc(q.question)}</div>
                  <div style="font-size:13px;color:var(--ok);margin-bottom:8px">Rép. : ${esc(Array.isArray(q.choix) ? q.choix[q.bonne_reponse] : '')}</div>
                  <div style="display:flex;gap:8px;margin-top:10px">
                      ${!q.est_active ? `<button class="ghost" style="flex:1;border-color:var(--ok);color:var(--ok)" onclick="OreaQuizUI.restoreQ('${q.id}')">Restaurer</button>` : ''}
                      <button class="ghost" style="flex:1;border-color:var(--bad);color:var(--bad)" onclick="OreaQuizUI.deleteQ('${q.id}')">Supprimer</button>
                      <button class="ghost" style="flex:1" onclick="OreaQuizUI.editQ('${q.id}')">Modifier</button>
                  </div>
              </div>`;
          }).join('');
          
      } catch (e) {
          $('#qz-reports-list').innerHTML = `<p style="color:var(--bad);text-align:center">Erreur : ${esc(e.message)}</p>`;
      }
  }

  async function restoreQ(id) {
      if (!confirm('Remettre cette question dans la banque active ?')) return;
      try {
          await db.rpc('quiz_restore', { p_id: id });
          alert('Question restaurée.');
          openReports();
      } catch (e) { alert('Erreur : ' + e.message); }
  }

  async function deleteQ(id) {
      if (!confirm('Supprimer DÉFINITIVEMENT cette question de la base de données ?')) return;
      try {
          await db.rpc('quiz_delete', { p_id: id });
          alert('Question supprimée.');
          openReports();
      } catch (e) { alert('Erreur : ' + e.message); }
  }

  async function editQ(id) {
      alert('Fonctionnalité de modification en cours de développement.');
                            }
       /* =========================================================
       FIN BANQUE / REPRISE DU JEU
       ========================================================= */

    async function openNewGame() {
        initAudio();
        showOverlay(`<div class="qz-head"><button class="qz-btn-icon" onclick="history.back()">←</button><b>Nouvelle partie</b></div><div class="qz-body qz-form" id="qz-cfg-body"><p style="text-align:center;color:var(--mut)">Chargement...</p></div>`);

        const classes = S.classes.filter(c => cy(c) === S.year).sort(classSort);
        if (classes.length < 2) {
            $('#qz-cfg-body').innerHTML = `<p class="empty">Il faut au moins 2 classes pour lancer une partie.</p><button class="ghost" style="margin-top:10px" onclick="history.back()">Retour</button>`;
            return;
        }

        // Bouton Banque visible uniquement si directeur
        const isDir = typeof dir === 'function' && dir();
        const bankBtnHtml = isDir ? `<div style="margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid var(--line)"><button class="ghost" onclick="OreaQuizUI.openBank()" style="width:100%;border-color:var(--gold);color:var(--gold)">🗂 Banque de questions</button></div>` : '';

        $('#qz-cfg-body').innerHTML = `
            ${bankBtnHtml}
            <label>Niveau scolaire</label>
            <div class="qz-choices" id="qz-lvl"><button class="qz-ch" data-v="primaire">Primaire</button><button class="qz-ch on" data-v="secondaire">Secondaire</button></div>
            <div id="qz-stock" class="qz-stock"></div>
            <div class="qz-grid2">
                <div><label>Équipe A (classe)</label><select id="qz-cls-a">${classes.map((c, i) => `<option value="${esc(c.id)}" ${i === 0 ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
                <div><label>Équipe B (classe)</label><select id="qz-cls-b">${classes.map((c, i) => `<option value="${esc(c.id)}" ${i === 1 ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            </div>
            <label>Chronomètre par question</label>
            <div class="qz-choices qz-tm" id="qz-tm">${[15, 30, 45, 60, 90].map(v => `<button class="qz-ch${v === 60 ? ' on' : ''}" data-v="${v}">${v} s</button>`).join('')}</div>
            <label for="qz-tm-in">Ou durée personnalisée (5 à 180 s)</label>
            <input type="number" id="qz-tm-in" min="5" max="180" step="1" inputmode="numeric" value="60">
            <div id="qz-pl-area"></div>
            <div class="qz-btn-bottom"><button id="qz-start" disabled>Lancer le Quiz</button></div>
        `;

        let niveau = 'secondaire';
        const tmOk = () => { const n = Math.round(+$('#qz-tm-in').value); return n >= 5 && n <= 180 ? n : null; };

        function refresh() {
            const btn = $('#qz-start'); if (!btn) return;
            const a = document.querySelectorAll('.plA:checked').length, b = document.querySelectorAll('.plB:checked').length;
            document.querySelectorAll('.plA').forEach(i => { i.disabled = !i.checked && a >= 5; });
            document.querySelectorAll('.plB').forEach(i => { i.disabled = !i.checked && b >= 5; });
            const ca = $('#qz-cnt-A'), cb = $('#qz-cnt-B');
            if (ca) ca.textContent = a + '/5'; if (cb) cb.textContent = b + '/5';
            btn.disabled = !(a === 5 && b === 5 && tmOk() !== null);
        }

        function syncTm() {
            const n = tmOk();
            [...$('#qz-tm').children].forEach(b => b.classList.toggle('on', n !== null && +b.dataset.v === n));
            refresh();
        }

        async function loadStock() {
            const el = $('#qz-stock'); if (!el) return;
            el.className = 'qz-stock'; el.textContent = 'Lecture de la banque de questions...';
            try {
                const { count, error } = await db.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('niveau_scolaire', niveau).eq('est_active', true);
                if (error) throw error;
                const n = count || 0;
                el.textContent = n < 60 ? `⚠ Banque ${niveau} : seulement ${n} question(s). La partie risque de s'arrêter faute de questions.` : `Banque ${niveau} : ${n} questions disponibles`;
                el.className = 'qz-stock' + (n < 60 ? ' warn' : '');
            } catch (_) { el.textContent = ''; }
        }

        $('#qz-lvl').onclick = e => {
            const b = e.target.closest('.qz-ch'); if (!b) return;
            [...$('#qz-lvl').children].forEach(x => x.classList.remove('on')); b.classList.add('on');
            niveau = b.dataset.v; loadStock();
        };
        $('#qz-tm').onclick = e => { const b = e.target.closest('.qz-ch'); if (!b) return; $('#qz-tm-in').value = b.dataset.v; syncTm(); };
        $('#qz-tm-in').oninput = syncTm;

        function playerCard(cls, students, team, color) {
            const warn = students.length < 5 ? `<p class="due" style="font-size:12px;margin:0 0 6px">Cette classe a moins de 5 élèves.</p>` : '';
            return `<div class="qz-pl-card">
                <div class="qz-pl-head"><b style="color:${color}">${esc(cls.name)}</b><span id="qz-cnt-${team}" style="color:var(--gold)">0/5</span></div>
                ${warn}
                <div class="qz-pl-list">${students.map(s => `<label><input type="checkbox" class="pl${team}" value="${esc(s.id)}" data-n="${esc(s.name)}"> ${esc(s.name)}</label>`).join('')}</div>
            </div>`;
        }

        function renderPlayers() {
            const ca = S.classes.find(c => c.id === $('#qz-cls-a').value);
            const cb = S.classes.find(c => c.id === $('#qz-cls-b').value);
            if (!ca || !cb || ca.id === cb.id) {
                $('#qz-pl-area').innerHTML = `<p class="due" style="text-align:center">Choisissez deux classes différentes.</p>`;
                refresh(); return;
            }
            const stA = S.stu.filter(s => s.class_id === ca.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            const stB = S.stu.filter(s => s.class_id === cb.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            $('#qz-pl-area').innerHTML = `<div class="qz-players">${playerCard(ca, stA, 'A', '#3b82f6')}${playerCard(cb, stB, 'B', '#ef4444')}</div>
                <p style="font-size:12px;color:var(--mut);margin-top:8px;text-align:center">Sélectionnez 5 élèves par équipe.</p>`;
            $('#qz-pl-area').onchange = refresh;
            refresh();
        }

        $('#qz-cls-a').onchange = renderPlayers;
        $('#qz-cls-b').onchange = renderPlayers;
        renderPlayers(); loadStock();

        $('#qz-start').onclick = async e => {
            const btn = e.currentTarget, timer = tmOk();
            if (timer === null) return;
            btn.textContent = 'Préparation...'; btn.disabled = true;
            try {
                const ca = S.classes.find(c => c.id === $('#qz-cls-a').value);
                const cb = S.classes.find(c => c.id === $('#qz-cls-b').value);
                const plA = [...document.querySelectorAll('.plA:checked')].map(i => ({ id: i.value, name: i.dataset.n }));
                const plB = [...document.querySelectorAll('.plB:checked')].map(i => ({ id: i.value, name: i.dataset.n }));
                const res = await QuizEngine.createGame({ school_id: S.school.id, created_by: S.me.id, niveau_scolaire: niveau, timer_seconds: timer, class_a: ca, class_b: cb, team_a_players: plA, team_b_players: plB });
                QUIZ.game = res.game; QUIZ.players = res.players; QUIZ.state = res.game.state; startGameScreen();
            } catch (err) { alert(err.message); btn.textContent = 'Lancer le Quiz'; refresh(); }
        };
    }

    const LEVEL_NAMES = { 1: 'Très facile', 2: 'Thématique', 3: 'Élimination directe', 4: 'Finale', 5: 'Tir au but' };
    const TEAM_COL = { A: '#60a5fa', B: '#f87171' };
    const sideHtml = (t, name) => `<div class="qz-side ${t}" id="qz-h-${t.toLowerCase()}"><div class="qz-tname">${esc(String(name).toUpperCase())}</div><div class="qz-score" id="qz-sc-${t.toLowerCase()}">0</div></div>`;

    async function startGameScreen() {
        if (QUIZ.game.status !== 'en_cours') QUIZ.game.status = 'en_cours';
        QUIZ.sc = { A: 0, B: 0 }; QUIZ.quitting = false;
        showOverlay(`
            <div class="qz-game">
                <div class="qz-rays"></div>
                <div class="qz-bar"><button class="qz-btn-icon" id="qz-btn-pause" aria-label="Pause">⏸</button><b>GÉNIE EN HERBE</b><button class="qz-btn-icon" id="qz-btn-snd">${QUIZ.soundOn ? '🔊' : '🔇'}</button></div>
                <div class="qz-hud">
                    ${sideHtml('A', QUIZ.game.class_a_name)}
                    <div class="qz-mid">
                        <div class="qz-timer" id="qz-timer"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="40"></circle><circle class="fg" cx="50" cy="50" r="40" id="qz-circle" stroke-dasharray="251.2" stroke-dashoffset="0"></circle></svg><span id="qz-txt-time">${QUIZ.game.timer_seconds}</span></div>
                        <div class="qz-lvl" id="qz-h-lvl">NIVEAU 1</div>
                        <div class="qz-lvlname" id="qz-h-name"></div>
                    </div>
                    ${sideHtml('B', QUIZ.game.class_b_name)}
                </div>
                <div class="qz-q-box" id="qz-main-area"><div class="sk" style="width:80%;height:80px"></div></div>
            </div>
        `);
        keepAwake();
        $('#qz-btn-pause').onclick = pauseGame;
        $('#qz-btn-snd').onclick = e => { QUIZ.soundOn = !QUIZ.soundOn; localStorage.setItem('orea_quiz_sound', QUIZ.soundOn ? 'on' : 'off'); e.currentTarget.textContent = QUIZ.soundOn ? '🔊' : '🔇'; };
        loadNextStep();
    }

    function updateScores() {
        if (!QUIZ.state) return;
        ['A', 'B'].forEach(t => {
            const el = $('#qz-sc-' + t.toLowerCase()); if (!el) return;
            const v = QUIZ.state.scores[t];
            if (QUIZ.sc[t] !== v) { QUIZ.sc[t] = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
            el.textContent = v;
        });
        const n = QUIZ.state.level;
        const l = $('#qz-h-lvl'); if (l) l.textContent = n === 5 ? 'TIR AU BUT' : 'NIVEAU ' + n;
        const nm = $('#qz-h-name'); if (nm) nm.textContent = n === 5 ? '' : (LEVEL_NAMES[n] || '');
    }

    const INTROS = {
        1: ['NIVEAU 1', 'Très facile', ['10 questions · 1 point chacune', 'Les équipes répondent à tour de rôle : A, B, A, B…']],
        2: ['NIVEAU 2', 'Thématique', ['Chaque équipe choisit son thème', '7 questions par équipe · 2 points chacune']],
        3: ['NIVEAU 3', 'Élimination directe', ['10 questions · 2 points chacune', 'Un joueur à la fois', 'Une mauvaise réponse = joueur éliminé']],
        4: ['NIVEAU 4', 'Finale', ['10 questions · 5 points chacune', 'Un joker utilisé ramène la question à 3 points']]
    };

    function showIntro(n) {
        const it = INTROS[n] || ['NIVEAU ' + n, '', []];
        updateScores();
        ['#qz-h-a', '#qz-h-b'].forEach(s => $(s).classList.remove('act'));
        QUIZ.timeLeft = QUIZ.game.timer_seconds; paintTimer();
        $('#qz-main-area').innerHTML = `<div class="qz-qwrap qz-intro"><div class="qz-intro-k">${it[0]}</div><div class="qz-intro-t">${esc(it[1].toUpperCase())}</div><ul>${it[2].map(l => `<li>${esc(l)}</li>`).join('')}</ul><button class="qz-validate" id="qz-go">COMMENCER</button></div>`;
        $('#qz-go').onclick = loadNextStep;
        sound.fanfare();
    }

    function showThemePicker(options) {
        const picks = {}, main = $('#qz-main-area');
        const stepPick = team => {
            const avail = options.filter(o => !Object.values(picks).includes(o.id));
            const name = team === 'A' ? QUIZ.game.class_a_name : QUIZ.game.class_b_name;
            $('#qz-h-a').classList.toggle('act', team === 'A'); $('#qz-h-b').classList.toggle('act', team === 'B');
            main.innerHTML = `<div class="qz-qwrap"><div class="qz-turn" style="--tc:${TEAM_COL[team]}">CHOIX DU THÈME · ÉQUIPE <b>${esc(String(name).toUpperCase())}</b></div><div class="qz-opts">${avail.map(o => `<div class="qz-opt${o.mystery ? ' myst' : ''}" role="button" data-id="${o.id}">${o.mystery ? '🎁 THÈME MYSTÈRE' : esc(o.label)}</div>`).join('')}</div></div>`;
            main.querySelectorAll('.qz-opt').forEach(el => { el.onclick = () => { picks[team] = el.dataset.id; if (team === 'A') stepPick('B'); else confirmThemes(); }; });
        };
        async function confirmThemes() {
            main.innerHTML = `<div class="sk" style="width:80%;height:80px"></div>`;
            try { await QuizEngine.setThemes({ game: QUIZ.game, players: QUIZ.players, state: QUIZ.state }, picks); loadNextStep(); }
            catch (e) {
                main.innerHTML = `<p class="due" style="text-align:center;padding:20px">Erreur : ${esc(e.message)}</p><button class="ghost" id="qz-retry" style="margin:10px auto 0;display:block">Choisir à nouveau</button>`;
                $('#qz-retry').onclick = () => { delete picks.A; delete picks.B; stepPick('A'); };
            }
        }
        stepPick('A');
    }

    async function loadNextStep() {
        const main = $('#qz-main-area');
        main.innerHTML = `<div class="sk" style="width:80%;height:80px"></div>`;
        try {
            const step = await QuizEngine.nextQuestion({ game: QUIZ.game, players: QUIZ.players, state: QUIZ.state });
            if (step.finished) return endGame(step.winner);
            if (step.tie) return showTieScreen();
            if (step.error) throw new Error(step.error);
            if (step.intro) return showIntro(step.intro);
            if (step.needThemes) { updateScores(); return showThemePicker(step.options); }
            updateScores(); renderQuestion(step);
        } catch (e) { main.innerHTML = `<p class="due" style="text-align:center;padding:20px">Erreur : ${esc(e.message)}</p><button class="ghost" style="margin:10px auto 0;display:block" onclick="history.back()">Quitter</button>`; }
    }

    function paintTimer() {
        const tm = QUIZ.game.timer_seconds, c = $('#qz-circle'), t = $('#qz-txt-time'), box = $('#qz-timer');
        const pct = Math.max(0, Math.min(1, QUIZ.timeLeft / tm));
        if (c) c.style.strokeDashoffset = 251.2 * (1 - pct);
        if (t) t.textContent = Math.ceil(Math.max(0, QUIZ.timeLeft));
        if (box) box.classList.toggle('low', QUIZ.timeLeft <= 10);
    }

    function runTimer(step, q) {
        if (QUIZ.timer) clearInterval(QUIZ.timer);
        QUIZ.timer = setInterval(() => {
            QUIZ.timeLeft = (QUIZ.deadline - Date.now()) / 1000;
            if (QUIZ.timeLeft <= 0) { clearInterval(QUIZ.timer); QUIZ.timeLeft = 0; paintTimer(); submitAnswer(-1, step, q); return; }
            paintTimer();
            const s = Math.ceil(QUIZ.timeLeft);
            if (s !== QUIZ.lastSec) { QUIZ.lastSec = s; if (s <= 5) sound.tick(); }
        }, 100);
    }

    function setSel(i) {
        if (QUIZ.isAnswering) return;
        const el = $(`#qz-grid .qz-ans[data-i="${i}"]`);
        if (!el || el.classList.contains('disabled')) return;
        QUIZ.sel = i;
        $('#qz-grid').querySelectorAll('.qz-ans').forEach(x => x.classList.toggle('sel', x === el));
        const ok = $('#qz-ok'); if (ok) ok.disabled = false;
        playTone(600, 'sine', 0.05, 0.05);
    }

    function flash(ok) {
        const g = document.querySelector('.qz-game'); if (!g) return;
        const f = document.createElement('div'); f.className = 'qz-flash ' + (ok ? 'ok' : 'bad');
        g.appendChild(f); setTimeout(() => f.remove(), 800);
    }

    function renderQuestion(step) {
        QUIZ.currentStep = step; QUIZ.currentQ = step.q; QUIZ.sel = null; QUIZ.isAnswering = false; QUIZ.jokerUsedQ = false;
        const q = step.q, tm = QUIZ.game.timer_seconds, main = $('#qz-main-area'), lvl = QUIZ.state.level, t = step.team;
        const teamName = t === 'A' ? QUIZ.game.class_a_name : QUIZ.game.class_b_name;
        const letters = ['A', 'B', 'C', 'D'];
        const who = lvl === 3 && step.player ? `<div class="qz-who-p">👤 ${esc(step.player.name)}</div>` : '';
        const lab = [q.matiere, q.theme].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ') || 'Culture générale';
        let jokersHtml = '';
        if (lvl !== 5) {
            const left = QUIZ.state.jokers_left[t], tot = QuizEngine.JOKERS_PER_TEAM;
            jokersHtml = `<div class="qz-jokers"><button class="qz-jk" id="jk-ami" ${left <= 0 ? 'disabled' : ''}>📞 Appel à un ami</button><button class="qz-jk" id="jk-50" ${left <= 0 ? 'disabled' : ''}>50/50</button><span class="qz-jkc" id="qz-jkc">🃏 ${left}/${tot}</span></div>${lvl === 4 ? `<div class="qz-note">⚠ En finale, un joker ramène la question à ${QuizEngine.JOKER_FINAL_PTS} pts</div>` : ''}`;
        }
        main.innerHTML = `
            <div class="qz-qwrap">
                <div class="qz-turn" style="--tc:${TEAM_COL[t]}">À L'ÉQUIPE <b>${esc(String(teamName).toUpperCase())}</b>${who}</div>
                <div class="qz-theme">${step.mystery ? '🎁 THÈME MYSTÈRE · ' : ''}${esc(lab)}</div>
                <div class="qz-qframe"><div class="qz-question">${esc(q.question)}</div></div>
                <div class="qz-choices-grid" id="qz-grid">${q.choix.map((c, i) => `<div class="qz-ans" role="button" data-i="${i}"><span>${letters[i]}</span><em>${esc(c)}</em></div>`).join('')}</div>
                <button class="qz-validate" id="qz-ok" disabled>✔ VALIDER</button>
                ${jokersHtml}
            </div>`;
        $('#qz-h-a').classList.toggle('act', t === 'A'); $('#qz-h-b').classList.toggle('act', t === 'B');
        if (lvl === 2) { const nm = $('#qz-h-name'); if (nm) nm.textContent = q.matiere || q.theme || ''; }
        const jA = $('#jk-ami'), j5 = $('#jk-50');
        if (jA && !jA.disabled) jA.onclick = () => useJoker('ami', step, q);
        if (j5 && !j5.disabled) j5.onclick = () => useJoker('cinquante', step, q);
        $('#qz-grid').querySelectorAll('.qz-ans').forEach(el => { el.onclick = () => setSel(+el.dataset.i); });
        $('#qz-ok').onclick = () => { if (QUIZ.sel !== null) submitAnswer(QUIZ.sel, step, q); };
        QUIZ.timeLeft = tm; QUIZ.startTime = Date.now(); QUIZ.deadline = Date.now() + tm * 1000; QUIZ.lastSec = -1;
        paintTimer(); runTimer(step, q);
    }

    async function useJoker(type, step, q) {
        if (QUIZ.isAnswering) return;
        const t = step.team, left = QUIZ.state.jokers_left[t];
        if (left <= 0) return;
        QUIZ.state.jokers_left[t] = left - 1; QUIZ.jokerUsedQ = true;
        if (type === 'ami') {
            QUIZ.timeLeft += 30; QUIZ.deadline += 30000;
            const b = $('#jk-ami'); b.disabled = true; b.textContent = '📞 Ami (+30 s)'; paintTimer();
        } else {
            const b = $('#jk-50'); b.disabled = true; b.textContent = '50/50 ✓';
            QuizEngine.shuffle([0, 1, 2, 3].filter(i => i !== q.bonne_reponse)).slice(0, 2).forEach(i => {
                const el = $(`#qz-grid .qz-ans[data-i="${i}"]`); el.classList.add('disabled'); el.classList.remove('sel');
                if (QUIZ.sel === i) QUIZ.sel = null;
            });
            const ok = $('#qz-ok'); if (ok) ok.disabled = QUIZ.sel === null;
        }
        const now = QUIZ.state.jokers_left[t], c = $('#qz-jkc');
        if (c) c.textContent = `🃏 ${now}/${QuizEngine.JOKERS_PER_TEAM}`;
        if (now <= 0) ['#jk-ami', '#jk-50'].forEach(s => { const b = $(s); if (b) b.disabled = true; });
        QuizStorage.logJoker(QUIZ.game.id, QUIZ.game.school_id, t, type).catch(() => {});
        QuizEngine.saveState(QUIZ.game.id, QUIZ.state).catch(console.error);
    }

    async function submitAnswer(selectedIdx, step, q) {
    if (QUIZ.isAnswering) return; QUIZ.isAnswering = true; if (QUIZ.timer) clearInterval(QUIZ.timer);
    const timeMs = Date.now() - QUIZ.startTime, isCorrect = selectedIdx === q.bonne_reponse, lvl = QUIZ.state.level;
    $('#qz-grid').querySelectorAll('.qz-ans').forEach((el, i) => {
        el.classList.add('locked'); el.classList.remove('sel');
        if (i === q.bonne_reponse) el.classList.add('correct'); else if (i === selectedIdx && !isCorrect) el.classList.add('wrong');
    });
    ['#qz-ok', '#jk-ami', '#jk-50'].forEach(s => { const b = $(s); if (b) b.disabled = true; });
    flash(isCorrect);
    if (isCorrect) sound.success(); else sound.buzzer();
    let pts = 0;
    try {
        const res = await QuizEngine.recordAnswer({ game: QUIZ.game, players: QUIZ.players, state: QUIZ.state }, { team: step.team, player_id: step.player.id, correct: isCorrect, time_ms: timeMs, question_id: q.id, joker_used: QUIZ.jokerUsedQ });
        pts = res.points; updateScores();
    } catch (e) { console.error(e); }
    const eliminated = !isCorrect && lvl === 3, tab = lvl === 5;
    setTimeout(() => {
        const ov = document.createElement('div'); ov.className = 'qz-exp';
        const title = isCorrect ? (tab ? '⚽ BUT !' : '✅ Bonne réponse !') : (eliminated ? `❌ ${esc(step.player.name)} est éliminé(e)` : (tab ? '❌ Raté !' : (selectedIdx === -1 ? '⏰ Temps écoulé !' : '❌ Mauvaise réponse')));
        const good = isCorrect ? '' : `<p><b>Bonne réponse :</b> ${esc(q.choix[q.bonne_reponse])}</p>`;
        const ptsTxt = isCorrect && !tab ? `<p class="qz-pts">+${pts} point${pts > 1 ? 's' : ''}${lvl === 4 && QUIZ.jokerUsedQ ? ' (joker utilisé)' : ''}</p>` : '';
        ov.innerHTML = `<div class="qz-exp-box"><h3 style="color:${isCorrect ? 'var(--ok)' : 'var(--bad)'}">${title}</h3>${ptsTxt}${good}${q.explication ? `<p>${esc(q.explication)}</p>` : ''}
            <button class="ghost" style="margin-top:12px;width:100%" id="qz-next">Question suivante →</button>
            <button class="ghost" style="margin-top:8px;width:100%;font-size:13px" id="qz-rep">⚑ Signaler cette question</button>
            <div id="qz-rep-box" hidden style="margin-top:8px;display:flex;flex-direction:column;gap:6px"><button class="ghost" data-m="question">Question incorrecte</button><button class="ghost" data-m="reponse">Mauvaise réponse indiquée</button><button class="ghost" data-m="autre">Autre problème</button></div></div>`;
        $('#qz-main-area').appendChild(ov);
        $('#qz-next').onclick = () => { ov.remove(); QUIZ.isAnswering = false; loadNextStep(); };
        const box = $('#qz-rep-box'); box.hidden = true;
        $('#qz-rep').onclick = () => { box.hidden = false; $('#qz-rep').hidden = true; };
        box.querySelectorAll('button').forEach(b => { b.onclick = async () => {
            box.innerHTML = '<small>Envoi…</small>';
            try { await QuizStorage.report(q.id, QUIZ.game.id, b.dataset.m, null); box.innerHTML = '<small style="color:var(--ok)">✅ Signalée : question retirée de la banque</small>'; }
            catch (e) { box.innerHTML = `<small style="color:var(--bad)">❌ Échec du signalement : ${esc(e.message || 'erreur')}</small>`; }
        }; });
    }, 1500);
}

function pauseGame() {
    if ($('.qz-pause-overlay')) return;
    const wasRunning = !QUIZ.isAnswering && !!QUIZ.timer;
    if (QUIZ.timer) { clearInterval(QUIZ.timer); QUIZ.timer = null; }
    const step = QUIZ.currentStep, q = QUIZ.currentQ;
    const ov = document.createElement('div'); ov.className = 'qz-pause-overlay';
    ov.innerHTML = `<h2>PAUSE</h2><button id="qz-res" style="width:200px;margin-bottom:10px">Reprendre</button><button class="ghost" id="qz-quit" style="width:200px">Quitter (abandonner)</button>`;
    $('#qz-main-area').appendChild(ov);
    QuizStorage.pauseGame(QUIZ.game.id, QUIZ.state).catch(console.error);
    $('#qz-res').onclick = () => {
        ov.remove(); QuizStorage.resumeGame(QUIZ.game.id, QUIZ.state).catch(console.error);
        if (wasRunning && step && q) {
            QUIZ.deadline = Date.now() + QUIZ.timeLeft * 1000;
            QUIZ.startTime = Date.now() - (QUIZ.game.timer_seconds - QUIZ.timeLeft) * 1000;
            runTimer(step, q);
        }
    };
    $('#qz-quit').onclick = () => { if (confirm('Abandonner la partie ?')) { QUIZ.quitting = true; QuizEngine.abort(QUIZ.game.id, QUIZ.state); history.back(); } };
}

function showTieScreen() {
    $('#qz-main-area').innerHTML = `<div style="text-align:center;padding:40px 20px"><h2 style="font-size:40px;color:var(--gold);margin-bottom:10px">ÉGALITÉ !</h2><p style="font-size:18px">Il va falloir un <b>Tir au But</b> pour désigner le vainqueur.</p><button style="margin-top:30px;width:100%;max-width:300px" id="qz-start-tab">Commencer le Tir au But</button></div>`;
    $('#qz-start-tab').onclick = () => { loadNextStep(); };
}

async function endGame(winnerTeam) {
    QUIZ.quitting = true;
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
        if (!win) { alert('Autorisez les fenêtres pop-up pour imprimer le certificat.'); return; }
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
                <p>Ce certificat est décerné à la classe de</p><div class="name">${esc(wName)}</div>
                <p>Pour sa brillante victoire lors du tournoi du ${new Date().toLocaleDateString('fr-FR')}.</p>
                <div class="grid">
                    <div><h3>🌟 Meilleurs Buteurs</h3><ul>${top3.map((p,i)=>`<li>${i+1}. ${esc(p.name)} (${p.points} pts)</li>`).join('')}</ul></div>
                    <div><h3>⚡ Les Plus Rapides</h3><ul>${fastest.map((p,i)=>`<li>${i+1}. ${esc(p.p.name)} (${(p.avg/1000).toFixed(1)}s)</li>`).join('')}</ul></div>
                </div>
                <div class="sig"><div>Le Directeur</div><div>L'Enseignant</div></div>
            </div>
            <script>setTimeout(()=>window.print(), 500);<\/script>
            </body></html>`);
        win.document.close();
    }

    window.OreaQuizUI = { injectCss, initAudio, sound, startConfetti, QUIZ, $, esc, sleep, openNewGame, printCert, openBank, openImport, openReports, restoreQ, deleteQ, editQ };
})();
