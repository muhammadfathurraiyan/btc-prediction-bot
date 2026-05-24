import { BTC_5M_SLUG_PREFIX, GAMMA_HOST, WINDOW_SECONDS } from "../config.js";

export interface Btc5mMarket {
  slug: string;
  windowStart: number;
  windowEnd: number;
  question?: string;
  upTokenId?: string;
  downTokenId?: string;
}

interface GammaMarket {
  question?: string;
  clobTokenIds?: string;
  outcomes?: string;
}

interface GammaEvent {
  slug?: string;
  title?: string;
  markets?: GammaMarket[];
}

export function getCurrentWindowStart(nowSec = Math.floor(Date.now() / 1000)): number {
  return Math.floor(nowSec / WINDOW_SECONDS) * WINDOW_SECONDS;
}

export function buildBtc5mSlug(windowStart: number): string {
  return `${BTC_5M_SLUG_PREFIX}-${windowStart}`;
}

export async function fetchCurrentBtc5mMarket(): Promise<Btc5mMarket | null> {
  const windowStart = getCurrentWindowStart();
  const slug = buildBtc5mSlug(windowStart);
  const url = `${GAMMA_HOST}/events?slug=${slug}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gamma API error ${res.status} for slug ${slug}`);
  }

  const events = (await res.json()) as GammaEvent[];
  const event = events[0];
  const market = event?.markets?.[0];
  if (!market) return null;

  let tokenIds: string[] = [];
  try {
    tokenIds = JSON.parse(market.clobTokenIds ?? "[]") as string[];
  } catch {
    tokenIds = [];
  }

  return {
    slug,
    windowStart,
    windowEnd: windowStart + WINDOW_SECONDS,
    question: market.question ?? event.title,
    upTokenId: tokenIds[0],
    downTokenId: tokenIds[1],
  };
}
