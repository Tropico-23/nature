-- Short-lived hashed IP fingerprints used only to slow automated form abuse.
CREATE TABLE IF NOT EXISTS signup_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_ip_time
  ON signup_rate_limits(ip_hash, created_at);
