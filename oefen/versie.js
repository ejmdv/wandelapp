// Gedeeld door app en service worker: versie en verplichte bestanden voor offline gebruik.
// Bij elke wijziging van een van deze bestanden APP_VERSIE ophogen: de service worker haalt dan alles opnieuw op
// (allemaal of niets) en wordt pas actief als er geen dag loopt of je zelf "Bijwerken" kiest.
self.APP_VERSIE = "2.4.3";
self.APP_BESTANDEN = ["./", "./index.html", "./oefeningen.js", "./versie.js", "./manifest.webmanifest", "../contract/canon.js", "../contract/plan.js", "../stijl/veld.css"];
