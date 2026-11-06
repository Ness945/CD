/**
 * Tests de la logique de calcul.
 *
 * Ils portent sur des valeurs en mémoire et ne touchent jamais aux champs de
 * l'écran : l'ancienne version écrasait les saisies de l'opérateur pour tester,
 * et les restaurait sans try/finally — une exception au milieu les perdait.
 *
 * Exécutable dans le navigateur (panneau « Tests ») ou en ligne de commande :
 *     node assets/tests.js
 */
(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./calc.js')
      : root.NSTCalc
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NSTTests = api;
})(typeof self !== 'undefined' ? self : this, function (NSTCalc) {
  'use strict';

  function lancerTests() {
    const resultats = [];

    function verifier(nom, condition, detail) {
      resultats.push({
        nom: nom,
        ok: !!condition,
        detail: detail === undefined ? '' : String(detail)
      });
    }

    function presque(a, b, epsilon) {
      return Math.abs(a - b) < (epsilon === undefined ? 1e-9 : epsilon);
    }

    // --- versNombre : le garde-fou contre le champ vide ---
    verifier('versNombre("") renvoie null',
      NSTCalc.versNombre('') === null);
    verifier('versNombre("   ") renvoie null',
      NSTCalc.versNombre('   ') === null);
    verifier('versNombre("abc") renvoie null',
      NSTCalc.versNombre('abc') === null);
    verifier('versNombre("150,5") accepte la virgule',
      NSTCalc.versNombre('150,5') === 150.5);
    verifier('versNombre("0") renvoie bien 0',
      NSTCalc.versNombre('0') === 0);
    verifier('versNombre("-2.5") accepte le négatif',
      NSTCalc.versNombre('-2.5') === -2.5);

    // --- snap : arrondi au pas machine ---
    verifier('snap(0.37, 0.25) = 0.25',
      presque(NSTCalc.snap(0.37, 0.25), 0.25));
    verifier('snap(0.38, 0.25) = 0.5',
      presque(NSTCalc.snap(0.38, 0.25), 0.5));
    verifier('snap(-0.14, 0.1) = -0.1',
      presque(NSTCalc.snap(-0.14, 0.1), -0.1));

    // --- Tolérance ---
    verifier('estConforme(0.5, -0.5) : la borne est incluse',
      NSTCalc.estConforme(0.5, -0.5) === true);
    verifier('estConforme(0.51, 0) : au-delà, non conforme',
      NSTCalc.estConforme(0.51, 0) === false);

    // --- SPRINT : pose conforme ---
    const sprintOk = NSTCalc.calculerSprint(
      { attA: 150, attB: 150, mesA: 150.2, mesB: 149.8, mode: 'NST1' });
    verifier('SPRINT conforme : aucun centrage',
      sprintOk.conforme === true && sprintOk.centrage === 0 && sprintOk.longueur === 0,
      'centrage=' + sprintOk.centrage + ' longueur=' + sprintOk.longueur);

    // --- SPRINT : inversion des rôles NST1 / NST2 ---
    // Mesures A=150.5 / B=150.0 pour un attendu de 150.
    // En NST1 la Coupe est en B : son écart est nul, donc pas de centrage.
    const nst1 = NSTCalc.calculerSprint(
      { attA: 150, attB: 150, mesA: 151.5, mesB: 150.0, mode: 'NST1' });
    verifier('SPRINT NST1 : Coupe en B, écart Coupe nul => centrage 0',
      presque(nst1.centrage, 0), 'centrage=' + nst1.centrage);

    // En NST2 la Coupe est en A : écart de +1.5 mm => centrage 1.5 * 0.2 = +0.3.
    const nst2 = NSTCalc.calculerSprint(
      { attA: 150, attB: 150, mesA: 151.5, mesB: 150.0, mode: 'NST2' });
    verifier('SPRINT NST2 : Coupe en A, écart +1,5 mm => centrage +0,3',
      presque(nst2.centrage, 0.3, 1e-9), 'centrage=' + nst2.centrage);
    verifier('SPRINT : les deux modes ne donnent pas le même centrage',
      nst1.centrage !== nst2.centrage);

    // --- SPRINT : la correction rapproche réellement de la cible ---
    const avant = NSTCalc.calculerSprint(
      { attA: 150, attB: 150, mesA: 148, mesB: 152, mode: 'NST1' });
    const ecartAvant = Math.abs(148 - 150) + Math.abs(152 - 150);
    const ecartApres = Math.abs(avant.prevuA - 150) + Math.abs(avant.prevuB - 150);
    verifier('SPRINT : la prévision réduit l\'écart total',
      ecartApres < ecartAvant,
      'avant=' + ecartAvant.toFixed(2) + ' apres=' + ecartApres.toFixed(2));

    // --- SPRINT : les sorties respectent le pas machine ---
    verifier('SPRINT : centrage au pas 0,1',
      presque(avant.centrage, NSTCalc.snap(avant.centrage, 0.1)));
    verifier('SPRINT : longueur au pas 0,25',
      presque(avant.longueur, NSTCalc.snap(avant.longueur, 0.25)));

    // --- GMT : le bug corrigé ---
    // Écarts de +0.4 mm des deux côtés : dans la tolérance de 0.5. L'ancienne
    // version affichait « Déjà conforme » et réclamait quand même une demi-dent.
    const gmtTol = NSTCalc.calculerGmt(
      { attA: 110, attB: 110, mesA: 110.4, mesB: 110.4 });
    verifier('GMT : écart dans la tolérance => conforme',
      gmtTol.conforme === true);
    verifier('GMT : conforme => aucune mise en angle proposée',
      gmtTol.demiDents === 0,
      'demiDents=' + gmtTol.demiDents);
    verifier('GMT : conforme => aucun centrage proposé',
      gmtTol.centrage === 0,
      'centrage=' + gmtTol.centrage);

    // --- GMT : pose trop courte des deux côtés ---
    const gmtCourt = NSTCalc.calculerGmt(
      { attA: 110, attB: 110, mesA: 108.5, mesB: 108.5 });
    verifier('GMT : pose trop courte => ajout de dents',
      gmtCourt.demiDents > 0, 'demiDents=' + gmtCourt.demiDents);
    verifier('GMT : symétrique => pas de centrage',
      gmtCourt.centrage === 0, 'centrage=' + gmtCourt.centrage);
    const ecartGmtAvant = Math.abs(108.5 - 110) * 2;
    const ecartGmtApres = Math.abs(gmtCourt.prevuA - 110) + Math.abs(gmtCourt.prevuB - 110);
    verifier('GMT : la prévision réduit l\'écart total',
      ecartGmtApres < ecartGmtAvant,
      'avant=' + ecartGmtAvant.toFixed(2) + ' apres=' + ecartGmtApres.toFixed(2));

    // --- GMT : pose déséquilibrée ---
    const gmtDesequilibre = NSTCalc.calculerGmt(
      { attA: 110, attB: 110, mesA: 107, mesB: 112 });
    verifier('GMT : déséquilibre => centrage non nul',
      gmtDesequilibre.centrage !== 0, 'centrage=' + gmtDesequilibre.centrage);
    verifier('GMT : A trop court => centrage vers A (positif)',
      gmtDesequilibre.centrage > 0, 'centrage=' + gmtDesequilibre.centrage);
    verifier('GMT : le centrage ne change pas la somme',
      presque(gmtDesequilibre.prevuA + gmtDesequilibre.prevuB,
        107 + 112 + gmtDesequilibre.mmTotal, 1e-9));

    // --- Propriété d'ensemble : la correction ramène toujours dans la tolérance ---
    //
    // Balayage de l'espace des mesures plutôt que quelques cas choisis. C'est ce
    // qui garantit qu'aucun réglage de PARAMS ne fera sortir une prévision de la
    // tolérance : l'ancienne formule de centrage GMT échouait sur 27 % des cas.
    function balayer(nom, calculer, attendu, plage, pas) {
      let total = 0;
      let hors = 0;
      let pireEcart = 0;
      let pireCas = null;
      for (let a = -plage; a <= plage + 1e-9; a += pas) {
        for (let b = -plage; b <= plage + 1e-9; b += pas) {
          const mesA = Number((attendu + a).toFixed(3));
          const mesB = Number((attendu + b).toFixed(3));
          const r = calculer(mesA, mesB);
          total++;
          const ecart = Math.max(
            Math.abs(r.prevuA - attendu),
            Math.abs(r.prevuB - attendu)
          );
          if (ecart > pireEcart) {
            pireEcart = ecart;
            pireCas = mesA + ' / ' + mesB;
          }
          if (ecart > NSTCalc.PARAMS.TOLERANCE + 1e-9) hors++;
        }
      }
      verifier(nom + ' : toutes les prévisions dans la tolérance',
        hors === 0,
        hors + '/' + total + ' hors tolérance, pire écart ' +
          pireEcart.toFixed(3) + ' mm' + (pireCas ? ' sur ' + pireCas : ''));
    }

    balayer('GMT', function (mesA, mesB) {
      return NSTCalc.calculerGmt({ attA: 110, attB: 110, mesA: mesA, mesB: mesB });
    }, 110, 6, 0.25);

    balayer('SPRINT NST1', function (mesA, mesB) {
      return NSTCalc.calculerSprint({ attA: 150, attB: 150, mesA: mesA, mesB: mesB, mode: 'NST1' });
    }, 150, 6, 0.25);

    balayer('SPRINT NST2', function (mesA, mesB) {
      return NSTCalc.calculerSprint({ attA: 150, attB: 150, mesA: mesA, mesB: mesB, mode: 'NST2' });
    }, 150, 6, 0.25);

    // --- Formatage des dents ---
    verifier('formaterDents(0) = "0 dent"',
      NSTCalc.formaterDents(0) === '0 dent', NSTCalc.formaterDents(0));
    verifier('formaterDents(2) = "+1 dent"',
      NSTCalc.formaterDents(2) === '+1 dent', NSTCalc.formaterDents(2));
    verifier('formaterDents(4) = "+2 dents"',
      NSTCalc.formaterDents(4) === '+2 dents', NSTCalc.formaterDents(4));
    verifier('formaterDents(1) = "+1/2 dent"',
      NSTCalc.formaterDents(1) === '+1/2 dent', NSTCalc.formaterDents(1));
    verifier('formaterDents(-3) = "-3/2 dent"',
      NSTCalc.formaterDents(-3) === '-3/2 dent', NSTCalc.formaterDents(-3));
    verifier('formaterDents(-2) = "-1 dent"',
      NSTCalc.formaterDents(-2) === '-1 dent', NSTCalc.formaterDents(-2));

    const echecs = resultats.filter(function (r) { return !r.ok; });
    return {
      resultats: resultats,
      total: resultats.length,
      echecs: echecs.length,
      ok: echecs.length === 0
    };
  }

  return { lancerTests: lancerTests };
});

// Exécution directe en ligne de commande : node assets/tests.js
if (typeof module === 'object' && module.exports && require.main === module) {
  const bilan = module.exports.lancerTests();
  bilan.resultats.forEach(function (r) {
    const ligne = (r.ok ? 'OK   ' : 'ECHEC') + ' | ' + r.nom;
    console.log(r.detail ? ligne + '  (' + r.detail + ')' : ligne);
  });
  console.log('\n' + (bilan.total - bilan.echecs) + '/' + bilan.total + ' tests passes.');
  process.exit(bilan.ok ? 0 : 1);
}
