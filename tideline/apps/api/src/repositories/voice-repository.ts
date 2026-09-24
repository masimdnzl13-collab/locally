import { randomUUID } from "node:crypto";
import type { Db } from "../database/db.js";
import type {
  CallEventType,
  CallSession,
  CallStatus,
  Language,
} from "../voice/contracts.js";
export type PhoneRestaurant = {
  restaurantId: string;
  restaurantName: string;
  status: string;
  timezone: string;
  voiceConfig: Record<string, unknown>;
  phoneNumber: string;
};
export type CallRow = {
  id: string;
  restaurantId: string;
  provider: string;
  providerCallId: string;
  callerPhoneNumber: string | null;
  calledPhoneNumber: string;
  status: CallStatus;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  language: Language | null;
  initialIntent: string | null;
  terminationReason: string | null;
};
export class VoiceRepository {
  constructor(private readonly db: Db) {}
  async restaurantContext(
    restaurantId: string,
  ): Promise<Record<string, unknown>> {
    const brain =
      (
        await this.db.query(
          "SELECT * FROM restaurant_brain WHERE restaurant_id=$1",
          [restaurantId],
        )
      ).rows[0] ?? {};
    const hours = (
      await this.db.query(
        "SELECT weekday,start_time,end_time FROM business_hours WHERE restaurant_id=$1 ORDER BY weekday,start_time",
        [restaurantId],
      )
    ).rows;
    const closures = (
      await this.db.query(
        "SELECT closure_date,start_time,end_time,reason FROM special_closures WHERE restaurant_id=$1 AND active=true",
        [restaurantId],
      )
    ).rows;
    return { brain, hours, closures, restaurantId };
  }
  async resolveActivePhone(
    phone: string,
  ): Promise<PhoneRestaurant | undefined> {
    return (
      await this.db.query<PhoneRestaurant>(
        `SELECT r.id "restaurantId",r.name "restaurantName",r.status,r.timezone,r.voice_config "voiceConfig",p.phone_number "phoneNumber" FROM restaurant_phone_numbers p JOIN restaurants r ON r.id=p.restaurant_id WHERE p.phone_number=$1 AND p.active=true`,
        [phone],
      )
    ).rows[0];
  }
  /** Calls from one caller number to one restaurant in the last `windowMinutes` (the per-caller abuse guard). */
  async recentCallsFromCaller(input: {
    restaurantId: string;
    caller: string | null;
    windowMinutes: number;
    excludeProviderCallId: string;
  }): Promise<number> {
    const row = (
      await this.db.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM calls WHERE restaurant_id=$1 AND (caller_phone_number = $2 OR ($2::text IS NULL AND caller_phone_number IS NULL)) AND provider_call_id<>$3 AND started_at > $4`,
        [input.restaurantId, input.caller, input.excludeProviderCallId, new Date(Date.now() - input.windowMinutes * 60_000)],
      )
    ).rows[0];
    return Number(row?.n ?? 0);
  }
  async createCall(input: {
    restaurantId: string;
    provider: string;
    providerCallId: string;
    caller?: string;
    called: string;
  }): Promise<{ call: CallRow; created: boolean }> {
    const existing = (
      await this.db.query<CallRow>(
        `SELECT id,restaurant_id "restaurantId",provider,provider_call_id "providerCallId",caller_phone_number "callerPhoneNumber",called_phone_number "calledPhoneNumber",status,started_at "startedAt",answered_at "answeredAt",ended_at "endedAt",duration_seconds "durationSeconds",language,initial_intent "initialIntent",termination_reason "terminationReason" FROM calls WHERE provider=$1 AND provider_call_id=$2`,
        [input.provider, input.providerCallId],
      )
    ).rows[0];
    if (existing) return { call: existing, created: false };
    const call = (
      await this.db.query<CallRow>(
        `INSERT INTO calls(id,restaurant_id,provider,provider_call_id,caller_phone_number,called_phone_number) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,restaurant_id "restaurantId",provider,provider_call_id "providerCallId",caller_phone_number "callerPhoneNumber",called_phone_number "calledPhoneNumber",status,started_at "startedAt",answered_at "answeredAt",ended_at "endedAt",duration_seconds "durationSeconds",language,initial_intent "initialIntent",termination_reason "terminationReason"`,
        [
          randomUUID(),
          input.restaurantId,
          input.provider,
          input.providerCallId,
          input.caller ?? null,
          input.called,
        ],
      )
    ).rows[0];
    return { call, created: true };
  }
  async createSession(call: CallRow): Promise<CallSession> {
    const row = (
      await this.db.query<{ id: string; state: string; startedAt: Date }>(
        `INSERT INTO call_sessions(id,call_id,restaurant_id) VALUES($1,$2,$3) ON CONFLICT(call_id) DO UPDATE SET updated_at=NOW() RETURNING id,state,started_at "startedAt"`,
        [randomUUID(), call.id, call.restaurantId],
      )
    ).rows[0];
    return {
      id: row.id,
      callId: call.id,
      restaurantId: call.restaurantId,
      state: row.state,
      startedAt: row.startedAt,
    };
  }
  async event(input: {
    callId: string;
    sessionId?: string;
    restaurantId: string;
    type: CallEventType;
    providerEventId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (input.providerEventId) {
      const prior = (
        await this.db.query(
          "SELECT id FROM call_events WHERE provider_event_id=$1",
          [input.providerEventId],
        )
      ).rows[0];
      if (prior) return;
    }
    await this.db.query(
      `INSERT INTO call_events(id,call_id,session_id,restaurant_id,event_type,provider_event_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        randomUUID(),
        input.callId,
        input.sessionId ?? null,
        input.restaurantId,
        input.type,
        input.providerEventId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }
  async updateCall(
    id: string,
    input: {
      status?: CallStatus;
      language?: Language;
      intent?: string;
      terminationReason?: string;
      end?: boolean;
    },
  ): Promise<void> {
    await this.db.query(
      `UPDATE calls SET status=CASE WHEN status IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN status ELSE COALESCE($2,status) END,language=COALESCE($3,language),initial_intent=COALESCE(initial_intent,$4),termination_reason=CASE WHEN status IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN termination_reason ELSE COALESCE($5,termination_reason) END,answered_at=CASE WHEN $2='IN_PROGRESS' THEN COALESCE(answered_at,NOW()) ELSE answered_at END,ended_at=CASE WHEN $6 THEN COALESCE(ended_at,NOW()) ELSE ended_at END,duration_seconds=CASE WHEN $6 THEN COALESCE(duration_seconds,GREATEST(0,EXTRACT(EPOCH FROM (NOW()-started_at))::INTEGER)) ELSE duration_seconds END,updated_at=NOW() WHERE id=$1`,
      [
        id,
        input.status ?? null,
        input.language ?? null,
        input.intent ?? null,
        input.terminationReason ?? null,
        input.end ?? false,
      ],
    );
  }
  async endSession(id: string, reason: string): Promise<void> {
    await this.db.query(
      "UPDATE call_sessions SET state=$2,ended_at=NOW(),termination_reason=$3,updated_at=NOW() WHERE id=$1",
      [id, "ENDED", reason],
    );
  }
  async listCalls(restaurantId: string) {
    return (
      await this.db.query(
        `SELECT id,caller_phone_number "callerPhoneNumber",status,language,duration_seconds "durationSeconds",started_at "startedAt",termination_reason "outcome" FROM calls WHERE restaurant_id=$1 ORDER BY started_at DESC LIMIT 100`,
        [restaurantId],
      )
    ).rows;
  }
  async updateProviderStatus(provider: string, providerCallId: string, status: CallStatus, reason?: string): Promise<void> {
    await this.db.query(
      `UPDATE calls SET status=CASE WHEN status IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN status ELSE $3 END,termination_reason=CASE WHEN status IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN termination_reason ELSE COALESCE($4,termination_reason) END,ended_at=CASE WHEN status IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN ended_at WHEN $3 IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN COALESCE(ended_at,NOW()) ELSE ended_at END,duration_seconds=CASE WHEN status IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN duration_seconds WHEN $3 IN ('COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED') THEN COALESCE(duration_seconds,GREATEST(0,EXTRACT(EPOCH FROM (NOW()-started_at))::INTEGER)) ELSE duration_seconds END,updated_at=NOW() WHERE provider=$1 AND provider_call_id=$2`,
      [provider, providerCallId, status, reason ?? null],
    );
  }
}
