# Multi-Country Tax Tracker

A static, client-only site for tracking income and physical-presence days
across multiple countries, with rough estimated tax liability per country.

No build step, no server, no database — open `index.html` in a browser or
serve the folder with any static file host. All data is kept in the
browser's `localStorage`; nothing is sent anywhere.

## Pages

- **Dashboard** (`index.html`) — per-country summary for a selected tax
  year: total income logged, estimated tax, effective rate, and progress
  toward that country's residency-day threshold.
- **Income** (`income.html`) — add/remove income entries (date, country,
  category, amount, description) and filter them by year.
- **Payslips** (`payslips.html`) — upload a monthly payslip (image or PDF)
  and have Claude read gross pay, net pay, and tax withheld off it (bring
  your own API key — see below), or type the figures in by hand. Builds a
  month-by-month history per country with a yearly summary.
- **Tax Years** (`tax-years.html`) — pick a tax year and record what you
  actually declared: income, tax paid, and tax refunded in Denmark, plus a
  running list of tax payments made abroad (funded by that refund). Meant
  for actual filed/paid amounts, distinct from the Dashboard's automatic
  bracket-based estimates.
- **Residency** (`residency.html`) — log date ranges spent in each country
  and see running day totals against a configurable threshold (defaults to
  183 days, the day count commonly used for tax-residency tests).
- **Correspondence** (`correspondence.html`) — a log of communication with
  accountants/advisors (e.g. KPMG) and tax authorities: date, counterparty,
  channel (call/email/letter/meeting), category (question, document
  request, tax return filed, refund notice, assessment...), subject, notes,
  an optional amount (e.g. a confirmed refund), a follow-up date, and an
  open/resolved status.
- **Countries** (`countries.html`) — add, edit, or delete countries: name,
  currency, residency threshold, and progressive tax brackets. Also export
  all data to a JSON file, import it back, or wipe everything.

## Data & calculations

- `js/tax-data.js` ships simplified, illustrative national/federal tax
  brackets for Denmark, the US, UK, Germany, Canada, Australia, and France
  (single filer, one recent tax year, no state/provincial/municipal tax,
  deductions, or credits — Denmark's is a particularly rough blend of
  AM-bidrag + municipal + state tax). Edit or replace these on the
  Countries page — they are meant as a rough starting point, not
  authoritative figures.
- `js/tax-calc.js` applies those brackets progressively (marginal-rate
  calculation) to estimate tax and effective rate on logged income.
- `js/storage.js` is the only place that touches `localStorage`.
- `js/claude-vision.js` calls the Claude API
  (`https://api.anthropic.com/v1/messages`) directly from the browser to
  analyze an uploaded payslip, using vision for images and native PDF
  support for PDFs. Your API key (from
  [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys))
  is entered on the Payslips page and saved only in `localStorage`, under
  a key that `Store.exportAll()`/`importAll()` deliberately never touch —
  it can never end up inside an export/backup JSON file. The payslip file
  itself is sent straight to Anthropic for analysis and is not stored by
  this app; only the figures you review and save afterward are kept.
  Requests set the `anthropic-dangerous-direct-browser-access` header
  (the same opt-in the official SDK's `dangerouslyAllowBrowser` flag
  sets) since the API otherwise blocks browser-origin calls — that name
  is a real warning: anyone with access to this browser's storage can
  read the key, so set a spend limit on it if your account supports one.

## Disclaimer

This tool produces rough, unofficial estimates for personal tracking. It
is **not tax advice**. Verify real figures with an official source or a
qualified tax professional before relying on them, especially for
residency-day rules, which vary by country and can depend on more than a
simple day count.

## Development

Everything is plain HTML/CSS/JS — no dependencies, no build step. Edit the
files directly and refresh the page.
