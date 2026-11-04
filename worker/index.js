const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
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

  const origin = request.headers.get("Origin");
  const requestUrl = new URL(request.url);
  if (origin && origin !== requestUrl.origin) {
    return json({ ok: false, message: "Requête non autorisée." }, 403);
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


    // Normalize cached contact assets so this page never submits to a legacy PHP URL.
    if (env.ASSETS && request.method === "GET" &&
        (url.pathname === "/contact" || url.pathname === "/contact.html")) {
      const asset = await env.ASSETS.fetch(request);
      const html = await asset.text();
      const fixed = html
        .replace(/action=["'][^"']*["']/i,
          'action="https://nature.apopolo9800.workers.dev/api/contact"')
        .replaceAll("js/main.js", "js/main.js?v=20261104-contact-api");
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

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
