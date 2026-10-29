# SOS planète Terre

A responsive, multi-page French environmental-awareness website.

## Pages
- `index.html` — homepage and overview of environmental threats
- `menaces.html` — details about environmental threats
- `solutions.html` — practical actions and solutions
- `a-propos.html` — about the project
- `contact.html` — community signup/contact form

## Images
Local threat illustrations live in `photos/`. They are SVG files and remain crisp at different screen sizes. The existing hero and solution imagery still uses Unsplash image URLs.

## Run the static pages locally
Open `index.html` in a browser, or run a web server from the project root:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Contact form / PHP hosting
The contact form posts to `ajout.php`, so it requires a PHP host with MySQL and the PHP `mysqli` and `mbstring` extensions. **GitHub Pages alone cannot process this form**, because it serves static files and does not execute PHP.

1. Run `database/schema.sql` on the MySQL server.
2. Configure `DB_USER` and `DB_PASS` in the PHP hosting environment. Optionally set `DB_HOST` and `DB_NAME`; the defaults are `127.0.0.1` and `travail`.
3. Do not commit database credentials to Git.

The handler responds with a configuration message if the required database environment settings are missing.
