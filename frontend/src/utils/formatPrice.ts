const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function formatUsd(value: number): string {
  return `$${formatPrice(value)}`;
}

export function formatSignedUsd(value: number): string {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}$${formatPrice(Math.abs(value))}`;
}
