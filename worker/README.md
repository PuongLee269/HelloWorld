# Mori Quest AI Worker

This Worker keeps the AI provider key and login password off GitHub Pages, checks Turnstile for login and AI generation, signs short-lived sessions, accepts only the Mori Quest plan request shape, and does not write request bodies to logs or a database.

## Provisioning

1. In Cloudflare, create a Turnstile widget for `puonglee269.github.io`. Copy its site key into `TURNSTILE_SITE_KEY` in `wrangler.toml`.
2. Create an OpenAI API key in an API project. Do not put it in this repository or in the static app.
3. From this directory, authenticate Wrangler and set the secrets. Enter the login password only at the secure Wrangler prompt; it is never committed to the repository.

   ```sh
   npx wrangler login
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put MORI_LOGIN_PASSWORD
   npx wrangler secret put SESSION_SIGNING_KEY
   npx wrangler deploy
   ```

   Use a fresh random value of at least 32 characters for `SESSION_SIGNING_KEY`. The signed login session expires after 12 hours; replacing this signing key revokes current sessions.

4. In Mori Quest, open **Cài đặt → AI Quest**, enter the deployed Worker URL, and save it on the device.
5. Set spending limits/alerts for the OpenAI API project and a Cloudflare rate limit for `/api/login` and `/api/quest-plan`; review Worker usage. Turnstile reduces automated misuse, but this shared-password gate is not strong identity or private hosting. The GitHub Pages files remain public and a visitor can inspect or bypass client-side UI checks.

The app asks the user to select the data categories to send, all unchecked initially. It sends only the selected allowlisted fields plus any answers to follow-up questions. The browser previews a plan and requires a separate click before importing it. The backend sends `store: false` to Chat Completions and does not persist the prompt or result. The AI provider may still process or retain API traffic under its applicable data policies; do not send information you do not want to share with that provider.

The site key is public. `OPENAI_API_KEY`, `TURNSTILE_SECRET_KEY`, `MORI_LOGIN_PASSWORD`, and `SESSION_SIGNING_KEY` must remain Worker secrets. Changing `SESSION_SIGNING_KEY` invalidates every active session. The endpoint permits browser requests only from the GitHub Pages origin configured in `src/index.js`; CORS alone is not authentication.