import type { Intent, Language } from './types.js';
const unavailable=(es:boolean)=>es?'No tengo esa información disponible en este momento.':'I don’t have that information available right now.';
/** Deterministic spoken replies, used when no LLM response text is available (mock provider or LLM failure). */
export class ResponseGenerator { generate(input:{intent:Intent;language:Language;toolName?:string;toolResult?:unknown;transfer?:boolean}){const es=input.language==='ES',r=input.toolResult as Record<string,unknown>|undefined;
 if(r&&r.success===false)return es?'Lo siento, no pude completar esa solicitud. ¿Quiere que le comunique con alguien del restaurante?':'Sorry, I couldn’t complete that request. Would you like me to connect you with someone at the restaurant?';
 if(r?.state==='READY_FOR_CONFIRMATION')return es?'Tengo los detalles listos. ¿Desea que lo confirme?':'I have the details ready. Shall I go ahead and confirm it?';
 if(input.toolName==='confirm_pending_action'&&r){const code=(r.confirmationCode??r.orderNumber) as string|undefined;return es?`Listo, está confirmado${code?`. Su número de confirmación es ${code}`:''}.`:`All set, that’s confirmed${code?`. Your confirmation number is ${code}`:''}.`;}
 if(input.toolName==='cancel_pending_action')return es?'De acuerdo, no lo he confirmado. ¿Qué le gustaría cambiar?':'Okay, I haven’t confirmed it. What would you like to change?';
 if(input.intent==='GREETING')return es?'Hola, ¿en qué puedo ayudarle?':'Hello, how can I help you?';
 if(input.intent==='GOODBYE')return es?'Gracias por llamar. Hasta luego.':'Thanks for calling. Goodbye.';
 if(input.transfer||input.intent==='HUMAN_REQUEST')return r?.transferAvailable?(es?'Le conectaré con el restaurante ahora.':'I’ll connect you with the restaurant now.'):(es?'No hay un miembro del equipo disponible en este momento.':'A team member is not available right now.');
 if(!r&&input.intent==='RESERVATION')return es?'Con gusto le ayudo con una reserva. ¿Para cuántas personas, qué día y a qué hora?':'I’d be happy to help with a reservation. For how many people, and what day and time?';
 if(!r&&input.intent==='ORDER')return es?'Con gusto tomo su pedido. ¿Qué le gustaría ordenar?':'I’d be happy to take your order. What would you like?';
 if(!r||r.state==='UNKNOWN'||r.state==='NOT_CONFIGURED')return unavailable(es);
 if(input.intent==='HOURS')return es?`Nuestro horario es: ${JSON.stringify(r.hours)}.`:`Our hours are: ${JSON.stringify(r.hours)}.`;
 if(input.intent==='PARKING')return es?`Estacionamiento: ${String(r.parking)}.`:`Parking: ${String(r.parking)}.`;
 if(input.intent==='MENU'||input.intent==='MENU_ITEM'||input.intent==='ALLERGEN'||input.intent==='DIETARY_QUESTION')return es?`Esto es lo que tengo configurado: ${JSON.stringify(r.item??r.items)}.`:`Here’s the configured information: ${JSON.stringify(r.item??r.items)}.`;
 return es?`Esto es lo que tengo disponible: ${JSON.stringify(r)}.`:`Here’s the information I have available: ${JSON.stringify(r)}.`;}}
