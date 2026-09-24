export type CallStatus = 'RINGING'|'IN_PROGRESS'|'COMPLETED'|'FAILED'|'NO_ANSWER'|'BUSY'|'TRANSFERRED';
export type CallEventType = 'CALL_STARTED'|'CALL_ANSWERED'|'LANGUAGE_DETECTED'|'SPEECH_STARTED'|'SPEECH_ENDED'|'AI_RESPONSE_STARTED'|'AI_RESPONSE_ENDED'|'TOOL_CALLED'|'TOOL_COMPLETED'|'HUMAN_TRANSFER_REQUESTED'|'CALL_ENDED'|'ERROR'|'MEDIA_STREAM_STARTED'|'MEDIA_STREAM_STOPPED';
export type Language = 'en'|'es';
export type CallSession = { id:string; callId:string; restaurantId:string; state:string; language?:Language; activeIntent?:string; startedAt:Date; endedAt?:Date; terminationReason?:string };
export type VoiceTurnContext = { restaurantId:string; callId:string; sessionId:string; language:Language; transcript:string; conversationState:Record<string,unknown>; restaurantContext:Record<string,unknown>; currentIntent?:string };
export type VoiceTurnResult = { responseText:string; nextState:string; intent?:string; language?:Language; actions:Array<{type:string; payload:Record<string,unknown>}>; shouldTransfer?:boolean; transferTo?:string; shouldEndCall?:boolean };
export interface VoiceAIEngine { respond(context:VoiceTurnContext, signal?:AbortSignal):Promise<VoiceTurnResult>; }
export type SpeechTranscriptEvent = { sessionId:string; text:string; isFinal:boolean; confidence?:number; language?:Language; sequence?:number };
export type SpeechSessionInput = { sessionId:string; language?:Language; onTranscript:(event:SpeechTranscriptEvent)=>void|Promise<void>; onError?:(error:unknown)=>void|Promise<void>; onClosed?:()=>void|Promise<void> };
export interface SpeechToTextProvider {
  startSession(input:SpeechSessionInput, signal?:AbortSignal):Promise<void>;
  sendAudio(sessionId:string,audio:Buffer, signal?:AbortSignal):Promise<void>;
  endSession(sessionId:string, signal?:AbortSignal):Promise<void>;
}
/** `mulaw` is 8 kHz G.711 μ-law, ready for Twilio; `pcm_s16le` is converted before playback. */
export type TtsAudio = { buffer:Buffer; encoding:"pcm_s16le"|"mulaw"; sampleRateHz:number; channels:1 };
export interface TextToSpeechProvider { synthesize(input:{text:string; voice:string; language:Language}, signal?:AbortSignal):Promise<TtsAudio>; }
export interface VoiceMediaSink { sendAudio(audio:Buffer):Promise<unknown>; clear():Promise<void>; close():Promise<void>; }
export interface TelephonyProvider {
  incomingResponse(input:{streamUrl:string; greeting?:string; transferNumber?:string; parameters?:Record<string,string>}):string;
  stopPlayback(sessionId:string):Promise<void>;
  /** Redirects a live call to a human. `providerCallId` is the Twilio CallSid. */
  transfer(input:{providerCallId:string; targetNumber:string}):Promise<void>;
  /** Ends a live call. */
  hangup?(providerCallId:string):Promise<void>;
}
export interface TelephonyTransferService { transferToHuman(session:CallSession, targetNumber:string):Promise<void>; }
