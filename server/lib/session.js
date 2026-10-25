


import { SESSION_BY_HASH } from "./queries.js";

export const SESSION_COOKIE = "sn_session";
const SESSION_DAYS = 14;
const TOKEN_MINUTES = 15;


export function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}


export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}


export function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}


export function sessionCookie(token, { maxAge = SESSION_DAYS * 86400 } = {}) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export const clearedCookie = () =>
  `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;


export function originAllowed(request, env) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = String(env.APP_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!allowed.length) return false;
  return allowed.includes(origin);
}


export async function createSession(env, userId, { userAgent = "" } = {}) {
  const token = newToken();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), userId, await hashToken(token),
    now, now + SESSION_DAYS * 86400_000, now,
    String(userAgent).slice(0, 200)
  ).run();
  return token;
}


export async function currentUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(SESSION_BY_HASH)
    .bind(await hashToken(token), Date.now()).first();
  if (!row) return null;
  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.user_status,
    sessionId: row.session_id
  };
}

export async function revokeSession(env, sessionId) {
  await env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE id = ?`)
    .bind(Date.now(), sessionId).run();
}

export async function revokeAllSessions(env, userId) {
  await env.DB.prepare(
    `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`
  ).bind(Date.now(), userId).run();
}


export async function issueSignInToken(env, emailLower) {
  const token = newToken();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO auth_tokens (id, email_lower, token_hash, purpose, created_at, expires_at)
     VALUES (?, ?, ?, 'sign-in', ?, ?)`
  ).bind(crypto.randomUUID(), emailLower, await hashToken(token), now,
         now + TOKEN_MINUTES * 60_000).run();
  return { token, expiresAt: now + TOKEN_MINUTES * 60_000 };
}


export async function consumeSignInToken(env, token) {
  const hash = await hashToken(token);
  const now = Date.now();
  const result = await env.DB.prepare(
    `UPDATE auth_tokens SET consumed_at = ?
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?`
  ).bind(now, hash, now).run();
  if (!result.meta.changes) return null;
  const row = await env.DB.prepare(
    `SELECT email_lower FROM auth_tokens WHERE token_hash = ?`
  ).bind(hash).first();
  return row ? row.email_lower : null;
}
