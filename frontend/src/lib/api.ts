import type { DashboardResponse, PlaceBetResponse } from "../types/api";
import type { Direction } from "../types";
import type { CopyExecuteResponse, CopySettings } from "../types/copy";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function fetchDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/dashboard");
}

export function setDemoModeApi(enabled: boolean): Promise<{ demoMode: boolean; demoBalance: number }> {
  return request("/api/demo", {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export function placeBetApi(
  direction: Direction,
  amount: number,
  confidence: number,
): Promise<PlaceBetResponse> {
  return request<PlaceBetResponse>("/api/bet", {
    method: "POST",
    body: JSON.stringify({ direction, amount, confidence }),
  });
}

export function updateCopySettingsApi(settings: Partial<CopySettings>): Promise<{ settings: CopySettings }> {
  return request<{ settings: CopySettings }>("/api/copy/settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export function executeCopyTradeApi(maxCopyUsd?: number, force = false): Promise<CopyExecuteResponse> {
  return request<CopyExecuteResponse>("/api/copy/execute", {
    method: "POST",
    body: JSON.stringify({ betSize: maxCopyUsd, force }),
  });
}

export function getWsUrl(): string {
  const base = import.meta.env.VITE_WS_URL;
  if (base) return base;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}
