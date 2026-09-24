import { randomUUID } from "node:crypto";
import type { Db } from "../database/db.js";
import type { Membership, Restaurant, Role, User } from "../domain/types.js";
const restaurantColumns =
  'id,name,slug,status,timezone,phone_number "phoneNumber",address,city,state,postal_code "postalCode",country,created_at "createdAt",updated_at "updatedAt"';
export class Repositories {
  constructor(private db: Db) {}
  async createAuthSession(input:{userId:string;tokenId:string;tokenHash:string;expiresAt:Date}) { await this.db.query('INSERT INTO auth_sessions(id,user_id,token_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),input.userId,input.tokenId,input.tokenHash,input.expiresAt]); }
  async activeAuthSession(tokenId:string,tokenHash:string) { return (await this.db.query('SELECT 1 FROM auth_sessions WHERE token_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>NOW()',[tokenId,tokenHash])).rows.length>0; }
  async revokeAuthSession(tokenId:string,tokenHash:string) { await this.db.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE token_id=$1 AND token_hash=$2 AND revoked_at IS NULL',[tokenId,tokenHash]); }
  async claimSsoAssertion(jti:string,expiresAt:Date) { await this.db.query('DELETE FROM sso_assertions WHERE expires_at<NOW()'); try { await this.db.query('INSERT INTO sso_assertions(jti,expires_at) VALUES($1,$2)',[jti,expiresAt]); return true; } catch (error) { if ((error as {code?:string}).code==='23505' || /duplicate key/i.test(String((error as Error).message))) return false; throw error; } }
  async restaurantExists(id:string) { return (await this.db.query('SELECT 1 FROM restaurants WHERE id=$1',[id])).rows.length>0; }
  async ensureMembership(userId:string,restaurantId:string,role:Role) { await this.db.query('INSERT INTO restaurant_memberships(user_id,restaurant_id,role) VALUES($1,$2,$3) ON CONFLICT (user_id,restaurant_id) DO NOTHING',[userId,restaurantId,role]); }
  async findUserByEmail(email: string) {
    return (
      await this.db.query<{ id: string; email: string; password_hash: string }>(
        "SELECT id,email,password_hash FROM users WHERE email=$1",
        [email],
      )
    ).rows[0];
  }
  async getUser(id: string): Promise<User | undefined> {
    return (
      await this.db.query<User>(
        'SELECT id,email,created_at "createdAt" FROM users WHERE id=$1',
        [id],
      )
    ).rows[0];
  }
  async createUser(email: string, passwordHash: string): Promise<User> {
    return (
      await this.db.query<User>(
        'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3) RETURNING id,email,created_at "createdAt"',
        [randomUUID(), email, passwordHash],
      )
    ).rows[0];
  }
  async createRestaurant(
    data: Pick<Restaurant, "name" | "slug" | "timezone">,
  ): Promise<Restaurant> {
    return (
      await this.db.query<Restaurant>(
        `INSERT INTO restaurants(id,name,slug,timezone) VALUES($1,$2,$3,$4) RETURNING ${restaurantColumns}`,
        [randomUUID(), data.name, data.slug, data.timezone],
      )
    ).rows[0];
  }
  async restaurantByExternalRef(externalRef: string): Promise<Restaurant | undefined> {
    return (await this.db.query<Restaurant>(`SELECT ${restaurantColumns} FROM restaurants WHERE external_ref=$1`, [externalRef])).rows[0];
  }
  // Self-serve onboarding from Locally: keyed by the Locally business id so retries are idempotent.
  async createProvisionedRestaurant(data: { externalRef: string; name: string; slug: string; timezone: string; phoneNumber?: string; address?: string; city?: string; state?: string; postalCode?: string }): Promise<Restaurant> {
    return (
      await this.db.query<Restaurant>(
        `INSERT INTO restaurants(id,name,slug,timezone,phone_number,address,city,state,postal_code,country,external_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'US',$10) RETURNING ${restaurantColumns}`,
        [randomUUID(), data.name, data.slug, data.timezone, data.phoneNumber ?? null, data.address ?? null, data.city ?? null, data.state ?? null, data.postalCode ?? null, data.externalRef],
      )
    ).rows[0];
  }
  async addMembership(userId: string, restaurantId: string, role: Role) {
    await this.db.query(
      "INSERT INTO restaurant_memberships(user_id,restaurant_id,role) VALUES($1,$2,$3)",
      [userId, restaurantId, role],
    );
  }
  async membership(
    userId: string,
    restaurantId: string,
  ): Promise<Membership | undefined> {
    return (
      await this.db.query<Membership>(
        'SELECT user_id "userId",restaurant_id "restaurantId",role FROM restaurant_memberships WHERE user_id=$1 AND restaurant_id=$2',
        [userId, restaurantId],
      )
    ).rows[0];
  }
  async restaurantsForUser(
    userId: string,
  ): Promise<(Restaurant & { role: Role })[]> {
    return (
      await this.db.query<Restaurant & { role: Role }>(
        `SELECT r.id,r.name,r.slug,r.status,r.timezone,r.phone_number "phoneNumber",r.address,r.city,r.state,r.postal_code "postalCode",r.country,r.created_at "createdAt",r.updated_at "updatedAt",m.role FROM restaurants r JOIN restaurant_memberships m ON m.restaurant_id=r.id WHERE m.user_id=$1`,
        [userId],
      )
    ).rows;
  }
  async restaurantForMember(
    userId: string,
    restaurantId: string,
  ): Promise<Restaurant | undefined> {
    return (
      await this.db.query<Restaurant>(
        `SELECT r.id,r.name,r.slug,r.status,r.timezone,r.phone_number "phoneNumber",r.address,r.city,r.state,r.postal_code "postalCode",r.country,r.created_at "createdAt",r.updated_at "updatedAt" FROM restaurants r JOIN restaurant_memberships m ON m.restaurant_id=r.id WHERE r.id=$1 AND m.user_id=$2`,
        [restaurantId, userId],
      )
    ).rows[0];
  }
}
