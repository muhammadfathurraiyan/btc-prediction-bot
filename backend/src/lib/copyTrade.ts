import { isAddress } from "viem";
import { DEFAULT_COPY_TARGET, DATA_API_HOST } from "../config.js";
import type { ClobClient } from "@polymarket/clob-client-v2";
import { getDemoBalance, isDemoActive } from "./demo.js";
import { placeUserCopyTrade } from "./betting.js";
import type { BetDirection, BetEntry } from "./history.js";
import type { Btc5mMarket } from "./market.js";
import {
  clearTargetAccountCache,
  resolveTargetAccountUsd,
  type TargetAccountSource,
} from "./targetAccount.js";

const MIN_COPY_USD = 1;
/** Keep at least this much USDC (and 10% of balance) off-limits for manual bets. */
const RESERVE_MIN_USD = 5;
const RESERVE_PCT = 10;
/** Max trades copied per auto-copy / Copy now run (avoids draining balance in one tick). */
const MAX_COPIES_PER_RUN = 5;

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
  usdcSize?: number;
}

export interface CopyPrediction {
  direction: BetDirection;
  side: "BUY" | "SELL";
  outcome: string;
  pseudonym: string;
  transactionHash: string;
  timestamp: number;
  size: number;
  price: number;
  amountUsd: number;
  /** Planned copy size for this trade (proportional mirror, ≤ amountUsd). */
  scaledAmountUsd: number;
  alreadyCopied: boolean;
}

export interface CopySettings {
  enabled: boolean;
  /** Max USDC per copied trade. */
  betSize: number;
  /** % of proportional mirror to apply (1–100). 100 = full risk mirror. */
  mirrorPct: number;
  targetAddress: string;
}

export interface CopyTradeState {
  settings: CopySettings;
  prediction: CopyPrediction | null;
  windowTradeCount: number;
  copiedCount: number;
  pendingCount: number;
  /** Sum of target notionals for pending trades. */
  pendingTotalUsd: number;
  /** Sum of planned copy sizes for pending trades. */
  plannedCopyUsd: number;
  /** Your account as % of target (e.g. 10 = you are 10% of them). */
  accountRatioPct: number | null;
  yourAccountUsd: number | null;
  targetAccountUsd: number | null;
  targetAccountSource: TargetAccountSource;
  /** <100 when batch is scaled down because spendable balance is insufficient. */
  batchScalePct: number | null;
  lastAutoCopyError: string | null;
}

const copiedTxHashes = new Set<string>();
let lastCopyWindowStart: number | null = null;
let skipExistingOnNextSync = false;
let settings: CopySettings = {
  enabled: false,
  betSize: 100,
  mirrorPct: 100,
  targetAddress: DEFAULT_COPY_TARGET,
};

let lastAutoCopyError: string | null = null;

function isOutcomeUp(outcome: string): boolean {
  return outcome.toLowerCase() === "up";
}

export function tradeToCopyDirection(trade: Pick<PolymarketUserTrade, "side" | "outcome">): BetDirection {
  const up = isOutcomeUp(trade.outcome);
  if (trade.side === "BUY") return up ? "UP" : "DOWN";
  return up ? "DOWN" : "UP";
}

export function tradeNotionalUsd(trade: PolymarketUserTrade): number {
  if (trade.usdcSize !== undefined && trade.usdcSize > 0) {
    return Math.round(trade.usdcSize * 100) / 100;
  }
  return Math.round(trade.size * trade.price * 100) / 100;
}

function spendableBalanceUsd(balance: number): number {
  const reserve = Math.max(RESERVE_MIN_USD, balance * (RESERVE_PCT / 100));
  return Math.max(0, Math.round((balance - reserve) * 100) / 100);
}

/**
 * Proportional mirror: copy their risk %, not their dollar amount.
 * yourSize = theirSize × (yourAccount / theirAccount) × (mirrorPct / 100)
 */
export function proportionalCopyUsd(
  theirTradeUsd: number,
  yourAccountUsd: number,
  targetAccountUsd: number,
  mirrorPct: number,
  maxPerCopy: number,
): number {
  if (theirTradeUsd <= 0 || yourAccountUsd <= 0 || targetAccountUsd <= 0) return 0;

  const accountRatio = yourAccountUsd / targetAccountUsd;
  const proportional = theirTradeUsd * accountRatio;
  const mirrored = proportional * (mirrorPct / 100);
  const capped = Math.min(maxPerCopy, mirrored);

  if (capped < MIN_COPY_USD) return 0;
  return Math.round(capped * 100) / 100;
}

