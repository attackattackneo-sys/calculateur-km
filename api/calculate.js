const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";

const NEARBY_CITIES = new Set([
  "noisy-le-grand", "chelles", "neuilly-plaisance", "gagny", "le perreux-sur-marne", "gournay-sur-marne"
]);

function round1(n) { return Math.round(n * 10) / 10; }

function computePrice({ city, department, distanceKm }) {
  const cityN = (city || "").trim().toLowerCase();
  
  if (department === "75") return { price: 150, explanation: "Paris (75) : tarif forfaitaire." };
  if (cityN.includes("neuilly-sur-marne")) return { price: 59, explanation: "Neuilly-sur-Marne : tarif local." };
  if (NEARBY_CITIES.has(cityN)) return { price: 79, explanation: "Ville limitrophe : tarif forfaitaire." };

  if (["93", "94", "77"].includes(department)) {
    if (distanceKm <= 7) return { price: 95, explanation: "Département 93/94/77 : forfait standard (≤ 7 km)." };
    let price = 125;
    let explanation = "Département 93/94/77 : forfait majoré (> 7 km).";
    if (distanceKm > 12) {
      const extraKm = distanceKm - 12;
      price += extraKm * 3.8;
      explanation += ` + ${round1(extraKm)} km au-delà de 12 km à 3,8 €/km.`;
    }
    return { price: Math.round(price), explanation };
  }
  return { price: "Sur devis", explanation: "Zone hors périmètre : merci de me contacter." };
}

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1&countrycodes=fr`;
  const r = await fetch(url, { headers: { "User-Agent": "GregPhotographe-App/1.0" } });
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
    const { address } = req.body;
    if (!address) throw new Error("Veuillez saisir une adresse.");

    const [studio, client] = await Promise.all([geocode(STUDIO_ADDRESS), geocode(address)]);
    
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${studio.lon},${studio.lat};${client.lon},${client.lat}?overview=false`;
    const routeRes = await fetch(routeUrl);
    const routeData = await routeRes.json();
    
    if (routeData.code !== "Ok" || !routeData.routes || !routeData.routes[0]) {
      throw new Error("Itinéraire routier introuvable vers cette destination.");
    }

    const distanceKm = round1(routeData.routes[0].distance / 1000);
    const pricing = computePrice({ city: client.city, department: client.department, distanceKm });

    res.status(200).json({
      cityLabel: client.city.charAt(0).toUpperCase() + client.city.slice(1),
      distanceKm,
      price: pricing.price,
      explanation: pricing.explanation
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
