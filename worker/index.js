const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Accept",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function clean(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, message: "Méthode non autorisée." }, 405);
  }

  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 16_384) {
    return json({ ok: false, message: "Le formulaire est trop volumineux." }, 413);
  }

  if (!env.DB) {
    console.error("Missing D1 binding: DB");
    return json({ ok: false, message: "Le service est momentanément indisponible." }, 503);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: "Données de formulaire invalides." }, 400);
  }

  // Honeypot: bots often fill every field. Return a harmless success response.
  if (clean(form.get("website"), 200)) {
    return json({ ok: true, message: "Merci, votre demande a bien été reçue." }, 201);
  }

  const nom = clean(form.get("nom"), 100);
  const prenom = clean(form.get("prenom"), 100);
  const email = clean(form.get("email"), 254).toLowerCase();
  const tele = clean(form.get("tele"), 8);
  const adresse = clean(form.get("adresse"), 255);

  if (nom.length < 2 || prenom.length < 2 || adresse.length < 5) {
    return json({
      ok: false,
      message: "Vérifiez votre nom, votre prénom et votre adresse.",
    }, 422);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, message: "Adresse e-mail invalide." }, 422);
  }

  if (!/^[29][0-9]{7}$/.test(tele)) {
    return json({
      ok: false,
      message: "Le numéro doit compter 8 chiffres et commencer par 2 ou 9.",
    }, 422);
  }

  try {
    // Keep only a short-lived, one-way IP fingerprint for basic abuse control.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = await sha256(ip);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 600;

    await env.DB.prepare(
      "DELETE FROM signup_rate_limits WHERE created_at < ?"
    ).bind(now - 86_400).run();

    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS attempts FROM signup_rate_limits WHERE ip_hash = ? AND created_at > ?"
    ).bind(ipHash, windowStart).first();

    if ((recent?.attempts || 0) >= 5) {
      return json({
        ok: false,
        message: "Trop de tentatives. Réessayez dans quelques minutes.",
      }, 429);
    }

    await env.DB.prepare(
      "INSERT INTO signup_rate_limits (ip_hash, created_at) VALUES (?, ?)"
    ).bind(ipHash, now).run();

    // The existing D1 table is retained for compatibility with the original schema.
    await env.DB.prepare(
      'INSERT INTO "1" (nom, prenom, email, tele, adres) VALUES (?, ?, ?, ?, ?)'
    ).bind(nom, prenom, email, tele, adresse).run();

    return json({
      ok: true,
      message: "Merci, vous faites maintenant partie de la communauté.",
    }, 201);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("UNIQUE constraint failed")) {
      return json({
        ok: false,
        message: "Cette adresse e-mail est déjà enregistrée.",
      }, 409);
    }
    console.error("Contact submission failed:", message);
    return json({
      ok: false,
      message: "Une erreur est survenue. Réessayez plus tard.",
    }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);


    // Serve a self-contained contact page so stale browser-cached assets cannot interfere.
    if (request.method === "GET" &&
        ["/contact", "/contact.html", "/contact-live-fix-2"].includes(url.pathname)) {
      const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contact | SOS planète Terre</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:28px 16px;background:#f3f5ef;color:#17372b;font:16px system-ui,sans-serif}
main{max-width:620px;margin:30px auto;background:white;padding:28px;border-radius:18px;box-shadow:0 12px 40px #17372b12}
h1{margin-top:0;font-size:30px}p{line-height:1.5;color:#52645a}
label{display:block;font-weight:600;margin:16px 0 6px}input{width:100%;padding:13px;border:1px solid #cbd5ca;border-radius:9px;font:inherit}
button{margin-top:22px;width:100%;padding:14px;border:0;border-radius:9px;background:#214d3a;color:white;font:600 16px system-ui}
button:disabled{opacity:.6}#status{margin-top:16px;font-weight:600;overflow-wrap:anywhere}
</style></head>
<body><main><h1>Agir maintenant</h1>
<p>Laissez vos coordonnées pour rejoindre la communauté SOS planète Terre.</p>
<form id="contact-form" action="/api/contact" method="post">
<label for="nom">Nom</label><input id="nom" name="nom" minlength="2" required>
<label for="prenom">Prénom</label><input id="prenom" name="prenom" minlength="2" required>
<label for="email">Adresse e-mail</label><input id="email" name="email" type="email" required>
<label for="tele">Téléphone (8 chiffres)</label><input id="tele" name="tele" inputmode="numeric" pattern="[29][0-9]{7}" maxlength="8" required>
<label for="adresse">Adresse</label><input id="adresse" name="adresse" minlength="5" required>
<div hidden><label for="website">Ne pas remplir</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
<button id="submit" type="submit">Rejoindre la communauté</button>
<p id="status" role="status" aria-live="polite"></p>
</form></main>
<script>
document.getElementById("contact-form").addEventListener("submit",async function(e){
 e.preventDefault();
 const form=e.currentTarget,button=document.getElementById("submit"),status=document.getElementById("status");
 button.disabled=true;status.textContent="Envoi en cours…";
 try{
  const response=await fetch("/api/contact",{method:"POST",body:new FormData(form),headers:{Accept:"application/json"},cache:"no-store"});
  const raw=await response.text();let data;
  try{data=JSON.parse(raw)}catch{throw new Error("Réponse serveur invalide (HTTP "+response.status+"): "+raw.slice(0,180))}
  status.textContent=(data.ok?"✓ ":"✕ ")+(data.message||("Erreur HTTP "+response.status));
  status.style.color=data.ok?"#176b3a":"#a12626";
  if(data.ok)form.reset();
 }catch(err){status.textContent="Échec de connexion : "+err.message;status.style.color="#a12626";console.error(err)}
 finally{button.disabled=false}
});
</script></body></html>`;
      return new Response(html, { status: 200, headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "pragma": "no-cache",
        "x-content-type-options": "nosniff"
      }});
    }

    // Normalize cached contact assets so this page never submits to a legacy PHP URL.
    if (env.ASSETS && request.method === "GET" &&
        (url.pathname === "/contact" || url.pathname === "/contact.html")) {
      const asset = await env.ASSETS.fetch(request);
      const html = await asset.text();
      const fixed = html
        .replace(/action=["'][^"']*["']/i,
          'action="https://nature.apopolo9800.workers.dev/api/contact"')
        .replace(/js\/main\.js(?:\?[^"']*)?/g, "/js/main.js?v=20261104-contact-fix");
      const headers = new Headers(asset.headers);
      headers.set("cache-control", "no-store, max-age=0");
      headers.delete("content-length");
      return new Response(fixed, { status: asset.status, statusText: asset.statusText, headers });
    }

    if (env.ASSETS && request.method === "GET" && url.pathname === "/js/main.js") {
      const asset = await env.ASSETS.fetch(request);
      const script = (await asset.text())
        .replaceAll("/ajout.php", "/api/contact")
        .replaceAll("ajout.php", "/api/contact");
      const headers = new Headers(asset.headers);
      headers.set("cache-control", "no-store, max-age=0");
      headers.delete("content-length");
      return new Response(script, { status: asset.status, statusText: asset.statusText, headers });
    }

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return json({ ok: false, message: "Méthode non autorisée." }, 405);
      }
      try {
        await env.DB.prepare("SELECT 1 AS connected").first();
        return json({ ok: true, database: "connected" });
      } catch (error) {
        console.error("D1 health check failed:", error);
        return json({ ok: false, database: "unavailable" }, 503);
      }
    }

    // Keep the legacy PHP-looking URL working for already-cached pages.
    // It is handled here by the Worker; no PHP runtime or PHP file is involved.
    if (url.pathname === "/api/contact" || url.pathname === "/ajout.php") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
      }
      return handleContact(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
