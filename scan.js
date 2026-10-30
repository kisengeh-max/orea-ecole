// ORÉA École — Module QR Code & Pointage (Tranche 3/6)
let html5QrCode = null;

// 1) Ajouter le bouton "Scanner" dans le Menu
const _origMenuScan = window.vMenu;
window.vMenu = function() {
    _origMenuScan();
    // On ajoute le bouton Scanner juste après "Présences"
    const main = document.getElementById('main');
    if (main) {
        const btnPresence = main.querySelector('[onclick*="presences"]');
        if (btnPresence) {
            const div = document.createElement('div');
            div.innerHTML = menuCard('graph', 'Scanner un élève', 'Ouvrir la caméra', "S.notesView='scan'; menuGo('scan_qr')");
            btnPresence.after(div.firstChild);
        }
    }
};

// Interception du routeur pour la vue Scanner
const _origRenderScan = window.render;
window.render = function() {
    if (S.tab === 'scan_qr') {
        S.tab = 'menu';
        _origRenderScan();
        S.tab = 'scan_qr';
        vScanQR();
        return;
    }
    _origRenderScan();
};

// 2) Ajouter le bouton "Carte Scolaire" sur la fiche élève
const _origMenuStudent = window.menu;
window.menu = function(id) {
    _origMenuStudent(id);
    setTimeout(() => {
        const d = document.querySelector('#dlg');
        if (d && d.open) {
            const col = d.querySelector('.col');
            if (col && !document.getElementById('btn_card')) {
                const btn = document.createElement('button');
                btn.id = 'btn_card';
                btn.className = 'ghost';
                btn.innerHTML = '📇 Imprimer Carte Scolaire';
                btn.onclick = () => { d.close(); printCard(id); };
                // L'insérer juste avant le bouton "Fermer"
                col.insertBefore(btn, col.lastElementChild);
            }
        }
    }, 100);
};

// ==========================================
// GÉNÉRATION DE LA CARTE SCOLAIRE
// ==========================================
async function printCard(id) {
    const s = S.stu.find(x => x.id === id);
    if (!s) return toast('Élève introuvable');
    
    show('<h3>Génération de la carte...</h3><div style="text-align:center;padding:20px"><div class=sk></div></div>');
    
    // Créer un div temporaire pour générer le QR
    const tmp = document.createElement('div');
    tmp.style.display = 'none';
    document.body.appendChild(tmp);
    new QRCode(tmp, { text: s.id, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.H });
    
    // Attendre que le QR soit dessiné
    setTimeout(async () => {
        const qrImg = tmp.querySelector('img');
        if (!qrImg) { $('#dlg').close(); return toast('Erreur QR'); }
        
        // Créer le Canvas de la carte
        const cv = document.createElement('canvas');
        cv.width = 600; cv.height = 380;
        const x = cv.getContext('2d');
        
        // Fond
        x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 600, 380);
        
        // Bordure dorée
        const gg = x.createLinearGradient(0, 0, 600, 380);
        gg.addColorStop(0, '#e9cf86'); gg.addColorStop(.5, '#b08a30'); gg.addColorStop(1, '#8a6a1f');
        x.strokeStyle = gg; x.lineWidth = 6; x.strokeRect(10, 10, 580, 360);
        
        // En-tête
        x.fillStyle = gg; x.fillRect(10, 10, 580, 60);
        x.fillStyle = '#111'; x.font = 'bold 24px Georgia,serif'; x.textAlign = 'center';
        x.fillText(S.school.name.toUpperCase(), 300, 48);
        
        // Infos élève
        x.textAlign = 'left'; x.fillStyle = '#111';
        x.font = 'bold 28px sans-serif'; x.fillText(s.name, 40, 120);
        x.font = '20px sans-serif'; x.fillStyle = '#6b6a60';
        x.fillText('Classe : ' + (S.classes.find(c => c.id === s.class_id) || {}).name, 40, 160);
        if (s.parent_phone) x.fillText('Contact : ' + s.parent_phone, 40, 190);
        x.fillText('Année : ' + (S.year || '—'), 40, 220);
        
        // QR Code
        x.fillStyle = '#fff'; x.fillRect(380, 90, 180, 180);
        x.drawImage(qrImg, 390, 100, 160, 160);
        x.textAlign = 'center'; x.fillStyle = '#6b6a60'; x.font = '14px sans-serif';
        x.fillText('Scannez pour identifier', 470, 290);
        
        // Pied de page
        x.fillStyle = gg; x.fillRect(10, 320, 580, 4);
        x.fillStyle = '#6b6a60'; x.font = '14px sans-serif';
        x.fillText('Carte Scolaire — ORÉA École', 300, 350);
        
        // Téléchargement
        const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
        const url = URL.createObjectURL(blob);
        const fn = 'carte-' + s.name.replace(/\s+/g, '-') + '.png';
        
        $('#dlg').innerHTML = `<h3>Carte de ${esc(s.name)}</h3>
            <img src="${url}" style="width:100%;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.5)">
            <div class=col style="margin-top:15px">
                <a class="btn" download="${fn}" href="${url}" style="text-align:center;text-decoration:none">📥 Télécharger la carte</a>
                <button class=ghost onclick="this.closest('dialog').close()">Fermer</button>
            </div>`;
        
        tmp.remove();
    }, 200);
}

