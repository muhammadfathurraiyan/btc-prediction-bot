import { WINDOW_SECONDS } from "../config.js";
import { getChainlinkPriceAt } from "./chainlinkPrice.js";
import { fetchPriceToBeat } from "./priceToBeat.js";

/** UP wins if BTC at window end >= price at window start (Polymarket Chainlink rules). */
export async function fetchWindowOutcome(windowStart: number): Promise<"UP" | "DOWN"> {
  const startMs = windowStart * 1000;
  const endMs = (windowStart + WINDOW_SECONDS) * 1000;

  const open = (await fetchPriceToBeat(windowStart)) ?? getChainlinkPriceAt(startMs, 300_000);
  const close = getChainlinkPriceAt(endMs, 300_000);

  if (open === null || close === null) {
    throw new Error("Chainlink BTC price unavailable for window resolution");
  }

  return close >= open ? "UP" : "DOWN";
}

export function parseWindowStartFromSlug(slug?: string): number | null {
  if (!slug) return null;
  const match = slug.match(/^btc-updown-5m-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Wait until window end + 15s so end-of-window price is available. */
export function isWindowResolvable(windowStart: number, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return nowSec >= windowStart + WINDOW_SECONDS + 15;
}
