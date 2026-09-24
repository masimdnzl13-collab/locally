import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";

// P3 — SSO köprüsü. Tideline API'si (tideline/apps/api) oturum JWT'lerini
// jose ile HS256 + JWT_SECRET kullanarak imzalıyor; burada AYNI sır ve
// algoritmayla, ama iss="locally" / aud="tideline-sso" iddialarıyla kısa
// ömürlü bir "SSO assertion" üretiyoruz. Tideline bunu doğrudan bearer token
// olarak KABUL ETMEZ (her Tideline oturumu kendi auth_sessions satırını
// gerektiriyor) — Tideline web'in /sso adımı bunu POST /api/v1/auth/sso ile
// bir kez, normal bir Tideline oturumuna çevirir (tek kullanımlık, jti ile).
export const TIDELINE_SSO_TTL_SECONDS = 60;

export function getTidelineConfig() {
  const secret = process.env.TIDELINE_JWT_SECRET;
  const webUrl = process.env.TIDELINE_WEB_URL ?? "http://localhost:5173";
  if (!secret || secret.length < 32) return null;
  return { secret, webUrl: webUrl.replace(/\/+$/, "") };
}

export async function mintTidelineAssertion(input: {
  secret: string;
  locallyUserId: string;
  email: string;
  tidelineRestaurantId: string;
}): Promise<string> {
  return new SignJWT({
    email: input.email.trim().toLowerCase(),
    restaurant_id: input.tidelineRestaurantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("locally")
    .setAudience("tideline-sso")
    .setSubject(input.locallyUserId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${TIDELINE_SSO_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(input.secret));
}
