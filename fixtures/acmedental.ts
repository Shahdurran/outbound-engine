import type { CompetitorMapOutput } from "../lib/agents/competitor-map";
import type { CopyOutput } from "../lib/agents/copy";
import type { LeakageOutput } from "../lib/agents/leakage";
import type { OrganicVisibilityOutput } from "../lib/agents/organic-visibility";
import type { RecceOutput } from "../lib/agents/recce";
import type { ScoringOutput } from "../lib/agents/scoring";
import type { RecordedPage, RecordedRun } from "./types";

/**
 * A recorded run against a fictional dental practice.
 *
 * Every page below is invented for the demo - no real business is profiled
 * here. The agents' recorded outputs are declared as their real output types,
 * so this file stops compiling the moment an agent's schema changes.
 */

const home = `
<!doctype html><html><head>
<title>Acme Dental Portland | Family and Cosmetic Dentistry</title>
<meta name="description" content="Family and cosmetic dentistry in Southeast Portland. Accepting new patients.">
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"></script>
<link rel="stylesheet" href="/wp-content/themes/dental/style.css">
</head><body>
<nav><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<header>
  <h1>Gentle dentistry for the whole family</h1>
  <p>Acme Dental has cared for Southeast Portland families since 2004. General, cosmetic
  and restorative dentistry in a calm, unhurried practice.</p>
  <img src="/img/reception.jpg" alt="Our reception">
</header>
<section>
  <h2>What we do</h2>
  <p>Cleanings and exams, fillings, crowns and bridges, teeth whitening, Invisalign clear
  aligners, dental implants, and emergency care for existing patients.</p>
  <a href="/services">See all services</a>
</section>
<section>
  <h2>Why families stay with us</h2>
  <p>Our patients often tell us they finally found a dentist they trust. We are rated
  highly by the families we look after and many of them have been with us for a decade.</p>
</section>
<section>
  <h2>Visit us</h2>
  <p>4820 SE Woodstock Blvd, Portland, OR 97206. Call (503) 555-0142.</p>
  <a href="/contact">Request an appointment</a>
</section>
<footer><p>Acme Dental. Accepting new patients.</p></footer>
</body></html>
`;

const services = `
<!doctype html><html><head>
<title>Services | Acme Dental Portland</title>
<meta name="description" content="General, cosmetic and restorative dental services in Portland.">
<link rel="stylesheet" href="/wp-content/themes/dental/style.css">
</head><body>
<nav><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<h1>Our services</h1>
<h2>General dentistry</h2>
<p>Routine cleanings, exams, digital x-rays, fillings and extractions.</p>
<h2>Cosmetic dentistry</h2>
<p>Teeth whitening, porcelain veneers and cosmetic bonding.</p>
<h2>Invisalign</h2>
<p>Clear aligner treatment planned in practice. Treatment length varies by case.
Book a consultation to find out whether you are a candidate.</p>
<h2>Dental implants</h2>
<p>Single implants and implant supported bridges, placed and restored in house.</p>
<h2>Emergency care</h2>
<p>Same day appointments for existing patients experiencing pain.</p>
<a href="/contact">Request an appointment</a>
</body></html>
`;

const about = `
<!doctype html><html><head>
<title>About | Acme Dental Portland</title>
<link rel="stylesheet" href="/wp-content/themes/dental/style.css">
</head><body>
<nav><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<h1>About Acme Dental</h1>
<p>Dr. Helen Marsh opened Acme Dental in 2004 after a decade in hospital dentistry.
The practice has four operatories and a team of nine, including two hygienists.</p>
<p>We are a private practice. We are in network with most major PPO plans and can
discuss payment options at your first visit.</p>
</body></html>
`;

const contact = `
<!doctype html><html><head>
<title>Contact | Acme Dental Portland</title>
<link rel="stylesheet" href="/wp-content/themes/dental/style.css">
</head><body>
<nav><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a></nav>
<h1>Request an appointment</h1>
<p>Fill in the form and a member of our team will call you back within two business days.</p>
<form action="/submit" method="post">
  <input type="hidden" name="csrf" value="x">
  <label>First name <input type="text" name="first_name" required></label>
  <label>Last name <input type="text" name="last_name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Phone <input type="tel" name="phone" required></label>
  <label>Date of birth <input type="text" name="dob" required></label>
  <label>Insurance provider <input type="text" name="insurer" required></label>
  <label>Insurance member ID <input type="text" name="member_id" required></label>
  <label>Existing patient <select name="existing"><option>Yes</option><option>No</option></select></label>
  <label>Reason for visit <textarea name="reason" required></textarea></label>
  <button type="submit">Send request</button>
</form>
<p>4820 SE Woodstock Blvd, Portland, OR 97206. Call (503) 555-0142.</p>
</body></html>
`;

