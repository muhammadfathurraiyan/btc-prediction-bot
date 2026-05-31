import { parseMid } from "./clobUtils.js";
import { Side, type ClobClient, type TickSize } from "@polymarket/clob-client-v2";
import { addBet, type BetDirection } from "./history.js";
import type { Btc5mMarket } from "./market.js";

export async function placeBet(
  client: ClobClient,
  market: Btc5mMarket,
  direction: BetDirection,
  amountUsd: number,
  confidence: number,
): Promise<{ bet: ReturnType<typeof addBet>; orderResponse: unknown }> {
  const tokenId = direction === "UP" ? market.upTokenId : market.downTokenId;
  if (!tokenId) throw new Error("Market token IDs not available for this window");

  const [midRaw, tickSizeRaw, negRisk] = await Promise.all([
    client.getMidpoint(tokenId),
    client.getTickSize(tokenId),
    client.getNegRisk(tokenId),
  ]);

  const price = Math.min(0.99, parseMid(midRaw) + 0.01);
  const size = Math.max(1, Math.floor(amountUsd / price));

  const orderResponse = await client.createAndPostOrder(
    {
      tokenID: tokenId,
      price,
      size,
      side: Side.BUY,
    },
    {
      tickSize: tickSizeRaw as TickSize,
      negRisk: Boolean(negRisk),
    },
  );

  const bet = addBet({
    dir: direction,
    amt: amountUsd,
    conf: confidence,
    orderId: typeof orderResponse === "object" && orderResponse && "orderID" in orderResponse
      ? String((orderResponse as { orderID: string }).orderID)
      : undefined,
    slug: market.slug,
    windowStart: market.windowStart,
    entryPrice: price,
  });

  return { bet, orderResponse };
}

type TradeSide = "BUY" | "SELL";
type OutcomeSide = "UP" | "DOWN";

function outcomeToDirection(outcome: string): OutcomeSide {
  return outcome.toLowerCase() === "up" ? "UP" : "DOWN";
}

/**
 * Places a copy trade always as a BUY.
 * - Target BUY "up"  → BUY "up"  token  (copy the long)
 * - Target SELL "up" → BUY "down" token  (mirror the direction; we have no position to sell)
 * History records `reflectedDirection` for analytics.
 */
export async function placeCopyOrder(
  client: ClobClient,
  market: Btc5mMarket,
  tradeSide: TradeSide,
  outcome: string,
  amountUsd: number,
  confidence: number,
  reflectedDirection: BetDirection,
): Promise<{ bet: ReturnType<typeof addBet>; orderResponse: unknown }> {
  // When target sells, mirror by buying the opposite outcome instead of selling.
  const effectiveOutcome =
    tradeSide === "SELL"
      ? outcome.toLowerCase() === "up" ? "down" : "up"
      : outcome;

  const outcomeDir = outcomeToDirection(effectiveOutcome);
  const tokenId = outcomeDir === "UP" ? market.upTokenId : market.downTokenId;
  if (!tokenId) throw new Error("Market token IDs not available for this window");

  const [midRaw, tickSizeRaw, negRisk] = await Promise.all([
    client.getMidpoint(tokenId),
    client.getTickSize(tokenId),
    client.getNegRisk(tokenId),
  ]);

  const mid = parseMid(midRaw);
  const price = Math.min(0.99, mid + 0.01);
  const size = Math.max(1, Math.floor(amountUsd / price));

  const orderResponse = await client.createAndPostOrder(
    {
      tokenID: tokenId,
      price,
      size,
      side: Side.BUY,
    },
    {
      tickSize: tickSizeRaw as TickSize,
      negRisk: Boolean(negRisk),
    },
  );

  const bet = addBet({
    dir: reflectedDirection,
    amt: amountUsd,
    conf: confidence,
    orderId: typeof orderResponse === "object" && orderResponse && "orderID" in orderResponse
      ? String((orderResponse as { orderID: string }).orderID)
      : undefined,
    slug: market.slug,
    windowStart: market.windowStart,
    entryPrice: price,
  });

  return { bet, orderResponse };
}
