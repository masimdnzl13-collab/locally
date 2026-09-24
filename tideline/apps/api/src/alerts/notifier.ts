import type { Env } from "../config/env.js";

export type AdminAlert = { subject: string; text: string };
export interface AlertNotifier {
  send(alert: AdminAlert): Promise<void>;
}
type Log = { warn: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };
type Fetch = typeof fetch;

const ALERT_TIMEOUT_MS = 5000;

/**
 * Admin alert channel. Slack-compatible incoming webhook (`{"text": ...}`) when
 * ALERT_WEBHOOK_URL is set; otherwise a plain email through Resend when
 * RESEND_API_KEY + ALERT_EMAIL_TO + ALERT_EMAIL_FROM are set; otherwise the alert
 * is only logged. Never throws: alerting must not break the request that noticed
 * the problem.
 */
export function createAlertNotifier(
  env: Pick<Env, "ALERT_WEBHOOK_URL" | "ALERT_EMAIL_TO" | "ALERT_EMAIL_FROM" | "RESEND_API_KEY" | "APP_ENV">,
  log: Log,
  fetchImpl: Fetch = fetch,
): AlertNotifier {
  const post = async (url: string, body: unknown, headers: Record<string, string> = {}) => {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`alert delivery failed with HTTP ${res.status}`);
  };
  return {
    async send(alert) {
      const prefix = env.APP_ENV === "production" ? "" : `[${env.APP_ENV}] `;
      const subject = `${prefix}${alert.subject}`;
      try {
        if (env.ALERT_WEBHOOK_URL) {
          await post(env.ALERT_WEBHOOK_URL, { text: `*${subject}*\n${alert.text}` });
          return;
        }
        if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM) {
          await post(
            "https://api.resend.com/emails",
            { from: env.ALERT_EMAIL_FROM, to: [env.ALERT_EMAIL_TO], subject, text: alert.text },
            { authorization: `Bearer ${env.RESEND_API_KEY}` },
          );
          return;
        }
        log.warn({ event: "admin_alert_unrouted", subject }, `${subject}: ${alert.text}`);
      } catch (error) {
        log.error(
          { event: "admin_alert_failed", subject, error: error instanceof Error ? error.message : "unknown" },
          "admin alert could not be delivered",
        );
      }
    },
  };
}
