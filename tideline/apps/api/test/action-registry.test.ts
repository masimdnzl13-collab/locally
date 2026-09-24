import { describe, expect, it } from 'vitest';
import { ActionRegistry } from '../src/ai/action-registry.js';
import type { Db } from '../src/database/db.js';

const restaurantId='00000000-0000-0000-0000-000000000001';
const itemId='00000000-0000-0000-0000-000000000002';
const fakeQuery=async (sql:string)=>{
 if(sql.includes('SELECT id,name,price_cents')) return {rows:[{id:itemId,name:'Soup',price_cents:1250,available:true}]};
 if(sql.includes('SELECT tax_basis')) return {rows:[{tax_basis_points:800,currency:'USD',accept_orders:true,allowed_order_types:['PICKUP']}]};
 return {rows:[]};
};
const fakeDb={query:fakeQuery,connect:async()=>({query:fakeQuery,release:()=>{}}),end:async()=>{}} as unknown as Db;
const brain={greeting:{EN:'Hello'},hours:{monday:['09:00-17:00']},menu:[{id:itemId,name:'Soup',priceCents:1250}],policies:{},seasonalStatus:'ACTIVE',seasonalClosedMessage:{},humanTransfer:{enabled:true}};
const context={restaurantId,actorType:'AI' as const,idempotencyKey:'test-action'};

describe('ActionRegistry domain wiring',()=>{
 it('registers all reservation and order actions without placeholders',()=>{const names=new ActionRegistry(fakeDb).definitions().map(x=>x.name);expect(names).toEqual(expect.arrayContaining(['check_reservation_availability','create_reservation','find_reservation','modify_reservation','cancel_reservation','calculate_order','create_order','find_order','modify_order','cancel_order']));expect(JSON.stringify(names)).not.toContain('REQUIRES_ACTION_ENGINE');});
 it('validates and executes calculate_order through OrderEngine',async()=>{const registry=new ActionRegistry(fakeDb);const result=await registry.execute('calculate_order',{customerName:'A',customerPhone:'+15551234567',orderType:'PICKUP',items:[{menuItemId:itemId,quantity:2,modifiers:[]}]},brain,context);expect(result).toMatchObject({subtotalCents:2500,taxCents:200,totalCents:2700,currency:'USD'});});
 it('rejects malformed action input deterministically',async()=>{const registry=new ActionRegistry(fakeDb);await expect(registry.execute('calculate_order',{items:[]},brain,context)).rejects.toMatchObject({code:'INVALID_ACTION_INPUT',statusCode:400});});
 it('rejects unknown and unauthorized actions without executing them',async()=>{const registry=new ActionRegistry(fakeDb);await expect(registry.execute('drop_database',{},brain,context)).rejects.toMatchObject({code:'UNKNOWN_ACTION'});await expect(registry.execute('calculate_order',{customerName:'A',customerPhone:'+15551234567',orderType:'PICKUP',items:[{menuItemId:itemId,quantity:1,modifiers:[]} ]},brain,{...context,restaurantId:''})).rejects.toMatchObject({code:'ACTION_CONTEXT_REQUIRED'});});
 it('rejects model tenant overrides and destructive calls without confirmation',async()=>{const registry=new ActionRegistry(fakeDb);await expect(registry.execute('calculate_order',{restaurantId:'00000000-0000-0000-0000-000000000099',customerName:'A',customerPhone:'+15551234567',orderType:'PICKUP',items:[]},brain,context)).rejects.toMatchObject({code:'INVALID_ACTION_INPUT'});await expect(registry.execute('cancel_order',{orderId:itemId,confirmationId:undefined},brain,context)).rejects.toMatchObject({code:'INVALID_ACTION_INPUT'});});
 it('uses the same idempotency key for repeated mutation calls',async()=>{const registry=new ActionRegistry(fakeDb);const key={...context,idempotencyKey:'same-request'};await expect(registry.execute('cancel_order',{orderId:itemId,confirmationId:'00000000-0000-0000-0000-000000000003'},brain,key)).rejects.toMatchObject({code:'CONFIRMATION_REQUIRED'});});
});
describe('ActionRegistry domain inputs',()=>{
 it('never forwards routing fields to the strict domain schemas',async()=>{
  const seen:Record<string,unknown>[]=[];
  const reservations={createReservation:async(_c:unknown,input:Record<string,unknown>)=>{seen.push(input);return {success:true};},modifyReservation:async(_c:unknown,_id:string,input:Record<string,unknown>)=>{seen.push(input);return {success:true};}} as never;
  const orders={create:async(_r:string,input:Record<string,unknown>)=>{seen.push(input);return {success:true};},modify:async(_r:string,_id:string,input:Record<string,unknown>)=>{seen.push(input);return {success:true};}} as never;
  const txDb={query:async(sql:string,values:unknown[]=[])=>sql.startsWith('INSERT INTO action_idempotency')?{rows:[{response:null,status:'PROCESSING',action:values[1]}]}:{rows:[]},connect:async()=>({query:async(sql:string,values:unknown[]=[])=>sql.startsWith('INSERT INTO action_idempotency')?{rows:[{response:null,status:'PROCESSING',action:values[1]}]}:{rows:[]},release:()=>{}}),end:async()=>{}} as unknown as Db;
  const registry=new ActionRegistry(txDb,reservations,orders);
  const confirmationId='00000000-0000-4000-8000-000000000009';
  const guest={guestName:'Ana',guestPhone:'+15551234567',partySize:2,date:'2026-10-01',time:'19:00'};
  const order={customerName:'A',customerPhone:'+15551234567',orderType:'PICKUP',items:[{menuItemId:itemId,quantity:1,modifiers:[]}]};
  await registry.execute('create_reservation',{...guest,confirmationId},brain,{...context,idempotencyKey:'a',confirmationId});
  await registry.execute('modify_reservation',{...guest,reservationId:itemId,confirmationId},brain,{...context,idempotencyKey:'b',confirmationId});
  await registry.execute('create_order',{...order,confirmationId},brain,{...context,idempotencyKey:'c',confirmationId});
  await registry.execute('modify_order',{...order,orderId:itemId,confirmationId},brain,{...context,idempotencyKey:'d',confirmationId});
  for(const input of seen){expect(input).not.toHaveProperty('confirmationId');expect(input).not.toHaveProperty('reservationId');expect(input).not.toHaveProperty('orderId');}
  expect(seen).toHaveLength(4);
 });
 it('exposes JSON-schema tools without the server-issued confirmationId',()=>{
  const defs=new ActionRegistry(fakeDb).llmDefinitions();
  const modifyOrder=defs.find(d=>d.name==='modify_order')!.inputSchema as {type:string;properties:Record<string,unknown>;required:string[]};
  expect(modifyOrder.type).toBe('object');
  expect(modifyOrder.properties).toHaveProperty('orderId');
  expect(modifyOrder.properties).not.toHaveProperty('confirmationId');
  expect(modifyOrder.required).not.toContain('confirmationId');
 });
});
