/* =====================================================================
   ORÉA École v95 — options.js : l'onglet « École » organisé par options
   Secondaire et complexe scolaire :
   1) Première ouverture : « Choisissez les options de votre école pour créer
      vos classes » + la liste des options en grille de 3 colonnes (ordre
      alphabétique) + « + Ajouter une option ». À la validation, la 7e et la
      8e (Éducation de base) sont créées par défaut (modifiables, supprimables).
   2) Ensuite : grille des groupes — Maternelle, Primaire (complexe),
      Éducation de base (7e – 8e), chaque option choisie, Classes sans option.
   3) En ouvrant un groupe : ses classes, « + Nouvelle classe » (option déjà
      remplie) et le raccourci « Créer 1ère, 2e, 3e et 4e ».
   Primaire / maternelle : page vide → « Créez votre première classe ».
   À charger APRÈS app.js.
   ===================================================================== */
(function () {
    'use strict';
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ALL = ['Agriculture', 'Arts plastiques', 'Assistance sociale', 'Chimie-Biologie', 'Commerciale et gestion', 'Comptabilité', 'Construction', 'Coupe et couture', 'Déclamation / Arts dramatiques', 'Électricité générale', 'Électronique générale', 'Élevage', 'Froid et Climatisation', 'Hôtellerie et Restauration', 'Imprimerie / Arts graphiques', 'Informatique', 'Installations électriques', 'Latin-Philosophie', 'Littéraire', 'Maçonnerie', 'Mathématiques-Physique', 'Mécanique automobile', 'Mécanique générale', 'Menuiserie', 'Menuiserie Ébénisterie', 'Métallurgie / Soudure', 'Nutrition', 'Pêche et Aquaculture', 'Pédagogie générale', 'Psycho-pédagogie', 'Sciences infirmières', 'Scientifique', 'Techniques commerciales', 'Télécommunications', 'Tourisme', 'Travail social'];
    // Liste mise par défaut en v93 : tant qu'elle n'a pas été modifiée, les options ne sont « pas encore choisies »
    const V93 = ['Pédagogie générale', 'Commerciale et gestion', 'Scientifique', 'Littéraire', 'Mécanique générale', 'Électricité', 'Électronique', 'Construction', 'Coupe et couture', 'Nutrition', 'Agriculture', 'Informatique'];
    const sortFr = a => a.slice().sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
    const SECONDARY = () => ['secondaire', 'complexe'].includes(schoolKind());
    const canEdit = () => S.me && S.me.role === 'directeur' && !S.me.secretariat && !S.ro;
    const chosen = () => { const L = classOptions(); return !(L.length === V93.length && L.every((x, i) => x === V93[i])); };
    const isBase = c => classLevel(c) === 'secondaire' && !c.option && /^\s*[78]\s*(e|è|ème|eme)?\b/i.test(c.name);
    const groupOf = c => { const l = classLevel(c); if (l === 'maternelle') return '@mat'; if (l === 'primaire') return '@pri'; if (isBase(c)) return '@base'; return c.option || '@none'; };
    const LBL = { '@mat': 'Maternelle', '@pri': 'Primaire', '@base': 'Éducation de base (7e – 8e)', '@none': 'Classes sans option' };
    const lbl = k => LBL[k] || k;
    S.optView = S.optView || null;

    const css = document.createElement('style');
    css.textContent = '.og{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}.og .ot{position:relative;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 6px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:74px;font-size:13px;line-height:1.25;color:var(--tx);user-select:none}.og .ot b{font-size:13.5px;font-weight:700;overflow-wrap:anywhere}.og .ot small{color:var(--mut);font-size:11.5px}.og .ot.on{border-color:var(--gold);background:rgba(199,163,75,.14);box-shadow:0 0 0 1px var(--gold) inset}.og .ot.on::after{content:"✓";position:absolute;top:4px;right:7px;color:var(--gold);font-weight:900}.og .ot.lock{opacity:.75}.og .ot.add{border-style:dashed;color:var(--gold)}.og .ot.fix{cursor:default;opacity:.85}@media (min-width:900px){body.desk .og{grid-template-columns:repeat(4,minmax(0,1fr))}}';
    document.head.appendChild(css);

    /* ---------- 1) Choix des options ---------- */
    function pickScreen(first) {
        const cur = new Set(chosen() ? classOptions() : []);
        const used = new Set(yc().map(c => c.option).filter(Boolean));
        const extra = classOptions().filter(o => !ALL.includes(o) && chosen());
        let list = sortFr([...new Set(ALL.concat(extra, [...used]))]);
        const sel = new Set([...cur, ...used]);
        const head = first ? `<div class="card col" style="text-align:center"><b>Bienvenue !</b><span>Choisissez les options de votre école pour créer vos classes.</span><small>La 7e et la 8e (Éducation de base) sont créées automatiquement : vous pourrez les modifier ou les supprimer.</small></div>`
            : `<div class=bar><button class=ghost style="width:auto" id=op-back>← École</button><b class=ctitle>Options de l’école</b></div><small>Une option qui a déjà des classes ne peut pas être retirée.</small>`;
        $('#main').innerHTML = ybar() + head + `<div class=og id=op-g></div><button id=op-ok>Valider les options</button>`;
        const g = $('#op-g');
        const draw = () => {
            g.innerHTML = list.map(o => `<div class="ot ${sel.has(o) ? 'on' : ''} ${used.has(o) ? 'lock' : ''}" data-o="${E(o)}"><b>${E(o)}</b>${used.has(o) ? '<small>a des classes</small>' : ''}</div>`).join('') + `<div class="ot add" id=op-add><b>+ Ajouter une option</b></div>`;
            g.querySelectorAll('[data-o]').forEach(t => t.onclick = () => { const o = t.dataset.o; if (used.has(o)) return toast('Cette option a des classes : elle reste.'); sel.has(o) ? sel.delete(o) : sel.add(o); t.classList.toggle('on'); });
            g.querySelector('#op-add').onclick = () => {
                const v = (prompt('Nom de la nouvelle option :') || '').trim().slice(0, 60);
                if (!v) return;
                if (list.some(x => x.toLowerCase() === v.toLowerCase())) { sel.add(list.find(x => x.toLowerCase() === v.toLowerCase())); return draw(); }
                list = sortFr(list.concat([v])); sel.add(v); draw();
            };
        };
        draw();
        const bk = $('#op-back'); if (bk) bk.onclick = () => { S.optView = null; render(); };
        $('#op-ok').onclick = async () => {
            if (!sel.size && !first) return toast('Choisissez au moins une option.');
            const L = sortFr([...sel]);
            const b = $('#op-ok'); b.disabled = true;
            // v96 : enregistrement par une fonction contrôlée (la modification directe était refusée par la base)
            const { data: saved, error } = await db.rpc('v96_set_school_options', { p_options: L.length ? L : ['Pédagogie générale'] });
            if (error) { b.disabled = false; return toast(error.message); }
            S.school.class_options = sortFr(saved || L);
            if (first) await createBase();
            S.optView = null; S.optPick = false; await load(); render();
            toast('Options enregistrées ✓');
        };
    }
    // 7e et 8e par défaut (Éducation de base)
    async function createBase() {
        const have = new Set(yc().filter(isBase).map(c => (c.name.match(/[78]/) || [''])[0]));
        const rows = ['7', '8'].filter(n => !have.has(n)).map(n => ({ school_id: S.school.id, name: n + 'e EB', year: S.year || schoolYearNow(), level: schoolKind() === 'complexe' ? 'secondaire' : null }));
        if (rows.length) { const { error } = await db.from('classes').insert(rows); if (error) toast(error.message); }
    }

    /* ---------- 2) Grille des groupes ---------- */
    function groupsScreen() {
        const cl = yc(), st = ys(), n = {}, k = {};
        cl.forEach(c => { const g = groupOf(c); k[g] = (k[g] || 0) + 1; });
        st.forEach(s => { const c = cl.find(x => x.id === s.class_id); if (c) { const g = groupOf(c); n[g] = (n[g] || 0) + 1; } });
        const keys = [];
        if (schoolKind() === 'complexe') keys.push('@mat', '@pri');
        keys.push('@base');
        sortFr(classOptions()).forEach(o => keys.push(o));
        Object.keys(k).forEach(g => { if (!keys.includes(g)) keys.push(g); });
        return `<div class=og>${keys.filter(g => g !== '@none' || k[g]).map(g => `<div class="ot" data-g="${E(g)}"><b>${E(lbl(g))}</b><small>${k[g] || 0} classe${(k[g] || 0) > 1 ? 's' : ''} · ${n[g] || 0} élève${(n[g] || 0) > 1 ? 's' : ''}</small></div>`).join('')}</div>`
            + (canEdit() ? `<button class=ghost id=op-manage>⚙ Gérer les options</button>` : '');
    }

    /* ---------- 3) Classes d'un groupe ---------- */
    const SETS = { '@mat': ['1ère maternelle', '2e maternelle', '3e maternelle'], '@pri': ['1ère primaire', '2e primaire', '3e primaire', '4e primaire', '5e primaire', '6e primaire'], '@base': ['7e EB', '8e EB'] };
    function groupScreen(g) {
        const cl = yc().filter(c => groupOf(c) === g), st = ys();
        const by = {}; st.forEach(s => { by[s.class_id] = (by[s.class_id] || 0) + 1; });
        const set = SETS[g] || ['1ère A', '2e A', '3e A', '4e A'];
        const missing = g === '@none' ? [] : set.filter(nm => !cl.some(c => c.name.toLowerCase() === nm.toLowerCase()));
        return `<div class=bar><button class=ghost style="width:auto" id=og-back>← Options</button><b class=ctitle>${E(lbl(g))}</b></div>`
            + (cl.length ? `<div class=cgrid>${cl.map(c => `<div class=ccard style="position:relative" onclick="openClass('${c.id}')">${canEdit() ? `<button type=button class="ghost no-ico" data-ec="${c.id}" aria-label="Modifier la classe" style="position:absolute;top:4px;right:4px;width:30px;min-height:30px;padding:0;border:0;box-shadow:none;background:none">✏️</button>` : ''}<b>${E(c.name)}</b><small>${by[c.id] || 0} élève${(by[c.id] || 0) > 1 ? 's' : ''}</small>${classFeesUnset(c) && typeof fin === 'function' && fin() ? '<span class="cd due">Frais à fixer</span>' : classFree(c) ? '<span class="cd ok">Gratuité</span>' : ''}</div>`).join('')}</div>` : '<p class=empty>Aucune classe dans ce groupe.</p>')
            + (canEdit() ? `<div class=col>${missing.length ? `<button id=og-set>Créer ${missing.length === set.length ? (g.startsWith('@') ? missing.join(', ') : '1ère, 2e, 3e et 4e') : missing.join(', ')}</button>` : ''}<button class=ghost id=og-new>+ Nouvelle classe${g.startsWith('@') ? '' : ' (' + E(g) + ')'}</button>${cl.length ? '<small>✏️ sur une classe : la renommer (ex. « 1ère B »), changer son option ou la supprimer si elle est vide.</small>' : ''}</div>` : '');
    }
    async function createSet(g) {
        const set = (SETS[g] || ['1ère A', '2e A', '3e A', '4e A']).filter(nm => !yc().some(c => groupOf(c) === g && c.name.toLowerCase() === nm.toLowerCase()));
        const level = g === '@mat' ? 'maternelle' : g === '@pri' ? 'primaire' : (schoolKind() === 'complexe' ? 'secondaire' : null);
        const rows = set.map(nm => ({ school_id: S.school.id, name: nm, year: S.year || schoolYearNow(), level, option: g.startsWith('@') ? null : g }));
        const { error } = await db.from('classes').insert(rows);
        if (error) return toast(error.message);
        await load(); render(); toast(rows.length + ' classe(s) créée(s) · frais à fixer');
    }

    // Renommer, changer d'option, supprimer une classe vide
    function editClass(id) {
        const c = S.classes.find(x => x.id === id); if (!c) return;
        const nSt = S.stu.filter(s => s.class_id === id).length;
        const F = [{ n: 'name', l: 'Nom de la classe', v: c.name }];
        if (classLevel(c) === 'secondaire') F.push({ n: 'opt', l: 'Option', o: [['', '— aucune (ex. 7e, 8e) —']].concat(sortFr(classOptions()).map(o => [o, o])), v: c.option || '' });
        F.push({ n: 'act', l: 'Action', o: [['save', 'Enregistrer les modifications']].concat(nSt ? [] : [['del', 'Supprimer cette classe (vide)']]), v: 'save' });
        ask('Classe · ' + E(c.name) + (nSt ? ' (' + nSt + ' élève' + (nSt > 1 ? 's' : '') + ')' : ''), F, async v => {
            if (v.act === 'del') {
                if (!confirm('Supprimer la classe « ' + c.name + ' » ?')) return;
                const { error } = await db.rpc('v95_delete_class', { p_class: id }); if (error) throw error;
                await load(); render(); return toast('Classe supprimée');
            }
            const row = { name: v.name.trim() || c.name };
            if ('opt' in v) row.option = v.opt || null;
            const { error } = await db.from('classes').update(row).eq('id', id); if (error) throw error;
            await load(); render(); toast('Classe modifiée ✓');
        });
    }

    /* ---------- Branchement sur l'onglet École (vue « grille », sans recherche) ---------- */
    const oV = window.vEleves;
    if (typeof oV === 'function') window.vEleves = function () {
        const cl = yc();
        if (S.view === 'class' || S.q) return oV.apply(this, arguments);
        if (!SECONDARY()) {
            if (cl.length) return oV.apply(this, arguments);
            $('#main').innerHTML = ybar() + `<div class="card col" style="text-align:center"><b>Bienvenue !</b><span>Créez votre première classe pour commencer.</span>${dir() ? '<button onclick=addClass()>+ Créer une classe</button>' : '<small>La direction doit d’abord créer les classes.</small>'}</div>`;
            return;
        }
        // Secondaire / complexe
        if (S.optPick || (!chosen() && !cl.length)) {
            if (!canEdit()) { $('#main').innerHTML = ybar() + '<div class="card col" style="text-align:center"><b>École en préparation</b><small>La direction doit d’abord choisir les options et créer les classes.</small></div>'; return; }
            return pickScreen(!chosen() && !cl.length);
        }
        if (S.optView) {
            $('#main').innerHTML = ybar() + groupScreen(S.optView);
            $('#og-back').onclick = () => { S.optView = null; render(); };
            const st = $('#og-set'); if (st) st.onclick = () => { st.disabled = true; createSet(S.optView); };
            const nw = $('#og-new'); if (nw) nw.onclick = () => addClass(null, S.optView);
            document.querySelectorAll('[data-ec]').forEach(b => b.onclick = e => { e.stopPropagation(); editClass(b.dataset.ec); });
            return;
        }
        $('#main').innerHTML = ybar() + `<input id=q type=search placeholder="🔍 Rechercher un élève (toutes les classes)" value="${E(S.q)}">` + groupsScreen()
            + (dir() && cl.length ? `<div class=row><button onclick=addStudent()>+ Élève</button><button class=ghost onclick=bulkAdd()>+ Liste</button></div>` : '');
        $('#q').oninput = e => { S.q = e.target.value; if (S.q) { oV(); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } };
        document.querySelectorAll('[data-g]').forEach(t => t.onclick = () => { S.optView = t.dataset.g; render(); });
        const mg = $('#op-manage'); if (mg) mg.onclick = () => { S.optPick = true; render(); };
    };
    // Changement d'onglet : on repart de la grille des options
    const oGo = window.goTab;
    if (typeof oGo === 'function') window.goTab = function (t) { if (t === 'eleves' && S.tab !== 'eleves') { S.optView = null; S.optPick = false; } return oGo.apply(this, arguments); };
})();
