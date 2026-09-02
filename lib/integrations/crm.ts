// Swap for HubSpot/Salesforce adapter.
//
// Every property name below is HubSpot's, exactly: `dealname` not `deal_name`,
// `numberofemployees` not `employee_count`, `hs_lead_status`, `hs_note_body`,
// `hs_timestamp`. That is deliberate. The JSON this adapter writes to SQLite is
// byte-for-byte the `properties` object HubSpot's v3 CRM API expects, so
// implementing HubSpotCRM means replacing the storage calls with
// `POST /crm/v3/objects/companies` and leaving every caller untouched.
//
// The CRM tab in the UI shows these payloads raw for the same reason: a
// reviewer should be able to see that the shape is real.

import { randomUUID } from "node:crypto";
import { getDb } from "../db/index";

export type CompanyProperties = {
  domain: string;
  name: string;
  industry?: string;
  description?: string;
  website?: string;
  numberofemployees?: number;
  lifecyclestage: string;
};

export type ContactProperties = {
  email: string;
  firstname?: string;
  lastname?: string;
  jobtitle?: string;
  phone?: string;
  hs_lead_status: string;
  lifecyclestage: string;
};

export type DealProperties = {
  dealname: string;
  amount?: number;
  dealstage: string;
  pipeline: string;
  closedate?: string;
};

export type ActivityProperties = {
  hs_timestamp: string;
  hs_activity_type: string;
  hs_body_preview: string;
};

export type NoteProperties = {
  hs_timestamp: string;
  hs_note_body: string;
};

export type CrmRecord<TProperties> = {
  id: string;
  properties: TProperties;
  createdAt: string;
  associations?: Record<string, string>;
};

export interface CRMAdapter {
  upsertCompany(input: {
    domain: string;
    name: string;
    industry?: string;
    description?: string;
    employees?: number;
    runId: string | null;
  }): Promise<CrmRecord<CompanyProperties>>;

  upsertContact(input: {
    companyId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    runId: string | null;
  }): Promise<CrmRecord<ContactProperties>>;

  createDeal(input: {
    companyId: string;
    dealName: string;
    amount?: number;
    dealStage?: string;
    runId: string | null;
  }): Promise<CrmRecord<DealProperties>>;

  logActivity(input: {
    objectType: "company" | "contact" | "deal";
    objectId: string;
    activityType: string;
    body: string;
    runId: string | null;
  }): Promise<CrmRecord<ActivityProperties>>;

  addNote(input: {
    objectType: "company" | "contact" | "deal";
    objectId: string;
    body: string;
    runId: string | null;
  }): Promise<CrmRecord<NoteProperties>>;
}

function now(): string {
  return new Date().toISOString();
}

export class MockCRM implements CRMAdapter {
  async upsertCompany(input: {
    domain: string;
    name: string;
    industry?: string;
    description?: string;
    employees?: number;
    runId: string | null;
  }): Promise<CrmRecord<CompanyProperties>> {
    const db = getDb();
    const existing = db
      .prepare(`SELECT id, created_at FROM crm_companies WHERE domain = ?`)
      .get(input.domain) as { id: string; created_at: number } | undefined;

    const properties: CompanyProperties = {
      domain: input.domain,
      name: input.name,
      industry: input.industry,
      description: input.description,
      website: `https://${input.domain}`,
      numberofemployees: input.employees,
      lifecyclestage: "lead",
    };

    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.created_at ?? Date.now();

    db.prepare(
      `INSERT INTO crm_companies (id, run_id, domain, properties, created_at, updated_at)
       VALUES (@id, @runId, @domain, @properties, @createdAt, @updatedAt)
       ON CONFLICT (id) DO UPDATE SET
         properties = excluded.properties, updated_at = excluded.updated_at,
         run_id = excluded.run_id`,
    ).run({
      id,
      runId: input.runId,
      domain: input.domain,
      properties: JSON.stringify(properties),
      createdAt,
      updatedAt: Date.now(),
    });

    return { id, properties, createdAt: new Date(createdAt).toISOString() };
  }

  async upsertContact(input: {
    companyId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    runId: string | null;
  }): Promise<CrmRecord<ContactProperties>> {
    const db = getDb();
    const existing = db
      .prepare(`SELECT id, created_at FROM crm_contacts WHERE email = ?`)
      .get(input.email) as { id: string; created_at: number } | undefined;

    const properties: ContactProperties = {
      email: input.email,
      firstname: input.firstName,
      lastname: input.lastName,
      jobtitle: input.jobTitle,
      hs_lead_status: "NEW",
      lifecyclestage: "lead",
    };

    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.created_at ?? Date.now();

    db.prepare(
      `INSERT INTO crm_contacts (id, run_id, company_id, email, properties, created_at, updated_at)
       VALUES (@id, @runId, @companyId, @email, @properties, @createdAt, @updatedAt)
       ON CONFLICT (id) DO UPDATE SET
         properties = excluded.properties, updated_at = excluded.updated_at`,
    ).run({
      id,
      runId: input.runId,
      companyId: input.companyId,
      email: input.email,
      properties: JSON.stringify(properties),
      createdAt,
      updatedAt: Date.now(),
    });

    return {
      id,
      properties,
      createdAt: new Date(createdAt).toISOString(),
      associations: { company: input.companyId },
    };
  }

  async createDeal(input: {
    companyId: string;
    dealName: string;
    amount?: number;
    dealStage?: string;
    runId: string | null;
  }): Promise<CrmRecord<DealProperties>> {
    const id = randomUUID();
    const properties: DealProperties = {
      dealname: input.dealName,
      amount: input.amount,
      dealstage: input.dealStage ?? "appointmentscheduled",
      pipeline: "default",
    };

    getDb()
      .prepare(
        `INSERT INTO crm_deals (id, run_id, company_id, properties, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.runId, input.companyId, JSON.stringify(properties), Date.now());

    return {
      id,
      properties,
      createdAt: now(),
      associations: { company: input.companyId },
    };
  }

  async logActivity(input: {
    objectType: "company" | "contact" | "deal";
    objectId: string;
    activityType: string;
    body: string;
    runId: string | null;
  }): Promise<CrmRecord<ActivityProperties>> {
    const id = randomUUID();
    const properties: ActivityProperties = {
      hs_timestamp: now(),
      hs_activity_type: input.activityType,
      hs_body_preview: input.body.slice(0, 512),
    };

    getDb()
      .prepare(
        `INSERT INTO crm_activities (id, run_id, object_type, object_id, properties, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.runId, input.objectType, input.objectId, JSON.stringify(properties), Date.now());

    return {
      id,
      properties,
      createdAt: properties.hs_timestamp,
      associations: { [input.objectType]: input.objectId },
    };
  }

  async addNote(input: {
    objectType: "company" | "contact" | "deal";
    objectId: string;
    body: string;
    runId: string | null;
  }): Promise<CrmRecord<NoteProperties>> {
    const id = randomUUID();
    const properties: NoteProperties = {
      hs_timestamp: now(),
      hs_note_body: input.body,
    };

    getDb()
      .prepare(
        `INSERT INTO crm_notes (id, run_id, object_type, object_id, properties, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.runId, input.objectType, input.objectId, JSON.stringify(properties), Date.now());

    return {
      id,
      properties,
      createdAt: properties.hs_timestamp,
      associations: { [input.objectType]: input.objectId },
    };
  }
}

let instance: CRMAdapter | null = null;

export function getCrm(): CRMAdapter {
  if (!instance) instance = new MockCRM();
  return instance;
}

/** Test seam: inject a fake adapter. */
export function setCrm(adapter: CRMAdapter | null): void {
  instance = adapter;
}