function largestTradeUsd(trades: PolymarketUserTrade[]): number {
  if (trades.length === 0) return 0;
  return Math.max(...trades.map(tradeNotionalUsd));
}

interface CopyPlan {
  batchScale: number;
  amountsByHash: Map<string, number>;
  targetTotalUsd: number;
  plannedTotalUsd: number;
  yourAccountUsd: number | null;
  targetAccountUsd: number | null;
  targetAccountSource: TargetAccountSource;
  accountRatioPct: number | null;
}

function computeCopyPlan(
  pending: PolymarketUserTrade[],
  balanceUsd: number | null,
  targetAccountUsd: number | null,
  targetAccountSource: TargetAccountSource,
): CopyPlan {
  const yourAccountUsd = effectiveBalance(balanceUsd);
  const empty: CopyPlan = {
    batchScale: 0,
    amountsByHash: new Map(),
    targetTotalUsd: 0,
    plannedTotalUsd: 0,
    yourAccountUsd,
    targetAccountUsd,
    targetAccountSource,
    accountRatioPct: null,
  };

  if (pending.length === 0) return empty;

  const targetTotalUsd =
    Math.round(pending.reduce((sum, t) => sum + tradeNotionalUsd(t), 0) * 100) / 100;

  if (
    yourAccountUsd === null ||
    yourAccountUsd <= 0 ||
    targetAccountUsd === null ||
    targetAccountUsd <= 0
  ) {
    return { ...empty, targetTotalUsd };
  }

  const accountRatioPct = Math.round((yourAccountUsd / targetAccountUsd) * 1000) / 10;
  const spendable = spendableBalanceUsd(yourAccountUsd);

  const rawAmounts = new Map<string, number>();
  let rawTotal = 0;

  for (const trade of pending) {
    const theirUsd = tradeNotionalUsd(trade);
    const amount = proportionalCopyUsd(
      theirUsd,
      yourAccountUsd,
      targetAccountUsd,
      settings.mirrorPct,
      settings.betSize,
    );
    if (amount > 0) {
      rawAmounts.set(trade.transactionHash, amount);
      rawTotal += amount;
    }
  }

  if (rawTotal <= 0 || spendable < MIN_COPY_USD) {
    return {
      ...empty,
      targetTotalUsd,
      yourAccountUsd,
      targetAccountUsd,
      targetAccountSource,
      accountRatioPct,
    };
  }

  const batchScale = rawTotal <= spendable ? 1 : spendable / rawTotal;
  const amountsByHash = new Map<string, number>();
  let plannedTotalUsd = 0;

  for (const [hash, amount] of rawAmounts) {
    const scaled = Math.round(amount * batchScale * 100) / 100;
    const capped = Math.min(settings.betSize, scaled);
    if (capped >= MIN_COPY_USD) {
      amountsByHash.set(hash, capped);
      plannedTotalUsd += capped;
    }
  }

  return {
    batchScale,
    amountsByHash,
    targetTotalUsd,
    plannedTotalUsd: Math.round(plannedTotalUsd * 100) / 100,
    yourAccountUsd,
    targetAccountUsd,
    targetAccountSource,
    accountRatioPct,
  };
}

function syncCopyWindow(market: Btc5mMarket): void {
  if (lastCopyWindowStart !== null && lastCopyWindowStart !== market.windowStart) {
    copiedTxHashes.clear();
    lastAutoCopyError = null;
    skipExistingOnNextSync = false;
  }
  lastCopyWindowStart = market.windowStart;
}

function markCurrentTradesAsCopied(trades: PolymarketUserTrade[]): void {
  for (const trade of trades) copiedTxHashes.add(trade.transactionHash);
}

function applyFreshStartIfNeeded(trades: PolymarketUserTrade[]): void {
  if (!skipExistingOnNextSync) return;
  markCurrentTradesAsCopied(trades);
  skipExistingOnNextSync = false;
  lastAutoCopyError = null;
}

