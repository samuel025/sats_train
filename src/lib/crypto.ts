import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// APP_SECRET encrypts stored wallet links. In production a missing or short secret is a hard error, never a silent default.
function key() {
  const s = process.env.APP_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!s || s.length < 16 || s.startsWith("change-me")) throw new Error("APP_SECRET must be set to a random value of at least 16 characters");
  }
  return createHash("sha256").update(s || "dev-only-insecure-secret").digest();
}
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
