# Phase 01–05 architecture audit

The repository currently contains two implementations and is not yet a single production path. The root package (`src/`) is a SQLite Restaurant Brain/admin prototype. `apps/api/` is a separate PostgreSQL/Fastify foundation containing bearer authentication, voice, AI, and partial reservation/order work; `apps/web/` targets its `/api/v1` contract. They do not share a database schema or route contract.

The authoritative production candidate for authentication and telephony is `apps/api`, because it has membership authorization, opaque bearer sessions, structured errors, request IDs, and the Twilio entrypoint. The root SQLite implementation remains a local Restaurant Brain prototype and must not be described as the production Phase 01–05 API until its data model is moved behind the `apps/api` service boundary.

Phase 05 is incomplete: the current `ActionEngine` implements only reservation availability/create/find; confirmation consumption is a stub; order tools are placeholders; and the advertised media WebSocket is not registered. These are explicit gaps, not documentation-only features.

Phase 06 notification files under `src/notifications` were not modified.

Restaurant Brain is structured tenant-owned data and controlled services, not an LLM or prompt store. Fastify routes authenticate a user context, verify membership for the selected restaurant, and only then call scoped queries. Future orchestration uses `RestaurantContextService`, `MenuService`, `BusinessHoursService`, and `SeasonService`; it must not query tables directly.

## Phase 03 voice architecture

Twilio sends signed form-encoded webhooks to `POST /api/v1/telephony/twilio/incoming`. The called E.164 number is resolved through `restaurant_phone_numbers`; caller-supplied restaurant IDs are never accepted. An active restaurant creates one idempotent `Call`, `CallSession`, and event stream. Closed/inactive restaurants receive configured fallback TwiML without creating an AI session.

The Twilio adapter is isolated behind `TelephonyProvider`. `VoiceSessionManager` owns per-call state and composes replaceable `SpeechToTextProvider`, `TextToSpeechProvider`, and `VoiceAIEngine` implementations. The media endpoint is `GET /api/v1/telephony/twilio/media` over WebSocket; media frames are base64 μ-law payloads. New speech aborts the current AI/TTS `AbortController` and clears playback, providing barge-in semantics.

Calls, sessions, and bounded call events are stored separately. Raw conversation history is not stored in a single call column. Provider and AI failures close resources and mark the call failed while the TwiML fallback remains caller-safe. Test mode exposes `/api/v1/telephony/test/sessions/:sessionId/events` with mock STT/TTS/AI providers.

Money is stored as integer cents. Every timestamp-like rule is evaluated in `restaurants.timezone`, never in server-local time. `SeasonService` determines season state and permissions; `BusinessHoursService` combines it with weekday intervals and special closures.

## Single API instance (in-memory call state)

**Rule: run exactly one API process.** The worker may be scaled; the API may not.

### Why

A live call spans several HTTP/WebSocket requests: Twilio's `incoming` webhook creates the
session, the media stream WebSocket carries audio for its whole duration, and `status` callbacks
end it. `VoiceSessionManager` keeps each live session (turn counter, playback, abort controller,
attached media socket, detected language) in a `Map` inside the API process. Nothing about a
live turn is in Postgres or Redis.

With two instances behind a load balancer, the webhook can create the session on instance A while
the WebSocket lands on instance B. B throws `Unknown voice session` for every audio frame and
transcript: the caller hears silence, the order is never taken, and A's session idles until its
timeout. `test/single-instance.test.ts` reproduces this with two managers.

### How it is enforced

1. `docker-compose.prod.yml`: the `api` service has a fixed `container_name`, so
   `docker compose up --scale api=2` fails, and there is no `deploy.replicas`.
2. At startup, before migrations, the API takes a session-level Postgres advisory lock
   (`pg_try_advisory_lock(0x7419, 1)`, `src/database/singleton-lock.ts`) on a dedicated connection
   it keeps for its lifetime. A second instance retries for 45 s (enough for a redeploy's
   30 s stop grace period) and then exits with `SingletonLockError`. If the holder's connection
   drops, Postgres frees the lock and the holder exits (`singleton_lock_lost`) instead of serving
   calls unguarded.

### When this has to change

Move call state out of process memory before any of these happen:

- more than ~100 concurrent calls, or CPU on the single API instance regularly above ~70%;
- a zero-downtime deploy requirement (today a redeploy drops live calls);
- running in more than one region.

The plan: keep per-session state (turn counter, language, playback status, which instance owns
the media socket) in **Redis** (already in the stack for BullMQ), keyed by session id with a TTL
of the max call duration; route the media WebSocket and Twilio callbacks for a session to the
instance that owns its socket (sticky routing by `sessionId`, or Fly's `fly-replay`), and publish
cross-instance events (hang-up, transfer) over Redis pub/sub. Then drop the advisory lock and the
fixed `container_name`.