function activityToTrade(row: Record<string, unknown>): PolymarketUserTrade | null {
  const side = row.side;
  const slug = row.slug;
  const outcome = row.outcome;
  const timestamp = row.timestamp;
  const transactionHash = row.transactionHash;
  if (side !== "BUY" && side !== "SELL") return null;
  if (typeof slug !== "string" || typeof outcome !== "string") return null;
  if (typeof timestamp !== "number" || typeof transactionHash !== "string") return null;

  const usdcSize = Number(row.usdcSize ?? 0);

  return {
    proxyWallet: String(row.proxyWallet ?? ""),
    side,
    slug,
    outcome,
    outcomeIndex: Number(row.outcomeIndex ?? 0),
    timestamp,
    transactionHash,
    pseudonym: typeof row.pseudonym === "string" ? row.pseudonym : undefined,
    name: typeof row.name === "string" ? row.name : undefined,
    size: Number(row.size ?? 0),
    price: Number(row.price ?? 0),
    usdcSize: usdcSize > 0 ? usdcSize : undefined,
  };
}

function slugBase(slug: string): string {
  return slug.replace(/-\d+$/, "");
}

/** Only trades inside this 5m window — never all historical btc-updown-5m fills. */
function isTradeInCurrentWindow(
  trade: PolymarketUserTrade,
  slug: string,
  windowStart: number,
  windowEnd: number,
): boolean {
  const ts = trade.timestamp;
  if (ts < windowStart || ts >= windowEnd) return false;

  if (trade.slug === slug) return true;

  const base = slugBase(slug);
  return trade.slug === base || trade.slug === `${base}-${windowStart}`;
}

async function fetchWindowTradesFromActivity(
  user: string,
  slug: string,
  windowStart: number,
  windowEnd: number,
): Promise<PolymarketUserTrade[]> {
  const params = new URLSearchParams({ user, limit: "500" });
  const res = await fetch(`${DATA_API_HOST}/activity?${params}`);
  if (!res.ok) throw new Error(`Data API activity error ${res.status}`);

  const rows = (await res.json()) as Record<string, unknown>[];
  const trades: PolymarketUserTrade[] = [];
  for (const row of rows) {
    if (row.type && row.type !== "TRADE") continue;
    const trade = activityToTrade(row);
    if (trade && isTradeInCurrentWindow(trade, slug, windowStart, windowEnd)) {
      trades.push(trade);
    }
  }
  return trades;
}

export async function fetchUserTrades(
  user: string,
  slug: string,
  windowStart: number,
  windowEnd: number,
): Promise<PolymarketUserTrade[]> {
  const params = new URLSearchParams({
    user,
    limit: "500",
    takerOnly: "false",
  });

  const res = await fetch(`${DATA_API_HOST}/trades?${params}`);
  if (!res.ok) throw new Error(`Data API error ${res.status}`);

  let trades = (await res.json()) as PolymarketUserTrade[];
  trades = trades.filter((t) => isTradeInCurrentWindow(t, slug, windowStart, windowEnd));

  if (trades.length === 0) {
    trades = await fetchWindowTradesFromActivity(user, slug, windowStart, windowEnd);
  }

  return dedupeTrades(trades).map(enrichTradeNotional);
}

function enrichTradeNotional(trade: PolymarketUserTrade): PolymarketUserTrade {
  if (trade.usdcSize === undefined || trade.usdcSize <= 0) {
    const computed = trade.size * trade.price;
    if (computed > 0) return { ...trade, usdcSize: computed };
  }
  return trade;
}

