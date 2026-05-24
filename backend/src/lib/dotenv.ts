import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function loadBackendEnv(): void {
  loadDotenv({ path: resolve(backendRoot, ".env") });
}

export const BACKEND_ROOT = backendRoot;