const pearlbright = `
<!doctype html><html><head>
<title>Pearlbright Dental Portland | Invisalign and Cosmetic Dentistry</title>
<meta name="description" content="Portland Invisalign and cosmetic dentistry. Transparent pricing from $3,400.">
<script src="/_next/static/chunks/main.js"></script>
</head><body>
<nav><a href="/">Home</a><a href="/invisalign">Invisalign</a><a href="/pricing">Pricing</a><a href="/blog">Guides</a><a href="/book">Book</a></nav>
<h1>Straighter teeth, priced up front</h1>
<p>Invisalign in Portland from $3,400. See exactly what treatment costs before you book.</p>
<a href="/book">Book a free scan</a>
<h2>Popular guides</h2>
<p>How much does Invisalign cost in Portland. Invisalign vs braces for adults.
What happens at an Invisalign consultation. Financing your treatment.</p>
<h2>Rated 4.9 from 612 reviews</h2>
<p>Read what our patients say. As seen in Portland Monthly.</p>
</body></html>
`;

const portlandSmile = `
<!doctype html><html><head>
<title>Portland Smile Co | Emergency Dentist Open 7 Days</title>
<meta name="description" content="Emergency dentist in Portland. Walk in or call, open seven days.">
</head><body>
<nav><a href="/">Home</a><a href="/emergency">Emergency</a><a href="/pricing">Pricing</a><a href="/book">Book now</a></nav>
<h1>Emergency dentist, open seven days</h1>
<p>Toothache, broken tooth or lost crown. Same day emergency appointments across Portland.
Call now on (503) 555-0199 or book online.</p>
<a href="/book">Book now</a>
<h2>What an emergency visit costs</h2>
<p>Emergency exam from $89. Treatment quoted before we start.</p>
<h2>Trusted by 1,200 Portland patients</h2>
</body></html>
`;

const riverside = `
<!doctype html><html><head>
<title>Riverside Family Dental | Portland Family Dentistry and Implants</title>
<meta name="description" content="Family dentistry and dental implants in Portland.">
<link rel="stylesheet" href="/wp-content/themes/riverside/style.css">
</head><body>
<nav><a href="/">Home</a><a href="/implants">Implants</a><a href="/family">Family care</a><a href="/blog">Blog</a><a href="/contact">Contact</a></nav>
<h1>Family dentistry on the river</h1>
<p>General and family dentistry, plus a dedicated implant practice.</p>
<h2>Implant guides</h2>
<p>Dental implants vs bridges. What implants cost in Oregon. Recovery after implant surgery.</p>
<a href="/contact">Book a consultation</a>
</body></html>
`;

const pages: RecordedPage[] = [
  { url: "https://acmedental.com", html: home },
  { url: "https://acmedental.com/services", html: services },
  { url: "https://acmedental.com/about", html: about },
  { url: "https://acmedental.com/contact", html: contact },
  { url: "https://pearlbrightdental.com", html: pearlbright },
  { url: "https://portlandsmileco.com", html: portlandSmile },
  { url: "https://riversidefamilydental.com", html: riverside },
];

// ---------------------------------------------------------------------------
// Recorded agent outputs. Typed against the live schemas.
// ---------------------------------------------------------------------------

