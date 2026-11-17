// Creates .env.local with fresh random secrets and simulated payments, so the app runs without any wallet or account.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env.local")) { console.log(".env.local already exists, leaving it alone."); process.exit(0); }
const hex = (n) => randomBytes(n).toString("hex");
const base = readFileSync(".env.example", "utf8")
  .replace(/^APP_SECRET=.*$/m, `APP_SECRET=${hex(32)}`)
  .replace(/^MOCK_PAYMENTS=.*$/m, "MOCK_PAYMENTS=1");
writeFileSync(".env.local", base.replace(/\n*$/, "\n") + `APP_NOSTR_NSEC_HEX=${hex(32)}\n`);
console.log("Created .env.local with new secrets and MOCK_PAYMENTS=1 (simulated payments).");
console.log("Next: set NEON_POSTGRES (or DATABASE_URL) to any Postgres, then run `npm run dev`.");
console.log("No Postgres handy? Use Docker instead:  npm run demo");
