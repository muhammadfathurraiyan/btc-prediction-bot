import { DialogSection } from "../components/Dialog";

export function SignalsHowItWorksContent() {
  return (
    <>
      <DialogSection title="What it does">
        <p className="m-0">
          Places a prediction on the current Polymarket BTC 5m window using a composite score from five
          live indicators. UP wins if Chainlink BTC/USD at window end is at or above the price to
          beat (Chainlink at window open).
        </p>
      </DialogSection>
      <DialogSection title="The 5 signals">
        <ul className="m-0 pl-[18px]">
          <li>RSI (14) on Binance 1m candles</li>
          <li>EMA 9 / 21 cross (bullish vs bearish)</li>
          <li>5m volume vs trailing average (live, pro-rated)</li>
          <li>Polymarket order book depth (bid vs ask heavy)</li>
          <li>Market UP % from Polymarket mid prices</li>
        </ul>
      </DialogSection>
      <DialogSection title="Place bet">
        <p className="m-0">
          The signal score must meet your <strong>min confidence</strong> slider. Prediction size is in
          USDC. In <strong>demo mode</strong>, orders are simulated with paper balance. Live mode
          sends real orders to Polymarket when your funder wallet has funds.
        </p>
      </DialogSection>
      <DialogSection title="Settlement">
        <p className="m-0">
          Pending predictions resolve after each 5m window using Chainlink BTC/USD (Polymarket oracle).
          Session P&amp;L and win
          rate update in the dashboard.
        </p>
      </DialogSection>
    </>
  );
}

export function CopyTradeHowItWorksContent() {
  return (
    <>
      <DialogSection title="What it does">
        <p className="m-0">
          Mirrors target transactions on the current BTC 5m window (each tx once). Copy size mirrors
          their <strong>risk percentage</strong>, not their dollar amount — if they risk 2% of a $1,500
          account ($30), you risk 2% of yours ($3 on a $150 account).
        </p>
      </DialogSection>
      <DialogSection title="Proportional formula">
        <p className="m-0">
          Your copy = their trade × (your account ÷ their account) × Mirror %. Example: they buy $500
          on a $1,500 account and you have $150 → you buy $50 at 100% mirror. Gains and losses stay
          proportional.
        </p>
      </DialogSection>
      <DialogSection title="Target wallet">
        <p className="m-0">
          Trades are read from Polymarket&apos;s Data API (maker + taker fills, filtered by event).
          BUY Up → you buy UP; SELL Up → you buy DOWN (mirrored as a buy). Their account size is
          auto-detected from open positions plus on-chain collateral; if unavailable, it is estimated
          from their trade size.
        </p>
      </DialogSection>
      <DialogSection title="Mirror % &amp; caps">
        <p className="m-0">
          Mirror % tunes how much of the proportional size to take (1–100%). Max per copy caps each
          trade. A reserve (10% or $5) stays untouched; if pending copies exceed spendable balance,
          the batch scales down together.
        </p>
      </DialogSection>
      <DialogSection title="Auto-copy">
        <p className="m-0">
          When enabled, each refresh copies up to 5 uncopied trades (oldest first) with scaled sizes.
          Remaining pending trades wait for the next refresh or Copy now.
        </p>
      </DialogSection>
      <DialogSection title="Copy now">
        <p className="m-0">
          Same as auto-copy for pending trades (scaled, max 5 per click). Force re-copies the latest
          trade only if nothing is pending.
        </p>
      </DialogSection>
    </>
  );
}
