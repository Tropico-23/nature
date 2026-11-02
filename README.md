# SOS planète Terre

A responsive, multi-page French environmental-awareness website hosted by the Cloudflare Worker named `nature`.

## Pages
- `index.html` — homepage and overview of environmental threats
- `menaces.html` — details about environmental threats
- `solutions.html` — practical actions and solutions
- `a-propos.html` — about the project
- `contact.html` — community signup form

## Images
Local threat illustrations live in `photos/`. The remaining landscape photographs are loaded from Unsplash.

## Contact form architecture
The form posts to `/api/contact` on the same origin. The Cloudflare Worker in `worker/index.js` validates submissions and writes them to the Cloudflare D1 database `nature`. There is no PHP/MySQL dependency.

- D1 binding: `DB`
- Existing signup table: `"1"` (kept for compatibility with the original database schema)
- API health check: `GET /api/health`
- Form endpoint: `POST /api/contact`

The Worker uses prepared statements, server-side validation, duplicate-email handling, a hidden honeypot field, same-origin checks, and a short-window abuse limit using temporary SHA-256 IP fingerprints. The fingerprints are cleaned up after 24 hours.

## Deploy
Install Wrangler and authenticate with Cloudflare, then run:

```sh
npx wrangler deploy --config wrangler.jsonc
```

The Wrangler config retains the site root as the static asset directory and sends only `/api/*` requests through the Worker first. The D1 migrations in `database/migrations/` create the signup and anti-abuse tables without dropping existing data.

## Local preview
```sh
npx wrangler dev --config wrangler.jsonc
```

Do not put API tokens or other secrets in this repository.
