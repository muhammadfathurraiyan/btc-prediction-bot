import { isAddress } from "viem";
import { DEFAULT_COPY_TARGET, DATA_API_HOST } from "../config.js";
import type { ClobClient } from "@polymarket/clob-client-v2";
import { getDemoBalance, isDemoActive } from "./demo.js";
import { placeUserCopyTrade } from "./betting.js";
import type { BetDirection, BetEntry } from "./history.js";
import type { Btc5mMarket } from "./market.js";

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
  /** Planned copy size for this trade given current balance (≤ amountUsd). */
  scaledAmountUsd: number;
  alreadyCopied: boolean;
}

export interface CopySettings {
  enabled: boolean;
  /** Max USDC per copied trade (target size is scaled up to this cap). */
  betSize: number;
  /** Share of spendable balance to allocate across pending copies this run (10–100). */
  budgetPct: number;
  targetAddress: string;
}

export interface CopyTradeState {
  settings: CopySettings;
  prediction: CopyPrediction | null;
  windowTradeCount: number;
  copiedCount: number;
  pendingCount: number;
  /** Sum of target notionals for pending trades (before balance scaling). */
  pendingTotalUsd: number;
  /** Sum of planned copy sizes for pending trades with current balance. */
  plannedCopyUsd: number;
  /** 100 = full target size; lower when balance scales copies down. */
  sizeScalePct: number | null;
  lastAutoCopyError: string | null;
}

const copiedTxHashes = new Set<string>();
let lastCopyWindowStart: number | null = null;
let skipExistingOnNextSync = false;

