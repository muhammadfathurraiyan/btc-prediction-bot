import { BTC_5M_SLUG_PREFIX, WINDOW_SECONDS } from "../config.js";
import { getChainlinkPriceAt } from "./chainlinkPrice.js";
import { fetchPriceToBeat } from "./priceToBeat.js";

/** UP wins if Chainlink BTC/USD at window end >= price at window start (Polymarket rules). */
export async function fetchWindowOutcome(windowStart: number): Promise<"UP" | "DOWN"> {
  const startMs = windowStart * 1000;
  const endMs = (windowStart + WINDOW_SECONDS) * 1000;

  const open = getChainlinkPriceAt(startMs) ?? (await fetchPriceToBeat(windowStart));
  const close = getChainlinkPriceAt(endMs);

  if (open === null || close === null) {
    throw new Error("Chainlink price unavailable for window resolution");
  }

  return close >= open ? "UP" : "DOWN";
}

export function parseWindowStartFromSlug(slug?: string): number | null {
  if (!slug) return null;
  const match = slug.match(new RegExp(`^${BTC_5M_SLUG_PREFIX}-(\\d+)$`));
  return match ? Number(match[1]) : null;
}

export function isWindowResolvable(windowStart: number, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return nowSec >= windowStart + WINDOW_SECONDS + 15;
}
