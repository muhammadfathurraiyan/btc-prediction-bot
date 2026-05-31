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
          Mirrors target transactions on the current BTC 5m window (each tx once). Copy size follows
          their USDC amount, scaled down when your balance cannot cover the full batch — not a blind
          100% mirror. Max per copy caps each trade; Copy budget % caps total spend per run.
        </p>
      </DialogSection>
      <DialogSection title="Target wallet">
        <p className="m-0">
          Trades are read from Polymarket&apos;s Data API (maker + taker fills, filtered by event).
          If they place 9 trades, you copy up to 9 (when balance allows). BUY Up → you buy UP at
          their $ size; SELL Up → you buy DOWN at their $ size.
        </p>
      </DialogSection>
      <DialogSection title="Balance sizing">
        <p className="m-0">
          A reserve (10% or $5, whichever is higher) stays untouched. Copy budget % applies to the
          rest. Pending trades share that budget proportionally to their target sizes. If they spent
          $80 and your budget is $30, each copy is ~37.5% of their size.
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
