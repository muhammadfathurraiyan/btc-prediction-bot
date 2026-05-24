import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getLiveChainlinkBtcUsd, startChainlinkFeed } from "./chainlinkPrice.js";
import { buildDashboardSnapshot } from "./dashboard.js";
import { applyLiveChainlinkOverlay } from "./liveBtcOverlay.js";
import { clearPriceToBeatCache } from "./priceToBeat.js";
import { getCurrentWindowStart } from "./market.js";

const BROADCAST_MS = 2000;
const TICK_THROTTLE_MS = 250;

let lastTickSent = 0;
let lastWindowStart: number | null = null;
const clients = new Set<WebSocket>();

function broadcast(payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

async function broadcastDashboard(): Promise<void> {
  try {
    const data = await buildDashboardSnapshot(true);
    const liveBtc = getLiveChainlinkBtcUsd();

    if (liveBtc !== null && data.signals) {
      const overlay = applyLiveChainlinkOverlay(data.signals, data.priceToBeat);
      data.signals = overlay.signals;
      if (overlay.btcVsBeatPct !== null) {
        data.btcVsBeatPct = overlay.btcVsBeatPct;
      }
    }

    broadcast({ type: "dashboard", data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dashboard broadcast failed";
    broadcast({ type: "error", message });
  }
}

export function attachRealtime(server: Server): void {
  startChainlinkFeed();

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "connected" }));
    broadcastDashboard().catch(() => undefined);

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });

  setInterval(() => {
    const liveBtc = getLiveChainlinkBtcUsd();
    if (liveBtc !== null) {
      const now = Date.now();
      const windowStart = getCurrentWindowStart();
      if (lastWindowStart !== null && windowStart !== lastWindowStart) {
        clearPriceToBeatCache();
      }
      lastWindowStart = windowStart;

      if (now - lastTickSent >= TICK_THROTTLE_MS) {
        lastTickSent = now;
        broadcast({ type: "tick", btc: liveBtc, ts: now });
      }
    }

    broadcastDashboard().catch(() => undefined);
  }, BROADCAST_MS);

  broadcastDashboard();
}
