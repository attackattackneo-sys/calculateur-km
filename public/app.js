const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";
const ORS_API_KEY = "5b3ce3597851110001cf6248";

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
    metroExtraKmPrice: 2, metroExtraMinPrice: 1.2,
    extendedMaxKm: 50, extendedMaxMin: 75, priceExtended: 179,
    parisSupplement: 30,
    extendedExtraKmPrice: 1.5, extendedExtraMinPrice: 1,
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
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address.includes("France") ? address : `${address}, France`);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "fr");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GregPhotographe-km-calculator/1.0" }
    });
    if (!r.ok) throw new Error("Erreur réseau Nominatim");
    const data = await r.json();
    if (!Array.isArray(data) || !data[0]) throw new Error("Adresse introuvable");
    const a = data[0].address || {};
    return {
      lat: Number(data[0].lat),
      lon: Number(data[0].lon),
      city: a.city || a.town || a.village || "",
      department: (a.postcode || "").slice(0, 2)
    };
  } catch (e) {
    console.warn("Nominatim échoue, fallback code postal", e);
    const postcodeMatch = address.match(/\b(\d{5})\b/);
    if (postcodeMatch) {
      const dept = postcodeMatch[1].slice(0, 2);
      const deptCenter = {
        "75": { lat: 48.8566, lon: 2.3522 },
        "77": { lat: 48.5399, lon: 2.6595 },
        "78": { lat: 48.8014, lon: 2.1303 },
        "91": { lat: 48.5839, lon: 2.3081 },
        "92": { lat: 48.8924, lon: 2.2153 },
        "93": { lat: 48.9316, lon: 2.3976 },
        "94": { lat: 48.7846, lon: 2.4238 },
        "95": { lat: 49.0375, lon: 2.0749 }
      };
      if (deptCenter[dept]) {
        return {
          lat: deptCenter[dept].lat,
          lon: deptCenter[dept].lon,
          city: address,
          department: dept
        };
      }
    }
    throw new Error("Impossible de localiser cette adresse. Veuillez réessayer ou saisir un code postal.");
  }
}

async function routeORS(fromLat, fromLon, toLat, toLon) {
  const body = { coordinates: [[fromLon, fromLat], [toLon, toLat]], format: "json" };
  const url = "https://api.openrouteservice.org/v2/directions/driving-car";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": ORS_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("Service de routage indisponible");
  const data = await r.json();
  if (!data.routes || !data.routes[0]) throw new Error("Itinéraire introuvable");
  const distanceKm = data.routes[0].summary.distance / 1000;
  const durationMinSimple = data.routes[0].summary.duration / 60;
  return { distanceKm: round1(distanceKm), durationMinSimple: round1(durationMinSimple) };
}

function computeCrowFliesDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getRouteWrapper(fromLat, fromLon, toLat, toLon) {
  try {
    return await routeORS(fromLat, fromLon, toLat, toLon);
  } catch (e) {
    console.warn("ORS échoue, fallback à vol d'oiseau", e);
    const dist = computeCrowFliesDistance(fromLat, fromLon, toLat, toLon);
    const durationSimple = (dist / 40) * 60;
    return { distanceKm: round1(dist * 1.3), durationMinSimple: round1(durationSimple * 1.5) };
  }
}

// Fonction principale
async function calculate(address, babies, persons, ants) {
  const studioGeo = await geocode(STUDIO_ADDRESS);
  const clientGeo = await geocode(address);
  const route = await getRouteWrapper(studioGeo.lat, studioGeo.lon, clientGeo.lat, clientGeo.lon);
  const pricing = computePrice(clientGeo.city, clientGeo.department, route.distanceKm, route.durationMinSimple);
  const cfg = getPricingConfig();
  const babyCost = babies * cfg.priceBaby;
  const persCost = persons * cfg.priceExtraPers;
  const antsCost = ants * cfg.priceAnts;
  const grandTotal = pricing.price + babyCost + persCost + antsCost;
  return {
    city: clientGeo.city,
    distanceKm: route.distanceKm,
    durationSimple: route.durationMinSimple,
    durationAR: route.durationMinSimple * 2,
    zone: pricing.zone,
    details: pricing.details,
    supplements: { babyCost, persCost, antsCost },
    total: grandTotal
  };
}

// Intégration UI (exemple)
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
