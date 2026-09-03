/**
 * Country names offered as datalist suggestions across Income, Payslips,
 * Tax Years, and Correspondence — free text everywhere, so you're never
 * blocked on adding a country that isn't in this list. Not a managed
 * "Countries" list any more: no brackets, no per-country editing page.
 */
const COMMON_COUNTRIES = [
  "Denmark",
  "Belgium",
  "Poland",
  "Netherlands",
  "Germany",
  "France",
  "United Kingdom",
  "United States",
  "Ireland",
  "Spain",
  "Italy",
  "Sweden",
  "Norway",
  "Switzerland",
  "Canada",
  "Australia",
];

/** Convenience only: auto-selects a likely currency when a known country name is entered. Not exhaustive — pick your own if it's wrong. */
const COUNTRY_CURRENCY_HINTS = {
  "denmark": "DKK",
  "belgium": "EUR",
  "poland": "PLN",
  "netherlands": "EUR",
  "germany": "EUR",
  "france": "EUR",
  "ireland": "EUR",
  "spain": "EUR",
  "italy": "EUR",
  "united kingdom": "GBP",
  "united states": "USD",
  "sweden": "SEK",
  "norway": "NOK",
  "switzerland": "CHF",
  "canada": "CAD",
  "australia": "AUD",
};

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance / Contract",
  "Business",
  "Investment",
  "Rental",
  "Capital Gains",
  "Other",
];

/** Suggested counterparties for the Correspondence log (free text — pick or type your own). */
const CORRESPONDENCE_COUNTERPARTIES = [
  "KPMG",
  "PwC",
  "EY",
  "Deloitte",
  "Accountant",
  "IRS (US)",
  "HMRC (UK)",
  "Bundeszentralamt für Steuern (DE)",
  "CRA (Canada)",
  "ATO (Australia)",
  "DGFiP (France)",
];

const CORRESPONDENCE_CHANNELS = [
  "Email",
  "Phone call",
  "Video call",
  "Letter",
  "In-person meeting",
  "Online portal message",
];

const CORRESPONDENCE_STATUSES = ["Open", "Resolved"];

/** What kind of update a correspondence entry represents — lets you log outcomes, not just channels. */
const CORRESPONDENCE_CATEGORIES = [
  "Question / inquiry",
  "Document request",
  "Tax return filed",
  "Refund notice",
  "Assessment / bill",
  "General update",
];

/** Currencies offered in amount fields across Tax Years, Payslips, and Correspondence. */
const CURRENCIES = [
  { code: "DKK", symbol: "kr" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "PLN", symbol: "zł" },
  { code: "CAD", symbol: "$" },
  { code: "AUD", symbol: "$" },
  { code: "NOK", symbol: "kr" },
  { code: "SEK", symbol: "kr" },
  { code: "CHF", symbol: "Fr" },
];

/**
 * Default Gemini model used for payslip analysis — editable per-browser in
 * Payslip settings. Gemini 2.5 Flash is free of charge in Google AI
 * Studio's standard tier (as of this writing) and more than capable of
 * reading fixed fields off a clear document — check
 * ai.google.dev/gemini-api/docs/pricing for current limits/rates.
 */
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

const PAYSLIP_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Payslip entry types — "Salary" is the default recurring monthly one; "Holiday pay" is the once-a-year extra payout. */
const PAYSLIP_TYPES = ["Salary", "Holiday pay"];

/** Suggested actions for the Tax Years payment-activity ledger (free text — pick or type your own). */
const TAX_YEAR_ACTIONS = [
  "Tax payed",
  "Refund received",
  "Assessment received",
  "Document submitted",
  "Advance payment",
];

/** The four status checks tracked per tax year, in display order. */
const TAX_YEAR_STATUS_FIELDS = [
  { key: "yearCompleted", label: "Tax year completed?" },
  { key: "questionnairesDone", label: "Tax questionnaires done?" },
  { key: "returnsFiled", label: "Tax returns prepared and filed?" },
  { key: "paidAndReturned", label: "Tax payed and returned?" },
];

/**
 * Shown in every page's footer so it's obvious which build is live —
 * useful since this is a static site with no build step of its own to
 * stamp a version automatically. Bump both on any user-visible change;
 * full history lives in CHANGELOG.md at the repo root.
 */
