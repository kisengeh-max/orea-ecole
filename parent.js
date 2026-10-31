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

const P = { me: null, school: null, school_id: null, children: [], tab: 'accueil', msgs: [], annonces: [], convocs: [], justifs: [], events: [], assign: [], tt: [], msgChild: null };
document.documentElement.dataset.theme = localStorage.theme || 'dark';

// --- Injection CSS pour la nouvelle navigation et le chat ---
document.head.insertAdjacentHTML('beforeend', `<style>
    .p-nav-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--card, #1c1d1a); border-top: 1px solid var(--line, #33342e); padding: 8px 6px; padding-bottom: calc(8px + env(safe-area-inset-bottom)); position: fixed; bottom: 0; left: 0; right: 0; z-index: 99; }
    .p-nav-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 0; border-radius: 8px; border: none; background: none; color: var(--muted, #a8a495); cursor: pointer; transition: .2s; }
    .p-nav-btn.on { color: var(--gold, #b08a30); background: rgba(176,138,48,.1); }
    .p-nav-ic { width: 22px; height: 22px; margin-bottom: 3px; }
    .p-nav-lbl { font-size: 10px; font-weight: 500; }
    .p-nav-btn.on .p-nav-lbl { font-weight: bold; }
    .p-chat-container { display: flex; flex-direction: column; gap: 12px; padding: 10px 0 20px 0; }
    .p-chat-date { text-align: center; font-size: 11.5px; color: var(--muted, #a8a495); margin: 10px 0; font-weight: bold; }
    .p-chat-bubble { max-width: 82%; padding: 10px 14px; border-radius: 16px; position: relative; font-size: 14.5px; line-height: 1.4; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .p-chat-bubble.mine { align-self: flex-end; background: rgba(176,138,48,.15); border: 1px solid var(--gold, #b08a30); border-bottom-right-radius: 4px; }
    .p-chat-bubble.other { align-self: flex-start; background: var(--card, #1c1d1a); border: 1px solid var(--line, #33342e); border-bottom-left-radius: 4px; }
    .p-chat-meta { font-size: 10.5px; color: var(--muted, #a8a495); margin-bottom: 6px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
    .p-chat-time { font-size: 10px; font-weight: normal; opacity: 0.8; }
    .p-chat-input-bar { position: fixed; bottom: 125px; left: 0; right: 0; background: var(--bg, #111211); padding: 10px 15px; border-top: 1px solid var(--line, #33342e); z-index: 100; display: flex; gap: 8px; align-items: flex-end; }
    .p-chat-input { flex: 1; padding: 10px 12px; background: var(--card, #1c1d1a); border: 1px solid var(--line, #33342e); border-radius: 20px; color: var(--text, #fff); font-size: 14px; resize: none; max-height: 100px; font-family: inherit; }
    .p-chat-input:focus { outline: none; border-color: var(--gold, #b08a30); }
    .p-chat-send { background: var(--gold, #b08a30); color: #111; border: none; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
    .p-chat-send svg { width: 20px; height: 20px; transform: translateX(1px); }
</style>`);

// --- SVG Icons ---
const SVG_ICONS = {
    accueil: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    ecole: '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M16 14v3"/>',
    notes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    scolarite: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    agenda: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
};
const svgI = k => `<svg class="p-nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG_ICONS[k] || ''}</svg>`;

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

// ---- Navigation (Grille 2x3) ----
function navView() {
    const tabs = [
        ['accueil', 'Enfants'], 
        ['messages', 'Messages'], 
        ['ecole', 'École'], 
        ['notes', 'Notes'], 
        ['scolarite', 'Scolarité'], 
        ['calendrier', 'Agenda']
    ];
    return `<div class="p-nav-grid">${tabs.map(t => `
        <button class="p-nav-btn ${P.tab === t[0] ? 'on' : ''}" onclick="P.tab='${t[0]}';render()">
            ${svgI(t[0])}
            <span class="p-nav-lbl">${t[1]}</span>
        </button>
    `).join('')}</div>`;
}

function render() {
    $('#hs').textContent = P.school?.name || 'ORÉA École';
    if (P.tab === 'accueil') homeView();
    else if (P.tab === 'messages') msgView();
    else if (P.tab === 'ecole') ecoleView();
    else if (P.tab === 'notes' && typeof parentNotesView === 'function') parentNotesView();
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
    $('#pmain').innerHTML = h + navView() + '<div style="height:90px"></div>';
}

