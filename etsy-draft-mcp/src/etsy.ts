import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT, ".env");
const OPENAPI_BASE = "https://openapi.etsy.com/v3";
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

export type EnvConfig = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  shopId: string;
};

export function loadEnv(): EnvConfig {
  return {
    apiKey: process.env.ETSY_API_KEY ?? "",
    apiSecret: process.env.ETSY_API_SECRET ?? "",
    accessToken: process.env.ETSY_ACCESS_TOKEN ?? "",
    refreshToken: process.env.ETSY_REFRESH_TOKEN ?? "",
    tokenExpiry: Number(process.env.ETSY_TOKEN_EXPIRY ?? "0"),
    shopId: process.env.ETSY_SHOP_ID ?? "",
  };
}

export function requireShopId(): string {
  const id = loadEnv().shopId;
  if (!id) {
    throw new Error(
      "ETSY_SHOP_ID is not set. Run `npm run auth` after creating your Etsy Seller App."
    );
  }
  return id;
}

export function apiKeyHeader(): string {
  const { apiKey, apiSecret } = loadEnv();
  if (!apiKey) throw new Error("ETSY_API_KEY is not set.");
  return apiSecret ? `${apiKey}:${apiSecret}` : apiKey;
}

function updateEnvFile(updates: Record<string, string>): void {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) content = content.replace(re, line);
    else content += (content.endsWith("\n") || content.length === 0 ? "" : "\n") + `${line}\n`;
    process.env[key] = value;
  }
  fs.writeFileSync(ENV_PATH, content, "utf8");
}

export function saveTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): void {
  const expiry = Date.now() + data.expires_in * 1000;
  const updates: Record<string, string> = {
    ETSY_ACCESS_TOKEN: data.access_token,
    ETSY_TOKEN_EXPIRY: String(expiry),
  };
  if (data.refresh_token) updates.ETSY_REFRESH_TOKEN = data.refresh_token;
  updateEnvFile(updates);
}

export function saveShopId(shopId: string | number): void {
  updateEnvFile({ ETSY_SHOP_ID: String(shopId) });
}

async function refreshAccessToken(): Promise<string> {
  const env = loadEnv();
  if (!env.refreshToken) {
    throw new Error("No refresh token. Run `npm run auth` first.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.apiKey,
    refresh_token: env.refreshToken,
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${text}`);
  }
  const data = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  saveTokens(data);
  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const env = loadEnv();
  if (!env.accessToken || Date.now() > env.tokenExpiry - 60_000) {
    return refreshAccessToken();
  }
  return env.accessToken;
}

async function etsyFetch(
  method: string,
  pathName: string,
  options: {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    form?: globalThis.FormData;
    oauth?: boolean;
  } = {}
): Promise<unknown> {
  const { query, body, form, oauth = true } = options;
  const url = new URL(`${OPENAPI_BASE}${pathName}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "x-api-key": apiKeyHeader(),
  };
  if (oauth) {
    headers.Authorization = `Bearer ${await getAccessToken()}`;
  }

  let payload: BodyInit | undefined;
  if (form) {
    // Let fetch set multipart boundary; do not set Content-Type manually.
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const resp = await fetch(url, { method, headers, body: payload });
  const text = await resp.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!resp.ok) {
    throw new Error(
      `Etsy ${method} ${pathName} failed (${resp.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }
  return data;
}

export async function etsyGet(
  pathName: string,
  query?: Record<string, string | number | undefined>,
  oauth = true
): Promise<unknown> {
  return etsyFetch("GET", pathName, { query, oauth });
}

export async function etsyPost(
  pathName: string,
  body: unknown
): Promise<unknown> {
  return etsyFetch("POST", pathName, { body });
}

export async function etsyPostForm(
  pathName: string,
  form: globalThis.FormData
): Promise<unknown> {
  return etsyFetch("POST", pathName, { form });
}

/** Block any payload that would publish or reprice via this server. */
export function assertDraftOnlyPayload(payload: Record<string, unknown>): void {
  if ("state" in payload && payload.state !== undefined && payload.state !== "draft") {
    throw new Error(
      `Blocked: this draft-only MCP refuses state=${String(payload.state)}. Create drafts only; publish yourself in Etsy Drafts.`
    );
  }
  // Defense in depth: strip state entirely; createDraftListing creates drafts.
  delete payload.state;
}

export const FORBIDDEN_TOOL_NAMES = [
  "publish_listing",
  "update_listing",
  "delete_listing",
  "update_inventory",
  "update_shop",
] as const;
