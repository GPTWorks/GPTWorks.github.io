#!/usr/bin/env node
/**
 * Streamable HTTP MCP for Grok custom connectors.
 * Protect with MCP_AUTH_TOKEN (Authorization: Bearer <token>).
 */
import express from "express";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createDraftOnlyServer } from "./server.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? "3001");
const HOST = process.env.HOST ?? "0.0.0.0";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? "";

const app = express();
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "etsy-draft-mcp",
    shop: "https://gptworkspace.etsy.com",
    tools: [
      "create_draft_listing",
      "upload_listing_image",
      "read_listings",
    ],
  });
});

function unauthorized(res: express.Response) {
  res.status(401).json({
    error: "unauthorized",
    message: "Send Authorization: Bearer <MCP_AUTH_TOKEN>",
  });
}

function checkAuth(req: express.Request, res: express.Response): boolean {
  if (!AUTH_TOKEN) {
    res.status(500).json({
      error: "server_misconfigured",
      message: "MCP_AUTH_TOKEN is not set on the server",
    });
    return false;
  }
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || match[1] !== AUTH_TOKEN) {
    unauthorized(res);
    return false;
  }
  return true;
}

/** Stateless: new transport + server per request (simplest for tunnels / Grok). */
app.post("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const server = createDraftOnlyServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP POST error", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

/** Optional stateful path for clients that send Mcp-Session-Id */
const sessions = new Map<
  string,
  { transport: StreamableHTTPServerTransport; server: ReturnType<typeof createDraftOnlyServer> }
>();

app.post("/mcp/session", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  try {
    if (sessionId && sessions.has(sessionId)) {
      const existing = sessions.get(sessionId)!;
      await existing.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const server = createDraftOnlyServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server });
        },
      });
      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) sessions.delete(id);
      };
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: missing or invalid session" },
      id: null,
    });
  } catch (err) {
    console.error("MCP session error", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST /mcp." },
    id: null,
  });
});

app.listen(PORT, HOST, () => {
  console.error(
    `etsy-draft-mcp HTTP listening on http://${HOST}:${PORT}/mcp (shop https://gptworkspace.etsy.com)`
  );
  if (!AUTH_TOKEN) {
    console.error("WARNING: MCP_AUTH_TOKEN is empty — set it before exposing this server.");
  }
});
