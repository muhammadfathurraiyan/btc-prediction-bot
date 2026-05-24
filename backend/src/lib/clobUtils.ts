export function parseMid(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object" && "mid" in raw) {
    const mid = Number((raw as { mid: string }).mid);
    return mid > 0 ? mid : 0.5;
  }
  return 0.5;
}