function msgView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">💬 Messages</h2>`;
    if (!P.children.length) {
        h += `<div class=p-empty>Ajoutez un enfant pour discuter.</div>`;
        $('#pmain').innerHTML = h + navView() + '<div style="height:90px"></div>';
        return;
    }

    // Sélection de l'enfant
    if (!P.msgChild || !P.children.some(c => c.id === P.msgChild)) P.msgChild = P.children[0].id;
    
    h += `<select id="msg_child_select" style="width:100%;padding:10px;margin-bottom:15px;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px">
        ${P.children.map(c => `<option value="${c.id}" ${c.id === P.msgChild ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>`;

    // Filtrer les messages pour cet enfant
    const myMsgs = P.msgs.filter(m => m.student_id === P.msgChild).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    h += `<div class="p-chat-container">`;
    if (!myMsgs.length) {
        h += `<div class=p-empty style="padding:20px 0">Aucun message avec l'école.</div>`;
    } else {
        let lastDate = '';
        myMsgs.forEach(m => {
            const d = new Date(m.created_at);
            const dateStr = d.toLocaleDateString('fr-FR');
            if (dateStr !== lastDate) {
                h += `<div class="p-chat-date">${dateStr}</div>`;
                lastDate = dateStr;
            }
            const isMe = m.sender_role === 'parent';
            const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            h += `<div class="p-chat-bubble ${isMe ? 'mine' : 'other'}">
                <div class="p-chat-meta">
                    <span>${isMe ? 'Moi' : 'École'}</span>
                    <span class="p-chat-time">${timeStr}</span>
                </div>
                <div>${esc(m.content)}</div>
            </div>`;
        });
    }
    h += `</div>`;

    // Barre de saisie fixe
    h += `<div class="p-chat-input-bar">
        <textarea id="chat_input" class="p-chat-input" rows="1" placeholder="Votre message..."></textarea>
        <button class="p-chat-send" onclick="sendMsg()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
    </div>`;

    $('#pmain').innerHTML = h + navView() + '<div style="height:180px"></div>';
    
    $('#msg_child_select').onchange = e => {
        P.msgChild = e.target.value;
        render();
    };
}

async function sendMsg() {
    const txt = $('#chat_input').value.trim();
    if (!txt) return;
    const sid = P.msgChild;
    const { error } = await db.from('parent_messages').insert({ school_id: P.school_id || P.school?.id, student_id: sid, parent_id: P.me.id, sender_role: 'parent', content: txt });
    if (error) return toast(error.message);
    $('#chat_input').value = '';
    await loadK2(); msgView(); toast('Envoyé ✓');
}

function ecoleView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">🏫 L'école</h2>`;
    const today = tdy();

    // --- BLOC 1 : ANNONCES (en haut) ---
    h += `<div class=p-sec><h4>📣 Annonces de l'école</h4>`;
    // On filtre les annonces périmées
    const validAnnonces = P.annonces.filter(a => !a.end_date || a.end_date >= today);
    if (validAnnonces.length) {
        h += validAnnonces.map(a => `<div style="margin-bottom:10px;padding:10px;border-bottom:1px solid var(--line)"><b>${esc(a.title)}</b><div style="font-size:14px;margin-top:4px">${esc(a.content)}</div><small style="color:var(--muted)">${new Date(a.created_at).toLocaleDateString('fr-FR')}</small></div>`).join('');
    } else {
        h += `<div class=p-empty style="padding:10px 0">Aucune annonce pour le moment.</div>`;
    }
    h += `</div>`;

    // --- BLOC 2 : CONVOCATIONS ---
    h += `<div class=p-sec><h4>📢 Convocations</h4>`;
    // On n'affiche que celles qui ne sont pas archivées
    const activeConvocs = P.convocs.filter(c => c.status !== 'archivee');
    if (activeConvocs.length) {
        h += activeConvocs.map(c => { 
            const ch = P.children.find(x => x.id === c.student_id); 
            return `<div class="p-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:10px">
                <b>${fdate(c.day)} · ${esc(ch ? ch.name : '')}</b>
                <span>${esc(c.reason)}</span>
                <span class="${c.status === 'confirmee' ? 'p-ok' : 'p-due'}">${c.status === 'confirmee' ? '✓ Confirmée' : '⏳ À confirmer'}</span>
                <div class="row" style="margin-top:6px; width:100%;">
                    ${c.status !== 'confirmee' ? `<button class=p-btn style="flex:1; padding:8px;" onclick="confirmConv('${c.id}')">Confirmer</button>` : `<button class="ghost" style="flex:1; padding:8px;" onclick="archiveConv('${c.id}')">🗑 Supprimer</button>`}
                </div>
            </div>`; 
        }).join('');
    } else {
        h += `<div class=p-empty style="padding:10px 0">Aucune convocation.</div>`;
    }
    h += `</div>`;

    // --- BLOC 3 : JUSTIFICATIFS (en bas) ---
    h += `<div class=p-sec>
        <h4>📝 Envoyer un justificatif</h4>
        <select id="j_type" style="width:100%;padding:10px;margin-bottom:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" onchange="toggleJustifFields(this.value)">
            <option value="absence">Absence</option>
            <option value="retard">Retard</option>
            <option value="depart">Départ anticipé</option>
            <option value="autre">Autre motif</option>
        </select>

        <!-- Champs dynamiques -->
        <div id="box_absence_duration" style="display:block; margin-bottom:8px;">
            <select id="j_duration" style="width:100%;padding:10px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" onchange="document.getElementById('box_absence_end').style.display = this.value === 'multi' ? 'block' : 'none'">
                <option value="single">Aujourd'hui seulement</option>
                <option value="multi">Plusieurs jours</option>
            </select>
            <div id="box_absence_end" style="display:none; margin-top:8px">
                <label style="font-size:12px;color:var(--muted)">Date de fin</label>
                <input type="date" id="j_end_date" style="width:100%;padding:10px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px">
            </div>
        </div>

        <div id="box_time" style="display:none; margin-bottom:8px">
            <label style="font-size:12px;color:var(--muted)">Heure</label>
            <input type="time" id="j_time" style="width:100%;padding:10px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px">
        </div>

        <select id="j_child" style="width:100%;padding:10px;margin-bottom:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px">
            ${P.children.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        
        <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">Date de début</label>
        <input type="date" id="j_day" style="width:100%;padding:10px;margin-bottom:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" value="${tdy()}">
        
        <textarea id="j_txt" rows="3" style="width:100%;padding:10px;background:var(--input-bg);color:var(--text);border:1px solid var(--line);border-radius:8px" placeholder="Motif (maladie, rendez-vous...)"></textarea>
        
        <button class=p-btn style="margin-top:10px" onclick="sendJustif()">Envoyer à l'école</button>
    </div>`;

    $('#pmain').innerHTML = h + navView() + '<div style="height:90px"></div>';
}

