import { addBet, type BetDirection } from "./history.js";
import type { Btc5mMarket } from "./market.js";
import { parseMid } from "./clobUtils.js";
import { getPublicClient } from "./publicClient.js";

const START_DEMO_BALANCE = 10000;

let demoModeEnabled = false;
let demoOptOut = false;
let demoBalance = START_DEMO_BALANCE;

export function getDemoBalance(): number {
  return demoBalance;
}

export function setDemoMode(enabled: boolean, optOut = false): void {
  demoModeEnabled = enabled;
  if (optOut) demoOptOut = true;
  if (enabled) demoOptOut = false;
}

export function resetDemoBalance(): number {
  demoBalance = START_DEMO_BALANCE;
  return demoBalance;
}

export function isDemoModeForced(): boolean {
  return demoModeEnabled;
}

export function isDemoActive(balanceUsd: number | null, minAmount = 1): boolean {
  if (demoModeEnabled) return true;
  if (demoOptOut) return false;
  if (balanceUsd === null) return false;
  return balanceUsd < minAmount;
}

export function canAffordDemo(amount: number): boolean {
  return demoBalance >= amount;
}

export function reserveDemoFunds(amount: number): void {
  demoBalance = Math.round((demoBalance - amount) * 100) / 100;
}

export function releaseDemoFunds(amount: number, pnl: number): void {
  demoBalance = Math.round((demoBalance + amount + pnl) * 100) / 100;
}

async function fetchDemoEntryPrice(market: Btc5mMarket, direction: BetDirection): Promise<number> {
  const tokenId = direction === "UP" ? market.upTokenId : market.downTokenId;
  if (!tokenId) return 0.5;
  try {
    const midRaw = await getPublicClient().getMidpoint(tokenId);
    const price = Math.min(0.99, parseMid(midRaw) + 0.01);
    return price > 0.01 ? price : 0.5;
  } catch {
    return 0.5;
  }
}

export async function placeDemoBet(
  market: Btc5mMarket,
  direction: BetDirection,
  amountUsd: number,
  confidence: number,
): Promise<{ bet: ReturnType<typeof addBet>; orderResponse: { demo: true } }> {
  if (!canAffordDemo(amountUsd)) {
    throw new Error(`Insufficient demo balance ($${demoBalance.toFixed(2)} available)`);
  }

  const entryPrice = await fetchDemoEntryPrice(market, direction);
  reserveDemoFunds(amountUsd);

  const bet = addBet({
    dir: direction,
    amt: amountUsd,
    conf: confidence,
    orderId: `demo-${crypto.randomUUID()}`,
    slug: market.slug,
    windowStart: market.windowStart,
    entryPrice,
    demo: true,
  });

  return { bet, orderResponse: { demo: true } };
}