const recceOutput: RecceOutput = {
  domain: "acmedental.com",
  companyName: "Acme Dental",
  positioning:
    "A long-established family and cosmetic dental practice in Southeast Portland, selling calm and unhurried care rather than price or speed.",
  services: [
    { name: "General dentistry", description: "Cleanings, exams, digital x-rays, fillings and extractions." },
    { name: "Cosmetic dentistry", description: "Whitening, porcelain veneers and cosmetic bonding." },
    { name: "Invisalign", description: "Clear aligner treatment planned in practice, no indicative pricing given." },
    { name: "Dental implants", description: "Single implants and implant supported bridges, placed and restored in house." },
    { name: "Emergency care", description: "Same day appointments, restricted to existing patients." },
  ],
  targetMarket:
    "Families in Southeast Portland, with a strong lean toward long-term retained patients rather than new high-value cosmetic cases.",
  pricingSignals: {
    disclosed: false,
    notes:
      "No price, range or starting-from figure appears anywhere on the site. Payment is deferred to a conversation at the first visit, which pushes the cost question off the site entirely.",
    evidence: [
      {
        source: "https://acmedental.com/about",
        excerpt:
          "We are in network with most major PPO plans and can discuss payment options at your first visit.",
      },
      {
        source: "https://acmedental.com/services",
        excerpt: "Book a consultation to find out whether you are a candidate.",
      },
    ],
  },
  techStack: ["WordPress", "Google Tag Manager"],
  ctaDensity: {
    label: "Calls to action across the four pages read",
    kind: "exact",
    value: 4,
    basis: "derived",
    confidence: "high",
    evidence: [
      {
        source: "https://acmedental.com",
        excerpt:
          "fetch_page signals: ctaCount 2 on the homepage, both below the fold, reading 'See all services' and 'Request an appointment'.",
      },
      {
        source: "https://acmedental.com/services",
        excerpt: "fetch_page signals: ctaCount 1, a single 'Request an appointment' link at the foot of the page.",
      },
    ],
  },
  proofElements: [
    "A prose claim of being highly rated, with no rating, count or quoted review anywhere on the site",
  ],
  pagesRead: [
    { url: "https://acmedental.com/", title: "Acme Dental Portland | Family and Cosmetic Dentistry" },
    { url: "https://acmedental.com/services", title: "Services | Acme Dental Portland" },
    { url: "https://acmedental.com/about", title: "About | Acme Dental Portland" },
    { url: "https://acmedental.com/contact", title: "Contact | Acme Dental Portland" },
  ],
  summary:
    "Acme Dental is a stable, owner-run family practice that has been trading since 2004 and reads like it. The site is a brochure: it explains what the practice does, asks the visitor to request a callback, and answers none of the questions a patient actually has before choosing a dentist. There is no pricing, no visible proof, and the only conversion path is a nine-field form promising a call back within two business days. The clinical range is wider than the marketing suggests, with Invisalign and implants both offered but neither given a page that could rank.",
};

const competitorMapOutput: CompetitorMapOutput = {
  competitors: [
    {
      domain: "pearlbrightdental.com",
      name: "Pearlbright Dental",
      positioningOneLiner: "Portland Invisalign and cosmetic dentistry with prices published up front.",
      whyTheyCompete:
        "Chases the same Portland cosmetic and Invisalign cases Acme offers but never markets, and removes the price objection Acme leaves unanswered.",
      overlapType: "direct",
      evidence: [
        {
          source: "search:invisalign portland cost",
          excerpt: "Pearlbright Dental - Invisalign in Portland from $3,400. See exactly what treatment costs before you book.",
        },
        {
          source: "https://pearlbrightdental.com",
          excerpt: "Straighter teeth, priced up front. Invisalign in Portland from $3,400.",
        },
      ],
    },
    {
      domain: "portlandsmileco.com",
      name: "Portland Smile Co",
      positioningOneLiner: "Seven-day emergency dentist with same day appointments and quoted prices.",
      whyTheyCompete:
        "Takes the urgent, high-intent demand outright. Acme offers emergency care but only to existing patients, so every emergency searcher is a patient Acme cannot capture.",
      overlapType: "direct",
      evidence: [
        {
          source: "search:emergency dentist portland",
          excerpt: "Portland Smile Co - Emergency dentist, open seven days. Same day emergency appointments across Portland.",
        },
        {
          source: "https://portlandsmileco.com",
          excerpt: "Emergency exam from $89. Treatment quoted before we start.",
        },
      ],
    },
    {
      domain: "riversidefamilydental.com",
      name: "Riverside Family Dental",
      positioningOneLiner: "Family dentistry with a dedicated implant practice and a comparison-led blog.",
      whyTheyCompete:
        "The closest match on general family dentistry, and additionally publishes the implant comparison content Acme has none of.",
      overlapType: "direct",
      evidence: [
        {
          source: "https://riversidefamilydental.com",
          excerpt: "Implant guides. Dental implants vs bridges. What implants cost in Oregon.",
        },
      ],
    },
    {
      domain: "in-house-deferral",
      name: "Doing nothing for another year",
      positioningOneLiner: "The patient who knows they need work and keeps putting it off.",
      whyTheyCompete:
        "For elective cosmetic and implant work, the real competitor is deferral. A site that will not discuss cost makes deferral the path of least resistance.",
      overlapType: "substitute",
      evidence: [
        {
          source: "https://acmedental.com/services",
          excerpt: "Book a consultation to find out whether you are a candidate.",
        },
      ],
    },
  ],
  marketNotes:
    "Portland dentistry is fragmented and local, with no single dominant brand. The competitive edge is being won on transparency rather than clinical claims: both of the strongest competitors publish prices, and both convert on urgency or certainty. Acme competes on relationship, which retains existing patients well but generates no acquisition. Nobody in this set is large enough to outspend anyone, so the market is decided by which practice answers the buyer's question first.",
};

