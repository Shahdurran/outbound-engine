import { loadArtifacts } from "../../../../lib/artifacts";
import { getRun } from "../../../../lib/db/runs";
import { getCalendar } from "../../../../lib/integrations/calendar";
import { getCrm } from "../../../../lib/integrations/crm";
import { getEmail } from "../../../../lib/integrations/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TouchInput = {
  day: number;
  channel: "email" | "linkedin";
  subject?: string;
  body: string;
  referencedFinding: string;
};

/**
 * The write side of the run: company, contact, deal, note, activity, four
 * scheduled touches and a proposed call.
 *
 * Every payload returned here is what a real HubSpot adapter would POST, so
 * the CRM tab can show them raw. Touches arrive from the client because the
 * Outreach tab lets you edit the copy before pushing - the agent drafts, a
 * human approves, which is the only sane shape for outbound that actually
 * sends.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { runId?: unknown; touches?: unknown };
  try {
    body = (await request.json()) as { runId?: unknown; touches?: unknown };
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const runId = typeof body.runId === "string" ? body.runId : "";
  const run = getRun(runId);
  if (!run) {
    return Response.json({ error: `No run ${runId}` }, { status: 404 });
  }

  const artifacts = loadArtifacts(runId);
  if (!artifacts.recce) {
    return Response.json(
      { error: "This run has no prospect profile, so there is nothing to write." },
      { status: 409 },
    );
  }

  const touches: TouchInput[] = Array.isArray(body.touches)
    ? (body.touches as TouchInput[])
    : (artifacts.copy?.touches ?? []);

  const crm = getCrm();
  const recce = artifacts.recce;

  const company = await crm.upsertCompany({
    domain: recce.domain,
    name: recce.companyName,
    industry: recce.targetMarket.slice(0, 120),
    description: recce.positioning,
    runId,
  });

  // No contact enrichment provider is wired up, so the contact is a role
  // address derived from the domain rather than an invented person. Swapping
  // in Apollo or Clay replaces exactly this block.
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
    const sendAt = new Date(Date.now() + touch.day * 24 * 60 * 60 * 1000);
    const record =
      touch.day === 0
        ? await email.send({
            to: contact.properties.email,
            subject: touch.subject ?? `Note for ${recce.companyName}`,
            body: touch.body,
            channel: touch.channel,
            runId,
          })
        : await email.schedule(
            {
              to: contact.properties.email,
              subject: touch.subject ?? `Note for ${recce.companyName}`,
              body: touch.body,
              channel: touch.channel,
              runId,
            },
            sendAt,
          );
    scheduled.push(record);
  }

  const activity = await crm.logActivity({
    objectType: "deal",
    objectId: deal.id,
    activityType: "EMAIL",
    body: `Queued a ${touches.length}-touch sequence. First touch: ${touches[0]?.subject ?? "n/a"}`,
    runId,
  });

  const booking = await getCalendar().proposeSlots({ domain: recce.domain, runId });

  return Response.json({
    company,
    contact,
    deal,
    note,
    activity,
    scheduled,
    booking,
  });
}
