import Link from "next/link";
import { Reveal, CountUp, HeroDemo } from "@/components/Motion";

const Arrow = () => <span aria-hidden>→</span>;

export default function Landing() {
  return (
    <div className="lp">
      {/* HERO: warm radial wash, poster headline */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="tag rise" style={{ "--d": "0ms" } as React.CSSProperties}>Paid in bitcoin · No bank account · Local languages</div>
          <h1 className="lp-h1 rise" style={{ "--d": "80ms" } as React.CSSProperties}>Teach AI your language. Get paid in sats.</h1>
          <p className="lead rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            Translate, record your voice, rank AI replies, or verify other speakers in Nigerian Pidgin, Yoruba and Hausa. Approved work is paid in bitcoin sats, straight to your wallet. No bank account needed.
          </p>
          <div className="lp-cta rise" style={{ "--d": "280ms" } as React.CSSProperties}>
            <Link href="/tasks" className="btn inline">Start earning <Arrow /></Link>
            <Link href="/post" className="btn inline secondary">Post a task</Link>
          </div>
          <div className="lp-trust rise" style={{ "--d": "360ms" } as React.CSSProperties}><span>Instant bitcoin payouts</span><span>We never hold your funds</span><span>Open source</span></div>

          <div className="rise" style={{ "--d": "460ms" } as React.CSSProperties}><HeroDemo /></div>
        </div>
      </section>

      {/* LANGUAGE TICKER */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <div key={k} className="ticker-set">
              {["How you dey?", "Ẹ káàárọ̀", "Ina kwana", "Abeg", "Ẹ ṣé", "Na gode", "Wetin dey happen?", "Báwo ni?", "Sannu", "No wahala"].map((w) => <span key={w + k}>{w}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="lp-band">
        <div className="lp-wrap lp-stats">
          <Reveal className="stat"><b><CountUp to={4} /></b><span>Languages to start: English, Pidgin, Yoruba, Hausa</span></Reveal>
          <Reveal className="stat" delay={120}><b><CountUp to={2} suffix="×" /></b><span>Every item can be answered by independent peers</span></Reveal>
          <Reveal className="stat" delay={240}><b><CountUp to={0} /></b><span>Bank accounts, emails or phone numbers required</span></Reveal>
        </div>
      </section>

      {/* PROBLEM: pastel taxonomy tiles */}
      <section className="lp-sec alt">
        <div className="lp-wrap">
          <Reveal><div className="tag">The problem</div>
          <h2 className="lp-h2">Two gaps, one payment network.</h2></Reveal>
          <div className="lp-3">
            <Reveal delay={0}><div className="card pink"><h3>Phones, but no bank access</h3><p className="muted">Many young people have a smartphone and spare time but no way to receive international payments.</p></div></Reveal>
            <Reveal delay={110}><div className="card mint"><h3>AI that struggles locally</h3><p className="muted">Mainstream AI has little data in Nigerian Pidgin, Yoruba and Hausa, so it works worse for the people who speak them.</p></div></Reveal>
            <Reveal delay={220}><div className="card yellow"><h3>No simple bridge</h3><p className="muted">Data platforms need cards and identity checks and pay in dollars. Lightning pays tiny amounts instantly to anyone.</p></div></Reveal>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-sec">
        <div className="lp-wrap lp-split">
          <div>
            <Reveal><div className="tag">How it works</div>
            <h2 className="lp-h2">Post. Work. Check. Pay.</h2>
            <p className="lead">One complete loop, designed to run on a phone.</p>
            <Link href="/tasks" className="btn inline">Browse open tasks <Arrow /></Link></Reveal>
          </div>
          <ol className="steps">
            <Reveal as="li" delay={0}><span><b>A requester posts a task</b> and connects a spending-capped Nostr Wallet Connect link. The task is announced on Nostr, signed by the requester.</span></Reveal>
            <Reveal as="li" delay={90}><span><b>A worker creates an account in one tap</b> (no email or phone number) and answers one item at a time on a simple mobile screen.</span></Reveal>
            <Reveal as="li" delay={180}><span><b>An AI filter screens out spam</b>: blank, copied, off-language or gibberish answers. It is a filter, not a translation judge.</span></Reveal>
            <Reveal as="li" delay={270}><span><b>Peers cross-check each other.</b> Workers rank AI replies, and qualified listeners verify recordings by typing what they hear.</span></Reveal>
            <Reveal as="li" delay={360}><span><b>Approved answers are paid</b> after a short anti-abuse hold, straight to the worker's wallet address.</span></Reveal>
            <Reveal as="li" delay={450}><span><b>The requester exports the dataset</b> with a SHA-256 hash pinned on Nostr, so its origin can be proven.</span></Reveal>
          </ol>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="lp-sec alt">
        <div className="lp-wrap">
          <Reveal><div className="tag">Who it's for</div>
          <h2 className="lp-h2">Earn from your language, or fund the data you need.</h2></Reveal>
          <div className="lp-2">
            <Reveal><div className="card violet">
              <h3>For workers</h3>
              <p className="muted">All you need is a phone and a wallet address to receive your sats.</p>
              <ul className="lp-list"><li>Translate, record, rank replies, or verify clips</li><li>Pass a language test, level up, unlock better-paid work</li><li>Build a reputation that follows your Nostr key</li></ul>
              <Link href="/tasks" className="btn inline">Find a task <Arrow /></Link>
            </div></Reveal>
            <Reveal delay={120}><div className="card pink">
              <h3>For requesters</h3>
              <p className="muted">Collect quality-checked language data without deposits or custody.</p>
              <ul className="lp-list"><li>Pay from your own wallet through a capped NWC link</li><li>Choose the language pair, reward and peers per item</li><li>Export text as JSONL/CSV, or voice as a WAV + JSONL zip, with a provenance hash</li></ul>
              <Link href="/post" className="btn inline secondary" style={{ background: "#fff" }}>Post a task</Link>
            </div></Reveal>
          </div>
        </div>
      </section>

      {/* SECURITY: dark panel */}
      <section className="lp-sec indigo">
        <div className="lp-wrap">
          <Reveal><div className="tag">Security by design</div>
          <h2 className="lp-h2">We never hold your money.</h2></Reveal>
          <div className="lp-3">
            <Reveal delay={0}><div className="card dark"><h3>Spending caps</h3><p className="muted">Requesters pay from their own wallet through NWC. The cap is enforced by the wallet, and the link is stored encrypted.</p></div></Reveal>
            <Reveal delay={110}><div className="card dark"><h3>Anti-abuse guardrails</h3><p className="muted">Rate limits per key, a payout cooldown, rapid-submission and copy-paste detection, hidden check items and daily caps.</p></div></Reveal>
            <Reveal delay={220}><div className="card dark"><h3>Provenance on Nostr</h3><p className="muted">Tasks are signed by the requester and exported datasets are hashed and pinned as signed events, so data origin is verifiable.</p></div></Reveal>
          </div>
          <p className="muted small" style={{ marginTop: 32 }}>Sats-for-Data builds datasets. It does not train a model: training is the requester's next step.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-sec charcoal">
        <div className="lp-wrap">
          <Reveal><h2 className="lp-h2" style={{ margin: "0 auto 32px", maxWidth: 720 }}>Ready to teach AI your language?</h2>
          <div className="lp-cta">
            <Link href="/tasks" className="btn inline lp-light">Start earning <Arrow /></Link>
            <Link href="/post" className="btn inline lp-ghost">Post a task</Link>
          </div></Reveal>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap">⚡ Sats-for-Data · Open source (MIT) · Built for the Dakar Bitcoin Hackathon 2026</div>
      </footer>
    </div>
  );
}
