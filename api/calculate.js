const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";

// A REMPLACER par ta liste finale
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

function normalizeCity(s) {
  return (s || "").trim();
}

function computePrice({ city, department, distanceKm }) {
  const cityN = (city || "").trim().toLowerCase();
  
  if (cityN.includes("neuilly-sur-marne")) return { price: 59, explanation: "Zone 1 : Neuilly-sur-Marne." };
  if (NEARBY_CITIES.has(cityN)) return { price: 79, explanation: "Zone 1 : Ville limitrophe." };
  if (department === "75") return { price: 150, explanation: "Zone 4 : Paris (75) intra-muros." };

  if (["93", "94", "77"].includes(department)) {
    if (distanceKm <= 7) return { price: 95, explanation: "Zone 2 : Dpt 93/94/77 (≤ 7 km)." };
    
    let price = 125;
    let explanation = "Zone 3 : Déplacement étendu (> 7 km).";
    if (distanceKm > 12) {
      const extraKm = distanceKm - 12;
      price += extraKm * 3.8;
      explanation += ` (+ ${round1(extraKm)} km à 3,80 €/km).`;
    }
    return { price: Math.round(price), explanation };
  }
  return { price: "Sur devis", explanation: "Hors zone : merci de me contacter." };
}

async function geocodeNominatim(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${address}, France`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "fr");

  const r = await fetch(url.toString(), {
    headers: { "User-Agent": "km-calculator/1.0 (contact: you@example.com)" }
  });
  const j = await r.json();
  if (!Array.isArray(j) || !j[0]) throw new Error("Geocode failed");

  const item = j[0];
  const a = item.address || {};

  const city =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.county ||
    "";

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
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}`);
  url.searchParams.set("overview", "false");

  const r = await fetch(url.toString());
  const j = await r.json();
  if (j.code !== "Ok" || !j.routes?.[0]) throw new Error("Route failed");

  const meters = j.routes[0].distance;
  return meters / 1000;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { address } = req.body || {};
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Adresse invalide." });
    }

    const studio = await geocodeNominatim(STUDIO_ADDRESS);
    const client = await geocodeNominatim(address);

    const distanceKmRaw = await routeDistanceOsrmKm(studio.lat, studio.lon, client.lat, client.lon);
    const distanceKm = round1(distanceKmRaw);

    const pricing = computePrice({
      city: client.city,
      department: client.department,
      distanceKm
    });

    if (pricing.price === null) {
      return res.status(200).json({
        cityLabel: client.city || "Adresse",
        distanceKm,
        price: "Sur devis",
        explanation: pricing.explanation
      });
    }

    return res.status(200).json({
      cityLabel: client.city || "Adresse",
      distanceKm,
      price: pricing.price,
      explanation: pricing.explanation
    });
  } catch {
    return res.status(400).json({ error: "Adresse introuvable ou itinéraire indisponible." });
  }
};
