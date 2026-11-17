// Creates (or tops up) a funded SANDBOX wallet for the demo tasks, via Alby's NWC faucet. Play money, not real bitcoin.
//   npm run demo:wallet            create a wallet and write DEMO_NWC into .env.local
//   npm run demo:wallet -- topup   add more sandbox sats to the existing one
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = ".env.local";
const env = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";
const line = env.split("\n").find((l) => l.startsWith("DEMO_NWC="));
const faucet = "https://faucet.nwc.dev";

if (process.argv[2] === "topup") {
  if (!line) { console.error("No DEMO_NWC in .env.local yet. Run `npm run demo:wallet` first."); process.exit(1); }
  const lud = new URL(line.slice(9).trim().replace("nostr+walletconnect://", "http://x/")).searchParams.get("lud16");
  const id = lud?.split("@")[0];
  const r = await fetch(`${faucet}/wallets/${id}/topup?amount=10000`, { method: "POST" });
  console.log(r.ok ? "Added 10,000 sandbox sats." : `Top-up failed (${r.status}).`);
  process.exit(r.ok ? 0 : 1);
}

const r = await fetch(`${faucet}?balance=10000`, { method: "POST" });
const nwc = (await r.text()).trim();
if (!r.ok || !nwc.startsWith("nostr+walletconnect://")) { console.error("Faucet did not return a wallet link:", r.status); process.exit(1); }
const next = line ? env.replace(line, `DEMO_NWC=${nwc}`) : `${env.replace(/\n*$/, "\n")}DEMO_NWC=${nwc}\n`;
writeFileSync(FILE, next);
console.log("Created a sandbox demo wallet with 10,000 sats and saved DEMO_NWC to .env.local.");
console.log("Set the same DEMO_NWC, plus SEED_DEMO=1, in your host's environment variables.");
