/* =====================================================================
   ORÉA École v40 — timetable.js
   « Horaires des cours » : grille 3×2 (lundi → samedi), cours en cours
   surligné, RÉCRÉATION / FIN / PAUSE en majuscules et en orange.
   Seul le directeur modifie. Les parents lisent seulement.
   À charger APRÈS app.js (page école) ou APRÈS parent.js (page parent).
   S'accroche de l'extérieur : app.js et parent.js ne sont pas modifiés.
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
       Style (injecté une seule fois)
       --------------------------------------------------------------- */
    function injectCss() {
        if (document.getElementById('tt-css')) return;
        const s = document.createElement('style');
        s.id = 'tt-css';
        s.textContent = `
.tt-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}
.tt-d{background:var(--card,#1b1b18);border:1px solid var(--line,#33312a);border-radius:10px;padding:5px 4px;min-width:0}
.tt-d h5{margin:0 0 4px;text-align:center;font-size:12px;color:var(--gold,#c7a34b);text-transform:uppercase;letter-spacing:.05em}
.tt-d.today{border-color:var(--gold,#c7a34b)}
.tt-d.today h5::after{content:" ●"}
.tt-s{padding:3px 4px;border-radius:6px;margin-bottom:3px;border-left:3px solid transparent;font-size:11px;line-height:1.25;overflow-wrap:anywhere}
.tt-s i{display:block;font-style:normal;color:var(--mut,var(--muted,#a8a495));font-variant-numeric:tabular-nums;font-size:10px}
.tt-s b{display:block;font-weight:600}
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
        const days = [1, 2, 3, 4, 5, 6];
        if (by[0]) days.push(0); // d'anciens créneaux du dimanche restent visibles (et supprimables)
        return '<div class="tt-g' + (editable ? ' tt-edit' : '') + '">' + days.map(d => {
            const l = (by[d] || []).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
            return `<div class="tt-d" data-d="${d}"><h5>${DAYN[d].slice(0, 3)}.</h5>` + l.map(t => {
                const sp = isSpecial(t);
                const name = sp ? String(t.subject).toLocaleUpperCase('fr') : t.subject;
                const e = hh(t.end_time), s = hh(t.start_time);
                return `<div class="tt-s${sp ? ' sp' : ''}${sel === t.id ? ' sel' : ''}" data-id="${esc(t.id || '')}" data-d="${d}" data-s="${s}" data-e="${e}">`
                    + `<i>${s}${e && e !== s ? '–' + e : ''}</i><b>${esc(name)}</b>${t.room ? `<small>${esc(t.room)}</small>` : ''}</div>`;
            }).join('') + '</div>';
        }).join('') + '</div>';
    }

    // Surligne le jour d'aujourd'hui et le cours en cours (relancé chaque minute)
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
    const TT = { rows: [], sel: null };
    const canEdit = () => typeof S !== 'undefined' && S.me && S.me.role === 'directeur';
    const clsName = id => ((S.classes || []).find(c => c.id === (id || S.cls)) || {}).name || '';

    window.vEmploiTemps = function () {
        injectCss();
        const back = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>`;
        const yb = typeof ybar === 'function' ? ybar() : '';
        if (!yc().length) { $('#main').innerHTML = yb + back + `<p class=empty>Crée d'abord une classe.</p>`; return; }
        if (!yc().some(c => c.id === S.cls)) S.cls = yc()[0].id;
        TT.sel = null;
        let h = back + '<h3>Horaires des cours</h3>' + yb;
        h += `<div class=bar><select id=ttc>${yc().map(c => `<option value="${c.id}" ${c.id === S.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;
        if (canEdit()) h += `<div class=row><button class=ghost id=tt-cp>📋 Copier vers une classe</button><button class=ghost id=tt-df>↺ Modèle par défaut</button></div>`;
        else h += `<small class=tt-ro>Seul le directeur peut modifier les horaires.</small>`;
        h += `<div id=ttl><div class=sk></div><div class=sk></div><div class=sk></div></div>`;
        if (canEdit()) h += `<div class=tt-bar><button id=tt-ed disabled>✏️ Modifier</button><button class=ghost id=tt-rm disabled>🗑 Supprimer</button><button id=tt-ad>＋ Ajouter</button></div><small class=tt-ro>Touche un créneau pour le choisir, puis « Modifier » ou « Supprimer ».</small>`;
        $('#main').innerHTML = h;
        $('#ttc').onchange = e => { S.cls = e.target.value; TT.sel = null; loadTT(); };
        if (canEdit()) {
            $('#tt-ad').onclick = addSlot;
            $('#tt-ed').onclick = editSlot;
            $('#tt-rm').onclick = removeSlot;
            $('#tt-cp').onclick = copyTT;
            $('#tt-df').onclick = applyDefault;
        }
        loadTT();
    };
    window.drawTT = () => loadTT(); // l'ancien nom reste utilisable

    async function loadTT() {
        const cid = S.cls;
        const { data, error } = await db.from('timetable').select('*').eq('class_id', cid).order('day').order('start_time');
        if (S.tab !== 'emploi_temps' || cid !== S.cls) return;
        const el = document.getElementById('ttl'); if (!el) return;
        if (error) { el.innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
        TT.rows = data || [];
        if (!TT.rows.some(r => r.id === TT.sel)) TT.sel = null;
        drawGrid();
    }

    function drawGrid() {
        const el = document.getElementById('ttl'); if (!el) return;
        el.innerHTML = TT.rows.length ? grid(TT.rows, canEdit(), TT.sel)
            : `<p class=empty data-ic="📅">Aucun horaire pour cette classe.${canEdit() ? '<br>Touche « Modèle par défaut » ou « Ajouter ».' : ''}</p>`;
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

    // --- FIN PARTIE 1/2. La partie suivante commence par : /* ---- Ajouter / modifier / supprimer ---- */

    /* ---- Ajouter / modifier / supprimer ---- */
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
    function addSlot() {
        ask('Nouveau créneau — ' + esc(clsName()), slotFields(), async v => {
            const p = payload(v);
            const days = v.day === 'all' ? [1, 2, 3, 4, 5, 6] : [+v.day];
            const rows = days.map(d => Object.assign({ school_id: S.school.id, class_id: S.cls, year: S.year || '', day: d }, p));
            const { error } = await db.from('timetable').insert(rows);
            if (error) throw error;
            say(rows.length > 1 ? 'Créneau ajouté aux 6 jours' : 'Créneau ajouté'); loadTT();
        });
    }
    function editSlot() {
        const t = TT.rows.find(r => r.id === TT.sel); if (!t) return say('Touche d’abord un créneau.');
        ask('Modifier le créneau', slotFields(t), async v => {
            const p = payload(v);
            const { data, error } = await db.from('timetable').update(Object.assign({ day: +v.day }, p)).eq('id', t.id).select('id');
            if (error) throw error;
            if (!data || !data.length) throw Error('Modification refusée (seul le directeur peut modifier).');
            say('Créneau modifié'); loadTT();
        });
    }
    async function removeSlot() {
        const t = TT.rows.find(r => r.id === TT.sel); if (!t) return say('Touche d’abord un créneau.');
        if (!confirm('Supprimer « ' + t.subject + ' » (' + DAYN[t.day] + ' ' + hh(t.start_time) + ') ?')) return;
        const { data, error } = await db.from('timetable').delete().eq('id', t.id).select('id');
        if (error) return say(error.message);
        if (!data || !data.length) return say('Suppression refusée.');
        TT.sel = null; say('Créneau supprimé'); loadTT();
    }

    /* ---- Copier / modèle par défaut ---- */
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
    async function applyDefault() {
        if (!confirm('Remplacer TOUS les horaires de « ' + clsName() + ' » par le modèle par défaut (6h30 → 12h15, lundi → samedi) ?')) return;
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
        // Menu : « Emploi du temps » devient « Horaires des cours »
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
