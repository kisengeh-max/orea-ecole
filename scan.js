// ORÉA École v91 — Module QR Code : carte scolaire + scanner (entrée = présent, sortie vérifiée, paiement)
let html5QrCode = null;

// 1) Ajouter le bouton "Scanner" dans le Menu
const _origMenuScan = window.vMenu;
window.vMenu = function() {
    _origMenuScan();
    const main = document.getElementById('main');
    if (main) {
        const btnPresence = main.querySelector('[onclick*="presences"]');
        if (btnPresence) {
            const div = document.createElement('div');
            div.innerHTML = menuCard('graph', 'Scanner une carte', S.me && S.me.gardien ? 'Gardien : entrées et sorties' : 'Entrée · Sortie · Paiement', "menuGo('scan_qr')");
            btnPresence.after(div.firstChild);
        }
    }
};

// Interception du routeur
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
                col.insertBefore(btn, col.lastElementChild);
            }
        }
    }, 100);
};

// ==========================================
// GÉNÉRATION DE LA CARTE SCOLAIRE (CORRIGÉ)
// ==========================================
async function printCard(id) {
    const s = S.stu.find(x => x.id === id);
    if (!s) return toast('Élève introuvable');
    
    show('<h3>Génération de la carte...</h3><div style="text-align:center;padding:20px"><div class=sk></div></div>');
    
    const tmp = document.createElement('div');
    tmp.style.display = 'none';
    document.body.appendChild(tmp);
    new QRCode(tmp, { text: s.id, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.H });
    
    // On attend 300ms que le canvas soit généré
    setTimeout(async () => {
        // qrcodejs génère parfois une balise <canvas> ou <img>. On prend ce qui est dispo.
        const qrCanvas = tmp.querySelector('canvas');
        const qrImg = tmp.querySelector('img');
        
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
        
        // QR Code (Correction ici)
        x.fillStyle = '#fff'; x.fillRect(380, 90, 180, 180);
        if (qrCanvas) {
            x.drawImage(qrCanvas, 390, 100, 160, 160);
        } else if (qrImg) {
            x.drawImage(qrImg, 390, 100, 160, 160);
        }
        
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
    }, 300); // Augmenté à 300ms pour être sûr
}

// ==========================================
// SCANNER QR CODE
// ==========================================
/* ---------- v91 : scanner (Entrée · Sortie · Fiche et paiement) ----------
   - Entrée : l'élève est marqué PRÉSENT dans Présences (ou « retard » s'il était noté absent).
   - Sortie : on vérifie les personnes autorisées à le récupérer (fiche de l'élève).
   - Fiche et paiement : ouvre directement l'encaissement de l'élève.
   La caméra reste allumée entre deux élèves (gardien) et s'éteint en quittant la page.
   Hors connexion : les entrées / sorties sont gardées et envoyées au retour du réseau (offline.js). */
const SC = { mode: null, busy: false, last: '', lastAt: 0, n: 0 };
function stopCam() {
    const q = html5QrCode; html5QrCode = null;
    if (!q) return;
    try { const st = q.getState ? q.getState() : 2; if (st === 2 || st === 3) q.stop().then(() => { try { q.clear(); } catch (_) { } }).catch(() => { }); else q.clear(); } catch (_) { }
}
const _origRenderScan2 = window.render;
window.render = function () { if (S.tab !== 'scan_qr') stopCam(); return _origRenderScan2.apply(this, arguments); };
document.addEventListener('visibilitychange', () => { if (document.hidden && S.tab === 'scan_qr') stopCam(); else if (!document.hidden && S.tab === 'scan_qr' && !html5QrCode) startCam(); });

