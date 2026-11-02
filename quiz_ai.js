/* =====================================================================
   ORÉA École v40 — quiz_ai.js (erreurs lisibles, clé en en-tête, cache par difficulté)
   Affiche le vrai message de Google pour comprendre le blocage.
   ===================================================================== */
(function () {
    'use strict';

    const BATCH_MIN = 15, BATCH_MAX = 25;
    const DEFAULT_MODEL = 'gemini-2.5-flash';
    const ORIGINES = { rdc: 0.40, afrique: 0.30, monde: 0.30 };

    let isGenerating = false;

    const key = () => (window.OREA_CONFIG && OREA_CONFIG.GEMINI_KEY) || '';
    const model = () => (window.OREA_CONFIG && OREA_CONFIG.GEMINI_MODEL) || DEFAULT_MODEL;
    const isKeyMissing = () => !key() || key() === 'XXX';

    function frError(kind, detail) {
        // Accepte frError('invalid_key: détail') ou frError('invalid_key', 'détail')
        if (detail === undefined && typeof kind === 'string') {
            const i = kind.indexOf(':');
            if (i > 0) { detail = kind.slice(i + 1).trim(); kind = kind.slice(0, i).trim(); }
        }
        const MAP = {
            nokey: 'La clé Gemini n’est pas configurée.',
            network: 'Serveur Google indisponible.',
            network_fetch: 'Requête bloquée ou réseau coupé.',
            quota: 'Quota Gemini atteint.',
            notfound: 'Modèle introuvable.',
            badjson: 'Réponse de Gemini non valide.',
            refused: 'Gemini a refusé la génération.',
            busy: 'Génération déjà en cours.',
            invalid_key: 'Clé API refusée.',
            forbidden: 'Accès refusé (API non activée ?).',
            finish_reason: 'Génération interrompue.',
            other_http: 'Erreur HTTP de Google.'
        };
        const base = MAP[kind] || 'Erreur';
        return detail ? base + ' (' + detail + ')' : base;
    }

    function classifyHttp(status, body) {
        const t = String(body || '').toLowerCase();
        if (status === 400 && /api key not valid|invalid api key/.test(t)) return 'invalid_key';
        if (status === 401 || status === 403) return 'invalid_key';
        if (status === 404 && /model|not found/.test(t)) return 'notfound';
        if (status === 429) return 'quota';
        if (status === 400 && /safety/.test(t)) return 'refused';
        if (status >= 500) return 'network';
        return 'other_http';
    }

    function buildPrompt(opts) {
        const n = Math.max(BATCH_MIN, Math.min(BATCH_MAX, opts.count || 20));
        const diff = Math.max(1, Math.min(5, opts.niveau_difficulte || 2));
        const niveau = opts.niveau_scolaire === 'primaire' ? 'primaire (CE1-CM2)' : 'secondaire (6e-Humanités)';
        const theme = opts.theme ? ('Thème imposé : « ' + opts.theme + ' ».') : 'Thèmes libres, variés.';
        return `Tu génères ${n} questions de quiz en français pour l'application scolaire ORÉA École en RDC.

Niveau : ${niveau}. Difficulté : ${diff}/5. ${theme}
Origine : répartis approximativement comme suit → 40 % RDC, 30 % Afrique (hors RDC), 30 % reste du monde.
Matières : programme scolaire + culture générale.

RÈGLES STRICTES :
- Une seule bonne réponse par question.
- 3 distracteurs plausibles.
- Aucune ambiguïté.
- Question courte (max 180 caractères), choix courts (max 70 caractères).
- Explication d'une seule phrase, max 200 caractères.
- Écris uniquement du JSON valide, sans texte autour.

FORMAT ATTENDU (tableau JSON strict) :
[
  {
    "theme": "Géographie",
    "niveau_difficulte": ${diff},
    "origine": "rdc",
    "question": "Quelle est la capitale de la RDC ?",
    "choix": ["Lubumbashi", "Kinshasa", "Goma", "Kisangani"],
    "bonne_reponse": 1,
    "explication": "Kinshasa est la capitale de la République Démocratique du Congo."
  }
]

Rends UNIQUEMENT le tableau JSON, aucun commentaire.`;
    }

    function extractJson(text) {
        let s = String(text || '').trim();
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
        const first = s.indexOf('['), last = s.lastIndexOf(']');
        if (first === -1 || last === -1 || last <= first) throw new Error('badjson: pas de crochets JSON');
        const raw = s.slice(first, last + 1);
        try { return JSON.parse(raw); }
        catch (_) {
            const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
            try { return JSON.parse(cleaned); } catch(e) { throw new Error('badjson: ' + e.message); }
        }
    }

    function validate(list) {
        if (!Array.isArray(list) || !list.length) throw new Error('badjson: tableau vide');
        return list.filter(q =>
            q && typeof q.question === 'string' && q.question.trim().length >= 5
            && Array.isArray(q.choix) && q.choix.length === 4
            && q.choix.every(c => typeof c === 'string' && c.trim().length > 0)
            && typeof q.bonne_reponse === 'number' && q.bonne_reponse >= 0 && q.bonne_reponse <= 3
            && typeof q.niveau_difficulte === 'number'
        ).map(q => ({
            theme: String(q.theme || '').slice(0, 60),
            niveau_difficulte: Math.max(1, Math.min(5, q.niveau_difficulte)),
            origine: ['rdc','afrique','monde'].includes(q.origine) ? q.origine : 'monde',
            question: q.question.trim().slice(0, 500),
            choix: q.choix.slice(0, 4).map(c => c.trim().slice(0, 200)),
            bonne_reponse: q.bonne_reponse,
            explication: q.explication ? String(q.explication).slice(0, 400) : ''
        }));
    }

    async function callGemini(prompt) {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model()) + ':generateContent';

        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, responseMimeType: 'application/json', maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
                })
            });
        } catch (e) {
            throw new Error('network_fetch: ' + (e && e.message ? e.message : 'bloqué par le navigateur'));
        }

        const txt = await res.text();
        if (!res.ok) {
            const kind = classifyHttp(res.status, txt);
            // On extrait le message d'erreur de Google
            let googleMsg = txt;
            try {
                const j = JSON.parse(txt);
                if (j.error && j.error.message) googleMsg = j.error.message;
            } catch(_) {}
            throw new Error(kind + ': ' + googleMsg.slice(0, 150));
        }
        
        let body;
        try { body = JSON.parse(txt); } catch (_) { throw new Error('badjson: réponse globale non JSON'); }
        if (body && body.promptFeedback && body.promptFeedback.blockReason) throw new Error('refused: bloqué par la sécurité');

        const cand = body && body.candidates && body.candidates[0];
        if (cand && cand.finishReason && cand.finishReason !== 'STOP') {
             throw new Error('finish_reason: ' + cand.finishReason);
        }
        
        const parts = cand && cand.content && cand.content.parts;
        const text = parts && parts.map(p => p.text || '').join('') || '';
        if (!text.trim()) throw new Error('badjson: texte vide reçu');
        return text;
    }

    async function generateBatch(opts) {
        if (isKeyMissing()) throw new Error('nokey');
        if (isGenerating) throw new Error('busy');
        isGenerating = true;
        const prompt = buildPrompt(opts);
        
        try {
            // On ne fait qu'UN SEUL essai pour voir l'erreur exacte
            const raw = await callGemini(prompt);
            const diffAsked = Math.max(1, Math.min(5, opts.niveau_difficulte || 2));
            const list = validate(extractJson(raw).map(q => Object.assign({}, q, { niveau_difficulte: diffAsked })));
            if (!list.length) throw new Error('badjson: aucune question valide');
            return list.slice(0, Math.min(BATCH_MAX, list.length));
        } catch (e) {
            // On transmet l'erreur telle quelle
            throw new Error(e.message);
        } finally {
            isGenerating = false;
        }
    }

    async function ensureCache(opts) {
        const need = Math.max(1, opts.need || 20);
        let got = 0;
        if (!opts.force) {
            got = await QuizStorage.cacheCount(opts.school_id, opts.niveau_scolaire);
            if (got >= need) return { from: 'cache', have: got };
        }
        const manque = need - got;
        const lots = opts.force ? 1 : Math.ceil(manque / 20);
        let total = 0;
        
        for (let i = 0; i < lots; i++) {
            try {
                const list = await generateBatch({
                    count: 20,
                    niveau_difficulte: opts.niveau_difficulte,
                    niveau_scolaire: opts.niveau_scolaire,
                    theme: opts.theme
                });
                total += await QuizStorage.insertBatch(opts.school_id, opts.niveau_scolaire, list);
            } catch (e) {
                if (i === 0) throw e;
                break;
            }
        }
        return { from: 'gemini', added: total };
    }

    window.QuizAI = {
        generateBatch, ensureCache, frError,
        isKeyMissing,
        BATCH_MIN, BATCH_MAX, ORIGINES
    };
})();
