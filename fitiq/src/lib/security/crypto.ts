import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM field encryption for sensitive user data (body measurements,
 * size map). Used by the Prisma persistence layer before writing to Postgres.
 * ENCRYPTION_KEY must be 32 bytes, base64-encoded.
 */
function key(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("ENCRYPTION_KEY is required to store sensitive fields");
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes");
  return b;
}

export function encryptJSON(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptJSON<T>(payload: string): T {
  const [iv, tag, enc] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as T;
}
