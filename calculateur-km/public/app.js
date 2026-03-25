const btn = document.getElementById("btn");
const out = document.getElementById("out");
const addressEl = document.getElementById("address");

function setLoading() {
  out.className = "out";
  out.innerHTML = `<div style="color: #666;">Recherche de l'itinéraire...</div>`;
}

function setError(msg) {
  out.className = "out err"; // Utilise le style d'erreur du CSS
  out.textContent = msg;
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
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });

    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Erreur lors du calcul.");

    setResult(data);
  } catch {
    setError("Service indisponible. Réessaie dans un instant.");
  }
});