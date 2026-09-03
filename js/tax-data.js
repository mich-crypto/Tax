/**
 * Default country tax data.
 *
 * IMPORTANT: These brackets are simplified, illustrative approximations of
 * national individual income tax schedules (single filer, national/federal
 * level only — no state/provincial, regional, social-security, or
 * surtax components, and no deductions/credits applied). They are meant
 * to give a rough order-of-magnitude estimate for personal tracking only.
 * This is NOT tax advice. Always confirm figures with an official source
 * or a qualified tax professional before relying on them.
 *
 * `brackets` is a list of { upTo, rate } pairs read in order: income up to
 * `upTo` (exclusive of the previous bracket's cap) is taxed at `rate`.
 * The last bracket uses `upTo: null` to mean "and above".
 */

const DEFAULT_COUNTRIES = [
  {
    id: "dk",
    name: "Denmark",
    currencyCode: "DKK",
    currencySymbol: "kr",
    residencyThresholdDays: 183,
    notes: "Very rough, blended approximation of AM-bidrag (8%) + municipal + state income tax for an average municipality (2024, single, no church tax, no personfradrag/deductions applied). Real Danish tax depends heavily on your municipality and personal allowances — treat this as a ballpark only.",
    brackets: [
      { upTo: 588900, rate: 0.38 },
      { upTo: null, rate: 0.56 },
    ],
  },
  {
    id: "us",
    name: "United States",
    currencyCode: "USD",
    currencySymbol: "$",
    residencyThresholdDays: 183,
    notes: "Federal income tax only (2024, single filer). State taxes not included.",
    brackets: [
      { upTo: 11600, rate: 0.10 },
      { upTo: 47150, rate: 0.12 },
      { upTo: 100525, rate: 0.22 },
      { upTo: 191950, rate: 0.24 },
      { upTo: 243725, rate: 0.32 },
      { upTo: 609350, rate: 0.35 },
      { upTo: null, rate: 0.37 },
    ],
  },
  {
    id: "uk",
    name: "United Kingdom",
    currencyCode: "GBP",
    currencySymbol: "£",
    residencyThresholdDays: 183,
    notes: "Income tax only (2024/25). Personal allowance ~£12,570 taxed at 0%.",
    brackets: [
      { upTo: 12570, rate: 0.0 },
      { upTo: 50270, rate: 0.20 },
      { upTo: 125140, rate: 0.40 },
      { upTo: null, rate: 0.45 },
    ],
  },
  {
    id: "de",
    name: "Germany",
    currencyCode: "EUR",
    currencySymbol: "€",
    residencyThresholdDays: 183,
    notes: "Simplified step approximation of the progressive Einkommensteuer schedule (2024). The real formula is continuous, not stepped.",
    brackets: [
      { upTo: 11604, rate: 0.0 },
      { upTo: 66760, rate: 0.24 },
      { upTo: 277825, rate: 0.42 },
      { upTo: null, rate: 0.45 },
    ],
  },
  {
    id: "ca",
    name: "Canada",
    currencyCode: "CAD",
    currencySymbol: "$",
    residencyThresholdDays: 183,
    notes: "Federal income tax only (2024). Provincial tax not included.",
    brackets: [
      { upTo: 55867, rate: 0.15 },
      { upTo: 111733, rate: 0.205 },
      { upTo: 173205, rate: 0.26 },
      { upTo: 246752, rate: 0.29 },
      { upTo: null, rate: 0.33 },
    ],
  },
  {
    id: "au",
    name: "Australia",
    currencyCode: "AUD",
    currencySymbol: "$",
    residencyThresholdDays: 183,
    notes: "Resident individual income tax (2024/25). Medicare levy not included.",
    brackets: [
      { upTo: 18200, rate: 0.0 },
      { upTo: 45000, rate: 0.16 },
      { upTo: 135000, rate: 0.30 },
      { upTo: 190000, rate: 0.37 },
      { upTo: null, rate: 0.45 },
    ],
  },
  {
    id: "fr",
    name: "France",
    currencyCode: "EUR",
    currencySymbol: "€",
    residencyThresholdDays: 183,
    notes: "Simplified single-share impôt sur le revenu schedule (2024).",
    brackets: [
      { upTo: 11294, rate: 0.0 },
      { upTo: 28797, rate: 0.11 },
      { upTo: 82341, rate: 0.30 },
      { upTo: 177106, rate: 0.41 },
      { upTo: null, rate: 0.45 },
    ],
  },
];

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
