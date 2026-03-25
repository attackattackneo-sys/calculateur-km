const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";

const NEARBY_CITIES = new Set([
  "Noisy-le-Grand",
  "Chelles",
  "Neuilly-Plaisance",
  "Gagny",
  "Le Perreux-sur-Marne",
  "Gournay-sur-Marne"
]);

function round1(n) {
  return Math.round(n * 10) / 10;
}

function computePrice({ city, department, distanceKm }) {
  const cityN = (city || "").trim();

  if (department === "75") {
    return { price: 150, explanation: "Paris (75) : tarif forfaitaire." };
  }

  if (cityN.toLowerCase() === "neuilly-sur-marne") {
    return { price: 59, explanation: "Neuilly-sur-Marne : tarif local." };
  }

  if (NEARBY_CITIES.has(cityN)) {
    return { price: 79, explanation: "Ville limitrophe : tarif forfaitaire." };
  }

  if (["93", "94", "77"].includes(department)) {
    if (distanceKm <= 7) {
      return { price: 95, explanation: "Département 93/94/77 : forfait standard (≤ 7 km)." };
    }

    let price = 125;
    let explanation = "Département 93/94/77 : forfait majoré (> 7 km).";

    if (distanceKm > 12) {
      const extraKm = distanceKm - 12;
      price += extraKm * 3.8;
      explanation += ` + ${round1(extraKm)} km au-delà de 12 km à 3,8 €/km.`;
    }

    return { price: Math.round(price), explanation };
  }

  return { price: null, explanation: "Zone hors périmètre : merci de me contacter." };
}

async function geocodeNominatim(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  // On enlève le pays forcé ici pour laisser l'utilisateur taper ce qu'il veut, 
  // mais on garde la restriction pays dans les paramètres.
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "fr");

  const r = await fetch(url.toString(), {
    headers: { "User-Agent": "greg-photo-calc/1.1" }
  });
  
  if (!r.ok) throw new Error("Erreur service météo/carte");
  
  const j = await r.json();
  if (!Array.isArray(j) || j.length === 0) throw new Error("Adresse introuvable.");

  const item = j[0];
  const a = item.address || {};

  // Priorité aux noms de communes plus large pour Melun et consorts
  const city = a.city || a.town || a.village || a.municipality || a.suburb || a.hamlet || "Ville inconnue";
  const postcode = a.postcode || "";
  const department = postcode.slice(0, 2);

  return {
    lat: Number(item.lat),
    lon: Number(item.lon),
    city,
    department
  };
}

async function routeDistanceOsrmKm(fromLat, fromLon, toLat, toLon) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.code !== "Ok" || !j.routes?.[0]) throw new Error("Itinéraire impossible.");
  return j.routes[0].distance / 1000;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const { address } = req.body || {};
    if (!address) return res.status(400).json({ error: "Saisissez une adresse." });

    // 1. Géocodage du studio et du client en parallèle pour gagner du temps
    const [studio, client] = await Promise.all([
      geocodeNominatim(STUDIO_ADDRESS),
      geocodeNominatim(address)
    ]);

    // 2. Calcul de la distance
    const distRaw = await routeDistanceOsrmKm(studio.lat, studio.lon, client.lat, client.lon);
    const distanceKm = round1(distRaw);

    // 3. Calcul du prix
    const pricing = computePrice({
      city: client.city,
      department: client.department,
      distanceKm
    });

    return res.status(200).json({
      cityLabel: client.city,
      distanceKm,
      price: pricing.price || "Sur devis",
      explanation: pricing.explanation
    });

  } catch (err) {
    // On renvoie le vrai message d'erreur pour aider l'utilisateur
    return res.status(400).json({ error: err.message || "Une erreur est survenue." });
  }
};
