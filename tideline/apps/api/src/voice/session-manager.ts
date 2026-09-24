import type { Env } from "../config/env.js";
import { safeError } from "../observability.js";
import { runWithTenant } from "../database/tenant-context.js";
import { VoiceRepository } from "../repositories/voice-repository.js";
import type { CallSession, Language, SpeechToTextProvider, TelephonyProvider, TextToSpeechProvider, VoiceAIEngine, VoiceMediaSink } from "./contracts.js";
import { muLawDurationMs, toTwilioMuLaw } from "./audio-codec.js";
type Active = { session:CallSession; callId:string; restaurantId:string; providerCallId?:string; language:Language; turn: number; controller?:AbortController; media?:VoiceMediaSink; context:Record<string,unknown>; ending?:Promise<void>; ended:boolean; playback:Promise<void>; playingUntil:number; speaking:boolean; terminalStatus?:"COMPLETED"|"FAILED" };
const languageFor=(text:string,current:Language):Language=>/[¿¡ñ]|\b(hola|español|gracias|reservación|quiero|por favor|buenas|buenos)\b/i.test(text)?"es":current;
type VoiceRepo=Pick<VoiceRepository,"updateCall"|"event"|"endSession">;
export class VoiceSessionManager {
 private active=new Map<string,Active>();
 constructor(private readonly repo:VoiceRepo,private readonly stt:SpeechToTextProvider,private readonly tts:TextToSpeechProvider,private readonly ai:VoiceAIEngine,private readonly telephony:TelephonyProvider,private readonly env:Env,private readonly delay:(ms:number)=>Promise<void>=(ms)=>new Promise((r)=>setTimeout(r,ms))){}
 attachMedia(sessionId:string,media:VoiceMediaSink){const a=this.require(sessionId);if(a.ended)return; a.media=media;}
 async begin(session:CallSession,callId:string,restaurantId:string,context:Record<string,unknown>={}):Promise<void>{
  if(this.active.has(session.id))await this.end(session.id,"REPLACED");
  const a:Active={session,callId,restaurantId,providerCallId:typeof context.providerCallId==="string"?context.providerCallId:undefined,language:"en",turn:0,context,ended:false,playback:Promise.resolve(),playingUntil:0,speaking:false};
  this.active.set(session.id,a);
  await runWithTenant(restaurantId,async()=>{try{
   await this.stt.startSession({sessionId:session.id,
    onTranscript:(event)=>runWithTenant(restaurantId,()=>event.isFinal?this.transcript(session.id,event.text,{},event.language):this.speechStarted(a)),
    onError:(error)=>runWithTenant(restaurantId,()=>this.fail(a,error))});
   if(!this.current(a))return;
   await this.repo.updateCall(callId,{status:"IN_PROGRESS"});
   await this.repo.event({callId,sessionId:session.id,restaurantId,type:"CALL_ANSWERED"});
  }catch(error){await this.fail(a,error);throw error;}});
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
  try{
   const result=await this.withTimeout(this.ai.respond({restaurantId:a.restaurantId,callId:a.callId,sessionId,language:a.language,transcript,conversationState:{},restaurantContext:{...a.context,...context}},controller.signal),this.env.VOICE_RESPONSE_TIMEOUT_MS,controller);
   if(!this.isTurn(a,turn,controller))return;
   if(result.language)await this.setLanguage(a,result.language);
   if(result.intent)await this.repo.updateCall(a.callId,{intent:result.intent});
   await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"AI_RESPONSE_STARTED",metadata:result.intent?{intent:result.intent}:undefined});
   const audio=await this.withTimeout(this.tts.synthesize({text:result.responseText,language:a.language,voice:a.language==="es"?this.env.VOICE_SPANISH_VOICE:this.env.VOICE_ENGLISH_VOICE},controller.signal),this.env.VOICE_PROVIDER_TIMEOUT_MS,controller);
   if(!this.isTurn(a,turn,controller))return;
   const media=a.media;let playMs=0;
   if(media){const bytes=toTwilioMuLaw(audio);playMs=muLawDurationMs(bytes);a.playback=a.playback.then(async()=>{if(!this.isTurn(a,turn,controller))return;a.playingUntil=Date.now()+playMs;await media.sendAudio(bytes);});await a.playback;}
   if(!this.isTurn(a,turn,controller))return;
   await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"AI_RESPONSE_ENDED"});
   if(result.shouldTransfer&&result.transferTo&&a.providerCallId){
    await this.repo.event({callId:a.callId,sessionId,restaurantId:a.restaurantId,type:"HUMAN_TRANSFER_REQUESTED"});
    await this.delay(playMs+300);if(!this.isTurn(a,turn,controller))return;
    await this.telephony.transfer({providerCallId:a.providerCallId,targetNumber:result.transferTo});
    await this.repo.updateCall(a.callId,{status:"TRANSFERRED",terminationReason:"TRANSFERRED",end:true});
    await this.end(sessionId,"TRANSFERRED");
   }else if(result.shouldEndCall){
    // Let the goodbye finish playing before hanging up.
    await this.delay(playMs+500);if(!this.isTurn(a,turn,controller))return;
    if(a.providerCallId)await this.telephony.hangup?.(a.providerCallId);
    await this.end(sessionId,"AI_ENDED");
   }
  }catch(error){if(this.isTurn(a,turn,controller))await this.fail(a,error);}finally{if(a.controller===controller)a.controller=undefined;}
 }
 private async setLanguage(a:Active,next:Language){if(next===a.language)return;a.language=next;await this.repo.updateCall(a.callId,{language:next});if(!this.current(a))return;await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"LANGUAGE_DETECTED",metadata:{language:next}});}
 async end(sessionId:string,reason="CALLER_ENDED"):Promise<void>{const a=this.active.get(sessionId);if(!a)return;if(a.ending)return a.ending;a.ending=runWithTenant(a.restaurantId,()=>this.finish(a,reason));return a.ending;}
 private async finish(a:Active,reason:string){if(a.ended)return;a.ended=true;a.turn++;a.controller?.abort();a.controller=undefined;try{await Promise.allSettled([a.media?.clear(),this.telephony.stopPlayback(a.session.id),a.playback]);await this.stt.endSession(a.session.id);await this.repo.endSession(a.session.id,reason);const status=a.terminalStatus??(reason==="PROVIDER_FAILURE"?"FAILED":"COMPLETED");await this.repo.updateCall(a.callId,{status,language:a.language,terminationReason:reason,end:true});await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"CALL_ENDED",metadata:{reason}});}finally{await Promise.allSettled([a.media?.close()]);this.active.delete(a.session.id);}}
 private async interrupt(a:Active){a.turn++;a.controller?.abort();a.controller=undefined;a.playingUntil=0;await Promise.allSettled([a.media?.clear(),this.telephony.stopPlayback(a.session.id),a.playback]);}
 private current(a:Active){return this.active.get(a.session.id)===a&&!a.ended;}
 private isTurn(a:Active,turn:number,c:AbortController){return this.current(a)&&a.turn===turn&&!c.signal.aborted;}
 private require(id:string){const a=this.active.get(id);if(!a||a.ended)throw new Error("Unknown voice session");return a;}
 private async fail(a:Active,error:unknown){if(!this.current(a))return;a.terminalStatus="FAILED";await this.repo.event({callId:a.callId,sessionId:a.session.id,restaurantId:a.restaurantId,type:"ERROR",metadata:{category:"provider_failure",message:safeError(error)}});try{await this.end(a.session.id,"PROVIDER_FAILURE");}finally{void error;}}
 private async withTimeout<T>(work:Promise<T>,ms:number,controller:AbortController):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<T>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error("Voice provider timeout"));},ms);})]);}finally{if(timer)clearTimeout(timer);}}
 activeCount(){return this.active.size;}
}
