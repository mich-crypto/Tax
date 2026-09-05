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

- **Tax Tracker** (`index.html`) — an **All years** dashboard sits above
  the year picker: every tax year at a glance (completion status,
  Income €, Tax €, Refunded €, Net tax €, Net tax rate) with an **Open**
  button per row, updating live as you edit anything below. Pick (or
  create) a tax year — one record per income-year/tax-year pair, e.g.
  "income 2025 / tax year 2026" — then switch between three tabs, all
  scoped to that year:
  - **Overview** — a 4-item completion checklist (year completed,
    questionnaires done, returns filed, paid & returned), the per-country
    income/tax summary table with totals, and a payment-activity ledger
    (action, date, amount, currency, country). The summary table nets
    "Refund received" activities against each country's Tax € — for a
    country that withholds tax all year and refunds part of it back
    (Denmark, for one), Refunded €/Net tax €/Net tax rate reflect what
    you actually end up paying. A refund logged in a currency other than
    EUR (e.g. DKK) converts using the exchange rate set on the **Income**
    page — if that currency has no rate set yet, it's flagged rather
    than silently dropped.
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
- **Income** (`income.html`) — an **Overview** card up top pulls Gross
  pay, Net pay, and Tax withheld straight from **Payslips** (not
  duplicated as manual entries), adds an "Other income" row totaling
  whatever's logged manually below, and a "Total income" row combining
  the two — all converted to EUR (your home currency) for the selected
  year, next to the same figures for the year before with a change badge
  (New/+X%/−X%). A row missing an exchange rate is flagged and excluded
  rather than silently wrong. Set each currency's rate ("1 EUR = ? DKK")
  in the **Exchange rates** card right below — only currencies actually
  used in Payslips or logged income show up there. Below that,
  add/remove manually-logged income entries (date, country, category,
  currency, amount, description) — for anything that isn't on a
  payslip — and filter them by year.
- **Payslips** (`payslips.html`) — **bulk upload**: pick one or more
  payslip files (image or PDF) and Google Gemini reads gross pay, net
  pay, and tax withheld off each one, saving it automatically — no
  per-file review, so check the monthly log afterwards and fix anything
  AI got wrong (works fine for a single file too, so there's no separate
  one-at-a-time form). No Country/Employer fields — that's assumed to be
  the same every time, so it isn't tracked. A **Type** selector (Salary /
  Holiday pay) applies to each batch — upload the once-a-year holiday
  pay ("feriepenge") payout separately from monthly salary payslips and
  it's tagged and shown distinctly in the log, with a note on the yearly
  summary for how much of the year's total was holiday pay. A **missing
  months** strip shows which months of the selected year have no salary
  payslip logged yet (holiday pay doesn't count toward that, since it
  isn't expected every month). Needs a Gemini API key, set once under
  Settings.
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

## Deploying on Cloudflare Pages

There's no build step, so the whole repo root is the publish directory
(`.`), with no build command. Two ways to deploy:

- **Dashboard Git integration (simplest)** — in the Cloudflare dashboard,
  Workers & Pages → Create → Pages → Connect to Git, pick this repo, leave
  the build command empty, set the output directory to `/`, and deploy.
  Every push to the connected branch redeploys automatically; no secrets
  needed.
- **GitHub Actions** (`.github/workflows/deploy.yml`) — deploys on every
  push to `main` using
  [`cloudflare/pages-action`](https://github.com/cloudflare/pages-action).
  Create a Cloudflare Pages project named `tax-tracker` (or edit
  `projectName` in the workflow to match), then add these repo secrets:
  - `CLOUDFLARE_API_TOKEN` — a token with the "Cloudflare Pages — Edit"
    permission.
  - `CLOUDFLARE_ACCOUNT_ID` — found on the right sidebar of any page in the
    Cloudflare dashboard.

- **`wrangler` CLI**, if you'd rather deploy from your own machine:
  ```sh
  npx wrangler pages deploy .
  ```
  (`wrangler.toml` already points it at the repo root; it'll prompt to
  create the `tax-tracker` project on first run.)

Since this app only reads/writes `localStorage` and calls the Gemini API
directly from the browser, no environment variables or server-side secrets
are needed for the deploy itself.
