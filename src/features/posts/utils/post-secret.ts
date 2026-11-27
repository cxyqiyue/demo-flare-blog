import { serverEnv } from "@/lib/env/server.env";

const PASSWORD_CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";
const IV_BYTES = 12;
export const UNLOCK_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer): string {
  return toBase64(buffer)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** 恒时字符串比较，避免时间侧信道 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/** 生成高强度随机密码（WebCrypto，去易混字符） */
export async function generateStrongPassword(length = 24): Promise<string> {
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);
  let password = "";
  for (const byte of random) {
    password += PASSWORD_CHARSET[byte % PASSWORD_CHARSET.length];
  }
  return password;
}

/**
 * 密码摘要：base64(salt[16B]) + ":" + sha256(base64(salt) + ":" + password)。
 * 只用于服务端校验，绝不落明文。
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const digest = await sha256Hex(`${toBase64(salt.buffer)}:${password}`);
  return `${toBase64(salt.buffer)}:${digest}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  if (!storedHash) return false;

  const separatorIndex = storedHash.indexOf(":");
  if (separatorIndex < 0) return false;

  const salt = storedHash.slice(0, separatorIndex);
  const expected = storedHash.slice(separatorIndex + 1);
  const digest = await sha256Hex(`${salt}:${password}`);

  return timingSafeEqual(digest, expected);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

async function deriveKey(env: Env): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(serverEnv(env).BETTER_AUTH_SECRET);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function deriveHmacKey(env: Env): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(serverEnv(env).BETTER_AUTH_SECRET);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signUnlock(
  env: Env,
  postId: number,
  passwordHash: string,
  expiresAt: number,
): Promise<string> {
  const key = await deriveHmacKey(env);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `post-unlock:v2:${postId}:${passwordHash}:${expiresAt}`,
    ),
  );
  return toBase64Url(mac);
}

/** Signed, expiring grants are revoked whenever the Post password changes. */
export async function createUnlockToken(
  env: Env,
  postId: number,
  passwordHash: string,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + UNLOCK_TOKEN_TTL_SECONDS;
  return `${postId}.${expiresAt}.${await signUnlock(env, postId, passwordHash, expiresAt)}`;
}

export async function isUnlockTokenValid(
  env: Env,
  token: string,
  postId: number,
  passwordHash: string,
): Promise<boolean> {
  const match = /^(\d+)\.(\d+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || match[1] !== String(postId)) return false;
  const expiresAt = Number(match[2]);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + UNLOCK_TOKEN_TTL_SECONDS
  )
    return false;
  return timingSafeEqual(
    match[3],
    await signUnlock(env, postId, passwordHash, expiresAt),
  );
}

/** AES-256-GCM 加密访问密码（供管理端展示）。返回 base64(iv):base64(ciphertext+tag) */
export async function encryptPassword(
  password: string,
  env: Env,
): Promise<string> {
  const key = await deriveKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(password),
  );
  return `${toBase64(iv.buffer)}:${toBase64(ciphertext)}`;
}

export async function decryptPassword(
  cipherValue: string | null,
  env: Env,
): Promise<string | null> {
  if (!cipherValue) return null;

  const separatorIndex = cipherValue.indexOf(":");
  if (separatorIndex < 0) return null;

  const iv = fromBase64(cipherValue.slice(0, separatorIndex));
  const ciphertext = fromBase64(cipherValue.slice(separatorIndex + 1));

  try {
    const key = await deriveKey(env);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