const APP_VERSION = "1.12.0";
const APP_VERSION_DATE = "2026-09-03";

/** Most recent entries only (newest first) — shown as the footer's version tooltip. Full history: CHANGELOG.md. */
const APP_CHANGELOG = [
  { version: "1.12.0", summary: "Refund netting now converts non-EUR refunds (e.g. a DKK refund from Denmark) using the exchange rates set on the Income page, instead of only netting EUR ones — a currency with no rate set yet is flagged rather than silently dropped. New \"All years\" dashboard on Tax Tracker: every tax year at a glance (status, Income/Tax/Refunded/Net tax/Net tax rate) with an Open button to jump straight into one." },
  { version: "1.11.0", summary: "Tax Tracker's country summary now nets refunds against tax paid — e.g. Denmark: pay tax all year, get part back at year end. Log a \"Refund received\" payment activity and it's automatically subtracted from that country's Tax €, with new Refunded €/Net tax €/Net tax rate columns. Only EUR refunds are netted (a non-EUR one is flagged, not silently dropped)." },
  { version: "1.10.0", summary: "Payslips now handles annual holiday pay: a Type selector (Salary / Holiday pay) on bulk upload, a Type column in the monthly log, a \"includes €X holiday pay\" note on the yearly summary, and holiday pay excluded from the missing-months check (it isn't expected every month). Flows straight into Income's overview like any other payslip." },
  { version: "1.9.0", summary: "Income's Overview now pulls Gross/Net/Tax straight from Payslips (the actual source of truth) instead of duplicating that as manual entries. Manually logged entries below fold in as \"Other income\", and a Total income row combines Payslips' net pay with them — all EUR-converted, all compared against last year." },
  { version: "1.8.1", summary: "Payslips: removed Country and Employer — same employer every time, so tracking them was pure noise. Bulk upload no longer asks for them, the monthly log has no Country/Employer columns, and \"Yearly summary by country\" is just \"Yearly summary\" (one set of totals, no grouping)." },
  { version: "1.8.0", summary: "Income gained an Overview: per-country totals converted to EUR, compared against last year (New/+X%/−X%). You set the exchange rate for each non-EUR currency you log (\"1 EUR = ? DKK\"), saved and included in backups. Rows missing a rate are flagged and excluded from totals rather than silently wrong." },
  { version: "1.7.0", summary: "New Settings page (reached via a gear icon, not the tracker switcher) holds the Gemini API key and Data export/import/wipe — both used to live on Payslips and Tax Tracker respectively. Removed the Currency converter from Tax Tracker's Overview. Payslips' single-file \"Add a payslip\" form is gone — bulk upload (which also works for one file) is now the only way in. The header's Tax Tracker / Income Tracker switcher is a real button with a working dropdown." },
  { version: "1.6.0", summary: "Tax Tracker merged into a single year-scoped page: pick a year, then switch between Overview, Tax information (per-country entry), and Correspondence — all three now live inside that one tax-year record instead of separate nav pages. The old flat correspondence log and its lightweight follow-up log are gone; correspondence is per tax year now." },
  { version: "1.5.0", summary: "Split into Tax Tracker / Income Tracker with a header switcher. Removed Residency and Countries (and the bracket-based estimate they powered) — countries are free text everywhere now. Dashboard rebuilt to summarize Tax Years data; Data export/import/wipe moved there. Tax Years restructured into an Overview tab + one tab per country. Payslips gained bulk upload and a missing-months tracker." },
  { version: "1.4.1", summary: "Payslip AI extraction tuned against a real multi-page European payslip: ignores YTD boxes and daily time-sheet pages, handles comma-decimal numbers, auto-fills Year/Month/Country from the result." },
  { version: "1.4.0", summary: "Tax Years rebuilt: income/tax-year pairs, status checklist, EUR→DKK converter, per-country table, payment activities, follow-up log." },
  { version: "1.3.0", summary: "Payslip AI analysis on Gemini (free tier), with client-side image downscaling to keep it cheap." },
  { version: "1.2.0", summary: "Added Payslips (AI-analyzed uploads), Tax Years (v1), and Correspondence categories/amounts." },
  { version: "1.1.0", summary: "Added Correspondence: a log of communication with accountants and tax authorities." },
  { version: "1.0.0", summary: "Initial release: Dashboard, Income, Residency, Countries." },
];
