#!/usr/bin/env node
/**
 * Local OAuth PKCE flow for the GPT Workspace Etsy shop.
 * Opens a browser, saves tokens + shop_id into .env.
 */
import http from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";
import dotenv from "dotenv";
import { etsyGet, loadEnv, saveShopId, saveTokens } from "./etsy.js";

dotenv.config();

const REDIRECT_URI =
  process.env.ETSY_REDIRECT_URI ?? "http://localhost:8787/callback";
const SCOPES =
  process.env.ETSY_SCOPES ?? "shops_r listings_r listings_w listings_d";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function main() {
  const env = loadEnv();
  if (!env.apiKey) {
    console.error("Set ETSY_API_KEY in .env (from https://www.etsy.com/developers/your-apps)");
    process.exit(1);
  }

  const { verifier, challenge } = pkcePair();
  const state = base64url(crypto.randomBytes(16));
  const redirect = new URL(REDIRECT_URI);
  const port = Number(redirect.port || "8787");

  const authUrl = new URL("https://www.etsy.com/oauth/connect");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", env.apiKey);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url ?? "/", `http://localhost:${port}`);
        if (u.pathname !== redirect.pathname) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const err = u.searchParams.get("error");
        if (err) {
          res.writeHead(400);
          res.end(`OAuth error: ${err}`);
          reject(new Error(err));
          server.close();
          return;
        }
        const returnedState = u.searchParams.get("state");
        const authCode = u.searchParams.get("code");
        if (returnedState !== state || !authCode) {
          res.writeHead(400);
          res.end("Invalid state or missing code");
          reject(new Error("Invalid OAuth callback"));
          server.close();
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Etsy connected</h1><p>You can close this tab and return to the terminal.</p></body></html>"
        );
        server.close();
        resolve(authCode);
      } catch (e) {
        reject(e);
        server.close();
      }
    });
    server.listen(port, "127.0.0.1", () => {
      console.log("Authorize this app for your shop https://gptworkspace.etsy.com");
      console.log("Open this URL in your browser:\n");
      console.log(authUrl.toString());
      console.log(`\nWaiting on ${REDIRECT_URI} …`);
    });
  });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.apiKey,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  });

  const tokenResp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResp.ok) {
    throw new Error(`Token exchange failed: ${await tokenResp.text()}`);
  }
  const tokenData = (await tokenResp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  saveTokens(tokenData);
  console.log("Saved access + refresh tokens to .env");

  // Etsy access tokens are `{user_id}.{secret}` — parse user id from the token.
  const userId = tokenData.access_token.split(".")[0];
  if (!userId || !/^\d+$/.test(userId)) {
    throw new Error("Could not parse Etsy user id from access token");
  }

  const shops = (await etsyGet(
    `/application/users/${userId}/shops`,
    undefined,
    true
  )) as {
    shop_id?: number;
    shop_name?: string;
    results?: Array<{ shop_id: number; shop_name?: string }>;
  };

  const shop =
    shops.shop_id != null
      ? { shop_id: shops.shop_id, shop_name: shops.shop_name ?? "primary" }
      : shops.results?.[0];

  if (!shop?.shop_id) {
    throw new Error(
      "No shop found on this Etsy account. Sign in with the owner of https://gptworkspace.etsy.com"
    );
  }
  saveShopId(shop.shop_id);
  console.log(
    `Saved ETSY_SHOP_ID=${shop.shop_id} (${shop.shop_name ?? "shop"}) for https://gptworkspace.etsy.com`
  );
  console.log("Done. Start the MCP with `npm run start:http` or `npm start`.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