// ==========================================
// SCANNER QR CODE
// ==========================================
function vScanQR() {
    let h = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>
    <h3>Scanner un élève</h3>
    <p style="text-align:center;font-size:14px;color:var(--mut)">Visez le QR Code de la carte scolaire ou de l'élève.</p>
    <div id="qr-reader" style="width:100%;margin-top:15px"></div>
    <div class="card col" style="margin-top:15px">
        <b>Mode Gardien (Pointage)</b>
        <small>Enregistrer les entrées et sorties.</small>
        <div class="row" style="margin-top:10px">
            <button id="btn_entree" class="ghost">🚪 Entrée</button>
            <button id="btn_sortie" class="ghost">🚶 Sortie</button>
        </div>
    </div>`;
    $('#main').innerHTML = h;
    
    // Initialisation du scanner
    if (html5QrCode) html5QrCode.clear();
    html5QrCode = new Html5Qrcode("qr-reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            // Succès : on arrête le scan et on traite
            html5QrCode.stop().then(() => {
                processScan(decodedText, 'payer'); // Par défaut, mode paiement
            });
        },
        (errorMessage) => { /* Ignorer les erreurs de scan en cours */ }
    ).catch(err => {
        $('#qr-reader').innerHTML = `<div class="card col" style="text-align:center;padding:20px;color:var(--bad)">
            <b>Caméra inaccessible</b>
            <small>Vérifiez les permissions ou utilisez un téléphone compatible.</small>
        </div>`;
    });
    
    // Boutons Mode Gardien
    $('#btn_entree').onclick = () => startGuardMode('entree');
    $('#btn_sortie').onclick = () => startGuardMode('sortie');
}

function startGuardMode(type) {
    if (!html5QrCode) return;
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            html5QrCode.stop().then(() => {
                processScan(decodedText, 'gardien', type);
            });
        },
        (errorMessage) => {}
    );
}

async function processScan(studentId, mode, type = null) {
    const s = S.stu.find(x => x.id === studentId);
    if (!s) {
        toast('Élève introuvable dans cette école.');
        return vScanQR(); // Relancer le scan
    }
    
    if (mode === 'gardien') {
        // Enregistrement entrée/sortie
        const { error } = await db.from('attendance_logs').insert({
            school_id: S.school.id, student_id: s.id, type, scanned_by: S.me.id
        });
        if (error) return toast('Erreur: ' + error.message);
        
        // Confirmation visuelle
        show(`<h3 style="color:var(--ok);text-align:center;margin-top:20px">✓ ${type === 'entree' ? 'Entrée' : 'Sortie'} enregistrée</h3>
            <div class="card col" style="text-align:center;margin-top:20px">
                <b style="font-size:20px">${esc(s.name)}</b>
                <small>${esc(cnm(s.class_id))}</small>
                <small>${new Date().toLocaleTimeString('fr-FR')}</small>
            </div>
            <div class="row" style="margin-top:20px">
                <button class=ghost onclick="this.closest('dialog').close(); vScanQR();">Scanner un autre</button>
                <button onclick="this.closest('dialog').close(); S.tab='menu';render();">Terminer</button>
            </div>`);
    } else {
        // Mode Paiement : ouvrir la fiche élève
        vScanQR(); // Réinitialiser en arrière-plan
        menu(s.id); // Ouvre le menu de l'élève
    }
}
