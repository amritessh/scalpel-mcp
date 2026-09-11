import path from "node:path";
import { indexRepo } from "./indexer/index.js";
import { openDb, resetTables, insertDefinitions, insertUsages, insertCalls, insertImports, insertTypeReferences, } from "./db/index.js";
function main() {
    const repoArg = process.argv[2];
    const dbArg = process.argv[3];
    const langArg = process.argv[4] ?? "ts";
    if (!repoArg) {
        console.error("usage: build-index <repoPath> [dbPath] [lang=ts|python|go]");
        process.exit(1);
    }
    if (langArg !== "ts" && langArg !== "python" && langArg !== "go") {
        console.error(`unknown lang "${langArg}", expected "ts", "python", or "go"`);
        process.exit(1);
    }
    const repoRoot = path.resolve(repoArg);
    const dbPath = path.resolve(dbArg ?? path.join(repoRoot, ".scalpel", "index.db"));
    console.error(`indexing (${langArg}) ${repoRoot} -> ${dbPath}`);
    const t0 = Date.now();
    const { definitions, usages, calls, imports, typeReferences } = indexRepo(repoRoot, langArg);
    const db = openDb(dbPath);
    resetTables(db);
    insertDefinitions(db, definitions);
    insertUsages(db, usages);
    insertCalls(db, calls);
    insertImports(db, imports);
    insertTypeReferences(db, typeReferences);
    console.error(`done in ${Date.now() - t0}ms: ${definitions.length} definitions, ${usages.length} usages, ` +
        `${calls.length} calls, ${imports.length} imports, ${typeReferences.length} type references`);
}
main();
