// ORÉA École — Module COTATION & BULLETINS (v40)
// Dépend de app.js (S, db, show, toast, esc, nf, fdate, tdy, pageAll, curTerm, cy, dir, SK) et de bulletins.js (OB).

S.cotTerm = null; S.cotScreen = 'home'; S.cotEval = null; S.cotSubs = []; S.cotEvals = {}; S.cotRows = {};
S.bulPeriod = null; S.bulStu = ''; S.bulRows = []; S.bulKey = null;
S.avg = {}; S.avgKey = null;
let cotTok = 0;

const COT_KINDS = ['Interrogation', 'Devoir', 'Examen'];
const COT_BASES = [5, 10, 15, 20, 30, 40, 50];
const cotCls = () => S.classes.find(c => c.id === S.cls);
const cotStudents = () => S.stu.filter(s => s.class_id === S.cls).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
const cotCurTerm = () => { const c = cotCls(), k = c ? curTerm(cy(c)) : null; return k > 0 ? k : 1; };
const cotNorm = g => ({ ...g, subject_name: (g.subjects && g.subjects.name) || 'Cours' });

document.head.insertAdjacentHTML('beforeend', '<style>'
    + '.avgp{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;background:rgba(199,163,75,.16);color:var(--gold);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}'
    + '.avgp.bad{color:var(--bad);background:rgba(168,90,78,.14)}'
    + '.cot-sub{font-family:var(--serif);font-size:20px;color:var(--gold);margin:18px 0 6px}'
    + '.cot-bar{position:sticky;bottom:calc(70px + env(safe-area-inset-bottom));padding:10px 0 4px;background:linear-gradient(transparent,var(--bg) 35%);z-index:5}'
    + '.cot-bar button{min-height:56px;font-size:17px}'
    + '.cot-in{margin:0!important;width:84px!important;text-align:center;font-weight:700;font-size:17px!important}'
    + '.cot-in:disabled{opacity:.55}'
    + 'input.bad{border-color:var(--bad)!important}'
    + '.cot-del{color:var(--bad)!important;border-color:var(--bad)!important;margin-top:10px}'
    + '</style>');

// ---------- Bannière « impayés » masquable + rendu ----------
const _renderBanner = window.render;
window.render = function () {
    _renderBanner();
    if (sessionStorage.getItem('hide_impayes_banner')) { const b = document.getElementById('exb'); if (b) b.hidden = true; }
};
document.addEventListener('click', function (e) {
    const btn = e.target.closest('#exb a, #exb button, #exb [onclick]');
    if (btn) { sessionStorage.setItem('hide_impayes_banner', '1'); const b = document.getElementById('exb'); if (b) b.hidden = true; }
}, true);

// ---------- Navigation ----------
function afterDlg(fn) {
    let n = 0;
    const t = () => { if ((!dlgPushed && !ignorePop) || n++ > 20) fn(); else setTimeout(t, 30); };
    setTimeout(t, 30);
}
function openCotation() {
    if (!['directeur', 'enseignant'].includes(S.me.role)) return;
    if (S.offline) return toast('Hors connexion : la cotation demande internet.');
    S.cotScreen = 'home'; S.cotEval = null; S.cotTerm = S.cotTerm || cotCurTerm();
    history.pushState({ cot: 1 }, ''); S.tab = 'cotation'; render();
}
function openBulletins() {
    if (!dir()) return;
    if (S.offline) return toast('Hors connexion : les bulletins demandent internet.');
    S.bulKey = null; history.pushState({ cot: 1 }, ''); S.tab = 'bulletins'; render();
}
function cotBack() {
    if (history.state && history.state.cot) { history.back(); return; }
    if (S.tab === 'cotation' && S.cotScreen === 'eval') S.cotScreen = 'home'; else S.tab = 'eleves';
    render();
}
function cotSetTerm(t) { S.cotTerm = t; render(); }

