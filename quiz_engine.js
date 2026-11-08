/* =====================================================================
   ORÉA École v57 — quiz_engine.js
   QuizStorage (accès Supabase) + QuizEngine (règles du Génie en Herbe).
   Dépend de : `db` (app.js) et des fonctions SQL quiz_draw / quiz_themes / quiz_report.
   ===================================================================== */
(function () {
    'use strict';

    // ---- Réglages du jeu (modifiables ici) ----
    const BY = 'theme';              // v90 : vrais thèmes (champ « theme ») ; repli sur les matières si la banque est trop petite
    const JOKERS_PER_TEAM = 3;       // jokers par équipe (Appel à un ami ou 50/50, au choix)
    const JOKER_FINAL_PTS = 3;       // points d'une question de finale si un joker est utilisé
    const MIN_PER_THEME = 10;        // questions minimum par matière pour être proposée au niveau 2
    const MAX_TAB_ROUNDS = 15;       // sécurité du tir au but (puis tirage au sort)

    const LEVELS = [
        { n: 1, nom: 'Très facile',         count: 10, pts: 1, diffs: [1] },
        { n: 2, nom: 'Thématique',          count: 14, pts: 2, diffs: [1, 2] },
        { n: 3, nom: 'Élimination directe', count: 10, pts: 2, diffs: [1, 2] },
        { n: 4, nom: 'Finale',              count: 10, pts: 5, diffs: [2, 3] },
        { n: 5, nom: 'Tir au but',          count: 0,  pts: 0, diffs: [2, 3] },
        { n: 6, nom: 'Série rapide',        count: 10, pts: 1, diffs: [2] }
    ];
    // v90 : ordre de jeu (option A) — 1 Très facile · 2 Élimination directe · 3 Série rapide · 4 Thématique · 5 Finale · Tir au but
    // (les numéros internes ne changent pas : n=2 reste le Thématique, n=3 l'Élimination, n=4 la Finale, n=5 le tir au but)
    const ORDER = [1, 3, 6, 2, 4];
    const pos = n => n === 5 ? 6 : ORDER.indexOf(n) + 1;   // numéro AFFICHÉ du niveau

    // ================= STORAGE =================
    const rpc = async (fn, args) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };

    window.QuizStorage = {
        createGame: async function (cfg) {
            const row = {
                school_id: cfg.school_id, created_by: cfg.created_by, status: 'en_cours', niveau_scolaire: cfg.niveau_scolaire,
                class_a_id: cfg.class_a_id, class_b_id: cfg.class_b_id, class_a_name: cfg.class_a_name, class_b_name: cfg.class_b_name,
                timer_seconds: cfg.timer_seconds, current_level: 1, score_a: 0, score_b: 0, state: cfg.state || {}
            };
            const { data, error } = await db.from('quiz_games').insert(row).select().single();
            if (error) throw error; return data;
        },
        updateGame: async function (id, patch) {
            const { data, error } = await db.from('quiz_games').update(patch).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        pauseGame: async function (id, state) { return this.updateGame(id, { status: 'en_pause', paused_at: new Date().toISOString(), state }); },
        resumeGame: async function (id, state) { return this.updateGame(id, { status: 'en_cours', state, paused_at: null }); },
        finishGame: async function (id, patch) { return this.updateGame(id, Object.assign({ status: 'terminee', finished_at: new Date().toISOString() }, patch || {})); },
        getGame: async function (id) {
            const { data, error } = await db.from('quiz_games').select('*').eq('id', id).maybeSingle();
            if (error) throw error; return data;
        },
        createPlayers: async function (game_id, school_id, players) {
            const rows = (players || []).map(p => ({ game_id, school_id, student_id: p.student_id, class_id: p.class_id, team: p.team, name: p.name, status: 'en_jeu', points: 0, correct_answers: 0, wrong_answers: 0, correct_time_ms: 0 }));
            const { data, error } = await db.from('quiz_players').insert(rows).select();
            if (error) throw error; return data || [];
        },
        updatePlayer: async function (id, patch) {
            const { data, error } = await db.from('quiz_players').update(patch).eq('id', id).select().single();
            if (error) throw error; return data;
        },
        logJoker: async function (game_id, school_id, team, type) {
            const { error } = await db.from('quiz_jokers').insert({ game_id, school_id, team, type, used: true, used_at: new Date().toISOString() });
            if (error) throw error;
        },
        awardTitle: async function (row) {
            const { data, error } = await db.from('quiz_titles').insert(row).select().single();
            if (error) throw error; return data;
        },
        draw: (niveau, diffs, by, value, exclude, n) => rpc('quiz_draw', { p_niveau: niveau, p_diffs: diffs, p_by: by, p_value: value, p_exclude: exclude, p_n: n }),
        themes: (niveau, diffs, by, exclude, min) => rpc('quiz_themes', { p_niveau: niveau, p_diffs: diffs, p_by: by, p_exclude: exclude, p_min: min }),
        report: (question_id, game_id, motif, comment) => rpc('quiz_report', { p_question: question_id, p_game: game_id, p_motif: motif, p_comment: comment || null })
    };

    // ================= OUTILS =================
    const lvl = n => LEVELS.find(l => l.n === n);
    function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    const teamPlayers = (players, t) => players.filter(p => p.team === t);
    const alive = (players, t) => players.filter(p => p.team === t && p.status === 'en_jeu');
    function survivors(players) { return { A: alive(players, 'A'), B: alive(players, 'B') }; }
    function allEliminated(players, t) { return teamPlayers(players, t).every(p => p.status === 'elimine'); }
    function pickPlayer(players, t, k) { let l = alive(players, t); if (!l.length) l = teamPlayers(players, t); return l[k % l.length]; }

    // Valide une question et mélange l'ordre des 4 réponses (évite un biais de position).
    function prep(row) {
        let ch = row.choix;
        if (typeof ch === 'string') { try { ch = JSON.parse(ch); } catch (_) { ch = []; } }
        const br = Number(row.bonne_reponse);
        if (!Array.isArray(ch) || ch.length !== 4 || !(br >= 0 && br < 4)) throw new Error('Question invalide');
        const items = shuffle(ch.map((t, i) => ({ t: String(t), ok: i === br })));
        return { id: row.id, matiere: row.matiere, theme: row.theme, niveau_difficulte: row.niveau_difficulte, question: row.question, choix: items.map(x => x.t), bonne_reponse: items.findIndex(x => x.ok), explication: row.explication };
    }

    // 3e verrou (v76) : contrôle final sur le téléphone — jamais deux fois le même texte dans une partie
    const SEEN = new Map();
    const normQ = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    async function draw(game, asked, diffs, value, n, by) {
        n = n || 1;
        const seen = SEEN.get(game.id) || new Set(); SEEN.set(game.id, seen);
        const rows = (await QuizStorage.draw(game.niveau_scolaire, diffs, by || BY, value, asked, n + 5)) || [];
        const out = [];
        for (const r of rows) {
            const k = normQ(r.question);
            if ((asked || []).includes(r.id) || seen.has(k)) continue;
            try { out.push(prep(r)); seen.add(k); } catch (_) { /* question ignorée */ }
            if (out.length === n) break;
        }
        if (out.length < n) throw new Error(value
            ? `Pas assez de questions pour « ${value} » (${game.niveau_scolaire}). Ajoutez des questions à la banque.`
            : `Plus de questions disponibles (${game.niveau_scolaire}, difficulté ${diffs.join('-')}). Ajoutez des questions à la banque.`);
        return out;
    }
    async function drawOne(game, state, diffs) { const [q] = await draw(game, state.asked, diffs, null, 1); state.asked.push(q.id); return q; }

    function emptyState(cfg) {
        return {
            version: 2, created_at: new Date().toISOString(), niveau_scolaire: cfg.niveau_scolaire, timer_seconds: cfg.timer_seconds,
            level: 1, idx: 0, intro_seen: [], asked: [], theme_options: null, theme_pool: [], themes: null,
            n2_queue: [], n3_queue: [], n4_seq: [], tab: { round: 1, turn: 'A', a_ok: null },
            jokers_left: { A: JOKERS_PER_TEAM, B: JOKERS_PER_TEAM }, scores: { A: 0, B: 0 },
            history: [], winner: null, decided_by: null, current_player: null
        };
    }

    // ================= PARTIE =================
    async function createGame(opts) {
        const state = emptyState(opts);
        const game = await QuizStorage.createGame({
            school_id: opts.school_id, created_by: opts.created_by, niveau_scolaire: opts.niveau_scolaire,
            class_a_id: opts.class_a.id, class_b_id: opts.class_b.id, class_a_name: opts.class_a.name, class_b_name: opts.class_b.name,
            timer_seconds: opts.timer_seconds, state
        });
        const players = [];
        opts.team_a_players.forEach(p => players.push({ team: 'A', student_id: p.id, class_id: opts.class_a.id, name: p.name }));
        opts.team_b_players.forEach(p => players.push({ team: 'B', student_id: p.id, class_id: opts.class_b.id, name: p.name }));
        const inserted = await QuizStorage.createPlayers(game.id, opts.school_id, players);
        return { game, players: inserted };
    }

    async function saveState(game_id, state) { return QuizStorage.updateGame(game_id, { state }); }
    async function pause(game_id, state) { return QuizStorage.pauseGame(game_id, state); }
    async function abort(game_id, state) { return QuizStorage.updateGame(game_id, { status: 'abandonnee', state: state || {} }); }

    async function serve(ctx, step) {
        ctx.state.current_player = { team: step.team, id: step.player.id, name: step.player.name };
        await saveState(ctx.game.id, ctx.state); return step;
    }
    async function advance(ctx, n) { ctx.state.level = n; ctx.state.idx = 0; await saveState(ctx.game.id, ctx.state); return nextQuestion(ctx); }
    async function finishBy(ctx, winner, by) { ctx.state.winner = winner; ctx.state.decided_by = by; await saveState(ctx.game.id, ctx.state); return { finished: true, winner }; }
    async function toTab(ctx) {
        const s = ctx.state; s.level = 5; s.idx = 0; if (!s.intro_seen.includes(5)) s.intro_seen.push(5);
        s.tab = { round: 1, turn: 'A', a_ok: null }; await saveState(ctx.game.id, s); return { tie: true };
    }

    // Niveau Thématique (v90) : CHAQUE équipe reçoit 3 thèmes + 1 mystère, différents de ceux de l'autre équipe.
    // Seuls les thèmes qui ont assez de questions sont proposés ; sinon on passe aux matières.
    async function buildThemeOptions(ctx) {
        const { game, state } = ctx;
        let by = BY, rows = (await QuizStorage.themes(game.niveau_scolaire, lvl(2).diffs, by, state.asked, MIN_PER_THEME)) || [];
        if (rows.length < 2) { by = 'matiere'; rows = (await QuizStorage.themes(game.niveau_scolaire, lvl(2).diffs, by, state.asked, MIN_PER_THEME)) || []; }
        const pool = shuffle(rows.map(r => r.label));
        if (pool.length < 2) throw new Error(`Banque insuffisante pour le niveau Thématique : il faut au moins 2 thèmes avec ${MIN_PER_THEME} questions chacun (trouvé : ${pool.length}).`);
        // Répartition en alternance : A reçoit 0, 2, 4 ; B reçoit 1, 3, 5 → jamais le même thème
        const A = [], B = [];
        pool.slice(0, 6).forEach((t, i) => (i % 2 ? B : A).push(t));
        const mk = (L, team) => L.map((label, i) => ({ id: team + i, label, mystery: false })).concat([{ id: team + 'm', label: 'Thème mystère', mystery: true }]);
        state.theme_by = by; state.theme_pool = pool;
        state.theme_options = { A: mk(A, 'A'), B: mk(B, 'B') };
        await saveState(game.id, state);
    }

    // picks = { A: 'idOption', B: 'idOption' } → tire 7 questions par équipe, dans SON thème.
    async function setThemes(ctx, picks) {
        const { game, state } = ctx, L = lvl(2), O = state.theme_options || {};
        const a = (O.A || []).find(o => o.id === picks.A), b = (O.B || []).find(o => o.id === picks.B);
        if (!a || !b) throw new Error('Choix de thèmes invalide.');
        const pool = state.theme_pool, shown = (O.A || []).concat(O.B || []).filter(o => !o.mystery).map(o => o.label);
        // Thème mystère : un thème que personne n'a vu, sinon un autre thème que celui de l'adversaire
        const mystery = other => { let c = pool.filter(x => !shown.includes(x) && x !== other); if (!c.length) c = pool.filter(x => x !== other); if (!c.length) c = pool; return c[Math.floor(Math.random() * c.length)]; };
        let la = a.mystery ? null : a.label, lb = b.mystery ? null : b.label;
        if (a.mystery) la = mystery(lb);
        if (b.mystery) lb = mystery(la);
        const qa = await draw(game, state.asked, L.diffs, la, 7, state.theme_by);
        const qb = await draw(game, state.asked.concat(qa.map(q => q.id)), L.diffs, lb, 7, state.theme_by);
        const queue = [];
        for (let i = 0; i < 7; i++) { queue.push({ team: 'A', q: qa[i] }); queue.push({ team: 'B', q: qb[i] }); }
        state.asked = state.asked.concat(qa.map(q => q.id), qb.map(q => q.id));
        state.themes = { A: { label: la, mystery: !!a.mystery }, B: { label: lb, mystery: !!b.mystery } };
        state.n2_queue = queue; state.idx = 0;
        await saveState(game.id, state);
        return state.themes;
    }

    /* Retourne l'une de ces formes :
       { intro: n }                      → écran de présentation du niveau
       { needThemes: true, options }     → l'UI doit appeler setThemes()
       { q, player, team, mystery?, isTirAuBut?, round? }
       { tie: true }                     → égalité : tir au but
       { finished: true, winner }        → fin de partie */
    async function nextQuestion(ctx) {
        const { game, players, state } = ctx, n = state.level, L = lvl(n);
        if (!L) return { error: 'Niveau inconnu.' };
        if (!state.intro_seen.includes(n)) { state.intro_seen.push(n); await saveState(game.id, state); return { intro: n }; }

        if (n === 1) {
            if (state.idx >= L.count) return advance(ctx, 3);   // v90 : puis Élimination directe
            const t = state.idx % 2 === 0 ? 'A' : 'B', player = pickPlayer(players, t, Math.floor(state.idx / 2));
            const q = await drawOne(game, state, L.diffs); state.idx++;
            return serve(ctx, { q, player, team: t });
        }
        if (n === 2) {
            if (!state.themes) { if (!state.theme_options) await buildThemeOptions(ctx); return { needThemes: true, options: state.theme_options }; }
            if (state.idx >= state.n2_queue.length) return advance(ctx, 4);   // v90 : puis Finale
            const it = state.n2_queue[state.idx], k = Math.floor(state.idx / 2); state.idx++;
            return serve(ctx, { q: it.q, team: it.team, player: pickPlayer(players, it.team, k), mystery: !!state.themes[it.team].mystery });
        }
        if (n === 3) {
            if (state.idx === 0 && !state.n3_queue.length) {
                const sA = shuffle(alive(players, 'A')), sB = shuffle(alive(players, 'B')), qu = [];
                for (let i = 0; i < Math.max(sA.length, sB.length); i++) {
                    if (sA[i]) qu.push({ team: 'A', id: sA[i].id, name: sA[i].name });
                    if (sB[i]) qu.push({ team: 'B', id: sB[i].id, name: sB[i].name });
                }
                state.n3_queue = qu;
            }
            if (state.idx >= state.n3_queue.length) {
                const s = survivors(players);
                if (!s.A.length && s.B.length) return finishBy(ctx, 'B', 'elimination');
                if (!s.B.length && s.A.length) return finishBy(ctx, 'A', 'elimination');
                return advance(ctx, 6);   // v90 : puis Série rapide
            }
            const cur = state.n3_queue[state.idx];
            const q = await drawOne(game, state, L.diffs); state.idx++;
            return serve(ctx, { q, player: cur, team: cur.team });
        }
        if (n === 6) {
            // v90 : Série rapide — 10 questions, équipes en alternance, joueurs encore en jeu
            if (state.idx >= L.count) return advance(ctx, 2);   // puis Thématique
            const t = state.idx % 2 === 0 ? 'A' : 'B', player = pickPlayer(players, t, Math.floor(state.idx / 2));
            const q = await drawOne(game, state, L.diffs); state.idx++;
            return serve(ctx, { q, player, team: t });
        }
        if (n === 4) {
            if (state.idx === 0 && !state.n4_seq.length) {
                const s = survivors(players);
                if (!s.A.length || !s.B.length) {
                    if (state.scores.A !== state.scores.B) return finishBy(ctx, state.scores.A > state.scores.B ? 'A' : 'B', 'score');
                    return toTab(ctx);
                }
                let ia = 0, ib = 0;
                for (let i = 0; i < L.count; i++) {
                    const t = i % 2 === 0 ? 'A' : 'B', pool = t === 'A' ? s.A : s.B, k = t === 'A' ? ia++ : ib++, p = pool[k % pool.length];
                    state.n4_seq.push({ team: t, id: p.id, name: p.name });
                }
            }
            if (state.idx >= state.n4_seq.length) {
                if (state.scores.A !== state.scores.B) return finishBy(ctx, state.scores.A > state.scores.B ? 'A' : 'B', 'score');
                return toTab(ctx);
            }
            const cur = state.n4_seq[state.idx];
            const q = await drawOne(game, state, L.diffs); state.idx++;
            return serve(ctx, { q, player: cur, team: cur.team });
        }
        if (n === 5) {
            if (state.winner) return { finished: true, winner: state.winner };
            if (state.tab.round > MAX_TAB_ROUNDS) return finishBy(ctx, Math.random() < 0.5 ? 'A' : 'B', 'tirage');
            const t = state.tab.turn, player = pickPlayer(players, t, state.tab.round - 1);
            const q = await drawOne(game, state, L.diffs);
            return serve(ctx, { q, player, team: t, isTirAuBut: true, round: state.tab.round });
        }
        return { error: 'Niveau inconnu.' };
    }

    // Tir au but : A puis B ; si un seul des deux marque, il gagne ; sinon on recommence.
    function updateTab(state, t, ok) {
        const tab = state.tab;
        if (t === 'A') { tab.a_ok = ok; tab.turn = 'B'; return; }
        if (tab.a_ok !== null && tab.a_ok !== ok) { state.winner = tab.a_ok ? 'A' : 'B'; state.decided_by = 'tir_au_but'; }
        else { tab.round++; tab.turn = 'A'; tab.a_ok = null; }
    }

    // opts : { team, player_id, correct, time_ms, question_id, joker_used }
    async function recordAnswer(ctx, opts) {
        const { game, players, state } = ctx, t = opts.team, level = state.level;
        const player = players.find(p => p.id === opts.player_id);
        if (!player) throw new Error('Joueur introuvable.');
        const base = level === 4 ? (opts.joker_used ? JOKER_FINAL_PTS : lvl(4).pts) : (lvl(level) ? lvl(level).pts : 0);
        const patch = {}; let earned = 0;
        if (opts.correct) {
            earned = base;
            patch.points = player.points + earned; patch.correct_answers = player.correct_answers + 1;
            patch.correct_time_ms = Number(player.correct_time_ms || 0) + Number(opts.time_ms || 0);
            if (level !== 5) state.scores[t] = (state.scores[t] || 0) + earned;
        } else {
            patch.wrong_answers = player.wrong_answers + 1;
            if (level === 3) patch.status = 'elimine';
        }
        if (level === 5) updateTab(state, t, !!opts.correct);
        await QuizStorage.updatePlayer(player.id, patch); Object.assign(player, patch);
        state.history.push({ level, team: t, player: player.name, player_id: player.id, correct: !!opts.correct, ms: Number(opts.time_ms || 0), question_id: opts.question_id || null, joker: !!opts.joker_used, pts: earned });
        await saveState(game.id, state);
        return { player, state, correct: !!opts.correct, points: earned };
    }

    async function finish(game_id, ctx) {
        const { state } = ctx; let w = state.winner;
        if (!w) { if (state.scores.A > state.scores.B) w = 'A'; else if (state.scores.B > state.scores.A) w = 'B'; }
        state.winner = w || null; if (w && !state.decided_by) state.decided_by = 'score';
        const winner_class_id = w === 'A' ? ctx.game.class_a_id : w === 'B' ? ctx.game.class_b_id : null;
        return QuizStorage.finishGame(game_id, { winner_class_id, score_a: state.scores.A, score_b: state.scores.B, current_level: state.level, state });
    }

    async function awardEndTitles(ctx) {
        const { game, players } = ctx;
        const ranked = players.filter(p => p.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);
        const fastest = players.filter(p => p.correct_answers > 0 && p.correct_time_ms > 0).map(p => ({ p, avg: p.correct_time_ms / p.correct_answers })).sort((a, b) => a.avg - b.avg).slice(0, 3);
        const winners = ctx.state.winner ? players.filter(p => p.team === ctx.state.winner) : [];
        const out = [], base = p => ({ school_id: game.school_id, game_id: game.id, student_id: p.student_id, class_id: p.class_id, player_name: p.name });
        ranked.forEach((p, i) => out.push(Object.assign(base(p), { title: 'Meilleur buteur', rank: i + 1 })));
        fastest.forEach((f, i) => out.push(Object.assign(base(f.p), { title: 'Éclair', rank: i + 1 })));
        winners.forEach(p => out.push(Object.assign(base(p), { title: 'Champion de la classe', rank: null })));
        for (const t of out) { try { await QuizStorage.awardTitle(t); } catch (e) { console.warn(e); } }
        return out;
    }

    window.QuizEngine = { LEVELS, ORDER, pos, JOKERS_PER_TEAM, JOKER_FINAL_PTS, createGame, saveState, pause, abort, finish, nextQuestion, setThemes, recordAnswer, survivors, allEliminated, awardEndTitles, shuffle };
})();
