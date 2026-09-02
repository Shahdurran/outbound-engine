import { loadArtifacts } from "./artifacts";
import { getCalendar } from "./integrations/calendar";
import { getCrm } from "./integrations/crm";
import { getEmail } from "./integrations/email";

/**
 * The write side of a run: company, contact, deal, note, sequence, activity,
 * and a proposed call.
 *
 * It lives here rather than in the route handler so the snapshot script and
 * the API exercise exactly the same path - a seeded run's CRM payloads are
 * produced by the same code that produces a live one's.
 */

export type TouchInput = {
  day: number;
  channel: "email" | "linkedin";
  subject?: string;
  body: string;
  referencedFinding: string;
};

export type PushResult = Record<string, unknown>;

export async function pushRunToCrm(runId: string, overrides?: TouchInput[]): Promise<PushResult> {
  const artifacts = loadArtifacts(runId);
  if (!artifacts.recce) {
    throw new Error("This run has no prospect profile, so there is nothing to write.");
  }

  const recce = artifacts.recce;
  const touches: TouchInput[] = overrides ?? artifacts.copy?.touches ?? [];
  const crm = getCrm();

  const company = await crm.upsertCompany({
    domain: recce.domain,
    name: recce.companyName,
    industry: recce.targetMarket.slice(0, 120),
    description: recce.positioning,
    runId,
  });

  // No enrichment provider is wired up, so the contact is a role address
  // derived from the domain rather than an invented person. Swapping in Apollo
  // or Clay replaces exactly this block.
  const contact = await crm.upsertContact({
    companyId: company.id,
    email: `hello@${recce.domain}`,
    jobTitle: "Unverified - enrich before sending",
    runId,
  });

  const deal = await crm.createDeal({
    companyId: company.id,
    dealName: `${recce.companyName} - inbound conversion audit`,
    dealStage: artifacts.tier === "A" ? "appointmentscheduled" : "qualifiedtobuy",
    runId,
  });

  const findingsSummary = artifacts.leakage
    ? [
        "Conversion leakage:",
        ...artifacts.leakage.conversionLeakage.map((f) => `- [${f.impact}] ${f.title}. Fix: ${f.fix}`),
        "",
        "Competitor leakage:",
        ...artifacts.leakage.competitorLeakage.map(
          (f) => `- [${f.impact}] ${f.title} (owned by ${f.ownedBy.join(", ")}). Fix: ${f.fix}`,
        ),
      ].join("\n")
    : "No leakage findings were produced for this run.";

  const note = await crm.addNote({
    objectType: "company",
    objectId: company.id,
    body: [
      `Outbound Engine run ${runId}`,
      `ICP fit ${artifacts.score ?? "n/a"}/100, tier ${artifacts.tier ?? "n/a"}`,
      "",
      artifacts.scoring?.rationale ?? "",
      "",
      findingsSummary,
    ].join("\n"),
    runId,
  });

  const email = getEmail();
  const scheduled = [];
  for (const touch of touches) {
    const message = {
      to: contact.properties.email,
      subject: touch.subject ?? `Note for ${recce.companyName}`,
      body: touch.body,
      channel: touch.channel,
      runId,
    };
    const sendAt = new Date(Date.now() + touch.day * 24 * 60 * 60 * 1000);
    scheduled.push(
      touch.day === 0 ? await email.send(message) : await email.schedule(message, sendAt),
    );
  }

  const activity = await crm.logActivity({
    objectType: "deal",
    objectId: deal.id,
    activityType: "EMAIL",
    body: `Queued a ${touches.length}-touch sequence. First touch: ${touches[0]?.subject ?? "n/a"}`,
    runId,
  });

  const booking = await getCalendar().proposeSlots({ domain: recce.domain, runId });

  return { company, contact, deal, note, activity, scheduled, booking };
}
