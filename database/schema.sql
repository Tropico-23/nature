-- Cloudflare D1 schema for SOS planète Terre.
-- Safe to run more than once; it does not remove existing signups.
-- The original form table; keep its name and columns for backward compatibility.
CREATE TABLE IF NOT EXISTS "1" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  tele TEXT NOT NULL CHECK (length(tele) = 8),
  adres TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inscriptions_email ON "1"(email);

-- Short-lived hashed IP fingerprints used only to slow automated form abuse.
CREATE TABLE IF NOT EXISTS signup_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_ip_time
  ON signup_rate_limits(ip_hash, created_at);
