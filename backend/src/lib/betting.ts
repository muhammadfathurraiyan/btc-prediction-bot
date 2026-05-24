import type { ClobClient } from "@polymarket/clob-client-v2";
import { isDemoActive, placeDemoBet } from "./demo.js";
import type { BetDirection } from "./history.js";
import type { Btc5mMarket } from "./market.js";
import { placeBet } from "./orders.js";

export async function placeUserBet(
  client: ClobClient | null,
  market: Btc5mMarket,
  direction: BetDirection,
  amountUsd: number,
  confidence: number,
  balanceUsd: number | null,
): Promise<{ bet: Awaited<ReturnType<typeof placeBet>>["bet"]; orderResponse: unknown; demo: boolean }> {
  if (isDemoActive(balanceUsd, amountUsd)) {
    const result = await placeDemoBet(market, direction, amountUsd, confidence);
    return { ...result, demo: true };
  }

  if (!client) {
    throw new Error("Trading not configured. Set API credentials in backend/.env or enable demo mode.");
  }

  if (balanceUsd === null) {
    throw new Error("Could not verify wallet balance. Enable demo mode or fix API connection.");
  }

  if (balanceUsd < amountUsd) {
    throw new Error(
      `Insufficient balance ($${balanceUsd.toFixed(2)} USDC). Deposit funds or enable demo mode.`,
    );
  }

  const result = await placeBet(client, market, direction, amountUsd, confidence);
  return { ...result, demo: false };
}
