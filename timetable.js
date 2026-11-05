/* =====================================================================
   ORÉA École v69 — timetable.js (modèle par défaut appliqué automatiquement, copier vers / depuis une classe)
   « Horaires des cours » : grille 2x3 (Lundi/Mardi, Mercredi/Jeudi, 
   Vendredi/Samedi). Le cours en cours est surligné.
   ===================================================================== */
(function () {
    'use strict';

    const PARENT = !!document.getElementById('pmain');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const hh = t => t ? String(t).slice(0, 5) : '';
    const mins = t => { const m = /^(\d+):(\d+)/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const DAYN = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const SPECIAL = ['RECREATION', 'RECRE', 'PAUSE', 'FIN'];
    const isSpecial = t => t.is_special === true || SPECIAL.includes(norm(t.subject));
    const say = m => { try { if (typeof toast === 'function') toast(m); else alert(m); } catch (_) { } };

    /* ---------------------------------------------------------------
       Style : Grille 2x3
       --------------------------------------------------------------- */
    function injectCss() {
        if (document.getElementById('tt-css')) return;
        const s = document.createElement('style');
        s.id = 'tt-css';
        s.textContent = `
.tt-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}
.tt-d{background:var(--card,#1b1b18);border:1px solid var(--line,#33312a);border-radius:10px;padding:6px;min-width:0}
.tt-d h5{margin:0 0 4px;text-align:center;font-size:12px;color:var(--gold,#c7a34b);text-transform:uppercase;letter-spacing:.05em}
.tt-d.today{border-color:var(--gold,#c7a34b)}
.tt-d.today h5::after{content:" ●"}
.tt-s{padding:4px 6px;border-radius:6px;margin-bottom:4px;border-left:3px solid transparent;font-size:11.5px;line-height:1.25;overflow-wrap:anywhere}
.tt-s i{display:block;font-style:normal;color:var(--mut,var(--muted,#a8a495));font-variant-numeric:tabular-nums;font-size:10px}
.tt-s b{display:block;font-weight:600;color:var(--tx)}
.tt-s small{display:block;color:var(--mut,var(--muted,#a8a495));font-size:10px}
.tt-s.sp{background:rgba(224,138,30,.14);border-left-color:#E08A1E}
.tt-s.sp b{color:#E08A1E;text-transform:uppercase;letter-spacing:.04em}
.tt-s.now{background:rgba(199,163,75,.30);border-left-color:var(--gold,#c7a34b);box-shadow:0 0 0 1px var(--gold,#c7a34b);animation:ttPulse 2.4s ease-in-out infinite}
.tt-s.now i::before{content:"▶ "}
.tt-s.sel{outline:2px solid #3b82f6;outline-offset:1px}
.tt-edit .tt-s{cursor:pointer}
@keyframes ttPulse{50%{box-shadow:0 0 0 3px rgba(199,163,75,.35)}}
.tt-bar{display:flex;gap:8px;margin:12px 0}
.tt-bar button{flex:1;width:auto!important;padding:10px 6px!important;font-size:14px}
.tt-bar button:disabled{opacity:.4}
.tt-ro{display:block;color:var(--mut,var(--muted,#a8a495));margin:6px 0;font-size:12.5px}
.tt-cl{margin:10px 0 0;color:var(--gold,#c7a34b)}
@media (prefers-reduced-motion:reduce){.tt-s.now{animation:none}}
`;
        document.head.appendChild(s);
    }

    /* ---------------------------------------------------------------
       Grille (partagée école / parent)
       --------------------------------------------------------------- */
    function grid(rows, editable, sel) {
        const by = {};
        rows.forEach(t => { (by[t.day] = by[t.day] || []).push(t); });
        const days = [1, 2, 3, 4, 5, 6]; // Lundi à Samedi
        return '<div class="tt-g' + (editable ? ' tt-edit' : '') + '">' + days.map(d => {
            const l = (by[d] || []).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
            return `<div class="tt-d" data-d="${d}"><h5>${DAYN[d]}</h5>` + l.map(t => {
                const sp = isSpecial(t);
                const name = sp ? String(t.subject).toLocaleUpperCase('fr') : t.subject;
                const e = hh(t.end_time), s = hh(t.start_time);
                return `<div class="tt-s${sp ? ' sp' : ''}${sel === t.id ? ' sel' : ''}" data-id="${esc(t.id || '')}" data-d="${d}" data-s="${s}" data-e="${e}">`
                    + `<i>${s}${e && e !== s ? '–' + e : ''}</i><b>${esc(name)}</b>${t.room ? `<small>${esc(t.room)}</small>` : ''}</div>`;
            }).join('') + '</div>';
        }).join('') + '</div>';
    }

    // Surligne le jour d'aujourd'hui et le cours en cours
    function paintNow() {
        const n = new Date(), d = n.getDay(), m = n.getHours() * 60 + n.getMinutes();
        document.querySelectorAll('.tt-g').forEach(g => {
            g.querySelectorAll('.tt-d').forEach(c => c.classList.toggle('today', +c.dataset.d === d));
            g.querySelectorAll('.tt-s').forEach(c => {
                const s = mins(c.dataset.s), e = mins(c.dataset.e);
                c.classList.toggle('now', +c.dataset.d === d && s != null && e != null && e > s && m >= s && m < e);
            });
        });
    }
    setInterval(paintNow, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) paintNow(); });

    /* ---- ÉCOLE : écran « Horaires des cours » ---- */
    const TT = { rows: [], sel: null, model: false };
    // Modèle par défaut de l'école (table timetable_model) : copié dans chaque nouvelle classe
    const MODEL = '__model';
    const STD = [['06:30', '07:00', 'Arrivée à l’école', 0], ['07:00', '07:50', 'Cours 1', 0], ['07:50', '08:40', 'Cours 2', 0], ['08:40', '09:30', 'Cours 3', 0], ['09:30', '10:20', 'Cours 4', 0], ['10:20', '10:35', 'RÉCRÉATION', 1], ['10:35', '11:25', 'Cours 5', 0], ['11:25', '12:15', 'Cours 6', 0], ['12:15', '12:15', 'FIN', 1]];
    const tbl = () => TT.model ? 'timetable_model' : 'timetable';
    const canEdit = () => typeof S !== 'undefined' && S.me && S.me.role === 'directeur';
    const clsName = id => ((S.classes || []).find(c => c.id === (id || S.cls)) || {}).name || '';

    window.vEmploiTemps = function () {
        injectCss();
        const back = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>`;
        const yb = typeof ybar === 'function' ? ybar() : '';
        if (!yc().length) { $('#main').innerHTML = yb + back + `<p class=empty>Crée d'abord une classe.</p>`; return; }
        if (!yc().some(c => c.id === S.cls)) S.cls = yc()[0].id;
        TT.sel = null;
        if (!canEdit()) TT.model = false;
        let h = back + '<h3>Horaires des cours</h3>' + yb;
        h += `<div class=bar><select id=ttc>${canEdit() ? `<option value="${MODEL}" ${TT.model ? 'selected' : ''}>★ Modèle par défaut (nouvelles classes)</option>` : ''}${yc().map(c => `<option value="${c.id}" ${!TT.model && c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
        if (canEdit()) h += `<small class=tt-ro id=tt-mi style="display:${TT.model ? 'block' : 'none'}">Ce modèle est copié automatiquement dans chaque nouvelle classe. Les classes existantes ne changent pas, sauf si tu touches « Appliquer le modèle » dans une classe.</small><div class=row id=tt-cr style="display:${TT.model ? 'none' : 'flex'}"><button class=ghost id=tt-cp>Copier vers une classe</button><button class=ghost id=tt-cf>Copier depuis une classe</button></div>`;
        else h += `<small class=tt-ro>Seul le directeur peut modifier les horaires.</small>`;
        h += `<div id=ttl><div class=sk></div><div class=sk></div><div class=sk></div></div>`;
        if (canEdit()) h += `<div class=tt-bar><button id=tt-ed disabled>✏️ Modifier</button><button class=ghost id=tt-rm disabled>🗑 Supprimer</button><button id=tt-ad>＋ Ajouter</button></div><small class=tt-ro>Touche un créneau pour le choisir, puis « Modifier » ou « Supprimer ».</small>`;
        $('#main').innerHTML = h;
        $('#ttc').onchange = e => {
            TT.model = e.target.value === MODEL; if (!TT.model) S.cls = e.target.value; TT.sel = null;
            const mi = $('#tt-mi'), cr = $('#tt-cr'); if (mi) mi.style.display = TT.model ? 'block' : 'none'; if (cr) cr.style.display = TT.model ? 'none' : 'flex';
            loadTT();
        };
        if (canEdit()) {
            $('#tt-ad').onclick = addSlot;
            $('#tt-ed').onclick = editSlot;
            $('#tt-rm').onclick = removeSlot;
            $('#tt-cp').onclick = copyTT;
            $('#tt-cf').onclick = copyFrom;
        }
        loadTT();
    };
    window.drawTT = () => loadTT();

    async function loadTT() {
        const cid = S.cls, mod = TT.model;
        const q = mod ? db.from('timetable_model').select('*').eq('school_id', S.school.id) : db.from('timetable').select('*').eq('class_id', cid);
        const { data, error } = await q.order('day').order('start_time');
        if (S.tab !== 'emploi_temps' || cid !== S.cls || mod !== TT.model) return;
        const el = document.getElementById('ttl'); if (!el) return;
        if (error) { el.innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
        TT.rows = data || [];
        // Classe sans horaire : le modèle par défaut est appliqué automatiquement (une fois)
        if (!mod && !TT.rows.length && canEdit()) {
            TT.auto = TT.auto || {};
            if (!TT.auto[cid]) {
                TT.auto[cid] = 1;
                const r = await db.rpc('apply_default_timetable', { p_class: cid, p_replace: false });
                if (!r.error && r.data > 0) return loadTT();
            }
        }
        if (!TT.rows.some(r => r.id === TT.sel)) TT.sel = null;
        drawGrid();
    }

    function drawGrid() {
        const el = document.getElementById('ttl'); if (!el) return;
        el.innerHTML = TT.rows.length ? grid(TT.rows, canEdit(), TT.sel)
            : TT.model ? `<p class=empty data-ic="📅">Le modèle est vide : les nouvelles classes reçoivent l’horaire standard (6h30 → 12h15).</p><div class=col><button id=tt-ms>Partir de l’horaire standard</button>${yc().length ? `<button class=ghost id=tt-mc>Partir de l’horaire d’une classe</button>` : ''}</div>`
            : `<p class=empty data-ic="📅">${canEdit() ? 'Aucun horaire pour cette classe.<br>Touche « Ajouter » ou « Copier depuis une classe ».' : 'L’horaire de cette classe n’a pas encore été préparé par la direction.'}</p>`;
        if (!TT.model && canEdit()) el.insertAdjacentHTML('beforeend', `<p style="text-align:center;margin:10px 0 0"><a href="#" id=tt-df style="font-size:12px;color:var(--mut)">Réappliquer le modèle par défaut</a></p>`);
        const df = document.getElementById('tt-df'); if (df) df.onclick = e => { e.preventDefault(); applyDefault(); };
        const ms = document.getElementById('tt-ms'), mc = document.getElementById('tt-mc');
        if (ms) ms.onclick = modelFromStd;
        if (mc) mc.onclick = modelFromClass;
        if (canEdit()) el.querySelectorAll('.tt-s').forEach(c => c.onclick = () => {
            TT.sel = TT.sel === c.dataset.id ? null : c.dataset.id;
            el.querySelectorAll('.tt-s').forEach(x => x.classList.toggle('sel', x.dataset.id === TT.sel));
            syncBar();
        });
        syncBar(); paintNow();
    }
    function syncBar() {
        const a = document.getElementById('tt-ed'), b = document.getElementById('tt-rm');
        if (a) a.disabled = !TT.sel; if (b) b.disabled = !TT.sel;
    }

    function slotFields(t) {
        const days = [['1', 'Lundi'], ['2', 'Mardi'], ['3', 'Mercredi'], ['4', 'Jeudi'], ['5', 'Vendredi'], ['6', 'Samedi']];
        if (t && t.day === 0) days.push(['0', 'Dimanche']);
        if (!t) days.unshift(['all', 'Tous les jours (lundi → samedi)']);
        return [
            { n: 'day', l: 'Jour', o: days, v: t ? String(t.day) : '1' },
            { n: 'kind', l: 'Type', o: [['c', 'Cours'], ['s', 'RÉCRÉATION / FIN / PAUSE']], v: t && isSpecial(t) ? 's' : 'c' },
            { n: 'subject', l: 'Nom (matière, RÉCRÉATION…)', v: t ? t.subject : '' },
            { n: 'start', l: 'Heure de début', t: 'time', v: t ? hh(t.start_time) : '07:00' },
            { n: 'end', l: 'Heure de fin', t: 'time', v: t ? hh(t.end_time) : '07:50' },
            { n: 'room', l: 'Salle (facultatif)', r: false, v: t && t.room || '' }
        ];
    }
    function payload(v) {
        const sp = v.kind === 's' || SPECIAL.includes(norm(v.subject));
        const subject = sp ? v.subject.trim().toLocaleUpperCase('fr') : v.subject.trim();
        if (!subject) throw Error('Écris un nom.');
        if (sp ? v.end < v.start : v.end <= v.start) throw Error("L'heure de fin doit être après le début.");
        return { subject, start_time: v.start, end_time: v.end, room: (v.room || '').trim() || null, is_special: sp, is_default: false };
    }
    // Une ligne prête pour la table affichée (classe ou modèle)
    const rowFor = (d, p) => TT.model
        ? { school_id: S.school.id, day: d, subject: p.subject, start_time: p.start_time, end_time: p.end_time, room: p.room, is_special: p.is_special }
        : Object.assign({ school_id: S.school.id, class_id: S.cls, year: S.year || '', day: d }, p);
    const modelRow = p => { const o = Object.assign({}, p); if (TT.model) delete o.is_default; return o; };
    function addSlot() {
        ask('Nouveau créneau — ' + esc(TT.model ? 'Modèle par défaut' : clsName()), slotFields(), async v => {
            const p = payload(v);
            const days = v.day === 'all' ? [1, 2, 3, 4, 5, 6] : [+v.day];
            const rows = days.map(d => rowFor(d, p));
            const { error } = await db.from(tbl()).insert(rows);
            if (error) throw error;
            say(rows.length > 1 ? 'Créneau ajouté aux 6 jours' : 'Créneau ajouté'); loadTT();
        });
    }
    function editSlot() {
        const t = TT.rows.find(r => r.id === TT.sel); if (!t) return say('Touche d’abord un créneau.');
        ask('Modifier le créneau', slotFields(t), async v => {
            const p = payload(v);
            const { data, error } = await db.from(tbl()).update(Object.assign({ day: +v.day }, modelRow(p))).eq('id', t.id).select('id');
            if (error) throw error;
            if (!data || !data.length) throw Error('Modification refusée (seul le directeur peut modifier).');
            say('Créneau modifié'); loadTT();
        });
    }
    async function removeSlot() {
        const t = TT.rows.find(r => r.id === TT.sel); if (!t) return say('Touche d’abord un créneau.');
        if (!confirm('Supprimer « ' + t.subject + ' » (' + DAYN[t.day] + ' ' + hh(t.start_time) + ') ?')) return;
        const { data, error } = await db.from(tbl()).delete().eq('id', t.id).select('id');
        if (error) return say(error.message);
        if (!data || !data.length) return say('Suppression refusée.');
        TT.sel = null; say('Créneau supprimé'); loadTT();
    }

    function copyTT() {
        const others = yc().filter(c => c.id !== S.cls);
        if (!others.length) return say('Il faut au moins une autre classe.');
        ask('Copier les horaires de ' + esc(clsName()) + ' vers…', [
            { n: 'to', l: 'Classe de destination (ses horaires actuels seront remplacés)', o: others.map(c => [c.id, esc(c.name)]) }
        ], async v => {
            const to = others.find(c => c.id === v.to); if (!to) return;
            if (!confirm('Remplacer tous les horaires de « ' + to.name + ' » par ceux de « ' + clsName() + ' » ?')) return;
            const { data, error } = await db.rpc('copy_timetable', { p_from: S.cls, p_to: to.id });
            if (error) throw error;
            say((data || 0) + ' créneaux copiés vers ' + to.name);
        });
    }
    // Reprend l'horaire d'une autre classe (remplace celui de la classe affichée)
    function copyFrom() {
        const others = yc().filter(c => c.id !== S.cls);
        if (!others.length) return say('Il faut au moins une autre classe.');
        ask('Copier vers ' + esc(clsName()) + ' l’horaire de…', [
            { n: 'from', l: 'Classe source (les horaires actuels de ' + esc(clsName()) + ' seront remplacés)', o: others.map(c => [c.id, esc(c.name)]) }
        ], async v => {
            const fr = others.find(c => c.id === v.from); if (!fr) return;
            if (!confirm('Remplacer tous les horaires de « ' + clsName() + ' » par ceux de « ' + fr.name + ' » ?')) return;
            const { data, error } = await db.rpc('copy_timetable', { p_from: fr.id, p_to: S.cls });
            if (error) throw error;
            say((data || 0) + ' créneaux copiés depuis ' + fr.name); TT.sel = null; loadTT();
        });
    }
    // Remplit le modèle avec l'horaire standard (lundi → samedi)
    async function modelFromStd() {
        const rows = [];
        for (let d = 1; d <= 6; d++) STD.forEach(x => rows.push({ school_id: S.school.id, day: d, start_time: x[0], end_time: x[1], subject: x[2], is_special: !!x[3], room: null }));
        const { error } = await db.from('timetable_model').insert(rows);
        if (error) return say(error.message);
        say('Modèle créé : modifie-le librement'); loadTT();
    }
    // Remplit le modèle avec l'horaire d'une classe existante
    function modelFromClass() {
        ask('Partir de l’horaire d’une classe', [{ n: 'c', l: 'Classe', o: yc().map(c => [c.id, esc(c.name)]) }], async v => {
            const { data, error } = await db.from('timetable').select('*').eq('class_id', v.c);
            if (error) throw error;
            if (!(data || []).length) throw Error('Cette classe n’a pas encore d’horaire.');
            const rows = data.map(t => ({ school_id: S.school.id, day: t.day, start_time: t.start_time, end_time: t.end_time, subject: t.subject, is_special: !!t.is_special, room: t.room || null }));
            const r = await db.from('timetable_model').insert(rows);
            if (r.error) throw r.error;
            say(rows.length + ' créneaux copiés dans le modèle'); loadTT();
        });
    }
    async function applyDefault() {
        if (!confirm('Remplacer TOUS les horaires de « ' + clsName() + ' » par le modèle par défaut de l’école ?')) return;
        const { data, error } = await db.rpc('apply_default_timetable', { p_class: S.cls, p_replace: true });
        if (error) return say(error.message);
        say((data || 0) + ' créneaux créés'); TT.sel = null; loadTT();
    }

    /* ---------------------------------------------------------------
       Branchements (sans modifier app.js / parent.js)
       --------------------------------------------------------------- */
    const hook = (name, fn) => {
        const o = window[name];
        if (typeof o !== 'function' || o.__tt) return;
        const w = fn(o); w.__tt = true; window[name] = w;
    };

    if (!PARENT) {
        hook('render', o => function () {
            const r = o.apply(this, arguments);
            try {
                if (S.tab === 'menu') document.querySelectorAll('.menu-card[onclick*="emploi_temps"] .menu-label').forEach(l => {
                    if (l.firstChild && l.firstChild.nodeType === 3) l.firstChild.textContent = 'Horaires des cours';
                });
            } catch (e) { console.error('timetable', e); }
            return r;
        });
    } else {
        // Parent : la section « Emploi du temps » de l'onglet École devient « Horaires » (lecture seule)
        const clsOf = (k, t) => t.class_name || ((typeof P !== 'undefined' && P.children) || []).filter(c => c.class_id === k).map(c => c.name).join(', ') || 'Classe';
        const parentHtml = () => {
            const rows = (typeof P !== 'undefined' && P.tt) || [];
            let h = '<h4>📅 Horaires</h4>';
            if (!rows.length) return h + '<div class="p-empty">Aucun horaire pour l’instant.</div>';
            const g = {}; rows.forEach(t => { const k = t.class_id || '_'; (g[k] = g[k] || []).push(t); });
            const ks = Object.keys(g);
            ks.forEach(k => { if (ks.length > 1) h += `<h5 class="tt-cl">${esc(clsOf(k, g[k][0]))}</h5>`; h += grid(g[k], false, null); });
            return h + '<small class="tt-ro">Le cours en cours est mis en évidence.</small>';
        };
        hook('scolariteView', o => function () {
            const r = o.apply(this, arguments);
            try {
                injectCss();
                const sec = [...document.querySelectorAll('#pmain .p-sec')].find(s => { const h = s.querySelector('h4'); return h && /emploi du temps/i.test(h.textContent); });
                if (sec) { sec.innerHTML = parentHtml(); paintNow(); }
            } catch (e) { console.error('timetable', e); }
            return r;
        });
    }
})();
