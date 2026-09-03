# Changelog

All notable changes to this site. Versions shown here match the footer
version tag on every page (hover it for the last few entries inline).

## v1.4.1 — 2026-09-03

- Tuned the Gemini payslip-extraction prompt against a real multi-page
  European payslip (Danish "lønseddel" with an accumulated year-to-date
  box repeated on every page, plus attached daily time-statement pages):
  - Explicitly ignores year-to-date boxes and time-sheet/attendance
    pages — extracts this pay period's figures only.
  - Correctly reads comma-decimal, period-thousands number formats
    (e.g. "39.371,08" → 39371.08).
  - Clarifies "tax withheld" as combined statutory tax + labor-market/
    social contribution, distinct from voluntary deductions.
- Payslips page now auto-fills Year, Month (from the extracted pay
  period's end date), and Country (matched from the extracted country
  name) after AI analysis — previously only currency/gross/net/tax/
  employer/notes were filled in, leaving three fields for you to set
  by hand every time.

## v1.4.0 — 2026-09-03

- **Tax Years rebuilt** around an income-year/tax-year pair (e.g. "income
  2025 / tax year 2026"), replacing the earlier Denmark-specific shape:
  - A 4-item completion checklist (year completed, questionnaires done,
    returns filed, paid & returned).
  - A EUR→DKK reference rate with a small live converter.
  - A unified per-country table — days worked, income and tax in EUR
    with a computed DKK column, tax rate, and % of total days, plus a
    totals row. Any country, not just Denmark + "abroad".
  - A payment-activity ledger (action, date, amount, currency, country).
  - A free-text follow-up log (topic, date, country).
- Added a version tracker: this file, plus a footer tag on every page.

## v1.3.0 — 2026-09-03

- Payslip AI analysis settled on Google Gemini (free tier available),
  after evaluating Claude API — Claude requires separate API billing
  from a Claude Pro subscription, which wasn't worth setting up for
  this.
- Images are downscaled client-side to at most 1280px on their long
  edge (re-encoded as JPEG) before upload — vision APIs generally cost
  more the higher the resolution, for no gain in legibility on a
  printed document. PDFs pass through unresized.
- Default model updated to `gemini-2.5-flash`.

## v1.2.0 — 2026-09-03

- Added **Payslips**: upload a monthly payslip (image or PDF) and have
  AI read gross pay, net pay, and tax withheld off it, or enter the
  figures by hand. Builds a month-by-month history per country with a
  yearly summary.
- Added **Tax Years** (first version): per-year Denmark income/tax/
  refund fields plus a list of tax payments made abroad.
- Added Denmark to the default countries, with a rough blended
  AM-bidrag + municipal + state tax bracket approximation.
- Correspondence gained a Category (question, document request, tax
  return filed, refund notice, assessment, general update) and an
  optional Amount + Currency.

## v1.1.0 — 2026-09-03

- Added **Correspondence**: a log of communication with accountants/
  advisors (e.g. KPMG) and tax authorities — date, counterparty,
  channel, subject, notes, an open/resolved status, and a follow-up
  date.

## v1.0.0 — 2026-09-03

- Initial release: **Dashboard** (per-country tax-year summary),
  **Income** (entries by country/category/year), **Residency**
  (date ranges vs. a configurable residency-day threshold), and
  **Countries** (manage countries, currencies, and simplified
  progressive tax brackets). Export/import/wipe all data as JSON.