const visibilityOutput: OrganicVisibilityOutput = {
  entries: [
    {
      domain: "acmedental.com",
      isProspect: true,
      indexedContentVolume: {
        label: "Pages likely indexed",
        kind: "range",
        low: 4,
        high: 12,
        unit: "pages",
        basis: "estimated",
        confidence: "medium",
        evidence: [
          {
            source: "https://acmedental.com",
            excerpt:
              "Navigation exposes exactly four pages: home, services, about, contact. No blog, no location pages, no per-treatment pages.",
          },
          {
            source: "search:site:acmedental.com",
            excerpt: "Brand-name searches surface the homepage and little else beneath it.",
          },
        ],
      },
      topicalCoverage: {
        label: "Distinct buyer-intent topics covered",
        kind: "qualitative",
        value:
          "Very thin. Five treatments are named on one shared services page, so no treatment has a page of its own that could rank for it.",
        basis: "estimated",
        confidence: "high",
        evidence: [
          {
            source: "https://acmedental.com/services",
            excerpt:
              "General dentistry, cosmetic dentistry, Invisalign, dental implants and emergency care all appear as short sections of a single page.",
          },
        ],
      },
      contentFreshness: {
        label: "Publishing cadence",
        kind: "qualitative",
        value: "No dated content of any kind. Nothing indicates the site has changed since it was built.",
        basis: "estimated",
        confidence: "medium",
        evidence: [
          {
            source: "https://acmedental.com",
            excerpt: "No blog link in the navigation and no dated content on any page read.",
          },
        ],
      },
      rankingTrajectory: {
        direction: "flat",
        confidence: "low",
        rationale:
          "A four-page brochure site with no publishing cadence has nothing that would cause movement in either direction. Flat is the expected state, but without historical data this is inference from site structure, not measurement.",
        evidence: [
          {
            source: "search:acme dental portland",
            excerpt: "The brand query returns the homepage. Non-brand service queries did not surface the domain at all.",
          },
        ],
      },
    },
    {
      domain: "pearlbrightdental.com",
      isProspect: false,
      indexedContentVolume: {
        label: "Pages likely indexed",
        kind: "range",
        low: 40,
        high: 120,
        unit: "pages",
        basis: "estimated",
        confidence: "low",
        evidence: [
          {
            source: "https://pearlbrightdental.com",
            excerpt: "A guides section is linked from the main navigation alongside dedicated Invisalign and pricing pages.",
          },
        ],
      },
      topicalCoverage: {
        label: "Distinct buyer-intent topics covered",
        kind: "qualitative",
        value:
          "Strong on one vertical. Cost, comparison, consultation and financing questions for Invisalign each have their own guide.",
        basis: "derived",
        confidence: "high",
        evidence: [
          {
            source: "https://pearlbrightdental.com",
            excerpt:
              "How much does Invisalign cost in Portland. Invisalign vs braces for adults. What happens at an Invisalign consultation. Financing your treatment.",
          },
        ],
      },
      contentFreshness: {
        label: "Publishing cadence",
        kind: "qualitative",
        value: "Actively maintained, though no post dates were visible on the pages read.",
        basis: "estimated",
        confidence: "low",
        evidence: [
          { source: "https://pearlbrightdental.com", excerpt: "Popular guides section is linked from the homepage." },
        ],
      },
      rankingTrajectory: {
        direction: "rising",
        confidence: "medium",
        rationale:
          "They hold the top result for the commercial Invisalign cost query in this city and have built a cluster around it. That is a defensible position that tends to compound.",
        evidence: [
          {
            source: "search:invisalign portland cost",
            excerpt: "Pearlbright Dental is the leading result, with its pricing page also surfacing.",
          },
        ],
      },
    },
    {
      domain: "portlandsmileco.com",
      isProspect: false,
      indexedContentVolume: {
        label: "Pages likely indexed",
        kind: "range",
        low: 15,
        high: 50,
        unit: "pages",
        basis: "estimated",
        confidence: "low",
        evidence: [
          {
            source: "https://portlandsmileco.com",
            excerpt: "Navigation exposes emergency, pricing and booking pages.",
          },
        ],
      },
      topicalCoverage: {
        label: "Distinct buyer-intent topics covered",
        kind: "qualitative",
        value: "Narrow and deliberate. Everything points at urgent, same-day demand.",
        basis: "derived",
        confidence: "high",
        evidence: [
          {
            source: "https://portlandsmileco.com",
            excerpt: "Toothache, broken tooth or lost crown. Same day emergency appointments across Portland.",
          },
        ],
      },
      contentFreshness: {
        label: "Publishing cadence",
        kind: "qualitative",
        value: "Unknown. No dated content was visible.",
        basis: "estimated",
        confidence: "low",
        evidence: [{ source: "https://portlandsmileco.com", excerpt: "No blog or dated content in the navigation." }],
      },
      rankingTrajectory: {
        direction: "unknown",
        confidence: "low",
        rationale:
          "They rank for the emergency query today, but nothing observable indicates whether that position is new, stable or slipping. Reporting a direction here would be a guess.",
        evidence: [
          {
            source: "search:emergency dentist portland",
            excerpt: "Portland Smile Co appears prominently for the emergency query.",
          },
        ],
      },
    },
    {
      domain: "riversidefamilydental.com",
      isProspect: false,
      indexedContentVolume: {
        label: "Pages likely indexed",
        kind: "range",
        low: 20,
        high: 80,
        unit: "pages",
        basis: "estimated",
        confidence: "low",
        evidence: [
          { source: "https://riversidefamilydental.com", excerpt: "A blog and dedicated implants and family care sections are linked." },
        ],
      },
      topicalCoverage: {
        label: "Distinct buyer-intent topics covered",
        kind: "qualitative",
        value: "Moderate, concentrated on implant comparison and cost questions.",
        basis: "derived",
        confidence: "medium",
        evidence: [
          {
            source: "https://riversidefamilydental.com",
            excerpt: "Dental implants vs bridges. What implants cost in Oregon. Recovery after implant surgery.",
          },
        ],
      },
      contentFreshness: {
        label: "Publishing cadence",
        kind: "qualitative",
        value: "A maintained blog exists, cadence unknown.",
        basis: "estimated",
        confidence: "low",
        evidence: [{ source: "https://riversidefamilydental.com", excerpt: "Blog linked from the main navigation." }],
      },
      rankingTrajectory: {
        direction: "flat",
        confidence: "low",
        rationale:
          "Established family practice with steady comparison content and no signal of a recent push in either direction.",
        evidence: [
          {
            source: "search:dental implants portland cost",
            excerpt: "Riverside surfaces alongside Pearlbright for implant cost comparison queries.",
          },
        ],
      },
    },
  ],
  methodology:
    "Every figure here comes from two sources only: the navigation and body copy of pages actually fetched, and the results of the searches listed in the evidence. Page counts are bands inferred from how many distinct sections a site links to, never a crawl and never an index count. Topical coverage is counted from named topics visible on the pages read. Trajectory is inferred from whether a domain holds a commercial query today plus whether it has a content cluster supporting that position.",
  caveats: [
    "No analytics, Search Console or third-party rank tracking was available, so no traffic figure appears anywhere in this report and none should be inferred from it.",
    "Page count bands are wide on purpose. A site with a large unlinked archive would fall outside them.",
    "Trajectory for portlandsmileco.com is reported as unknown rather than estimated, because a single current ranking says nothing about direction.",
    "All searches were run once, unpersonalised. Local results vary by searcher location and device.",
  ],
};

