import { eq, and } from "drizzle-orm";
import { definitions, usages, calls, imports, typeReferences, } from "./schema.js";
// better-sqlite3 is synchronous end-to-end; these stay non-async to match.
export function resetTables(db) {
    db.delete(definitions).run();
    db.delete(usages).run();
    db.delete(calls).run();
    db.delete(imports).run();
    db.delete(typeReferences).run();
}
// A single multi-row INSERT over tens of thousands of rows blows Drizzle's
// param-merging call stack, so batch it inside one transaction instead.
const BATCH_SIZE = 500;
function batchInsert(db, table, rows) {
    if (rows.length === 0)
        return;
    db.transaction((tx) => {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            tx.insert(table).values(rows.slice(i, i + BATCH_SIZE)).run();
        }
    });
}
export function insertDefinitions(db, rows) {
    batchInsert(db, definitions, rows);
}
export function insertUsages(db, rows) {
    batchInsert(db, usages, rows);
}
export function insertCalls(db, rows) {
    batchInsert(db, calls, rows);
}
export function insertImports(db, rows) {
    batchInsert(db, imports, rows);
}
export function insertTypeReferences(db, rows) {
    batchInsert(db, typeReferences, rows);
}
export function getDefinitionsByName(db, name) {
    return db.select().from(definitions).where(eq(definitions.name, name)).all();
}
export function getUsagesByName(db, name) {
    return db
        .select()
        .from(usages)
        .where(eq(usages.name, name))
        .orderBy(usages.file, usages.line)
        .all();
}
// Who calls `name` -- resolved edges only, dynamic-dispatch call sites are excluded.
export function getCallersOf(db, name) {
    return db
        .select()
        .from(calls)
        .where(and(eq(calls.calleeName, name), eq(calls.resolved, true)))
        .all();
}
// What `name` calls, given the definitions whose body the call sites fall inside.
export function getCalleesOf(db, name) {
    return db
        .select()
        .from(calls)
        .where(and(eq(calls.callerName, name), eq(calls.resolved, true)))
        .all();
}
export function getImportsOfFile(db, file) {
    return db.select().from(imports).where(eq(imports.file, file)).all();
}
// Dynamic-dispatch call sites inside `name`'s own body -- computed member
// access or calls through a variable, which we deliberately didn't guess at
// index time. Surfaced separately so get_related can say "there are N call
// sites here we couldn't resolve" instead of silently omitting them.
export function getUnresolvedCallsFrom(db, name) {
    return db
        .select()
        .from(calls)
        .where(and(eq(calls.callerName, name), eq(calls.resolved, false)))
        .all();
}
// Which OTHER definitions structurally depend on `name` -- their own
// signature/extends/implements/generic-argument references it -- as
// opposed to getCallersOf's value-level function-call edges.
export function getTypeReferencesTo(db, name) {
    return db.select().from(typeReferences).where(eq(typeReferences.referencedName, name)).all();
}
