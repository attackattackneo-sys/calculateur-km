const btn = document.getElementById("btn");
const out = document.getElementById("out");
const addressEl = document.getElementById("address");
const babiesEl = document.getElementById("babies");
const antsEl = document.getElementById("ants");

function setLoading() {
  out.className = "out";
  out.innerHTML = `<div style="color: #666;">Recherche de l'itinéraire en cours...</div>`;
}

function setError(msg) {
  out.className = "out err";
  out.innerHTML = `<strong>Oups !</strong><br>${msg}`;
}

function setResult(data) {
  out.className = "out ok";
  out.innerHTML = `
    <span class="result-text">${data.cityLabel}</span>
    <span class="price-tag">${data.price}${data.price !== "Sur devis" ? " €" : ""}</span>
    <div style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">Distance : ${data.distanceKm} km</div>
    <div style="font-style: italic; font-size: 0.8rem; margin-top: 5px;">${data.explanation}</div>
  `;
}

btn.addEventListener("click", async () => {
  const address = addressEl.value.trim();
  const babiesCount = parseInt(babiesEl.value) || 0;
  const antsCount = parseInt(antsEl.value) || 0;

  if (!address) return setError("Merci de saisir une adresse ou une ville.");

  try {
    setLoading();
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, babiesCount, antsCount })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Adresse introuvable.");
    setResult(data);
  } catch (err) {
    setError(err.message);
  }
});
