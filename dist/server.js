import path from "node:path";
import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDb } from "./db/index.js";
import { getSymbolToolConfig, makeGetSymbolHandler } from "./tools/get-symbol.js";
import { getRelatedToolConfig, makeGetRelatedHandler } from "./tools/get-related.js";
import { getImpactToolConfig, makeGetImpactHandler } from "./tools/get-impact.js";
const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
const dbPath = path.resolve(process.argv[3] ?? path.join(repoRoot, ".scalpel", "index.db"));
if (!fs.existsSync(dbPath)) {
    console.error(`no index found at ${dbPath}. run build-index first.`);
    process.exit(1);
}
const db = openDb(dbPath);
const server = new McpServer({ name: "scalpel", version: "0.1.0" });
server.registerTool("get_symbol", getSymbolToolConfig, makeGetSymbolHandler(db, repoRoot));
server.registerTool("get_related", getRelatedToolConfig, makeGetRelatedHandler(db));
server.registerTool("get_impact", getImpactToolConfig, makeGetImpactHandler(db));
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`scalpel serving ${repoRoot} from ${dbPath}`);
