import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDefinitionsByName, getUsagesByName } from "../db/index.js";
export const getSymbolInputSchema = {
    name: z.string().describe("Exact symbol name, e.g. a function, class, interface, or type name"),
    includeUsages: z
        .boolean()
        .optional()
        .describe("Set to false to skip call/reference sites and return only the definition span. Defaults to true. " +
        "Use false when you only need to see where something is defined, not who calls it — skips the " +
        "cost of a potentially large usages array for frequently-called symbols."),
};
export const getSymbolToolConfig = {
    title: "Get symbol",
    description: "Look up a symbol by name and return its definition span (source text, not the whole file) plus every call/reference site. Use this instead of reading a full file when you only need one function/class/type. Pass includeUsages: false if you only need the definition.",
    inputSchema: getSymbolInputSchema,
};
function readSpan(repoRoot, def) {
    const absPath = path.join(repoRoot, def.file);
    const lines = fs.readFileSync(absPath, "utf8").split("\n");
    return lines.slice(def.startLine - 1, def.endLine).join("\n");
}
// Single source of truth for the get_symbol response shape — the server and
// the benchmark both call this, so a benchmark run always measures exactly
// what the tool actually returns.
export function buildSymbolPayload(repoRoot, defs, usages) {
    return {
        definitions: defs.map((d) => ({
            name: d.name,
            kind: d.kind,
            file: d.file,
            start_line: d.startLine,
            end_line: d.endLine,
            doc: d.doc,
            source: readSpan(repoRoot, d),
        })),
        usages: usages.map((u) => ({ file: u.file, line: u.line })),
    };
}
export function makeGetSymbolHandler(db, repoRoot) {
    return async ({ name, includeUsages = true }) => {
        const defs = getDefinitionsByName(db, name);
        const usages = includeUsages ? getUsagesByName(db, name) : [];
        if (defs.length === 0) {
            return {
                content: [{ type: "text", text: `No definition found for "${name}".` }],
            };
        }
        const payload = buildSymbolPayload(repoRoot, defs, usages);
        return {
            content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
    };
}
