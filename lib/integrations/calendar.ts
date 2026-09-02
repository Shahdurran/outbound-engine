// Swap for Cal.com/Calendly/Google Calendar adapter.
//
// The real version asks the scheduling provider for availability; this one
// proposes three business-hours slots over the next week and hands back a
// booking link. The shape - slots plus a URL - is what every provider returns,
// so the swap is a body change, not a signature change.

import { randomUUID } from "node:crypto";
import { getDb } from "../db/index";

export type MeetingSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
};

export type BookingProposal = {
  id: string;
  slots: MeetingSlot[];
  bookingUrl: string;
};

export interface CalendarAdapter {
  proposeSlots(input: { domain: string; runId: string | null }): Promise<BookingProposal>;
}

const SLOT_MINUTES = 30;

function nextBusinessSlots(count: number): MeetingSlot[] {
  const slots: MeetingSlot[] = [];
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  cursor.setHours(10, 0, 0, 0);

  // Offer 10:00, 14:00 and 11:00 on successive weekdays. Deterministic enough
  // to be predictable in a demo, varied enough to look like real availability.
  const hours = [10, 14, 11];

  let dayOffset = 1;
  while (slots.length < count) {
    const day = new Date(cursor);
    day.setDate(day.getDate() + dayOffset);
    dayOffset += 1;

    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;

    const hour = hours[slots.length % hours.length] ?? 10;
    day.setHours(hour, 0, 0, 0);

    const end = new Date(day.getTime() + SLOT_MINUTES * 60_000);
    slots.push({
      startsAt: day.toISOString(),
      endsAt: end.toISOString(),
      label: day.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }

  return slots;
}

export class MockCalendar implements CalendarAdapter {
  async proposeSlots(input: { domain: string; runId: string | null }): Promise<BookingProposal> {
    const id = randomUUID();
    const slots = nextBusinessSlots(3);
    const bookingUrl = `https://cal.example/outbound-engine/${id.slice(0, 8)}?ref=${encodeURIComponent(input.domain)}`;

    getDb()
      .prepare(
        `INSERT INTO calendar_bookings (id, run_id, slots, booking_url, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.runId, JSON.stringify(slots), bookingUrl, Date.now());

    return { id, slots, bookingUrl };
  }
}

let instance: CalendarAdapter | null = null;

export function getCalendar(): CalendarAdapter {
  if (!instance) instance = new MockCalendar();
  return instance;
}

export function setCalendar(adapter: CalendarAdapter | null): void {
  instance = adapter;
}
