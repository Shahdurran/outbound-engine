/**
 * The tables a run snapshot carries, in insert order - parents before the rows
 * that reference them, because foreign keys are on.
 */
export const SNAPSHOT_TABLES = [
  "runs",
  "agent_steps",
  "trace_events",
  "crm_companies",
  "crm_contacts",
  "crm_deals",
  "crm_notes",
  "crm_activities",
  "email_outbox",
  "calendar_bookings",
] as const;

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

export type RunSnapshot = {
  runId: string;
  tables: Partial<Record<SnapshotTable, Record<string, unknown>[]>>;
};
