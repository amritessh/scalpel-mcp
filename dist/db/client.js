import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SqliteDatabase from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/db/client.ts -> ../../drizzle at repo root, dist/db/client.js -> ../../drizzle at the same root.
const migrationsFolder = path.join(__dirname, "../../drizzle");
export function openDb(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new SqliteDatabase(dbPath);
    sqlite.pragma("journal_mode = WAL");
    // WAL's default synchronous mode is still FULL unless set explicitly --
    // NORMAL is the documented-safe pairing with WAL (only risks losing the
    // last few commits on a power loss, not corruption) and cuts fsync
    // frequency dramatically, which matters a lot at bulk-insert scale.
    sqlite.pragma("synchronous = NORMAL");
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder });
    return db;
}
