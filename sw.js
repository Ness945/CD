/**
 * Service worker — l'application doit rester utilisable sans réseau.
 *
 * Stratégie : « cache d'abord » pour les ressources de l'application, qui sont
 * figées et versionnées. Changer VERSION invalide l'ancien cache et force le
 * rechargement complet au prochain passage en ligne.
 */
const VERSION = 'nst-v8.0.0';

const RESSOURCES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/app.css',
  './assets/calc.js',
  './assets/tests.js',
  './assets/icon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (cache) { return cache.addAll(RESSOURCES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (cles) {
        return Promise.all(cles.map(function (cle) {
          return cle === VERSION ? null : caches.delete(cle);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const requete = e.request;

  // On ne gère que la navigation et les GET de même origine.
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  // Navigation : servir la page même hors ligne.
  if (requete.mode === 'navigate') {
    e.respondWith(
      fetch(requete).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(requete, { ignoreSearch: true }).then(function (enCache) {
      if (enCache) return enCache;
      return fetch(requete).then(function (reponse) {
        // Mettre en cache au passage ce qui manquait (icônes, pages annexes).
        if (reponse && reponse.status === 200 && reponse.type === 'basic') {
          const copie = reponse.clone();
          caches.open(VERSION).then(function (cache) { cache.put(requete, copie); });
        }
        return reponse;
      });
    })
  );
});