function vScanQR() {
    const g = !!(S.me && S.me.gardien);
    if (!SC.mode) SC.mode = g ? 'entree' : 'fiche';
    const chip = (m, l) => `<button type=button class="chip ${SC.mode === m ? 'on' : ''}" data-sm="${m}" style="flex:1">${l}</button>`;
    $('#main').innerHTML = `<div class=bar><button class=ghost onclick="S.tab='menu';render()">← Menu</button></div>
<h3>Scanner une carte</h3>
<div class=row style="margin-bottom:8px">${chip('entree', '🚪 Entrée')}${chip('sortie', '🚶 Sortie')}${chip('fiche', '💳 Fiche / paiement')}</div>
<small id=sc-help style="display:block;text-align:center;color:var(--mut)"></small>
<div id="qr-reader" style="width:100%;margin-top:10px"></div>
<div id=sc-res></div>`;
    const help = { entree: 'Chaque carte scannée marque l’élève présent. La caméra reste allumée pour l’élève suivant.', sortie: 'Scannez la carte, puis choisissez la personne qui récupère l’élève.', fiche: 'Ouvre la fiche de l’élève et l’encaissement.' };
    $('#sc-help').textContent = help[SC.mode] + (SC.n ? ` · ${SC.n} scan(s) depuis l’ouverture` : '');
    document.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => { SC.mode = b.dataset.sm; vScanQR(); });
    startCam();
}
function startCam() {
    if (html5QrCode || !document.getElementById('qr-reader')) return;
    if (typeof Html5Qrcode === 'undefined') { $('#qr-reader').innerHTML = '<div class="card col" style="text-align:center;color:var(--bad)"><b>Scanner indisponible</b><small>Connectez-vous une fois à internet pour charger le scanner.</small></div>'; return; }
    html5QrCode = new Html5Qrcode('qr-reader');
    html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onCode, () => { })
        .catch(() => { $('#qr-reader').innerHTML = '<div class="card col" style="text-align:center;padding:20px;color:var(--bad)"><b>Caméra inaccessible</b><small>Autorisez la caméra pour ORÉA dans les réglages du téléphone.</small></div>'; html5QrCode = null; });
}
async function onCode(txt) {
    const id = String(txt || '').trim();
    if (SC.busy || (id === SC.last && Date.now() - SC.lastAt < 4000)) return;
    SC.last = id; SC.lastAt = Date.now();
    const s = S.stu.find(x => x.id === id);
    const res = $('#sc-res');
    if (!s) { if (res) res.innerHTML = '<div class="card col" style="border-color:var(--bad)"><b class=due>Carte inconnue</b><small>Cette carte n’est pas d’un élève de l’école.</small></div>'; return; }
    try { navigator.vibrate && navigator.vibrate(60); } catch (_) { }
    SC.n++;
    if (SC.mode === 'fiche') { stopCam(); return (typeof hist === 'function' && (money() || isCol())) ? hist(s.id) : menu(s.id); }
    if (SC.mode === 'entree') {
        SC.busy = true;
        const { data, error } = await db.rpc('v91_scan', { p_student: s.id, p_kind: 'entree' });
        SC.busy = false;
        if (error) { res.innerHTML = `<div class="card col" style="border-color:var(--bad)"><b class=due>${esc(s.name)}</b><small>${esc(error.message)}</small></div>`; return; }
        const st = data && data.status, off = data && data.offline;
        res.innerHTML = `<div class="card col" style="border-color:var(--ok);text-align:center"><b style="font-size:20px">✓ ${esc(s.name)}</b><small>${esc(cnm(s.class_id))} · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small><b class="${st === 'retard' ? 'due' : 'ok'}">${off ? 'Entrée gardée (envoi au retour du réseau)' : st === 'retard' ? 'En retard' : 'Présent'}</b></div>`;
        return;
    }
    // Sortie : qui récupère l'élève ?
    SC.busy = true;
    const { data: ppl } = await db.from('pickup_people').select('id,full_name,relation').eq('student_id', s.id);
    const P = ppl || [];
    res.innerHTML = `<div class="card col"><b style="font-size:18px">${esc(s.name)}</b><small>${esc(cnm(s.class_id))} · qui le / la récupère ?</small>
${P.length ? P.map(x => `<button type=button class=ghost data-pp="${x.id}">✓ ${esc(x.full_name)}${x.relation ? ' · ' + esc(x.relation) : ''}</button>`).join('') : '<small class=due>Aucune personne autorisée enregistrée pour cet élève.</small>'}
<input id=sc-other placeholder="Autre personne : nom complet" maxlength=120>
<div class=row><button type=button class=ghost id=sc-cx>Annuler</button><button type=button id=sc-ok>Valider la sortie</button></div></div>`;
    const done = async (person, name) => {
        const { data, error } = await db.rpc('v91_scan', { p_student: s.id, p_kind: 'sortie', p_person: person || null, p_picked_by: name || null });
        SC.busy = false;
        if (error) { res.innerHTML = `<div class="card col" style="border-color:var(--bad)"><b class=due>${esc(error.message)}</b></div>`; return; }
        const ok = person && !(data && data.offline === undefined && data.autorise === false);
        res.innerHTML = `<div class="card col" style="border-color:var(${ok ? '--ok' : '--bad'});text-align:center"><b>${esc(s.name)} · sortie enregistrée</b><small>${ok ? 'Remis à une personne autorisée' : '⚠ Personne NON enregistrée : vérifiez son identité. Les parents sont prévenus.'}${name || ok ? ' · ' + esc(name || (P.find(x => x.id === person) || {}).full_name || '') : ''}</small></div>`;
    };
    res.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => done(b.dataset.pp, null));
    res.querySelector('#sc-ok').onclick = () => { const n = res.querySelector('#sc-other').value.trim(); if (!n) return toast('Choisissez une personne autorisée ou écrivez le nom.'); if (!P.length || confirm(n + ' n’est pas sur la liste des personnes autorisées. Valider quand même ?')) done(null, n); };
    res.querySelector('#sc-cx').onclick = () => { SC.busy = false; res.innerHTML = ''; };
}
