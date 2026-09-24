import type { AlertNotifier } from "./notifier.js";

export type TelephonyFailure = { route: string; statusCode?: number; reason?: string };

/**
 * In-process failure counter for the Twilio voice routes (incoming webhook, media
 * WebSocket, status callback). When more than `maxErrors` failures land inside
 * `windowMs`, one "Tideline telephony is failing" alert goes out; further alerts
 * are suppressed for `cooldownMs` so a sustained outage doesn't flood the channel.
 * Deliberately simple: per-process memory, no APM. A crashed process can't alert
 * about itself — pair this with an external uptime check on /ready.
 */
export class TelephonyErrorMonitor {
  private failures: Array<TelephonyFailure & { at: number }> = [];
  private lastAlertAt = Number.NEGATIVE_INFINITY;
  constructor(
    private readonly notifier: AlertNotifier,
    private readonly options: { maxErrors: number; windowMs: number; cooldownMs: number },
    private readonly now: () => number = Date.now,
  ) {}

  record(failure: TelephonyFailure): void {
    const at = this.now();
    this.failures.push({ ...failure, at });
    this.failures = this.failures.filter((f) => at - f.at <= this.options.windowMs);
    if (this.failures.length <= this.options.maxErrors) return;
    if (at - this.lastAlertAt < this.options.cooldownMs) return;
    this.lastAlertAt = at;
    const recent = this.failures.slice(-10);
    const minutes = Math.round(this.options.windowMs / 60_000);
    void this.notifier.send({
      subject: "Tideline telephony hata veriyor",
      text: [
        `Son ${minutes} dakikada ${this.failures.length} telephony hatası (eşik: ${this.options.maxErrors}).`,
        ...recent.map(
          (f) => `• ${new Date(f.at).toISOString()} ${f.route} ${f.statusCode ?? ""} ${f.reason ?? ""}`.trimEnd(),
        ),
        `Sonraki uyarı en erken ${Math.round(this.options.cooldownMs / 60_000)} dk sonra.`,
      ].join("\n"),
    });
  }

  /** Current failure count inside the window (for tests/diagnostics). */
  get recentFailures(): number {
    const at = this.now();
    return this.failures.filter((f) => at - f.at <= this.options.windowMs).length;
  }
}
