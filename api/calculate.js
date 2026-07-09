const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";

const NEARBY_CITIES = new Set([
  "noisy-le-grand", "chelles", "neuilly-plaisance", "gagny", "le perreux-sur-marne", "gournay-sur-marne"
]);

function round1(n) { return Math.round(n * 10) / 10; }

function computePrice({ city, department, distanceKm, durationMinSimple, babiesCount, antsCount }) {
  const cityN = (city || "").trim().toLowerCase();
  
  // Configuration des zones (même que dans index.html)
  const cfg = {
    priceStudio: 59,
    localMaxKm: 16, localMaxMin: 30, priceLocal: 79,
    localExtraKmPrice: 2.5, localExtraMinPrice: 1.5,
    metroMaxKm: 35, metroMaxMin: 50, priceMetro: 129,
    metroExtraKmPrice: 2, metroExtraMinPrice: 1.2,
    extendedMaxKm: 50, extendedMaxMin: 75, priceExtended: 179,
    parisSupplement: 30,
    extendedExtraKmPrice: 1.5, extendedExtraMinPrice: 1
  };
  
  const durationAR = durationMinSimple * 2;
  let basePrice = null;
  let zone = null;
  let explanation = "";
  
  // Tarif spécial Studio
  if (cityN.includes("neuilly-sur-marne")) {
    basePrice = cfg.priceStudio;
    zone = "Studio";
    explanation = `Forfait Studio Neuilly-sur-Marne : ${basePrice} €`;
  }
  // Tarif postal direct (à ajouter si besoin)
  else if (city && cfg.postalPrices && cfg.postalPrices[city]) {
    basePrice = cfg.postalPrices[city];
    zone = "Tarif direct";
    explanation = `Tarif direct pour ${city} : ${basePrice} €`;
  }
  // Zone Locale
  else if (distanceKm <= cfg.localMaxKm && durationAR <= cfg.localMaxMin) {
    basePrice = cfg.priceLocal;
    zone = "Locale";
    explanation = `Zone Locale (≤${cfg.localMaxKm} km / ≤${cfg.localMaxMin} min A/R) : ${basePrice} €`;
    
    const excessKm = Math.max(0, distanceKm - cfg.localMaxKm);
    const excessMin = Math.max(0, durationAR - cfg.localMaxMin);
    if (excessKm > 0 || excessMin > 0) {
      const kmCost = round1(excessKm * cfg.localExtraKmPrice);
      const minCost = round1(excessMin * cfg.localExtraMinPrice);
      basePrice += kmCost + minCost;
      if (excessKm > 0) explanation += ` + ${excessKm} km × ${cfg.localExtraKmPrice} € = ${kmCost} €`;
      if (excessMin > 0) explanation += ` + ${excessMin} min × ${cfg.localExtraMinPrice} € = ${minCost} €`;
    }
  }
  // Zone Métropolitaine
  else if (distanceKm <= cfg.metroMaxKm && durationAR <= cfg.metroMaxMin) {
    basePrice = cfg.priceMetro;
    zone = "Métropolitaine";
    explanation = `Zone Métropolitaine (≤${cfg.metroMaxKm} km / ≤${cfg.metroMaxMin} min A/R) : ${basePrice} €`;
    
    const excessKm = Math.max(0, distanceKm - cfg.metroMaxKm);
    const excessMin = Math.max(0, durationAR - cfg.metroMaxMin);
    if (excessKm > 0 || excessMin > 0) {
      const kmCost = round1(excessKm * cfg.metroExtraKmPrice);
      const minCost = round1(excessMin * cfg.metroExtraMinPrice);
      basePrice += kmCost + minCost;
      if (excessKm > 0) explanation += ` + ${excessKm} km × ${cfg.metroExtraKmPrice} € = ${kmCost} €`;
      if (excessMin > 0) explanation += ` + ${excessMin} min × ${cfg.metroExtraMinPrice} € = ${minCost} €`;
    }
  }
  // Zone Étendue
  else {
    basePrice = cfg.priceExtended;
    zone = "Étendue";
    explanation = `Zone Étendue (>${cfg.extendedMaxKm} km ou >${cfg.extendedMaxMin} min A/R) : ${basePrice} €`;
    
    const excessKm = Math.max(0, distanceKm - cfg.extendedMaxKm);
    const excessMin = Math.max(0, durationAR - cfg.extendedMaxMin);
    
    if (department === "75") {
      basePrice += cfg.parisSupplement;
      explanation += ` + supplément Paris : ${cfg.parisSupplement} €`;
    }
    
    if (excessKm > 0 || excessMin > 0) {
      const kmCost = round1(excessKm * cfg.extendedExtraKmPrice);
      const minCost = round1(excessMin * cfg.extendedExtraMinPrice);
      basePrice += kmCost + minCost;
      if (excessKm > 0) explanation += ` + ${excessKm} km × ${cfg.extendedExtraKmPrice} € = ${kmCost} €`;
      if (excessMin > 0) explanation += ` + ${excessMin} min × ${cfg.extendedExtraMinPrice} € = ${minCost} €`;
    }
  }

  if (basePrice === null) {
    return { price: "Sur devis", explanation: "Hors zone : merci de me contacter." };
  }

  const extraBabies = babiesCount * 15;
  const extraAnts = antsCount * 5;
  const finalPrice = Math.round(basePrice) + extraBabies + extraAnts;

  if (extraBabies > 0) explanation += ` | +${extraBabies}€ (Bébés)`;
  if (extraAnts > 0) explanation += ` | +${extraAnts}€ (ANTS)`;

  return { price: finalPrice, explanation, zone, distanceKm, durationAR };
}

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1&countrycodes=fr`;
  const r = await fetch(url, { headers: { "User-Agent": "GregPhotographe-App/1.1" } });
  const j = await r.json();
  if (!j || !j[0]) throw new Error(`Impossible de trouver la ville : ${address}`);

  const item = j[0];
  const a = item.address || {};
  const city = a.city || a.town || a.municipality || a.village || item.name || "Ville inconnue";
  
  let postcode = a.postcode || "";
  if (!postcode) {
    const match = item.display_name.match(/\b\d{5}\b/);
    if (match) postcode = match[0];
  }
  const department = postcode.slice(0, 2);

  return { lat: item.lat, lon: item.lon, city, department };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  try {
    const { address, babiesCount = 0, antsCount = 0 } = req.body;
    if (!address) throw new Error("Veuillez saisir une adresse.");

    const [studio, client] = await Promise.all([geocode(STUDIO_ADDRESS), geocode(address)]);
    
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${studio.lon},${studio.lat};${client.lon},${client.lat}?overview=false`;
    const routeRes = await fetch(routeUrl);
    const routeData = await routeRes.json();
    
    if (routeData.code !== "Ok" || !routeData.routes || !routeData.routes[0]) {
      throw new Error("Itinéraire routier introuvable vers cette destination.");
    }

    const distanceKm = round1(routeData.routes[0].distance / 1000);
    const durationMinSimple = round1(routeData.routes[0].duration / 60);
    const durationAR = durationMinSimple * 2;
    
    const pricing = computePrice({ 
      city: client.city, 
      department: client.department, 
      distanceKm,
      durationMinSimple,
      babiesCount,
      antsCount
    });

    res.status(200).json({
      cityLabel: client.city.charAt(0).toUpperCase() + client.city.slice(1),
      distanceKm,
      durationMinSimple,
      durationAR,
      price: pricing.price,
      explanation: pricing.explanation,
      zone: pricing.zone
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
