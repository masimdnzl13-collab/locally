import type { MessageStatus } from './contracts.js';
export function normalizeProviderStatus(status:string):MessageStatus {switch(status.toLowerCase()){case 'queued':case 'accepted':case 'sending':return 'QUEUED';case 'sent':return 'SENT';case 'delivered':return 'DELIVERED';case 'failed':return 'FAILED';case 'undelivered':return 'UNDELIVERED';default:return 'UNKNOWN'}}
