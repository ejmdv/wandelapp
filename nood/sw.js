// Houdt de noodpagina beschikbaar zonder internet: pagina, Leaflet en de opgeslagen Kadaster-tegels langs de route.
const CACHE = "kompas-nood-v3";
const FILES = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  // alleen oude paginaversies opruimen; tegels en bibliotheken blijven staan
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("kompas-nood-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Kadaster-tegels en Leaflet: eerst uit de opslag (offline), anders van het netwerk
  if (url.host === "service.pdok.nl" || url.href.startsWith("https://cdnjs.cloudflare.com/ajax/libs/leaflet/")) {
    e.respondWith(caches.match(e.request.url).then(r => r || fetch(e.request)));
    return;
  }
  if (url.origin !== location.origin) return;
  // eigen bestanden: eerst netwerk (nieuwste versie), anders uit de opslag; de route zit in de #-hash en gaat nooit over het netwerk
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html")))
  );
});
