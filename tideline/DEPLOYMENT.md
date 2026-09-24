# Deploying Tideline to production

The hosting platform has not been chosen yet. This document lays out two
realistic options, **Fly.io** and **a VPS running Docker Compose**, step by
step, and compares them on domains, TLS, scaling and day-to-day operations. It
does not make the decision. Render and Railway are noted briefly at the end.

## What Tideline needs from any host

| Piece | Notes |
|---|---|
| `api` | Fastify on `:3000`. Serves the dashboard API, the Twilio webhooks and the **Twilio media WebSocket**. Runs DB migrations at startup. Health: `GET /ready` (checks Postgres). |
| `worker` | Same image, `node dist/worker.js`. SMS outbox (BullMQ) + hourly cost guard. No HTTP port. |
| `web` | Static React build served by nginx. `VITE_API_URL` is **baked in at build time**. |
| Postgres 16 | Row-level security is used; any managed Postgres 16 works. |
| Redis 7 | BullMQ queue for SMS. |
| Public HTTPS + WSS | Twilio calls `https://API_DOMAIN/api/v1/telephony/twilio/incoming` and streams audio over `wss://API_DOMAIN/api/v1/telephony/twilio/media`. Calls can last up to 30 minutes (`VOICE_MAX_CALL_DURATION_SECONDS`), so the host must not cut idle or long WebSockets. |

### The constraint that matters most for scaling

Live call state is held **in the API process's memory** (`VoiceSessionManager`
keeps a `Map` of active sessions). The incoming-call webhook creates the session
and the media WebSocket that follows must reach **the same process**. So:

- **Run exactly one API instance.** Scale it vertically (more CPU/RAM). Adding
  a second instance behind a plain load balancer breaks calls whenever the
  webhook and the WebSocket land on different instances.
- The worker has no such constraint and can run more than one copy.
- Every API restart or deploy **drops the calls that are in progress**. Deploy
  outside restaurant hours. `stop_grace_period` / `kill_timeout` only gives
  in-flight requests time to finish; it does not keep a 10-minute call alive.

