import { getChainlinkPriceAt, getLiveChainlinkBtcUsd } from "./chainlinkPrice.js";

let cachedWindowStart: number | null = null;
let cachedPriceToBeat: number | null = null;

export async function fetchPriceToBeat(windowStart: number): Promise<number | null> {
  if (cachedWindowStart === windowStart && cachedPriceToBeat !== null) {
    return cachedPriceToBeat;
  }

  const targetMs = windowStart * 1000;
  let price = getChainlinkPriceAt(targetMs);

  const nowSec = Math.floor(Date.now() / 1000);
  if (price === null && nowSec >= windowStart && nowSec < windowStart + 60) {
    price = getLiveChainlinkBtcUsd();
  }

  if (price === null || !Number.isFinite(price) || price <= 0) return null;

  cachedWindowStart = windowStart;
  cachedPriceToBeat = price;
  return price;
}

export function clearPriceToBeatCache(): void {
  cachedWindowStart = null;
  cachedPriceToBeat = null;
}

export function btcVsBeatPct(btc: number, priceToBeat: number): number {
  if (priceToBeat <= 0) return 0;
  return ((btc - priceToBeat) / priceToBeat) * 100;
}
