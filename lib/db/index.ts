import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

/**
 * Lazy singleton connection. Next's dev-mode module reloading would otherwise
 * open a new handle on every hot reload and eventually exhaust file handles,
 * so the instance is parked on globalThis.
 */

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }

  // On a serverless host the deployment is read-only apart from /tmp. The
  // database is therefore per-instance and resets on a cold start, which is
  // fine for a demo precisely because the run that matters is re-seeded from a
  // fixture on boot. A persistent deployment sets DATABASE_PATH to a volume.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "/tmp/outbound.db";
  }

  return path.join(process.cwd(), "data", "outbound.db");
}

function open(): Database.Database {
  const file = resolveDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
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
