import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ALLOWED_TOOL_NAMES, registerTools } from "./tools.js";
import { FORBIDDEN_TOOL_NAMES } from "./etsy.js";

export function createDraftOnlyServer(): McpServer {
  const server = new McpServer({
    name: "etsy-draft-mcp",
    version: "1.0.0",
  });

  registerTools(server);

  const listed = new Set<string>(ALLOWED_TOOL_NAMES);
  for (const name of FORBIDDEN_TOOL_NAMES) {
    if (listed.has(name)) {
      throw new Error(`Refusing to start: forbidden tool registered: ${name}`);
    }
  }

  return server;
}

export function assertToolSurface(toolNames: string[]): void {
  const allowed = new Set<string>(ALLOWED_TOOL_NAMES);
  const unexpected = toolNames.filter((n) => !allowed.has(n));
  const missing = ALLOWED_TOOL_NAMES.filter((n) => !toolNames.includes(n));
  if (unexpected.length || missing.length) {
    throw new Error(
      `Tool surface mismatch. unexpected=${unexpected.join(",") || "none"} missing=${missing.join(",") || "none"}`
    );
  }
}
