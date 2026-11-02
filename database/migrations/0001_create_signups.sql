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
