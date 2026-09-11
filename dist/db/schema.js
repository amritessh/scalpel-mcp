import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
export const definitions = sqliteTable("definitions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    file: text("file").notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    doc: text("doc"),
}, (t) => [index("idx_definitions_name").on(t.name)]);
export const usages = sqliteTable("usages", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    file: text("file").notNull(),
    line: integer("line").notNull(),
}, (t) => [index("idx_usages_name").on(t.name)]);
export const calls = sqliteTable("calls", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    callerName: text("caller_name"),
    callerFile: text("caller_file").notNull(),
    callerStartLine: integer("caller_start_line"),
    callerEndLine: integer("caller_end_line"),
    calleeName: text("callee_name").notNull(),
    callLine: integer("call_line").notNull(),
    resolved: integer("resolved", { mode: "boolean" }).notNull(),
}, (t) => [index("idx_calls_callee").on(t.calleeName), index("idx_calls_caller").on(t.callerName)]);
export const imports = sqliteTable("imports", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    file: text("file").notNull(),
    source: text("source").notNull(),
    resolvedFile: text("resolved_file"),
    kind: text("kind", { enum: ["local", "external", "unresolved"] }).notNull(),
}, (t) => [index("idx_imports_file").on(t.file), index("idx_imports_resolved").on(t.resolvedFile)]);
export const typeReferences = sqliteTable("type_references", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    referencerName: text("referencer_name"),
    referencerFile: text("referencer_file").notNull(),
    referencerStartLine: integer("referencer_start_line"),
    referencerEndLine: integer("referencer_end_line"),
    referencedName: text("referenced_name").notNull(),
    referenceLine: integer("reference_line").notNull(),
}, (t) => [
    index("idx_type_references_referenced").on(t.referencedName),
    index("idx_type_references_referencer").on(t.referencerName),
]);
