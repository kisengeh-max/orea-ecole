/* =====================================================================
   ORÉA École v92 — preinscription.js : inscrire un enfant à distance
   PARENT (parent.html) :
     - « Pré-inscrire un nouvel élève » : le parent entre le CODE DE L'ÉCOLE
       (il n'a pas encore de code enfant) et remplit la fiche.
     - Lien direct de l'école : parent.html?ecole=CODE ouvre la fiche déjà
       remplie avec ce code.
     - Il suit ses demandes ; une fois acceptée, l'enfant apparaît seul dans
       son espace (aucun code à taper).
   DIRECTION (index.html, chef / Directeur des études / Secrétariat) :
     - Menu → « Pré-inscriptions » : accepter (choisir la classe → l'élève est
       créé et relié au parent) ou refuser ; lien à partager.
   ===================================================================== */
(function () {
    'use strict';
    const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PARENT = !!document.getElementById('pmain');
    const fd = d => d ? new Date(d).toLocaleDateString('fr-FR') : '';

    /* ---------- Fenêtre plein écran simple (même logique que le guide d'installation) ---------- */
    let OV = null;
    function panel(html) {
        if (!OV) {
            OV = document.createElement('div'); OV.className = 'oi-ov'; document.body.appendChild(OV); document.body.style.overflow = 'hidden';
            history.pushState({ pre: 1 }, '');
        }
        OV.innerHTML = `<div class="oi-head"><button type="button" class="oi-x" aria-label="Fermer">✕</button><b>Pré-inscription</b></div>` + html;
        OV.querySelector('.oi-x').onclick = () => history.back();
        return OV;
    }
    const closeP = () => { if (OV) { OV.remove(); OV = null; document.body.style.overflow = ''; } };
    window.addEventListener('popstate', e => { if (!OV) return; e.stopImmediatePropagation(); closeP(); }, true);

    /* ================= PARENT ================= */
    if (PARENT) {
        window.oreaPreForm = async function (code) {
            const o = panel(`<div class="oi-card"><h3>Inscrire un nouvel élève</h3><p>Pour un enfant qui n’est pas encore élève de l’école. Une fois votre demande acceptée, l’enfant apparaît tout seul dans votre espace.</p></div>
<form id=pf class="oi-card" style="display:flex;flex-direction:column;gap:8px">
<label>Code de l’école<input name=code required value="${E(code || '')}" autocomplete=off placeholder="Demandez-le à l’école"></label><small id=pf-sc></small>
<label>Nom complet de l’enfant<input name=child required maxlength=120></label>
<label>Sexe<select name=sexe><option value="">—</option><option value=F>Fille</option><option value=M>Garçon</option></select></label>
<label>Date de naissance<input name=born type=date></label>
<label>Classe demandée<input name=cls maxlength=80 placeholder="Ex. : 3e primaire"></label>
<label>École d’origine (facultatif)<input name=orig maxlength=120></label>
<label>Votre nom<input name=pname maxlength=120 value="${E((typeof P !== 'undefined' && P.me && P.me.full_name) || '')}"></label>
<label>Votre téléphone<input name=phone type=tel maxlength=30 required></label>
<label>Remarque (facultatif)<textarea name=note rows=2 maxlength=500></textarea></label>
<button type=submit class="p-btn">Envoyer la demande</button></form><div id=pf-mine></div>`);
            const f = o.querySelector('#pf');
            const look = async () => {
                const c = f.code.value.trim(); if (!c) return;
                const { data } = await db.rpc('v92_school_by_code', { p_code: c });
                const s = data && data[0]; const el = o.querySelector('#pf-sc');
                if (el) el.textContent = s ? '✓ ' + s.name : 'École introuvable : vérifiez le code.';
            };
            f.code.onchange = look; look();
            f.onsubmit = async e => {
                e.preventDefault();
                const b = f.querySelector('button[type=submit]'); b.disabled = true;
                const { error } = await db.rpc('v92_preinscrire', { p_code: f.code.value.trim(), p_child: f.child.value.trim(), p_sexe: f.sexe.value, p_naissance: f.born.value || null, p_classe: f.cls.value.trim(), p_origine: f.orig.value.trim(), p_parent: f.pname.value.trim(), p_phone: f.phone.value.trim(), p_note: f.note.value.trim() });
                b.disabled = false;
                if (error) return alert(error.message);
                f.reset(); alert('Demande envoyée ✓ L’école va l’étudier ; vous recevrez une notification.'); mine();
            };
            const mine = async () => {
                const { data } = await db.from('preinscriptions').select('child_name,classe_demandee,status,answer,created_at,schools(name)').order('created_at', { ascending: false }).limit(10);
                const box = o.querySelector('#pf-mine'); if (!box) return;
                box.innerHTML = (data || []).length ? `<div class="oi-card"><h3>Mes demandes</h3>${data.map(x => `<p><b>${E(x.child_name)}</b> · ${E(x.schools ? x.schools.name : '')} · ${x.status === 'acceptee' ? '✅ acceptée' : x.status === 'refusee' ? '❌ non retenue' : '⏳ en attente'}${x.answer ? '<br>' + E(x.answer) : ''}</p>`).join('')}</div>` : '';
            };
            mine();
        };
        // Bouton dans l'Accueil du parent
        const oHome = window.homeView;
        if (typeof oHome === 'function') window.homeView = function () {
            const r = oHome.apply(this, arguments);
            const m = document.getElementById('pmain');
            if (m && !m.querySelector('#pre-card')) {
                const c = document.createElement('div'); c.id = 'pre-card'; c.className = 'p-card'; c.style.cssText = 'cursor:default;margin-top:14px';
                c.innerHTML = '<h3>📝 Inscrire un nouvel élève</h3><div class="p-line"><small>Votre enfant n’est pas encore élève ? Faites sa pré-inscription avec le code de l’école.</small></div><button type="button" class="p-btn" style="width:100%;margin-top:8px">Pré-inscrire un enfant</button>';
                c.querySelector('button').onclick = () => oreaPreForm('');
                const nav = m.querySelector('.p-nav'); nav ? m.insertBefore(c, nav) : m.appendChild(c);
            }
            return r;
        };
        // Lien direct : parent.html?ecole=CODE
        const code = new URLSearchParams(location.search).get('ecole');
        if (code) {
            try { sessionStorage.setItem('orea_pre_code', code); history.replaceState(history.state, '', location.pathname); } catch (_) { }
        }
        const tryOpen = () => {
            const c = sessionStorage.getItem('orea_pre_code');
            if (!c || typeof P === 'undefined' || !P.me) return false;
            sessionStorage.removeItem('orea_pre_code'); oreaPreForm(c); return true;
        };
        let k = 0; const t = setInterval(() => { if (tryOpen() || ++k > 40) clearInterval(t); }, 500);
        return;
    }

    /* ================= DIRECTION ================= */
    const link = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'parent.html?ecole=' + encodeURIComponent(S.school.code);
    window.oreaPreins = async function () {
        const d = show(`<h3>Pré-inscriptions</h3><div id=pr-l><div class=sk></div></div><form method=dialog><button class=ghost>Fermer</button></form>`);
        const { data, error } = await db.from('preinscriptions').select('*').eq('school_id', S.school.id).order('created_at', { ascending: false }).limit(80);
        const box = d.querySelector('#pr-l'); if (!box) return;
        if (error) { box.innerHTML = `<p class=empty>${E(error.message)}</p>`; return; }
        const L = data || [], open = L.filter(x => x.status === 'en_attente'), done = L.filter(x => x.status !== 'en_attente');
        const canDo = !S.ro;
        box.innerHTML = `<div class="card col"><b>Lien à partager aux parents</b><small>Le parent crée son compte puis remplit la fiche. Il peut aussi utiliser le code de l’école : <b>${E(S.school.code)}</b></small><input readonly value="${E(link())}"><div class=row><button type=button class=ghost id=pr-copy>Copier</button><a class="btn ghost" style="text-align:center;text-decoration:none" target=_blank rel=noopener href="https://wa.me/?text=${encodeURIComponent('Pré-inscription à ' + S.school.name + ' : ' + link())}">WhatsApp</a></div></div>`
            + (open.length ? open.map(x => `<div class="card col" style="border-color:var(--gold)"><b>${E(x.child_name)}</b><small>${x.sexe === 'F' ? 'Fille' : x.sexe === 'M' ? 'Garçon' : ''}${x.date_naissance ? ' · né(e) le ' + fd(x.date_naissance) : ''}${x.classe_demandee ? ' · demande : ' + E(x.classe_demandee) : ''}${x.ecole_origine ? ' · vient de ' + E(x.ecole_origine) : ''}</small><small>Parent : ${E(x.parent_name || '')} · ${E(x.parent_phone || '')} · le ${fd(x.created_at)}</small>${x.note ? `<small>« ${E(x.note)} »</small>` : ''}
${canDo ? `<div class=row><button type=button data-ok="${x.id}">Accepter</button><button type=button class=ghost data-no="${x.id}" style="color:var(--bad)">Refuser</button></div>` : ''}</div>`).join('') : '<p class=empty>Aucune demande en attente.</p>')
            + (done.length ? `<details><summary>Demandes traitées (${done.length})</summary>${done.map(x => `<small style="display:block;padding:4px 0">${E(x.child_name)} · ${x.status === 'acceptee' ? '✅ acceptée' : '❌ refusée'} · ${fd(x.decided_at)}</small>`).join('')}</details>` : '');
        box.querySelector('#pr-copy').onclick = async () => { try { await navigator.clipboard.writeText(link()); toast('Lien copié ✓'); } catch (_) { toast('Copie impossible : sélectionnez le lien.'); } };
        const byId = id => L.find(x => x.id === id);
        box.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => {
            const x = byId(b.dataset.ok), cls = yc();
            if (!cls.length) return toast('Créez d’abord les classes de l’année.');
            ask('Accepter ' + E(x.child_name), [{ n: 'cls', l: 'Classe de l’élève', o: cls.map(c => [c.id, c.name]), v: cls[0].id }, { n: 'msg', l: 'Message au parent (facultatif)', r: false }], async v => {
                const { error: e } = await db.rpc('v92_decide_preinscription', { p_id: x.id, p_accept: true, p_class: v.cls, p_answer: v.msg || null });
                if (e) return toast(e.message);
                toast('Élève inscrit et relié au parent ✓'); if (typeof load === 'function') await load(); oreaPreins();
            });
        });
        box.querySelectorAll('[data-no]').forEach(b => b.onclick = () => {
            const x = byId(b.dataset.no);
            ask('Refuser ' + E(x.child_name), [{ n: 'msg', l: 'Raison (envoyée au parent, facultatif)', r: false }], async v => {
                const { error: e } = await db.rpc('v92_decide_preinscription', { p_id: x.id, p_accept: false, p_class: null, p_answer: v.msg || null });
                if (e) return toast(e.message); toast('Demande refusée'); oreaPreins();
            });
        });
    };
    // Menu → Administration : « Pré-inscriptions » (avec le nombre en attente)
    const oMenu = window.vMenu;
    if (typeof oMenu === 'function') window.vMenu = function () {
        const r = oMenu.apply(this, arguments);
        if (S.me && S.me.role === 'directeur') {
            const m = document.getElementById('main'), a = m && m.querySelector('[onclick*="pAdminAnnonce"]');
            if (a && !m.querySelector('#pre-menu')) {
                const t = document.createElement('div'); t.innerHTML = menuCard('equipe', 'Pré-inscriptions', 'Nouveaux élèves inscrits par les parents', 'oreaPreins()');
                const c = t.firstElementChild; c.id = 'pre-menu'; a.after(c);
                db.from('preinscriptions').select('id', { count: 'exact', head: true }).eq('school_id', S.school.id).eq('status', 'en_attente').then(({ count }) => { if (count) { const s = c.querySelector('small') || c; s.textContent = count + ' demande(s) en attente'; } });
            }
        }
        return r;
    };
})();
