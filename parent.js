// ORÉA École — Interface Parent (K2 + K5 Devoirs/Emploi du temps)
const tfetch = (u, o = {}) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
    if (o.signal) o.signal.addEventListener('abort', () => c.abort());
    return fetch(u, { ...o, signal: c.signal }).finally(() => clearTimeout(t));
};
const db = supabase.createClient(OREA_CONFIG.SUPABASE_URL, OREA_CONFIG.SUPABASE_ANON_KEY, { global: { fetch: tfetch } });
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n, d = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
const fmtCDF = n => nf(n, 0) + ' FC';
const toast = m => { const t = $('#ptoast'); t.textContent = m; t.hidden = false; setTimeout(() => t.hidden = true, 4000); };
const fdate = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '—';
const tdy = () => new Date().toLocaleDateString('sv-SE');
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const hhmm = t => t ? String(t).slice(0, 5) : '';

const P = { me: null, school: null, school_id: null, children: [], tab: 'accueil', msgs: [], annonces: [], convocs: [], justifs: [], events: [], assign: [], tt: [] };
document.documentElement.dataset.theme = localStorage.theme || 'dark';

// ---- Auth ----
function authView() {
    $('#pmain').innerHTML = `<div class=p-auth>
        <img src=logo-dark.png alt="ORÉA École">
        <h2>Espace Parent</h2>
        <form id=paf class=col>
            <input name=email type=email placeholder="E-mail" required>
            <input name=pw type=password placeholder="Mot de passe (8 caractères min.)" minlength=8 required>
            <button>Se connecter</button>
            <button type=button class=ghost id=psu>Créer un compte</button>
        </form>
        <span class=p-link onclick="location.href='./'">← Retour à l'école</span>
    </div>`;
    $('#paf').onsubmit = async e => {
        e.preventDefault();
        const f = e.target;
        const { error } = await db.auth.signInWithPassword({ email: f.email.value, password: f.pw.value });
        if (error) return toast(error.message);
        boot();
    };
    $('#psu').onclick = async () => {
        const f = $('#paf'); if (!f.reportValidity()) return;
        const { data, error } = await db.auth.signUp({ email: f.email.value, password: f.pw.value });
        if (error) return toast(error.message);
        if (data.session) boot(); else toast('Compte créé. Confirme ton e-mail, puis connecte-toi.');
    };
}

async function loadMe() { const { data: { user } } = await db.auth.getUser(); if (!user) return null; const { data } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle(); return data; }
async function loadSchool() { if (!P.me?.school_id) { P.school = null; return; } const { data } = await db.from('schools').select('id,name').eq('id', P.me.school_id).maybeSingle(); P.school = data || null; }
async function loadChildren() { const { data } = await db.rpc('parent_children'); P.children = data || []; }
async function loadK2() {
    if (!P.children.length) return;
    const [m, a, c, j, e] = await Promise.all([
        db.rpc('parent_messages_list'), db.rpc('parent_announcements'), db.rpc('parent_convocations'), db.rpc('parent_justifications'), db.rpc('parent_events')
    ]);
    P.msgs = m.data || []; P.annonces = a.data || []; P.convocs = c.data || []; P.justifs = j.data || []; P.events = e.data || [];
}
async function loadK5() {
    if (!P.children.length) return;
    const [as, tt] = await Promise.all([db.rpc('parent_assignments'), db.rpc('parent_timetable')]);
    P.assign = as.data || []; P.tt = tt.data || [];
}

// ---- Navigation ----
function navView() {
    const tabs = [['accueil', '🏠', 'Enfants'], ['messages', '💬', 'Messages'], ['ecole', '🏫', 'École'], ['scolarite', '📚', 'Scolarité'], ['calendrier', '📅', 'Agenda']];
    return `<div style="position:fixed;bottom:0;left:0;right:0;background:var(--card,#1c1d1a);border-top:1px solid var(--line,#33342e);display:flex;z-index:99;padding-bottom:env(safe-area-inset-bottom)">${tabs.map(t => `<button style="flex:1;background:none;border:none;padding:10px 0;color:${P.tab === t[0] ? 'var(--gold,#b08a30)' : 'var(--muted,#a8a495)'};font-size:10.5px;font-weight:${P.tab === t[0] ? 'bold' : 'normal'};cursor:pointer" onclick="P.tab='${t[0]}';render()"><div style="font-size:19px;margin-bottom:2px">${t[1]}</div>${t[2]}</button>`).join('')}</div>`;
}
function render() {
    $('#hs').textContent = P.school?.name || 'ORÉA École';
    if (P.tab === 'accueil') homeView();
    else if (P.tab === 'messages') msgView();
    else if (P.tab === 'ecole') ecoleView();
    else if (P.tab === 'scolarite') scolariteView();
    else if (P.tab === 'calendrier') calView();
    window.scrollTo(0, 0);
}