const leakageOutput: LeakageOutput = {
  conversionLeakage: [
    {
      title: "Contact form asks for nine fields before a callback",
      detail:
        "The only conversion path on the site is a form requiring first name, last name, email, phone, date of birth, insurance provider, insurance member ID, existing patient status and reason for visit. Insurance details are being collected before the practice has agreed to see the patient, and date of birth before any clinical relationship exists. Each additional required field costs completions, and this form has nine of them guarding a callback that then takes two business days.",
      evidence: [
        {
          source: "https://acmedental.com/contact",
          excerpt:
            "fetch_page signals: formFieldCount 9, all required. Fields include Date of birth, Insurance provider and Insurance member ID.",
        },
        {
          source: "https://acmedental.com/contact",
          excerpt: "Fill in the form and a member of our team will call you back within two business days.",
        },
      ],
      impact: "high",
      area: "form",
      fix: "Cut the form to name, phone and reason for visit. Collect insurance and date of birth on the confirmation call, where a person is already talking to the patient.",
    },
    {
      title: "No pricing anywhere on the site",
      detail:
        "Cost is the question every prospective patient has, and the site answers it nowhere. Both leading competitors publish figures, one from $3,400 for Invisalign and one from $89 for an emergency exam. A visitor comparing three practices gets an answer from two of them and a request for their insurance ID from the third.",
      evidence: [
        {
          source: "https://acmedental.com/about",
          excerpt: "We are in network with most major PPO plans and can discuss payment options at your first visit.",
        },
        { source: "https://pearlbrightdental.com", excerpt: "Invisalign in Portland from $3,400." },
      ],
      impact: "high",
      area: "pricing",
      fix: "Publish a starting-from figure for the five named treatments. A range with an explanation of what moves it beats silence and costs nothing clinically.",
    },
    {
      title: "No booking CTA above the fold on the homepage",
      detail:
        "Both homepage calls to action sit below several paragraphs of practice history. A visitor arriving ready to book has to scroll past 2004 to find out how.",
      evidence: [
        {
          source: "https://acmedental.com",
          excerpt:
            "fetch_page signals: ctaCount 2, both appearing after the practice history and services prose. The first is 'See all services'.",
        },
      ],
      impact: "medium",
      area: "cta",
      fix: "Put a single 'Request an appointment' button in the header, visible on load and on every page.",
    },
    {
      title: "Patient reviews are mentioned but never shown",
      detail:
        "The homepage claims the practice is rated highly by the families it looks after, and then shows no rating, no review count and no quoted patient. The claim is doing none of the work a real review would do, while a competitor states 4.9 from 612 reviews on its homepage.",
      evidence: [
        {
          source: "https://acmedental.com",
          excerpt: "We are rated highly by the families we look after and many of them have been with us for a decade.",
        },
        { source: "https://pearlbrightdental.com", excerpt: "Rated 4.9 from 612 reviews." },
      ],
      impact: "medium",
      area: "proof",
      fix: "Pull the existing Google rating and count onto the homepage and the contact page, with three quoted reviews next to the form.",
    },
  ],
  competitorLeakage: [
    {
      title: "Invisalign cost questions are owned by Pearlbright",
      detail:
        "Acme provides Invisalign and gives it two sentences on a shared services page, ending in an invitation to book a consultation to find out whether you are a candidate. Pearlbright has built a guide cluster around the cost question and leads with a figure. Every Portland adult searching what Invisalign costs is being answered by the competitor, and the case is effectively decided before Acme is considered.",
      evidence: [
        {
          source: "search:invisalign portland cost",
          excerpt: "Pearlbright Dental leads the results with 'Invisalign in Portland from $3,400', with its pricing page also surfacing.",
        },
        {
          source: "https://acmedental.com/services",
          excerpt:
            "Clear aligner treatment planned in practice. Treatment length varies by case. Book a consultation to find out whether you are a candidate.",
        },
      ],
      impact: "high",
      queryTheme: "Invisalign cost and comparison in Portland",
      ownedBy: ["pearlbrightdental.com"],
      fix: "Publish one page answering what Invisalign costs at this practice, with a range and what moves it, then link it from the services page.",
    },
    {
      title: "Emergency dentist searches go to Portland Smile Co",
      detail:
        "Acme offers same day emergency appointments but restricts them to existing patients, and says so only in a single line on the services page. Portland Smile Co has built its entire site on that demand and quotes a price for the visit. This is the highest-intent search in the category and Acme is structurally excluded from it by its own policy rather than by capability.",
      evidence: [
        {
          source: "search:emergency dentist portland",
          excerpt: "Portland Smile Co ranks prominently with 'Emergency dentist, open seven days' and 'Emergency exam from $89'.",
        },
        {
          source: "https://acmedental.com/services",
          excerpt: "Same day appointments for existing patients experiencing pain.",
        },
      ],
      impact: "high",
      queryTheme: "Emergency and same-day dental care in Portland",
      ownedBy: ["portlandsmileco.com"],
      fix: "Decide whether emergency slots can be opened to new patients. If they can, build a page for it; if they cannot, stop competing there and put the effort into Invisalign instead.",
    },
    {
      title: "No content for implant comparison queries",
      detail:
        "Acme places and restores implants in house, which is a genuine differentiator, and has no page saying so. Riverside and Pearlbright both publish comparison and cost content for implants. The most profitable treatment on the list has the least marketing behind it.",
      evidence: [
        {
          source: "https://riversidefamilydental.com",
          excerpt: "Implant guides. Dental implants vs bridges. What implants cost in Oregon. Recovery after implant surgery.",
        },
        {
          source: "https://acmedental.com/services",
          excerpt: "Single implants and implant supported bridges, placed and restored in house.",
        },
      ],
      impact: "medium",
      queryTheme: "Dental implant cost and comparison in Oregon",
      ownedBy: ["riversidefamilydental.com", "pearlbrightdental.com"],
      fix: "Write one implants page covering cost range, implants versus bridges, and the fact that placement and restoration happen in one practice.",
    },
  ],
};