function dedupeTrades(trades: PolymarketUserTrade[]): PolymarketUserTrade[] {
  const byHash = new Map<string, PolymarketUserTrade>();
  for (const trade of trades) {
    const existing = byHash.get(trade.transactionHash);
    if (!existing || trade.timestamp > existing.timestamp) {
      byHash.set(trade.transactionHash, trade);
    }
  }
  return [...byHash.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function getUncopiedTrades(trades: PolymarketUserTrade[]): PolymarketUserTrade[] {
  return trades.filter((t) => !copiedTxHashes.has(t.transactionHash));
}

function buildPrediction(latest: PolymarketUserTrade, scaledAmountUsd?: number): CopyPrediction {
  const amountUsd = tradeNotionalUsd(latest);
  return {
    direction: tradeToCopyDirection(latest),
    side: latest.side,
    outcome: latest.outcome,
    pseudonym: latest.pseudonym || latest.name || "Trader",
    transactionHash: latest.transactionHash,
    timestamp: latest.timestamp,
    size: latest.size,
    price: latest.price,
    amountUsd,
    scaledAmountUsd: scaledAmountUsd ?? amountUsd,
    alreadyCopied: copiedTxHashes.has(latest.transactionHash),
  };
}

function summarizeWindow(
  trades: PolymarketUserTrade[],
  balanceUsd: number | null,
  targetAccountUsd: number | null,
  targetAccountSource: TargetAccountSource,
): Omit<
  CopyTradeState,
  "settings" | "lastAutoCopyError"
> {
  if (trades.length === 0) {
    return {
      prediction: null,
      windowTradeCount: 0,
      copiedCount: 0,
      pendingCount: 0,
      pendingTotalUsd: 0,
      plannedCopyUsd: 0,
      accountRatioPct: null,
      yourAccountUsd: effectiveBalance(balanceUsd),
      targetAccountUsd,
      targetAccountSource,
      batchScalePct: null,
    };
  }

  const pending = getUncopiedTrades(trades);
  const plan = computeCopyPlan(pending, balanceUsd, targetAccountUsd, targetAccountSource);
  const latest = trades[trades.length - 1];
  const latestScaled =
    plan.amountsByHash.get(latest.transactionHash) ??
    (targetAccountUsd && plan.yourAccountUsd
      ? proportionalCopyUsd(
          tradeNotionalUsd(latest),
          plan.yourAccountUsd,
          targetAccountUsd,
          settings.mirrorPct,
          settings.betSize,
        )
      : 0);

  const batchScalePct =
    plan.batchScale > 0 && plan.batchScale < 1
      ? Math.round(plan.batchScale * 1000) / 10
      : null;

  return {
    prediction: buildPrediction(latest, latestScaled),
    windowTradeCount: trades.length,
    copiedCount: trades.length - pending.length,
    pendingCount: pending.length,
    pendingTotalUsd: plan.targetTotalUsd,
    plannedCopyUsd: plan.plannedTotalUsd,
    accountRatioPct: plan.accountRatioPct,
    yourAccountUsd: plan.yourAccountUsd,
    targetAccountUsd: plan.targetAccountUsd,
    targetAccountSource: plan.targetAccountSource,
    batchScalePct,
  };
}

export async function getTargetPrediction(
  user: string,
  market: Btc5mMarket,
): Promise<CopyPrediction | null> {
  const trades = await fetchUserTrades(user, market.slug, market.windowStart, market.windowEnd);
  return summarizeWindow(trades, null, null, null).prediction;
}

export function getCopySettings(): CopySettings {
  return { ...settings };
}

export function normalizeTargetAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) return null;
  return trimmed.toLowerCase() as `0x${string}`;
}

function clampMirrorPct(value: number): number {
  return Math.min(100, Math.max(1, Math.round(value)));
}

export function updateCopySettings(partial: Partial<CopySettings>): CopySettings {
  const wasEnabled = settings.enabled;
  if (partial.enabled !== undefined) settings.enabled = partial.enabled;
  if (partial.betSize !== undefined) settings.betSize = partial.betSize;
  if (partial.mirrorPct !== undefined) settings.mirrorPct = clampMirrorPct(partial.mirrorPct);
  if (!wasEnabled && settings.enabled) {
    skipExistingOnNextSync = true;
  }
  if (partial.targetAddress !== undefined) {
    const next = partial.targetAddress.toLowerCase();
    if (next !== settings.targetAddress) {
      copiedTxHashes.clear();
      lastAutoCopyError = null;
      lastCopyWindowStart = null;
      clearTargetAccountCache();
      if (settings.enabled) skipExistingOnNextSync = true;
    }
    settings.targetAddress = next;
  }
  return getCopySettings();
}

export type CopyExecuteResult =
  | { ok: true; bets: BetEntry[]; copied: number; skipped: number }
  | { ok: false; reason: string; bets?: BetEntry[]; copied?: number };

function effectiveBalance(balanceUsd: number | null): number | null {
  if (isDemoActive(balanceUsd)) return getDemoBalance();
  return balanceUsd;
}

async function copySingleTrade(
  client: ClobClient | null,
  market: Btc5mMarket,
  trade: PolymarketUserTrade,
  amount: number,
  balanceUsd: number | null,
): Promise<{ ok: true; bet: BetEntry } | { ok: false; reason: string }> {
  const balance = effectiveBalance(balanceUsd);

  if (balance !== null && balance < amount) {
    return { ok: false, reason: `Insufficient balance ($${balance.toFixed(2)} need $${amount.toFixed(2)})` };
  }

  try {
    const result = await placeUserCopyTrade(
      client,
      market,
      trade.side,
      trade.outcome,
      amount,
      100,
      tradeToCopyDirection(trade),
      balanceUsd,
    );
    copiedTxHashes.add(trade.transactionHash);
    return { ok: true, bet: result.bet };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Copy bet failed";
    return { ok: false, reason: message };
  }
}

