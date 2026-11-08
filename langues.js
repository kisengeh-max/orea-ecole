/* =====================================================================
   ORÉA École v92 — langues.js : espace parent en Lingala et Kiswahili
   - Un bouton de langue dans l'en-tête de l'espace parent (FR · LN · SW).
   - Les textes de l'interface sont traduits à l'écran ; les noms, montants,
     dates et messages écrits par l'école ne changent pas.
   - POUR CORRIGER UNE TRADUCTION : modifiez simplement la ligne voulue
     dans le tableau T ci-dessous : [ 'Français', 'Lingala', 'Kiswahili' ].
     Une ligne absente reste en français.
   ⚠️ Traductions préparées par ORÉA : à faire relire par des locuteurs.
   ===================================================================== */
(function () {
    'use strict';
    const T = [
        // ---- Navigation et titres ----
        ['Accueil', 'Ebandeli', 'Mwanzo'],
        ['Messages', 'Bansango', 'Ujumbe'],
        ['École', 'Kelasi', 'Shule'],
        ['L\'école', 'Kelasi', 'Shule'],
        ['Notes', 'Ba points', 'Alama'],
        ['Notes & Bulletins', 'Ba points mpe ba bulletin', 'Alama na ripoti'],
        ['Scolarité', 'Masolo ya kelasi', 'Masomo'],
        ['Calendrier', 'Manaka', 'Kalenda'],
        ['Agenda', 'Manaka', 'Ratiba'],
        ['Enfants', 'Bana', 'Watoto'],
        ['Espace Parent', 'Esika ya moboti', 'Nafasi ya mzazi'],
        ['Notifications', 'Bayebisi', 'Taarifa'],
        ['Bonjour', 'Mbote', 'Habari'],
        // ---- Enfants ----
        ['Ajouter un enfant', 'Bakisa mwana', 'Ongeza mtoto'],
        ['+ Ajouter un enfant', '+ Bakisa mwana', '+ Ongeza mtoto'],
        ['+ Ajouter un autre enfant', '+ Bakisa mwana mosusu', '+ Ongeza mtoto mwingine'],
        ['Aucun enfant lié.', 'Mwana moko te akangami.', 'Hakuna mtoto aliyeunganishwa.'],
        ['Entre le code fourni par l\'école.', 'Koma code oyo kelasi epesi yo.', 'Andika namba ya siri uliyopewa na shule.'],
        ['Code', 'Code', 'Namba ya siri'],
        ['Ajouter', 'Bakisa', 'Ongeza'],
        ['Ajoutez un enfant pour discuter.', 'Bakisa mwana mpo na kosolola.', 'Ongeza mtoto ili kuzungumza.'],
        ['Ajoutez un enfant pour voir sa scolarité.', 'Bakisa mwana mpo na komona masolo na ye ya kelasi.', 'Ongeza mtoto ili kuona masomo yake.'],
        ['Ajoutez un enfant pour voir ses notes.', 'Bakisa mwana mpo na komona ba points na ye.', 'Ongeza mtoto ili kuona alama zake.'],
        // ---- Argent ----
        ['Solde', 'Oyo etikali', 'Salio'],
        ['Paiements', 'Bafuti', 'Malipo'],
        ['Payé', 'Efutami', 'Imelipwa'],
        ['Reste', 'Etikali', 'Bado'],
        ['Total payé', 'Nyonso efutami', 'Jumla iliyolipwa'],
        ['✓ À jour', '✓ Ekoki', '✓ Imekamilika'],
        ['À jour', 'Ekoki', 'Imekamilika'],
        ['Échéances promises', 'Mikolo ya kofuta elakami', 'Tarehe za malipo zilizoahidiwa'],
        ['Signaler une erreur', 'Yebisa libunga', 'Ripoti kosa'],
        ['⚠ Signaler une erreur', '⚠ Yebisa libunga', '⚠ Ripoti kosa'],
        // ---- Notes ----
        ['Voir les notes et bulletins', 'Tala ba points mpe ba bulletin', 'Angalia alama na ripoti'],
        ['Voir les notes et bulletins →', 'Tala ba points mpe ba bulletin →', 'Angalia alama na ripoti →'],
        ['Moyennes par cours', 'Ba moyenne na cours moko moko', 'Wastani kwa kila somo'],
        ['Pourcentage général', 'Pourcentage ya nyonso', 'Asilimia ya jumla'],
        ['Aucune note enregistrée pour le moment.', 'Point moko te ekomami sikoyo.', 'Hakuna alama iliyoandikwa kwa sasa.'],
        ['Aucune note pour cette période.', 'Point moko te mpo na eleko oyo.', 'Hakuna alama kwa kipindi hiki.'],
        ['Aucune note à imprimer.', 'Point moko te ya kobimisa.', 'Hakuna alama ya kuchapisha.'],
        ['Impossible de charger les notes.', 'Tokoki kofungola ba points te.', 'Imeshindikana kupakia alama.'],
        ['Télécharger le bulletin PDF', 'Kitisa bulletin (PDF)', 'Pakua ripoti (PDF)'],
        ['Bulletin en image (PNG)', 'Bulletin na foto (PNG)', 'Ripoti kama picha (PNG)'],
        ['Bulletin téléchargé', 'Bulletin ekitisami', 'Ripoti imepakuliwa'],
        // ---- Scolarité ----
        ['Devoirs', 'Misala ya ndako', 'Kazi za nyumbani'],
        ['Aucun devoir pour l\'instant.', 'Mosala ya ndako moko te sikoyo.', 'Hakuna kazi ya nyumbani kwa sasa.'],
        ['Cahier de textes', 'Buku ya masolo ya mokolo', 'Daftari la masomo'],
        ['Rien de noté pour le moment.', 'Eloko moko te ekomami sikoyo.', 'Hakuna kilichoandikwa kwa sasa.'],
        ['Devoir donné (voir Devoirs)', 'Mosala ya ndako epesami (tala Misala ya ndako)', 'Kazi imetolewa (angalia Kazi za nyumbani)'],
        ['Emploi du temps', 'Ntango ya mateya', 'Ratiba ya masomo'],
        ['Aucun emploi du temps.', 'Ntango ya mateya ezali te.', 'Hakuna ratiba ya masomo.'],
        ['Horaires', 'Ba ngonga', 'Saa'],
        ['Aucun horaire pour l’instant.', 'Ngonga moko te sikoyo.', 'Hakuna saa kwa sasa.'],
        ['Présences (30j)', 'Kozala (mikolo 30)', 'Mahudhurio (siku 30)'],
        ['Sanctions', 'Bitumbu', 'Adhabu'],
        ['Convocations', 'Mabiangi', 'Wito'],
        ['Aucune convocation.', 'Libiangi moko te.', 'Hakuna wito.'],
        ['Convocation archivée', 'Libiangi ebombami', 'Wito umehifadhiwa'],
        ['Confirmer', 'Ndimisa', 'Thibitisha'],
        ['Confirmé ✓', 'Endimisami ✓', 'Imethibitishwa ✓'],
        // ---- Justificatif d'absence ----
        ['Envoyer un justificatif', 'Tinda ndimbola ya kozanga', 'Tuma sababu ya kutokuwepo'],
        ['Absence', 'Kozanga', 'Kutokuwepo'],
        ['Retard', 'Koumela', 'Kuchelewa'],
        ['Départ anticipé', 'Kokende liboso ya ntango', 'Kuondoka mapema'],
        ['Aujourd\'hui seulement', 'Lelo kaka', 'Leo tu'],
        ['Plusieurs jours', 'Mikolo mingi', 'Siku kadhaa'],
        ['Date de début', 'Mokolo ya ebandeli', 'Tarehe ya kuanza'],
        ['Date de fin', 'Mokolo ya nsuka', 'Tarehe ya mwisho'],
        ['Heure', 'Ngonga', 'Saa'],
        ['Autre motif', 'Ntina mosusu', 'Sababu nyingine'],
        ['Motif (maladie, rendez-vous...)', 'Ntina (bokono, kokutana...)', 'Sababu (ugonjwa, miadi...)'],
        ['Justificatif envoyé ✓', 'Ndimbola etindami ✓', 'Sababu imetumwa ✓'],
        ['Remplissez la date et le motif', 'Tia mokolo mpe ntina', 'Jaza tarehe na sababu'],
        ['Précisez la date de fin', 'Pesa mokolo ya nsuka', 'Taja tarehe ya mwisho'],
        ['La date de fin doit être après la date de début', 'Mokolo ya nsuka esengeli koya nsima ya mokolo ya ebandeli', 'Tarehe ya mwisho lazima iwe baada ya tarehe ya kuanza'],
        // ---- Messages et école ----
        ['Écrire à l’école', 'Komela kelasi', 'Andikia shule'],
        ['Envoyer à l\'école', 'Tinda na kelasi', 'Tuma kwa shule'],
        ['Envoyer', 'Tinda', 'Tuma'],
        ['Envoyé ✓', 'Etindami ✓', 'Imetumwa ✓'],
        ['Aucun message avec l\'école.', 'Nsango moko te na kelasi.', 'Hakuna ujumbe na shule.'],
        ['Annonces de l\'école', 'Basango ya kelasi', 'Matangazo ya shule'],
        ['Aucune annonce pour le moment.', 'Nsango moko te sikoyo.', 'Hakuna tangazo kwa sasa.'],
        ['Les annonces de l’école apparaîtront ici.', 'Basango ya kelasi ekobima awa.', 'Matangazo ya shule yataonekana hapa.'],
        ['Aucun événement à venir.', 'Likambo moko te ekoya.', 'Hakuna tukio linalokuja.'],
        ['Rien de nouveau.', 'Eloko ya sika te.', 'Hakuna jipya.'],
        ['Tout marquer comme lu', 'Lakisa nyonso etangami', 'Weka yote kama yamesomwa'],
        ['Signalement envoyé à l’école ✓', 'Toyebisi kelasi ✓', 'Taarifa imetumwa kwa shule ✓'],
        ['← Retour', '← Zonga', '← Rudi'],
        ['← Retour à l\'école', '← Zonga na kelasi', '← Rudi shuleni'],
        // ---- Aide, compte, application ----
        ['Vous avez besoin d’aide ?', 'Osengeli na lisalisi ?', 'Unahitaji msaada ?'],
        ['Appeler', 'Benga', 'Piga simu'],
        ['Se déconnecter', 'Bima', 'Toka'],
        ['Supprimer mon compte', 'Longola compte na ngai', 'Futa akaunti yangu'],
        ['Annuler', 'Tika', 'Ghairi'],
        ['Chargement…', 'Ezali koya…', 'Inapakia…'],
        ['Installer l’application', 'Tia application', 'Sakinisha programu'],
        ['Installez-la sur ce téléphone : elle s’ouvre comme une vraie application.', 'Tia yango na telefone oyo : ekofungwama lokola application ya solo.', 'Isakinishe kwenye simu hii : itafunguka kama programu halisi.'],
        ['Solo ou en famille, même sans réseau', 'Yo moko to na libota, ata soki réseau ezali te', 'Peke yako au na familia, hata bila mtandao'],
        // ---- Pré-inscription ----
        ['Inscrire un nouvel élève', 'Komisa moyekoli ya sika', 'Andikisha mwanafunzi mpya'],
        ['Pré-inscrire un enfant', 'Komisa mwana liboso', 'Andikisha mtoto mapema'],
        ['Votre enfant n’est pas encore élève ? Faites sa pré-inscription avec le code de l’école.', 'Mwana na yo azali naino moyekoli te ? Komisa ye na code ya kelasi.', 'Mtoto wako bado si mwanafunzi ? Mwandikishe kwa namba ya siri ya shule.'],
        ['Envoyer la demande', 'Tinda bosenga', 'Tuma ombi'],
        ['Mes demandes', 'Basenga na ngai', 'Maombi yangu']
    ];
    // Textes avec une partie qui change (montant, date…)
    const RX = [
        [/^Doit (.+)$/, 'Asengeli kofuta $1', 'Anadaiwa $1'],
        [/^Total payé : (.+)$/, 'Nyonso efutami : $1', 'Jumla iliyolipwa : $1'],
        [/^Reste (.+)$/, 'Etikali $1', 'Bado $1']
    ];
    const IDX = { ln: 1, sw: 2 };
    const MAP = { ln: new Map(), sw: new Map() };
    T.forEach(r => { MAP.ln.set(r[0], r[1]); MAP.sw.set(r[0], r[2]); });
    let LANG = localStorage.getItem('orea_lang') || 'fr';
    if (!['fr', 'ln', 'sw'].includes(LANG)) LANG = 'fr';

    // Garde le texte français d'origine pour pouvoir revenir au français
    const ORIG = new WeakMap(), AORIG = new WeakMap();
    const split = t => { const m = t.match(/^(\s*[^\p{L}\p{N}+←«]*)([\s\S]*?)(\s*)$/u); return m ? [m[1], m[2], m[3]] : ['', t, '']; };
    function tr(fr) {
        if (LANG === 'fr' || !fr) return fr;
        const [pre, core, post] = split(fr);
        const m = MAP[LANG];
        if (m.has(fr.trim())) return fr.replace(fr.trim(), m.get(fr.trim()));
        if (m.has(core)) return pre + m.get(core) + post;
        for (const r of RX) if (r[0].test(core)) return pre + core.replace(r[0], r[IDX[LANG]]) + post;
        return fr;
    }
    function walk(root) {
        if (!root) return;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
            const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || p.closest('[data-notr],.oi-ov input')) continue;
            if (!ORIG.has(n)) ORIG.set(n, n.nodeValue);
            const want = tr(ORIG.get(n));
            if (n.nodeValue !== want) { busy = true; n.nodeValue = want; }
        }
        root.querySelectorAll && root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
            let o = AORIG.get(el); if (!o) { o = { p: el.getAttribute('placeholder'), t: el.getAttribute('title'), a: el.getAttribute('aria-label') }; AORIG.set(el, o); }
            busy = true;
            if (o.p != null) el.setAttribute('placeholder', tr(o.p));
            if (o.t != null) el.setAttribute('title', tr(o.t));
            if (o.a != null) el.setAttribute('aria-label', tr(o.a));
        });
    }
    let busy = false, raf = 0;
    const mo = new MutationObserver(muts => {
        if (busy) { busy = false; return; }
        if (LANG === 'fr') return;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { walk(document.body); busy = false; });
    });
    // Un texte changé par l'application (ex. compteur) devient le nouveau texte d'origine
    const mo2 = new MutationObserver(muts => muts.forEach(m => {
        if (m.type !== 'characterData') return;
        const n = m.target, o = ORIG.get(n);
        if (o !== undefined && n.nodeValue === tr(o)) return;   // c'est notre propre traduction
        ORIG.set(n, n.nodeValue);
    }));

    /* ---------- Bouton de langue dans l'en-tête ---------- */
    function button() {
        const h = document.querySelector('body > header'); if (!h || document.getElementById('lgSel')) return;
        const s = document.createElement('select'); s.id = 'lgSel'; s.setAttribute('aria-label', 'Langue'); s.dataset.notr = '1';
        s.innerHTML = '<option value="fr">FR</option><option value="ln">LN</option><option value="sw">SW</option>';
        s.value = LANG;
        s.style.cssText = 'width:auto;min-width:58px;height:36px;padding:0 6px;margin:0;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--gold);font-weight:800;font-size:13px;flex:none';
        s.onchange = () => setLang(s.value);
        const th = document.getElementById('thBtn'); th ? h.insertBefore(s, th) : h.appendChild(s);
    }
    function setLang(l) {
        LANG = l; try { localStorage.setItem('orea_lang', l); } catch (_) { }
        document.documentElement.lang = l === 'ln' ? 'ln' : l === 'sw' ? 'sw' : 'fr';
        walk(document.body);
        if (typeof toast === 'function') toast(l === 'ln' ? 'Lingala' : l === 'sw' ? 'Kiswahili' : 'Français');
    }
    window.oreaLang = { set: setLang, get: () => LANG, tr };
    function start() {
        button(); setTimeout(button, 1500);
        mo.observe(document.body, { childList: true, subtree: true });
        mo2.observe(document.body, { characterData: true, subtree: true });
        if (LANG !== 'fr') { document.documentElement.lang = LANG; walk(document.body); }
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
