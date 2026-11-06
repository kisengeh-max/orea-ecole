/* =====================================================================
   ORÉA École v79 — famille.js : Génie en Herbe « Famille / Solo »
   Pour TOUS les utilisateurs : personnel, parents, ambassadeurs, administrateur.
   - Solo, ou 2 équipes de taille libre (noms gardés sur le téléphone).
   - Niveau 3 : élimination directe SEULEMENT si les 2 équipes ont 5 joueurs
     ou plus ; sinon, série de questions bonus. Finale + Tir au but gardés.
   - Questions gardées sur le téléphone : on peut jouer sans réseau.
   - Les questions de l'école (ou des écoles des enfants) sont mises en avant.
   - Jamais deux fois la même question dans une partie.
   - Règle des 90 jours : une question vue sur ce téléphone ne revient qu'après
     90 jours, sauf si toutes les autres sont épuisées.
   - Questions de l'école : environ 30 % des questions.
   - Accès : en bas de l'Accueil de tous les utilisateurs.
   Données : RPC quiz_family_pack (étape 13). Aucune écriture en base.
   ===================================================================== */
(function () {
    'use strict';
    if (typeof db === 'undefined') return;

    const LS = {
        get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
        set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { } }
    };
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const keyOf = q => q.question_hash || norm(q.question);
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    let G = null, OV = null, TIMER = null;

    /* ---------- Style ---------- */
    function css() {
        if (document.getElementById('fm-css')) return;
        const s = document.createElement('style'); s.id = 'fm-css';
        s.textContent = `.fm-ov{position:fixed;inset:0;z-index:400;background:var(--bg,#14110d);color:var(--tx,#f0eee6);overflow-y:auto;padding:calc(12px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom));font-family:inherit}
.fm-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.fm-head b{font-size:18px;flex:1}
.fm-x{width:42px;min-height:42px;border-radius:12px;border:1px solid var(--line,#444);background:transparent;color:inherit;font-size:18px}
.fm-card{background:var(--card,#221d17);border:1px solid var(--line,#3a3328);border-radius:14px;padding:14px;margin:10px 0}
.fm-ov label{display:block;font-size:13px;color:var(--mut,#a59e8c);margin:10px 0 4px;font-weight:600}
.fm-ov input,.fm-ov textarea,.fm-ov select{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid var(--line,#3a3328);background:var(--bg,#14110d);color:inherit;font:inherit}
.fm-row{display:flex;gap:8px;flex-wrap:wrap}.fm-row>*{flex:1}
.fm-ch{padding:12px;border-radius:12px;border:1px solid var(--line,#3a3328);background:transparent;color:inherit;font:inherit;min-height:46px}
.fm-ch.on{border-color:var(--gold,#c7a34b);background:rgba(199,163,75,.18);color:var(--gold,#c7a34b);font-weight:700}
.fm-go{width:100%;padding:14px;border-radius:12px;border:0;background:var(--gold,#c7a34b);color:#1a1710;font:inherit;font-weight:700;font-size:16px;margin-top:12px}
.fm-ans{display:block;width:100%;text-align:left;padding:14px;margin:8px 0;border-radius:12px;border:1px solid var(--line,#3a3328);background:var(--card,#221d17);color:inherit;font:inherit;font-size:16px}
.fm-ans.ok{border-color:var(--ok,#3fae6a);background:rgba(63,174,106,.18)}.fm-ans.ko{border-color:var(--bad,#d0574b);background:rgba(208,87,75,.18)}
.fm-sc{display:flex;gap:10px;margin-bottom:10px}.fm-sc div{flex:1;text-align:center;padding:8px;border-radius:12px;border:1px solid var(--line,#3a3328)}
.fm-sc div.on{border-color:var(--gold,#c7a34b)}.fm-sc b{display:block;font-size:22px}
.fm-q{font-size:19px;font-weight:700;line-height:1.35;margin:10px 0}.fm-mut{color:var(--mut,#a59e8c);font-size:13px}
.fm-bar{height:6px;border-radius:6px;background:var(--line,#3a3328);overflow:hidden;margin:8px 0}.fm-bar i{display:block;height:100%;background:var(--gold,#c7a34b);transition:width 1s linear}`;
        document.head.appendChild(s);
    }
    function screen(html) {
        css();
        if (!OV) { OV = document.createElement('div'); OV.className = 'fm-ov'; document.body.appendChild(OV); document.body.style.overflow = 'hidden'; }
        OV.innerHTML = html; OV.scrollTop = 0;
        return OV;
    }
    function close() {
        clearInterval(TIMER); TIMER = null;
        if (OV) OV.remove(); OV = null; G = null; document.body.style.overflow = '';
    }
    const head = (t, quit) => `<div class="fm-head"><button class="fm-x" onclick="${quit ? 'oreaFamilleQuit()' : 'oreaFamilleClose()'}">✕</button><b>${E(t)}</b></div>`;
    window.oreaFamilleClose = close;
    window.oreaFamilleQuit = () => { if (confirm('Quitter la partie en cours ?')) close(); };

    /* ---------- Questions (cache sur le téléphone) ---------- */
    async function loadPack(niv) {
        const key = 'orea_fam_q_' + niv, c = LS.get(key, null);
        if (c && Date.now() - c.at < 24 * 3600e3 && c.list.length >= 60) return c.list;
        try {
            const { data, error } = await db.rpc('quiz_family_pack', { p_niveau: niv, p_limit: 600 });
            if (error) throw error;
            if (data && data.length) { LS.set(key, { at: Date.now(), list: data }); return data; }
        } catch (e) { if (c && c.list.length) return c.list; throw e; }
        return c ? c.list : [];
    }
    // Règle des 90 jours (sur ce téléphone) : { empreinte: date de passage }
    const SEEN_KEY = 'orea_fam_seen90', D90 = 90 * 864e5;
    function seenMap() {
        const m = LS.get(SEEN_KEY, {}), now = Date.now();
        Object.keys(m).forEach(k => { if (now - m[k] > D90) delete m[k]; });
        return m;
    }
    function markSeen(k) { const m = seenMap(); m[k] = Date.now(); LS.set(SEEN_KEY, m); }
    function pick(diffs, mat) {
        const pool = G.list.filter(q => diffs.includes(Number(q.niveau_difficulte)) && (!mat || q.matiere === mat) && !G.seen.has(keyOf(q)));
        if (!pool.length) return null;
        const glob = seenMap();
        const fresh = pool.filter(q => !glob[keyOf(q)]), P = fresh.length ? fresh : pool;   // 90 jours, sauf si tout est épuisé
        const local = P.filter(q => q.school_id), other = P.filter(q => !q.school_id);
        const R = local.length && (!other.length || Math.random() < 0.3) ? local : (other.length ? other : P);   // ~30 % de questions de l'école
        const q = R[Math.floor(Math.random() * R.length)], k = keyOf(q);
        G.seen.add(k); markSeen(k);
        const items = shuffle(q.choix.map((t, i) => ({ t, ok: i === Number(q.bonne_reponse) })));
        return { question: q.question, matiere: q.matiere, choix: items.map(x => x.t), good: items.findIndex(x => x.ok), explication: q.explication, local: !!q.school_id };
    }
    function themes(diffs, min) {
        const n = {};
        G.list.forEach(q => { if (diffs.includes(Number(q.niveau_difficulte)) && q.matiere && !G.seen.has(keyOf(q))) n[q.matiere] = (n[q.matiere] || 0) + 1; });
        return shuffle(Object.keys(n).filter(m => n[m] >= min));
    }

    /* ---------- Configuration ---------- */
    window.oreaFamille = async function () {
        const cfg = LS.get('orea_fam_cfg', { mode: 'teams', niv: 'secondaire', timer: 30, solo: '', A: 'Les Lions', B: 'Les Léopards', pa: '', pb: '' });
        screen(head('Génie en Herbe · Famille') + `
            <div class="fm-card"><b>Mode de jeu</b><div class="fm-row" style="margin-top:8px"><button class="fm-ch ${cfg.mode === 'solo' ? 'on' : ''}" data-m="solo">🧑 Solo</button><button class="fm-ch ${cfg.mode === 'teams' ? 'on' : ''}" data-m="teams">👨‍👩‍👧‍👦 2 équipes</button></div>
            <label>Niveau</label><div class="fm-row"><button class="fm-ch ${cfg.niv === 'primaire' ? 'on' : ''}" data-n="primaire">Primaire</button><button class="fm-ch ${cfg.niv === 'secondaire' ? 'on' : ''}" data-n="secondaire">Secondaire</button></div>
            <label>Temps pour répondre</label><select id="fm-t">${[[20, '20 secondes'], [30, '30 secondes'], [45, '45 secondes'], [0, 'Sans chrono']].map(o => `<option value="${o[0]}" ${cfg.timer === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
            <div class="fm-card" id="fm-solo" ${cfg.mode === 'solo' ? '' : 'hidden'}><label style="margin-top:0">Ton prénom</label><input id="fm-sn" value="${E(cfg.solo)}" placeholder="Ex : Grâce"></div>
            <div class="fm-card" id="fm-teams" ${cfg.mode === 'teams' ? '' : 'hidden'}>
                <label style="margin-top:0">Équipe 1</label><input id="fm-a" value="${E(cfg.A)}"><textarea id="fm-pa" rows="3" placeholder="Un joueur par ligne">${E(cfg.pa)}</textarea>
                <label>Équipe 2</label><input id="fm-b" value="${E(cfg.B)}"><textarea id="fm-pb" rows="3" placeholder="Un joueur par ligne">${E(cfg.pb)}</textarea>
                <p class="fm-mut">À partir de 5 joueurs dans chaque équipe, le niveau 3 devient une élimination directe. Sinon, c’est une série de questions bonus.</p></div>
            <div id="fm-msg" class="fm-mut"></div>
            <button class="fm-go" id="fm-start">▶ Commencer</button>`);
        const $ = s => OV.querySelector(s);
        OV.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.m; OV.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); $('#fm-solo').hidden = cfg.mode !== 'solo'; $('#fm-teams').hidden = cfg.mode !== 'teams'; });
        OV.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { cfg.niv = b.dataset.n; OV.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b)); });
        $('#fm-start').onclick = async () => {
            cfg.timer = +$('#fm-t').value; cfg.solo = $('#fm-sn').value.trim(); cfg.A = $('#fm-a').value.trim() || 'Équipe 1'; cfg.B = $('#fm-b').value.trim() || 'Équipe 2';
            cfg.pa = $('#fm-pa').value; cfg.pb = $('#fm-pb').value;
            const pl = t => t.split('\n').map(x => x.trim()).filter(Boolean);
            if (cfg.mode === 'teams' && (!pl(cfg.pa).length || !pl(cfg.pb).length)) { $('#fm-msg').textContent = 'Écris au moins un joueur dans chaque équipe.'; return; }
            LS.set('orea_fam_cfg', cfg);
            $('#fm-start').disabled = true; $('#fm-msg').textContent = 'Préparation des questions…';
            let list;
            try { list = await loadPack(cfg.niv); } catch (e) { $('#fm-msg').textContent = 'Impossible de charger les questions : ' + (e.message || e) + '. Connecte-toi une fois à Internet pour les télécharger.'; $('#fm-start').disabled = false; return; }
            if (list.length < 40) { $('#fm-msg').textContent = 'Pas assez de questions pour ce niveau pour le moment.'; $('#fm-start').disabled = false; return; }
            const teams = cfg.mode === 'solo'
                ? [{ name: cfg.solo || 'Moi', players: [{ name: cfg.solo || 'Moi', out: false }], score: 0 }]
                : [{ name: cfg.A, players: pl(cfg.pa).map(n => ({ name: n, out: false })), score: 0 }, { name: cfg.B, players: pl(cfg.pb).map(n => ({ name: n, out: false })), score: 0 }];
            G = { cfg, solo: cfg.mode === 'solo', list, seen: new Set(), teams, level: 0, queue: [], idx: 0, turn: [0, 0], tab: null };
            G.elim = !G.solo && teams.every(t => t.players.length >= 5);
            nextLevel();
        };
    };

    /* ---------- Déroulement ---------- */
    const LV = solo => solo
        ? [{ n: 1, nom: 'Très facile', pts: 1, diffs: [1], count: 10 }, { n: 2, nom: 'Thématique', pts: 2, diffs: [1, 2], count: 7 }, { n: 3, nom: 'Série bonus', pts: 3, diffs: [2], count: 5 }, { n: 4, nom: 'Finale', pts: 5, diffs: [2, 3], count: 5 }]
        : [{ n: 1, nom: 'Très facile', pts: 1, diffs: [1], count: 10 }, { n: 2, nom: 'Thématique', pts: 2, diffs: [1, 2], count: 14 }, { n: 3, nom: 'Élimination directe', pts: 2, diffs: [1, 2] }, { n: 4, nom: 'Finale', pts: 5, diffs: [2, 3], count: 10 }];
    const lvl = () => { const L = LV(G.solo)[G.level - 1]; if (G.level === 3 && !G.solo && !G.elim) return { n: 3, nom: 'Série bonus', pts: 3, diffs: [2], count: 6 }; return L; };
    const alive = t => G.teams[t].players.filter(p => !p.out);
    function nextPlayer(t, list) { const L = list || G.teams[t].players; const p = L[G.turn[t] % L.length]; G.turn[t]++; return p; }

    function nextLevel() {
        G.level++; G.idx = 0; G.queue = [];
        if (G.level > 4) return endGame();
        const L = lvl();
        const RULE = {
            1: G.solo ? '10 questions faciles · 1 point chacune.' : 'Les équipes répondent à tour de rôle · 1 point par bonne réponse.',
            2: G.solo ? 'Choisis une matière : 7 questions · 2 points chacune.' : 'Chaque équipe choisit sa matière : 7 questions chacune · 2 points.',
            3: L.nom === 'Élimination directe' ? 'Chaque joueur répond seul : une erreur et il est éliminé. Si une équipe n’a plus de joueur, l’autre gagne.' : `${L.count} questions bonus · ${L.pts} points chacune.`,
            4: `${G.solo ? 5 : 10} questions plus difficiles · 5 points chacune.${G.solo ? '' : ' En cas d’égalité : tir au but !'}`
        }[G.level];
        screen(head('Niveau ' + G.level + ' · ' + L.nom, true) + scores() + `<div class="fm-card" style="text-align:center"><div style="font-size:40px">${['🌱', '🎯', '⚔️', '🏆'][G.level - 1]}</div><h2 style="margin:8px 0">${E(L.nom)}</h2><p>${E(RULE)}</p></div><button class="fm-go" id="fm-n">C’est parti</button>`);
        OV.querySelector('#fm-n').onclick = () => G.level === 2 ? chooseThemes() : buildQueue();
    }

    function chooseThemes() {
        const L = lvl(), per = G.solo ? 7 : 7, pool = themes(L.diffs, per * (G.solo ? 1 : 2));
        if (pool.length < 2) { G.themes = G.solo ? [null] : [null, null]; return buildQueue(); }
        const opts = pool.slice(0, 3);
        const ask = (t, done) => {
            screen(head('Niveau 2 · Thématique', true) + scores() + `<div class="fm-card"><b>${G.solo ? 'Choisis ta matière' : E(G.teams[t].name) + ', choisissez votre matière'}</b>${opts.map(m => `<button class="fm-ans" data-th="${E(m)}">📘 ${E(m)}</button>`).join('')}<button class="fm-ans" data-th="">❓ Thème mystère</button></div>`);
            OV.querySelectorAll('[data-th]').forEach(b => b.onclick = () => done(b.dataset.th || pool[Math.floor(Math.random() * pool.length)]));
        };
        G.themes = [];
        ask(0, a => { G.themes[0] = a; if (G.solo) return buildQueue(); ask(1, b => { G.themes[1] = b; buildQueue(); }); });
    }

    function buildQueue() {
        const L = lvl(), q = [];
        if (G.solo) for (let i = 0; i < L.count; i++) q.push({ t: 0, mat: G.level === 2 ? G.themes[0] : null });
        else if (G.level === 3 && G.elim) {
            const a = shuffle(alive(0)), b = shuffle(alive(1));
            for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) q.push({ t: 0, p: a[i] }); if (b[i]) q.push({ t: 1, p: b[i] }); }
        } else for (let i = 0; i < L.count; i++) q.push({ t: i % 2, mat: G.level === 2 ? G.themes[i % 2] : null });
        G.queue = q; G.idx = 0; ask();
    }

    function scores() {
        return `<div class="fm-sc">${G.teams.map((t, i) => `<div class="${G.cur && G.cur.t === i ? 'on' : ''}"><small>${E(t.name)}</small><b>${t.score}</b></div>`).join('')}</div>`;
    }

    function ask() {
        clearInterval(TIMER);
        if (G.tab) return tabAsk();
        if (G.idx >= G.queue.length) return afterLevel();
        const it = G.queue[G.idx], L = lvl();
        let q = pick(L.diffs, it.mat) || pick(L.diffs, null) || pick([1, 2, 3], null);
        if (!q) return endGame('Plus de questions disponibles sur ce téléphone.');
        const team = G.teams[it.t];
        const player = it.p || (G.solo ? team.players[0] : nextPlayer(it.t, G.level === 4 && G.elim ? alive(it.t) : null));
        G.cur = { t: it.t, p: player, q, pts: L.pts };
        showQuestion(`Niveau ${G.level} · ${L.nom} · ${G.idx + 1}/${G.queue.length}`, q, player, team);
    }

    function showQuestion(title, q, player, team) {
        screen(head(title, true) + scores() + `<div class="fm-mut">${G.solo ? '' : '👉 ' + E(team.name) + ' · <b>' + E(player.name) + '</b> · '}${E(q.matiere || '')}${q.local ? ' · ⭐ question de l’école' : ''}</div>`
            + (G.cfg.timer ? `<div class="fm-bar"><i id="fm-tb" style="width:100%"></i></div>` : '')
            + `<div class="fm-q">${E(q.question)}</div>${q.choix.map((c, i) => `<button class="fm-ans" data-a="${i}">${'ABCD'[i]}. ${E(c)}</button>`).join('')}`);
        OV.querySelectorAll('[data-a]').forEach(b => b.onclick = () => answer(+b.dataset.a));
        if (G.cfg.timer) {
            let left = G.cfg.timer; const bar = OV.querySelector('#fm-tb');
            TIMER = setInterval(() => { left--; if (bar) bar.style.width = Math.max(0, 100 * left / G.cfg.timer) + '%'; if (left <= 0) { clearInterval(TIMER); answer(-1); } }, 1000);
        }
    }

    function answer(i) {
        clearInterval(TIMER);
        const c = G.cur, ok = i === c.q.good;
        OV.querySelectorAll('[data-a]').forEach(b => { b.disabled = true; const k = +b.dataset.a; if (k === c.q.good) b.classList.add('ok'); else if (k === i) b.classList.add('ko'); });
        if (G.tab) return tabAnswer(ok);
        if (ok) G.teams[c.t].score += c.pts;
        if (!ok && G.level === 3 && G.elim && c.p) c.p.out = true;
        G.idx++;
        OV.insertAdjacentHTML('beforeend', `<div class="fm-card" style="border-color:var(${ok ? '--ok' : '--bad'},#888)"><b>${ok ? '✅ Bonne réponse ! +' + c.pts : i < 0 ? '⏰ Temps écoulé' : '❌ Mauvaise réponse'}</b>${ok ? '' : `<div>La bonne réponse : <b>${E(c.q.choix[c.q.good])}</b></div>`}${!ok && G.level === 3 && G.elim && c.p ? `<div>${E(c.p.name)} est éliminé(e).</div>` : ''}${c.q.explication ? `<p style="margin:8px 0 0">💡 ${E(c.q.explication)}</p>` : ''}</div><button class="fm-go" id="fm-nx">Suivant</button>`);
        OV.querySelector('.fm-sc').outerHTML = scores();
        OV.querySelector('#fm-nx').onclick = () => {
            if (G.level === 3 && G.elim) { const a = alive(0).length, b = alive(1).length; if (!a || !b) return endGame(null, !a ? 1 : 0, 'élimination'); }
            ask();
        };
        OV.querySelector('#fm-nx').scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    function afterLevel() {
        if (G.level === 4 && !G.solo && G.teams[0].score === G.teams[1].score) {
            G.tab = { round: 1, turn: 0, aOk: null };
            screen(head('Tir au but', true) + scores() + `<div class="fm-card" style="text-align:center"><div style="font-size:40px">⚽</div><h2>Égalité !</h2><p>Une question par équipe à tour de rôle. Si une seule équipe répond juste, elle gagne.</p></div><button class="fm-go" id="fm-n">Commencer</button>`);
            OV.querySelector('#fm-n').onclick = ask;
            return;
        }
        nextLevel();
    }

    function tabAsk() {
        if (G.tab.round > 15) return endGame(null, Math.random() < 0.5 ? 0 : 1, 'tirage au sort');
        const t = G.tab.turn, q = pick([2, 3], null) || pick([1, 2, 3], null);
        if (!q) return endGame(null, Math.random() < 0.5 ? 0 : 1, 'tirage au sort');
        const player = nextPlayer(t, alive(t).length ? alive(t) : null);
        G.cur = { t, p: player, q, pts: 0 };
        showQuestion('Tir au but · tour ' + G.tab.round, q, player, G.teams[t]);
    }
    function tabAnswer(ok) {
        const c = G.cur, T = G.tab;
        let winner = null;
        if (T.turn === 0) { T.aOk = ok; T.turn = 1; }
        else { if (T.aOk !== ok) winner = T.aOk ? 0 : 1; T.turn = 0; T.round++; T.aOk = null; }
        OV.insertAdjacentHTML('beforeend', `<div class="fm-card"><b>${ok ? '⚽ But !' : '🧤 Arrêté'}</b>${ok ? '' : `<div>La bonne réponse : <b>${E(c.q.choix[c.q.good])}</b></div>`}${c.q.explication ? `<p style="margin:8px 0 0">💡 ${E(c.q.explication)}</p>` : ''}</div><button class="fm-go" id="fm-nx">Suivant</button>`);
        OV.querySelector('#fm-nx').onclick = () => winner !== null ? endGame(null, winner, 'tir au but') : ask();
        OV.querySelector('#fm-nx').scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    function endGame(msg, forced, how) {
        clearInterval(TIMER);
        let h = head('Fin de la partie') + scores();
        if (G.solo) {
            const s = G.teams[0].score, rk = 'orea_fam_best_' + G.cfg.niv, best = LS.get(rk, 0);
            if (s > best) LS.set(rk, s);
            h += `<div class="fm-card" style="text-align:center"><div style="font-size:48px">${s >= 40 ? '🏆' : s >= 20 ? '🥈' : '🎉'}</div><h2>${E(G.teams[0].name)} : ${s} points</h2><p>${s > best ? '🎊 Nouveau record !' : 'Ton record : ' + best + ' points'}</p>${msg ? `<p class="fm-mut">${E(msg)}</p>` : ''}</div>`;
        } else {
            const w = forced !== undefined && forced !== null ? forced : (G.teams[0].score === G.teams[1].score ? -1 : G.teams[0].score > G.teams[1].score ? 0 : 1);
            h += `<div class="fm-card" style="text-align:center"><div style="font-size:48px">🏆</div><h2>${w < 0 ? 'Match nul !' : E(G.teams[w].name) + ' gagne !'}</h2>${how ? `<p class="fm-mut">Décidé par ${E(how)}</p>` : ''}${msg ? `<p class="fm-mut">${E(msg)}</p>` : ''}</div>`;
        }
        h += `<button class="fm-go" id="fm-again">🔁 Rejouer</button><button class="fm-go" style="background:transparent;border:1px solid var(--line,#444);color:inherit" onclick="oreaFamilleClose()">Fermer</button>`;
        screen(h);
        OV.querySelector('#fm-again').onclick = () => { close(); window.oreaFamille(); };
    }

    /* ---------- Points d'entrée : en bas de l'Accueil de TOUS les utilisateurs ---------- */
    const BLOCK = (id, school) => `<div id="${id}" class="card col" style="margin-top:14px"><b>🎮 Génie en Herbe</b><small>Le jeu de culture générale d’ORÉA</small><div class="row" style="flex-wrap:wrap">${school ? '<button onclick="openQuiz()">🏫 Version école</button>' : ''}<button class="ghost" onclick="oreaFamille()">👨‍👩‍👧 Famille / Solo</button></div></div>`;
    // Personnel : Accueil (version école + Famille) ; retiré du Menu
    const oAcc = window.vAccueil;
    if (typeof oAcc === 'function' && !oAcc.__fm) {
        window.vAccueil = async function () {
            const r = await oAcc.apply(this, arguments);
            try {
                const main = document.getElementById('main');
                if (main && typeof S !== 'undefined' && S.tab === 'accueil' && !main.querySelector('#fm-acc'))
                    main.insertAdjacentHTML('beforeend', BLOCK('fm-acc', typeof openQuiz === 'function'));
            } catch (_) { }
            return r;
        };
        window.vAccueil.__fm = true;
    }
    const oMenu = window.vMenu;
    if (typeof oMenu === 'function' && !oMenu.__fm) {
        window.vMenu = function () {
            const r = oMenu.apply(this, arguments);
            try {
                const main = document.getElementById('main');
                if (main) {
                    main.querySelectorAll('[onclick*="openQuiz"],[onclick*="oreaFamille"]').forEach(e => e.remove());
                    main.querySelectorAll('.menu-title').forEach(t => { if (t.textContent.trim() === 'Jeux') t.remove(); });
                }
            } catch (_) { }
            return r;
        };
        window.vMenu.__fm = true;
    }
    // Administrateur et ambassadeur : en bas, juste avant « Déconnexion »
    const atBottom = (id, extra) => {
        const main = document.getElementById('main');
        if (!main || main.querySelector('#' + id)) return;
        const html = `<div id="${id}" class="card col" style="margin-top:14px"><b>🎮 Génie en Herbe</b><small>Le jeu de culture générale d’ORÉA</small><div class="row" style="flex-wrap:wrap"><button class="ghost" onclick="oreaFamille()">👨‍👩‍👧 Famille / Solo</button>${extra || ''}</div></div>`;
        const out = [...main.querySelectorAll('button')].filter(b => /out\(\)/.test(b.getAttribute('onclick') || '')).pop();
        out ? out.insertAdjacentHTML('beforebegin', html) : main.insertAdjacentHTML('beforeend', html);
    };
    const oAdm = window.admRender;
    if (typeof oAdm === 'function' && !oAdm.__fm) {
        window.admRender = function () {
            const r = oAdm.apply(this, arguments);
            try { atBottom('fm-adm', window.OreaQuizUI ? '<button class="ghost" onclick="OreaQuizUI.openBank()">🗂 Banque de questions</button>' : ''); } catch (_) { }
            return r;
        };
        window.admRender.__fm = true;
    }
    const oAmb = window.ambDraw;
    if (typeof oAmb === 'function' && !oAmb.__fm) {
        window.ambDraw = async function () {
            const r = await oAmb.apply(this, arguments);
            try { atBottom('fm-amb'); } catch (_) { }
            return r;
        };
        window.ambDraw.__fm = true;
    }
    // Parent : en bas de l'accueil, juste au-dessus de la barre de navigation
    const oHome = window.homeView;
    if (typeof oHome === 'function' && !oHome.__fm) {
        window.homeView = function () {
            const r = oHome.apply(this, arguments);
            try {
                const main = document.getElementById('pmain');
                if (main && !main.querySelector('#fm-par')) {
                    const html = `<div id="fm-par" class="p-card" onclick="oreaFamille()" style="cursor:pointer;margin-top:14px"><h3>🎮 Génie en Herbe · Famille</h3><div class="p-line">Solo ou en famille, même sans réseau</div></div>`;
                    const nav = main.querySelector('.p-nav-grid');
                    nav ? nav.insertAdjacentHTML('beforebegin', html) : main.insertAdjacentHTML('beforeend', html);
                }
            } catch (_) { }
            return r;
        };
        window.homeView.__fm = true;
    }
})();
