#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDraftOnlyServer } from "./server.js";

async function main() {
  const server = createDraftOnlyServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    "etsy-draft-mcp (stdio) ready — tools: create_draft_listing, upload_listing_image, read_listings"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
