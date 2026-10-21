/** WebCrypto helpers: sha256, base64url, AES-GCM session encryption (R7), CSRF HMAC. */

const te = new TextEncoder();

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data =
    typeof input === "string"
      ? te.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 12-char lowercase hex prefix of sha256 (safe for logs). */
export async function sha256Prefix12(input: string): Promise<string> {
  return (await sha256Hex(input)).slice(0, 12);
}

export function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

export function randomId32(): string {
  return bytesToBase64Url(randomBytes(32));
}

function parseKeyMaterial(b64: string): Uint8Array {
  // SESSION_ENC_KEY is 32-byte key as standard or url-safe base64.
  try {
    return base64UrlToBytes(b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  } catch {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
}

async function importAesKey(b64: string): Promise<CryptoKey> {
  const raw = parseKeyMaterial(b64);
  if (raw.byteLength !== 32) {
    throw new Error("SESSION_ENC_KEY must be 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** kid = first 8 hex of sha256(key material). */
export async function keyId(b64: string): Promise<string> {
  return (await sha256Hex(parseKeyMaterial(b64))).slice(0, 8);
}

/**
 * R7: encrypt plaintext with AES-256-GCM.
 * Format: v1.<kid>.<iv>.<ct> (base64url parts). AAD = session instance name.
 */
export async function encryptSessionPayload(
  plaintext: string,
  aad: string,
  encKeyB64: string,
): Promise<string> {
  const key = await importAesKey(encKeyB64);
  const kid = await keyId(encKeyB64);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: te.encode(aad) },
    key,
    te.encode(plaintext),
  );
  return `v1.${kid}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ct)}`;
}

export async function decryptSessionPayload(
  blob: string,
  aad: string,
  encKeyB64: string,
  prevKeyB64?: string,
): Promise<string | null> {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, kid, ivB64, ctB64] = parts;
  if (!kid || !ivB64 || !ctB64) return null;
  const iv = base64UrlToBytes(ivB64);
  const ct = base64UrlToBytes(ctB64);
  const tryKeys: string[] = [encKeyB64];
  if (prevKeyB64) tryKeys.push(prevKeyB64);
  for (const k of tryKeys) {
    try {
      const thisKid = await keyId(k);
      if (thisKid !== kid && k === encKeyB64 && prevKeyB64) {
        // allow either kid match
      }
      if (thisKid !== kid) continue;
      const key = await importAesKey(k);
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: te.encode(aad) },
        key,
        ct,
      );
      return new TextDecoder().decode(pt);
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(message));
  return bytesToBase64Url(sig);
}

/** Constant-time string compare for CSRF tokens. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return out === 0;
}

export async function csrfForPre(secret: string, pre: string): Promise<string> {
  return hmacSha256Base64Url(secret, `v1.${pre}`);
}

export async function csrfForSid(secret: string, sid: string): Promise<string> {
  return hmacSha256Base64Url(secret, `v1.sid.${sid}`);
}
