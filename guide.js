/* =====================================================================
   ORÉA École v108 — guide.js : « Comment utiliser ORÉA ? »
   Guide complet, intégré à l'application (marche sans internet).
   - Fiches courtes par thème, adaptées au rôle (direction, enseignant, percepteur, parent).
   - Loupe : recherche par mot clé, sans accents, avec mots proches (bulletin → relevé, notes…).
   - Bouton « Ouvrir » : amène directement à la fonctionnalité.
   Accès : bouton sur l'accueil (école et parent) + carte dans le Menu de l'école.
   ===================================================================== */
(function () {
    'use strict';
    const PARENT = !!document.getElementById('pmain');
    const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const N = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
    const say = m => { try { toast(m); } catch (_) { } };

    // ---------- Qui voit quoi ----------
    const me = () => (typeof S !== 'undefined' && S.me) || null;
    const R = {
        all: () => true,
        staff: () => !!me(),
        dir: () => !!(me() && me().role === 'directeur' && !me().secretariat),
        dirsec: () => !!(me() && me().role === 'directeur'),
        head: () => !!(me() && me().role === 'directeur' && !me().etudes && !me().secretariat),
        fin: () => typeof fin === 'function' ? !!fin() : !!(me() && me().role === 'directeur' && !me().etudes && !me().secretariat),
        money: () => typeof canCollect === 'function' ? !!canCollect() : !!(me() && (me().role === 'directeur' || me().collector)),
        teach: () => !!(me() && (['enseignant', 'percepteur'].includes(me().role) || (me().role === 'directeur' && !me().secretariat))),
        perc: () => !!(me() && me().role === 'percepteur')
    };

    // ---------- Aller à une fonctionnalité ----------
    // fn:nom → appelle la fonction ; menu:x → menuGo(x) ; tab:x → onglet ; cls:Bouton → École puis la classe
    function go(a) {
        if (!a) return;
        const [k, v] = a.split(':');
        close();
        setTimeout(() => {
            try {
                if (k === 'p') { P.tab = v; render(); return; }
                if (k === 'tab') { goTab(v); return; }
                if (k === 'menu') { menuGo(v); return; }
                if (k === 'fn') { if (typeof window[v] === 'function') window[v](); else say('Cette fonction n’est pas disponible pour votre compte.'); return; }
                if (k === 'msg') { if (window.OreaMsg && OreaMsg.open) OreaMsg.open(); else say('Messagerie indisponible.'); return; }
                if (k === 'cls') { goTab('eleves'); say('Touchez une classe, puis « ' + v + ' ».'); return; }
                if (k === 'url') { location.href = v; return; }
            } catch (e) { say('Impossible d’ouvrir cette fonctionnalité ici.'); }
        }, 80);
    }

    // ---------- Contenu ----------
    // t : thème · q : question · w : qui (clé de R) · k : mots clés · s : étapes · a : action « Ouvrir » · n : à savoir
    const ECOLE = [
        // Démarrer
        { t: 'Démarrer', q: 'Par où commencer quand l’école est nouvelle ?', w: 'head', k: 'debut commencer installer configurer premiere fois nouvelle ecole', s: ['Réglages : choisissez le statut de l’école, la ville et les dates des trimestres.', 'Réglages → Frais par trimestre : fixez les frais de chaque classe.', 'École → « + Classe » : créez vos classes.', 'Ouvrez chaque classe → « + Élève » ou « + Liste » pour ajouter les élèves.', 'Menu → Cours des classes : créez les cours et réglez leur maxima.', 'Menu → Équipe & Cours : partagez le code de l’école avec vos enseignants, puis acceptez leurs demandes.'], a: 'tab:reglages' },
        { t: 'Démarrer', q: 'Comment installer ORÉA comme une application ?', w: 'staff', k: 'installer application telephone ecran accueil raccourci android iphone', s: ['Ouvrez Réglages (ou la carte « Installer l’application » sur l’accueil).', 'Touchez « Installer » et suivez le guide adapté à votre téléphone.', 'ORÉA s’ouvre ensuite comme une vraie application, même avec peu de réseau.'], a: 'tab:reglages' },
        { t: 'Démarrer', q: 'Comment utiliser ORÉA sans internet ?', w: 'staff', k: 'hors connexion sans internet reseau offline mode avion', s: ['Ouvrez ORÉA au moins une fois avec internet : les données se copient sur le téléphone.', 'Sans réseau, vous pouvez encaisser et faire l’appel normalement.', 'Dès que le réseau revient, tout est envoyé automatiquement.'], n: 'Le relevé de notes et l’IA demandent internet.' },
        { t: 'Démarrer', q: 'Comment retrouver un élève rapidement ?', w: 'staff', k: 'chercher rechercher trouver eleve nom loupe recherche', s: ['Touchez la loupe 🔍 en haut de l’écran.', 'Tapez une partie du nom de l’élève.', 'Touchez le résultat pour ouvrir sa fiche.'], a: 'fn:openSearch' },

        // Classes et élèves
        { t: 'Classes et élèves', q: 'Comment créer une classe ?', w: 'dirsec', k: 'creer classe ajouter classe nouvelle classe option', s: ['Onglet École.', 'Touchez « + Classe ».', 'Écrivez le nom (ex. : 1re A), le niveau et l’option si c’est le secondaire.', 'Enregistrez.'], a: 'tab:eleves' },
        { t: 'Classes et élèves', q: 'Comment ajouter un élève ?', w: 'dirsec', k: 'ajouter eleve inscrire inscription nouvel eleve', s: ['Onglet École → ouvrez la classe.', 'Touchez « + Élève ».', 'Écrivez le nom, le sexe et le téléphone du parent.', 'Enregistrez.'], a: 'cls:+ Élève' },
        { t: 'Classes et élèves', q: 'Comment ajouter toute une liste d’élèves d’un coup ?', w: 'dirsec', k: 'liste eleves importer coller plusieurs eleves', s: ['Onglet École → ouvrez la classe.', 'Touchez « + Liste ».', 'Collez ou tapez un élève par ligne.', 'Vérifiez l’aperçu, puis enregistrez.'], a: 'cls:+ Liste' },
        { t: 'Classes et élèves', q: 'Comment voir ou modifier la fiche d’un élève ?', w: 'staff', k: 'fiche eleve modifier eleve identite photo dossier', s: ['Onglet École → ouvrez la classe.', 'Touchez le nom de l’élève.', 'Vous voyez ses paiements, ses absences, ses cotes et son code parent.'], a: 'tab:eleves' },
        { t: 'Classes et élèves', q: 'Comment donner son code au parent ?', w: 'dir', k: 'code parent acces parent lier enfant inviter parent', s: ['Ouvrez la fiche de l’élève.', 'Touchez « Code parent ».', 'Envoyez ce code au parent : il l’entre dans l’espace parent, « Ajouter un enfant ».'], n: 'Chaque élève a son propre code de 8 caractères.' },
        { t: 'Classes et élèves', q: 'Comment voir les élèves à suivre ?', w: 'dir', k: 'eleves a suivre risque difficulte alerte decrochage', s: ['Menu → Élèves à suivre.', 'ORÉA regroupe les élèves qui cumulent absences, mauvaises cotes, impayés ou signalements.', 'Vous pouvez prévenir le parent depuis la liste.'], a: 'fn:oreaRisk' },
        { t: 'Classes et élèves', q: 'Comment traiter les pré-inscriptions des parents ?', w: 'dir', k: 'pre inscription preinscription nouveaux eleves en ligne', s: ['Menu → Pré-inscriptions.', 'Ouvrez une demande.', 'Acceptez-la pour créer l’élève dans la bonne classe, ou refusez-la.'], a: 'fn:oreaPreins' },

        // Frais
        { t: 'Frais et caisse', q: 'Comment fixer les frais scolaires ?', w: 'head', k: 'frais scolaires minerval tarif montant trimestre prix', s: ['Réglages → Frais par trimestre.', 'Touchez une classe.', 'Écrivez les montants de T1, T2 et T3.', 'Pour l’inscription, l’uniforme, etc. : Réglages → Autres frais.'], a: 'tab:reglages' },
        { t: 'Frais et caisse', q: 'Comment encaisser un paiement ?', w: 'money', k: 'encaisser payer paiement recu argent caisse percevoir', s: ['Onglet École → ouvrez la classe.', 'Touchez « Encaisser ».', 'Choisissez l’élève, écrivez le montant et la devise.', 'Validez : le reçu est prêt à envoyer par WhatsApp ou à imprimer.'], a: 'cls:Encaisser', n: 'Sans réseau, le paiement est gardé sur le téléphone et envoyé plus tard.' },
        { t: 'Frais et caisse', q: 'Comment faire la clôture de caisse ?', w: 'money', k: 'cloture caisse fin de journee compter argent', s: ['Menu → Caisse.', 'Vérifiez les encaissements du jour.', 'Touchez « Clôturer » et comptez l’argent remis.'], a: 'menu:caisse' },
        { t: 'Frais et caisse', q: 'Comment voir les impayés et relancer les parents ?', w: 'fin', k: 'impayes dettes retard relance rappel paiement parents', s: ['Menu → Finance → Impayés.', 'Filtrez par classe.', 'Touchez « Relancer » : le message WhatsApp est prêt avec le montant restant.'], a: 'menu:impayes' },
        { t: 'Frais et caisse', q: 'Comment enregistrer une dépense ?', w: 'fin', k: 'depense sortie argent achat facture', s: ['Menu → Finance → Dépenses.', 'Ajoutez la dépense : motif, montant et date.'], a: 'menu:depenses' },
        { t: 'Frais et caisse', q: 'Comment voir le bilan du mois ?', w: 'fin', k: 'bilan mensuel rapport recettes depenses resultat mois', s: ['Menu → Finance → Bilan mensuel.', 'Choisissez le mois.', 'Pour un document à envoyer : Menu → Données → Rapport mensuel.'], a: 'menu:bilan' },
        { t: 'Frais et caisse', q: 'Comment voir ce que j’ai encaissé (percepteur) ?', w: 'perc', k: 'ma perception percepteur mes encaissements', s: ['Menu → Ma perception.', 'Vous voyez vos encaissements par jour et par classe.'], a: 'menu:perception' },
        { t: 'Frais et caisse', q: 'Comment changer le taux du dollar ?', w: 'head', k: 'taux change dollar usd devise franc', s: ['Réglages → Taux de change.', 'Écrivez la valeur d’un dollar en francs congolais.', 'Enregistrez.'], a: 'tab:reglages' },

        // Présences et discipline
        { t: 'Présences et discipline', q: 'Comment faire l’appel ?', w: 'staff', k: 'appel presence absent present retard absences', s: ['Onglet École → ouvrez la classe.', 'Touchez « Présence ».', 'Touchez chaque élève absent ou en retard.', 'Enregistrez : les parents concernés peuvent être prévenus.'], a: 'cls:Présence' },
        { t: 'Présences et discipline', q: 'Comment suivre les absences ?', w: 'dir', k: 'suivi absences absenteisme justificatif', s: ['Menu → Suivi des absences.', 'Vous voyez les élèves les plus absents.', 'Les justificatifs envoyés par les parents sont dans Menu → Justificatifs d’absence.'], a: 'menu:absences' },
        { t: 'Présences et discipline', q: 'Comment sanctionner un élève ?', w: 'staff', k: 'sanction punir avertissement discipline renvoi blame comportement', s: ['Menu → Sanctions (ou dans la classe, « Sanctions »).', 'Choisissez l’élève et le type (avertissement, sanction…).', 'Écrivez le motif et enregistrez : le parent le voit dans son espace.'], a: 'menu:sanctions' },
        { t: 'Présences et discipline', q: 'Comment scanner une carte d’élève ?', w: 'staff', k: 'scanner carte qr code entree sortie gardien badge', s: ['Menu → Scanner une carte.', 'Visez le code QR de la carte avec la caméra.', 'Choisissez entrée, sortie ou paiement.'], a: 'menu:scan_qr' },
        { t: 'Présences et discipline', q: 'Comment pointer mon arrivée et mon départ ?', w: 'staff', k: 'pointage arrivee depart personnel heure presence equipe', s: ['Menu → Pointage.', 'Touchez « Arrivée » le matin et « Départ » le soir.', 'La direction voit les arrivées et départs de toute l’équipe.'], a: 'fn:pointage' },

        // Cours et notes
        { t: 'Cours et notes', q: 'Comment créer les cours d’une classe ?', w: 'dir', k: 'cours branches matieres creer cours ajouter cours', s: ['Menu → Cours des classes.', 'Touchez la classe.', 'Écrivez le nom du cours → « Ajouter », puis cochez-le.', 'Réglez son maxima par période et « Avec examen ».'], a: 'fn:oreaCoursClasses', n: 'Le maxima vaut pour toutes les classes du même niveau et de la même option.' },
        { t: 'Cours et notes', q: 'Comment régler le maxima d’un cours ?', w: 'dir', k: 'maxima ponderation points cours examen sans examen groupe', s: ['Menu → Cours des classes → la classe.', 'Sous le cours coché, choisissez le maxima (10 à 100).', 'Décochez « Avec examen » pour un cours sans examen.', 'Au primaire, écrivez aussi le groupe (Français, Mathématiques…).'], a: 'fn:oreaCoursClasses' },
        { t: 'Cours et notes', q: 'Comment attribuer des cours à un enseignant ?', w: 'dir', k: 'attribuer cours enseignant professeur affecter', s: ['Menu → Équipe & Cours.', 'Sur la fiche de l’enseignant, touchez « Gérer les cours ».', 'Choisissez la classe et cochez ses cours.'], a: 'fn:team' },
        { t: 'Cours et notes', q: 'Comment faire la cotation ?', w: 'teach', k: 'cotation cotes notes points interrogation devoir examen saisir', s: ['Onglet École → ouvrez la classe → « Cotation ».', 'Choisissez le semestre (secondaire) ou le trimestre (primaire).', 'Touchez « + Nouvelle évaluation » : cours, type, période (P1, P2…), base.', 'Tapez les points de chaque élève, puis « Enregistrer ».'], a: 'cls:Cotation', n: 'Une période additionne tous les devoirs et interrogations, puis les ramène au maxima du cours.' },
        { t: 'Cours et notes', q: 'La direction peut-elle corriger une cote ?', w: 'dir', k: 'corriger cote modifier note erreur validation en attente', s: ['Ouvrez l’évaluation dans la Cotation et changez la cote.', 'La cote passe « en attente » et l’enseignant est prévenu.', 'Elle devient valide quand l’enseignant la confirme.'], n: 'Les parents ne voient que les cotes validées.' },
        { t: 'Cours et notes', q: 'Comment voir le relevé de notes (bulletin) ?', w: 'teach', k: 'releve notes bulletin resultats moyenne pourcentage place classement', s: ['Menu → Relevés de notes → choisissez la classe.', 'Choisissez l’élève.', 'Téléchargez le PDF de l’élève ou de toute la classe.'], a: 'fn:oreaRelevesMenu', n: 'C’est un document interne : il ne remplace pas le bulletin officiel.' },
        { t: 'Cours et notes', q: 'Comment voir un exemple de relevé sans cotes ?', w: 'dir', k: 'apercu exemple releve demonstration bulletin modele', s: ['Menu → Relevés de notes.', 'Touchez « Aperçu avec un exemple ».', 'Changez entre Secondaire et Primaire.'], a: 'fn:oreaReleveDemo' },
        { t: 'Cours et notes', q: 'Comment saisir l’application et la conduite ?', w: 'teach', k: 'application conduite comportement tb b ab m mv', s: ['Menu → Relevés de notes → la classe.', 'Touchez « Application et conduite ».', 'Choisissez la période, puis TB, B, AB, M ou Mv pour chaque élève.'], n: 'Réservé à la direction et au titulaire de la classe.' },
        { t: 'Cours et notes', q: 'Comment désigner le titulaire d’une classe ?', w: 'dir', k: 'titulaire classe responsable enseignant principal', s: ['Menu → Équipe & Cours.', 'Sur la fiche de l’enseignant, touchez « Titulaire de… ».', 'Cochez sa classe.'], a: 'fn:team' },
        { t: 'Cours et notes', q: 'Comment publier le relevé aux parents ?', w: 'dir', k: 'publier releve parents montrer bulletin visible', s: ['Menu → Relevés de notes → la classe.', 'Touchez « Publication aux parents ».', 'Choisissez jusqu’où les parents peuvent voir (P1, P2, examen…).'] },
        { t: 'Cours et notes', q: 'Comment noter les décisions de fin d’année ?', w: 'dir', k: 'decision passe double repechage deliberation fin annee enafep examen etat mec', s: ['Menu → Relevés de notes → la classe.', 'Touchez « Décisions de fin d’année ».', 'ORÉA propose passe ou double selon le pourcentage ; confirmez élève par élève.', 'En 6e primaire : ENAFEP. En 4e des humanités : examen d’État (MEC, points).'] },
        { t: 'Cours et notes', q: 'Comment remplir le cahier de textes et donner des devoirs ?', w: 'teach', k: 'cahier de textes seance devoir lecon donnee travail maison', s: ['Menu → Cahier de textes.', 'Ajoutez la séance du jour ou un devoir avec sa date de remise.', 'Les parents voient les devoirs dans leur onglet Scolarité.'], a: 'menu:cahier' },
        { t: 'Cours et notes', q: 'Comment faire l’emploi du temps ?', w: 'dir', k: 'emploi du temps horaire grille heures', s: ['Menu → Programme → Emploi du temps.', 'Choisissez la classe et remplissez chaque jour.'], a: 'menu:emploi_temps' },
        { t: 'Cours et notes', q: 'Comment ajouter un événement au calendrier ?', w: 'dir', k: 'calendrier evenement conge vacances reunion date', s: ['Menu → Programme → Calendrier scolaire.', 'Ajoutez l’événement avec sa date.', 'Les parents le voient dans leur Agenda.'], a: 'menu:calendrier' },
        { t: 'Cours et notes', q: 'Comment suivre l’ENAFEP ?', w: 'dir', k: 'enafep finalistes epreuves blanches 6e primaire', s: ['Menu → ENAFEP.', 'Suivez les finalistes, les épreuves blanches et les résultats.'], a: 'menu:enafep' },

        // IA
        { t: 'Intelligence artificielle', q: 'Comment préparer une leçon avec l’IA ?', w: 'teach', k: 'ia intelligence artificielle preparer lecon fiche preparation', s: ['Onglet École → ouvrez la classe.', 'Touchez « Préparer une leçon ».', 'Choisissez le cours, écrivez le titre et la durée.', 'Relisez la fiche, corrigez-la si besoin, puis téléchargez-la en PDF.'], a: 'cls:Préparer une leçon', n: 'Un enseignant ne prépare que les cours qui lui sont attribués. 20 fiches par mois.' },
        { t: 'Intelligence artificielle', q: 'Comment préparer une interrogation avec corrigé ?', w: 'teach', k: 'ia interrogation interro corrige bareme questions evaluation', s: ['Onglet École → ouvrez la classe.', 'Touchez « Préparer une interrogation ».', 'Choisissez le cours, la matière vue, le nombre de questions et le total des points.', 'ORÉA prépare les questions, le corrigé et le barème, puis vérifie le corrigé.', 'Touchez « PDF pour les élèves » pour une version sans corrigé.'], a: 'cls:Préparer une interrogation' },
        { t: 'Intelligence artificielle', q: 'Où retrouver mes fiches IA ?', w: 'teach', k: 'mes fiches ia retrouver anciennes fiches lecons', s: ['Ouvrez la classe → « Préparer une leçon ».', 'Touchez « Mes fiches de cette classe ».'], a: 'cls:Préparer une leçon' },
        { t: 'Intelligence artificielle', q: 'Les boutons IA n’apparaissent pas : pourquoi ?', w: 'staff', k: 'ia absente bouton disparu ia desactivee indisponible', s: ['L’IA doit être activée pour votre école par ORÉA.', 'Un enseignant doit avoir des cours attribués dans la classe.', 'Fermez puis rouvrez l’application.'] },

        // Communication
        { t: 'Communication', q: 'Comment écrire à un parent ?', w: 'staff', k: 'message parent ecrire whatsapp discuter communiquer', s: ['Touchez Messages (dans le Menu).', 'Choisissez l’élève : la conversation avec son parent s’ouvre.', 'Écrivez votre message.'], a: 'msg:' },
        { t: 'Communication', q: 'Comment parler avec l’équipe (salle des profs) ?', w: 'staff', k: 'salle des profs equipe collegues enseignants discussion groupe message prive', s: ['Ouvrez Messages.', 'Choisissez « Salle des profs » pour toute l’équipe, ou une personne pour une conversation privée.'], a: 'msg:' },
        { t: 'Communication', q: 'Comment répondre aux messages des parents ?', w: 'dirsec', k: 'messages des parents boite reception repondre', s: ['Menu → Messages des parents.', 'Ouvrez une conversation et répondez.'], a: 'fn:pAdminInbox' },
        { t: 'Communication', q: 'Comment envoyer une annonce à tous les parents ?', w: 'dirsec', k: 'annonce communique information tous les parents reunion', s: ['Menu → Annonces.', 'Écrivez le titre et le message, choisissez les classes concernées.', 'Publiez : les parents la reçoivent dans leur espace.'], a: 'fn:pAdminAnnonce' },
        { t: 'Communication', q: 'Comment envoyer des SMS aux parents ?', w: 'dirsec', k: 'sms texto telephone parents groupe envoyer', s: ['Menu → SMS aux parents.', 'Choisissez la classe et écrivez le message.', 'Envoyez par lots de 10 numéros depuis votre téléphone.'], a: 'fn:oreaSmsGroup' },
        { t: 'Communication', q: 'Comment changer les modèles de messages WhatsApp ?', w: 'head', k: 'modeles messages whatsapp relance texte personnaliser', s: ['Réglages → Modèles de messages.', 'Modifiez le texte ; {eleve}, {classe}, {reste} et {ecole} sont remplacés automatiquement.'], a: 'tab:reglages' },

        // Équipe
        { t: 'Équipe', q: 'Comment faire rejoindre un enseignant ?', w: 'dirsec', k: 'rejoindre enseignant code invitation inviter personnel nouveau compte', s: ['Menu → Équipe & Cours : donnez le code d’invitation à l’enseignant.', 'Il crée son compte et entre ce code.', 'Sa demande apparaît dans « Demandes en attente » : touchez « Accepter ».', 'Attribuez-lui ensuite ses cours.'], a: 'fn:team', n: 'Seul le chef d’établissement peut accepter ou refuser une demande.' },
        { t: 'Équipe', q: 'Comment changer le code de l’école ?', w: 'head', k: 'changer code ecole invitation securite nouveau code', s: ['Menu → Équipe & Cours.', 'Touchez « Changer le code » sous le code d’invitation.', 'L’ancien code ne marche plus ; les comptes déjà acceptés ne changent pas.'], a: 'fn:team' },
        { t: 'Équipe', q: 'Comment nommer un percepteur ou un directeur des études ?', w: 'head', k: 'nommer percepteur directeur des etudes secretariat role fonction', s: ['Menu → Équipe & Cours.', 'Sur la fiche de la personne, choisissez la fonction à lui donner.'], a: 'fn:team' },
        { t: 'Équipe', q: 'Comment gérer les dossiers et la paie du personnel ?', w: 'head', k: 'dossier personnel paie salaire avance fiche de paie', s: ['Menu → Équipe & Cours → onglet Dossiers.', 'Ouvrez un dossier pour la paie et les avances.'], a: 'fn:team' },

        // Réglages et données
        { t: 'Réglages et données', q: 'Comment passer à une nouvelle année scolaire ?', w: 'head', k: 'annee scolaire nouvelle annee passage classes rentree', s: ['Menu → Années scolaires.', 'Suivez les étapes : nouvelle année, passage des élèves dans la classe supérieure.'], a: 'fn:yearMenu' },
        { t: 'Réglages et données', q: 'Comment régler les dates des trimestres ?', w: 'head', k: 'dates trimestres periode calendrier retard', s: ['Réglages → Dates des trimestres.', 'Écrivez le début et la fin de chaque trimestre.'], a: 'tab:reglages', n: 'Sans ces dates, le statut « en retard » des paiements est désactivé.' },
        { t: 'Réglages et données', q: 'Comment exporter ou sauvegarder les données ?', w: 'fin', k: 'exporter sauvegarde donnees excel csv pdf copie backup', s: ['Menu → Données.', 'Exporter : élèves, paiements, caisse (CSV, PDF ou image).', 'Sauvegarde complète : gardez une copie de toutes les données.'], a: 'menu:donnees_home' },
        { t: 'Réglages et données', q: 'Comment voir les statistiques de l’école ?', w: 'dir', k: 'statistiques effectifs graphique resultats chiffres', s: ['Menu → Statistiques.', 'Effectifs, présences, résultats et ENAFEP.'], a: 'menu:stats' },
        { t: 'Réglages et données', q: 'Comment renouveler l’abonnement ?', w: 'head', k: 'abonnement payer orea renouveler expire lecture seule', s: ['Réglages → Mon abonnement : vous voyez la date de fin.', 'Contactez ORÉA Assistance pour renouveler.', 'Après l’expiration, l’école passe en lecture seule (l’encaissement reste possible).'], a: 'tab:reglages' },
        { t: 'Réglages et données', q: 'Comment suivre mes propres enfants ?', w: 'staff', k: 'mon espace parent mes enfants personnel parent', s: ['Menu → Mon espace parent.', 'Touchez « Ajouter un enfant » et entrez son code parent.'], a: 'url:parent.html' },
        { t: 'Réglages et données', q: 'Comment jouer à Génie en Herbe ?', w: 'staff', k: 'genie en herbe quiz jeu questions culture', s: ['Menu → Génie en Herbe.', 'Choisissez le mode et lancez la partie.'], a: 'fn:openQuiz' },
        { t: 'Réglages et données', q: 'Comment obtenir de l’aide ?', w: 'all', k: 'aide assistance contact support probleme orea whatsapp', s: ['ORÉA Assistance : +243 825 556 492.', 'E-mail : kisengeh@gmail.com.', 'Dans Messages, vous pouvez aussi écrire à ORÉA.'] }
    ];

    const PAR = [
        { t: 'Mes enfants', q: 'Comment ajouter mon enfant ?', w: 'all', k: 'ajouter enfant code parent lier inscrire', s: ['Onglet Enfants.', 'Touchez « + Ajouter un autre enfant ».', 'Entrez le code de 8 caractères donné par l’école.'], a: 'p:enfants' },
        { t: 'Mes enfants', q: 'Comment voir les paiements de mon enfant ?', w: 'all', k: 'paiement frais reste payer recu a jour impaye', s: ['Onglet Enfants → touchez le nom de l’enfant.', 'Vous voyez ce qui est payé, le reste à payer et les reçus.'], a: 'p:enfants' },
        { t: 'Mes enfants', q: 'Comment voir les absences et les sanctions ?', w: 'all', k: 'absences sanctions retard discipline comportement', s: ['Onglet Enfants → touchez le nom de l’enfant.', 'Descendez jusqu’aux absences et aux sanctions.'], a: 'p:enfants' },
        { t: 'Notes', q: 'Comment voir les notes de mon enfant ?', w: 'all', k: 'notes cotes points resultats interrogation', s: ['Onglet Notes.', 'Choisissez l’enfant, puis le trimestre.'], a: 'p:notes' },
        { t: 'Notes', q: 'Comment voir le relevé de notes (bulletin) ?', w: 'all', k: 'releve bulletin pourcentage place resultats pdf', s: ['Onglet Notes → choisissez l’enfant.', 'Touchez « Relevé de notes ».', 'Vous pouvez le télécharger en PDF.'], a: 'p:notes', n: 'Le relevé apparaît quand l’école l’a publié. Il ne remplace pas le bulletin officiel.' },
        { t: 'Scolarité', q: 'Comment voir les devoirs et l’horaire ?', w: 'all', k: 'devoirs horaire emploi du temps cahier de textes lecons', s: ['Onglet Scolarité.', 'Vous voyez les devoirs, le cahier de textes et l’horaire de la classe.'], a: 'p:scolarite' },
        { t: 'Scolarité', q: 'Comment voir le calendrier de l’école ?', w: 'all', k: 'agenda calendrier vacances conge reunion evenement', s: ['Onglet Agenda.'], a: 'p:calendrier' },
        { t: 'Communication', q: 'Comment écrire à l’école ?', w: 'all', k: 'message ecrire ecole enseignant direction contacter', s: ['Onglet Messages.', 'Choisissez l’enfant, puis écrivez votre message.'], a: 'p:messages' },
        { t: 'Communication', q: 'Comment justifier une absence ?', w: 'all', k: 'justifier absence justificatif malade certificat', s: ['Onglet Enfants → touchez le nom de l’enfant.', 'Touchez « Envoyer un justificatif » et expliquez l’absence.'], a: 'p:enfants' },
        { t: 'Communication', q: 'Où voir les annonces de l’école ?', w: 'all', k: 'annonces communique information notifications cloche', s: ['Touchez la cloche 🔔 en haut de l’écran.', 'Les annonces apparaissent aussi dans l’onglet École.'], a: 'p:ecole' },
        { t: 'Autres', q: 'Comment installer l’application Parents ?', w: 'all', k: 'installer application telephone ecran accueil', s: ['Onglet Enfants → carte « Application ORÉA Parents ».', 'Touchez « Installer l’application ».'], a: 'p:enfants' },
        { t: 'Autres', q: 'Comment jouer à Génie en Herbe ?', w: 'all', k: 'genie en herbe quiz jeu', s: ['Onglet École → Génie en Herbe.'], a: 'p:ecole' },
        { t: 'Autres', q: 'Comment obtenir de l’aide ?', w: 'all', k: 'aide assistance contact support', s: ['ORÉA Assistance : +243 825 556 492.', 'E-mail : kisengeh@gmail.com.'] }
    ];

    // Mots proches : la recherche les traite comme équivalents
    const SYN = [['bulletin', 'releve', 'notes', 'cotes', 'resultats'], ['note', 'cote', 'cotation', 'points'], ['payer', 'paiement', 'encaisser', 'frais', 'minerval', 'argent'], ['professeur', 'prof', 'enseignant', 'maitre', 'instituteur'], ['punir', 'sanction', 'discipline', 'avertissement'], ['absence', 'absent', 'appel', 'presence'], ['message', 'ecrire', 'whatsapp', 'communiquer', 'parler'], ['ia', 'intelligence', 'artificielle', 'robot'], ['interro', 'interrogation', 'evaluation', 'test', 'controle'], ['eleve', 'enfant', 'apprenant'], ['horaire', 'emploi'], ['code', 'invitation']];
    const expand = w => { const g = SYN.find(x => x.some(y => w.startsWith(y) || y.startsWith(w))); return g ? g : [w]; };

    const list = () => (PARENT ? PAR : ECOLE).filter(x => (R[x.w] || R.all)());
    // Score : le mot dans la question ou les mots clés compte plus qu'un mot proche ou qu'un mot dans les étapes
    function score(x, words) {
        const top = N(x.q + ' ' + x.k), low = N(x.t + ' ' + x.s.join(' '));
        let t = 0;
        for (const w of words) {
            const syn = expand(w).filter(y => y !== w);
            const v = top.includes(w) ? 10 : syn.some(y => top.includes(y)) ? 5 : low.includes(w) ? 2 : syn.some(y => low.includes(y)) ? 1 : 0;
            if (!v) return 0;
            t += v;
        }
        return t;
    }

    // ---------- Fenêtre ----------
    let dlg = null, G = { q: '', th: '', open: -1 };
    function close() { if (dlg && dlg.open) dlg.close(); }
    function css() {
        if (document.getElementById('gd-css')) return;
        const st = document.createElement('style'); st.id = 'gd-css';
        st.textContent = '#gdlg{width:min(680px,94vw);max-height:90vh;padding:20px 18px;border-radius:18px;border:1px solid var(--line,#3a3a33);background:var(--card,var(--bg,#1d1d19));color:var(--tx,inherit)}'
            + '#gdlg::backdrop{background:rgba(0,0,0,.55)}#gdlg h3{margin:0 0 4px;font-family:var(--serif,serif);color:var(--gold,#c7a34b)}'
            + '.gd-s{width:100%;box-sizing:border-box;margin:10px 0 8px;min-height:44px;padding:10px 12px;font-size:15px;border-radius:12px}'
            + '.gd-th{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px}.gd-th button{flex:none;width:auto;margin:0;min-height:32px;padding:4px 12px;border-radius:999px;font-size:12.5px}'
            + '.gd-l{max-height:58vh;overflow-y:auto}.gd-t{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold,#c7a34b);font-weight:700;margin:12px 2px 6px}'
            + '.gd-i{border:1px solid var(--line,#3a3a33);border-radius:12px;margin:6px 0;overflow:hidden}.gd-q{all:unset;box-sizing:border-box;display:flex;justify-content:space-between;gap:10px;width:100%;padding:12px 14px;cursor:pointer;font-weight:600;font-size:14.5px}'
            + '.gd-q:after{content:"›";color:var(--mut,#999);transition:transform .15s}.gd-i.on .gd-q:after{transform:rotate(90deg)}'
            + '.gd-b{display:none;padding:0 14px 12px}.gd-i.on .gd-b{display:block}.gd-b ol{margin:0 0 8px;padding-left:20px;font-size:14px;line-height:1.5}.gd-b li{margin:3px 0}'
            + '.gd-n{font-size:12.5px;color:var(--mut,#999);margin:4px 0 8px}.gd-go{width:auto!important;margin:4px 0 0!important;min-height:38px;padding:6px 16px}'
            + '.gd-e{text-align:center;color:var(--mut,#999);padding:24px 8px;font-size:14px}.gd-x{margin-top:10px;width:100%}';
        document.head.appendChild(st);
    }
    function ensure() {
        css();
        if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'gdlg'; document.body.appendChild(dlg); }
        return dlg;
    }
    function draw() {
        const L = list(), words = N(G.q).split(/\s+/).filter(w => w.length > 1);
        const themes = [...new Set(L.map(x => x.t))];
        let F = L.filter(x => !G.th || x.t === G.th);
        if (words.length) {
            const sc = F.map(x => [x, score(x, words)]).filter(z => z[1] > 0);
            const best = Math.max(0, ...sc.map(z => z[1]));
            F = sc.filter(z => z[1] >= Math.min(best, words.length * 5) || z[1] >= best / 2).sort((a, b) => b[1] - a[1]).map(z => z[0]);
        }
        let h = '', cur = '';
        F.forEach(x => {
            const i = L.indexOf(x);
            if (!words.length && x.t !== cur) { cur = x.t; h += `<div class=gd-t>${E(cur)}</div>`; }
            h += `<div class="gd-i${G.open === i ? ' on' : ''}" data-i=${i}><button type=button class=gd-q>${E(x.q)}</button><div class=gd-b><ol>${x.s.map(s => `<li>${E(s)}</li>`).join('')}</ol>${x.n ? `<div class=gd-n>À savoir : ${E(x.n)}</div>` : ''}${x.a ? `<button type=button class=gd-go data-a="${E(x.a)}">Ouvrir</button>` : ''}</div></div>`;
        });
        const box = dlg.querySelector('.gd-l'), ths = dlg.querySelector('.gd-th');
        box.innerHTML = h || `<div class=gd-e>Aucun résultat pour « ${E(G.q)} ». Essayez un autre mot (ex. : bulletin, frais, appel).</div>`;
        ths.innerHTML = [''].concat(themes).map(t => `<button type=button class="chip${G.th === t ? ' on' : ''}" data-th="${E(t)}">${t ? E(t) : 'Tout'}</button>`).join('');
        ths.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { G.th = b.dataset.th; G.open = -1; draw(); });
        box.querySelectorAll('.gd-q').forEach(b => b.onclick = () => { const i = +b.parentNode.dataset.i; G.open = G.open === i ? -1 : i; draw(); const el = box.querySelector(`[data-i="${i}"]`); if (el && G.open === i) el.scrollIntoView({ block: 'nearest' }); });
        box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => go(b.dataset.a));
    }
    function openGuide(q) {
        const d = ensure();
        G = { q: q || '', th: '', open: -1 };
        d.innerHTML = `<h3>Comment utiliser ORÉA ?</h3><small style="color:var(--mut,#999)">${PARENT ? 'Le guide de l’espace parent.' : 'Le guide complet, adapté à votre rôle.'} Touchez une question pour voir les étapes.</small>
            <input type=search class=gd-s placeholder="🔍 Rechercher (ex. : bulletin, frais, sanction)" autocomplete=off value="${E(G.q)}">
            <div class=gd-th></div><div class=gd-l></div><button type=button class="ghost gd-x">Fermer</button>`;
        const inp = d.querySelector('.gd-s');
        inp.oninput = () => { G.q = inp.value; G.open = -1; draw(); };
        d.querySelector('.gd-x').onclick = close;
        draw();
        if (!d.open) d.showModal();
        if (!q) setTimeout(() => { try { if (matchMedia('(min-width:1024px)').matches) inp.focus(); } catch (_) { } }, 50);
    }
    window.oreaGuide = openGuide;

    // ---------- Points d'entrée ----------
    // Points d'entrée : bouton sur l'accueil (app.js et parent.js) et carte dans le Menu (app.js)
})();
