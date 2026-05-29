export const BTC_WINDOW_SECONDS = 300;

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** End of the current 5m BTC window (Unix seconds). */
export function getCurrentBtcWindowEnd(nowSec = Math.floor(Date.now() / 1000)): number {
  const start = Math.floor(nowSec / BTC_WINDOW_SECONDS) * BTC_WINDOW_SECONDS;
  return start + BTC_WINDOW_SECONDS;
}

/**
 * Countdown until window end. If the server snapshot is stale (past windowEnd),
 * roll forward locally so the timer does not stick at 0:00.
 */
export function getCountdownSeconds(
  serverWindowEnd: number | null,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  if (serverWindowEnd != null && serverWindowEnd > nowSec) {
    return serverWindowEnd - nowSec;
  }
  return Math.max(0, getCurrentBtcWindowEnd(nowSec) - nowSec);
}

export function btcVsBeatPct(btc: number, priceToBeat: number): number {
  return ((btc - priceToBeat) / priceToBeat) * 100;
}
