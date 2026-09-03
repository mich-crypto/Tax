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
- **Residency** (`residency.html`) — log date ranges spent in each country
  and see running day totals against a configurable threshold (defaults to
  183 days, the day count commonly used for tax-residency tests).
- **Correspondence** (`correspondence.html`) — a log of communication with
  accountants/advisors (e.g. KPMG) and tax authorities: date, counterparty,
  channel (call/email/letter/meeting), subject, notes, an optional
  follow-up date, and an open/resolved status.
- **Countries** (`countries.html`) — add, edit, or delete countries: name,
  currency, residency threshold, and progressive tax brackets. Also export
  all data to a JSON file, import it back, or wipe everything.

## Data & calculations

- `js/tax-data.js` ships simplified, illustrative national/federal tax
  brackets for the US, UK, Germany, Canada, Australia, and France (single
  filer, one recent tax year, no state/provincial tax, deductions, or
  credits). Edit or replace these on the Countries page — they are meant
  as a rough starting point, not authoritative figures.
- `js/tax-calc.js` applies those brackets progressively (marginal-rate
  calculation) to estimate tax and effective rate on logged income.
- `js/storage.js` is the only place that touches `localStorage`.

## Disclaimer

This tool produces rough, unofficial estimates for personal tracking. It
is **not tax advice**. Verify real figures with an official source or a
qualified tax professional before relying on them, especially for
residency-day rules, which vary by country and can depend on more than a
simple day count.

## Development

Everything is plain HTML/CSS/JS — no dependencies, no build step. Edit the
files directly and refresh the page.
