# Production deployment runbook

The supported production path is the PostgreSQL API in `apps/api`, the notification worker in the same package, PostgreSQL 16, Redis 7, and the static web build. The root SQLite application is legacy/local compatibility only and is not production-authoritative.

## Required configuration

Copy `.env.example` to `.env` only for local Compose use. Production secrets must be injected by the deployment environment. Required API values include `APP_ENV=production`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SESSION_SECRET`, `CORS_ORIGINS`, `API_URL`, and `APP_URL`. Voice deployments also require `TELEPHONY_MODE=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `VOICE_PUBLIC_URL`. Configure non-mock `STT_PROVIDER` and `TTS_PROVIDER` with their provider keys.

SMS workers additionally require Twilio credentials and the configured sender. Never put these values in the web image or frontend environment.

## Startup order

1. Start PostgreSQL and wait for its health check.
2. Start Redis and wait for its health check.
3. Run migrations once: `docker compose run --rm api node dist/database/migrate.js`.
4. Start the API. Its startup also runs migrations defensively before binding the port.
5. Start the worker. Its startup runs migrations, starts BullMQ, and polls the transactional outbox every five seconds.
6. Start the web container.

For local Compose:

```powershell
Copy-Item .env.example .env
# Set POSTGRES_PASSWORD and production-like local secrets in .env
docker compose up -d postgres redis
docker compose run --rm api node dist/database/migrate.js
docker compose up -d api worker web
```

The API is exposed on port 3000 and the web container on port 8080 by the supplied Compose file.

## Health and readiness

`GET /health` is a liveness check and does not require the database. `GET /ready` checks PostgreSQL and returns HTTP 503 when the API cannot use the database. Compose uses `/ready` for the API health check. Redis health is provided by `redis-cli ping`; PostgreSQL health is provided by `pg_isready`.

## Processes and shutdown

API command: `node dist/server.js`.

Worker command: `node dist/worker.js`.

Both handle SIGTERM/SIGINT. The API closes Fastify and its pool. The worker stops polling, drains/closes BullMQ, closes its queue connection, and closes PostgreSQL. Orchestrators should allow at least 30 seconds of termination grace time.

## Twilio networking

Twilio requires a publicly reachable HTTPS URL. Configure the voice webhook at `/api/v1/telephony/twilio/incoming`, the call status callback at `/api/v1/telephony/twilio/status`, and the WebSocket media stream under the configured `VOICE_STREAM_PATH`. Local testing requires a public HTTPS tunnel or an equivalent deployment. Do not disable signature validation in production.

## Rollback

1. Stop or drain the worker before changing application code.
2. Deploy the previous image tag for API, worker, and web as one compatible release.
3. Run only migrations included in that release; migrations are forward-only and must not be manually deleted.
4. Restart API and worker, then verify `/health`, `/ready`, queue connectivity, and logs.
5. If a migration is incompatible, restore the database backup and deploy the matching previous release. Do not attempt an automatic destructive downgrade.

## Legacy SQLite boundary

The root `src/` application and root `Dockerfile` are retained for local/compatibility use. They use SQLite and `better-sqlite3`, are not part of the PostgreSQL production deployment, and do not receive production traffic in the Compose setup. Use `apps/api` for production migrations, API, voice, orders, reservations, and notifications.

## Limitations

This repository does not include cloud-provider-specific infrastructure, TLS termination, backups, secret management, or external Twilio/Redis/PostgreSQL validation. Those must be supplied by the deployment environment.
