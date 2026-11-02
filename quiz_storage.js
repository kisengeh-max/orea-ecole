/* =====================================================================
   ORÉA École v40 — quiz_storage.js
   Accès Supabase pour le Génie en Herbe. AUCUN appel Gemini ici.
   Tables : quiz_games, quiz_players, quiz_questions_cache,
            quiz_jokers, quiz_titles + RPC quiz_class_stats().
   À charger AVANT quiz_ai.js, quiz_engine.js, quiz_ui.js.
   ===================================================================== */
(function () {
    'use strict';

    const CACHE_MAX = 500;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    /* ---------- CACHE DE QUESTIONS ---------- */
    async function cacheCount(school_id, niveau_scolaire) {
        const { count, error } = await db.from('quiz_questions_cache')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', school_id)
            .eq('niveau_scolaire', niveau_scolaire)
            .eq('signalee', false);
        if (error) throw error;
        return count || 0;
    }

    // Pioche n questions non encore posées aux classes données.
    // Filtre par niveau_scolaire + difficulté et origine (proportion 40/30/30 en amont).
    async function pickQuestions(school_id, niveau_scolaire, niveau_difficulte, exclude_class_ids, n) {
        const { data, error } = await db.from('quiz_questions_cache')
            .select('*')
            .eq('school_id', school_id)
            .eq('niveau_scolaire', niveau_scolaire)
            .eq('niveau_difficulte', niveau_difficulte)
            .eq('signalee', false)
            .order('created_at', { ascending: true })
            .limit(200);
        if (error) throw error;
        const excl = new Set(exclude_class_ids || []);
        const ok = (data || []).filter(q => {
            const asked = Array.isArray(q.asked_class_ids) ? q.asked_class_ids : [];
            return !asked.some(id => excl.has(id));
        });
        return ok.slice(0, n);
    }

    // Marque une question comme posée aux classes concernées (sans doublon)
    async function markAsked(question_id, class_ids) {
        const { data: cur, error: e1 } = await db.from('quiz_questions_cache').select('asked_class_ids').eq('id', question_id).maybeSingle();
        if (e1) return { error: e1 };
        const cur_asked = (cur && cur.asked_class_ids) || [];
        const merged = Array.from(new Set([...cur_asked, ...(class_ids || [])]));
        const { error } = await db.from('quiz_questions_cache').update({ asked_class_ids: merged }).eq('id', question_id);
        return { error };
    }

    // Insère un lot de questions générées par l'IA. Renvoie le nombre inséré.
    async function insertBatch(school_id, niveau_scolaire, rows) {
        const clean = (rows || []).filter(q =>
            q && typeof q.question === 'string' && Array.isArray(q.choix) && q.choix.length === 4
            && typeof q.bonne_reponse === 'number' && q.bonne_reponse >= 0 && q.bonne_reponse <= 3
            && typeof q.niveau_difficulte === 'number'
        ).map(q => ({
            school_id, niveau_scolaire,
            theme: q.theme || null,
            niveau_difficulte: clamp(q.niveau_difficulte, 1, 5),
            origine: ['rdc','afrique','monde'].includes(q.origine) ? q.origine : 'monde',
            question: q.question.trim().slice(0, 500),
            choix: q.choix.slice(0, 4).map(c => String(c).slice(0, 200)),
            bonne_reponse: q.bonne_reponse,
            explication: q.explication ? String(q.explication).slice(0, 400) : null
        }));
        if (!clean.length) return 0;
        const { error } = await db.from('quiz_questions_cache').insert(clean);
        if (error) throw error;
        return clean.length;
    }

    // Signaler une question douteuse : elle ne sera plus jamais proposée
    async function flagQuestion(id) {
        return db.from('quiz_questions_cache').update({ signalee: true }).eq('id', id);
    }

    /* ---------- PARTIES ---------- */
    async function createGame(cfg) {
        const row = {
            school_id: cfg.school_id,
            created_by: cfg.created_by,
            status: 'en_cours',
            niveau_scolaire: cfg.niveau_scolaire,
            class_a_id: cfg.class_a_id,
            class_b_id: cfg.class_b_id,
            class_a_name: cfg.class_a_name,
            class_b_name: cfg.class_b_name,
            timer_seconds: cfg.timer_seconds,
            current_level: 1,
            score_a: 0, score_b: 0,
            state: cfg.state || {}
        };
        const { data, error } = await db.from('quiz_games').insert(row).select().single();
        if (error) throw error;
        return data;
    }
    async function updateGame(id, patch) {
        const { data, error } = await db.from('quiz_games').update(patch).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }
    async function pauseGame(id, state) {
        return updateGame(id, { status: 'en_pause', paused_at: new Date().toISOString(), state });
    }
    async function resumeGame(id, state) {
        return updateGame(id, { status: 'en_cours', state, paused_at: null });
    }
    async function finishGame(id, patch) {
        return updateGame(id, Object.assign({ status: 'terminee', finished_at: new Date().toISOString() }, patch || {}));
    }
    async function abortGame(id) {
        return updateGame(id, { status: 'abandonnee' });
    }
    async function listPausedGames(school_id) {
        const { data, error } = await db.from('quiz_games').select('*').eq('school_id', school_id).eq('status', 'en_pause').order('paused_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }
    async function getGame(id) {
        const { data, error } = await db.from('quiz_games').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
    }

    /* ---------- JOUEURS ---------- */
    async function createPlayers(game_id, school_id, players) {
        const rows = (players || []).map(p => ({
            game_id, school_id,
            student_id: p.student_id, class_id: p.class_id,
            team: p.team, name: p.name,
            status: 'en_jeu',
            points: 0, correct_answers: 0, wrong_answers: 0, correct_time_ms: 0
        }));
        const { data, error } = await db.from('quiz_players').insert(rows).select();
        if (error) throw error;
        return data || [];
    }
    async function updatePlayer(id, patch) {
        const { data, error } = await db.from('quiz_players').update(patch).eq('id', id).select().single();
        if (error) throw error;
        return data;
    }
    async function listPlayers(game_id) {
        const { data, error } = await db.from('quiz_players').select('*').eq('game_id', game_id).order('created_at');
        if (error) throw error;
        return data || [];
    }

    /* ---------- JOKERS ---------- */
    async function initJokers(game_id, school_id) {
        const rows = [];
        ['A', 'B'].forEach(team => {
            ['ami', 'cinquante'].forEach(type => rows.push({ game_id, school_id, team, type, used: false }));
        });
        const { data, error } = await db.from('quiz_jokers').insert(rows).select();
        if (error) throw error;
        return data || [];
    }
    async function useJoker(game_id, team, type) {
        const { data, error } = await db.from('quiz_jokers')
            .update({ used: true, used_at: new Date().toISOString() })
            .eq('game_id', game_id).eq('team', team).eq('type', type).eq('used', false)
            .select().single();
        if (error) throw error;
        return data;
    }
    async function listJokers(game_id) {
        const { data, error } = await db.from('quiz_jokers').select('*').eq('game_id', game_id);
        if (error) throw error;
        return data || [];
    }

    /* ---------- TITRES ---------- */
    async function awardTitle(row) {
        const { data, error } = await db.from('quiz_titles').insert(row).select().single();
        if (error) throw error;
        return data;
    }
    async function listTitles(school_id, limit) {
        const { data, error } = await db.from('quiz_titles').select('*').eq('school_id', school_id).order('awarded_at', { ascending: false }).limit(limit || 50);
        if (error) throw error;
        return data || [];
    }

    /* ---------- STATS ---------- */
    async function classStats() {
        const { data, error } = await db.rpc('quiz_class_stats');
        if (error) throw error;
        return data || [];
    }
    async function gamesHistory(school_id, limit) {
        const { data, error } = await db.from('quiz_games').select('*').eq('school_id', school_id).eq('status', 'terminee').order('finished_at', { ascending: false }).limit(limit || 20);
        if (error) throw error;
        return data || [];
    }

    window.QuizStorage = {
        CACHE_MAX,
        cacheCount, pickQuestions, markAsked, insertBatch, flagQuestion,
        createGame, updateGame, pauseGame, resumeGame, finishGame, abortGame, listPausedGames, getGame,
        createPlayers, updatePlayer, listPlayers,
        initJokers, useJoker, listJokers,
        awardTitle, listTitles,
        classStats, gamesHistory
    };
})();
