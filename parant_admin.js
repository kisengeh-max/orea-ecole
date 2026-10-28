// ORÉA École — Admin Parents (K2) - Version robuste
(function() {
    // 1. Fonction qui injecte la section dans le menu
    function inject() {
        // On vérifie qu'on est bien connecté, en tant que directeur, sur l'onglet Menu
        if (typeof S === 'undefined' || !S.me || S.me.role !== 'directeur') return;
        if (S.tab !== 'menu') return;
        
        const main = document.getElementById('main');
        if (!main) return;
        
        // Si on a déjà injecté, on ne le refait pas
        if (main.querySelector('.p-admin-section')) return; 
        
        const h3 = main.querySelector('h3');
        if (!h3 || h3.textContent !== 'Menu') return; // On attend que le menu soit affiché
        
        const div = document.createElement('div');
        div.className = 'p-admin-section';
        div.innerHTML = `
            <h3 style="color:var(--gold);margin-top:20px">Parents & Communication</h3>
            <div class="card" onclick="pAdminInbox()"><span>💬 Messages des parents</span><b>›</b></div>
            <div class="card" onclick="pAdminJustifs()"><span>📝 Justificatifs d'absence</span><b>›</b></div>
            <div class="card" onclick="pAdminAnnonce()"><span>📢 Publier une annonce</span><b>›</b></div>
        `;
        // On insère juste après le titre <h3>Menu</h3>
        h3.after(div);
    }

    // 2. On surveille les changements d'écran
    const observer = new MutationObserver(inject);
    const start = () => {
        const main = document.getElementById('main');
        if (main) {
            observer.observe(main, { childList: true });
            inject();
        } else {
            setTimeout(start, 100);
        }
    };
    start();

    // 3. Les fonctions pour le directeur
    window.pAdminInbox = async function() {
        const { data } = await db.from('parent_messages').select('*, students(name)').order('created_at', { ascending: false }).limit(50);
        if (!data) return;
        const grouped = {};
        data.forEach(m => { if (!grouped[m.student_id]) grouped[m.student_id] = []; grouped[m.student_id].push(m); });
        let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Messages Parents</h3>`;
        if (!Object.keys(grouped).length) h += `<p class=empty>Aucun message.</p>`;
        else {
            h += Object.entries(grouped).map(([sid, msgs]) => {
                const sname = msgs[0].students?.name || 'Élève';
                return `<div class="card col"><b>${esc(sname)}</b>${msgs.slice(0,3).map(m => `<small>${m.sender_role==='parent'?'👤':'🏫'} ${esc(m.content)}</small>`).join('')}<button class=ghost onclick="pAdminReply('${sid}')">Répondre</button></div>`;
            }).join('');
        }
        $('#main').innerHTML = h;
    };

    window.pAdminReply = function(sid) {
        const d = show(`<form method=dialog><h3>Répondre</h3><textarea name=txt rows=3 style="width:100%" required></textarea><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Envoyer</button></div></form>`);
        d.querySelector('form').onsubmit = async e => {
            if (e.submitter.value !== 'ok') return;
            e.preventDefault();
            const txt = e.target.txt.value.trim();
            const s = S.stu.find(x => x.id === sid);
            if (!s) return;
            const {data} = await db.from('parent_links').select('parent_id').eq('student_id', sid).limit(1).single();
            if (!data || !data.parent_id) return toast('Aucun parent lié');
            await db.from('parent_messages').insert({ school_id: S.school.id, student_id: sid, parent_id: data.parent_id, sender_role: 'ecole', content: txt });
            d.close(); toast('Envoyé ✓'); pAdminInbox();
        };
    };

    window.pAdminJustifs = async function() {
        const { data } = await db.from('absence_justifications').select('*, students(name)').eq('status', 'en_attente').order('created_at');
        let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div><h3>Justificatifs en attente</h3>`;
        if (!data || !data.length) h += `<p class=empty>Aucun justificatif à traiter.</p>`;
        else h += data.map(j => `<div class="card col"><b>${esc(j.students?.name || '')} · ${new Date(j.day+'T00:00').toLocaleDateString('fr-FR')}</b><small>${esc(j.reason)}</small><div class=row><button onclick="pAdminJustifAct('${j.id}','approuve')">Approuver</button><button class=ghost onclick="pAdminJustifAct('${j.id}','refuse')">Refuser</button></div></div>`).join('');
        $('#main').innerHTML = h;
    };

    window.pAdminJustifAct = async function(id, st) {
        await db.from('absence_justifications').update({ status: st }).eq('id', id);
        toast('Mis à jour'); pAdminJustifs();
    };

    window.pAdminAnnonce = function() {
        const d = show(`<form method=dialog><h3>Nouvelle annonce</h3><label>Titre<input name=titre required></label><label>Contenu<textarea name=txt rows=4 style="width:100%" required></textarea></label><div class=row><button value=x class=ghost formnovalidate>Annuler</button><button value=ok>Publier</button></div></form>`);
        d.querySelector('form').onsubmit = async e => {
            if (e.submitter.value !== 'ok') return;
            e.preventDefault();
            const f = e.target;
            await db.from('announcements').insert({ school_id: S.school.id, author_id: S.me.id, title: f.titre.value.trim(), content: f.txt.value.trim() });
            d.close(); toast('Annonce publiée ✓');
        };
    };
})();
