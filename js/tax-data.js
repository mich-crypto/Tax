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

/**
 * TEMPORARY (testing only — see js/claude-vision.js): default Claude model
 * for payslip analysis, editable per-browser in Settings. This app ships on
 * Gemini; the whole Claude path is one "AI provider" toggle away from removal.
 */
const CLAUDE_DEFAULT_MODEL = "claude-opus-5";

const PAYSLIP_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Payslip entry types — "Salary" is the recurring monthly one; "Holiday pay" is the once-a-year payout. */
const PAYSLIP_TYPES = ["Salary", "Holiday pay"];

/** Suggested actions for a tax year's payment ledger (free text — pick or type your own). */
const PAYMENT_ACTIONS = [
  "Tax payed",
  "Refund received",
  "Advance payment",
  "Assessment received",
  "Document submitted",
];

/** The four year-level completion checks, in display order. */
const TAX_YEAR_STATUS_FIELDS = [
  { key: "yearCompleted", label: "Tax year completed" },
  { key: "questionnairesDone", label: "Questionnaires done" },
  { key: "returnsFiled", label: "Returns prepared & filed" },
  { key: "paidAndReturned", label: "Tax payed & returned" },
];

/** Per-country progress, tracked separately for every country in a tax year. */
const COUNTRY_STATUS_FIELDS = [
  { key: "questionnaireDone", label: "Questionnaire", short: "Q" },
  { key: "returnFiled", label: "Return filed", short: "Filed" },
  { key: "paidReturned", label: "Payed / returned", short: "Payed" },
];

/** Social-security and insurance paperwork tracked per year alongside the tax return. */
const TAX_YEAR_FORM_FIELDS = [
  { key: "a1", label: "A1 certificate" },
  { key: "s1", label: "S1 form" },
  { key: "blueCard", label: "Blue insurance card" },
];

/** Suggested counterparties for the Correspondence log (free text — pick or type your own). */
const CORRESPONDENCE_COUNTERPARTIES = [
  "KPMG",
  "Vestas HR",
  "SKAT (DK)",
  "FPS Finance (BE)",
  "HMRC (UK)",
  "Belastingdienst (NL)",
  "Accountant",
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

/**
 * Shown in every page's footer so it's obvious which build is live —
 * useful since this is a static site with no build step of its own to
 * stamp a version automatically. Bump both on any user-visible change;
 * full history lives in CHANGELOG.md at the repo root.
 */
const APP_VERSION = "2.2.0";
const APP_VERSION_DATE = "2026-09-04";

/** Most recent entries only (newest first) — shown as the footer's version tooltip. Full history: CHANGELOG.md. */
const APP_CHANGELOG = [
  { version: "2.2.0", summary: "Income year is gone — a year is named by its tax year alone. The Tax years list drops its headline figure bar and the Refunded from DK and Balance columns; both figures still live on each year's own page. New on that page: a flow diagram showing gross income splitting into what you kept and the tax paid in each country." },
  { version: "2.1.0", summary: "Visual rework. Figures are set in a monospace so money lines up on the digit, page titles in a serif, and summary numbers sit in one hairline-divided band instead of a row of cards — which is what made the leftmost figure sit higher than the rest. Fixed checkbox labels being shoved to the far edge of their box, unified the section-heading sizes, and rebuilt Correspondence as stacked entries so a real note no longer clips. Adding a payslip moved into a dialog behind a + button on the Monthly log, with a manual-entry tab." },
  { version: "2.0.0", summary: "Rebuilt around the real spreadsheet model. A tax year now has ONE gross income (the Danish salary) instead of summing per-country income — which double-counted the same salary taxed in several places — plus \"Refunded from Denmark\" as its own figure. Balance (refunded − tax paid), Net income and effective rate are derived from those, matching the spreadsheet's own numbers exactly. Countries carry their own Questionnaire/Filed/Payed flags and a comment. Income and Payslips merged into one page." },
];