const scoringOutput: ScoringOutput = {
  components: {
    fit: {
      score: 82,
      rationale:
        "An owner-run service business with a considered purchase, entirely dependent on inbound, and no in-house marketing function. That is squarely the profile. It loses points only because the practice appears content with its retained base, which can make it a slower sale than the site suggests.",
    },
    painSeverity: {
      score: 78,
      rationale:
        "Two high-impact conversion findings and two high-impact competitor findings, and they compound: the treatments with no content are the same ones with no price, so the most profitable work is invisible twice over. Not existential, since the retained base keeps the practice full, but every new patient is being lost at a measurable point.",
    },
    timingSignals: {
      score: 55,
      rationale:
        "Genuinely mixed. A competitor has established a cost-led position in Invisalign that gets harder to displace every month, which is a real clock. Against that, nothing indicates Acme is currently feeling pain: no hiring signal, no site rebuild, no new service push. The urgency is real but it is ours, not theirs, and that has to be earned in the conversation rather than asserted.",
    },
    reachability: {
      score: 88,
      rationale:
        "A named owner, Dr. Helen Marsh, a nine-person practice, and a direct phone number on every page. The decision maker is one person and there is no procurement layer. About as reachable as B2B gets.",
    },
  },
  rationale:
    "This is a strong prospect with an honest caveat. Acme Dental fits the profile almost exactly: a small owner-run practice that depends on inbound, has no marketing function, and is losing new patients at points that can be pinpointed and fixed. The findings are specific enough to open a conversation with something they cannot dismiss, and the decision maker is a named individual reachable by phone. The score is held out of the high eighties by timing rather than fit. Nothing on the site suggests the practice currently feels a problem, and a full retained patient list is exactly the condition under which owners defer marketing decisions. The Invisalign position a competitor has built is the strongest available reason to act now, so it should lead the sequence, and the argument for urgency has to be made rather than assumed.",
  confidence: "high",
};

