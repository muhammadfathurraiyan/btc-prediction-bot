import type { ClobClient } from "@polymarket/clob-client-v2";
import { fetchCollateralBalance } from "./clobClient.js";

export interface BalanceResult {
  balanceUsd: number | null;
  balanceError: string | null;
}

export async function fetchBalanceUsd(client: ClobClient): Promise<BalanceResult> {
  try {
    const { balance } = await fetchCollateralBalance(client);
    const raw = typeof balance === "bigint" ? Number(balance) : Number(balance);
    if (!Number.isFinite(raw)) {
      return { balanceUsd: null, balanceError: "Invalid balance response from Polymarket" };
    }
    return { balanceUsd: raw / 1e6, balanceError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch balance";
    return { balanceUsd: null, balanceError: message };
  }
}
