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

/** Marks a country listed for the record but with nothing owed there. */
const COUNTRY_NOT_LIABLE_FIELD = { key: "notLiable", label: "Not tax liable here", short: "N/A" };

/** Per-country progress, tracked separately for every country in a tax year. */
const COUNTRY_STATUS_FIELDS = [
  { key: "questionnaireDone", label: "Questionnaire", short: "Q" },
  { key: "returnFiled", label: "Return filed", short: "Filed" },
  { key: "paidReturned", label: "Payed / returned", short: "Payed" },
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
const APP_VERSION = "2.12.0";
const APP_VERSION_DATE = "2026-09-04";

/** Most recent entries only (newest first) — shown as the footer's version tooltip. Full history: CHANGELOG.md. */
const APP_CHANGELOG = [
  { version: "2.12.0", summary: "The money section is one combined card: Gross income, Tax paid, Net income, Tax rate, and Tax return from Denmark — Net income and Tax rate now use gross pre-paid tax (matching the source spreadsheet's own definitions) rather than netting refunds off, with Denmark's refund shown as its own figure instead. The flow diagram reverts to gross tax paid per country to match." },
  { version: "2.11.0", summary: "The year's headline is now Gross income / Net income / Tax / Tax rate, all calculated from the Countries table — the manual gross-income entry is gone. Countries table columns are Taxable income / Pre-paid tax / Actual Tax / Tax return. Gross income summing per-country figures can double-count a salary taxed as a whole in one country and as a slice in another — check your country rows if a year's gross looks wrong." },
  { version: "2.10.0", summary: "Payslips can be net pay only — gross and tax withheld left unknown rather than shown as zero. A checkbox on the manual entry form marks one; Gross pay and Tax withheld tiles, and the monthly log, show a dash for what a net-only payslip doesn't record instead of a misleading €0.00." },
  { version: "2.9.0", summary: "The money card lists Pre-paid / Actual / Tax return per country instead of Denmark only. Gross income carries its own currency and converts like a country row. The countries footer totals income, with a note comparing it against the year's gross." },
  { version: "2.8.1", summary: "Summary figures renamed to Tax prepaid / Tax refunded, each labelled as covering every country — the Denmark-only equivalents are the lines on the money card above." },
  { version: "2.8.0", summary: "Countries table: Net is now Net income (that country's income less the tax paid on it), and a Rate column shows the actual tax — paid less refunded — as a share of that income." },
  { version: "2.7.1", summary: "A country row shows one figure, in its own currency, instead of the euro shadow underneath — and switching a row's currency now converts the figures instead of relabelling them. Fixed the currency picker being written straight to storage by the generic cell handler, which bypassed the conversion and left a failed switch half-applied." },
  { version: "2.7.0", summary: "Country figures are kept in the country's OWN currency with euro derived at the current rate, so correcting a rate restates the numbers. Rates can be fetched from the ECB — today's, or a calendar year's average. The money card is euro only and now reads Gross income / Already payed taxes in DK / Actual taxes in DK / Tax return from DK. Dates are DD-MM-YYYY everywhere, and the flow diagram labels tax destinations \"Tax <country>\"." },
  { version: "2.6.0", summary: "A tax year is now named by the year the income was EARNED, not the year the return is filed — what read as 2026 is the 2025 tax year. Existing data shifts itself once on first load, and older backups shift on import. Travel days line up with the same calendar year as a result." },
  { version: "2.5.0", summary: "Upload your Travel Tracker report under Settings and each tax year shows where you actually were — days of presence and days worked per country for the calendar year that return covers. Transit days are excluded from presence, matching the report's own summary. Only the totals are stored, not the daily rows." },
  { version: "2.4.0", summary: "A country now records the tax paid there AND how much came back, so Denmark's \"pay all year, get most of it back\" is two numbers instead of one ambiguous figure — with Tax paid / Refunded / Net tax on the year, and a warning when a refund is recorded without the tax paid alongside it. Progress is read off the country rows rather than ticked separately, with a Not-liable flag for countries listed but not owed. Amounts can be typed in DKK and are stored in EUR." },
  { version: "2.3.0", summary: "Removed the A1 certificate / S1 form / blue insurance card checks from a tax year — no health-insurance paperwork tracking. Progress is now just the four tax completion checks." },
  { version: "2.2.0", summary: "Income year is gone — a year is named by its tax year alone. The Tax years list drops its headline figure bar and the Refunded from DK and Balance columns; both figures still live on each year's own page. New on that page: a flow diagram showing gross income splitting into what you kept and the tax paid in each country." },
  { version: "2.1.0", summary: "Visual rework. Figures are set in a monospace so money lines up on the digit, page titles in a serif, and summary numbers sit in one hairline-divided band instead of a row of cards — which is what made the leftmost figure sit higher than the rest. Fixed checkbox labels being shoved to the far edge of their box, unified the section-heading sizes, and rebuilt Correspondence as stacked entries so a real note no longer clips. Adding a payslip moved into a dialog behind a + button on the Monthly log, with a manual-entry tab." },
  { version: "2.0.0", summary: "Rebuilt around the real spreadsheet model. A tax year now has ONE gross income (the Danish salary) instead of summing per-country income — which double-counted the same salary taxed in several places — plus \"Refunded from Denmark\" as its own figure. Balance (refunded − tax paid), Net income and effective rate are derived from those, matching the spreadsheet's own numbers exactly. Countries carry their own Questionnaire/Filed/Payed flags and a comment. Income and Payslips merged into one page." },
];
