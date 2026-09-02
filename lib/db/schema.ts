/**
 * The schema, inlined as a string rather than read from a .sql file at runtime.
 *
 * Serverless bundlers do not trace a file that is only opened through a runtime
 * path, so reading schema.sql worked locally and would have failed on the first
 * query in a deployed function with a missing-file error.
 */
export const SCHEMA_SQL = `-- Outbound Engine persistence.
--
-- Three groups of tables:
--   1. Runs, agent steps and trace events   - the agent console and its replay
--   2. page_cache                           - so re-runs are cheap
--   3. crm_* / email_outbox / calendar_*    - what the mock adapters write
--
-- The crm_* tables deliberately store a HubSpot-shaped "properties" JSON blob
-- rather than exploding properties into columns. That is what makes the real
-- HubSpot adapter a drop-in swap: the payload we build here is the payload
-- their API expects.

CREATE TABLE IF NOT EXISTS runs (
  id                 TEXT PRIMARY KEY,
  domain             TEXT NOT NULL,
  icp                TEXT,
  status             TEXT NOT NULL,             -- running | complete | degraded | failed
  mode               TEXT NOT NULL,             -- live | replay
  model              TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  completed_at       INTEGER,
  duration_ms        INTEGER,
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd           REAL    NOT NULL DEFAULT 0,
  score              INTEGER,
  tier               TEXT,
  error              TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at DESC);

CREATE TABLE IF NOT EXISTS agent_steps (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  agent          TEXT NOT NULL,
  step_index     INTEGER NOT NULL,
  status         TEXT NOT NULL,                 -- queued | running | done | error
  started_at     INTEGER,
  duration_ms    INTEGER,
  attempts       INTEGER NOT NULL DEFAULT 0,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd       REAL    NOT NULL DEFAULT 0,
  output_json    TEXT,
  error          TEXT,
  UNIQUE (run_id, agent)
);

CREATE INDEX IF NOT EXISTS idx_steps_run ON agent_steps (run_id, step_index);

-- Every event the orchestrator emitted, in order. Replaying these rebuilds the
-- console exactly as it looked live, which is why a seeded run looks identical
-- to one you just watched.
CREATE TABLE IF NOT EXISTS trace_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id   TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL,
  type     TEXT NOT NULL,
  ts       INTEGER NOT NULL,
  payload  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trace_run ON trace_events (run_id, seq);

CREATE TABLE IF NOT EXISTS page_cache (
  url         TEXT PRIMARY KEY,
  fetched_at  INTEGER NOT NULL,
  status      INTEGER NOT NULL,
  title       TEXT,
  text        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  error       TEXT
);

-- ---------------------------------------------------------------------------
-- Mock integration targets. Shapes mirror HubSpot / SendGrid / Cal.com so the
-- real adapters drop in without touching callers.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_companies (
  id          TEXT PRIMARY KEY,
  run_id      TEXT REFERENCES runs (id) ON DELETE CASCADE,
  domain      TEXT NOT NULL,
  properties  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id          TEXT PRIMARY KEY,
  run_id      TEXT REFERENCES runs (id) ON DELETE CASCADE,
  company_id  TEXT REFERENCES crm_companies (id) ON DELETE CASCADE,
  email       TEXT,
  properties  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id          TEXT PRIMARY KEY,
  run_id      TEXT REFERENCES runs (id) ON DELETE CASCADE,
  company_id  TEXT REFERENCES crm_companies (id) ON DELETE CASCADE,
  properties  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id           TEXT PRIMARY KEY,
  run_id       TEXT REFERENCES runs (id) ON DELETE CASCADE,
  object_type  TEXT NOT NULL,
  object_id    TEXT NOT NULL,
  properties   TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id           TEXT PRIMARY KEY,
  run_id       TEXT REFERENCES runs (id) ON DELETE CASCADE,
  object_type  TEXT NOT NULL,
  object_id    TEXT NOT NULL,
  properties   TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id          TEXT PRIMARY KEY,
  run_id      TEXT REFERENCES runs (id) ON DELETE CASCADE,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  channel     TEXT NOT NULL,                    -- email | linkedin
  send_at     INTEGER,
  status      TEXT NOT NULL,                    -- queued | scheduled | sent
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_bookings (
  id           TEXT PRIMARY KEY,
  run_id       TEXT REFERENCES runs (id) ON DELETE CASCADE,
  slots        TEXT NOT NULL,
  booking_url  TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
`;
