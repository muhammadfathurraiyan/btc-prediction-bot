import type { ClobClient, OrderBookSummary } from "@polymarket/clob-client-v2";
import { fetchBtcMarketData } from "./btcPrice.js";
import { parseMid } from "./clobUtils.js";
import { computeEma, computeRsi, computeVolumeSpikePct } from "./indicators.js";
import { WINDOW_SECONDS } from "../config.js";
import type { Btc5mMarket } from "./market.js";

export interface DashboardSignals {
  rsi: number;
  vol: number;
  marketUpPct: number;
  btc: number;
  ema: "Bullish" | "Bearish";
  ob: "Bid heavy" | "Ask heavy";
  isUp: boolean;
  composite: number;
  btcChange: string;
  alignedSignals: number;
  totalSignals: number;
  upMid: number;
  downMid: number;
}

const TOTAL_SIGNALS = 5;

function sumBookSize(book: OrderBookSummary | null, side: "bids" | "asks"): number {
  if (!book) return 0;
  return book[side].reduce((sum, level) => sum + Number(level.size), 0);
}

function rsiFavorsUp(rsi: number): boolean {
  return rsi >= 50;
}

function volumeFavorsUp(volSpike: number, changePct: number): boolean {
  return volSpike >= 0 && changePct >= 0;
}

export async function buildSignals(
  market: Btc5mMarket,
  client: ClobClient,
): Promise<DashboardSignals> {
  const { price: btc, changePct: btcChange, closes1m, volumes5m } = await fetchBtcMarketData();
  const changeNum = Number(btcChange);

  const [upBook, downBook, upMidRaw, downMidRaw] = await Promise.all([
    market.upTokenId ? client.getOrderBook(market.upTokenId) : Promise.resolve(null),
    market.downTokenId ? client.getOrderBook(market.downTokenId) : Promise.resolve(null),
    market.upTokenId ? client.getMidpoint(market.upTokenId) : Promise.resolve(null),
    market.downTokenId ? client.getMidpoint(market.downTokenId) : Promise.resolve(null),
  ]);

  const upMid = parseMid(upMidRaw);
  const downMid = parseMid(downMidRaw);
  const bidDepth = sumBookSize(upBook, "bids") + sumBookSize(downBook, "bids");
  const askDepth = sumBookSize(upBook, "asks") + sumBookSize(downBook, "asks");

  const rsi = computeRsi(closes1m, 14);
  const ema9 = computeEma(closes1m, 9);
  const ema21 = computeEma(closes1m, 21);
  const emaBullish = ema9 > ema21;
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(1, nowSec - market.windowStart);
  const windowRatio = Math.min(0.99, elapsed / WINDOW_SECONDS);
  const vol = computeVolumeSpikePct(volumes5m, windowRatio);
  const marketUpPct = Math.round(upMid * 100);
  const ob: DashboardSignals["ob"] = bidDepth >= askDepth ? "Bid heavy" : "Ask heavy";

  const votes = [
    rsiFavorsUp(rsi),
    emaBullish,
    volumeFavorsUp(vol, changeNum),
    ob === "Bid heavy",
    marketUpPct >= 50,
  ];
  const upVotes = votes.filter(Boolean).length;
  const isUp = upVotes >= 3;
  const alignedSignals = isUp ? upVotes : TOTAL_SIGNALS - upVotes;
  const composite = Math.round((alignedSignals / TOTAL_SIGNALS) * 100);

  return {
    rsi,
    vol,
    marketUpPct,
    btc,
    ema: emaBullish ? "Bullish" : "Bearish",
    ob,
    isUp,
    composite,
    btcChange,
    alignedSignals,
    totalSignals: TOTAL_SIGNALS,
    upMid,
    downMid,
  };
}
