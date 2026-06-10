import { createPublicClient, erc20Abi, http, type Address } from "viem";
import { polygon } from "viem/chains";
import { DATA_API_HOST } from "../config.js";

const TARGET_FETCH_MS = 8_000;
/** When portfolio + cash are unknown, assume a single trade is at most this % of account. */
const INFERRED_RISK_PCT = 2;

const PUSD_ADDRESS = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB" as const;
const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

export type TargetAccountSource = "auto" | "inferred" | null;

interface TargetAccountCache {
  address: string;
  value: number | null;
  source: TargetAccountSource;
  fetchedAt: number;
}

let cache: TargetAccountCache | null = null;

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TARGET_FETCH_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPositionValueUsd(user: string): Promise<number> {
  try {
    const res = await fetchWithTimeout(`${DATA_API_HOST}/value?user=${user}`);
    if (!res.ok) return 0;
    const rows = (await res.json()) as { value?: number }[];
    const raw = rows[0]?.value;
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? roundUsd(raw) : 0;
  } catch {
    return 0;
  }
}

async function fetchOnChainCollateralUsd(user: string): Promise<number> {
  try {
    const client = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com"),
    });
    const address = user as Address;
    const [pusd, usdce] = await Promise.all([
      client.readContract({
        address: PUSD_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: USDC_E_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
    ]);
    const total = (Number(pusd) + Number(usdce)) / 1e6;
    return total > 0 ? roundUsd(total) : 0;
  } catch {
    return 0;
  }
}

export function inferAccountFromLargestTrade(largestTradeUsd: number): number {
  if (largestTradeUsd <= 0) return 0;
  return roundUsd(largestTradeUsd / (INFERRED_RISK_PCT / 100));
}

export async function resolveTargetAccountUsd(
  targetAddress: string,
  largestTradeUsd = 0,
): Promise<{ value: number | null; source: TargetAccountSource }> {
  const now = Date.now();
  if (cache && cache.address === targetAddress && now - cache.fetchedAt < 30_000) {
    return { value: cache.value, source: cache.source };
  }

  const [positionsUsd, cashUsd] = await Promise.all([
    fetchPositionValueUsd(targetAddress),
    fetchOnChainCollateralUsd(targetAddress),
  ]);

  const combined = roundUsd(positionsUsd + cashUsd);
  if (combined > 0) {
    cache = { address: targetAddress, value: combined, source: "auto", fetchedAt: now };
    return { value: combined, source: "auto" };
  }

  const inferred = inferAccountFromLargestTrade(largestTradeUsd);
  if (inferred > 0) {
    cache = { address: targetAddress, value: inferred, source: "inferred", fetchedAt: now };
    return { value: inferred, source: "inferred" };
  }

  cache = { address: targetAddress, value: null, source: null, fetchedAt: now };
  return { value: null, source: null };
}

export function clearTargetAccountCache(): void {
  cache = null;
}
