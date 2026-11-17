import { finalizeEvent, generateSecretKey, verifyEvent, type Event } from "nostr-tools";
import { SimplePool, useWebSocketImplementation } from "nostr-tools/pool";
import WebSocket from "ws";

useWebSocketImplementation(WebSocket);

const relays = () => (process.env.NOSTR_RELAYS || "wss://relay.damus.io,wss://nos.lol").split(",");

// Best effort: relays being down never blocks the app.
export async function publishEvent(ev: Event) {
  try {
    const rs = relays();
    const pool = new SimplePool();
    await Promise.race([Promise.allSettled(pool.publish(rs, ev)), new Promise((r) => setTimeout(r, 4000))]);
    pool.close(rs);
    return ev.id;
  } catch { return null; }
}

// Verifies a requester-signed task event (their key, their signature = provenance).
export function checkTaskEvent(ev: Event, pubkey: string, taskId: string) {
  if (!ev || ev.pubkey !== pubkey || ev.kind !== 30078 || !verifyEvent(ev)) throw new Error("Task event is not signed by you");
  if (ev.tags.find((t) => t[0] === "d")?.[1] !== `sats-for-data:${taskId}`) throw new Error("Task event does not match this task");
}

// Dataset provenance: a signed event that pins the sha256 of an exported dataset to its task.
export async function attestDataset(a: { taskId: string; requester: string; sha256: string; rows: number; format: string }) {
  const sk = process.env.APP_NOSTR_NSEC_HEX ? Uint8Array.from(Buffer.from(process.env.APP_NOSTR_NSEC_HEX, "hex")) : generateSecretKey();
  const ev = finalizeEvent({
    kind: 30078, created_at: Math.floor(Date.now() / 1000),
    tags: [["d", `sats-for-data:dataset:${a.taskId}:${a.sha256.slice(0, 16)}`], ["t", "sats-for-data-dataset"], ["p", a.requester],
      ["x", a.sha256], ["task", a.taskId], ["rows", String(a.rows)], ["format", a.format]],
    content: `Dataset export of task ${a.taskId}: ${a.rows} approved rows, sha256 ${a.sha256}`,
  }, sk);
  await publishEvent(ev);
  return ev.id;
}
