"use client";
import { useEffect, useState } from "react";

let rate: { ngnPerBtc: number; source: string } | null = null;
let inflight: Promise<void> | null = null;
const load = () => (inflight ??= fetch("/api/rate").then((r) => r.json()).then((j) => { rate = j; }).catch(() => {}));

export const ngnFor = (sats: number, r = rate) => (r ? (sats / 1e8) * r.ngnPerBtc : null);
export const fmtNgn = (n: number) => "₦" + (n === 0 ? "0" : n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString());

// Small approximate naira value next to a sats amount.
export function Naira({ sats, className }: { sats: number; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => { void load().then(() => tick((x) => x + 1)); }, []);
  const n = ngnFor(sats);
  if (n === null) return null;
  return <span className={className ?? "muted small"} title="Approximate. Rates change.">≈ {fmtNgn(n)}</span>;
}
