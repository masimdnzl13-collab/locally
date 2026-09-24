# Operations and Recovery

## Health

`GET /health` verifies the process is serving. `GET /ready` performs a database connectivity check and returns HTTP 503 when the API cannot reach PostgreSQL. Keep the request ID from the response header and include it in incident reports.

## PostgreSQL migrations

Run migrations from the API directory with `npm run db:migrate`. Migrations are applied in filename order, recorded in `schema_migrations`, and protected by a PostgreSQL advisory lock so two deploys cannot migrate concurrently. Each migration runs in a transaction. A failed migration is rolled back and its version is not recorded; fix the migration or database condition and rerun it. Do not manually mark a migration applied unless the SQL has been independently verified.

## Backup and restore

Use PostgreSQL-native tooling and store backups outside the application host:

```bash
pg_dump --format=custom --file=backup.dump "$DATABASE_URL"
createdb restore_check
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" backup.dump
```

Before a production restore, stop writers, record the incident time, restore into a separate database first, verify row counts and application readiness, then switch the connection string and restart the API/worker. Never commit dumps, credentials, tokens, recordings, or customer message bodies to the repository.

## Redis/BullMQ recovery

The outbox is the source of recovery. BullMQ jobs use stable event IDs, bounded attempts, and exponential backoff. If Redis is unavailable, the enqueue step marks the event `FAILED` with a reason; once Redis is healthy, rerun the worker/outbox polling process and pending/failed events are eligible again. Inspect `outbox_events.status`, `attempts`, `failure_reason`, and BullMQ failed jobs.

## Notification recovery

Provider failures are persisted on `messages` and `notifications`, while the outbox remains retryable. Twilio status callbacks update provider status, error code, and error message by provider message ID. Check `/api/v1/restaurants/:id/notifications` after recovery. Do not replay an event manually until checking its idempotency key.

## Shutdown and logging

SIGINT/SIGTERM close the Fastify server and database pool. Logs are structured JSON and include event names and request/correlation IDs. Secrets, authorization tokens, recordings, and sensitive customer payloads must not be logged. Twilio failures are logged with tenant/event/notification identifiers and the provider error text, never credentials.
