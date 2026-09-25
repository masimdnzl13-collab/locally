// PayPal'da ABD aboneliği için ürün + aylık Billing Plan oluşturur ve plan
// kimliğini yazdırır (PAYPAL_US_PLAN_ID olarak .env.local'e / Vercel'e girilir).
// Bir kez çalıştırılır; her çalıştırma YENİ bir plan oluşturur.
//
//   node --env-file=.env.local scripts/paypal-setup-plan.mjs
//
// Varsayılan sandbox. Fiyat lib/us/config.ts US_MONTHLY_PRICE_USD ile aynı
// olmalı (PLAN_PRICE_USD ile değiştirilebilir).

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const live = process.env.PAYPAL_ENV === "live";
const price = process.env.PLAN_PRICE_USD ?? "199.00";

if (!clientId || !clientSecret) {
  console.error("PAYPAL_CLIENT_ID ve PAYPAL_CLIENT_SECRET gerekli.");
  process.exit(1);
}
if (live && process.env.PAYPAL_LIVE_MODE !== "true") {
  console.error("PAYPAL_ENV=live için PAYPAL_LIVE_MODE=true da gerekli.");
  process.exit(1);
}

const base = live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function call(path, init = {}) {
  const res = await fetch(`${base}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${init.method ?? "GET"} ${path} → ${res.status}`, JSON.stringify(body, null, 2));
    process.exit(1);
  }
  return body;
}

const { access_token: token } = await call("/v1/oauth2/token", {
  method: "POST",
  headers: {
    authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    "content-type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const json = (body) => ({
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" },
  body: JSON.stringify(body),
});

const product = await call(
  "/v1/catalogs/products",
  json({ name: "Locally for restaurants", description: "AI ordering assistant + dedicated phone number", type: "SERVICE", category: "SOFTWARE" }),
);
const plan = await call(
  "/v1/billing/plans",
  json({
    product_id: product.id,
    name: "Locally monthly",
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: price, currency_code: "USD" } },
      },
    ],
    payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
  }),
);

console.log(`${live ? "LIVE" : "SANDBOX"} plan oluşturuldu.`);
console.log(`PAYPAL_US_PLAN_ID=${plan.id}`);
