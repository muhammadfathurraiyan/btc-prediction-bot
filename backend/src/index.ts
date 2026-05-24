import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  executeCopyTrade,
  getCopySettings,
  normalizeTargetAddress,
  updateCopySettings,
} from "./lib/copyTrade.js";
import { buildDashboardSnapshot, updateDemoMode } from "./lib/dashboard.js";
import { loadBackendEnv } from "./lib/dotenv.js";
import { loadServerEnv } from "./lib/env.js";
import { readJsonBody, sendJson, setCors, getRequestPath } from "./lib/http.js";
import { createTradingClientFromEnv } from "./lib/clobClient.js";
import { fetchBalanceUsd } from "./lib/balance.js";
import { placeUserBet } from "./lib/betting.js";
import { fetchCurrentBtc5mMarket } from "./lib/market.js";
import { attachRealtime } from "./lib/realtime.js";
import type { BetDirection } from "./lib/history.js";

loadBackendEnv();

const PORT = Number(process.env.PORT ?? 3001);

async function getClientAndBalance() {
  try {
    const env = loadServerEnv(false);
    const client = await createTradingClientFromEnv(env);
    if (!client) return { client: null, balanceUsd: null as number | null };
    const { balanceUsd } = await fetchBalanceUsd(client);
    return { client, balanceUsd };
  } catch {
    return { client: null, balanceUsd: null as number | null };
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = getRequestPath(req.url ?? "/");
  const method = req.method ?? "GET";

  try {
    if (method === "GET" && path === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && path === "/api/market") {
      const market = await fetchCurrentBtc5mMarket();
      sendJson(res, 200, market);
      return;
    }

    if (method === "GET" && path === "/api/dashboard") {
      const dashboard = await buildDashboardSnapshot(false);
      sendJson(res, 200, dashboard);
      return;
    }

    if (method === "POST" && path === "/api/demo") {
      const body = await readJsonBody<{ enabled?: boolean }>(req);
      const snap = await buildDashboardSnapshot(false);
      const result = updateDemoMode(Boolean(body.enabled), snap.balanceUsd);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && path === "/api/bet") {
      const body = await readJsonBody<{ direction?: BetDirection; amount?: number; confidence?: number }>(req);
      const direction = body.direction;
      const amount = body.amount;
      const confidence = body.confidence ?? 0;

      if (direction !== "UP" && direction !== "DOWN") {
        sendJson(res, 400, { error: "direction must be UP or DOWN" });
        return;
      }
      if (!amount || amount <= 0) {
        sendJson(res, 400, { error: "amount must be a positive number" });
        return;
      }

      const { client, balanceUsd } = await getClientAndBalance();
      const market = await fetchCurrentBtc5mMarket();
      if (!market) {
        sendJson(res, 404, { error: "No active BTC 5m market for the current window" });
        return;
      }

      const result = await placeUserBet(client, market, direction, amount, confidence, balanceUsd);
      sendJson(res, 200, result);
      return;
    }

    if (method === "POST" && path === "/api/copy/settings") {
      const body = await readJsonBody<{
        enabled?: boolean;
        betSize?: number;
        targetAddress?: string;
      }>(req);

      let targetAddress: string | undefined;
      if (body.targetAddress !== undefined) {
        const normalized = normalizeTargetAddress(body.targetAddress);
        if (!normalized) {
          sendJson(res, 400, { error: "Invalid wallet address (use 0x + 40 hex characters)" });
          return;
        }
        targetAddress = normalized;
      }

      const settings = updateCopySettings({
        enabled: body.enabled,
        betSize: body.betSize,
        targetAddress,
      });
      sendJson(res, 200, { settings });
      return;
    }

    if (method === "POST" && path === "/api/copy/execute") {
      const body = await readJsonBody<{ betSize?: number; force?: boolean }>(req);
      const { client, balanceUsd } = await getClientAndBalance();
      const market = await fetchCurrentBtc5mMarket();
      if (!market) {
        sendJson(res, 404, { error: "No active BTC 5m market for the current window" });
        return;
      }

      const settings = getCopySettings();
      const betSize = body.betSize ?? settings.betSize;
      const result = await executeCopyTrade(client, market, betSize, balanceUsd, {
        force: body.force ?? false,
      });

      if (!result.ok) {
        sendJson(res, 400, { error: result.reason });
        return;
      }

      sendJson(res, 200, { bet: result.bet });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendJson(res, 500, { error: message });
  }
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendJson(res, 500, { error: message });
  });
});

attachRealtime(server);

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`  WS   ws://localhost:${PORT}/ws`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/market`);
  console.log(`  GET  /api/dashboard`);
  console.log(`  POST /api/bet`);
  console.log(`  POST /api/demo`);
  console.log(`  POST /api/copy/settings`);
  console.log(`  POST /api/copy/execute`);
});
