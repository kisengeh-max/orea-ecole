/* =====================================================================
   ORÉA École v100 — ia.js : l'IA dans ORÉA (paquet IA 1)
   1) « Préparer une leçon » dans la fenêtre de classe (enseignant,
      percepteur, Directeur des études, chef d'établissement).
      La fiche est écrite par Claude Haiku 5.5 via l'Edge Function
      « orea-ia ». La clé n'est jamais dans l'application.
   2) Mes fiches : enregistrées, modifiables, copiables, PDF, PNG, partage.
   3) Espace ORÉA, onglet « IA » : interrupteur global et par école,
      consommation du mois.
   L'IA propose, l'enseignant décide. Si l'IA échoue, seul ce bouton
   affiche « IA indisponible pour le moment ».
   À charger APRÈS app.js, notes.js et ambadmin.js, AVANT ui.js.
   ===================================================================== */
(function () {
    'use strict';
    const OFF = 'IA indisponible pour le moment.';
    const allowed = () => !!(S.me && (['enseignant', 'percepteur'].includes(S.me.role) || (S.me.role === 'directeur' && !S.me.secretariat)));
    const isHead = () => !!(S.me && S.me.role === 'directeur' && !S.me.etudes && !S.me.secretariat);
    const day = d => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; } };

    /* ---------- Crédits du mois (et présence du bouton) ---------- */
    S.ia = null;
    async function refresh() {
        try { const r = await db.rpc('v100_ia_credits'); S.ia = r.error ? null : r.data; } catch (_) { S.ia = null; }
        return S.ia;
    }
    let lastKey = '';
    setInterval(() => {
        const k = S.me && S.school ? S.me.id + '|' + S.school.id + '|' + S.me.role : '';
        if (k && k !== lastKey) { lastKey = k; refresh(); }
        if (!k) { lastKey = ''; S.ia = null; }
    }, 3000);
    const credTxt = () => {
        if (!S.ia) return '';
        let t = 'Ce mois : ' + (S.ia.mine || 0) + ' / ' + (S.ia.max || 20) + ' préparations';
        if (isHead() && S.ia.pct != null) t += '. Crédits IA de l’école utilisés : ' + S.ia.pct + ' %';
        return t;
    };

    /* ---------- Bouton dans la fenêtre de classe ---------- */
    const baseBtns = window.classBtns;
    if (typeof baseBtns === 'function') {
        window.classBtns = function () {
            let h = baseBtns.apply(this, arguments);
            if (S.ia && S.ia.on && allowed()) {
                const b = '<button class="ghost" style="width:auto" onclick="openPrepaLecon()">Préparer une leçon</button>';
                h = h ? h.replace(/<\/div>\s*$/, b + '</div>') : '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">' + b + '</div>';
            }
            return h;
        };
    }

    /* ---------- Cours de la classe ---------- */
    async function subjectsFor(cid) {
        const map = r => (r.data || []).map(x => ({ id: x.subject_id, name: x.subjects && x.subjects.name })).filter(x => x.id && x.name);
        let l = [];
        if (S.me.role !== 'directeur' || S.me.etudes) {
            try { const r = await db.from('teacher_subjects').select('subject_id, subjects(name)').eq('teacher_id', S.me.id).eq('class_id', cid).eq('year', S.year || ''); if (!r.error) l = map(r); } catch (_) { }
        }
        if (!l.length) { try { const r = await db.from('class_subjects').select('subject_id, subjects(name)').eq('class_id', cid); if (!r.error) l = map(r); } catch (_) { } }
        if (!l.length) { try { const r = await db.from('subjects').select('id,name').eq('school_id', S.school.id).order('name'); if (!r.error) l = (r.data || []).map(x => ({ id: x.id, name: x.name })); } catch (_) { } }
        const seen = new Set();
        return l.filter(x => !seen.has(x.id) && seen.add(x.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }

    /* ---------- Formulaire ---------- */
    let FORM = {};
    window.openPrepaLecon = async function () {
        const c = (S.classes || []).find(x => x.id === S.cls); if (!c) return;
        show('<h3>Préparer une leçon</h3><small>' + esc(c.name) + '</small>' + SK);
        const [subs] = await Promise.all([subjectsFor(c.id), refresh()]);
        const d = $('#dlg'); if (!d.open) return;
        if (!S.ia || !S.ia.on) { show('<h3>Préparer une leçon</h3><p class=empty>L’IA n’est pas activée pour votre école.</p><button class=ghost onclick="this.closest(\'dialog\').close()">Fermer</button>'); return; }
        if (!subs.length) { show('<h3>Préparer une leçon</h3><p class=empty>Aucun cours dans cette classe. Ajoutez d’abord les cours de la classe.</p><button class=ghost onclick="this.closest(\'dialog\').close()">Fermer</button>'); return; }
        const dur = FORM.dur || (['primaire', 'maternelle'].includes(c.level || '') ? 45 : 50);
        const full = (S.ia.mine || 0) >= (S.ia.max || 20);
        show('<h3>Préparer une leçon</h3><small>Classe : ' + esc(c.name) + '</small><div class=col style="margin-top:8px">'
            + '<label>Cours<select id=ia_sub>' + subs.map(s => '<option value="' + esc(s.id) + '"' + (s.id === FORM.sub ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label>'
            + '<label>Titre de la leçon<input id=ia_tit maxlength=150 autocomplete=off placeholder="Ex. : L’addition des nombres décimaux" value="' + esc(FORM.tit || '') + '"></label>'
            + '<label>Durée (minutes)<input id=ia_dur type=number inputmode=numeric min=10 max=240 value="' + dur + '"></label>'
            + '<label>Remarque (facultatif)<textarea id=ia_note rows=2 maxlength=400 placeholder="Ex. : classe nombreuse, peu de manuels">' + esc(FORM.note || '') + '</textarea></label>'
            + '<small id=ia_cred>' + esc(credTxt()) + '</small>'
            + (full ? '<p class=empty>Vos préparations de ce mois sont utilisées. Elles reviennent le 1er du mois prochain.</p>' : '<button id=ia_go>Préparer la fiche</button>')
            + '<button class=ghost id=ia_list>' + (S.me.role === 'directeur' ? 'Fiches de cette classe' : 'Mes fiches de cette classe') + '</button>'
            + '<button class=ghost id=ia_x>Fermer</button></div>');
        const q = s => d.querySelector(s);
        const keep = () => { FORM = { sub: q('#ia_sub').value, tit: q('#ia_tit').value, note: q('#ia_note').value, dur: +q('#ia_dur').value || dur }; };
        q('#ia_x').onclick = () => d.close();
        q('#ia_list').onclick = () => { keep(); listLessons(c); };
        if (q('#ia_go')) q('#ia_go').onclick = () => { keep(); generate(c, q('#ia_go')); };
    };

    async function generate(c, btn) {
        const tit = (FORM.tit || '').trim(), dur = Math.round(FORM.dur || 0);
        if (tit.length < 3) { toast('Écrivez le titre de la leçon.'); return; }
        if (dur < 10 || dur > 240) { toast('La durée doit être entre 10 et 240 minutes.'); return; }
        btn.disabled = true; btn.textContent = 'Préparation en cours (20 à 40 secondes)…';
        let msg = '', res = null;
        // Appel direct (90 s) : le client « db » coupe toute requête après 15 s, trop court pour l'IA
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 90000);
        try {
            const { data: { session } } = await db.auth.getSession();
            if (!session) throw new Error('Session expirée');
            const r = await fetch(OREA_CONFIG.SUPABASE_URL + '/functions/v1/orea-ia', {
                method: 'POST', signal: ctl.signal,
                headers: { 'Content-Type': 'application/json', apikey: OREA_CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token },
                body: JSON.stringify({ action: 'lecon', class_id: c.id, subject_id: FORM.sub, title: tit, note: (FORM.note || '').trim(), duration: dur })
            });
            const j = await r.json().catch(() => null);
            if (r.status === 401) msg = 'Session expirée : reconnectez-vous.'; else if (!j) msg = OFF; else if (!j.ok) msg = j.msg || OFF; else res = j;
        } catch (e) { msg = isNet(e) ? 'Pas de connexion internet.' : OFF; }
        clearTimeout(tm);
        if (S.ia && res) { S.ia.mine = res.mine; S.ia.max = res.max || S.ia.max; }
        const d = $('#dlg');
        if (!d.open) { toast(res ? 'Fiche prête : retrouvez-la dans « Mes fiches ».' : msg); return; }
        if (!res) { btn.disabled = false; btn.textContent = 'Préparer la fiche'; toast(msg); return; }
        FORM.tit = ''; FORM.note = '';
        const L = res.lesson; L.teacher_id = S.me.id; L.class_id = c.id;
        if (!L.id) toast('Fiche prête, mais non enregistrée. Copiez-la ou téléchargez-la.');
        viewLesson(L, c, true);
    }

    /* ---------- Liste des fiches ---------- */
    async function listLessons(c) {
        show('<h3>' + (S.me.role === 'directeur' ? 'Fiches' : 'Mes fiches') + ' · ' + esc(c.name) + '</h3>' + SK);
        let q = db.from('ia_lessons').select('id,title,subject_name,duration,content,created_at,teacher_id,class_id').eq('class_id', c.id).order('created_at', { ascending: false }).limit(60);
        if (S.me.role !== 'directeur') q = q.eq('teacher_id', S.me.id);
        let r; try { r = await q; } catch (e) { r = { error: e }; }
        const d = $('#dlg'); if (!d.open) return;
        const L = r.error ? null : (r.data || []);
        show('<h3>' + (S.me.role === 'directeur' ? 'Fiches' : 'Mes fiches') + ' · ' + esc(c.name) + '</h3>'
            + (!L ? '<p class=empty>Impossible de charger les fiches.</p>' : L.length ? '<div style="max-height:60vh;overflow-y:auto">' + L.map((x, i) => '<div class="card col" data-i="' + i + '" style="cursor:pointer"><b>' + esc(x.title) + '</b><small>' + esc(x.subject_name || '') + ' · ' + day(x.created_at) + (x.teacher_id !== S.me.id ? ' · un collègue' : '') + '</small></div>').join('') + '</div>' : '<p class=empty>Aucune fiche pour cette classe.</p>')
            + '<button class=ghost id=ia_back>Retour</button>');
        d.querySelectorAll('[data-i]').forEach(e => e.onclick = () => viewLesson(L[+e.dataset.i], c, false));
        d.querySelector('#ia_back').onclick = () => openPrepaLecon();
    }

    /* ---------- Une fiche ---------- */
    function viewLesson(L, c, fresh) {
        const own = !L.teacher_id || L.teacher_id === S.me.id;
        const d = show('<h3>' + esc(L.title) + '</h3><small>' + esc([L.subject_name, c.name, L.duration ? L.duration + ' min' : '', day(L.created_at)].filter(Boolean).join(' · ')) + '</small>'
            + '<p style="font-size:12.5px;margin:6px 0;color:var(--mut)">Proposition de l’IA : relisez-la et corrigez-la avant de l’utiliser.</p>'
            + '<textarea id=ia_txt' + (own ? '' : ' readonly') + ' style="width:100%;min-height:48vh;font-size:14px;line-height:1.45;white-space:pre-wrap">' + esc(L.content) + '</textarea>'
            + (own && L.id ? '<button id=ia_save hidden>Enregistrer les modifications</button>' : '')
            + '<div class=row style="margin-top:8px"><button class=ghost id=ia_cp>Copier</button><button class=ghost id=ia_pdf>PDF</button><button class=ghost id=ia_png>Image PNG</button></div>'
            + '<button class=ghost id=ia_sh>Partager</button>'
            + (own && L.id ? '<button class=ghost id=ia_del>Supprimer</button>' : '')
            + '<button class=ghost id=ia_back>' + (fresh ? 'Préparer une autre leçon' : 'Retour') + '</button>');
        const q = s => d.querySelector(s), txt = () => q('#ia_txt').value;
        const meta = () => ({ title: L.title, subject: L.subject_name, cls: c.name, dur: L.duration, text: txt() });
        if (q('#ia_save')) {
            q('#ia_txt').oninput = () => { q('#ia_save').hidden = false; };
            q('#ia_save').onclick = async () => {
                const b = q('#ia_save'); b.disabled = true;
                try { const r = await db.from('ia_lessons').update({ content: txt(), updated_at: new Date().toISOString() }).eq('id', L.id); if (r.error) throw r.error; L.content = txt(); b.hidden = true; toast('Modifications enregistrées.'); }
                catch (e) { toast(isNet(e) ? 'Pas de connexion internet.' : 'Enregistrement impossible.'); }
                b.disabled = false;
            };
        }
        q('#ia_cp').onclick = () => copy(txt());
        q('#ia_pdf').onclick = e => run(e.currentTarget, async () => { const P = await pages(meta()); dl(await pdfOf(P), fname(L, 'pdf')); toast('PDF enregistré dans Téléchargements.'); });
        q('#ia_png').onclick = e => run(e.currentTarget, async () => { dl(await pngOf(await pages(meta())), fname(L, 'png')); toast('Image enregistrée.'); });
        q('#ia_sh').onclick = e => run(e.currentTarget, async () => {
            const blob = await pngOf(await pages(meta())), file = new File([blob], fname(L, 'png'), { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: L.title }); } catch (x) { if (x.name !== 'AbortError') toast('Partage impossible.'); } }
            else { dl(blob, file.name); toast('Image enregistrée.'); }
        });
        if (q('#ia_del')) q('#ia_del').onclick = async () => {
            if (!confirm('Supprimer cette fiche ?')) return;
            try { const r = await db.from('ia_lessons').delete().eq('id', L.id); if (r.error) throw r.error; toast('Fiche supprimée.'); listLessons(c); }
            catch (e) { toast(isNet(e) ? 'Pas de connexion internet.' : 'Suppression impossible.'); }
        };
        q('#ia_back').onclick = () => fresh ? openPrepaLecon() : listLessons(c);
    }

    async function run(b, fn) { const t = b.textContent; b.disabled = true; b.textContent = 'Préparation…'; try { await fn(); } catch (e) { toast('Export impossible.'); } finally { b.disabled = false; b.textContent = t; } }
    async function copy(t) {
        try { await navigator.clipboard.writeText(t); toast('Fiche copiée.'); return; } catch (_) { }
        const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
        try { document.execCommand('copy'); toast('Fiche copiée.'); } catch (_) { toast('Copie impossible.'); } a.remove();
    }
    const slug = s => String(s || 'fiche').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'fiche';
    const fname = (L, e) => 'fiche-' + slug(L.title) + '-' + new Date().toISOString().slice(0, 10) + '.' + e;

    /* ---------- Mise en page A4 (canvas) ---------- */
    const W = 1240, H = 1754, M = 100, LH = 38, BODY = '26px Arial, Helvetica, sans-serif', BOLD = 'bold 27px Arial, Helvetica, sans-serif';
    const isTitle = s => s.length < 70 && /[A-ZÀ-Ý]/.test(s) && s === s.toUpperCase() && /[A-ZÀ-Ý]{3}/.test(s);
    async function pages(m) {
        const cv0 = document.createElement('canvas').getContext('2d'), lines = [];
        const wrap = (s, font, ind) => {
            cv0.font = font; const words = s.split(/\s+/), ind2 = ind + (/^-\s/.test(s) ? cv0.measureText('- ').width : 0); let cur = '', k = ind;
            words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (cv0.measureText(t).width > W - 2 * M - k && cur) { lines.push({ t: cur, font, ind: k }); cur = w; k = ind2; } else cur = t; });
            lines.push({ t: cur, font, ind: k });
        };
        String(m.text || '').split('\n').forEach(raw => {
            const s = raw.replace(/\t/g, '    ').trimEnd();
            if (!s.trim()) { lines.push({ gap: 1 }); return; }
            const ind = /^\s*-\s/.test(s) ? 24 : 0;
            if (isTitle(s.trim())) { lines.push({ gap: 1 }); wrap(s.trim(), BOLD, 0); } else wrap(s.trim(), BODY, ind);
        });
        const out = []; let cv, x, y;
        const start = first => {
            cv = document.createElement('canvas'); cv.width = W; cv.height = H; x = cv.getContext('2d');
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.fillStyle = '#16140f'; x.textBaseline = 'alphabetic';
            y = M;
            if (first) {
                x.font = 'bold 34px Georgia, serif'; x.fillText(String((S.school && S.school.name) || ''), M, y + 10);
                x.font = '24px Georgia, serif'; x.fillStyle = '#5f5a4d'; x.fillText('Fiche de préparation de leçon', M, y + 50);
                x.fillStyle = '#16140f'; x.font = 'bold 28px Arial, Helvetica, sans-serif';
                const tl = []; cv0.font = x.font; let cur = '';
                String(m.title || '').split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (cv0.measureText(t).width > W - 2 * M && cur) { tl.push(cur); cur = w; } else cur = t; }); tl.push(cur);
                y += 100; tl.slice(0, 3).forEach(t => { x.fillText(t, M, y); y += 38; });
                x.font = '22px Arial, Helvetica, sans-serif'; x.fillStyle = '#5f5a4d';
                x.fillText([m.subject, m.cls, m.dur ? m.dur + ' min' : ''].filter(Boolean).join(' · '), M, y); y += 22;
                x.fillStyle = '#b08a30'; x.fillRect(M, y, W - 2 * M, 3); y += 50; x.fillStyle = '#16140f';
            } else y += 20;
            out.push(cv);
        };
        start(true);
        lines.forEach(l => {
            if (l.gap) { if (y > M + 40) y += LH / 2; return; }
            if (y + LH > H - M) start(false);
            x.font = l.font; x.fillStyle = '#16140f'; x.fillText(l.t, M + l.ind, y + 26); y += LH;
        });
        out.forEach((c2, i) => { const z = c2.getContext('2d'); z.font = '20px Arial, Helvetica, sans-serif'; z.fillStyle = '#8a8475'; z.textAlign = 'center'; z.fillText('ORÉA École · page ' + (i + 1) + ' / ' + out.length, W / 2, H - 50); });
        return out;
    }
    function pngOf(P) {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H * P.length;
        const x = cv.getContext('2d'); P.forEach((p, i) => x.drawImage(p, 0, i * H));
        return new Promise(r => cv.toBlob(r, 'image/png'));
    }
    async function pdfOf(P) {
        const imgs = [];
        for (const p of P) { const b = await new Promise(r => p.toBlob(r, 'image/jpeg', 0.85)); imgs.push(new Uint8Array(await b.arrayBuffer())); }
        const enc = new TextEncoder(), parts = [], off = []; let len = 0;
        const put = v => { const b = typeof v === 'string' ? enc.encode(v) : v; parts.push(b); len += b.length; };
        const obj = (id, f) => { off[id] = len; put(id + ' 0 obj\n'); f(); put('\nendobj\n'); };
        put('%PDF-1.4\n');
        obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
        obj(2, () => put('<< /Type /Pages /Kids [' + imgs.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] /Count ' + imgs.length + ' >>'));
        imgs.forEach((b, i) => {
            const P0 = 3 + 3 * i, cs = 'q 595.28 0 0 841.89 0 0 cm /Im' + i + ' Do Q';
            obj(P0, () => put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im' + i + ' ' + (P0 + 2) + ' 0 R >> >> /Contents ' + (P0 + 1) + ' 0 R >>'));
            obj(P0 + 1, () => { put('<< /Length ' + cs.length + ' >>\nstream\n'); put(cs); put('\nendstream'); });
            obj(P0 + 2, () => { put('<< /Type /XObject /Subtype /Image /Width ' + W + ' /Height ' + H + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + b.length + ' >>\nstream\n'); put(b); put('\nendstream'); });
        });
        const n = 3 + 3 * imgs.length, xr = len;
        let t = 'xref\n0 ' + n + '\n0000000000 65535 f \n';
        for (let i = 1; i < n; i++) t += String(off[i]).padStart(10, '0') + ' 00000 n \n';
        put(t + 'trailer\n<< /Size ' + n + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
        return new Blob(parts, { type: 'application/pdf' });
    }

    /* ---------- Espace ORÉA : onglet IA ---------- */
    let ADMQ = '';
    window.oreaIaAdminSection = () => '<div id=ia-adm>' + SK + '</div>';
    window.oreaIaAdminBind = async function () {
        const box = document.getElementById('ia-adm'); if (!box) return;
        let r; try { r = await db.rpc('v100_ia_admin_list'); } catch (e) { r = { error: e }; }
        if (!document.getElementById('ia-adm')) return;
        if (r.error || !r.data) { box.innerHTML = '<p class=empty>Impossible de charger l’IA. Le SQL v100 a-t-il été exécuté ?</p>'; return; }
        const A = r.data, cin = A.cap_in || 2000000, cout = A.cap_out || 2000000;
        const pct = s => Math.min(100, Math.round(100 * Math.max(s.tin / cin, s.tout / cout)));
        const usd = v => Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' $';
        const draw = () => {
            const q = ADMQ.trim().toLowerCase(), L = (A.schools || []).filter(s => !q || String(s.name || '').toLowerCase().includes(q));
            box.innerHTML = '<div class="card col"><b>L’IA dans ORÉA</b><span>État général : <b>' + (A.global ? 'activée' : 'désactivée partout') + '</b></span><span>Coût ce mois, toutes écoles : <b>' + usd(A.total) + '</b></span><small>Par école : désactivée par défaut, sauf les écoles test. Plafond : 1,20 $ de Haiku par école et par mois.</small>'
                + '<button class="' + (A.global ? 'ghost' : '') + '" data-g="' + (A.global ? 0 : 1) + '">' + (A.global ? 'Désactiver l’IA partout' : 'Réactiver l’IA') + '</button></div>'
                + '<input id=ia_q type=search placeholder="Rechercher une école" autocomplete=off value="' + esc(ADMQ) + '">'
                + (L.length ? L.map(s => '<div class="card col"><b>' + esc(s.name) + '</b>' + (s.is_test ? '<small>École test</small>' : '') + '<span>IA : <b class="' + (s.actif ? 'ok' : '') + '">' + (s.actif ? 'activée' : 'désactivée') + '</b></span><small>Ce mois : ' + pct(s) + ' % des crédits · ' + s.lecons + ' fiche(s) · ' + usd(s.cost) + '</small><button class="' + (s.actif ? 'ghost' : '') + '" data-s="' + esc(s.id) + '" data-on="' + (s.actif ? 0 : 1) + '">' + (s.actif ? 'Désactiver l’IA' : 'Activer l’IA') + '</button></div>').join('') : '<p class=empty>Aucune école.</p>');
            const qi = box.querySelector('#ia_q'); qi.oninput = () => { ADMQ = qi.value; draw(); const n = box.querySelector('#ia_q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
            box.querySelectorAll('[data-g],[data-s]').forEach(b => b.onclick = async () => {
                const sid = b.dataset.s || null, on = (b.dataset.g || b.dataset.on) === '1';
                if (!sid && !on && !confirm('Désactiver l’IA pour toutes les écoles ?')) return;
                b.disabled = true;
                try { const x = await db.rpc('v100_ia_admin_set', { p_school: sid, p_on: on }); if (x.error) throw x.error; if (sid) { const s = A.schools.find(z => z.id === sid); if (s) s.actif = on; } else A.global = on; toast(on ? 'IA activée.' : 'IA désactivée.'); draw(); }
                catch (e) { b.disabled = false; toast(isNet(e) ? 'Pas de connexion internet.' : 'Modification impossible.'); }
            });
        };
        draw();
    };
})();
