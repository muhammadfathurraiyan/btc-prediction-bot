import { DialogSection } from "../components/Dialog";

export function SignalsHowItWorksContent() {
  return (
    <>
      <DialogSection title="What it does">
        <p className="m-0">
          Places a bet on the current Polymarket BTC 5m window using a composite score from five
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
          The signal score must meet your <strong>min confidence</strong> slider. Bet size is in
          USDC. In <strong>demo mode</strong>, orders are simulated with paper balance. Live mode
          sends real orders to Polymarket when your funder wallet has funds.
        </p>
      </DialogSection>
      <DialogSection title="Settlement">
        <p className="m-0">
          Pending bets resolve after each 5m window using Chainlink BTC/USD (Polymarket oracle).
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
          Mirrors the target wallet&apos;s latest <strong>BUY</strong> on the current BTC 5m
          Polymarket market (UP or DOWN). Your bot follows their direction, not their exact size.
        </p>
      </DialogSection>
      <DialogSection title="Target wallet">
        <p className="m-0">
          Trades are read from Polymarket&apos;s public Data API. Only the current 5-minute window
          slug is considered. If they haven&apos;t traded this window yet, Copy now stays disabled.
        </p>
      </DialogSection>
      <DialogSection title="Auto-copy">
        <p className="m-0">
          When enabled, each dashboard refresh checks for a new target trade and places your copy
          automatically (once per transaction hash). Errors appear below the prediction card.
        </p>
      </DialogSection>
      <DialogSection title="Copy now">
        <p className="m-0">
          Manually copies the latest pick immediately. Use <strong>force</strong> via the button
          even if that trade was already copied this window. Respects demo vs live mode and balance
          checks like signal bets.
        </p>
      </DialogSection>
    </>
  );
}