export async function getCopyTradeState(
  market: Btc5mMarket | null,
  balanceUsd: number | null = null,
): Promise<CopyTradeState> {
  const empty: CopyTradeState = {
    settings: getCopySettings(),
    prediction: null,
    windowTradeCount: 0,
    copiedCount: 0,
    pendingCount: 0,
    pendingTotalUsd: 0,
    plannedCopyUsd: 0,
    accountRatioPct: null,
    yourAccountUsd: effectiveBalance(balanceUsd),
    targetAccountUsd: null,
    targetAccountSource: null,
    batchScalePct: null,
    lastAutoCopyError,
  };

  if (!market) return empty;

  syncCopyWindow(market);

  try {
    const trades = await fetchUserTrades(
      settings.targetAddress,
      market.slug,
      market.windowStart,
      market.windowEnd,
    );
    applyFreshStartIfNeeded(trades);
    const { value: targetAccountUsd, source: targetAccountSource } =
      await resolveTargetAccountUsd(settings.targetAddress, largestTradeUsd(trades));
    const summary = summarizeWindow(trades, balanceUsd, targetAccountUsd, targetAccountSource);
    return {
      settings: getCopySettings(),
      ...summary,
      lastAutoCopyError,
    };
  } catch (err) {
    return {
      ...empty,
      lastAutoCopyError: err instanceof Error ? err.message : "Failed to fetch copy target",
    };
  }
}

export async function executeCopyTrade(
  client: ClobClient | null,
  market: Btc5mMarket,
  balanceUsd: number | null,
  options: { force?: boolean } = {},
): Promise<CopyExecuteResult> {
  syncCopyWindow(market);

  const trades = await fetchUserTrades(
    settings.targetAddress,
    market.slug,
    market.windowStart,
    market.windowEnd,
  );
  applyFreshStartIfNeeded(trades);

  const { value: targetAccountUsd, source: targetAccountSource } =
    await resolveTargetAccountUsd(settings.targetAddress, largestTradeUsd(trades));

  if (!targetAccountUsd || targetAccountUsd <= 0) {
    const reason = "Could not auto-detect target account size — wait for their first trade";
    lastAutoCopyError = reason;
    return { ok: false, reason };
  }

  let pending = getUncopiedTrades(trades);

  if (pending.length === 0) {
    if (options.force && trades.length > 0) {
      const latest = trades[trades.length - 1];
      copiedTxHashes.delete(latest.transactionHash);
      pending = [latest];
    } else {
      return { ok: false, reason: "No uncopied target trades this window" };
    }
  }

  const bets: BetEntry[] = [];
  let copied = 0;
  let lastError: string | null = null;
  const batch = pending.slice(0, MAX_COPIES_PER_RUN);

  for (const trade of batch) {
    const remaining = getUncopiedTrades(pending);
    const plan = computeCopyPlan(remaining, balanceUsd, targetAccountUsd, targetAccountSource);

    if (plan.amountsByHash.size === 0 || plan.batchScale <= 0) {
      lastError =
        plan.targetAccountUsd === null
          ? "Could not auto-detect target account size"
          : "Insufficient spendable balance for proportional copy";
      lastAutoCopyError = lastError;
      break;
    }

    const amount = plan.amountsByHash.get(trade.transactionHash);
    if (!amount) {
      copiedTxHashes.add(trade.transactionHash);
      continue;
    }

    const result = await copySingleTrade(client, market, trade, amount, balanceUsd);
    if (result.ok) {
      bets.push(result.bet);
      copied += 1;
      lastAutoCopyError = null;
    } else {
      lastError = result.reason;
      lastAutoCopyError = result.reason;
      break;
    }
  }

  if (copied === 0) {
    return { ok: false, reason: lastError ?? "Copy failed", bets, copied };
  }

  const skippedByCap = pending.length - batch.length;
  lastAutoCopyError =
    copied < batch.length ? lastError : skippedByCap > 0 ? lastError : null;
  return {
    ok: true,
    bets,
    copied,
    skipped: pending.length - copied,
  };
}

export async function maybeAutoCopy(
  client: ClobClient | null,
  market: Btc5mMarket | null,
  balanceUsd: number | null,
): Promise<void> {
  if (!settings.enabled || !market) return;

  syncCopyWindow(market);

  try {
    const result = await executeCopyTrade(client, market, balanceUsd);
    if (!result.ok && result.copied === 0) {
      lastAutoCopyError = result.reason;
    }
  } catch (err) {
    lastAutoCopyError = err instanceof Error ? err.message : "Auto-copy failed";
  }
}
