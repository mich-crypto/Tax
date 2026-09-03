# Multi-Country Tax Tracker

A static, client-only site for tracking income, taxes, and payslips across
multiple countries.

No build step, no server, no database — open `index.html` in a browser or
serve the folder with any static file host. All data is kept in the
browser's `localStorage`; nothing is sent anywhere (except a payslip you
choose to analyze with AI — see below).

Every page's footer shows the current version (hover it for a few recent
highlights) — full history in [CHANGELOG.md](CHANGELOG.md).

## Two trackers, one header switcher

The site is split into two small apps, switchable from the dropdown under
the logo in the header:

- **Tax Tracker** — Dashboard, Tax Years, Correspondence.
- **Income Tracker** — Income, Payslips.

## Pages

- **Dashboard** (`index.html`, Tax Tracker home) — a summary built from Tax
  Years data: totals paid per country for a selected income year, a table
  of every tax-year record with its completion status, and the Data card
  (export/import/wipe — see below).
- **Tax Years** (`tax-years.html`) — one record per income-year/tax-year
  pair (e.g. "income 2025 / tax year 2026"): a 4-item completion checklist
  (year completed, questionnaires done, returns filed, paid & returned), a
  EUR→DKK reference rate with a small converter, an **Overview** tab (the
  per-country summary table, totals, a payment-activity ledger, and a
  free-form follow-up log) plus **one tab per country** you've paid tax in,
  each holding just that country's income and tax figures (in EUR). Add a
  country with the "+ Add" control — free text, so you're never blocked
  waiting on a managed country list.
- **Correspondence** (`correspondence.html`) — a log of communication with
  accountants/advisors (e.g. KPMG) and tax authorities: date, counterparty,
  channel (call/email/letter/meeting), category (question, document
  request, tax return filed, refund notice, assessment...), subject, notes,
  an optional amount (e.g. a confirmed refund), a follow-up date, and an
  open/resolved status.
- **Income** (`income.html`) — add/remove income entries (date, country,
  category, currency, amount, description) and filter them by year.
- **Payslips** (`payslips.html`) — upload a monthly payslip (image or PDF)
  and have Google Gemini read gross pay, net pay, and tax withheld off it
  (bring your own API key — see below), or type the figures in by hand.
  Also supports **bulk upload**: pick several files at once and each is
  analyzed and saved automatically (no per-file review — check the log
  afterwards). A **missing months** strip shows which months of the
  selected year have no payslip logged yet.

Countries and residency-day tracking are free-text fields, not managed
lists — type any country name (with suggestions) wherever one is needed.
There is no dedicated Countries or Residency page.

## Data & calculations

- `js/storage.js` is the only place that touches `localStorage`, and the
  only place `exportAll()`/`importAll()`/`wipeAll()` are defined (wired up
  from the Dashboard's Data card).
- `js/tax-data.js` holds shared reference data: suggested country names,
  a country → likely-currency hint map (convenience only, not a managed
  list), currencies, and the Correspondence/Tax Years constants.
- `js/gemini.js` calls the Gemini API directly from the browser to analyze
  an uploaded payslip. Your API key (from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) is
  entered on the Payslips page and saved only in `localStorage`, under a
  key that `Store.exportAll()`/`importAll()` deliberately never touch —
  it can never end up inside an export/backup JSON file. The payslip file
  itself is sent straight to Google for analysis and is not stored by this
  app; only the figures you review (or, in bulk upload, that AI extracts)
  are kept. Images are downscaled client-side to at most 1280px on their
  long edge before upload — a straight-from-the-phone photo is easily
  3000px+ on a side, and vision APIs generally cost more the higher the
  resolution, for no gain in legibility on a printed document. PDFs pass
  through unresized. Model defaults to `gemini-2.5-flash`, which is free of
  charge in Google AI Studio's standard tier as of this writing — check
  current limits/rates at
  [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing),
  since this changes over time.

## Disclaimer

This tool is for personal record-keeping. It is **not tax advice**. Verify
real figures with an official source or a qualified tax professional
before relying on them.

## Development

Everything is plain HTML/CSS/JS — no dependencies, no build step. Edit the
files directly and refresh the page.
