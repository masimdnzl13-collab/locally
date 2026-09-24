import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, decodeJwt, jwtVerify } from "jose";
import { AppError } from "../domain/errors.js";
import type { User } from "../domain/types.js";
import { Repositories } from "../repositories/repositories.js";
const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Locally (the parent product) signs short-lived SSO assertions with this same JWT_SECRET/HS256.
// iss/aud keep them distinct from session tokens: an assertion is never accepted as a bearer
// token (it has no auth_sessions row), and a session token is never accepted as an assertion.
export const SSO_ISSUER="locally", SSO_AUDIENCE="tideline-sso";
export class AuthService {
  private readonly key: Uint8Array;
  constructor(private readonly repos: Repositories, secret: string) { this.key=new TextEncoder().encode(secret); }
  async register(email:string,password:string):Promise<User> { if(await this.repos.findUserByEmail(email.toLowerCase())) throw new AppError("EMAIL_TAKEN","An account already exists for this email",409); return this.repos.createUser(email.toLowerCase(),await argon2.hash(password,{type:argon2.argon2id})); }
  async login(email:string,password:string) { const stored=await this.repos.findUserByEmail(email.toLowerCase()); if(!stored || !(await argon2.verify(stored.password_hash,password))) throw new AppError("INVALID_CREDENTIALS","Invalid email or password",401); return {user:(await this.repos.getUser(stored.id))!,token:await this.token(stored.id)}; }
  async token(userId:string) { const tokenId=randomUUID(), token=await new SignJWT({}).setProtectedHeader({alg:"HS256"}).setJti(tokenId).setSubject(userId).setIssuedAt().setExpirationTime("2h").sign(this.key); await this.repos.createAuthSession({userId,tokenId,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+2*60*60_000)}); return token; }
  async userId(token:string) { try { const p=(await jwtVerify(token,this.key,{algorithms:["HS256"]})).payload; if(!p.sub||!p.jti||!(await this.repos.activeAuthSession(p.jti,hashToken(token)))) throw new Error("invalid session"); return p.sub; } catch { throw new AppError("UNAUTHENTICATED","Authentication required",401); } }
  async exchangeSso(assertion:string) {
    const invalid=new AppError("INVALID_SSO_ASSERTION","Invalid or expired sign-in link",401);
    let p; try { p=(await jwtVerify(assertion,this.key,{algorithms:["HS256"],issuer:SSO_ISSUER,audience:SSO_AUDIENCE,maxTokenAge:"2m"})).payload; } catch { throw invalid; }
    const email=typeof p.email==="string"?p.email.trim().toLowerCase():"", restaurantId=typeof p.restaurant_id==="string"?p.restaurant_id:"";
    if(!p.jti||!p.exp||!email||!uuidPattern.test(restaurantId)) throw invalid;
    if(!(await this.repos.restaurantExists(restaurantId))) throw new AppError("SSO_RESTAURANT_NOT_FOUND","The linked restaurant was not found",404);
    if(!(await this.repos.claimSsoAssertion(p.jti,new Date(p.exp*1000)))) throw invalid;
    // SSO-only users get an unguessable password; they always sign in through Locally.
    const existing=await this.repos.findUserByEmail(email);
    const user=existing?(await this.repos.getUser(existing.id))!:await this.repos.createUser(email,await argon2.hash(randomBytes(32).toString("base64url"),{type:argon2.argon2id}));
    await this.repos.ensureMembership(user.id,restaurantId,"OWNER");
    return {user,restaurantId,token:await this.token(user.id)};
  }
  async revoke(token:string) { try { const p=decodeJwt(token); if(typeof p.jti === "string") await this.repos.revokeAuthSession(p.jti,hashToken(token)); } catch { throw new AppError("UNAUTHENTICATED","Authentication required",401); } }
}