// Fonction pour afficher/masquer les champs
window.toggleJustifFields = function(val) {
    document.getElementById('box_absence_duration').style.display = val === 'absence' ? 'block' : 'none';
    document.getElementById('box_time').style.display = (val === 'retard' || val === 'depart') ? 'block' : 'none';
    if (val !== 'absence') {
        document.getElementById('j_duration').value = 'single';
        document.getElementById('box_absence_end').style.display = 'none';
    }
};

async function sendJustif() {
    const type = $('#j_type').value;
    const sid = $('#j_child').value;
    const day = $('#j_day').value;
    const time = $('#j_time') ? $('#j_time').value : null;
    const txt = $('#j_txt').value.trim();
    
    let end_date = null;
    if (type === 'absence' && $('#j_duration').value === 'multi') {
        end_date = $('#j_end_date').value;
    }

    if (!txt || !day) return toast('Remplissez la date et le motif');
    if (type === 'absence' && $('#j_duration').value === 'multi' && !end_date) return toast('Précisez la date de fin');
    
    const { error } = await db.from('absence_justifications').insert({ 
        school_id: P.school_id || P.school?.id, 
        student_id: sid, 
        parent_id: P.me.id, 
        day, 
        reason: txt,
        type: type,
        time: time || null,
        end_date: end_date || null
    });
    
    if (error) return toast(error.message);
    toast('Justificatif envoyé ✓'); 
    $('#j_txt').value = '';
    if($('#j_time')) $('#j_time').value = '';
    if($('#j_end_date')) $('#j_end_date').value = '';
    if($('#j_duration')) $('#j_duration').value = 'single';
    if($('#box_absence_end')) $('#box_absence_end').style.display = 'none';
}

async function confirmConv(id) {
    const { error } = await db.from('convocations').update({ status: 'confirmee' }).eq('id', id);
    if (error) return toast(error.message);
    await loadK2(); ecoleView(); toast('Confirmé ✓');
}

async function archiveConv(id) {
    if (!confirm('Supprimer cette convocation de votre liste ?')) return;
    const { error } = await db.from('convocations').update({ status: 'archivee' }).eq('id', id);
    if (error) return toast(error.message);
    await loadK2(); ecoleView(); toast('Convocation archivée');
}

function scolariteView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">📚 Scolarité</h2>`;
    const kid = P.children[0];
    if (!kid) { $('#pmain').innerHTML = h + `<div class=p-empty>Ajoutez un enfant pour voir sa scolarité.</div>` + navView() + '<div style="height:90px"></div>'; return; }
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
    $('#pmain').innerHTML = h + navView() + '<div style="height:90px"></div>';
}

function calView() {
    let h = `<h2 style="color:var(--gold);margin:10px 0">📅 Calendrier</h2>`;
    if (!P.events.length) h += `<div class=p-empty>Aucun événement à venir.</div>`;
    else h += P.events.map(e => `<div class=p-sec><div class=p-row><b>${esc(e.title)}</b></div><div class=p-row><span>📅 ${fdate(e.start_date)} ${e.end_date ? 'au ' + fdate(e.end_date) : ''}</span></div><div style="font-size:13px;color:var(--muted);margin-top:4px">${esc(e.description || '')}</div></div>`).join('');
    $('#pmain').innerHTML = h + navView() + '<div style="height:90px"></div>';
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
    $('#pmain').innerHTML = h + navView() + '<div style="height:90px"></div>';
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
