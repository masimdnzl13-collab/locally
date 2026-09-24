# Decisions

- Greenfield implementation was created because the assigned workspace contained no Phase 01 source.
- SQLite is used only for a portable legacy/local deployment; PostgreSQL is authoritative for production.
- Restaurant-scoped operational instructions are bounded configuration fields, not privileged system prompts.
- Allergen records use `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN`. Missing configuration is surfaced as `NOT_CONFIGURED` in context.
- PostgreSQL `apps/api` and SQLite `src` are currently separate stacks. This pass does not silently merge incompatible schemas. PostgreSQL migrations use a unique deterministic sequence through `017`; SQLite remains legacy/local-only.
- Phase 05 action handlers are not considered implemented when they return `REQUIRES_ACTION_ENGINE`; those placeholders remain a tracked defect until backed by real domain operations.

## Phase 03 decisions

- Use Twilio bidirectional media streaming via WebSocket, with Twilio-specific XML/signature logic confined to `voice/twilio-provider.ts`.
- Resolve tenants by active E.164 phone mapping and enforce `(provider, provider_call_id)` uniqueness plus provider-event idempotency.
- Use AbortController cancellation for interruption and provider timeouts; real reservation/order/payment actions remain outside the voice engine.
- Default local mode is mock/test; production rejects non-Twilio mode and missing public HTTPS configuration.

## Phase 04 decisions

- AI provider contracts remain free of SDK types; classification, tool selection, response generation, and structured output are separate operations.
- Tool execution is allowlisted by `ActionRegistry` and schema-validated before handlers receive Restaurant Brain data. Unknown tools and malformed arguments fail closed.
- Local voice operation remains deterministic when no external provider is configured; unsupported requests resolve to `UNKNOWN` and missing restaurant facts are never fabricated.
