// Safe handling of untrusted payment inputs. Only node built-ins, so it can be unit tested on its own.
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

// True for addresses a server must never be tricked into contacting (loopback, private, link-local, metadata, multicast...).
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff");
  }
  return true; // not an IP at all: refuse
}

// GET a JSON document over HTTPS from the public internet only.
// The address check happens inside the connection's own DNS lookup, so it cannot be bypassed by DNS rebinding.
export function publicJson(url: string, timeoutMs = 8000, maxBytes = 100_000): Promise<any> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try { u = new URL(url); } catch { return reject(new Error("bad url")); }
    if (u.protocol !== "https:" || (u.port && u.port !== "443") || u.username || u.password) return reject(new Error("only plain https urls are allowed"));
    // Node does not call the custom lookup for IP literals, so refuse them here (a real wallet is always a domain name).
    if (net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) return reject(new Error("blocked address"));
    const req = https.get(u, {
      timeout: timeoutMs,
      headers: { accept: "application/json" },
      lookup: (host: string, opts: any, cb: any) => {
        dns.lookup(host, { all: true }, (err, addrs) => {
          if (err) return cb(err);
          if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return cb(new Error("blocked address"));
          opts?.all ? cb(null, addrs) : cb(null, addrs[0].address, addrs[0].family);
        });
      },
    }, (res) => {
      if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) { res.resume(); return reject(new Error(`status ${res.statusCode}`)); } // redirects are not followed
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (c: Buffer) => { size += c.length; if (size > maxBytes) { req.destroy(); reject(new Error("response too large")); } else chunks.push(c); });
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("not json")); } });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

// Amount in millisatoshis encoded in a BOLT11 invoice, or null if it has no amount or is malformed.
export function invoiceAmountMsat(invoice: string): number | null {
  const m = /^ln(?:bc|tbs|tb|bcrt)(\d+)([munp]?)1/i.exec(invoice.trim());
  if (!m) return null;
  const mult = { "": 1, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 }[m[2].toLowerCase() as "" | "m" | "u" | "n" | "p"];
  const msat = Number(m[1]) * mult * 1e11; // 1 BTC = 1e11 msat
  return Number.isFinite(msat) ? Math.round(msat) : null;
}

// Wallet-link permissions (NIP-47 methods). A link that can move money must never be stored by a server we run.
const SPENDING = ["pay_invoice", "pay_keysend", "multi_pay_invoice", "multi_pay_keysend"];
export const spendingMethods = (methods: string[]) => methods.filter((m) => SPENDING.includes(m));
export const canSpend = (methods: string[]) => spendingMethods(methods).length > 0;
