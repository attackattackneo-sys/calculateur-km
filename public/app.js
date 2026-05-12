const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";

function getPricingConfig() {
  const saved = localStorage.getItem('gregPricingV2');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return {
    priceStudio: 59,
    localMaxKm: 16, localMaxMin: 30, priceLocal: 79,
    localExtraKmPrice: 2.5, localExtraMinPrice: 1.5,
    metroMaxKm: 35, metroMaxMin: 50, priceMetro: 129,
    metroExtraKmPrice: 2.0, metroExtraMinPrice: 1.2,
    extendedMaxKm: 50, extendedMaxMin: 75, priceExtended: 179,
    parisSupplement: 30,
    extendedExtraKmPrice: 1.5, extendedExtraMinPrice: 1.0,
    priceBaby: 15, priceExtraPers: 15, priceAnts: 5
  };
}

function round1(n) { return Math.round(n * 10) / 10; }

function computePrice(city, department, distanceKm, durationMinSimple) {
  const cfg = getPricingConfig();
  const lower = (city || "").trim().toLowerCase();
  const durationAR = durationMinSimple * 2;

  if (lower.includes("neuilly-sur-marne")) {
    return {
      price: cfg.priceStudio,
      zone: "Studio (Neuilly-sur-Marne)",
      details: [`Forfait spécial Studio : ${cfg.priceStudio} €`],
    };
  }

  let zone, basePrice, includedKm, includedMin, extraKmPrice, extraMinPrice;
  let parisSurcharge = 0;

  if (distanceKm <= cfg.localMaxKm && durationAR <= cfg.localMaxMin) {
    zone = "Locale";
    basePrice = cfg.priceLocal;
    includedKm = cfg.localMaxKm;
    includedMin = cfg.localMaxMin;
    extraKmPrice = cfg.localExtraKmPrice;
    extraMinPrice = cfg.localExtraMinPrice;
  } else if (distanceKm <= cfg.metroMaxKm && durationAR <= cfg.metroMaxMin) {
    zone = "Métropolitaine";
    basePrice = cfg.priceMetro;
    includedKm = cfg.metroMaxKm;
    includedMin = cfg.metroMaxMin;
    extraKmPrice = cfg.metroExtraKmPrice;
    extraMinPrice = cfg.metroExtraMinPrice;
  } else {
    zone = "Étendue";
    basePrice = cfg.priceExtended;
    includedKm = cfg.extendedMaxKm;
    includedMin = cfg.extendedMaxMin;
    extraKmPrice = cfg.extendedExtraKmPrice;
    extraMinPrice = cfg.extendedExtraMinPrice;
    if (department === "75") parisSurcharge = cfg.parisSupplement;
  }

  const excessKm = round1(Math.max(0, distanceKm - includedKm));
  const excessMin = round1(Math.max(0, durationAR - includedMin));
  const kmCost = round1(excessKm * extraKmPrice);
  const minCost = round1(excessMin * extraMinPrice);
  const total = Math.round(basePrice + kmCost + minCost + parisSurcharge);

  const details = [];
  details.push(`Zone ${zone} — ${basePrice} €`);
  if (excessKm > 0) details.push(`+ ${excessKm} km × ${extraKmPrice} € = ${kmCost} €`);
  if (excessMin > 0) details.push(`+ ${excessMin} min (A/R) × ${extraMinPrice} € = ${minCost} €`);
  if (parisSurcharge > 0) details.push(`Supplément Paris intra-muros : +${parisSurcharge} €`);

  return { price: total, zone, details };
}

async function geocode(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address.includes("France") ? address : `${address}, France`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "fr");
  const r = await fetch(url.toString(), {
    headers: { "User-Agent": "GregPhotographe-km-calculator/1.0" }
  });
  const data = await r.json();
  if (!Array.isArray(data) || !data[0]) throw new Error("Adresse introuvable.");
  const a = data[0].address || {};
  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    city: a.city || a.town || a.village || "",
    department: (a.postcode || "").slice(0, 2)
  };
}

async function routeOsrm(fromLat, fromLon, toLat, toLon) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false&steps=false`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.code !== "Ok" || !j.routes?.[0]) throw new Error("Itinéraire indisponible.");
  const distanceKm = j.routes[0].distance / 1000;
  const durationMinSimple = j.routes[0].duration / 60;
  return { distanceKm: round1(distanceKm), durationMinSimple: round1(durationMinSimple) };
}

async function calculate(address, babies, persons, ants) {
  const studio = await geocode(STUDIO_ADDRESS);
  const client = await geocode(address);
  const route = await routeOsrm(studio.lat, studio.lon, client.lat, client.lon);
  const pricing = computePrice(client.city, client.department, route.distanceKm, route.durationMinSimple);
  const cfg = getPricingConfig();
  const babyCost = babies * cfg.priceBaby;
  const persCost = persons * cfg.priceExtraPers;
  const antsCost = ants * cfg.priceAnts;
  const grandTotal = pricing.price + babyCost + persCost + antsCost;

  return {
    city: client.city,
    distanceKm: route.distanceKm,
    durationSimple: route.durationMinSimple,
    durationAR: route.durationMinSimple * 2,
    zone: pricing.zone,
    details: pricing.details,
    supplements: { babyCost, persCost, antsCost },
    total: grandTotal
  };
}

// Exemple d'intégration DOM
const btn = document.getElementById("btn");
const out = document.getElementById("out");
const addressEl = document.getElementById("address");

function setLoading() {
  out.className = "out";
  out.innerHTML = `<div style="color: #666;">Recherche de l'itinéraire...</div>`;
}

function setError(msg) {
  out.className = "out err";
  out.textContent = msg;
}

function setResult(data) {
  out.className = "out ok";
  out.innerHTML = `
    <span class="result-text">${data.city}</span>
    <span class="price-tag">${data.total} €</span>
    <div class="small" style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
      Distance : ${data.distanceKm} km &bull; Temps simple : ${data.durationSimple} min &bull; A/R : ${data.durationAR} min
    </div>
    <div class="small" style="font-style: italic; font-size: 0.8rem; margin-top: 5px;">
      ${data.details.join(' · ')}
    </div>
  `;
}

if (btn) {
  btn.addEventListener("click", async () => {
    const address = addressEl.value.trim();
    if (!address) return setError("Merci de saisir une adresse ou une ville.");

    try {
      setLoading();
      const babies = parseInt(document.getElementById("babies")?.value) || 0;
      const persons = parseInt(document.getElementById("persons")?.value) || 0;
      const ants = parseInt(document.getElementById("ants")?.value) || 0;
      const data = await calculate(address, babies, persons, ants);
      setResult(data);
    } catch (err) {
      setError(err.message || "Erreur lors du calcul.");
    }
  });
}