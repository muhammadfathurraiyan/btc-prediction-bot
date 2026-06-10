import WebSocket from "ws";
import { RTDS_WS } from "../config.js";

const PING_MS = 5000;
const MAX_HISTORY = 8000;
const CHAINLINK_SYMBOL = "btc/usd";

interface PriceTick {
  timestamp: number;
  value: number;
}

let history: PriceTick[] = [];
let livePrice: number | null = null;
let lastRtdsError: string | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function pushTick(timestamp: number, value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  livePrice = value;

  const last = history[history.length - 1];
  if (last && last.timestamp === timestamp && last.value === value) return;

  history.push({ timestamp, value });
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
}

function ingestPayload(payload: {
  symbol?: string;
  timestamp?: number;
  value?: number;
  data?: { timestamp: number; value: number }[];
}): void {
  if (payload.symbol?.toLowerCase() !== CHAINLINK_SYMBOL) return;

  if (Array.isArray(payload.data)) {
    for (const point of payload.data) {
      if (typeof point.timestamp === "number" && typeof point.value === "number") {
        pushTick(point.timestamp, point.value);
      }
    }
    return;
  }

  if (typeof payload.timestamp === "number" && typeof payload.value === "number") {
    pushTick(payload.timestamp, payload.value);
  }
}

function handleMessage(raw: string): void {
  if (raw === "PONG") return;

  try {
    const msg = JSON.parse(raw) as {
      topic?: string;
      type?: string;
      payload?: {
        symbol?: string;
        timestamp?: number;
        value?: number;
        data?: { timestamp: number; value: number }[];
      };
    };

    if (msg.topic && msg.topic !== "crypto_prices_chainlink") return;
    if (msg.payload) ingestPayload(msg.payload);
  } catch {
    // ignore malformed frames
  }
}

export function getLiveChainlinkBtcUsd(): number | null {
  return livePrice;
}

/** Human-readable RTDS/Chainlink status for the dashboard when price data is missing. */
export function getChainlinkError(): string | null {
  if (lastRtdsError) return `Chainlink RTDS error: ${lastRtdsError}`;
  if (livePrice === null && history.length === 0) {
    return "Chainlink RTDS: no BTC/USD price data received yet";
  }
  return null;
}

/** Closest Chainlink tick at or before targetMs; falls back to nearest within maxDiffMs. */
export function getChainlinkPriceAt(targetMs: number, maxDiffMs = 120_000): number | null {
  if (history.length === 0) return livePrice;

  let atOrBefore: PriceTick | null = null;
  let closest: PriceTick | null = null;
  let minDiff = Infinity;

  for (const tick of history) {
    if (tick.timestamp <= targetMs) {
      if (!atOrBefore || tick.timestamp > atOrBefore.timestamp) {
        atOrBefore = tick;
      }
    }

    const diff = Math.abs(tick.timestamp - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = tick;
    }
  }

  if (atOrBefore) return atOrBefore.value;
  if (closest && minDiff <= maxDiffMs) return closest.value;
  return null;
}

export function startChainlinkFeed(): void {
  const connect = () => {
    const ws = new WebSocket(RTDS_WS);

    ws.on("open", () => {
      lastRtdsError = null;
      // Subscribe without server-side filter — some RTDS endpoints reject JSON filters.
      ws.send(
        JSON.stringify({
          action: "subscribe",
          subscriptions: [{ topic: "crypto_prices_chainlink", type: "*", filters: "" }],
        }),
      );

      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("PING");
      }, PING_MS);
    });

    ws.on("message", (data) => handleMessage(String(data)));
    ws.on("close", () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      setTimeout(connect, 3000);
    });
    ws.on("error", (err) => {
      lastRtdsError = err.message;
      console.warn("[chainlink] RTDS error:", err.message);
      ws.close();
    });
  };

  connect();
}