const copyOutput: CopyOutput = {
  touches: [
    {
      day: 0,
      channel: "email",
      subject: "Your quote form asks for nine things",
      referencedFinding: "Contact form asks for nine fields before a callback",
      body: "Dr. Marsh, your appointment request form asks for nine required fields, including date of birth and insurance member ID, before anyone at the practice has spoken to the patient. Then the callback takes two business days. Most practices we look at lose the majority of form starts somewhere in that stretch. The fix is small. Ask for name, phone and reason for visit, and collect the insurance details on the call you were going to make anyway. I mapped four of these on your site and two more where competitors are taking searches you could win. Worth twenty minutes to walk you through it?",
    },
    {
      day: 3,
      channel: "email",
      subject: "Pearlbright owns Invisalign cost in PDX",
      referencedFinding: "Invisalign cost questions are owned by Pearlbright",
      body: "Following the note about your form. Search Invisalign cost in Portland and Pearlbright answers it, from $3,400, with four guides built around the question. Your services page offers Invisalign in two sentences and asks people to book a consultation to find out if they qualify. So the patient comparing three practices gets a number from them and a form from you, and the case is usually decided before you are in it. You already do the treatment. One page with a range and what moves it would put you back in the comparison. Free to talk Thursday?",
    },
    {
      day: 7,
      channel: "linkedin",
      referencedFinding: "No pricing anywhere on the site",
      body: "Dr. Marsh, I sent two notes about Acme Dental's site. Short version: your five treatments have no price anywhere, and both practices you compete with publish theirs. Patients are choosing before they call you. I put together a breakdown of where that costs you and what to change first. Want me to send it over?",
    },
    {
      day: 12,
      channel: "email",
      subject: "Closing the loop on Acme Dental",
      referencedFinding: "Emergency dentist searches go to Portland Smile Co",
      body: "Last one from me, Dr. Marsh. The thing I would still look at is emergency care. You offer same day appointments but only to existing patients, and Portland Smile Co has built a whole practice on that search. It is the highest intent query in your category and you are out of it by policy rather than capability. Either open those slots to new patients and build a page for it, or drop it and put the effort into Invisalign. Both are defensible. Doing neither is the expensive option. If this is not a priority right now, no problem, and I will leave you to it.",
    },
  ],
  sequenceNotes:
    "Opens with the nine-field form because it is the most concrete and least arguable finding, and it costs them money today. Day 3 escalates from their own site to the competitive threat, which is the strongest argument for acting now rather than next year. The LinkedIn touch compresses both into the pricing gap, since that is the one a practice owner can verify in ten seconds. The breakup raises emergency care, deliberately held back, and frames it as a decision rather than a failure. A reply to day 0 means they will act on the site itself; a reply to day 3 or day 12 means the competitive threat landed and the conversation should be about acquisition, not conversion.",
};

// ---------------------------------------------------------------------------
// The recording itself: what each agent asked for, and when.
// ---------------------------------------------------------------------------

