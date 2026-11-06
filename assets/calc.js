/**
 * Logique de calcul du Calculateur SPRINT & GMT.
 *
 * Fonctions PURES : aucune ne lit le DOM ni n'écrit dedans. C'est ce qui rend
 * les tests possibles sans toucher aux champs de l'opérateur.
 *
 * Conventions communes :
 *  - « att » = valeur attendue, « mes » = valeur mesurée, en millimètres.
 *  - Un écart positif signifie « trop long », négatif « trop court ».
 *  - Les sorties IHM sont arrondies au pas réellement saisissable sur machine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NSTCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===== Paramètres métier =====
  const PARAMS = {
    TOLERANCE: 0.5,          // mm — en deçà, la pose est conforme
    SPRINT: {
      IHM_PAR_MM_CENTRAGE: 0.2,   // 1 mm de décalage = 0,2 unité IHM
      IHM_PAR_MM_LONGUEUR: 1.5,   // 1 mm de longueur  = 1,5 unité IHM
      PAS_CENTRAGE: 0.1,
      PAS_LONGUEUR: 0.25
    },
    GMT: {
      MM_PAR_DENT: 2.78,          // mm ajoutés au total par dent complète
      IHM_PAR_MM_CENTRAGE: 5,     // 1 mm vers A = +5 unités IHM
      PAS_CENTRAGE: 1
    }
  };

  // ===== Utilitaires =====

  /** Arrondit au pas machine le plus proche. */
  function snap(valeur, pas) {
    return Math.round(valeur / pas) * pas;
  }

  /**
   * Convertit une saisie en nombre, ou renvoie null si elle est inexploitable.
   *
   * Number('') vaut 0 et non NaN : sans ce garde-fou, un champ vidé pour être
   * ressaisi ferait calculer un ajustement sur une mesure de 0 mm, affiché avec
   * le même aplomb qu'un résultat valide.
   */
  function versNombre(saisie) {
    if (saisie === null || saisie === undefined) return null;
    const texte = String(saisie).trim().replace(',', '.');
    if (texte === '') return null;
    const n = Number(texte);
    return Number.isFinite(n) ? n : null;
  }

  /** Vrai si les deux écarts tiennent dans la tolérance. */
  function estConforme(ecartA, ecartB, tolerance) {
    const tol = tolerance === undefined ? PARAMS.TOLERANCE : tolerance;
    return Math.abs(ecartA) <= tol && Math.abs(ecartB) <= tol;
  }

  // ===== SPRINT : centrage, puis longueur de fil =====

  /**
   * @param {{attA:number, attB:number, mesA:number, mesB:number, mode:'NST1'|'NST2'}} e
   * @returns {object} résultat, incluant `conforme`, `centrage`, `longueur` et le journal.
   *
   * En NST1, A porte le Frein et B la Coupe ; en NST2 les rôles sont inversés.
   * Le centrage se déduit de l'écart côté Coupe, la longueur de fil se calcule
   * ensuite sur le côté Frein une fois le centrage appliqué.
   */
  function calculerSprint(e) {
    const P = PARAMS.SPRINT;
    const tol = PARAMS.TOLERANCE;
    const nst1 = e.mode !== 'NST2';

    const ecartA = e.mesA - e.attA;
    const ecartB = e.mesB - e.attB;

    const base = {
      mode: nst1 ? 'NST1' : 'NST2',
      ecartA: ecartA,
      ecartB: ecartB,
      tolerance: tol
    };

    if (estConforme(ecartA, ecartB, tol)) {
      return Object.assign(base, {
        conforme: true,
        centrage: 0,
        longueur: 0,
        prevuA: e.mesA,
        prevuB: e.mesB,
        journal: [
          'Pose conforme (mode ' + base.mode + ') — aucun ajustement.',
          'Ecart A = ' + ecartA.toFixed(2) + ' mm, ecart B = ' + ecartB.toFixed(2) +
            ' mm, tolerance ' + String(tol) + ' mm.'
        ]
      });
    }

    const coupeAtt = nst1 ? e.attB : e.attA;
    const coupeMes = nst1 ? e.mesB : e.mesA;
    const freinAtt = nst1 ? e.attA : e.attB;

    // 1) Centrage, d'après l'écart côté Coupe. Positif = ramener vers Frein.
    const centrageBrut = (coupeMes - coupeAtt) * P.IHM_PAR_MM_CENTRAGE;
    const centrage = snap(centrageBrut, P.PAS_CENTRAGE);
    const deltaCentrage = centrage / P.IHM_PAR_MM_CENTRAGE; // en mm

    // Le centrage déplace la matière : un côté gagne ce que l'autre perd.
    const apresCentrageA = nst1 ? e.mesA + deltaCentrage : e.mesA - deltaCentrage;
    const apresCentrageB = nst1 ? e.mesB - deltaCentrage : e.mesB + deltaCentrage;

    // 2) Longueur de fil, mesurée sur le Frein après centrage.
    const freinApres = nst1 ? apresCentrageA : apresCentrageB;
    const longueurBrute = (freinAtt - freinApres) * P.IHM_PAR_MM_LONGUEUR;
    const longueur = snap(longueurBrute, P.PAS_LONGUEUR);
    const deltaLongueur = longueur / P.IHM_PAR_MM_LONGUEUR; // en mm

    const prevuA = nst1 ? apresCentrageA + deltaLongueur : apresCentrageA;
    const prevuB = nst1 ? apresCentrageB : apresCentrageB + deltaLongueur;

    return Object.assign(base, {
      conforme: false,
      centrage: centrage,
      longueur: longueur,
      prevuA: prevuA,
      prevuB: prevuB,
      journal: [
        'Mode ' + base.mode + ' — correction requise.',
        'Centrage : brut ' + centrageBrut.toFixed(3) + ' => IHM ' + centrage.toFixed(1) +
          ' (effet ' + deltaCentrage.toFixed(2) + ' mm)',
        'Apres centrage : A = ' + apresCentrageA.toFixed(2) + ', B = ' + apresCentrageB.toFixed(2),
        'Longueur fil : brut ' + longueurBrute.toFixed(3) + ' => IHM ' + longueur.toFixed(2) +
          ' (effet ' + deltaLongueur.toFixed(2) + ' mm sur le Frein)',
        'Prevision finale : A = ' + prevuA.toFixed(2) + ', B = ' + prevuB.toFixed(2) +
          ' (tolerance ' + String(tol) + ' mm)'
      ]
    });
  }

  // ===== GMT : mise en angle, puis centrage =====

  /**
   * @param {{attA:number, attB:number, mesA:number, mesB:number}} e
   * @returns {object} résultat, incluant `conforme`, `demiDents`, `centrage` et le journal.
   *
   * La mise en angle corrige la longueur totale (elle agit symétriquement sur
   * les deux côtés) ; le centrage répartit ensuite sans toucher à cette somme.
   */
  function calculerGmt(e) {
    const P = PARAMS.GMT;
    const tol = PARAMS.TOLERANCE;
    const demiDent = P.MM_PAR_DENT / 2;

    const ecartA = e.mesA - e.attA;
    const ecartB = e.mesB - e.attB;

    const base = {
      ecartA: ecartA,
      ecartB: ecartB,
      tolerance: tol
    };

    // Court-circuit en tolérance : sans lui, l'appli affichait « Déjà conforme »
    // tout en réclamant une demi-dent juste en dessous.
    if (estConforme(ecartA, ecartB, tol)) {
      return Object.assign(base, {
        conforme: true,
        demiDents: 0,
        mmTotal: 0,
        mmParCote: 0,
        centrage: 0,
        prevuA: e.mesA,
        prevuB: e.mesB,
        journal: [
          'Pose conforme — aucun ajustement.',
          'Ecart A = ' + ecartA.toFixed(2) + ' mm, ecart B = ' + ecartB.toFixed(2) +
            ' mm, tolerance ' + String(tol) + ' mm.'
        ]
      });
    }

    // 1) Mise en angle : corrige la somme, par pas d'une demi-dent.
    const sommeAtt = e.attA + e.attB;
    const sommeMes = e.mesA + e.mesB;
    const besoinTotal = sommeAtt - sommeMes;
    const demiDents = Math.round(besoinTotal / demiDent);
    const mmTotal = demiDents * demiDent;
    const mmParCote = mmTotal / 2;

    const apresAngleA = e.mesA + mmParCote;
    const apresAngleB = e.mesB + mmParCote;

    // 2) Centrage : déplace de A vers B sans changer la somme.
    //
    // Il se déduit du DESEQUILIBRE entre les côtés, pas du résidu du seul côté A.
    // Un déficit symétrique (les deux côtés courts d'autant) ne se rattrape pas
    // au centrage : le corriger d'un côté le creuserait de l'autre. Déplacer d
    // millimètres de B vers A donne un écart de (attA - A1 - d) et (attB - B1 + d) ;
    // la somme des carrés est minimale pour d = ((attA - A1) - (attB - B1)) / 2.
    const residuA = e.attA - apresAngleA;
    const residuB = e.attB - apresAngleB;
    const besoinA = (residuA - residuB) / 2;
    const centrageBrut = besoinA * P.IHM_PAR_MM_CENTRAGE;
    const centrage = snap(centrageBrut, P.PAS_CENTRAGE);
    const deltaCentrage = centrage / P.IHM_PAR_MM_CENTRAGE;

    return Object.assign(base, {
      conforme: false,
      demiDents: demiDents,
      mmTotal: mmTotal,
      mmParCote: mmParCote,
      centrage: centrage,
      prevuA: apresAngleA + deltaCentrage,
      prevuB: apresAngleB - deltaCentrage,
      journal: [
        'Sommes : mesure ' + sommeMes.toFixed(2) + ' vs attendu ' + sommeAtt.toFixed(2) +
          ' => besoin total ' + besoinTotal.toFixed(2) + ' mm',
        'Mise en angle : ' + formaterDents(demiDents) + ' => ' + mmTotal.toFixed(2) +
          ' mm au total (' + mmParCote.toFixed(2) + ' mm par cote)',
        'Apres angle : A = ' + apresAngleA.toFixed(2) + ', B = ' + apresAngleB.toFixed(2),
        'Residus apres angle : A ' + residuA.toFixed(2) + ' mm, B ' + residuB.toFixed(2) + ' mm',
        'Centrage : desequilibre/2 = ' + besoinA.toFixed(2) + ' mm => brut ' +
          centrageBrut.toFixed(2) + ' => retenu ' + String(centrage),
        'Prevision finale : A = ' + (apresAngleA + deltaCentrage).toFixed(2) +
          ', B = ' + (apresAngleB - deltaCentrage).toFixed(2) +
          ' (tolerance ' + String(tol) + ' mm)'
      ]
    });
  }

  /** Met un nombre de demi-dents sous forme lisible : « +1 dent », « -3/2 dent ». */
  function formaterDents(demiDents) {
    if (demiDents === 0) return '0 dent';
    const signe = demiDents > 0 ? '+' : '';
    if (demiDents % 2 === 0) {
      const dents = demiDents / 2;
      return signe + String(dents) + ' dent' + (Math.abs(dents) === 1 ? '' : 's');
    }
    return signe + String(demiDents) + '/2 dent';
  }

  return {
    PARAMS: PARAMS,
    snap: snap,
    versNombre: versNombre,
    estConforme: estConforme,
    calculerSprint: calculerSprint,
    calculerGmt: calculerGmt,
    formaterDents: formaterDents
  };
});
