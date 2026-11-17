"use client";
import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Fades and lifts content in when it scrolls into view. The hidden state is only applied after mount,
// so content is never invisible if JavaScript fails.
export function Reveal({ children, delay = 0, as = "div", className = "" }: { children: ReactNode; delay?: number; as?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"ssr" | "hidden" | "in">("ssr");
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) { setState("in"); return; }
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) { setState("in"); return; } // already on screen: no flash
    setState("hidden");
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState("in"); io.disconnect(); } }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return createElement(as, { ref, className: `${state === "ssr" ? "" : "reveal"} ${state === "in" ? "in" : ""} ${className}`.trim(), style: { "--d": `${delay}ms` } as React.CSSProperties }, children);
}

// Counts up to a number once visible.
export function CountUp({ to, suffix = "", ms = 1100 }: { to: number; suffix?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) return;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el); return () => io.disconnect();
  }, [to, ms]);
  return <span ref={ref}>{v}{suffix}</span>;
}

const SENTENCE = "How you dey today?";

// Hero demo: a worker types an answer, it is accepted, and the payment lands. Loops.
export function HeroDemo() {
  const [typed, setTyped] = useState(SENTENCE.length);
  const [stage, setStage] = useState(3); // 0 typing, 1 accepted, 2 payment, 3 final/static
  const [sats, setSats] = useState(200);
  useEffect(() => {
    if (reduced()) return;
    let dead = false; const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !dead && fn(), ms));
    const run = () => {
      setTyped(0); setStage(0); setSats(0);
      SENTENCE.split("").forEach((_, i) => at(900 + i * 60, () => setTyped(i + 1)));
      const t1 = 900 + SENTENCE.length * 60 + 500;
      at(t1, () => setStage(1));
      at(t1 + 900, () => { setStage(2); const t0 = performance.now(); const step = (t: number) => { if (dead) return; const p = Math.min(1, (t - t0) / 900); setSats(Math.round(200 * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
      at(t1 + 5200, run);
    };
    run();
    return () => { dead = true; timers.forEach(clearTimeout); };
  }, []);
  return (
    <div className="lp-widget" aria-label="Example task and payout">
      <div className="card float lp-w1 floaty">
        <div className="label">Translate into Nigerian Pidgin</div>
        <p className="prompt" style={{ margin: "10px 0 16px" }}>“How are you doing today?”</p>
        <div className="lp-input">{SENTENCE.slice(0, typed)}{stage === 0 && <span className="caret" />}</div>
        <div style={{ marginTop: 16, minHeight: 26 }}>
          <span className={`pill paid pop ${stage >= 1 ? "on" : ""}`}>Accepted</span>
          <span className={`pill pop ${stage >= 1 ? "on" : ""}`} style={{ transitionDelay: "90ms" }}>⚡ 200 sats</span>
          <span className={`pill pop ${stage >= 1 ? "on" : ""}`} style={{ transitionDelay: "180ms" }}>2 peers agree</span>
        </div>
      </div>
      <div className={`card float lp-w2 toast ${stage >= 2 ? "on" : ""}`}>
        <div className="label">Payment sent</div>
        <div className="amount" style={{ margin: "8px 0 4px" }}>+{sats} <small>sats</small></div>
        <div className="mono muted">→ amara@wallet.example</div>
      </div>
    </div>
  );
}