Running more than one API instance means moving call state into Redis, or
routing each call to its instance (for example with Fly's `fly-replay`). That
work is separate from choosing a host.

### Secrets and settings (both options)

Required: `DATABASE_URL`, `JWT_SECRET` (**must equal Locally's
`TIDELINE_JWT_SECRET`**), `SESSION_SECRET`, `CORS_ORIGINS`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `STT_API_KEY`, `TTS_API_KEY`,
`AI_API_KEY`, and the two domains (`APP_DOMAIN`, `API_DOMAIN`), which become
`APP_URL`, `API_URL` and `VOICE_PUBLIC_URL`.

Recommended: `ALLOWED_FRAME_ANCESTORS` (Locally's origin, so the dashboard can be
embedded in the Locally panel), plus `ALERT_WEBHOOK_URL`, or `RESEND_API_KEY` +
`ALERT_EMAIL_TO` + `ALERT_EMAIL_FROM`, so telephony and cost alerts reach you.

In production the API refuses to start with mock providers, `localhost` CORS
origins, placeholder secrets or unsigned Twilio webhooks (see
`apps/api/src/config/env.ts`). A misconfigured deploy fails at startup instead of
running half-working.

Generate the secrets with `openssl rand -base64 48`.

---

## Option A: Fly.io

Fly runs the Docker images as Firecracker VMs ("Machines"). It handles TLS and
the edge proxy, and WebSockets work out of the box.

### Steps

1. **Install and log in:** `fly auth login`.
2. **Create the apps.** Use one app for api + worker and one for web:
   ```sh
   fly apps create tideline-api
   fly apps create tideline-web
   ```
3. **Database and Redis:**
   - Postgres: `fly mpg create` (Fly Managed Postgres), or any external
     provider (Neon, Supabase, Crunchy). Put the connection string in
     `DATABASE_URL`.
   - Redis: `fly redis create` (Upstash). Put the URL in `REDIS_URL`.
   - Pick the region closest to the restaurants and to Twilio's media edge.
     For the US East Coast that is `iad` or `ewr`.
4. **Configure the API app** with `apps/api/fly.toml`:
   ```toml
   app = "tideline-api"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [processes]
     app = "node dist/server.js"
     worker = "node dist/worker.js"

   [http_service]
     processes = ["app"]
     internal_port = 3000
     force_https = true
     auto_stop_machines = "off"    # a stopped machine means a missed call
     auto_start_machines = false
     min_machines_running = 1

     [[http_service.checks]]
       method = "GET"
       path = "/ready"
       interval = "15s"
       timeout = "5s"
       grace_period = "40s"

   kill_timeout = 30
   ```
   Keep the `app` process at **one machine** (`fly scale count app=1 worker=1`).
5. **Set secrets.** Fly stores them encrypted and injects them as environment
   variables:
   ```sh
   fly secrets set -a tideline-api APP_ENV=production TELEPHONY_MODE=twilio \
     AI_PROVIDER=anthropic STT_PROVIDER=deepgram TTS_PROVIDER=deepgram \
     DATABASE_URL=... REDIS_URL=... JWT_SECRET=... SESSION_SECRET=... \
     APP_URL=https://app.example.com API_URL=https://api.example.com \
     VOICE_PUBLIC_URL=https://api.example.com CORS_ORIGINS=https://app.example.com,https://locally.example.com \
     TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=... \
     STT_API_KEY=... TTS_API_KEY=... AI_API_KEY=... ALERT_WEBHOOK_URL=...
   ```
6. **Deploy:** `fly deploy` from `apps/api`. For the web app (`apps/web`):
   `fly deploy --build-arg VITE_API_URL=https://api.example.com`, with
   `ALLOWED_FRAME_ANCESTORS` set as a secret or env on `tideline-web`.
7. **Custom domains and TLS:**
   ```sh
   fly certs add api.example.com -a tideline-api
   fly certs add app.example.com -a tideline-web
   ```
   Then create the DNS records Fly prints (A/AAAA to the app's IPs, or a
   CNAME to `<app>.fly.dev`). Fly issues and renews Let's Encrypt certificates
   automatically. `fly certs show` reports when they are ready.

### Scaling on Fly

- Vertical: `fly scale vm shared-cpu-2x --memory 1024 -a tideline-api` (a restart, so calls drop).
- Worker: `fly scale count worker=2`.
- API: stays at one machine until call state is shared (see above). Fly's
  `fly-replay` header is one way to route a call's WebSocket back to the
  webhook's machine later on.

---

## Option B: VPS + Docker Compose

One Linux server (Hetzner, DigitalOcean, Vultr, Lightsail…) runs
`docker-compose.prod.yml`. That file includes Postgres, Redis, api, worker, web
and **Caddy**, which terminates TLS and gets certificates automatically.

### Steps

1. **Create the server** in a US East region (Ashburn, New York, Virginia).
   2 vCPU / 4 GB is a comfortable start. Use Ubuntu 24.04 LTS.
2. **Harden it:** SSH keys only, `ufw allow 22,80,443/tcp` and `443/udp`,
   `unattended-upgrades` for security patches.
3. **Install Docker Engine + the compose plugin** (docs.docker.com/engine/install/ubuntu).
4. **Point DNS at the server:** `A` (and `AAAA` if you have IPv6) records for
   `api.example.com` and `app.example.com` → the server IP.
5. **Get the code:** `git clone` the repo onto the server and `cd tideline`.
6. **Provide secrets without a `.env` file.** `docker-compose.prod.yml` reads
   every `${VAR}` from the environment of the `docker compose` command. Choose
   one of:
   - a secret manager CLI: `doppler run -- docker compose -f docker-compose.prod.yml up -d --build`,
     or `op run --env-file prod.env.tpl -- …` (1Password; the template holds
     only `op://` references, never values);
   - CI/CD (for example a GitHub Actions deploy job over SSH) exporting
     repository secrets as environment variables for that one command.

   Required variables missing? Compose stops with `VAR is required` and starts
   nothing. For the bundled database, set `POSTGRES_PASSWORD` and
   `DATABASE_URL=postgresql://restaurant_ai:<password>@postgres:5432/restaurant_ai`
   (URL-encode special characters in the password). `ACME_EMAIL` is the
   Let's Encrypt contact address.
7. **Start it:**
   ```sh
   doppler run -- docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml ps   # every service "healthy"
   ```
   Caddy requests certificates on first start. This only works once DNS
   already points at the server.
8. **Backups (your job on a VPS):** a nightly `pg_dump` from the `postgres`
   container to off-site storage (S3, Backblaze B2), plus a tested restore.
   Or skip the bundled database and use a managed Postgres, then delete the
   `postgres` service from the prod file.

### Scaling on a VPS

- Vertical: resize the server (a few minutes of downtime, calls drop).
- Worker: `docker compose -f docker-compose.prod.yml up -d --scale worker=2`.
- API: one container, for the same reason as on Fly. Growing past one
  server means a managed database, a load balancer and shared call state:
  at that point the work is closer to a platform migration.

---

## Side by side

| | Fly.io | VPS + Docker Compose |
|---|---|---|
| **First deploy** | ~1 hour: `fly.toml`, secrets, `fly deploy` | ~2–3 hours: server hardening, Docker, DNS, compose |
| **Domain** | `fly certs add` + the DNS records it prints | Two `A` records to the server IP |
| **TLS certificates** | Automatic at Fly's edge, renewals handled | Automatic via Caddy (Let's Encrypt) in the stack; ports 80/443 must stay open |
| **Secrets** | Built in: `fly secrets set`, encrypted, injected at boot | Bring your own: Doppler / 1Password / CI secrets; compose refuses to start with missing ones |
| **Twilio WebSocket** | Supported; keep `auto_stop_machines = "off"` | Supported by Caddy with no extra config |
| **Database** | Managed (Fly MPG or external): backups and failover included | Bundled container: backups, upgrades and disk are yours. A managed DB is optional. |
| **Vertical scaling** | One command | Resize the VPS |
| **Horizontal scaling** | Easy for the worker. API needs shared call state first (both options). | Same limit, and a second server is a much bigger step |
| **Deploys** | `fly deploy` (image build + restart) | `git pull && … up -d --build` on the server, or a CI job |
| **Observability** | `fly logs`, metrics dashboard, health checks in the UI | `docker compose logs`, rotated JSON logs. Add an uptime check yourself. |
| **Ops burden** | Low: no OS to patch | Higher: OS updates, firewall, disk space, backups |
| **Cost shape** | Pay per machine + managed DB/Redis; grows in small steps | Flat monthly server price; cheapest at small scale |
| **Lock-in** | `fly.toml` + Fly-specific commands | Plain Docker; moves to any host |

