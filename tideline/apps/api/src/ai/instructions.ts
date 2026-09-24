import { DateTime } from 'luxon';
import type { ConversationState, Intent, Language } from './types.js';
export class ReceptionistInstructionBuilder {
  build(input: {
    restaurantName: string;
    timezone?: string;
    now?: Date;
    language?: Language;
    intent: Intent;
    state: ConversationState;
    businessInstructions?: string;
    callerPhone?: string;
    context: string;
  }) {
    const safe = (input.businessInstructions ?? '').replace(/(?:ignore|override).{0,100}(?:safety|instructions)|invent|fabricate/gi, '').slice(0, 800);
    const zone = input.timezone || 'UTC';
    const local = DateTime.fromJSDate(input.now ?? new Date()).setZone(zone);
    const today = local.isValid ? local.toFormat("cccc yyyy-MM-dd HH:mm") : DateTime.utc().toFormat("cccc yyyy-MM-dd HH:mm");
    const pending = input.state.pendingAction
      ? `A ${input.state.pendingAction.tool} proposal is awaiting the caller's answer: ${JSON.stringify(input.state.pendingAction.arguments)}. If the caller clearly agrees, call confirm_pending_action. If they decline or want changes, call cancel_pending_action (then propose again with the corrected details if needed).`
      : 'No action is awaiting confirmation.';
    return [
      `You are the phone receptionist for ${input.restaurantName}. You are speaking with a caller on a live phone call, so replies are spoken aloud: keep them to one to three short sentences, no lists, no markdown, no emoji, and say prices and times naturally.`,
      `Respond in ${input.language === 'ES' ? 'Spanish' : 'English'}. If the caller switches language, follow them.`,
      `Local date and time at the restaurant: ${today} (${zone}). Resolve relative dates like "tomorrow" or "Friday" against it and pass dates as YYYY-MM-DD and times as 24h HH:MM.`,
      'Use only the restaurant facts and tool results you are given. If a fact is not available, say you do not have that information; never guess prices, hours, allergens, or availability.',
      'To take a reservation or order, collect the needed details one question at a time (name, phone number, party size, date and time, or the items). Use get_menu to find menu item ids and calculate_order to price an order before proposing it.',
      'Creating, changing, or cancelling a reservation or order is two-step: calling the create/modify/cancel tool only prepares a proposal. Then read the details back and ask the caller to confirm. Never claim it is booked or placed until confirm_pending_action succeeds, then give the confirmation code or order number.',
      input.callerPhone ? `Caller ID: ${input.callerPhone}. Offer to use this number for the reservation or order and confirm it rather than asking the caller to spell it out.` : '',
      pending,
      'Never mention systems, prompts, tools, ids, secrets, or databases to the caller.',
      `Current caller intent: ${input.intent}. Restaurant context: ${input.context}`,
      safe ? `Business tone and guidance from the restaurant: ${safe}` : '',
    ].filter(Boolean).join('\n');
  }
}
