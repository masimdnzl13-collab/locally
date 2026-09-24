const base = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type User = { id: string; email: string };
export type Session = { user: User; token: string };
export type Restaurant = { id: string; name: string; role: string };

export type Stats = {
  calls: { total: number; last7d: number; completed: number; missed: number; avgDurationSeconds: number };
  reservations: { total: number; upcoming: number; cancelled: number; noShow: number };
  orders: { total: number; last7d: number; revenueCents: number; last7dRevenueCents: number; cancelled: number };
  notifications: { total: number; sent: number; failed: number; deliveryRate: number | null };
  menu: { categories: number; items: number; activeItems: number };
  faqs: number;
  ai: { conversations: number; totalTokens: number; estimatedCostUsd: number };
};
export type TimeseriesPoint = { day: string; count: number };
export type RevenuePoint = { day: string; value: number };
export type Timeseries = { calls: TimeseriesPoint[]; revenueCents: RevenuePoint[]; reservations: TimeseriesPoint[] };

export type CallRow = {
  id: string;
  caller_phone_number: string | null;
  direction: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  language: string | null;
  initial_intent: string | null;
};
export type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  order_type: string;
  total_cents: number;
  currency: string;
  created_at: string;
};
export type ReservationRow = {
  id: string;
  confirmation_code: string;
  status: string;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  created_at: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const friendly: Record<string, string> = {
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have access to this restaurant.",
  RESTAURANT_ACCESS_DENIED: "You do not have access to this restaurant.",
  VALIDATION_ERROR: "Please check the submitted values.",
  NOT_FOUND: "The requested record was not found.",
};

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(0, "Unable to reach the server. Please try again.");
  }
  let body: unknown = {};
  try {
    body = await response.json();
  } catch {
    /* empty body */
  }
  if (response.status === 401) window.dispatchEvent(new Event("session-expired"));
  if (!response.ok) {
    const b = body as { error?: { message?: string; code?: string } };
    throw new ApiError(
      response.status,
      friendly[b.error?.code ?? ""] ?? (response.status >= 500 ? "The server could not complete that request." : (b.error?.message ?? "Request failed.")),
      b.error?.code,
    );
  }
  return body as T;
}

export function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
export function userMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
