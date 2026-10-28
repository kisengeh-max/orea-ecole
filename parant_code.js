// ORÉA École — Affichage du code parent dans le menu élève
(function() {
    if (typeof menu === 'undefined') { setTimeout(arguments.callee, 100); return; }
    const origMenu = menu;
    window.menu = function(id) {
        origMenu(id);
        const s = S.stu.find(x => x.id === id);
        if (!s) return;
        const d = document.getElementById('dlg');
        const col = d.querySelector('.col');
        if (col) {
            const btn = document.createElement('button');
            btn.className = 'ghost';
            btn.textContent = '🔑 Voir le code Parent';
            btn.onclick = async () => {
                btn.textContent = '⏳ Chargement...';
                const { data, error } = await db.from('students').select('access_code').eq('id', id).single();
                if (error || !data) return btn.textContent = '❌ Erreur';
                btn.textContent = '🔑 Code : ' + data.access_code;
                btn.onclick = () => {
                    navigator.clipboard.writeText(data.access_code).then(()=>toast('Code copié !')).catch(()=>toast(data.access_code));
                };
            };
            const closeBtn = col.querySelector('#m3');
            if (closeBtn) col.insertBefore(btn, closeBtn);
            else col.appendChild(btn);
        }
    };
})();