// ---- Vues ----
function homeView() {
    let h = `<div class=p-hello>👋 Bonjour <b>${esc(P.me?.full_name || 'Parent')}</b></div>`;
    if (!P.children.length) {
        h += `<div class=p-empty><span class=p-ic>👨‍👩‍👧</span>Aucun enfant lié.<br><br><button class=p-btn onclick=addChildView()>+ Ajouter un enfant</button></div>`;
    } else {
        h += P.children.map(s => {
            const due = Number(s.balance_cdf || 0);
            const tag = due > 0 ? `<div class="p-bal p-due">Doit ${fmtCDF(due)}</div>` : `<div class="p-bal p-ok">✓ À jour</div>`;
            return `<div class=p-card onclick="childDetail('${s.id}')"><h3>👤 ${esc(s.name)}</h3>${tag}<div class=p-line>Total payé : ${fmtCDF(Number(s.paid_cdf || 0))}</div></div>`;
        }).join('');
        h += `<div class=p-actions><button class=p-btn onclick=addChildView()>+ Ajouter un autre enfant</button><button class=ghost style="padding:12px;background:transparent;color:var(--gold);border:1px solid var(--gold);border-radius:10px" onclick=logout()>Se déconnecter</button></div>`;
    }
    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

function msgView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">💬 Messages</h2>`;
    if (!P.children.length) h += `<div class=p-empty>Ajoutez un enfant pour discuter.</div>`;
    else {
        h += `<div class=p-sec><h4>Nouveau message</h4><select id=m_child style="width:100%;padding:10px;margin-bottom:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px">${P.children.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><textarea id=m_txt rows=2 style="width:100%;padding:10px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" placeholder="Votre message..."></textarea><button class=p-btn style="margin-top:8px" onclick=sendMsg()>Envoyer</button></div>`;
        const uniqueMsgs = P.msgs.filter(m => P.children.some(c => c.id === m.student_id));
        if (uniqueMsgs.length) {
            h += `<div class=p-sec><h4>Historique</h4>${uniqueMsgs.map(m => { const ch = P.children.find(c => c.id === m.student_id); return `<div style="margin-bottom:10px;padding:10px;border-radius:8px;background:${m.sender_role === 'parent' ? 'rgba(176,138,48,.15)' : 'rgba(255,255,255,.05)'};border:1px solid ${m.sender_role === 'parent' ? 'var(--gold)' : 'var(--line)'}"><small style="color:var(--muted);font-size:11px">${esc(ch ? ch.name : '')} · ${m.sender_role === 'parent' ? 'Moi' : 'École'} · ${new Date(m.created_at).toLocaleString('fr-FR')}</small><div style="margin-top:4px;font-size:14px">${esc(m.content)}</div></div>`; }).join('')}</div>`;
        } else h += `<div class=p-empty>Aucun message.</div>`;
    }
    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

async function sendMsg() {
    const sid = $('#m_child').value, txt = $('#m_txt').value.trim();
    if (!txt) return toast('Message vide');
    const { error } = await db.from('parent_messages').insert({ school_id: P.school_id || P.school?.id, student_id: sid, parent_id: P.me.id, sender_role: 'parent', content: txt });
    if (error) return toast(error.message);
    await loadK2(); msgView(); toast('Envoyé ✓');
}

function ecoleView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">🏫 L'école</h2>`;
    h += `<div class=p-sec><h4>📝 Justificatif d'absence</h4><select id=j_child style="width:100%;padding:10px;margin-bottom:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px">${P.children.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><input type="date" id=j_day style="width:100%;padding:10px;margin-bottom:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" value="${tdy()}"><textarea id=j_txt rows=2 style="width:100%;padding:10px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" placeholder="Motif (maladie, rendez-vous...)"></textarea><button class=p-btn style="margin-top:8px" onclick=sendJustif()>Envoyer à l'école</button></div>`;
    if (P.convocs.length) {
        h += `<div class=p-sec><h4>📢 Convocations</h4>${P.convocs.map(c => { const ch = P.children.find(x => x.id === c.student_id); return `<div class="p-row" style="flex-direction:column;align-items:flex-start;gap:4px"><b>${fdate(c.day)} · ${esc(ch ? ch.name : '')}</b><span>${esc(c.reason)}</span><span class="${c.status === 'confirmee' ? 'p-ok' : 'p-due'}">${c.status === 'confirmee' ? '✓ Confirmée' : '⏳ À confirmer'}</span>${c.status !== 'confirmee' ? `<button class=p-btn style="padding:6px;margin-top:4px" onclick="confirmConv('${c.id}')">Confirmer ma présence</button>` : ''}</div>`; }).join('')}</div>`;
    }
    if (P.annonces.length) {
        h += `<div class=p-sec><h4>📣 Annonces de l'école</h4>${P.annonces.map(a => `<div style="margin-bottom:10px;padding:10px;border-bottom:1px solid var(--line)"><b>${esc(a.title)}</b><div style="font-size:14px;margin-top:4px">${esc(a.content)}</div><small style="color:var(--muted)">${new Date(a.created_at).toLocaleDateString('fr-FR')}</small></div>`).join('')}</div>`;
    }
    if (!P.convocs.length && !P.annonces.length) h += `<div class=p-empty>Aucune info pour le moment.</div>`;
    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

function scolariteView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">📚 Scolarité</h2>`;
    const kid = P.children[0];
    if (!kid) { $('#pmain').innerHTML = h + `<div class=p-empty>Ajoutez un enfant pour voir sa scolarité.</div>` + navView() + '<div style="height:80px"></div>'; return; }
    const as = P.assign.slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const today = tdy();
    const upcoming = as.filter(a => String(a.due_date) >= today);
    const past = as.filter(a => String(a.due_date) < today).slice(0, 5);
    h += `<div class=p-sec><h4>📝 Devoirs</h4>`;
    if (!as.length) h += `<div class=p-empty>Aucun devoir pour l'instant.</div>`;
    else {
        if (upcoming.length) h += upcoming.map(a => `<div class="p-assign"><h5>${esc(a.subject)}</h5><div class="p-meta">${esc(a.class_name || '')} · À rendre le ${fdate(a.due_date)}</div><div class="p-desc">${esc(a.description)}</div></div>`).join('');
        if (past.length) h += `<details style="margin-top:8px"><summary style="color:var(--muted);cursor:pointer;font-size:12px">Devoirs passés (${past.length})</summary>${past.map(a => `<div class="p-assign late"><h5>${esc(a.subject)}</h5><div class="p-meta">Rendu le ${fdate(a.due_date)}</div></div>`).join('')}</details>`;
    }
    h += `</div>`;
    h += `<div class=p-sec><h4>📅 Emploi du temps</h4>`;
    if (!P.tt.length) h += `<div class=p-empty>Aucun emploi du temps.</div>`;
    else {
        const byDay = {};
        P.tt.forEach(t => { (byDay[t.day] = byDay[t.day] || []).push(t); });
        const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
        h += days.map(d => `<div class="p-tt-day"><h5>${DAYS[d] || ''}</h5>${byDay[d].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))).map(t => `<div class="p-tt-row"><span class="p-tt-h">${hhmm(t.start_time)} – ${hhmm(t.end_time)}</span><div><b>${esc(t.subject)}</b>${t.room ? `<small>${esc(t.room)}</small>` : ''}</div></div>`).join('')}</div>`).join('');
    }
    h += `</div>`;
    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

async function sendJustif() {
    const sid = $('#j_child').value, day = $('#j_day').value, txt = $('#j_txt').value.trim();
    if (!txt || !day) return toast('Remplissez tous les champs');
    const { error } = await db.from('absence_justifications').insert({ school_id: P.school_id || P.school?.id, student_id: sid, parent_id: P.me.id, day, reason: txt });
    if (error) return toast(error.message);
    toast('Justificatif envoyé ✓'); $('#j_txt').value = '';
}
async function confirmConv(id) {
    const { error } = await db.from('convocations').update({ status: 'confirmee' }).eq('id', id);
    if (error) return toast(error.message);
    await loadK2(); ecoleView(); toast('Confirmé ✓');
}

function calView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">📅 Calendrier</h2>`;
    if (!P.events.length) h += `<div class=p-empty>Aucun événement à venir.</div>`;
    else h += P.events.map(e => `<div class=p-sec><div class=p-row><b>${esc(e.title)}</b></div><div class=p-row><span>📅 ${fdate(e.start_date)} ${e.end_date ? 'au ' + fdate(e.end_date) : ''}</span></div><div style="font-size:13px;color:var(--muted);margin-top:4px">${esc(e.description || '')}</div></div>`).join('');
    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

function addChildView() {
    const d = $('#pdlg');
    d.innerHTML = `<form method=dialog><h3>Ajouter un enfant</h3><p style="font-size:14px;color:var(--muted)">Entre le code fourni par l'école.</p><input name=code placeholder="Code" style="width:100%;padding:12px;font-size:18px;text-align:center;text-transform:uppercase" required><div class=row style="display:flex;gap:8px;margin-top:10px"><button value=x class=ghost formnovalidate style="flex:1">Annuler</button><button value=ok style="flex:2">Ajouter</button></div></form>`;
    if (!d.open) d.showModal();
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        e.preventDefault();
        try {
            const { data, error } = await db.rpc('verifier_code_parent', { p_code: e.target.code.value.trim(), p_name: null });
            if (error) throw error;
            d.close(); toast(data.already ? 'Déjà lié' : '✓ Ajouté');
            P.me = (await loadMe()) || P.me; await loadSchool(); await loadChildren(); await loadK2(); await loadK5(); render();
        } catch (x) { toast(x.message || 'Code invalide'); }
    };
}

