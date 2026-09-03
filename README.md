# Multi-Country Tax Tracker

A static, client-only site for tracking income, taxes, and payslips across
multiple countries.

No build step, no server, no database — open `index.html` in a browser or
serve the folder with any static file host. All data is kept in the
browser's `localStorage`; nothing is sent anywhere (except a payslip you
choose to analyze with AI — see below).

Every page's footer shows the current version (hover it for a few recent
highlights) — full history in [CHANGELOG.md](CHANGELOG.md).

## Two trackers plus Settings, all from the header

The site is split into two small apps, switchable from the dropdown under
the logo in the header, with a gear icon on the right of every page for
shared settings:

- **Tax Tracker** — a single page (`index.html`).
- **Income Tracker** — Income, Payslips.
- **Settings** (`settings.html`) — reached via the ⚙ icon, not the app
  switcher, since it isn't part of either tracker.

## Pages

- **Tax Tracker** (`index.html`) — pick (or create) a tax year — one
  record per income-year/tax-year pair, e.g. "income 2025 / tax year
  2026" — then switch between three tabs, all scoped to that year:
  - **Overview** — a 4-item completion checklist (year completed,
    questionnaires done, returns filed, paid & returned), the per-country
    income/tax summary table with totals, and a payment-activity ledger
    (action, date, amount, currency, country).
  - **Tax information** — **one tab per country** you've paid tax in,
    each holding just that country's income and tax figures (in EUR).
    Add a country with the "+ Add" control — free text, so you're never
    blocked waiting on a managed country list.
  - **Correspondence** — a log of communication with accountants/advisors
    (e.g. KPMG) and tax authorities for this tax year: date, counterparty,
    channel (call/email/letter/meeting), category (question, document
    request, tax return filed, refund notice, assessment...), subject,
    country, notes, an optional amount (e.g. a confirmed refund), a
    follow-up date, and an open/resolved status.

  Since it's a single page, its header has no nav bar — the Tax Tracker /
  Income Tracker switcher under the logo is the only way to leave it.
- **Income** (`income.html`) — add/remove income entries (date, country,
  category, currency, amount, description) and filter them by year.
- **Payslips** (`payslips.html`) — **bulk upload**: pick one or more
  payslip files (image or PDF) and Google Gemini reads gross pay, net
  pay, and tax withheld off each one, saving it automatically — no
  per-file review, so check the monthly log afterwards and fix anything
  AI got wrong (works fine for a single file too, so there's no separate
  one-at-a-time form). A **missing months** strip shows which months of
  the selected year have no payslip logged yet. Needs a Gemini API key,
  set once under Settings.
- **Settings** (`settings.html`) — the Gemini API key/model used by
  Payslips, and Export/Import/Wipe for all your data. Shared across both
  trackers, so it lives outside either one.

Countries and residency-day tracking are free-text fields, not managed
lists — type any country name (with suggestions) wherever one is needed.
There is no dedicated Countries or Residency page.

## Data & calculations

- `js/storage.js` is the only place that touches `localStorage`, and the
  only place `exportAll()`/`importAll()`/`wipeAll()` are defined (wired up
  from Settings). Correspondence lives inside each tax year record,
  alongside its countries and payment activities — not a separate
  top-level store.
- `js/tax-data.js` holds shared reference data: suggested country names,
  a country → likely-currency hint map (convenience only, not a managed
  list), currencies, and the Correspondence/Tax Years constants.
- `js/gemini.js` calls the Gemini API directly from the browser to analyze
  an uploaded payslip. Your API key (from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) is
  entered under Settings and saved only in `localStorage`, under a
  key that `Store.exportAll()`/`importAll()` deliberately never touch —
  it can never end up inside an export/backup JSON file. The payslip file
  itself is sent straight to Google for analysis and is not stored by this
  app; only the figures AI extracts are kept. Images are downscaled
  client-side to at most 1280px on their long edge before upload — a
  straight-from-the-phone photo is easily 3000px+ on a side, and vision
  APIs generally cost more the higher the resolution, for no gain in
  legibility on a printed document. PDFs pass through unresized. Model
  defaults to `gemini-2.5-flash`, which is free of charge in Google AI
  Studio's standard tier as of this writing — check current limits/rates
  at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing),
  since this changes over time.

## Disclaimer

This tool is for personal record-keeping. It is **not tax advice**. Verify
real figures with an official source or a qualified tax professional
before relying on them.

## Development

Everything is plain HTML/CSS/JS — no dependencies, no build step. Edit the
files directly and refresh the page.