let settings: CopySettings = {
  enabled: false,
  betSize: 100,
  budgetPct: 50,
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

function targetNotionalCapped(trade: PolymarketUserTrade, maxUsd: number): number {
  const raw = tradeNotionalUsd(trade);
  return Math.round(Math.min(maxUsd, raw > 0 ? raw : maxUsd) * 100) / 100;
}

function spendableBalanceUsd(balance: number): number {
  const reserve = Math.max(RESERVE_MIN_USD, balance * (RESERVE_PCT / 100));
  return Math.max(0, Math.round((balance - reserve) * 100) / 100);
}

function copyBudgetUsd(balanceUsd: number | null): number {
  const balance = effectiveBalance(balanceUsd);
  if (balance === null || balance <= 0) return 0;
  const spendable = spendableBalanceUsd(balance);
  return Math.round(spendable * (settings.budgetPct / 100) * 100) / 100;
}

function copyAmountFromTarget(cappedTargetUsd: number, scale: number, maxUsd: number): number {
  const scaled = cappedTargetUsd * scale;
  const capped = Math.min(maxUsd, scaled > 0 ? scaled : maxUsd);
  return Math.round(Math.max(MIN_COPY_USD, capped) * 100) / 100;
}

interface CopyPlan {
  scale: number;
  amountsByHash: Map<string, number>;
  targetTotalUsd: number;
  plannedTotalUsd: number;
}

function computeCopyPlan(pending: PolymarketUserTrade[], balanceUsd: number | null): CopyPlan {
  const maxUsd = settings.betSize;
  const budget = copyBudgetUsd(balanceUsd);

  const targets = pending.map((t) => ({
    hash: t.transactionHash,
    capped: targetNotionalCapped(t, maxUsd),
  }));

  const targetTotalUsd =
    Math.round(targets.reduce((sum, t) => sum + t.capped, 0) * 100) / 100;

  if (pending.length === 0) {
    return { scale: 1, amountsByHash: new Map(), targetTotalUsd: 0, plannedTotalUsd: 0 };
  }

  if (budget < MIN_COPY_USD) {
    return { scale: 0, amountsByHash: new Map(), targetTotalUsd, plannedTotalUsd: 0 };
  }

  const scale = targetTotalUsd <= budget ? 1 : budget / targetTotalUsd;
  const amountsByHash = new Map<string, number>();
  let plannedTotalUsd = 0;

  for (const t of targets) {
    const amount = copyAmountFromTarget(t.capped, scale, maxUsd);
    amountsByHash.set(t.hash, amount);
    plannedTotalUsd += amount;
  }

  return {
    scale,
    amountsByHash,
    targetTotalUsd,
    plannedTotalUsd: Math.round(plannedTotalUsd * 100) / 100,
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

async function fetchWindowTradesFromActivity(user: string, slug: string): Promise<PolymarketUserTrade[]> {
  const params = new URLSearchParams({ user, limit: "500" });
  const res = await fetch(`${DATA_API_HOST}/activity?${params}`);
  if (!res.ok) throw new Error(`Data API activity error ${res.status}`);

  const rows = (await res.json()) as Record<string, unknown>[];
  const trades: PolymarketUserTrade[] = [];
  for (const row of rows) {
    if (row.slug !== slug) continue;
    if (row.type && row.type !== "TRADE") continue;
    const trade = activityToTrade(row);
    if (trade) trades.push(trade);
  }
  return trades;
}

export async function fetchUserTrades(
  user: string,
  slug: string,
  eventId?: number,
): Promise<PolymarketUserTrade[]> {
  const params = new URLSearchParams({
    user,
    limit: "500",
    takerOnly: "false",
  });
  if (eventId) params.set("eventId", String(eventId));

  const res = await fetch(`${DATA_API_HOST}/trades?${params}`);
  if (!res.ok) throw new Error(`Data API error ${res.status}`);

  let trades = (await res.json()) as PolymarketUserTrade[];
  if (!eventId) trades = trades.filter((t) => t.slug === slug);

  if (trades.length === 0) {
    trades = await fetchWindowTradesFromActivity(user, slug);
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
): {
  prediction: CopyPrediction | null;
  windowTradeCount: number;
  copiedCount: number;
  pendingCount: number;
  pendingTotalUsd: number;
  plannedCopyUsd: number;
  sizeScalePct: number | null;
} {
  if (trades.length === 0) {
    return {
      prediction: null,
      windowTradeCount: 0,
      copiedCount: 0,
      pendingCount: 0,
      pendingTotalUsd: 0,
      plannedCopyUsd: 0,
      sizeScalePct: null,
    };
  }

  const pending = getUncopiedTrades(trades);
  const plan = computeCopyPlan(pending, balanceUsd);
  const latest = trades[trades.length - 1];
  const latestScaled =
    plan.amountsByHash.get(latest.transactionHash) ??
    targetNotionalCapped(latest, settings.betSize);

  const balance = effectiveBalance(balanceUsd);
  const sizeScalePct =
    balance === null ? null : Math.round(plan.scale * 1000) / 10;

  return {
    prediction: buildPrediction(latest, latestScaled),
    windowTradeCount: trades.length,
    copiedCount: trades.length - pending.length,
    pendingCount: pending.length,
    pendingTotalUsd: plan.targetTotalUsd,
    plannedCopyUsd: plan.plannedTotalUsd,
    sizeScalePct,
  };
}

export async function getTargetPrediction(
  user: string,
  market: Btc5mMarket,
): Promise<CopyPrediction | null> {
  const trades = await fetchUserTrades(user, market.slug, market.eventId);
  return summarizeWindow(trades, null).prediction;
}

export function getCopySettings(): CopySettings {
  return { ...settings };
}

export function normalizeTargetAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) return null;
  return trimmed.toLowerCase() as `0x${string}`;
}

function clampBudgetPct(value: number): number {
  return Math.min(100, Math.max(10, Math.round(value)));
}

export function updateCopySettings(partial: Partial<CopySettings>): CopySettings {
  const wasEnabled = settings.enabled;
  if (partial.enabled !== undefined) settings.enabled = partial.enabled;
  if (partial.betSize !== undefined) settings.betSize = partial.betSize;
  if (partial.budgetPct !== undefined) settings.budgetPct = clampBudgetPct(partial.budgetPct);
  if (!wasEnabled && settings.enabled) {
    // Fresh start on toggle-on: ignore existing window trades and copy only new ones.
    skipExistingOnNextSync = true;
  }
  if (partial.targetAddress !== undefined) {
    const next = partial.targetAddress.toLowerCase();
    if (next !== settings.targetAddress) {
      copiedTxHashes.clear();
      lastAutoCopyError = null;
      lastCopyWindowStart = null;
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
  const empty = {
    settings: getCopySettings(),
    prediction: null,
    windowTradeCount: 0,
    copiedCount: 0,
    pendingCount: 0,
    pendingTotalUsd: 0,
    plannedCopyUsd: 0,
    sizeScalePct: null,
    lastAutoCopyError,
  };

  if (!market) return empty;

  syncCopyWindow(market);

  try {
    const trades = await fetchUserTrades(settings.targetAddress, market.slug, market.eventId);
    applyFreshStartIfNeeded(trades);
    const summary = summarizeWindow(trades, balanceUsd);
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

  const trades = await fetchUserTrades(settings.targetAddress, market.slug, market.eventId);
  applyFreshStartIfNeeded(trades);
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
    const plan = computeCopyPlan(remaining, balanceUsd);
    const amount = plan.amountsByHash.get(trade.transactionHash);

    if (!amount || plan.scale <= 0) {
      lastError =
        "Copy budget too low — raise balance, Copy budget %, or wait for pending to clear";
      lastAutoCopyError = lastError;
      break;
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
