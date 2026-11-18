import Link from "next/link";

export default function WalletHelp() {
  return (
    <div className="narrow">
      <div className="tag">Get paid</div>
      <h1>How to get a Lightning address</h1>
      <p className="lead">A Lightning address looks like an email, for example <code>yourname@wallet.com</code>. You paste it into your Wallet page and your earnings are sent there.</p>

      <section className="card"><h3>Pick a wallet</h3>
        <p className="muted small">Choose any wallet that gives you a Lightning address. Availability, fees and rules differ by country and change over time, so check each wallet's current terms before relying on it.</p>
        <ul className="lp-list">
          <li><b>Basic phone, no data:</b> Machankura lets people use Bitcoin from a feature phone through a USSD code, and is available in several African countries. It is custodial and charges a small fee, so confirm the current terms on 8333.mobi.</li>
          <li><b>Smartphone:</b> Blink is a free app aimed at everyday Bitcoin payments and offers Lightning addresses. Confirm availability in your area inside the app.</li>
          <li><b>Cashing out to local money:</b> some services, such as Bitnob, can convert Bitcoin to bank or mobile-money deposits. Check their current fees and whether they serve your country.</li>
        </ul></section>

      <section className="card"><h3>Set it up</h3>
        <ol className="steps">
          <li><span><b>Install or open</b> your chosen wallet and create an account.</span></li>
          <li><span><b>Find your Lightning address</b> in the wallet's Receive or Profile screen.</span></li>
          <li><span><b>Paste it</b> into <Link href="/wallet">Wallet</Link> and press <b>Test address</b>. You should see "This address works".</span></li>
          <li><span><b>Do a task.</b> Accepted answers are paid to that address after a short hold.</span></li>
        </ol></section>

      <section className="card mint"><h3>Stay safe</h3>
        <ul className="lp-list">
          <li>Only share the address, never your wallet's recovery words or password.</li>
          <li>Back up your Sats-for-Data key too, because it is your account.</li>
          <li>Start small: do one task and confirm the sats arrive before doing more.</li>
        </ul></section>
    </div>
  );
}
