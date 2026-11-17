import Link from "next/link";

const Arrow = () => <span aria-hidden>→</span>;

export default function Landing() {
  return (
    <div className="lp">
      {/* HERO: warm radial wash, poster headline */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="tag">Lightning · Nostr · Local languages</div>
          <h1 className="lp-h1">Teach AI your language. Get paid in sats.</h1>
          <p className="lead">
            Translate, record your voice, rank AI replies, or verify other speakers in Nigerian Pidgin, Yoruba and Hausa. Approved work is paid over Lightning. No bank account needed.
          </p>
          <div className="lp-cta">
            <Link href="/tasks" className="btn inline">Start earning <Arrow /></Link>
            <Link href="/post" className="btn inline secondary">Post a task</Link>
          </div>
          <div className="lp-trust"><span>Instant Lightning payouts</span><span>We never hold your funds</span><span>Open source</span></div>

          <div className="lp-widget" aria-label="Example task and payout">
            <div className="card float lp-w1">
              <div className="label">Translate into Nigerian Pidgin</div>
              <p className="prompt" style={{ margin: "10px 0 16px" }}>“How are you doing today?”</p>
              <div className="lp-input">How you dey today?</div>
              <div style={{ marginTop: 16 }}><span className="pill paid">Accepted</span><span className="pill">⚡ 200 sats</span><span className="pill">2 peers agree</span></div>
            </div>
            <div className="card float lp-w2">
              <div className="label">Payment sent</div>
              <div className="amount" style={{ margin: "8px 0 4px" }}>+200 <small>sats</small></div>
              <div className="mono muted">→ amara@wallet.example</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="lp-band">
        <div className="lp-wrap lp-stats">
          <div className="stat"><b>4</b><span>Languages to start: English, Pidgin, Yoruba, Hausa</span></div>
          <div className="stat"><b>2×</b><span>Every item can be answered by independent peers</span></div>
          <div className="stat"><b>0</b><span>Bank accounts, emails or phone numbers required</span></div>
        </div>
      </section>

      {/* PROBLEM: pastel taxonomy tiles */}
      <section className="lp-sec alt">
        <div className="lp-wrap">
          <div className="tag">The problem</div>
          <h2 className="lp-h2">Two gaps, one payment network.</h2>
          <div className="lp-3">
            <div className="card pink"><h3>Phones, but no bank access</h3><p className="muted">Many young people have a smartphone and spare time but no way to receive international payments.</p></div>
            <div className="card mint"><h3>AI that struggles locally</h3><p className="muted">Mainstream AI has little data in Nigerian Pidgin, Yoruba and Hausa, so it works worse for the people who speak them.</p></div>
            <div className="card yellow"><h3>No simple bridge</h3><p className="muted">Data platforms need cards and identity checks and pay in dollars. Lightning pays tiny amounts instantly to anyone.</p></div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-sec">
        <div className="lp-wrap lp-split">
          <div>
            <div className="tag">How it works</div>
            <h2 className="lp-h2">Post. Work. Check. Pay.</h2>
            <p className="lead">One complete loop, designed to run on a phone.</p>
            <Link href="/tasks" className="btn inline">Browse open tasks <Arrow /></Link>
          </div>
          <ol className="steps">
            <li><span><b>A requester posts a task</b> and connects a spending-capped Nostr Wallet Connect link. The task is announced on Nostr, signed by the requester.</span></li>
            <li><span><b>A worker signs in with a Nostr key</b> and answers one item at a time on a simple mobile screen.</span></li>
            <li><span><b>An AI filter screens out spam</b>: blank, copied, off-language or gibberish answers. It is a filter, not a translation judge.</span></li>
            <li><span><b>Peers cross-check each other.</b> Workers rank AI replies, and qualified listeners verify recordings by typing what they hear.</span></li>
            <li><span><b>Approved answers are paid</b> after a short anti-abuse hold, straight to the worker's Lightning address.</span></li>
            <li><span><b>The requester exports the dataset</b> with a SHA-256 hash pinned on Nostr, so its origin can be proven.</span></li>
          </ol>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="lp-sec alt">
        <div className="lp-wrap">
          <div className="tag">Who it's for</div>
          <h2 className="lp-h2">Earn from your language, or fund the data you need.</h2>
          <div className="lp-2">
            <div className="card violet">
              <h3>For workers</h3>
              <p className="muted">All you need is a phone, a Nostr key and a Lightning address.</p>
              <ul className="lp-list"><li>Translate, record, rank replies, or verify clips</li><li>Pass a language test, level up, unlock better-paid work</li><li>Build a reputation that follows your Nostr key</li></ul>
              <Link href="/tasks" className="btn inline">Find a task <Arrow /></Link>
            </div>
            <div className="card pink">
              <h3>For requesters</h3>
              <p className="muted">Collect quality-checked language data without deposits or custody.</p>
              <ul className="lp-list"><li>Pay from your own wallet through a capped NWC link</li><li>Choose the language pair, reward and peers per item</li><li>Export text as JSONL/CSV, or voice as a WAV + JSONL zip, with a provenance hash</li></ul>
              <Link href="/post" className="btn inline secondary" style={{ background: "#fff" }}>Post a task</Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY: dark panel */}
      <section className="lp-sec indigo">
        <div className="lp-wrap">
          <div className="tag">Security by design</div>
          <h2 className="lp-h2">We never hold your money.</h2>
          <div className="lp-3">
            <div className="card dark"><h3>Spending caps</h3><p className="muted">Requesters pay from their own wallet through NWC. The cap is enforced by the wallet, and the link is stored encrypted.</p></div>
            <div className="card dark"><h3>Anti-abuse guardrails</h3><p className="muted">Rate limits per key, a payout cooldown, rapid-submission and copy-paste detection, hidden check items and daily caps.</p></div>
            <div className="card dark"><h3>Provenance on Nostr</h3><p className="muted">Tasks are signed by the requester and exported datasets are hashed and pinned as signed events, so data origin is verifiable.</p></div>
          </div>
          <p className="muted small" style={{ marginTop: 32 }}>Sats-for-Data builds datasets. It does not train a model: training is the requester's next step.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-sec charcoal">
        <div className="lp-wrap">
          <h2 className="lp-h2" style={{ margin: "0 auto 32px", maxWidth: 720 }}>Ready to teach AI your language?</h2>
          <div className="lp-cta">
            <Link href="/tasks" className="btn inline lp-light">Start earning <Arrow /></Link>
            <Link href="/post" className="btn inline lp-ghost">Post a task</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap">⚡ Sats-for-Data · Open source (MIT) · Built for the Dakar Bitcoin Hackathon 2026</div>
      </footer>
    </div>
  );
}
