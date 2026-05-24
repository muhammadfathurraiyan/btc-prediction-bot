import { addBet, type BetDirection } from "./history.js";
import type { Btc5mMarket } from "./market.js";

const START_DEMO_BALANCE = 1000;

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

export async function placeDemoBet(
  market: Btc5mMarket,
  direction: BetDirection,
  amountUsd: number,
  confidence: number,
  entryPrice = 0.5,
): Promise<{ bet: ReturnType<typeof addBet>; orderResponse: { demo: true } }> {
  if (!canAffordDemo(amountUsd)) {
    throw new Error(`Insufficient demo balance ($${demoBalance.toFixed(2)} available)`);
  }

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
