import { createHmac, timingSafeEqual } from "node:crypto";

/** X-Twilio-Signature: HMAC-SHA1(auth token, çağrılan URL + parametreler alfabetik sırayla ad+değer). */
export function validTwilioSignature(authToken: string, url: string, params: URLSearchParams, signature: string | null) {
  if (!signature) return false;
  const payload = url + Array.from(params.keys()).sort().map((k) => k + (params.get(k) ?? "")).join("");
  const expected = createHmac("sha1", authToken).update(payload).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