### Questions that decide it

1. Who handles the database at 2 a.m.? If nobody, prefer managed Postgres,
   on either option.
2. How much time goes into server upkeep each month? Near zero favors Fly; a
   little favors a VPS.
3. Is the lowest fixed monthly cost during the pilot the priority? That favors
   a VPS.
4. Will there be more than one API instance soon? Either way that first
   requires the shared-call-state work above.

### Other platforms, briefly

- **Render:** Docker web service + background worker + managed Postgres/Redis,
  automatic TLS, WebSockets supported. Similar trade-offs to Fly with a more
  dashboard-driven workflow; keep the web service at one instance.
- **Railway:** similar model (services from Dockerfiles, managed plugins,
  automatic domains/TLS). Check its connection-duration limits against
  30-minute calls before choosing it.

---

## After any deploy

1. `curl https://API_DOMAIN/ready` → `{"status":"ready"}`.
2. In the Twilio console, set the phone number's **Voice webhook** to
   `https://API_DOMAIN/api/v1/telephony/twilio/incoming` (POST) and the
   **status callback** to `https://API_DOMAIN/api/v1/telephony/twilio/status`.
3. In Locally's environment, set `TIDELINE_API_URL=https://API_DOMAIN`,
   `TIDELINE_WEB_URL=https://APP_DOMAIN` and `TIDELINE_JWT_SECRET` (same value
   as Tideline's `JWT_SECRET`).
4. Add an external uptime monitor on `https://API_DOMAIN/ready`. The built-in
   telephony alert cannot fire if the whole process is down.
5. Place a test call and watch `docker compose logs -f api` or `fly logs`.
