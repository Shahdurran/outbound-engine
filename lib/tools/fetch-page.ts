import * as cheerio from "cheerio";
import { getDb } from "../db/index";

/**
 * HTML -> text, plus the deterministic structural signals the agents reason
 * over. Counting CTAs, form fields and proof elements in code rather than
 * asking a model to eyeball them keeps those numbers `derived` in the sense
 * lib/evidence.ts means: they came from the page, not from a guess.
 *
 * Results are cached in SQLite keyed by URL so re-runs are cheap. That is what
 * keeps a warm run inside the 90s budget.
 */

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // a day is plenty for a demo
const FETCH_TIMEOUT_MS = 12_000;
const MAX_TEXT_CHARS = 14_000;

export type PageSignals = {
  wordCount: number;
  linkCount: number;
  internalLinkCount: number;
  /** Anchors/buttons whose text reads like a call to action. */
  ctaCount: number;
  formCount: number;
  formFieldCount: number;
  headingCount: number;
  imageCount: number;
  /** Testimonial / review / "as seen in" markers. */
  socialProofMarkers: number;
  mentionsPricing: boolean;
  hasPhoneNumber: boolean;
  /** Best-effort framework fingerprints from markup and script srcs. */
  techHints: string[];
};

export type FetchedPage = {
  url: string;
  status: number;
  title: string;
  description: string;
  text: string;
  bytes: number;
  signals: PageSignals;
  internalLinks: string[];
  cached: boolean;
  error?: string;
};

const CTA_WORDS = [
  "book",
  "schedule",
  "get started",
  "contact",
  "request",
  "free",
  "demo",
  "quote",
  "call now",
  "sign up",
  "start",
  "apply",
  "buy",
  "consultation",
];

const PROOF_WORDS = ["testimonial", "review", "rated", "trusted by", "as seen", "case study", "stars"];

const TECH_PATTERNS: [RegExp, string][] = [
  [/wp-content|wp-includes/i, "WordPress"],
  [/cdn\.shopify|shopify/i, "Shopify"],
  [/_next\/static/i, "Next.js"],
  [/wix\.com|wixstatic/i, "Wix"],
  [/squarespace/i, "Squarespace"],
  [/webflow/i, "Webflow"],
  [/hubspot|hs-scripts/i, "HubSpot"],
  [/gtm\.js|googletagmanager/i, "Google Tag Manager"],
  [/gtag\/js|google-analytics/i, "Google Analytics"],
  [/facebook\.net\/.*fbevents/i, "Meta Pixel"],
  [/calendly/i, "Calendly"],
  [/intercom/i, "Intercom"],
  [/drift\.com/i, "Drift"],
];

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  url.hash = "";
  return url.toString();
}

function extractSignals($: cheerio.CheerioAPI, html: string, origin: string): {
  signals: PageSignals;
  internalLinks: string[];
  text: string;
  title: string;
  description: string;
} {
  $("script, style, noscript, svg").remove();

  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() ?? "";

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const text = bodyText.slice(0, MAX_TEXT_CHARS);

  const anchors = $("a").toArray();
  const internalLinks: string[] = [];
  let internalLinkCount = 0;

  for (const anchor of anchors) {
    const href = $(anchor).attr("href");
    if (!href) continue;
    try {
      const resolved = new URL(href, origin);
      if (resolved.origin === origin) {
        internalLinkCount += 1;
        resolved.hash = "";
        const clean = resolved.toString();
        if (!internalLinks.includes(clean)) internalLinks.push(clean);
      }
    } catch {
      // Relative junk, mailto:, tel: - not a page we can crawl.
    }
  }

  const clickableText = [...anchors, ...$("button").toArray()]
    .map((el) => $(el).text().toLowerCase())
    .filter((t) => t.length > 0);
  const ctaCount = clickableText.filter((t) => CTA_WORDS.some((w) => t.includes(w))).length;

  const lowerText = bodyText.toLowerCase();
  const socialProofMarkers = PROOF_WORDS.filter((w) => lowerText.includes(w)).length;

  const techHints = TECH_PATTERNS.filter(([pattern]) => pattern.test(html)).map(([, name]) => name);

  return {
    title,
    description,
    text,
    internalLinks,
    signals: {
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      linkCount: anchors.length,
      internalLinkCount,
      ctaCount,
      formCount: $("form").length,
      formFieldCount: $("input, select, textarea").not('[type="hidden"]').length,
      headingCount: $("h1, h2, h3").length,
      imageCount: $("img").length,
      socialProofMarkers,
      mentionsPricing: /\bpricing\b|\$\d|\bper month\b|\bfrom \$/i.test(bodyText),
      hasPhoneNumber: /(\+?\d[\d\s().-]{7,}\d)/.test(bodyText),
      techHints,
    },
  };
}

type CacheRow = {
  url: string;
  fetched_at: number;
  status: number;
  title: string | null;
  text: string;
  bytes: number;
  error: string | null;
};

/**
 * Parse HTML into a FetchedPage without touching the network. Shared by the
 * live fetch path and by fixture priming, so a replayed page goes through the
 * exact same extractor a live one does - the signals in a recorded trace are
 * genuinely derived, not transcribed.
 */
export function parsePage(url: string, html: string, status = 200): FetchedPage {
  const normalized = normalizeUrl(url);
  const $ = cheerio.load(html);
  const origin = new URL(normalized).origin;
  const extracted = extractSignals($, html, origin);
  return { url: normalized, status, bytes: html.length, cached: false, ...extracted };
}

function writeCache(page: FetchedPage): void {
  const { cached: _cached, ...persistable } = page;
  getDb()
    .prepare(
      `INSERT INTO page_cache (url, fetched_at, status, title, text, bytes, error)
       VALUES (@url, @fetched_at, @status, @title, @text, @bytes, @error)
       ON CONFLICT (url) DO UPDATE SET
         fetched_at = excluded.fetched_at, status = excluded.status,
         title = excluded.title, text = excluded.text,
         bytes = excluded.bytes, error = excluded.error`,
    )
    .run({
      url: page.url,
      fetched_at: Date.now(),
      status: page.status,
      title: page.title,
      text: JSON.stringify(persistable),
      bytes: page.bytes,
      error: page.error ?? null,
    });
}

/** Load a page captured at record time into the cache, so replay stays offline. */
export function primePageCache(url: string, html: string): void {
  writeCache(parsePage(url, html));
}

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const url = normalizeUrl(rawUrl);
  const db = getDb();

  const cached = db.prepare(`SELECT * FROM page_cache WHERE url = ?`).get(url) as
    | CacheRow
    | undefined;

  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    const payload = JSON.parse(cached.text) as Omit<FetchedPage, "cached">;
    return { ...payload, cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let page: FetchedPage;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify honestly. We are reading public marketing pages, not
        // pretending to be a browser to get around anything.
        "user-agent": "OutboundEngine/0.8 (+prospect research; contact via site owner)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await response.text();
    page = parsePage(url, html, response.status);
  } catch (error) {
    page = {
      url,
      status: 0,
      title: "",
      description: "",
      text: "",
      bytes: 0,
      cached: false,
      internalLinks: [],
      signals: {
        wordCount: 0,
        linkCount: 0,
        internalLinkCount: 0,
        ctaCount: 0,
        formCount: 0,
        formFieldCount: 0,
        headingCount: 0,
        imageCount: 0,
        socialProofMarkers: 0,
        mentionsPricing: false,
        hasPhoneNumber: false,
        techHints: [],
      },
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }

  writeCache(page);
  return page;
}
