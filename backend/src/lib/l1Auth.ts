import { ApiError, type ApiKeyCreds, type ClobClient } from "@polymarket/clob-client-v2";

export function isValidCreds(creds: ApiKeyCreds): boolean {
  return Boolean(creds.key && creds.secret && creds.passphrase);
}

function formatErr(label: string, err: unknown): string {
  if (err instanceof ApiError) {
    const status = err.status ? ` HTTP ${err.status}` : "";
    return `${label}${status}: ${err.message}`;
  }
  if (err instanceof Error) return `${label}: ${err.message}`;
  return `${label}: ${String(err)}`;
}

export async function deriveApiCredentials(client: ClobClient): Promise<ApiKeyCreds> {
  const errors: string[] = [];

  try {
    const created = await client.createApiKey();
    if (isValidCreds(created)) return created;
    errors.push("createApiKey returned empty credentials");
  } catch (err) {
    errors.push(formatErr("createApiKey", err));
  }

  try {
    const derived = await client.deriveApiKey();
    if (isValidCreds(derived)) return derived;
    errors.push("deriveApiKey returned empty credentials");
  } catch (err) {
    errors.push(formatErr("deriveApiKey", err));
  }

  throw new Error(
    [
      "Could not create or derive Polymarket API credentials.",
      ...errors.map((e) => `  • ${e}`),
      "",
      "Web login users usually need SIGNATURE_TYPE=1 (POLY_PROXY), not 3.",
      "Or create keys manually at: https://polymarket.com/settings?tab=api-keys",
    ].join("\n"),
  );
}
