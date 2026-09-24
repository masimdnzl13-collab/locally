import type { NotificationEvent } from "./contracts.js";
export type NotificationLanguage = "EN" | "ES";
const labels = {
  EN: {
    confirmed: "confirmed",
    updated: "updated",
    cancelled: "cancelled",
    reservation: "reservation",
    order: "order",
  },
  ES: {
    confirmed: "confirmada",
    updated: "actualizada",
    cancelled: "cancelada",
    reservation: "reserva",
    order: "pedido",
  },
} as const;
export function render(
  event: NotificationEvent,
  payload: Record<string, unknown>,
  language: NotificationLanguage = "EN",
) {
  const l = labels[language] ?? labels.EN;
  const name = String(payload.restaurantName ?? "Restaurant");
  const code = String(payload.confirmationCode ?? payload.orderNumber ?? "");
  const reservation = event.startsWith("RESERVATION");
  const state = event.endsWith("CREATED")
    ? l.confirmed
    : event.endsWith("MODIFIED")
      ? l.updated
      : l.cancelled;
  return {
    text:
      name +
      ": " +
      (reservation ? l.reservation : l.order) +
      " " +
      code +
      " " +
      state +
      ".",
    template: event,
    language,
  };
}
