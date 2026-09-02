import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Lazy singleton connection. Next dev-mode module reloading would otherwise
 * open a new handle on every hot reload and eventually exhaust file handles,
 * so the instance is parked on globalThis in development.
 */

const SCHEMA_PATH = path.join(process.cwd(), "lib", "db", "schema.sql");

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/outbound.db";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function open(): Database.Database {
  const file = resolveDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

type GlobalWithDb = typeof globalThis & { __outboundDb?: Database.Database };

export function getDb(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (!g.__outboundDb) {
    g.__outboundDb = open();
  }
  return g.__outboundDb;
}

/** Test helper: point at a scratch file and start clean. */
export function resetDbForTests(file: string): Database.Database {
  const g = globalThis as GlobalWithDb;
  g.__outboundDb?.close();
  process.env.DATABASE_PATH = file;
  if (fs.existsSync(file)) fs.rmSync(file);
  g.__outboundDb = undefined;
  return getDb();
}
