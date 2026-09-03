import { serverEnv } from "@/lib/env/server.env";

const PASSWORD_CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";
const IV_BYTES = 12;

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
  return toBase64(buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
 * 密码摘要：salt(16B 十六进制) + ":" + sha256(salt + password)。
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

async function signUnlock(env: Env, postId: number, passwordHash: string): Promise<string> {
  const key = await deriveHmacKey(env);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${postId}:${passwordHash}`),
  );
  return toBase64Url(mac);
}

/**
 * 文章解锁令牌：`{postId}.{HMAC(postId:passwordHash)}`。
 * - 绑定 passwordHash：改密码即旧令牌失效；令牌不携带明文口令。
 * - 冷启动验证安全：靠带密钥的 HMAC，无需持久化。
 */
export async function createUnlockToken(
  env: Env,
  postId: number,
  passwordHash: string,
): Promise<string> {
  return `${postId}.${await signUnlock(env, postId, passwordHash)}`;
}

export async function isUnlockTokenValid(
  env: Env,
  token: string,
  postId: number,
  passwordHash: string,
): Promise<boolean> {
  const separatorIndex = token.indexOf(".");
  if (separatorIndex < 0) return false;
  if (token.slice(0, separatorIndex) !== String(postId)) return false;

  const actual = token.slice(separatorIndex + 1);
  const expected = await signUnlock(env, postId, passwordHash);
  return timingSafeEqual(actual, expected);
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