export const acmeDental: RecordedRun = {
  domain: "acmedental.com",
  label: "Acme Dental, Portland OR",
  icp: "Owner-run local service businesses that depend on inbound and have no in-house marketing team",
  pages,
  agents: {
    RecceAgent: [
      {
        delayMs: 1400,
        usage: { input: 2180, output: 96 },
        preamble: "Starting with the site map so I fetch pages that exist rather than guessing URLs.",
        toolCalls: [{ name: "list_site_pages", input: { domain: "acmedental.com", limit: 15 } }],
      },
      {
        delayMs: 1900,
        usage: { input: 3420, output: 210, cacheRead: 2100 },
        preamble: "Four pages, all worth reading. Fetching them together.",
        toolCalls: [
          { name: "fetch_page", input: { url: "https://acmedental.com" } },
          { name: "fetch_page", input: { url: "https://acmedental.com/services" } },
          { name: "fetch_page", input: { url: "https://acmedental.com/about" } },
          { name: "fetch_page", input: { url: "https://acmedental.com/contact" } },
        ],
      },
      {
        delayMs: 4200,
        usage: { input: 9840, output: 1180, cacheRead: 2100 },
        final: recceOutput,
      },
    ],

    CompetitorMapAgent: [
      {
        delayMs: 2600,
        usage: { input: 1960, output: 140 },
        preamble: "Searching for who actually ranks for their core services in this city.",
        searches: [
          {
            query: "invisalign portland cost",
            results: [
              {
                title: "Invisalign Portland from $3,400 | Pearlbright Dental",
                url: "https://pearlbrightdental.com/invisalign",
                snippet: "Invisalign in Portland from $3,400. See exactly what treatment costs before you book.",
              },
              {
                title: "How much does Invisalign cost in Portland?",
                url: "https://pearlbrightdental.com/guides/invisalign-cost",
                snippet: "A full breakdown of Invisalign pricing in Portland, including financing options.",
              },
            ],
          },
          {
            query: "emergency dentist portland same day",
            results: [
              {
                title: "Emergency Dentist Portland | Open 7 Days | Portland Smile Co",
                url: "https://portlandsmileco.com/emergency",
                snippet: "Same day emergency appointments across Portland. Emergency exam from $89.",
              },
            ],
          },
          {
            query: "family dentist southeast portland implants",
            results: [
              {
                title: "Riverside Family Dental | Portland Family Dentistry and Implants",
                url: "https://riversidefamilydental.com",
                snippet: "General and family dentistry, plus a dedicated implant practice.",
              },
            ],
          },
        ],
      },
      {
        delayMs: 1700,
        usage: { input: 4120, output: 180, cacheRead: 1800 },
        preamble: "Confirming what each of the three actually sells before I call them competitors.",
        toolCalls: [
          { name: "fetch_page", input: { url: "https://pearlbrightdental.com" } },
          { name: "fetch_page", input: { url: "https://portlandsmileco.com" } },
          { name: "fetch_page", input: { url: "https://riversidefamilydental.com" } },
        ],
      },
      {
        delayMs: 3800,
        usage: { input: 8600, output: 1020, cacheRead: 1800 },
        final: competitorMapOutput,
      },
    ],

    OrganicVisibilityAgent: [
      {
        delayMs: 3100,
        usage: { input: 2340, output: 160 },
        preamble: "Testing brand and non-brand queries to see who is present where.",
        searches: [
          {
            query: "site:acmedental.com",
            results: [
              {
                title: "Acme Dental Portland | Family and Cosmetic Dentistry",
                url: "https://acmedental.com",
                snippet: "Family and cosmetic dentistry in Southeast Portland. Accepting new patients.",
              },
            ],
          },
          {
            query: "acme dental portland",
            results: [
              {
                title: "Acme Dental Portland | Family and Cosmetic Dentistry",
                url: "https://acmedental.com",
                snippet: "Gentle dentistry for the whole family since 2004.",
              },
            ],
          },
          {
            query: "dental implants portland cost",
            results: [
              {
                title: "What implants cost in Oregon | Riverside Family Dental",
                url: "https://riversidefamilydental.com/implants",
                snippet: "Dental implants vs bridges, and what implants cost in Oregon.",
              },
              {
                title: "Implant pricing | Pearlbright Dental",
                url: "https://pearlbrightdental.com/pricing",
                snippet: "Transparent pricing across cosmetic and restorative treatment.",
              },
            ],
          },
        ],
      },
      {
        delayMs: 5400,
        usage: { input: 11200, output: 2140, cacheRead: 2400 },
        final: visibilityOutput,
      },
    ],

    LeakageAgent: [
      {
        delayMs: 2200,
        usage: { input: 2760, output: 120 },
        preamble: "Re-reading the contact page closely, since the form is where this will live or die.",
        toolCalls: [{ name: "fetch_page", input: { url: "https://acmedental.com/contact" } }],
      },
      {
        delayMs: 5900,
        usage: { input: 12400, output: 2380, cacheRead: 2600 },
        final: leakageOutput,
      },
    ],

    ScoringAgent: [
      {
        delayMs: 3400,
        usage: { input: 5240, output: 880, cacheRead: 1200 },
        final: scoringOutput,
      },
    ],

    CopyAgent: [
      {
        delayMs: 4600,
        usage: { input: 6180, output: 1340, cacheRead: 1400 },
        final: copyOutput,
      },
    ],
  },
};
