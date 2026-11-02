/* =====================================================================
   ORÉA École v40 — quiz_ai.js (Version finale corrigée)
   Gère les nouvelles clés Google (AQ.Ab8...) et le modèle gemini-2.5-flash.
   À charger APRÈS quiz_storage.js, AVANT quiz_engine.js et quiz_ui.js.
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
        switch (kind) {
            case 'nokey':      return 'La clé Gemini n’est pas configurée (config.js → GEMINI_KEY).';
            case 'network':    return 'Échec de connexion à Google. Vérifie ton réseau. Détail : ' + (detail || 'inconnu');
            case 'quota':      return 'Quota Gemini atteint (limite journalière). Réessaie demain ou active la facturation.';
            case 'notfound':   return 'Modèle introuvable. Vérifie GEMINI_MODEL dans config.js (ex: gemini-2.5-flash).';
            case 'badjson':    return 'La réponse de Gemini n’était pas du JSON valide. Une nouvelle tentative a été faite.';
            case 'refused':    return 'Gemini a refusé la génération (safety). Change de thème.';
            case 'busy':       return 'Une génération est déjà en cours. Patiente quelques secondes.';
            case 'invalid_key':return 'Clé API refusée par Google. Vérifie qu’elle est bien copiée et active.';
            case 'forbidden':  return 'Accès refusé par Google. Vérifie que l’API Generative Language est activée.';
            default:           return 'Erreur IA : ' + (detail || 'inconnue');
        }
    }

    function classifyHttp(status, body) {
        const t = String(body || '').toLowerCase();
        if (status === 400 && /api key not valid|invalid api key/.test(t)) return 'invalid_key';
        if (status === 401 || status === 403) return 'invalid_key';
        if (status === 404 && /model|not found/.test(t)) return 'notfound';
        if (status === 429) return 'quota';
        if (status === 400 && /safety/.test(t)) return 'refused';
        if (status >= 500) return 'network';
        return 'other';
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
        if (first === -1 || last === -1 || last <= first) throw new Error('badjson');
        const raw = s.slice(first, last + 1);
        try { return JSON.parse(raw); }
        catch (_) {
            const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
            return JSON.parse(cleaned);
        }
    }

    function validate(list) {
        if (!Array.isArray(list) || !list.length) throw new Error('badjson');
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
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model()) + ':generateContent?key=' + encodeURIComponent(key());

        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
                    ]
                })
            });
        } catch (e) {
            throw new Error('network : ' + (e && e.message ? e.message : 'fetch failed'));
        }

        const txt = await res.text();
        if (!res.ok) {
            const kind = classifyHttp(res.status, txt);
            const detail = 'HTTP ' + res.status + ' — ' + txt.slice(0, 200);
            if (kind === 'other') throw new Error('gemini_http : ' + detail);
            throw new Error(kind + ' : ' + detail);
        }
        let body;
        try { body = JSON.parse(txt); } catch (_) { throw new Error('badjson'); }
        if (body && body.promptFeedback && body.promptFeedback.blockReason) throw new Error('refused');

        const cand = body && body.candidates && body.candidates[0];
        const parts = cand && cand.content && cand.content.parts;
        const text = parts && parts.map(p => p.text || '').join('') || '';
        if (!text.trim()) throw new Error('badjson');
        return text;
    }

    async function generateBatch(opts) {
        if (isKeyMissing()) throw new Error('nokey');
        if (isGenerating) throw new Error('busy');
        isGenerating = true;
        const prompt = buildPrompt(opts);
        try {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const raw = await callGemini(prompt);
                    const list = validate(extractJson(raw));
                    if (!list.length) throw new Error('badjson');
                    return list.slice(0, Math.min(BATCH_MAX, list.length));
                } catch (e) {
                    const code = String(e.message || '');
                    if (code === 'nokey' || code === 'refused' ||
                        code.startsWith('network') || code.startsWith('quota') ||
                        code.startsWith('notfound') || code.startsWith('invalid_key') ||
                        code.startsWith('forbidden') || code.startsWith('gemini_http')) throw e;
                    if (attempt === 2) throw new Error('badjson');
                }
            }
            throw new Error('badjson');
        } finally {
            isGenerating = false;
        }
    }

    async function ensureCache(opts) {
        const need = Math.max(1, opts.need || 20);
        const got = await QuizStorage.cacheCount(opts.school_id, opts.niveau_scolaire);
        if (got >= need) return { from: 'cache', have: got };
        
        const manque = need - got;
        const lots = Math.ceil(manque / 20);
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
