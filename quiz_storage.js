/* =====================================================================
   ORÉA École v40 — quiz_storage_v2.js (Banque locale sans IA)
   ===================================================================== */
(function () {
    'use strict';

    async function createGame(cfg) {
        const row = {
            school_id: cfg.school_id, created_by: cfg.created_by,
            status: 'en_cours', niveau_scolaire: cfg.niveau_scolaire,
            class_a_id: cfg.class_a_id, class_b_id: cfg.class_b_id,
            class_a_name: cfg.class_a_name, class_b_name: cfg.class_b_name,
            timer_seconds: cfg.timer_seconds, current_level: 1,
            score_a: 0, score_b: 0, state: cfg.state || {}
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
    async function pauseGame(id, state) { return updateGame(id, { status: 'en_pause', paused_at: new Date().toISOString(), state }); }
    async function resumeGame(id, state) { return updateGame(id, { status: 'en_cours', state, paused_at: null }); }
    async function finishGame(id, patch) { return updateGame(id, Object.assign({ status: 'terminee', finished_at: new Date().toISOString() }, patch || {})); }
    async function getGame(id) {
        const { data, error } = await db.from('quiz_games').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
    }

    async function createPlayers(game_id, school_id, players) {
        const rows = (players || []).map(p => ({
            game_id, school_id, student_id: p.student_id, class_id: p.class_id,
            team: p.team, name: p.name, status: 'en_jeu',
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
        const { data, error } = await db.from('quiz_jokers').update({ used: true, used_at: new Date().toISOString() })
            .eq('game_id', game_id).eq('team', team).eq('type', type).eq('used', false).select().single();
        if (error) throw error;
        return data;
    }
    async function awardTitle(row) {
        const { data, error } = await db.from('quiz_titles').insert(row).select().single();
        if (error) throw error;
        return data;
    }

    // --- C'EST ICI QUE TOUT SE JOUE : On pioche dans la nouvelle table ---
    async function prepareQuestionForLevel(niveau_scolaire, niveau_difficulte, theme = null, excludeIds = []) {
        let query = db.from('quiz_questions')
            .select('*')
            .eq('niveau_scolaire', niveau_scolaire)
            .eq('niveau_difficulte', niveau_difficulte)
            .eq('est_active', true);

        if (theme) query = query.eq('theme', theme);
        
        // On récupère jusqu'à 100 questions pour avoir le choix
        const { data, error } = await query.limit(100);
        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error(`Aucune question pour ${niveau_scolaire} (niveau ${niveau_difficulte}).`);
        }

        // On filtre celles qui ont déjà été posées dans la partie
        const excl = new Set(excludeIds);
        const disponibles = data.filter(q => !excl.has(q.id));

        if (disponibles.length === 0) {
            throw new Error(`Toutes les questions de ce thème ont déjà été posées.`);
        }

        // On en tire une au hasard
        const q = disponibles[Math.floor(Math.random() * disponibles.length)];
        
        return {
            id: q.id,
            theme: q.theme,
            niveau_difficulte: q.niveau_difficulte,
            question: q.question,
            choix: q.choix,
            bonne_reponse: q.bonne_reponse,
            explication: q.explication
        };
    }

    window.QuizStorage = {
        createGame, updateGame, pauseGame, resumeGame, finishGame, getGame,
        createPlayers, updatePlayer, initJokers, useJoker, awardTitle,
        prepareQuestionForLevel // Nouvelle fonction
    };
})();
