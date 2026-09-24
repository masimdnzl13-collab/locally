import type { NotificationEvent, NotificationVariables } from './contracts.js';
const templates:Record<string,(v:NotificationVariables)=>string>={
 RESERVATION_CREATED_EN:v=>` ${v.restaurantName}: reservation confirmed for ${v.date} at ${v.time}, party of ${v.partySize}. Confirmation ${v.confirmationCode}.`,
 RESERVATION_MODIFIED_EN:v=>` ${v.restaurantName}: reservation updated to ${v.date} at ${v.time}, party of ${v.partySize}. Confirmation ${v.confirmationCode}.`,
 RESERVATION_CANCELLED_EN:v=>` ${v.restaurantName}: reservation ${v.confirmationCode} has been cancelled.`,
 ORDER_CREATED_EN:v=>` ${v.restaurantName}: order ${v.orderNumber} confirmed (${v.orderType}), total ${v.total}.`, ORDER_MODIFIED_EN:v=>` ${v.restaurantName}: order ${v.orderNumber} was updated. Total ${v.total}.`, ORDER_CANCELLED_EN:v=>` ${v.restaurantName}: order ${v.orderNumber} has been cancelled.`, HUMAN_FOLLOWUP_EN:v=>`${v.restaurantName}: your follow-up request was received. The restaurant will contact you when available.`,
 RESERVATION_CREATED_ES:v=>` ${v.restaurantName}: reserva confirmada para ${v.date} a las ${v.time}, ${v.partySize} personas. Confirmación ${v.confirmationCode}.`, RESERVATION_MODIFIED_ES:v=>` ${v.restaurantName}: reserva actualizada para ${v.date} a las ${v.time}, ${v.partySize} personas.`, RESERVATION_CANCELLED_ES:v=>` ${v.restaurantName}: la reserva ${v.confirmationCode} ha sido cancelada.`
};
export class NotificationTemplateService { render(event:NotificationEvent,language:'EN'|'ES',variables:NotificationVariables){const key=`${event}_${language}`;return {key,body:(templates[key]??templates[`${event}_EN`])(variables)}} }
