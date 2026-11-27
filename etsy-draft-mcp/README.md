# etsy-draft-mcp

Draft-only Etsy MCP for **[GPT Workspace](https://gptworkspace.etsy.com)** and Grok Bot.

Grok can create drafts, upload images, and read your listings.  
**You** click Publish in Etsy Drafts. This server has **no** publish or price-update tools.

| Tool | What it does |
| --- | --- |
| `create_draft_listing` | Creates a **draft** only; runs active price/state guard |
| `upload_listing_image` | Uploads a photo to a draft; same guard |
| `read_listings` | Reads shop listings (model copy on best sellers) |

## Safety rules (baked in)

1. Exactly three tools — run `npm run check-tools` before connecting Grok.
2. Payloads cannot set `state=active` (blocked).
3. Before/after each write, active listing prices/states are snapshotted; any change **stops the run**.
4. Etsy OAuth tokens stay in `.env` on **your** server — never paste them into Grok chat.
5. Prices should come from **your** price sheet; each draft returns a compare-note vs closest live listing.

## 1. Register an Etsy Seller App

1. Open [Your Apps](https://www.etsy.com/developers/your-apps) while logged into the GPT Workspace shop owner account.
2. Create a **Seller App** (for your shop only).
3. Copy **keystring** → `ETSY_API_KEY` and **shared secret** → `ETSY_API_SECRET`.
4. Add redirect URI: `http://localhost:8787/callback` (for `npm run auth`).

## 2. Install and authorize

```bash
cd etsy-draft-mcp
cp .env.example .env
# edit .env: ETSY_API_KEY, ETSY_API_SECRET, MCP_AUTH_TOKEN (long random string)
npm install
npm run auth
```

`npm run auth` opens Etsy OAuth, then writes `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, and `ETSY_SHOP_ID` for https://gptworkspace.etsy.com.

```bash
npm run check-tools   # must list exactly the three draft-only tools
npm test
npm run build
```

## 3. Run for Grok Bot (Streamable HTTP)

```bash
npm run start:http
# listens on http://0.0.0.0:3001/mcp
```

Expose it with a public HTTPS URL (Grok rejects localhost):

```bash
# example
cloudflared tunnel --url http://localhost:3001
# or: ngrok http 3001
```

### Add the custom connector

1. Go to [grok.com/connectors](https://grok.com/connectors) → **New Connector** → **Custom**.
2. Transport: **Streamable HTTP**.
3. Server URL: `https://YOUR-PUBLIC-HOST/mcp`
4. Authentication: Bearer token = the same value as `MCP_AUTH_TOKEN` in `.env`.
5. Save. Confirm Grok only sees the three tools above.

### Bot instructions (paste into Grok Bot)

```text
Shop: https://gptworkspace.etsy.com
Use etsy-draft-mcp only.
Create DRAFTS only — never ask to publish or change live prices.
Read my 10 best sellers first and match title/tag/description patterns.
Prices come from my price sheet; never invent a price.
Use my real product photos only (crop/order/alt text OK; no fake product images).
After drafting, tell me to review Shop Manager → Drafts and publish myself.
```

## 4. Optional: stdio (Cursor / Claude Desktop)

```json
{
  "mcpServers": {
    "etsy-draft": {
      "command": "node",
      "args": ["/absolute/path/to/etsy-draft-mcp/dist/index.js"],
      "env": {
        "ETSY_API_KEY": "...",
        "ETSY_API_SECRET": "...",
        "ETSY_ACCESS_TOKEN": "...",
        "ETSY_REFRESH_TOKEN": "...",
        "ETSY_TOKEN_EXPIRY": "...",
        "ETSY_SHOP_ID": "..."
      }
    }
  }
}
```

## Revoke access

Etsy → Account settings → Apps → revoke this Seller App. The bot loses write access immediately.

## What this will not do

- Publish listings or set `state=active`
- Edit live prices or inventory
- Automate Shop Manager in a browser (use the API path only)
