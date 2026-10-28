// ORÉA École — Interface Parent (K1)
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

const P = { me: null, school: null, children: [] };
document.documentElement.dataset.theme = localStorage.theme || 'dark';

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
        const f = $('#paf');
        if (!f.reportValidity()) return;
        const { data, error } = await db.auth.signUp({ email: f.email.value, password: f.pw.value });
        if (error) return toast(error.message);
        if (data.session) boot();
        else toast('Compte créé. Confirme ton e-mail, puis connecte-toi.');
    };
}

async function loadMe() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return null;
    const { data } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    return data;
}
async function loadSchool() {
    if (!P.me?.school_id) { P.school = null; return; }
    const { data } = await db.from('schools').select('name').eq('id', P.me.school_id).maybeSingle();
    P.school = data || null;
}
async function loadChildren() {
    const { data, error } = await db.rpc('parent_children');
    if (error) { P.children = []; return; }
    P.children = data || [];
}

function homeView() {
    $('#hs').textContent = P.school?.name || 'ORÉA École';
    let h = `<div class=p-hello>👋 Bonjour <b>${esc(P.me?.full_name || 'Parent')}</b></div>`;

    if (!P.children.length) {
        h += `<div class=p-empty><span class=p-ic>👨‍👩‍👧</span>
            Aucun enfant lié pour le moment.<br><br>
            <button class=p-btn onclick=addChildView()>+ Ajouter un enfant</button>
        </div>`;
    } else {
        h += P.children.map(s => {
            const due = Number(s.balance_cdf || 0);
            const tag = due > 0 ? `<div class="p-bal p-due">Doit ${fmtCDF(due)}</div>` : `<div class="p-bal p-ok">✓ À jour</div>`;
            return `<div class=p-card onclick="childDetail('${s.id}')">
                <h3>👤 ${esc(s.name)}</h3>
                ${tag}
                <div class=p-line>Total payé : ${fmtCDF(Number(s.paid_cdf || 0))}</div>
            </div>`;
        }).join('');
        h += `<div class=p-actions>
            <button class=p-btn onclick=addChildView()>+ Ajouter un autre enfant</button>
            <button class=ghost style="width:100%;padding:12px;background:transparent;color:var(--gold,#b08a30);border:1px solid var(--gold,#b08a30);border-radius:10px" onclick=logout()>Se déconnecter</button>
        </div>`;
    }
    $('#pmain').innerHTML = h;
}

function addChildView() {
    const d = $('#pdlg');
    d.innerHTML = `<form method=dialog>
        <h3>Ajouter un enfant</h3>
        <p style="font-size:14px;color:var(--muted,#a8a495)">Entre le code fourni par l'école.</p>
        <input name=code placeholder="Code (ex : A7K9-P2MX)" style="width:100%;padding:12px;font-size:18px;letter-spacing:2px;text-align:center;text-transform:uppercase" required>
        <div class=row style="display:flex;gap:8px;margin-top:10px">
            <button value=x class=ghost formnovalidate style="flex:1">Annuler</button>
            <button value=ok style="flex:2">Ajouter</button>
        </div>
    </form>`;
    if (!d.open) d.showModal();
    d.querySelector('form').onsubmit = async e => {
        if (e.submitter.value !== 'ok') return;
        e.preventDefault();
        const code = e.target.code.value.trim();
        try {
            const { data, error } = await db.rpc('verifier_code_parent', { p_code: code, p_name: null });
            if (error) throw error;
            d.close();
            toast(data.already ? 'Enfant déjà lié' : '✓ ' + data.student_name + ' ajouté');
            P.me = (await loadMe()) || P.me;
            await loadSchool();
            await loadChildren();
            homeView();
        } catch (x) { toast(x.message || 'Code invalide'); }
    };
}

async function childDetail(id) {
    const s = P.children.find(x => x.id === id);
    if (!s) return;
    $('#pmain').innerHTML = `<div style="padding:20px;text-align:center">Chargement…</div>`;
    const [pay, fpay, att, san] = await Promise.all([
        db.rpc('parent_payments'),
        db.rpc('parent_fee_payments'),
        db.rpc('parent_attendance', { p_days: 30 }),
        db.rpc('parent_sanctions')
    ]);
    const pays = (pay.data || []).filter(x => x.student_id === id);
    const fpays = (fpay.data || []).filter(x => x.student_id === id);
    const atts = (att.data || []).filter(x => x.student_id === id);
    const sans = (san.data || []).filter(x => x.student_id === id);
    const due = Number(s.balance_cdf || 0), paid = Number(s.paid_cdf || 0);

    let h = `<div class=p-hello>👤 <b>${esc(s.name)}</b></div>`;
    h += `<div class=p-sec>
        <h4>💰 Solde</h4>
        <div class=p-row><span>Total payé</span><b>${fmtCDF(paid)}</b></div>
        <div class=p-row><span>Reste à payer</span><b class="${due > 0 ? 'p-due' : 'p-ok'}">${fmtCDF(due)}</b></div>
    </div>`;
    h += `<div class=p-sec>
        <h4>📋 Présences (30 jours)</h4>
        ${atts.length ? atts.slice(0, 8).map(a => `<div class=p-row><span>${fdate(a.day)}</span><b class="${a.status === 'absent' ? 'p-due' : a.status === 'retard' ? '' : 'p-ok'}">${a.status === 'present' ? '✓ Présent' : a.status === 'absent' ? '✗ Absent' : '🕐 Retard'}</b></div>`).join('') : '<div class=p-row><small>Aucun événement</small></div>'}
    </div>`;
    if (sans.length) {
        h += `<div class=p-sec><h4>⚖️ Sanctions</h4>
            ${sans.slice(0, 5).map(x => `<div class=p-row><span>${fdate(x.day)} · ${esc(x.kind)}</span></div>`).join('')}
        </div>`;
    }
    const all = [...pays.map(p => ({ ...p, _f: 0 })), ...fpays.map(p => ({ ...p, _f: 1 }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (all.length) {
        h += `<div class=p-sec><h4>🧾 Paiements récents</h4>
            ${all.slice(0, 10).map(p => `<div class=p-row><span>${new Date(p.created_at).toLocaleDateString('fr-FR')} · ${p._f ? esc(p.fee_name || 'Frais') : 'T' + p.term}</span><b>${nf(p.amount)} ${p.currency}</b></div>`).join('')}
        </div>`;
    }
    h += `<button class=ghost style="width:100%;padding:12px;background:transparent;color:var(--gold,#b08a30);border:1px solid var(--gold,#b08a30);border-radius:10px;margin-top:10px" onclick=homeView()>← Retour</button>`;
    $('#pmain').innerHTML = h;
}

async function logout() {
    if (!confirm('Se déconnecter ?')) return;
    await db.auth.signOut();
    location.reload();
}

async function boot() {
    const r = await db.auth.getSession();
    const session = r.data.session;
    if (!session) return authView();
    const prof = await loadMe();
    if (prof && prof.role && prof.role !== 'parent') { location.href = './'; return; }
    P.me = prof || { id: session.user.id, full_name: 'Parent', role: 'parent' };
    await loadSchool();
    await loadChildren();
    homeView();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
boot();
