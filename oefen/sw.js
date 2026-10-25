// Service worker van de oefenapp. Houdt één complete, versiegebonden set appbestanden beschikbaar zonder internet.
// - Installeren: alle verplichte bestanden in één keer (cache.addAll). Mislukt er één, dan mislukt de installatie en blijft
//   de vorige complete versie gewoon werken.
// - Geen automatische overname: een nieuwe versie wacht tot de app "SKIP_WAITING" stuurt (buiten een lopende dag).
// - Tochtpakket, plan en voortgang staan in IndexedDB, niet hier. API-verzoeken (/api/) gaan nooit via de cache.
importScripts("versie.js");
const CACHE = "kompas-oefen-" + self.APP_VERSIE;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(self.APP_BESTANDEN.map(f => new Request(f, { cache: "reload" }))))
    .catch(err => caches.delete(CACHE).then(() => { throw err; })));   // geen halve versie laten staan
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kompas-oefen-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET" || url.pathname.includes("/api/")) return;
  // appbestanden van deze versie: eerst uit de eigen cache (geen mix van oude en nieuwe bestanden), anders netwerk
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true })).then(r => r || fetch(e.request)));
});
