import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const COOKIE_NAME = "guesstify_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function key(): Buffer {
  const secret = import.meta.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return createHash("sha256").update(secret).digest();
}

export function encodeSession(session: SpotifySession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decodeSession(value: string | undefined): SpotifySession | null {
  if (!value) return null;
  try {
    const body = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), body.subarray(0, 12));
    decipher.setAuthTag(body.subarray(12, 28));
    const parsed: unknown = JSON.parse(Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]).toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const session = parsed as Partial<SpotifySession>;
    return typeof session.accessToken === "string" && typeof session.refreshToken === "string" && typeof session.expiresAt === "number" ? session as SpotifySession : null;
  } catch {
    return null;
  }
}

export function sessionCookie(value: string, maxAge = MAX_AGE_SECONDS, secure = true): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function getSessionCookieName(): string { return COOKIE_NAME; }
