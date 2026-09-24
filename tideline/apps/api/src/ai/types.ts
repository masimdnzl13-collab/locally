export const Intents=['GENERAL_QUESTION','RESTAURANT_INFO','HOURS','LOCATION','PARKING','MENU','MENU_ITEM','ALLERGEN','DIETARY_QUESTION','SPECIALS','RESERVATION','ORDER','ORDER_STATUS','CANCELLATION','MODIFICATION','HUMAN_REQUEST','COMPLAINT','GREETING','GOODBYE','UNKNOWN'] as const;
export type Intent=typeof Intents[number]; export type Language='EN'|'ES';
export type FactState='KNOWN'|'UNKNOWN'|'NOT_CONFIGURED'; export type Field<T>={status:'UNKNOWN'|'KNOWN'|'CONFIRMED'|'INVALID';value?:T};
/** A mutation the model proposed and the caller has not yet confirmed. */
export type PendingAction={tool:string;arguments:Record<string,unknown>;confirmationId:string;summary?:string};
export type ConversationState={language?:Language;currentIntent?:Intent;previousIntent?:Intent;pendingQuestion?:string;pendingAction?:PendingAction;callerName:Field<string>;callerPhone:Field<string>;partySize:Field<number>;requestedDate:Field<string>;requestedTime:Field<string>;orderDraft:Field<Record<string,unknown>>;reservationDraft:Field<Record<string,unknown>>;needsHuman:boolean;lastToolResult?:unknown};
export const emptyState=():ConversationState=>({callerName:{status:'UNKNOWN'},callerPhone:{status:'UNKNOWN'},partySize:{status:'UNKNOWN'},requestedDate:{status:'UNKNOWN'},requestedTime:{status:'UNKNOWN'},orderDraft:{status:'UNKNOWN'},reservationDraft:{status:'UNKNOWN'},needsHuman:false});
/** TOOL message content is the JSON produced by `toolMessage`. */
export type ProviderMessage={role:'SYSTEM'|'USER'|'ASSISTANT'|'TOOL';content:string}; export type ToolDefinition={name:string;description:string;inputSchema:unknown};
export type IntentResult={intent:Intent;confidence:number;reasoningSummary?:string;language?:Language}; export type ToolDecision={name:string;arguments:Record<string,unknown>}|null;
export type AIUsage={inputTokens:number;outputTokens:number;totalTokens:number;model:string};
export type AIRequest={requestId:string;instructions:string;messages:ProviderMessage[];tools:ToolDefinition[];timeoutMs:number;signal?:AbortSignal}; export type AIResult={text:string;toolCall?:ToolDecision;usage:AIUsage};
export interface AIProvider { readonly name:string; detectIntent(input:{requestId:string;text:string;state:ConversationState;context:string;timeoutMs:number;signal?:AbortSignal}):Promise<IntentResult>; decideToolCall(input:AIRequest):Promise<ToolDecision>; generateResponse(input:AIRequest):Promise<AIResult>; generateStructuredOutput<T>(input:AIRequest):Promise<T>;
  /** Tokens consumed by all calls for this request id since the last drain (optional). */
  drainUsage?(requestId:string):AIUsage|undefined; }
/** Serialises a tool call + result into the text form stored in conversation_messages. */
export const toolMessage=(name:string,args:unknown,result:unknown)=>JSON.stringify({tool:name,arguments:args,result});
