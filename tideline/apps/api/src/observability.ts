import type { Db } from "./database/db.js";
export type AuditInput = { restaurantId:string; action:string; entityType:string; entityId?:string; actorType:string; actorId?:string; requestId?:string; correlationId?:string; callId?:string; conversationId?:string; result?:"SUCCESS"|"FAILED"|"SUPPRESSED"; metadata?:Record<string,unknown> };
// PII never reaches process logs (pino/console → log drains). Phone numbers keep only their last 4
// digits; transcripts/order contents are never put in log fields at all, only in the DB tables
// (call_events, conversations, orders) behind tenant RLS. Provider errors (Twilio "The 'To' number
// +1... is not valid", Postgres "Key (phone)=(...)") are the usual leak, so every logged error
// message goes through redactPii.
export const maskPhone=(value:string)=>{const digits=value.replace(/\D/g,"");return digits.length>4?`***${digits.slice(-4)}`:"****";};
const phonePatterns=[/\+\d{8,15}\b/g,/(?<![\w-])\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\w-])/g];
export const redactPii=(text:string)=>phonePatterns.reduce((out,pattern)=>out.replace(pattern,maskPhone),text);
export const safeError=(e:unknown)=>e instanceof Error?redactPii(e.message.replace(/[\r\n]/g," ")).slice(0,200):"unknown error";
// pino serializer for err/error fields: message+stack redacted; drops driver fields such as pg's
// `detail`/`where`/`parameters` and zod `issues`, which echo the offending input values.
export const serializeLoggedError=(e:unknown):{type:string;message:string;stack:string;[key:string]:unknown}=>{
  if(!(e instanceof Error))return {type:"NonError",message:typeof e==="string"?redactPii(e).slice(0,500):"non-error thrown",stack:""};
  const x=e as Error&{code?:unknown;statusCode?:unknown};
  return {type:x.name,message:redactPii(x.message).slice(0,500),code:typeof x.code==="string"||typeof x.code==="number"?x.code:undefined,statusCode:typeof x.statusCode==="number"?x.statusCode:undefined,stack:redactPii(x.stack??"")};
};
export async function writeAudit(db:Db,input:AuditInput){try{await db.query("INSERT INTO audit_events(id,restaurant_id,actor_type,actor_id,action,entity_type,entity_id,request_id,correlation_id,call_id,conversation_id,result,metadata) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,COALESCE($6,gen_random_uuid()),$7,$8,$9,$10,$11,$12)",[input.restaurantId,input.actorType,input.actorId??null,input.action,input.entityType,input.entityId??null,input.requestId??null,input.correlationId??null,input.callId??null,input.conversationId??null,input.result??null,JSON.stringify(input.metadata??{})]);}catch{/* observability must not break business transactions */}}
