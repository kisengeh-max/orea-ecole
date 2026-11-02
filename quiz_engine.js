/* =====================================================================
   ORÉA École v40 — quiz_engine.js (Version corrigée et stable)
   ===================================================================== */
(function () {
    'use strict';

    const POINTS = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 0 };
    const LEVELS = [
        { n: 1, nom: 'Échauffement',   difficultes: [1, 2] },
        { n: 2, nom: 'Consolidation',  difficultes: [2, 3] },
        { n: 3, nom: 'Élimination',    difficultes: [3, 4] },
        { n: 4, nom: 'Finale',         difficultes: [4, 5], count: 12 },
        { n: 5, nom: 'Tir au But',     difficultes: [5],     alternance: true }
    ];
    const THEMES_L1_L2 = ['Histoire', 'Géographie', 'Sciences', 'Français', 'Culture générale', 'Sport', 'Vie courante'];

    const isPauseable = e => e && (e.status === 'en_cours' || e.status === 'en_pause');

    function emptyState(cfg) {
        return {
            version: 1,
            created_at: new Date().toISOString(),
            niveau_scolaire: cfg.niveau_scolaire,
            timer_seconds: cfg.timer_seconds,
            level: 1,
            sub_round: 0,
            order: ['A', 'B'],
            order_idx: 0,
            current_player: null,
            current_question: null,
            picks_remaining: { A: [], B: [] },
            final_seq: [],
            final_idx: 0,
            elimination_queue: [],
            elimination_idx: 0,
            asked_this_game: { A: [], B: [] },
            jokers_used: { A: { ami: false, cinquante: false }, B: { ami: false, cinquante: false } },
            history: [],
            scores: { A: 0, B: 0 },
            winner: null
        };
    }

    async function createGame(opts) {
        if (!opts || !opts.school_id || !opts.class_a || !opts.class_b) throw new Error('Paramètres de partie incomplets.');
        if (!Array.isArray(opts.team_a_players) || opts.team_a_players.length !== 5) throw new Error('5 joueurs requis dans l\'équipe A.');
        if (!Array.isArray(opts.team_b_players) || opts.team_b_players.length !== 5) throw new Error('5 joueurs requis dans l\'équipe B.');
        if (!opts.timer_seconds || opts.timer_seconds < 5) throw new Error('Chrono invalide.');

        const state = emptyState({
            niveau_scolaire: opts.niveau_scolaire,
            timer_seconds: opts.timer_seconds
        });

        await QuizAI.ensureCache({
            school_id: opts.school_id,
            niveau_scolaire: opts.niveau_scolaire,
            niveau_difficulte: 2,
            need: 30
        }).catch(e => { });

        const game = await QuizStorage.createGame({
            school_id: opts.school_id,
            created_by: opts.created_by,
            niveau_scolaire: opts.niveau_scolaire,
            class_a_id: opts.class_a.id,
            class_b_id: opts.class_b.id,
            class_a_name: opts.class_a.name,
            class_b_name: opts.class_b.name,
            timer_seconds: opts.timer_seconds,
            state
        });

        const players = [];
        opts.team_a_players.forEach(p => players.push({ team: 'A', student_id: p.id, class_id: opts.class_a.id, name: p.name }));
        opts.team_b_players.forEach(p => players.push({ team: 'B', student_id: p.id, class_id: opts.class_b.id, name: p.name }));
        const inserted = await QuizStorage.createPlayers(game.id, opts.school_id, players);
        await QuizStorage.initJokers(game.id, opts.school_id);

        return { game, players: inserted };
    }

    async function saveState(game_id, state) {
        return QuizStorage.updateGame(game_id, { state });
    }
    async function pause(game_id, state) {
        return QuizStorage.pauseGame(game_id, state);
    }
    async function resume(game_id) {
        const g = await QuizStorage.getGame(game_id);
        if (!g || g.status !== 'en_pause') throw new Error('Aucune partie en pause avec cet identifiant.');
        return QuizStorage.resumeGame(game_id, g.state || {});
    }
    async function abort(game_id, state) {
        return QuizStorage.updateGame(game_id, { status: 'abandonnee', state: state || {} });
    }

    function survivors(players) {
        return {
            A: players.filter(p => p.team === 'A' && p.status === 'en_jeu'),
            B: players.filter(p => p.team === 'B' && p.status === 'en_jeu')
        };
    }
    function allEliminated(players, team) {
        return players.filter(p => p.team === team).every(p => p.status === 'elimine');
    }

    async function recordAnswer(ctx, opts) {
        const { game, players, state } = ctx;
        const team = opts.team;
        const level = state.level;
        const points = POINTS[level] || 0;

        const player = players.find(p => p.id === opts.player_id);
        if (!player) throw new Error('Joueur introuvable.');
        if (player.status === 'elimine') throw new Error('Ce joueur est éliminé.');

        const patch = {};
        if (opts.correct) {
            patch.points = player.points + points;
            patch.correct_answers = player.correct_answers + 1;
            patch.correct_time_ms = Number(player.correct_time_ms || 0) + Number(opts.time_ms || 0);
            if (level !== 5) state.scores[team] = (state.scores[team] || 0) + points;
        } else {
            patch.wrong_answers = player.wrong_answers + 1;
            if (level === 3) patch.status = 'elimine';
        }
        await QuizStorage.updatePlayer(player.id, patch);
        Object.assign(player, patch);

        state.history.push({
            level, team,
            player: player.name,
            player_id: player.id,
            correct: !!opts.correct,
            ms: Number(opts.time_ms || 0),
            question_id: opts.question_id || null,
            at: new Date().toISOString()
        });

        await saveState(game.id, state);
        return { player, state, correct: !!opts.correct };
    }

    async function finish(game_id, ctx) {
        const { players, state } = ctx;
        const { A, B } = survivors(players);
        let winner = null;
        if (!A.length && B.length) winner = 'B';
        else if (!B.length && A.length) winner = 'A';
        else if (state.scores.A > state.scores.B) winner = 'A';
        else if (state.scores.B > state.scores.A) winner = 'B';

        state.winner = winner;
        const winner_class_id = winner === 'A' ? ctx.game.class_a_id : winner === 'B' ? ctx.game.class_b_id : null;
        return QuizStorage.finishGame(game_id, {
            winner_class_id,
            score_a: state.scores.A,
            score_b: state.scores.B,
            current_level: state.level,
            state
        });
    }

    async function awardEndTitles(ctx) {
        const { game, players } = ctx;
        const ranked = players.slice().sort((a, b) => b.points - a.points).slice(0, 3);
        const fastest = players.filter(p => p.correct_answers > 0 && p.correct_time_ms > 0)
            .map(p => ({ p, avg: p.correct_time_ms / p.correct_answers }))
            .sort((a, b) => a.avg - b.avg).slice(0, 3);
        const winner_team = ctx.state.winner;
        const winners = winner_team ? players.filter(p => p.team === winner_team) : [];
        const out = [];

        for (let i = 0; i < ranked.length; i++) {
            out.push({
                school_id: game.school_id, game_id: game.id,
                student_id: ranked[i].student_id, class_id: ranked[i].class_id,
                player_name: ranked[i].name, title: 'Meilleur buteur', rank: i + 1
            });
        }
        for (let i = 0; i < fastest.length; i++) {
            out.push({
                school_id: game.school_id, game_id: game.id,
                student_id: fastest[i].p.student_id, class_id: fastest[i].p.class_id,
                player_name: fastest[i].p.name, title: 'Éclair', rank: i + 1
            });
        }
        for (const w of winners) {
            out.push({
                school_id: game.school_id, game_id: game.id,
                student_id: w.student_id, class_id: w.class_id,
                player_name: w.name, title: 'Champion de la classe', rank: null
            });
        }
        for (const t of out) {
            try { await QuizStorage.awardTitle(t); } catch (e) { console.warn('Titre non enregistré', e); }
        }
        return out;
    }

    function buildFinalSequence(players, state) {
        const survivorsA = players.filter(p => p.team === 'A' && p.status === 'en_jeu');
        const survivorsB = players.filter(p => p.team === 'B' && p.status === 'en_jeu');
        if (!survivorsA.length || !survivorsB.length) return [];
        const seq = [];
        let ia = 0, ib = 0;
        for (let i = 0; i < 12; i++) {
            const team = i % 2 === 0 ? 'A' : 'B';
            const pool = team === 'A' ? survivorsA : survivorsB;
            const idx = team === 'A' ? ia++ : ib++;
            seq.push({ team, player: pool[idx % pool.length] });
        }
        return seq;
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    async function prepareQuestion(game, state, team, class_ids) {
        const diff = state.level <= 2 ? [1, 2] : state.level === 3 ? [3, 4] : [4, 5];
        const niveau_diff = diff[Math.floor(Math.random() * diff.length)];
        let pool = await QuizStorage.pickQuestions(game.school_id, game.niveau_scolaire, niveau_diff, class_ids, 1);
        
        if (!pool || !pool.length) {
            try {
                await QuizAI.ensureCache({
                    school_id: game.school_id,
                    niveau_scolaire: game.niveau_scolaire,
                    niveau_difficulte: niveau_diff,
                    need: 20
                });
                pool = await QuizStorage.pickQuestions(game.school_id, game.niveau_scolaire, niveau_diff, class_ids, 1);
            } catch (e) {
                // CORRECTION ICI : on affiche le vrai message d'erreur
                throw new Error('Échec IA : ' + (QuizAI.frError ? QuizAI.frError(e.message) : e.message));
            }
        }
        if (!pool || !pool.length) throw new Error('Plus de questions disponibles pour ce niveau.');
        
        const q = pool[0];
        await QuizStorage.markAsked(q.id, class_ids);
        return q;
    }

    async function nextQuestion(ctx) {
        const { game, players, state } = ctx;
        const class_ids = [game.class_a_id, game.class_b_id];
        
        if (state.level === 1 || state.level === 2) {
            if (state.sub_round >= 4) {
                state.level++; state.sub_round = 0; await saveState(game.id, state); return nextQuestion(ctx);
            }
            const team = state.sub_round % 2 === 0 ? 'A' : 'B';
            const survivor = players.filter(p => p.team === team && p.status === 'en_jeu');
            if (!survivor.length) {
                state.level++; state.sub_round = 0; await saveState(game.id, state); return nextQuestion(ctx);
            }
            const player = survivor[state.sub_round % survivor.length];
            const q = await prepareQuestion(game, state, team, class_ids);
            state.current_question = q;
            state.current_player = { team, id: player.id, name: player.name };
            await saveState(game.id, state);
            return { q, player, team };
        }

        if (state.level === 3) {
            if (!state.elimination_queue || !state.elimination_queue.length) {
                const survivorsA = shuffle(players.filter(p => p.team === 'A' && p.status === 'en_jeu'));
                const survivorsB = shuffle(players.filter(p => p.team === 'B' && p.status === 'en_jeu'));
                state.elimination_queue = [];
                for (let i = 0; i < Math.max(survivorsA.length, survivorsB.length); i++) {
                    if (survivorsA[i]) state.elimination_queue.push({ team: 'A', id: survivorsA[i].id, name: survivorsA[i].name });
                    if (survivorsB[i]) state.elimination_queue.push({ team: 'B', id: survivorsB[i].id, name: survivorsB[i].name });
                }
                state.elimination_idx = 0;
            }
            if (state.elimination_idx >= state.elimination_queue.length) {
                state.level = 4; state.final_seq = buildFinalSequence(players, state); state.final_idx = 0;
                await saveState(game.id, state); return nextQuestion(ctx);
            }
            const cur = state.elimination_queue[state.elimination_idx];
            state.elimination_idx++;
            const q = await prepareQuestion(game, state, cur.team, class_ids);
            state.current_question = q;
            state.current_player = cur;
            await saveState(game.id, state);
            return { q, player: cur, team: cur.team };
        }

        if (state.level === 4) {
            if (!state.final_seq || !state.final_seq.length) {
                state.final_seq = buildFinalSequence(players, state); state.final_idx = 0;
            }
            if (state.final_idx >= state.final_seq.length) {
                if (state.scores.A === state.scores.B) {
                    state.level = 5; state.order = ['A', 'B']; state.order_idx = 0;
                    await saveState(game.id, state); return { tie: true };
                }
                await saveState(game.id, state); return { finished: true };
            }
            const step = state.final_seq[state.final_idx];
            state.final_idx++;
            const q = await prepareQuestion(game, state, step.team, class_ids);
            state.current_question = q;
            state.current_player = { team: step.team, id: step.player.id, name: step.player.name };
            await saveState(game.id, state);
            return { q, player: state.current_player, team: step.team };
        }

        if (state.level === 5) {
            const team = state.order[state.order_idx % 2];
            const survivors = players.filter(p => p.team === team && p.status === 'en_jeu');
            if (!survivors.length) {
                state.winner = team === 'A' ? 'B' : 'A';
                await finish(game.id, ctx); return { finished: true, winner: state.winner };
            }
            const player = survivors[state.order_idx % survivors.length];
            const q = await prepareQuestion(game, state, team, class_ids);
            state.current_question = q;
            state.current_player = { team, id: player.id, name: player.name };
            state.order_idx++;
            await saveState(game.id, state);
            return { q, player: state.current_player, team, isTirAuBut: true };
        }
        return { error: 'Niveau inconnu.' };
    }

    window.QuizEngine = {
        POINTS, LEVELS, THEMES_L1_L2,
        createGame, saveState, pause, resume, abort, finish,
        recordAnswer, nextQuestion,
        survivors, allEliminated,
        awardEndTitles, shuffle
    };
})();
