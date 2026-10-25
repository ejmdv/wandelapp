// Oefenplan: pauzes en opdrachten per dag (zie CONTRACT.md §3). Gedeeld door planner en oefenapp: de pictogrammen op de
// kaart en het kaartblad en de stappen op de telefoon komen zo uit precies dezelfde berekening. Vereist canon.js.
// Reproduceerbaar (seed uit route + leergebieden, Fisher-Yates); de app plant een vastgelegde tocht nooit opnieuw.
(function (root) {
  // besluit 23-10-2026: per dag twee keer koffie en één keer lunch, rond een kwart, de helft en driekwart van de dag
  const PAUZES = [
    { key: "coffee1", kind: "coffee", min: 15, plek: 0.25 },
    { key: "lunch", kind: "lunch", min: 30, plek: 0.50 },
    { key: "coffee2", kind: "coffee", min: 15, plek: 0.75 },
  ];
  const MOMENTEN = ["aankomst", "vertrek", "onderweg", "pauze"];
  // opdrachten die op een andere etappe een ander antwoord hebben en dus mogen terugkomen
  const HERHAALBAAR = new Set(["rd", "afstand", "kompas", "terug", "positie", "tijd", "overslaan", "gelopen", "schaduw", "oog"]);

  function rng(seed) {   // mulberry32
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function schud(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function past(o, i, P) {
    if ((o.nodig || []).includes("volgend") && !P[i + 1]) return false;
    if ((o.nodig || []).includes("vorig") && i === 0) return false;
    if ((o.nodig || []).includes("overslaan") && !P[i + 2]) return false;
    if ((o.nodig || []).includes("laat")) {   // pas in het laatste 40 % van de dag: eerder is "haal je het voor donker" geen vraag
      const L = P[P.length - 1], pad = L.cumPath != null && P[i].cumPath != null;
      if ((pad ? P[i].cumPath : P[i].cumStraight) < 0.6 * (pad ? L.cumPath : L.cumStraight)) return false;
    }
    return true;
  }
  const dagLengte = d => { const L = d.cps[d.cps.length - 1]; return L.cumPath != null ? L.cumPath : L.cumStraight; };
  const posOf = (d, i) => d.cps[i].cumPath != null && d.cps[d.cps.length - 1].cumPath != null ? d.cps[i].cumPath : d.cps[i].cumStraight;
  // welke momenten passen bij punt i van n: op de start alleen vertrekken, op het eindpunt alleen aankomen
  const momentenBij = (i, n) => i === 0 ? ["vertrek", "onderweg"] : i === n - 1 ? ["aankomst"] : ["aankomst", "vertrek", "onderweg"];

  // days: [{ dayId, seq, cps: [{ id, oefenOk, rust, cumStraight, cumPath }] }], afstanden in meters vanaf de dagstart;
  // rust = er staat een bankje, picknicktafel of schuilhut vlakbij het punt.
  // pool: de vrijgegeven oefeningen. Geeft per dag { dayId, pauses: [{ pauseId, key, kind, durationMin, cpIndex, checkpointId }],
  // assign: { cpIndex: { moment: templateId } } }. Een pauze zonder geschikt punt krijgt cpIndex null (zelf te nemen).
  function maak(days, areas, pool, seedKey) {
    const r = rng(parseInt(Canon.sha256Hex(seedKey + "|" + areas.join(",")).slice(0, 8), 16)), gebruikt = new Set();
    const bron = {}; areas.forEach(g => { bron[g] = schud(pool.filter(o => o.gebied === g), r); });
    // Stap 1 per dag: pauzeplekken en oefenplekken vastleggen. Stap 2: oefeningen kiezen voor alle dagen samen, om en om
    // naar plaats in de dag. Een oefening komt eenmaal per tocht voor; dag 1 eerst vullen liet dag 2 bijna leeg (test 20-10).
    const slots = [], pzSlots = [];
    const out = days.map(d => {
      const P = d.cps, n = P.length, K = dagLengte(d), assign = {}, pauses = [];
      const ok = i => P[i].oefenOk;
      const pauzeBezet = new Set();
      let na = 0;   // pauzes blijven in volgorde: een latere pauze nooit op of vóór het punt van de vorige
      // besluit 25-10-2026: koffie en lunch alleen bij een punt met een bankje (of picknicktafel, schuilhut) vlakbij, binnen
      // een venster rond de gewenste plek. Kent de dag geen enkel bankje (oud pakket, bankjes niet geladen): zoals vroeger.
      const metBank = P.some(p => p.rust), venster = Math.max(2500, K * 0.15);
      for (const pz of PAUZES) {
        let best = -1, bd = Infinity;
        P.forEach((p, i) => {
          if (i <= na || i === n - 1 || !ok(i) || (metBank && !p.rust)) return;
          const x = Math.abs(posOf(d, i) - K * pz.plek);
          if ((!metBank || x <= venster) && x < bd) { bd = x; best = i; }
        });
        const base = { pauseId: `${d.dayId}-${pz.key}`, key: pz.key, kind: pz.kind, durationMin: pz.min };
        if (best > 0) { pauzeBezet.add(best); na = best; pauses.push({ ...base, cpIndex: best, checkpointId: P[best].id }); }
        else pauses.push({ ...base, cpIndex: null, checkpointId: null });   // via "Pauze" zelf te nemen
      }
      const Mn = Math.max(2, Math.min(8, Math.round(K / 4000))), bezet = new Set();
      for (let j = 0; j < Mn; j++) {
        let best = -1, bd = Infinity;
        P.forEach((p, i) => { if (!ok(i) || bezet.has(i) || pauzeBezet.has(i)) return; const x = Math.abs(posOf(d, i) - K * (j + 0.5) / Mn); if (x < bd) { bd = x; best = i; } });
        if (best < 0) break;
        bezet.add(best);
        slots.push({ assign, P, i: best, moments: momentenBij(best, n), gStart: j + d.seq, order: (j + 0.5) / Mn, seq: d.seq });
      }
      pauses.forEach((p, k) => { if (p.cpIndex != null) pzSlots.push({ assign, P, i: p.cpIndex, moments: ["pauze"], gStart: p.cpIndex, order: k, seq: d.seq }); });
      return { dayId: d.dayId, pauses, assign };
    });
    // Eerst een opdracht die nog niet is gebruikt. Daarna mag een opdracht met berekende controle terugkomen, de minst
    // gebruikte eerst: op een andere etappe is het een andere oefening met een ander antwoord (besluit 24-10-2026).
    // Zelfcontrole, meerkeuze en zonsondergang nooit twee keer: dezelfde vraag heeft hetzelfde antwoord.
    const keer = {};
    const kies = (moments, i, gStart, P) => {
      for (const herhaal of [false, true]) for (let k = 0; k < areas.length; k++) {
        const g = areas[(gStart + k) % areas.length];
        const kan = bron[g].filter(o => moments.includes(o.moment) && past(o, i, P) && (herhaal ? HERHAALBAAR.has(o.controle) : !gebruikt.has(o.id)));
        if (!kan.length) continue;
        const o = herhaal ? kan.reduce((a, b) => (keer[b.id] || 0) < (keer[a.id] || 0) ? b : a) : kan[0];
        gebruikt.add(o.id); keer[o.id] = (keer[o.id] || 0) + 1;
        return o;
      }
      return null;
    };
    const opVolgorde = (a, b) => a.order - b.order || a.seq - b.seq;
    const aantal = {};   // opdrachten per dag, zodat schaarse pauzeoefeningen naar de dag met de minste gaan
    const zet = s => { const o = kies(s.moments, s.i, s.gStart, s.P); if (o) { (s.assign[s.i] = s.assign[s.i] || {})[o.moment] = o.id; aantal[s.seq] = (aantal[s.seq] || 0) + 1; } };
    slots.sort(opVolgorde).forEach(zet);
    // pauzes één voor één: steeds de pauzeplek van de dag die op dat moment de minste opdrachten heeft
    const rest = pzSlots.sort(opVolgorde);
    while (rest.length) {
      let k = 0;
      rest.forEach((s, j) => { if ((aantal[s.seq] || 0) < (aantal[rest[k].seq] || 0)) k = j; });
      zet(rest.splice(k, 1)[0]);
    }
    return out;
  }

  // Wat in het tochtpakket komt (en dus op papier staat): punten als checkpointId, geen indexen.
  function kern(planDays, days, areas, libraryVersion) {
    return { libraryVersion, areas: areas.slice(), days: planDays.map((pd, k) => {
      const P = days[k].cps, assignments = [];
      Object.keys(pd.assign).map(Number).sort((a, b) => a - b).forEach(i => MOMENTEN.forEach(mo => {
        if (pd.assign[i][mo]) assignments.push({ checkpointId: P[i].id, moment: mo, templateId: pd.assign[i][mo] });
      }));
      return { dayId: pd.dayId, pauses: pd.pauses.map(p => ({ pauseId: p.pauseId, kind: p.kind, durationMin: p.durationMin, checkpointId: p.checkpointId })), assignments };
    }) };
  }

  // Per punt wat er te doen is, voor de pictogrammen: { checkpointId: { opdracht: bool, pauzes: ["coffee"|"lunch", ...] } }
  function perPunt(k) {
    const out = {};
    const bij = id => out[id] = out[id] || { opdracht: false, pauzes: [] };
    for (const d of k.days) {
      d.assignments.forEach(a => { bij(a.checkpointId).opdracht = true; });
      d.pauses.forEach(p => { if (p.checkpointId) bij(p.checkpointId).pauzes.push(p.kind); });
    }
    return out;
  }

  root.Plan = { PAUZES, MOMENTEN, maak, kern, perPunt, momentenBij };
})(typeof window !== "undefined" ? window : globalThis);
