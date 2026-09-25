# Voice load test (concurrent calls)

Goal: know, before a busy WAT weekend evening, whether the API survives several restaurants
getting calls at the same time — and where it breaks.

## How to run

```sh
cd tideline/apps/api
npm run load:voice                                   # 10, 20, 50 concurrent calls, 30 s each
npm run load:voice -- --calls 10,20,50,100,200,500 --duration 30 --restaurants 20
```

`load/voice-load.ts` starts `load/voice-load-server.ts` in a separate process and, per level,
places N calls within ~0.5 s the way Twilio does: `POST /incoming` → media WebSocket → `start` →
one 160-byte μ-law frame every 20 ms per call → `stop`. Calls are spread over `--restaurants`
numbers. Prints JSON (per level: failures, turn latency, webhook latency, server CPU / memory /
event-loop delay).

**What is real:** the production Fastify app, Twilio webhook + media routes, `VoiceSessionManager`
(turns, barge-in, playback), resampling 24 kHz PCM → 8 kHz μ-law and chunked playback.
**What is faked** (fixed latencies, env-configurable): Postgres (in memory, 3 ms/query), STT
(a final utterance every 150 frames = 3 s of caller audio), AI (900 ms), TTS (350 ms, returns
2.5 s of audio). So this measures the **API process's own cost per concurrent call**, not
Deepgram/Claude/Postgres capacity.

*Turn latency* = from the caller frame that completed an utterance to the first reply audio frame.
The fake providers account for 1 250 ms of it; *API overhead* is the rest.

## Results — 2026-09-25

Machine: Intel i5-12450H (12 threads), 15.7 GB RAM, Windows 11, Node 24.15. Driver and server
on the same machine (separate processes). 30 s per level, 20 restaurant numbers. Idle server:
RSS 127 MB, CPU 0.5 %. Event-loop delay reads ~16–22 ms even when idle because of Windows'
15.6 ms timer granularity — compare against that baseline, not zero. CPU % is of one core
(Node runs the event loop on one core).

| Concurrent calls | Failed | Turns answered | Turn latency p50 / p95 / max (ms) | API overhead p50 / p95 (ms) | Webhook p50 / p95 (ms) | CPU avg / peak | RSS peak | Event-loop delay p99 / max |
|---:|---:|---:|---|---|---|---|---:|---|
| 10  | 0 | 90 / 90     | 1297 / 1301 / 1311 | 47 / 51   | 95 / 116  | 2 % / 15 %  | 136 MB | 17 / 31 ms |
| 20  | 0 | 180 / 180   | 1297 / 1302 / 1310 | 47 / 52   | 76 / 115  | 3 % / 18 %  | 105 MB | 17 / 22 ms |
| 50  | 0 | 450 / 450   | 1296 / 1306 / 1311 | 46 / 56   | 65 / 112  | 5 % / 21 %  | 115 MB | 22 / 30 ms |
| 100 | 0 | 900 / 900   | 1292 / 1301 / 1313 | 42 / 51   | 40 / 64   | 12 % / 43 % | 132 MB | 24 / 41 ms |
| 200 | 0 | 1800 / 1800 | 1293 / 1320 / 1355 | 43 / 70   | 36 / 59   | 24 % / 65 % | 171 MB | 32 / 45 ms |
| 500 | 0 | 4500 / 4500 | 1386 / 1800 / 1930 | 136 / 550 | 365 / 460 | 52 % / 97 % | 273 MB | 107 / 650 ms |

## Where it broke

1. **Found and fixed: the incoming-call rate limit was global.** The first run failed calls
   61+ in a minute (at 100 and 200 concurrent) with HTTP 500. `/incoming` was limited to 60
   requests per minute *per IP*, but every Twilio webhook comes from Twilio's small IP pool, so
   that was one limit shared by **all restaurants**; and the error handler turned the plugin's
   429 into a 500 (which Twilio reads as an application error and which also trips the 5xx
   telephony alert). Now the webhooks are limited per restaurant number (`To`) / per call
   (`CallSid`, `MessageSid`) and client errors keep their 4xx status
   (`test/twilio-rate-limit.test.ts`).
2. **The API process itself** is comfortable up to ~200 concurrent calls on one core (added
   latency p95 ≤ 70 ms, ~0.3 MB per call). Around **500** it saturates the core: p95 overhead
   550 ms, event-loop stalls up to 650 ms, webhook replies ~0.4 s. Nothing failed, but callers
   would notice. A realistic WAT weekend peak (a few restaurants × a few simultaneous calls,
   i.e. 10–30) is far below this.

## Not covered (next likely bottlenecks)

- **Postgres.** Faked here. The API pool has `max: 10` connections and every tenant-scoped query
  runs `BEGIN; set_config; query; COMMIT` on a pooled client; each turn writes ~8 rows. At
  ~100 concurrent calls (~33 turns/s) the pool, not CPU, is the first thing to watch
  (`pg_stat_activity`, pool wait time). Rerun this test against a real database before
  counting on more than ~50 concurrent calls.
- **Real providers.** One Deepgram WebSocket and one Claude HTTP request per active turn add
  sockets, TLS and JSON parsing that the fakes don't; provider rate limits (Anthropic, Deepgram
  concurrency) are more likely to bind first than our CPU.
- **Scaling out** is not an option today: the API must run as a single instance
  (docs/ARCHITECTURE.md, "Single API instance").
