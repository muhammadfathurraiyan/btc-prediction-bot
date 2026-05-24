import { isAddress } from "viem";
import { DEFAULT_COPY_TARGET, DATA_API_HOST } from "../config.js";
import type { ClobClient } from "@polymarket/clob-client-v2";
import { placeUserBet } from "./betting.js";
import type { BetDirection } from "./history.js";
import type { Btc5mMarket } from "./market.js";

export interface PolymarketUserTrade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  slug: string;
  outcome: string;
  outcomeIndex: number;
  timestamp: number;
  transactionHash: string;
  pseudonym?: string;
  name?: string;
  size: number;
  price: number;
}

export interface CopyPrediction {
  direction: BetDirection;
  pseudonym: string;
  transactionHash: string;
  timestamp: number;
  size: number;
  price: number;
  alreadyCopied: boolean;
}

export interface CopySettings {
  enabled: boolean;
  betSize: number;
  targetAddress: string;
}

export interface CopyTradeState {
  settings: CopySettings;
  prediction: CopyPrediction | null;
  lastAutoCopyError: string | null;
}

const copiedTxHashes = new Set<string>();

let settings: CopySettings = {
  enabled: false,
  betSize: 10,
  targetAddress: DEFAULT_COPY_TARGET,
};

let lastAutoCopyError: string | null = null;

function outcomeToDirection(outcome: string): BetDirection {
  return outcome.toLowerCase() === "up" ? "UP" : "DOWN";
}

export function getCopySettings(): CopySettings {
  return { ...settings };
}

export function normalizeTargetAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) return null;
  return trimmed.toLowerCase() as `0x${string}`;
}

export function updateCopySettings(partial: Partial<CopySettings>): CopySettings {
  if (partial.enabled !== undefined) settings.enabled = partial.enabled;
  if (partial.betSize !== undefined) settings.betSize = partial.betSize;
  if (partial.targetAddress !== undefined) {
    const next = partial.targetAddress.toLowerCase();
    if (next !== settings.targetAddress) {
      copiedTxHashes.clear();
      lastAutoCopyError = null;
    }
    settings.targetAddress = next;
  }
  return getCopySettings();
}

export type CopyExecuteResult =
  | { ok: true; bet: Awaited<ReturnType<typeof placeUserBet>>["bet"] }
  | { ok: false; reason: string };

export async function fetchUserTrades(user: string): Promise<PolymarketUserTrade[]> {
  const url = `${DATA_API_HOST}/trades?user=${user}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Data API error ${res.status}`);
  return (await res.json()) as PolymarketUserTrade[];
}

export async function getTargetPrediction(
  user: string,
  slug: string,
): Promise<CopyPrediction | null> {
  const trades = await fetchUserTrades(user);
  const windowTrades = trades.filter((t) => t.slug === slug && t.side === "BUY");
  if (windowTrades.length === 0) return null;

  const latest = windowTrades.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
  return {
    direction: outcomeToDirection(latest.outcome),
    pseudonym: latest.pseudonym || latest.name || "Trader",
    transactionHash: latest.transactionHash,
    timestamp: latest.timestamp,
    size: latest.size,
    price: latest.price,
    alreadyCopied: copiedTxHashes.has(latest.transactionHash),
  };
}

export async function getCopyTradeState(market: Btc5mMarket | null): Promise<CopyTradeState> {
  if (!market) {
    return { settings: getCopySettings(), prediction: null, lastAutoCopyError };
  }

  try {
    const prediction = await getTargetPrediction(settings.targetAddress, market.slug);
    return { settings: getCopySettings(), prediction, lastAutoCopyError };
  } catch (err) {
    return {
      settings: getCopySettings(),
      prediction: null,
      lastAutoCopyError: err instanceof Error ? err.message : "Failed to fetch copy target",
    };
  }
}

export async function executeCopyTrade(
  client: ClobClient | null,
  market: Btc5mMarket,
  betSize: number,
  balanceUsd: number | null,
  options: { force?: boolean } = {},
): Promise<CopyExecuteResult> {
  const prediction = await getTargetPrediction(settings.targetAddress, market.slug);
  if (!prediction) {
    return { ok: false, reason: "Target has no BTC 5m trade this window" };
  }

  if (!options.force && copiedTxHashes.has(prediction.transactionHash)) {
    return { ok: false, reason: "Already copied this trade" };
  }

  const result = await placeUserBet(
    client,
    market,
    prediction.direction,
    betSize,
    100,
    balanceUsd,
  );

  copiedTxHashes.add(prediction.transactionHash);
  lastAutoCopyError = null;
  return { ok: true, bet: result.bet };
}

export async function maybeAutoCopy(
  client: ClobClient | null,
  market: Btc5mMarket | null,
  balanceUsd: number | null,
): Promise<void> {
  if (!settings.enabled || !market) return;

  try {
    const prediction = await getTargetPrediction(settings.targetAddress, market.slug);
    if (!prediction || copiedTxHashes.has(prediction.transactionHash)) return;

    const result = await executeCopyTrade(client, market, settings.betSize, balanceUsd);
    if (!result.ok) {
      lastAutoCopyError = result.reason;
    }
  } catch (err) {
    lastAutoCopyError = err instanceof Error ? err.message : "Auto-copy failed";
  }
}