async function childDetail(id) {
    const s = P.children.find(x => x.id === id); if (!s) return;
    $('#pmain').innerHTML = `<div style="padding:20px;text-align:center">Chargement…</div>`;
    const [pay, fpay, att, san] = await Promise.all([db.rpc('parent_payments'), db.rpc('parent_fee_payments'), db.rpc('parent_attendance', { p_days: 30 }), db.rpc('parent_sanctions')]);
    const pays = (pay.data || []).filter(x => x.student_id === id), fpays = (fpay.data || []).filter(x => x.student_id === id);
    const atts = (att.data || []).filter(x => x.student_id === id), sans = (san.data || []).filter(x => x.student_id === id);
    const due = Number(s.balance_cdf || 0), paid = Number(s.paid_cdf || 0);
    let h = `<div class=p-hello>👤 <b>${esc(s.name)}</b></div>`;
    h += `<div class=p-sec><h4>💰 Solde</h4><div class=p-row><span>Payé</span><b>${fmtCDF(paid)}</b></div><div class=p-row><span>Reste</span><b class="${due > 0 ? 'p-due' : 'p-ok'}">${fmtCDF(due)}</b></div></div>`;
    h += `<div class=p-sec><h4>📋 Présences (30j)</h4>${atts.length ? atts.slice(0, 8).map(a => `<div class=p-row><span>${fdate(a.day)}</span><b class="${a.status === 'absent' ? 'p-due' : a.status === 'retard' ? '' : 'p-ok'}">${a.status === 'present' ? '✓ Présent' : a.status === 'absent' ? '✗ Absent' : '🕐 Retard'}</b></div>`).join('') : '<div class=p-row><small>Aucun</small></div>'}</div>`;
    if (sans.length) h += `<div class=p-sec><h4>⚖️ Sanctions</h4>${sans.slice(0, 5).map(x => `<div class=p-row><span>${fdate(x.day)} · ${esc(x.kind)}</span></div>`).join('')}</div>`;
    const all = [...pays.map(p => ({ ...p, _f: 0 })), ...fpays.map(p => ({ ...p, _f: 1 }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (all.length) h += `<div class=p-sec><h4>🧾 Paiements</h4>${all.slice(0, 10).map(p => `<div class=p-row><span>${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${p._f ? esc(p.fee_name || 'Frais') : 'T' + p.term}</span><b>${nf(p.amount)} ${p.currency}</b></div>`).join('')}</div>`;
    h += `<button class=ghost style="width:100%;padding:12px;background:transparent;color:var(--gold);border:1px solid var(--gold);border-radius:10px;margin-top:10px" onclick="P.tab='accueil';render()">← Retour</button>`;
    $('#pmain').innerHTML = h + navView() + '<div style="height:80px"></div>';
}

async function logout() { if (!confirm('Se déconnecter ?')) return; await db.auth.signOut(); location.reload(); }

async function boot() {
    const r = await db.auth.getSession();
    if (!r.data.session) return authView();
    const prof = await loadMe();
    if (prof && prof.role && prof.role !== 'parent') { location.href = './'; return; }
    P.me = prof || { id: r.data.session.user.id, full_name: 'Parent', role: 'parent' };
    P.school_id = prof?.school_id;
    await loadSchool(); await loadChildren(); await loadK2(); await loadK5(); render();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
boot();
