# Restaurant AI Receptionist

A tenant-isolated Fastify + PostgreSQL API (`apps/api`) with a React web dashboard
(`apps/web`) for managing a restaurant's "brain" (hours, menu, FAQs, settings) and
SMS notifications. Authentication is email/password (JWT).

> The `src/` folder at the repo root is an old, superseded prototype (SQLite,
> header-based auth, no login). It is not used by `apps/web` and can be ignored;
> the real system lives entirely under `apps/api` and `apps/web`.

## Run locally (Docker for Postgres/Redis)

```powershell
docker compose up -d postgres redis
cd apps/api
npm install
npm run db:migrate
npm run dev        # http://localhost:3000
```

In a second terminal:

```powershell
cd apps/web
npm install
npm run dev         # http://localhost:5173
```

Open `http://localhost:5173`, click **Need an account? Register**, and create a
user (password must be at least 12 characters). After registering you'll land on
`/app` with no restaurant yet — use the **Create a restaurant** form shown there
to create one; you become its OWNER automatically.

## Run locally without Docker

If you don't want to use Docker, install PostgreSQL and Redis natively and point
`DATABASE_URL` / `REDIS_URL` in `.env` at them, then follow the same steps above
(`npm run db:migrate`, `npm run dev` in `apps/api`, `npm run dev` in `apps/web`).

## Full stack via Docker Compose

```powershell
docker compose up -d --build
```

This builds and runs Postgres, Redis, the API (`:3000`), a background worker,
and the web app served via nginx (`:8080`). Migrations run automatically on API
startup.

For production (restart policies, health checks, secrets from the platform
instead of `.env`, TLS) see [DEPLOYMENT.md](DEPLOYMENT.md) and
`docker-compose.prod.yml`.

## Quality checks

Run inside `apps/api` and `apps/web` respectively:

```powershell
npm test
npm run lint
npm run build
```

## Voice calls

The API process (`npm run dev` / `node dist/server.js`) serves the voice routes
alongside the dashboard API:

| Route | Purpose |
|---|---|
| `POST /api/v1/telephony/twilio/incoming` | Twilio voice webhook (returns `<Connect><Stream>` TwiML) |
| `GET /api/v1/telephony/twilio/media` | Twilio bidirectional Media Stream (WebSocket) |
| `POST /api/v1/telephony/twilio/status` | Twilio call status callback |
| `POST /api/v1/notifications/twilio/status` | Twilio SMS status callback |
| `POST /api/v1/telephony/test/sessions/:sessionId/events` | Transcript injection (only when `TELEPHONY_MODE=test`) |

Each caller utterance flows: Twilio μ-law audio → STT (Deepgram) →
`AIOrchestrator` (Claude: intent, Restaurant Brain, tools) → TTS (Deepgram Aura or
ElevenLabs) → back to the caller. Speaking over the assistant interrupts it.
Reservations and orders are two-step: the assistant prepares a proposal, reads it
back, and only books it after the caller says yes.

### Making a real call

1. In `.env` set:
   ```
   TELEPHONY_MODE=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_VALIDATE_SIGNATURES=true
   VOICE_PUBLIC_URL=https://<your-tunnel>.ngrok.app
   STT_PROVIDER=deepgram
   STT_API_KEY=<deepgram key>
   TTS_PROVIDER=deepgram          # or elevenlabs
   TTS_API_KEY=<deepgram or elevenlabs key>
   AI_PROVIDER=anthropic
   AI_API_KEY=<anthropic key>
   ```
2. Expose the API: `ngrok http 3000` (WebSockets are supported) and use that
   HTTPS URL as `VOICE_PUBLIC_URL`.
3. In the Twilio console, set the number's **A call comes in** webhook to
   `https://<tunnel>/api/v1/telephony/twilio/incoming` (HTTP POST) and the status
   callback to `https://<tunnel>/api/v1/telephony/twilio/status`.
4. Map the number to a restaurant (one active restaurant per number):
   ```sql
   INSERT INTO restaurant_phone_numbers(id, restaurant_id, phone_number, active)
   VALUES (gen_random_uuid(), '<restaurant id>', '+1XXXXXXXXXX', true);
   ```
   The restaurant needs a Restaurant Brain (hours, menu) configured in the
   dashboard, `reservation_settings` for reservations, and `order_settings` for
   orders.
5. Call the number. Calls, reservations and orders appear in the dashboard.

Keep `TELEPHONY_MODE=test` for cost-free local simulation. Never disable
signature validation in production (startup refuses it).

## Monitoring and cost alerts

Both features send admin alerts through one channel: a Slack-compatible incoming
webhook (`ALERT_WEBHOOK_URL`), otherwise a plain email via Resend
(`RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM`), otherwise a log line.

- **Telephony health (API process).** 5xx responses on the Twilio voice routes
  (incoming, status) and media-WebSocket failures are counted in memory. More than
  `TELEPHONY_ALERT_MAX_ERRORS` (3) inside `TELEPHONY_ALERT_WINDOW_SECONDS` (300)
  sends one "Tideline telephony hata veriyor" alert, then stays quiet for
  `TELEPHONY_ALERT_COOLDOWN_SECONDS` (900). A crashed process cannot alert about
  itself, so also point an external uptime check at `/ready`.
- **Cost guard (worker process, hourly).** Month-to-date cost per restaurant =
  Claude tokens from `ai_usage` (list prices per model, or `estimated_cost` when
  set) + billed call minutes × (`COST_TWILIO_PER_MINUTE` + `COST_STT_PER_MINUTE` +
  `COST_TTS_PER_MINUTE`). Above `SUBSCRIPTION_PRICE_USD` (199) ×
  `COST_ALERT_THRESHOLD_RATIO` (0.6) the admin is alerted once per restaurant per
  month (`cost_alerts` table). Nothing is ever cut off; new automatic actions plug
  in as a `CostThresholdAction` (see `src/services/cost-service.ts`).
- **Service endpoints for Locally.** `GET /api/v1/internal/restaurants/activity?ids=…`
  (7-day calls/orders/reservations + month cost) and `GET /api/v1/internal/costs?period=day|month`
  accept a 60 s HS256 token signed with `JWT_SECRET` (`iss=locally`,
  `aud=tideline-service`) in the `X-Service-Token` header.
