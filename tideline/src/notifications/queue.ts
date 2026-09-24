import { Queue } from 'bullmq';
import type { Db } from '../db/database.js';
export const notificationQueueName='notifications';
export function createNotificationQueue(){const url=new URL(process.env.REDIS_URL??'redis://localhost:6379');return new Queue(notificationQueueName,{connection:{host:url.hostname,port:Number(url.port||6379),password:url.password||undefined},defaultJobOptions:{attempts:4,backoff:{type:'exponential',delay:1000},removeOnComplete:1000,removeOnFail:5000}})}
export function enqueueNotification(db:Db,queue:Queue,notificationId:string){const row=db.prepare('SELECT id FROM notifications WHERE id=?').get(notificationId) as {id:string}|undefined;if(!row)throw new Error('Notification not found');return queue.add('deliver', {notificationId}, {jobId:notificationId});}
