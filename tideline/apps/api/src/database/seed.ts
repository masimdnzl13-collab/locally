import { randomUUID } from 'node:crypto'; import argon2 from 'argon2'; import { createDb } from './db.js'; import { migrate } from './migrate.js'; import { loadEnv } from '../config/env.js';
const db = createDb(loadEnv().DATABASE_URL); await migrate(db);
const userId = randomUUID(), restaurantId = randomUUID();
await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING',[userId,'owner@example.test',await argon2.hash('DevPassword123!',{type:argon2.argon2id})]);
const owner = await db.query<{id:string}>('SELECT id FROM users WHERE email=$1',['owner@example.test']);
await db.query("INSERT INTO restaurants(id,name,slug,timezone) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO NOTHING",[restaurantId,'Demo Bistro','demo-bistro','Europe/Istanbul']);
const restaurant = await db.query<{id:string}>('SELECT id FROM restaurants WHERE slug=$1',['demo-bistro']);
await db.query('INSERT INTO restaurant_memberships(user_id,restaurant_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[owner.rows[0].id,restaurant.rows[0].id,'OWNER']);

const rid = restaurant.rows[0].id;
const existingCalls = await db.query<{ count: string }>('SELECT count(*) FROM calls WHERE restaurant_id=$1', [rid]);
if (Number(existingCalls.rows[0].count) === 0) {
  const callStatuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'NO_ANSWER', 'FAILED'];
  const intents = ['RESERVATION', 'ORDER', 'HOURS_QUESTION', 'MENU_QUESTION', 'GENERAL'];
  const callIds: string[] = [];
  for (let i = 0; i < 34; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const status = callStatuses[Math.floor(Math.random() * callStatuses.length)];
    const completed = status === 'COMPLETED';
    const duration = completed ? 30 + Math.floor(Math.random() * 240) : null;
    const id = randomUUID();
    callIds.push(id);
    await db.query(
      `INSERT INTO calls(id,restaurant_id,provider,provider_call_id,caller_phone_number,called_phone_number,direction,status,started_at,answered_at,ended_at,duration_seconds,language,initial_intent)
       VALUES($1,$2,'twilio',$3,$4,'+15550001000','INBOUND',$5,NOW()-($6||' days')::interval-(random()*20)::int*INTERVAL '1 hour',
         CASE WHEN $7 THEN NOW()-($6||' days')::interval ELSE NULL END,
         CASE WHEN $7 THEN NOW()-($6||' days')::interval ELSE NULL END,
         $8,'EN',$9)`,
      [id, rid, `demo-call-${i}`, `+1555010${String(1000 + i).slice(-4)}`, status, daysAgo, completed, duration, intents[Math.floor(Math.random() * intents.length)]],
    );
  }
  const orderStatuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'CONFIRMED', 'CANCELLED'];
  const customers = ['Ayşe Yılmaz', 'John Carter', 'Maria Silva', 'Kenji Tanaka', 'Liam O’Brien', 'Fatima Khan'];
  for (let i = 0; i < 18; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
    const subtotal = 1200 + Math.floor(Math.random() * 6000);
    const tax = Math.round(subtotal * 0.08);
    await db.query(
      `INSERT INTO orders(id,restaurant_id,order_number,status,customer_name,customer_phone,order_type,subtotal_cents,tax_cents,total_cents,currency,source,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'USD','AI_PHONE',NOW()-($11||' days')::interval,NOW()-($11||' days')::interval)`,
      [randomUUID(), rid, `ORD-${1000 + i}`, status, customers[i % customers.length], `+1555020${String(1000 + i).slice(-4)}`, i % 3 === 0 ? 'DINE_IN' : 'PICKUP', subtotal, tax, subtotal + tax, daysAgo],
    );
  }
  const reservationStatuses = ['CONFIRMED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  for (let i = 0; i < 12; i++) {
    const offsetDays = Math.floor(Math.random() * 20) - 10;
    const status = reservationStatuses[Math.floor(Math.random() * reservationStatuses.length)];
    await db.query(
      `INSERT INTO reservations(id,restaurant_id,confirmation_code,status,guest_name,guest_phone,party_size,reservation_date,reservation_time,duration_minutes,source,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE+($8||' days')::interval,$9,90,'AI_PHONE',NOW()-(random()*10||' days')::interval)`,
      [randomUUID(), rid, `RES-${2000 + i}`, status, customers[i % customers.length], `+1555030${String(1000 + i).slice(-4)}`, 2 + (i % 6), offsetDays, `${18 + (i % 4)}:00:00`],
    );
  }
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const sent = Math.random() > 0.15;
    const outboxId = randomUUID();
    const aggregateId = randomUUID();
    await db.query(
      `INSERT INTO outbox_events(id,restaurant_id,event_type,aggregate_type,aggregate_id,payload,status,processed_at,created_at)
       VALUES($1,$2,'RESERVATION_CONFIRMED','reservation',$3,'{}','PROCESSED',NOW()-($4||' days')::interval,NOW()-($4||' days')::interval)`,
      [outboxId, rid, aggregateId, daysAgo],
    );
    await db.query(
      `INSERT INTO notifications(id,restaurant_id,outbox_event_id,event_type,recipient_phone,status,idempotency_key,body,provider_message_id,created_at,sent_at)
       VALUES($1,$2,$3,'RESERVATION_CONFIRMED',$4,$5,$6,'Your reservation is confirmed.',$7,NOW()-($8||' days')::interval,CASE WHEN $5='SENT' THEN NOW()-($8||' days')::interval ELSE NULL END)`,
      [randomUUID(), rid, outboxId, `+1555040${String(1000 + i).slice(-4)}`, sent ? 'SENT' : 'FAILED', `demo-notif-${i}`, sent ? `SM${1000 + i}` : null, daysAgo],
    );
  }
  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const inputTokens = 200 + Math.floor(Math.random() * 800);
    const outputTokens = 100 + Math.floor(Math.random() * 400);
    await db.query(
      `INSERT INTO ai_usage(id,restaurant_id,request_id,provider,model,input_tokens,output_tokens,total_tokens,latency_ms,estimated_cost,created_at)
       VALUES($1,$2,$3,'anthropic','claude-sonnet',$4,$5,$6,$7,$8,NOW()-($9||' days')::interval)`,
      [randomUUID(), rid, `demo-req-${i}`, inputTokens, outputTokens, inputTokens + outputTokens, 400 + Math.floor(Math.random() * 900), Number((0.0001 * (inputTokens + outputTokens)).toFixed(6)), daysAgo],
    );
  }
  console.log('Seeded demo activity data (calls, orders, reservations, notifications, AI usage)');
}

await db.end(); console.log('Development seed completed');
