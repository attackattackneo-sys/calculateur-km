const STUDIO_ADDRESS = "16 boulevard Carnot, 93330 Neuilly-sur-Marne, France";

const NEARBY_CITIES = new Set([
  "noisy-le-grand", "chelles", "neuilly-plaisance", "gagny", "le perreux-sur-marne", "gournay-sur-marne"
]);

function round1(n) { return Math.round(n * 10) / 10; }

function computePrice({ city, department, distanceKm, babiesCount, antsCount }) {
  const cityN = (city || "").trim().toLowerCase();
  let basePrice = null;
  let explanation = "";
  
  if (cityN.includes("neuilly-sur-marne")) {
    basePrice = 59; explanation = "Zone 1 : Neuilly-sur-Marne.";
  } else if (NEARBY_CITIES.has(cityN)) {
    basePrice = 79; explanation = "Zone 1 : Ville limitrophe.";
  } else if (department === "75") {
    basePrice = 150; explanation = "Zone 4 : Paris (75) intra-muros.";
  } else if (["93", "94", "77"].includes(department)) {
    if (distanceKm <= 7) {
      basePrice = 95; explanation = "Zone 2 : Dpt 93/94/77 (≤ 7 km).";
    } else {
      basePrice = 125;
      explanation = "Zone 3 : Déplacement étendu (> 7 km).";
      if (distanceKm > 12) {
        const extraKm = distanceKm - 12;
        basePrice += extraKm * 3.8;
        explanation += ` (+ ${round1(extraKm)} km à 3,80 €/km).`;
      }
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

  return { price: finalPrice, explanation };
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
    const pricing = computePrice({ 
      city: client.city, 
      department: client.department, 
      distanceKm,
      babiesCount,
      antsCount
    });

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
