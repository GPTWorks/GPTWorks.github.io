#!/usr/bin/env node
/**
 * Hiten's rule: before connecting to Grok, confirm exactly three tools.
 * Run: npm run check-tools
 */
import { ALLOWED_TOOL_NAMES } from "./tools.js";
import { FORBIDDEN_TOOL_NAMES } from "./etsy.js";
import { createDraftOnlyServer, assertToolSurface } from "./server.js";

async function main() {
  createDraftOnlyServer();
  assertToolSurface([...ALLOWED_TOOL_NAMES]);

  for (const name of FORBIDDEN_TOOL_NAMES) {
    if ((ALLOWED_TOOL_NAMES as readonly string[]).includes(name)) {
      throw new Error(`Forbidden tool present: ${name}`);
    }
  }

  console.log("OK — tool surface is draft-only:");
  for (const name of ALLOWED_TOOL_NAMES) console.log(`  - ${name}`);
  console.log("\nForbidden tools absent:");
  for (const name of FORBIDDEN_TOOL_NAMES) console.log(`  - ${name}`);
  console.log("\nShop target: https://gptworkspace.etsy.com");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