// ---------- Cours de la classe ----------
async function cotSubjects() {
    const { data } = await db.from('class_subjects').select('subject_id, subjects(name)').eq('class_id', S.cls);
    S.cotSubs = (data || []).filter(x => x.subjects).map(x => ({ id: x.subject_id, name: x.subjects.name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return S.cotSubs;
}
async function seedDefaultCourses() {
    const defaults = ['Français', 'Anglais', 'Mathématiques', 'Géographie', 'Histoire', 'Civisme', 'Éducation physique', 'Éducation à la vie', 'Éducation civique', 'Chimie', 'Physique'];
    const { error } = await db.from('subjects').insert(defaults.map(name => ({ school_id: S.school.id, name })));
    if (error) return toast('Erreur : ' + error.message);
    toast('Cours de base créés'); manageClassCourses();
}
async function manageClassCourses() {
    const { data: all } = await db.from('subjects').select('*').order('name');
    const { data: assigned } = await db.from('class_subjects').select('subject_id').eq('class_id', S.cls);
    const ids = new Set((assigned || []).map(a => a.subject_id));
    show(`<h3>Cours de la classe</h3>${(all || []).length ? '' : '<button class=ghost onclick="seedDefaultCourses()">Créer les cours de base (RDC)</button>'}<div style="max-height:50vh;overflow-y:auto;margin:10px 0">${(all || []).map(sub => `<div class=card style="padding:10px;margin:5px 0"><b>${esc(sub.name)}</b><button class="${ids.has(sub.id) ? 'ghost' : ''}" style="width:auto;padding:5px 15px;min-height:30px" onclick="toggleClassCourse('${sub.id}',${ids.has(sub.id)})">${ids.has(sub.id) ? 'Retirer' : 'Ajouter'}</button></div>`).join('')}</div><div class=bar><input id=mc_new placeholder="Nouveau cours…" style="flex:1;margin:0"><button class=ghost style="width:auto" onclick="addNewSubject()">+</button></div><button class=ghost style="margin-top:12px" onclick="this.closest('dialog').close();render()">Fermer</button>`);
}
async function toggleClassCourse(subjId, isAssigned) {
    const r = isAssigned ? await db.from('class_subjects').delete().match({ class_id: S.cls, subject_id: subjId })
        : await db.from('class_subjects').insert({ school_id: S.school.id, class_id: S.cls, subject_id: subjId });
    if (r.error) toast(r.error.message);
    manageClassCourses();
}
async function addNewSubject() {
    const name = $('#mc_new').value.trim(); if (!name) return;
    const { error } = await db.from('subjects').insert({ school_id: S.school.id, name });
    if (error) toast(error.message);
    manageClassCourses();
}

// ---------- COTATION : accueil (historique par trimestre) ----------
async function vCotation() {
    if (S.cotScreen === 'eval') return vCotEval();
    const c = cotCls(); if (!c) { S.tab = 'eleves'; return render(); }
    const term = S.cotTerm || 1, tok = ++cotTok;
    let h = `<div class=bar><button class=ghost style="width:auto" onclick="cotBack()">← ${esc(c.name)}</button><b class=ctitle>Cotation</b></div>`
        + `<div class=chips>${[1, 2, 3].map(t => `<button class="chip ${t === term ? 'on' : ''}" onclick="cotSetTerm(${t})">Trimestre ${t}</button>`).join('')}</div>`;
    $('#main').innerHTML = h + SK;
    const [subs, gr] = await Promise.all([cotSubjects(), pageAll(() => db.from('grades').select('id,subject_id,kind,num,max_grade,eval_date,created_by').eq('class_id', S.cls).eq('term', term))]);
    if (tok !== cotTok || S.tab !== 'cotation' || S.cotScreen !== 'home') return;
    if (gr.error) { $('#main').innerHTML = h + `<p class=empty>${esc(gr.error.message)}</p>`; return; }
    const total = cotStudents().length, ev = {};
    gr.data.forEach(g => {
        const k = g.subject_id + '|' + g.kind + '|' + g.num;
        const o = ev[k] || (ev[k] = { sid: g.subject_id, kind: g.kind, num: g.num, base: Number(g.max_grade), date: g.eval_date, mine: true, n: 0 });
        o.n++; if (g.created_by !== S.me.id) o.mine = false;
    });
    S.cotEvals = ev;
    if (!subs.length) {
        const { count } = await db.from('subjects').select('*', { count: 'exact', head: true });
        $('#main').innerHTML = h + `<div class="card col" style="text-align:center;padding:20px"><p>${count === 0 ? 'Aucun cours n’existe encore.' : 'Aucun cours dans cette classe.'}</p><button onclick="manageClassCourses()">⚙️ Gérer les cours de cette classe</button></div>`;
        return;
    }
    h += `<button onclick="cotNew()">＋ Nouvelle évaluation</button>`;
    h += subs.map(s => {
        const list = Object.values(ev).filter(e => e.sid === s.id).sort((a, b) => COT_KINDS.indexOf(a.kind) - COT_KINDS.indexOf(b.kind) || a.num - b.num);
        return `<div class=cot-sub>${esc(s.name)}</div>` + (list.length ? list.map(e => `<div class=card style="padding:12px 14px" onclick="cotOpen('${s.id}','${e.kind}',${e.num})"><span><b>${e.kind} ${e.num}</b> <small>(Base ${nf(e.base)})${e.date ? ' · ' + fdate(e.date) : ''}</small><br><small>${e.n} / ${total} cotés</small></span><span>${e.mine ? '›' : '🔒'}</span></div>`).join('') : '<small>Aucune évaluation ce trimestre.</small>');
    }).join('');
    h += `<button class=ghost style="margin-top:18px" onclick="manageClassCourses()">⚙️ Gérer les cours de cette classe</button>`;
    $('#main').innerHTML = h;
}

// ---------- COTATION : nouvelle évaluation ----------
async function cotNew() {
    const subs = S.cotSubs.length ? S.cotSubs : await cotSubjects();
    if (!subs.length) return toast('Ajoute d’abord des cours à cette classe.');
    const term = S.cotTerm || 1;
    const d = show(`<h3>Nouvelle évaluation</h3><div class=col>
        <label>Cours<select id=cn_sub>${subs.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
        <label>Type<select id=cn_kind>${COT_KINDS.map(k => `<option ${k === 'Devoir' ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Trimestre<select id=cn_term>${[1, 2, 3].map(t => `<option value="${t}" ${t === term ? 'selected' : ''}>Trimestre ${t}</option>`).join('')}</select></label>
        <label>Base</label>
        <div class=chips id=cn_bases style="flex-wrap:wrap">${COT_BASES.map(b => `<button class="chip ${b === 20 ? 'on' : ''}" data-b="${b}">Sur ${b}</button>`).join('')}<button class=chip data-b=custom>Personnalisé</button></div>
        <input id=cn_custom type=number step=any min=1 inputmode=decimal placeholder="Base personnalisée (ex : 25)" hidden>
        <label>Date<input id=cn_date type=date value="${tdy()}"></label>
        <small>Le numéro (Devoir 1, Devoir 2…) est attribué automatiquement.</small>
        <div class=row><button class=ghost id=cn_x>Annuler</button><button id=cn_ok>Continuer →</button></div></div>`);
    let base = '20';
    d.querySelectorAll('#cn_bases .chip').forEach(b => b.onclick = () => {
        base = b.dataset.b;
        d.querySelectorAll('#cn_bases .chip').forEach(x => x.classList.toggle('on', x === b));
        const ci = d.querySelector('#cn_custom'); ci.hidden = base !== 'custom'; if (base === 'custom') ci.focus();
    });
    d.querySelector('#cn_x').onclick = () => d.close();
    d.querySelector('#cn_ok').onclick = async () => {
        let bv = base === 'custom' ? parseFloat(String(d.querySelector('#cn_custom').value).replace(',', '.')) : Number(base);
        if (!(bv > 0)) return toast('Indique une base valide.');
        const sid = d.querySelector('#cn_sub').value, kind = d.querySelector('#cn_kind').value, tm = +d.querySelector('#cn_term').value, date = d.querySelector('#cn_date').value || tdy();
        const btn = d.querySelector('#cn_ok'); btn.disabled = true;
        const { data, error } = await db.from('grades').select('num').eq('class_id', S.cls).eq('subject_id', sid).eq('term', tm).eq('kind', kind).order('num', { ascending: false }).limit(1);
        if (error) { btn.disabled = false; return toast(error.message); }
        const sub = S.cotSubs.find(x => x.id === sid);
        S.cotEval = { subject_id: sid, subject_name: sub ? sub.name : 'Cours', term: tm, kind, num: ((data && data[0] && data[0].num) || 0) + 1, base: bv, date, isNew: true };
        S.cotTerm = tm; d.close();
        afterDlg(() => { S.cotScreen = 'eval'; history.pushState({ cot: 2 }, ''); render(); });
    };
}
function cotOpen(sid, kind, num) {
    const e = S.cotEvals[sid + '|' + kind + '|' + num], sub = S.cotSubs.find(x => x.id === sid);
    S.cotEval = { subject_id: sid, subject_name: sub ? sub.name : 'Cours', term: S.cotTerm, kind, num, base: e ? e.base : 20, date: e ? e.date : tdy(), isNew: false };
    S.cotScreen = 'eval'; history.pushState({ cot: 2 }, ''); render();
}

// ---------- COTATION : saisie des cotes ----------
async function vCotEval() {
    const e = S.cotEval, c = cotCls(); if (!e || !c) { S.cotScreen = 'home'; return render(); }
    $('#main').innerHTML = `<div class=bar><button class=ghost style="width:auto" onclick="cotBack()">← Retour</button><b class=ctitle>${esc(c.name)}</b></div>` + SK;
    const { data, error } = await db.from('grades').select('id,student_id,grade,created_by,max_grade,eval_date').eq('class_id', S.cls).eq('subject_id', e.subject_id).eq('term', e.term).eq('kind', e.kind).eq('num', e.num);
    if (S.cotEval !== e || S.tab !== 'cotation') return;
    if (error) { $('#main').innerHTML = `<p class=empty>${esc(error.message)}</p>`; return; }
    const rows = data || [];
    if (rows.length) { e.base = Number(rows[0].max_grade); if (rows[0].eval_date) e.date = rows[0].eval_date; }
    const locked = rows.some(r => r.created_by !== S.me.id);
    S.cotRows = Object.fromEntries(rows.map(r => [r.student_id, r]));
    const st = cotStudents();
    let h = `<div class=bar><button class=ghost style="width:auto" onclick="cotBack()">← Retour</button><b class=ctitle>${esc(c.name)}</b></div>`
        + `<div class=cot-sub style="font-size:24px;margin-top:8px">${esc(e.subject_name)}</div>`
        + `<div class="card col" style="padding:10px 14px"><b>${e.kind} ${e.num} (Base ${nf(e.base)})</b><small>${fdate(e.date)} · Trimestre ${e.term}</small></div>`;
    if (locked) h += `<div class="card" style="padding:10px 14px">🔒 <small>Cette évaluation a été saisie par un autre utilisateur. Lecture seule.</small></div>`;
    if (!st.length) { $('#main').innerHTML = h + '<p class=empty>Aucun élève dans cette classe.</p>'; return; }
    h += st.map((s, i) => {
        const r = S.cotRows[s.id], val = r ? r.grade : '', nx = i < st.length - 1 ? st[i + 1].id : '';
        return `<div class=card style="padding:10px 14px;margin:5px 0"><b style="font-size:15px">${esc(s.name)}</b><div style="display:flex;align-items:center;gap:6px">${locked ? '🔒' : ''}<input class=cot-in id="cg_${s.id}" type=number step=any min=0 max="${e.base}" inputmode=decimal value="${val}" ${locked ? 'disabled' : ''} onkeydown="if(event.key==='Enter'){event.preventDefault();${nx ? `document.getElementById('cg_${nx}').focus()` : 'this.blur()'}}"><small>/ ${nf(e.base)}</small></div></div>`;
    }).join('');
    if (!locked) {
        h += `<div class=cot-bar><button id=cot_save onclick="cotSave()">💾 Enregistrer</button></div>`;
        if (!e.isNew && rows.length) h += `<button class="ghost cot-del" onclick="cotDelete()">🗑 Supprimer cette évaluation</button>`;
    }
    $('#main').innerHTML = h;
}
async function cotSave() {
    const e = S.cotEval; if (!e) return;
    const up = [], del = []; let bad = null;
    cotStudents().forEach(s => {
        const el = document.getElementById('cg_' + s.id); if (!el || el.disabled) return;
        const raw = String(el.value).trim().replace(',', '.'), old = S.cotRows[s.id];
        el.classList.remove('bad');
        if (raw === '') { if (old) del.push(old.id); return; }
        const v = parseFloat(raw);
        if (isNaN(v) || v < 0 || v > e.base) { el.classList.add('bad'); if (!bad) bad = s; return; }
        up.push({ school_id: S.school.id, student_id: s.id, class_id: S.cls, subject_id: e.subject_id, term: e.term, kind: e.kind, num: e.num, label: e.kind + ' ' + e.num, grade: v, max_grade: e.base, eval_date: e.date, created_by: S.me.id });
    });
    if (bad) { toast(`Note invalide pour ${bad.name} (de 0 à ${nf(e.base)})`); document.getElementById('cg_' + bad.id).focus(); return; }
    if (!up.length && !del.length) return toast('Aucune note à enregistrer.');
    const btn = document.getElementById('cot_save'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Enregistrement…'; }
    try {
        if (up.length) { const { error } = await db.from('grades').upsert(up, { onConflict: 'student_id,class_id,subject_id,term,kind,num' }); if (error) throw error; }
        if (del.length) { const { error } = await db.from('grades').delete().in('id', del); if (error) throw error; }
    } catch (x) {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer'; }
        return toast(x.message || 'Erreur d’enregistrement');
    }
    S.avgKey = null; S.bulKey = null;
    toast(`✓ ${up.length} cote(s) enregistrée(s)${del.length ? ' · ' + del.length + ' effacée(s)' : ''}`);
    S.cotEval = null; cotBack();
}
async function cotDelete() {
    const e = S.cotEval; if (!e) return;
    if (!confirm(`Supprimer « ${e.kind} ${e.num} » en ${e.subject_name} ? Toutes les cotes de cette évaluation seront effacées.`)) return;
    const { error } = await db.from('grades').delete().eq('class_id', S.cls).eq('subject_id', e.subject_id).eq('term', e.term).eq('kind', e.kind).eq('num', e.num);
    if (error) return toast(error.message);
    S.avgKey = null; S.bulKey = null; S.cotEval = null; toast('Évaluation supprimée'); cotBack();
}

// ---------- Moyennes de la classe (pastilles + tri) ----------
async function loadClassAvg() {
    if (!S.me || S.me.role === 'percepteur' || S.offline || S.view !== 'class' || !S.cls) return;
    const cls = S.cls, c = cotCls(); if (!c) return;
    let term = curTerm(cy(c)); const key = cls + '|' + (term || 'x');
    if (S.avgKey === key) return;
    S.avgKey = key; S.avg = {};
    if (!(term > 0)) {
        const { data } = await db.from('grades').select('term').eq('class_id', cls).order('term', { ascending: false }).limit(1);
        term = data && data[0] ? data[0].term : 0;
    }
    if (term) {
        const r = await pageAll(() => db.from('grades').select('student_id,grade,max_grade').eq('class_id', cls).eq('term', term));
        if (r.error) { S.avgKey = null; return; }
        const a = {};
        r.data.forEach(g => { const o = a[g.student_id] || (a[g.student_id] = { p: 0, m: 0 }); o.p += Number(g.grade); o.m += Number(g.max_grade); });
        if (S.cls !== cls) return;
        Object.keys(a).forEach(k => { if (a[k].m > 0) S.avg[k] = a[k].p / a[k].m * 100; });
    }
    if (S.cls === cls && S.view === 'class' && S.tab === 'eleves' && $('#lst')) drawList();
}

// ---------- BULLETINS ----------
async function bulLoad() {
    const key = S.cls + '|' + S.bulPeriod;
    if (S.bulKey === key) return null;
    const r = await pageAll(() => { let q = db.from('grades').select('student_id,subject_id,term,grade,max_grade,subjects(name)').eq('class_id', S.cls); if (S.bulPeriod !== 'A') q = q.eq('term', +S.bulPeriod); return q; });
    if (r.error) return r.error;
    S.bulRows = r.data.map(cotNorm); S.bulKey = key; return null;
}
const bulMeta = (s, appr) => ({ school: S.school.name, cls: (cotCls() || {}).name, year: cy(cotCls() || {}), name: s.name, appr });
const bulOf = id => S.bulRows.filter(g => g.student_id === id);

async function vBulletins() {
    const c = cotCls(); if (!c) { S.tab = 'eleves'; return render(); }
    const st = cotStudents();
    if (!S.bulPeriod) S.bulPeriod = String(cotCurTerm());
    if (!S.bulStu || !st.some(s => s.id === S.bulStu)) S.bulStu = st[0] ? st[0].id : '';
    let h = `<div class=bar><button class=ghost style="width:auto" onclick="cotBack()">← ${esc(c.name)}</button><b class=ctitle>Bulletins</b></div>`
        + `<div class=chips>${['1', '2', '3', 'A'].map(p => `<button class="chip ${p === S.bulPeriod ? 'on' : ''}" onclick="bulSet('${p}')">${p === 'A' ? 'Année' : 'Trimestre ' + p}</button>`).join('')}</div>`;
    if (!st.length) { $('#main').innerHTML = h + '<p class=empty>Aucun élève dans cette classe.</p>'; return; }
    h += `<select id=b_stu>${st.map(s => `<option value="${s.id}" ${s.id === S.bulStu ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><div id=b_prev>${SK}</div>`;
    $('#main').innerHTML = h;
    $('#b_stu').onchange = e => { S.bulStu = e.target.value; bulPreview(); };
    const err = await bulLoad();
    if (S.tab !== 'bulletins') return;
    if (err) { $('#b_prev').innerHTML = `<p class=empty>${esc(err.message)}</p>`; return; }
    bulPreview();
}
function bulSet(p) { S.bulPeriod = p; S.bulKey = null; render(); }
function bulPreview() {
    const el = $('#b_prev'); if (!el) return;
    const s = S.stu.find(x => x.id === S.bulStu); if (!s) return;
    const b = OB.make(bulOf(s.id), S.bulPeriod, bulMeta(s)), v = b.view, year = v.mode === 'year';
    const nAll = cotStudents().filter(x => bulOf(x.id).length).length;
    let h = '';
    if (!v.rows.length) h += `<p class=empty data-ic="📝">Aucune note pour cet élève (${OB.NAMES[S.bulPeriod]}).</p>`;
    else {
        h += `<div class="card col"><b>${esc(s.name)} · ${OB.NAMES[S.bulPeriod]}</b>`
            + v.rows.map(r => `<div style="display:flex;justify-content:space-between;margin:3px 0"><span>${esc(r.name)}</span><span><small>${year ? r.cells[3] : r.cells[0] + ' / ' + r.cells[1]}</small> <b class="${r.pct != null && r.pct < 50 ? 'due' : ''}">${OB.pctTxt(r.pct)}</b></span></div>`).join('')
            + `<div style="display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid var(--line);padding-top:8px"><b>Total : ${OB.num(v.tp)} / ${OB.num(v.tm)}</b><b class="${v.pct != null && v.pct < 50 ? 'due' : 'ok'}" style="font-size:18px">${OB.pctTxt(v.pct)}</b></div></div>`
            + `<label style="font-size:12px;color:var(--mut)">Appréciation (modifiable)</label><textarea id=b_rem rows=3>${esc(b.appr)}</textarea>`
            + (window.OREA_CONFIG && OREA_CONFIG.GEMINI_KEY ? `<button id=btn_ia class=ghost onclick="bulAI()" style="margin-bottom:8px">✨ Générer avec l’IA</button>` : '')
            + `<button onclick="bulOne()">📄 Bulletin PDF de cet élève</button>`;
    }
    h += `<button class=ghost style="margin-top:10px" onclick="bulAll()">🖨 Générer tous les bulletins (${nAll} élève${nAll > 1 ? 's' : ''} avec notes)</button>`;
    el.innerHTML = h;
}
function bulOne() {
    const s = S.stu.find(x => x.id === S.bulStu); if (!s) return;
    if (!bulOf(s.id).length) return toast('Aucune note pour cet élève.');
    try {
        const b = OB.make(bulOf(s.id), S.bulPeriod, bulMeta(s, ($('#b_rem') || {}).value));
        OB.save(OB.pdf([b]), 'bulletin-' + OB.slug(s.name) + '-' + S.bulPeriod + '.pdf'); toast('Bulletin généré');
    } catch (x) { toast('Erreur PDF : ' + x.message); }
}
function bulAll() {
    const list = cotStudents().filter(s => bulOf(s.id).length);
    if (!list.length) return toast('Aucune note dans cette classe pour cette période.');
    try {
        const pages = list.map(s => OB.make(bulOf(s.id), S.bulPeriod, bulMeta(s)));
        OB.save(OB.pdf(pages), 'bulletins-' + OB.slug((cotCls() || {}).name) + '-' + S.bulPeriod + '.pdf');
        toast(`✓ ${pages.length} bulletin(s) dans un seul PDF`);
    } catch (x) { toast('Erreur PDF : ' + x.message); }
}
async function bulAI() {
    const key = window.OREA_CONFIG && OREA_CONFIG.GEMINI_KEY, s = S.stu.find(x => x.id === S.bulStu); if (!key || !s) return;
    const v = OB.view(OB.agg(bulOf(s.id)), S.bulPeriod), btn = $('#btn_ia'), txt = $('#b_rem'), old = btn.innerHTML;
    btn.innerHTML = '⏳ …'; btn.disabled = true;
    const prompt = `Tu es enseignant en RDC. L'élève ${s.name} a obtenu : ${v.rows.map(r => r.name + ' ' + OB.pctTxt(r.pct)).join(', ')}. Pourcentage général : ${OB.pctTxt(v.pct)}. Rédige une appréciation bienveillante mais honnête en 2 phrases maximum, sans guillemets.`;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        const d = await res.json(); if (d.error) throw new Error(d.error.message);
        txt.value = d.candidates[0].content.parts[0].text.trim();
    } catch (x) { toast('Erreur IA : ' + x.message); } finally { btn.innerHTML = old; btn.disabled = false; }
}

// ---------- Dossier élève : bouton [ Cotes ] ----------
async function openStuCotes(id) {
    const s = S.stu.find(x => x.id === id); if (!s) return;
    if (S.offline) return toast('Hors connexion : les cotes demandent internet.');
    show(`<h3>${esc(s.name)} · Cotes</h3>${SK}`);
    const r = await pageAll(() => db.from('grades').select('subject_id,term,kind,num,grade,max_grade,eval_date,subjects(name)').eq('student_id', id).eq('class_id', s.class_id));
    if (r.error) { $('#dlg').innerHTML = `<h3>${esc(s.name)}</h3><p class=empty>${esc(r.error.message)}</p><button class=ghost onclick="this.closest('dialog').close()">Fermer</button>`; return; }
    S.stuG = { id, name: s.name, rows: r.data.map(cotNorm) };
    stuCotesGrid();
}
function stuCotesGrid() {
    const g = S.stuG; if (!g) return;
    const by = {};
    g.rows.forEach(r => { const o = by[r.subject_id] || (by[r.subject_id] = { id: r.subject_id, name: r.subject_name, p: 0, m: 0 }); o.p += Number(r.grade); o.m += Number(r.max_grade); });
    const list = Object.values(by).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    show(`<h3>${esc(g.name)} · Cotes</h3>${list.length ? `<div class=cgrid style="max-height:55vh;overflow-y:auto">${list.map(o => `<div class=ccard onclick="stuCotesSubject('${o.id}')"><b style="font-size:13.5px;white-space:normal">${esc(o.name)}</b><small>${OB.pctTxt(OB.pctOf(o.p, o.m))}</small></div>`).join('')}</div>` : '<p class=empty data-ic="📝">Aucune cote enregistrée.</p>'}<button class=ghost style="margin-top:12px" onclick="this.closest('dialog').close()">Fermer</button>`);
}
function stuCotesSubject(sid) {
    const g = S.stuG; if (!g) return;
    const rows = g.rows.filter(r => r.subject_id === sid), name = rows[0] ? rows[0].subject_name : '';
    const body = [1, 2, 3].map(t => {
        const l = rows.filter(r => r.term === t).sort((a, b) => COT_KINDS.indexOf(a.kind) - COT_KINDS.indexOf(b.kind) || a.num - b.num);
        if (!l.length) return `<div class=cot-sub style="font-size:16px">Trimestre ${t}</div><small>Aucune cote.</small>`;
        const p = l.reduce((a, r) => a + Number(r.grade), 0), m = l.reduce((a, r) => a + Number(r.max_grade), 0);
        return `<div class=cot-sub style="font-size:16px">Trimestre ${t} · ${OB.num(p)} / ${OB.num(m)} (${OB.pctTxt(OB.pctOf(p, m))})</div>`
            + l.map(r => `<div style="display:flex;justify-content:space-between;margin:3px 0"><span>${r.kind} ${r.num} <small>(Base ${nf(r.max_grade)})${r.eval_date ? ' · ' + fdate(r.eval_date) : ''}</small></span><b>${nf(r.grade)} / ${nf(r.max_grade)}</b></div>`).join('');
    }).join('');
    show(`<h3>${esc(name)}</h3><div style="max-height:55vh;overflow-y:auto">${body}</div><div class=row><button class=ghost onclick="stuCotesGrid()">← Cours</button><button class=ghost onclick="this.closest('dialog').close()">Fermer</button></div>`);
}
