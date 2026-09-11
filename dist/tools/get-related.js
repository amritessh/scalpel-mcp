import { z } from "zod";
import { getDefinitionsByName, getCallersOf, getCalleesOf, getImportsOfFile, getUnresolvedCallsFrom, } from "../db/index.js";
export const getRelatedInputSchema = {
    name: z.string().describe("Exact symbol name to look up call/import relationships for"),
    depth: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe("How many hops to follow for callers/callees (default 1)"),
};
export const getRelatedToolConfig = {
    title: "Get related",
    description: "Look up a symbol's dependency edges: who calls it, what it calls, and what its defining file imports. Resolved by name match against known definitions -- dynamic-dispatch call sites (computed member access, calls through variables) are reported separately as unresolved, not guessed.",
    inputSchema: getRelatedInputSchema,
};
// BFS over resolved call edges up to `depth` hops. A cycle guard (visited set)
// is the entire "handle circular calls" story -- cycles just stop expanding,
// they don't need special detection beyond not revisiting a name.
function expandCallers(db, name, depth) {
    const seen = new Set([name]);
    const results = [];
    let frontier = [name];
    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
        const next = [];
        for (const n of frontier) {
            for (const row of getCallersOf(db, n)) {
                if (row.callerName) {
                    results.push({ name: row.callerName, file: row.callerFile, call_line: row.callLine });
                    if (!seen.has(row.callerName)) {
                        seen.add(row.callerName);
                        next.push(row.callerName);
                    }
                }
            }
        }
        frontier = next;
    }
    return results;
}
function expandCallees(db, name, depth) {
    const seen = new Set([name]);
    const results = [];
    let frontier = [name];
    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
        const next = [];
        for (const n of frontier) {
            for (const row of getCalleesOf(db, n)) {
                results.push({ name: row.calleeName, call_line: row.callLine });
                if (!seen.has(row.calleeName)) {
                    seen.add(row.calleeName);
                    next.push(row.calleeName);
                }
            }
        }
        frontier = next;
    }
    return results;
}
export function buildRelatedPayload(db, name, depth) {
    const defs = getDefinitionsByName(db, name);
    if (defs.length === 0)
        return null;
    const callers = expandCallers(db, name, depth);
    const callees = expandCallees(db, name, depth);
    const unresolvedCalls = getUnresolvedCallsFrom(db, name).map((c) => ({ call_line: c.callLine }));
    const imports = defs.flatMap((d) => getImportsOfFile(db, d.file));
    const uniqueImports = Array.from(new Map(imports.map((i) => [`${i.file}:${i.source}`, i])).values());
    return {
        callers,
        callees,
        unresolved_calls: unresolvedCalls,
        imports: uniqueImports.map((i) => ({ source: i.source, resolved_file: i.resolvedFile, kind: i.kind })),
    };
}
export function makeGetRelatedHandler(db) {
    return async ({ name, depth }) => {
        const payload = buildRelatedPayload(db, name, depth ?? 1);
        if (!payload) {
            return { content: [{ type: "text", text: `No definition found for "${name}".` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    };
}
