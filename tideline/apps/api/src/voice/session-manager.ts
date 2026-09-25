import type { Env } from "../config/env.js";
import { safeError } from "../observability.js";
import { runWithTenant } from "../database/tenant-context.js";
import { VoiceRepository } from "../repositories/voice-repository.js";
import type { CallSession, Language, SpeechToTextProvider, TelephonyProvider, TextToSpeechProvider, VoiceAIEngine, VoiceMediaSink } from "./contracts.js";
import { muLawDurationMs, toTwilioMuLaw } from "./audio-codec.js";
import { callFailureMessage } from "./failure-message.js";
/** Which part of the pipeline failed; reported to monitoring and stored on the ERROR event. */
class VoiceTimeoutError extends Error{constructor(){super("Voice provider timeout");this.name="VoiceTimeoutError";}}
export type FailureStage="stt"|"ai"|"tts"|"playback"|"transfer"|"hangup";
export type VoiceFailure={restaurantId:string;callId:string;sessionId:string;stage:FailureStage;reason:string;apologized:boolean};
type Active = { session:CallSession; callId:string; restaurantId:string; providerCallId?:string; language:Language; turn: number; controller?:AbortController; media?:VoiceMediaSink; context:Record<string,unknown>; ending?:Promise<void>; ended:boolean; playback:Promise<void>; playingUntil:number; speaking:boolean; terminalStatus?:"COMPLETED"|"FAILED" };
const languageFor=(text:string,current:Language):Language=>/[¿¡ñ]|\b(hola|español|gracias|reservación|quiero|por favor|buenas|buenos)\b/i.test(text)?"es":current;
type VoiceRepo=Pick<VoiceRepository,"updateCall"|"event"|"endSession">;
export class VoiceSessionManager {
 private active=new Map<string,Active>();
 /** Set by the telephony routes to feed the failure monitor (alerts when failures cluster). */
 onFailure?:(failure:VoiceFailure)=>void;
 constructor(private readonly repo:VoiceRepo,private readonly stt:SpeechToTextProvider,private readonly tts:TextToSpeechProvider,private readonly ai:VoiceAIEngine,private readonly telephony:TelephonyProvider,private readonly env:Env,private readonly delay:(ms:number)=>Promise<void>=(ms)=>new Promise((r)=>setTimeout(r,ms))){}
 attachMedia(sessionId:string,media:VoiceMediaSink){const a=this.require(sessionId);if(a.ended)return; a.media=media;}
 async begin(session:CallSession,callId:string,restaurantId:string,context:Record<string,unknown>={}):Promise<void>{
  if(this.active.has(session.id))await this.end(session.id,"REPLACED");
  const a:Active={session,callId,restaurantId,providerCallId:typeof context.providerCallId==="string"?context.providerCallId:undefined,language:"en",turn:0,context,ended:false,playback:Promise.resolve(),playingUntil:0,speaking:false};
  this.active.set(session.id,a);
  await runWithTenant(restaurantId,async()=>{try{
   await this.stt.startSession({sessionId:session.id,
    onTranscript:(event)=>runWithTenant(restaurantId,()=>event.isFinal?this.transcript(session.id,event.text,{},event.language):this.speechStarted(a)),
    onError:(error)=>runWithTenant(restaurantId,()=>this.fail(a,error,"stt"))});
   if(!this.current(a))return;
   await this.repo.updateCall(callId,{status:"IN_PROGRESS"});
   await this.repo.event({callId,sessionId:session.id,restaurantId,type:"CALL_ANSWERED"});
  }catch(error){await this.fail(a,error,"stt");throw error;}});
 }
 /** Inbound caller audio. Only forwarded: silence frames arrive continuously, so they must not interrupt playback. */
 async audio(sessionId:string,frame:Buffer){const a=this.require(sessionId);if(a.ended)return;await this.stt.sendAudio(sessionId,frame);}
 /** The caller started talking (interim transcript): barge in on any reply in flight. */
 private async speechStarted(a:Active){
  if(!this.current(a)||a.speaking)return;
  a.speaking=true;
  if(a.controller||Date.now()<a.playingUntil)await this.interrupt(a);
  await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"SPEECH_STARTED"});
 }
 async transcript(sessionId:string,transcript:string,context:Record<string,unknown>={},detected?:Language):Promise<void>{const a=this.require(sessionId);if(a.ended)return;return runWithTenant(a.restaurantId,()=>this.handleTranscript(a,transcript,context,detected));}
 private async handleTranscript(a:Active,transcript:string,context:Record<string,unknown>,detected?:Language):Promise<void>{
  const sessionId=a.session.id;a.speaking=false;await this.interrupt(a);
  const next=detected??languageFor(transcript,a.language);
  await this.setLanguage(a,next);if(!this.current(a))return;
  await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"SPEECH_ENDED"});
  const controller=new AbortController(),turn=++a.turn;a.controller=controller;
  let stage:FailureStage="ai";
  try{
   const result=await this.withTimeout(this.ai.respond({restaurantId:a.restaurantId,callId:a.callId,sessionId,language:a.language,transcript,conversationState:{},restaurantContext:{...a.context,...context}},controller.signal),this.env.VOICE_RESPONSE_TIMEOUT_MS,controller);
   if(!this.isTurn(a,turn,controller))return;
   if(result.language)await this.setLanguage(a,result.language);
   if(result.intent)await this.repo.updateCall(a.callId,{intent:result.intent});
   await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"AI_RESPONSE_STARTED",metadata:result.intent?{intent:result.intent}:undefined});
   stage="tts";
   const audio=await this.withTimeout(this.tts.synthesize({text:result.responseText,language:a.language,voice:a.language==="es"?this.env.VOICE_SPANISH_VOICE:this.env.VOICE_ENGLISH_VOICE},controller.signal),this.env.VOICE_PROVIDER_TIMEOUT_MS,controller);
   if(!this.isTurn(a,turn,controller))return;
   stage="playback";
   const media=a.media;let playMs=0;
   if(media){const bytes=toTwilioMuLaw(audio);playMs=muLawDurationMs(bytes);a.playback=a.playback.then(async()=>{if(!this.isTurn(a,turn,controller))return;a.playingUntil=Date.now()+playMs;await media.sendAudio(bytes);});await a.playback;}
   if(!this.isTurn(a,turn,controller))return;
   await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"AI_RESPONSE_ENDED"});
   if(result.shouldTransfer&&result.transferTo&&a.providerCallId){
    await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"HUMAN_TRANSFER_REQUESTED"});
    await this.delay(playMs+300);if(!this.isTurn(a,turn,controller))return;
    stage="transfer";
    await this.telephony.transfer({providerCallId:a.providerCallId,targetNumber:result.transferTo});
    await this.repo.updateCall(a.callId,{status:"TRANSFERRED",terminationReason:"TRANSFERRED",end:true});
    await this.end(sessionId,"TRANSFERRED");
   }else if(result.shouldEndCall){
    // Let the goodbye finish playing before hanging up.
    await this.delay(playMs+500);if(!this.isTurn(a,turn,controller))return;
    stage="hangup";
    if(a.providerCallId)await this.telephony.hangup?.(a.providerCallId);
    await this.end(sessionId,"AI_ENDED");
   }
  // A timeout aborts this turn's controller itself, so isTurn() alone would treat it like a
  // barge-in and swallow it, leaving the caller in silence. Only a newer turn (a.turn moved on)
  // or a finished session means "someone else took over".
  }catch(error){if(this.isTurn(a,turn,controller)||(error instanceof VoiceTimeoutError&&this.current(a)&&a.turn===turn))await this.fail(a,error,stage);}finally{if(a.controller===controller)a.controller=undefined;}
 }
 private async setLanguage(a:Active,next:Language){if(next===a.language)return;a.language=next;await this.repo.updateCall(a.callId,{language:next});if(!this.current(a))return;await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"LANGUAGE_DETECTED",metadata:{language:next}});}
 async end(sessionId:string,reason="CALLER_ENDED"):Promise<void>{const a=this.active.get(sessionId);if(!a)return;if(a.ending)return a.ending;a.ending=runWithTenant(a.restaurantId,()=>this.finish(a,reason));return a.ending;}
 private async finish(a:Active,reason:string){if(a.ended)return;a.ended=true;a.turn++;a.controller?.abort();a.controller=undefined;try{await Promise.allSettled([a.media?.clear(),this.telephony.stopPlayback(a.session.id),a.playback]);await this.stt.endSession(a.session.id);await this.repo.endSession(a.session.id,reason);const status=a.terminalStatus??(reason==="PROVIDER_FAILURE"?"FAILED":"COMPLETED");await this.repo.updateCall(a.callId,{status,language:a.language,terminationReason:reason,end:true});await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"CALL_ENDED",metadata:{reason}});}finally{await Promise.allSettled([a.media?.close()]);this.active.delete(a.session.id);}}
 private async interrupt(a:Active){a.turn++;a.controller?.abort();a.controller=undefined;a.playingUntil=0;await Promise.allSettled([a.media?.clear(),this.telephony.stopPlayback(a.session.id),a.playback]);}
 private current(a:Active){return this.active.get(a.session.id)===a&&!a.ended;}
 private isTurn(a:Active,turn:number,c:AbortController){return this.current(a)&&a.turn===turn&&!c.signal.aborted;}
 private require(id:string){const a=this.active.get(id);if(!a||a.ended)throw new Error("Unknown voice session");return a;}
 /**
  * Graceful failure: instead of dead air or an abrupt drop, the caller hears a short apology
  * (spoken by Twilio, not our TTS, which may be what failed) with the restaurant's own number,
  * or is connected to the restaurant's transfer line when one is configured. If even that
  * redirect fails, closing the stream falls through to the TwiML fallback from
  * incomingResponse. Every failure is also reported to onFailure (the telephony monitor).
  */
 private async fail(a:Active,error:unknown,stage:FailureStage){
  if(!this.current(a))return;
  a.terminalStatus="FAILED";
  const reason=safeError(error);
  // Nothing may stop the apology from being attempted: bookkeeping errors are swallowed.
  await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"ERROR",metadata:{category:"provider_failure",stage,message:reason}}).catch(()=>{});
  let apologized=false;
  if(a.providerCallId&&this.telephony.sayAndEnd){
   const transferNumber=typeof a.context.transferNumber==="string"?a.context.transferNumber:undefined;
   const restaurantPhone=typeof a.context.fallbackPhone==="string"?a.context.fallbackPhone:undefined;
   try{
    await this.telephony.sayAndEnd({providerCallId:a.providerCallId,language:a.language,transferNumber,message:callFailureMessage({language:a.language,restaurantPhone,transfer:Boolean(transferNumber)})});
    apologized=true;
    await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"FAILURE_MESSAGE_PLAYED",metadata:{transferred:Boolean(transferNumber)}}).catch(()=>{});
   }catch{/* falls back to the incomingResponse TwiML once the stream closes */}
  }
  try{this.onFailure?.({restaurantId:a.restaurantId,callId:a.callId,sessionId:a.session.id,stage,reason,apologized});}catch{/* monitoring must not affect the call */}
  await this.end(a.session.id,"PROVIDER_FAILURE");
 }
 private async withTimeout<T>(work:Promise<T>,ms:number,controller:AbortController):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<T>((_,reject)=>{timer=setTimeout(()=>{reject(new VoiceTimeoutError());controller.abort();},ms);})]);}finally{if(timer)clearTimeout(timer);}}
 activeCount(){return this.active.size;}
}
