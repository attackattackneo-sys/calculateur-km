const btn = document.getElementById("btn");
const out = document.getElementById("out");
const addressEl = document.getElementById("address");

function setLoading() {
  out.className = "out";
  out.innerHTML = `<div style="color: #666;">Recherche de l'itinéraire...</div>`;
}

function setError(msg) {
  out.className = "out err";
  out.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">Oups !</div>
    <div>${msg}</div>
    <div style="margin-top: 10px; font-size: 0.85rem; opacity: 0.8;">
      Conseil : Essaye de préciser le code postal (ex: Melun 77000).
    </div>
  `;
}

function setResult(data) {
  out.className = "out ok";
  // On injecte les classes .result-text et .price-tag définies dans le HTML
  out.innerHTML = `
    <span class="result-text">${data.cityLabel}</span>
    <span class="price-tag">${data.price} €</span>
    <div class="small" style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
      Distance : ${data.distanceKm} km
    </div>
    <div class="small" style="font-style: italic; font-size: 0.8rem; margin-top: 5px;">
      ${data.explanation}
    </div>
  `;
}

btn.addEventListener("click", async () => {
  const address = addressEl.value.trim();
  if (!address) return setError("Merci de saisir une adresse ou une ville.");

  try {
    setLoading();
    
    // On peut essayer de forcer le pays pour aider l'API
    const cleanAddress = address.toLowerCase().includes("france") ? address : `${address}, France`;

    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: cleanAddress })
    });

    const data = await res.json();
    
    if (!res.ok) {
        console.error("Détail de l'erreur API:", data); // Pour t'aider à débugger
        return setError(data?.error || "Adresse introuvable ou itinéraire indisponible.");
    }

    setResult(data);
  } catch (err) {
    console.error("Erreur réseau:", err);
    setError("Service indisponible. Réessaie dans un instant.");
  }
});
