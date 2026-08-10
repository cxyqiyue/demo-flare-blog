import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * ALTCHA 自托管 PoW 原语（纯函数，可在 Worker / 浏览器 Worker / Node 测试中共享）。
 *
 * 协议：服务端以盐 + 随机数计算 SHA-256 摘要作为 challenge，并用密钥对摘要做 HMAC 签名；
 * 客户端在 [0, maxnumber) 中搜索 number，使得 SHA-256(salt + number) 与 challenge 相等，
 * 然后把 { algorithm, challenge, number, salt, signature } 作为一次性凭证提交。
 */

export const ALTCHA_ALGORITHM = "SHA-256" as const;
export const ALTCHA_CHALLENGE_TTL_SECONDS = 300 as const;

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

export interface AltchaSolution {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  number: number;
  salt: string;
  signature: string;
}

export type AltchaPayload = AltchaChallenge | AltchaSolution;

export function sha256Hex(data: string | Uint8Array): string {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return bytesToHex(sha256(input));
}

export function hmacSha256Hex(key: string, data: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const dataBytes = new TextEncoder().encode(data);
  return bytesToHex(hmac(sha256, keyBytes, dataBytes));
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

export function randomInt(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  let value: number;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return min + (value % range);
}

export function encodeBase64Json(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeBase64Json<T>(encoded: string): T | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

/** 生成 challenge。number 不传时随机选取，保证服务端无法预知解空间。 */
export function createAltchaChallenge({
  maxNumber,
  secret,
  salt,
  number,
}: {
  maxNumber: number;
  secret: string;
  salt?: string;
  number?: number;
}): AltchaChallenge {
  const chosenSalt = salt ?? `${randomHex(12)}&`;
  const chosenNumber = number ?? randomInt(0, maxNumber);
  const challenge = sha256Hex(chosenSalt + chosenNumber);
  const signature = hmacSha256Hex(secret, challenge);
  return {
    algorithm: ALTCHA_ALGORITHM,
    challenge,
    maxnumber: maxNumber,
    salt: chosenSalt,
    signature,
  };
}

/**
 * 校验 PoW 解。通过密码学手段重放：只有持密钥方签发的 challenge 才能通过，
 * number 不能超界，且必须满足 challenge === SHA-256(salt + number)。
 */
export function verifyAltchaSolution(
  payload: AltchaSolution,
  secret: string,
): boolean {
  if (payload.algorithm !== ALTCHA_ALGORITHM) return false;
  if (
    !Number.isInteger(payload.number) ||
    payload.number < 0 ||
    payload.number > payload.maxnumber
  ) {
    return false;
  }
  if (typeof payload.salt !== "string" || payload.salt.length === 0) {
    return false;
  }
  const recomputed = sha256Hex(payload.salt + payload.number);
  if (recomputed !== payload.challenge) return false;

  const signature = hmacSha256Hex(secret, payload.challenge);
  return signature === payload.signature;
}

export function parseAltchaSolution(
  payloadBase64: string,
): AltchaSolution | null {
  const decoded = decodeBase64Json<AltchaSolution>(payloadBase64);
  if (
    !decoded ||
    decoded.challenge === undefined ||
    decoded.number === undefined
  ) {
    return null;
  }
  return decoded;
}

/**
 * 在 [start, max] 中搜索满足 challenge 的 number。
 * 分批执行并让出事件循环，可通过 signal 取消。返回解或 null。
 */
export async function solveAltchaChallenge({
  challenge,
  salt,
  max,
  start = 0,
  signal,
  batchSize = 64,
}: {
  challenge: string;
  salt: string;
  max: number;
  start?: number;
  signal?: AbortSignal;
  batchSize?: number;
}): Promise<number | null> {
  let n = start;
  while (n <= max) {
    if (signal?.aborted) return null;
    const end = Math.min(n + batchSize, max + 1);
    const batch = Array.from({ length: end - n }, (_, i) =>
      sha256Hex(salt + (n + i)),
    );
    for (let i = 0; i < batch.length; i++) {
      if (batch[i] === challenge) return n + i;
    }
    n = end;
    // 让出事件循环，保证 abort 及时生效
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return null;
}
