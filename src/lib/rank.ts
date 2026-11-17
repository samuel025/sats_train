import { createHash } from "node:crypto";

// Ranking: show the two replies in a per-worker order so position bias doesn't leak into the data.
export const swapFor = (itemId: string, pk: string) => parseInt(createHash("sha256").update(itemId + pk).digest("hex").slice(0, 2), 16) % 2 === 1;
