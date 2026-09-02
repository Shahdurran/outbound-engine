// Swap for SendGrid/Resend/Customer.io adapter.
//
// send() and schedule() are the two calls any transactional provider gives you.
// MockEmail writes to an outbox table instead of hitting the network, so the
// sequence is inspectable without a single message leaving the machine - which
// is the right default for a demo that generates outreach copy.

import { randomUUID } from "node:crypto";
import { getDb } from "../db/index";

export type OutboundMessage = {
  to: string;
  subject: string;
  body: string;
  channel: "email" | "linkedin";
  runId: string | null;
};

export type OutboxRecord = {
  id: string;
  to: string;
  subject: string;
  channel: "email" | "linkedin";
  status: "queued" | "scheduled" | "sent";
  sendAt: string | null;
};

export interface EmailAdapter {
  send(message: OutboundMessage): Promise<OutboxRecord>;
  schedule(message: OutboundMessage, sendAt: Date): Promise<OutboxRecord>;
}

export class MockEmail implements EmailAdapter {
  private write(
    message: OutboundMessage,
    status: OutboxRecord["status"],
    sendAt: Date | null,
  ): OutboxRecord {
    const id = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO email_outbox (id, run_id, to_email, subject, body, channel, send_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        message.runId,
        message.to,
        message.subject,
        message.body,
        message.channel,
        sendAt ? sendAt.getTime() : null,
        status,
        Date.now(),
      );

    return {
      id,
      to: message.to,
      subject: message.subject,
      channel: message.channel,
      status,
      sendAt: sendAt ? sendAt.toISOString() : null,
    };
  }

  async send(message: OutboundMessage): Promise<OutboxRecord> {
    return this.write(message, "sent", null);
  }

  async schedule(message: OutboundMessage, sendAt: Date): Promise<OutboxRecord> {
    return this.write(message, "scheduled", sendAt);
  }
}

let instance: EmailAdapter | null = null;

export function getEmail(): EmailAdapter {
  if (!instance) instance = new MockEmail();
  return instance;
}

export function setEmail(adapter: EmailAdapter | null): void {
  instance = adapter;
}
