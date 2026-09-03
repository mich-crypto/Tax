# Changelog

All notable changes to this site. Versions shown here match the footer
version tag on every page (hover it for the last few entries inline).

## v1.12.0 — 2026-09-03

- **Refund netting now handles non-EUR refunds.** It previously only
  netted refunds logged directly in EUR, flagging anything else. Now it
  converts using the same exchange rates you set on the Income page
  (Store's shared currency-rates, e.g. "1 EUR = 7.46 DKK") — a real DKK
  refund from Denmark nets correctly as long as that rate is set. A
  currency with no rate set yet is still flagged rather than silently
  dropped or miscounted.
- **New "All years" dashboard** on Tax Tracker, above the year picker:
  every tax year at a glance — completion status (X/4), Income €, Tax €,
  Refunded €, Net tax €, and Net tax rate, with a totals row and an
  **Open** button per row to jump straight into that year below. Updates
  live as you edit income/tax figures, log activities, or change status.

## v1.11.0 — 2026-09-03

- **Tax Tracker's country summary now nets refunds against tax paid.**
  Some countries (Denmark, for one) withhold tax all year and pay part
  of it back at year end — until now the summary table only showed the
  gross Tax € figure with no way to reflect that refund.
  - Log a "Refund received" payment activity (already existed) for a
    country and it's automatically subtracted from that country's tax.
  - New columns: **Refunded €** and **Net tax €**, plus **Net tax
    rate** (replaces the old Tax rate, now computed on the net figure).
  - Only refunds logged in EUR are netted — a refund logged in another
    currency (e.g. a DKK refund from Denmark) is flagged with a ⚠
    warning instead of being silently ignored or wrongly summed, since
    there's no exchange-rate mechanism on this page to convert it.

## v1.10.0 — 2026-09-03

- **Payslips: added holiday pay** ("feriepenge") as its own type,
  distinct from the recurring monthly salary payslip:
  - Bulk upload has a **Type** selector (Salary / Holiday pay),
    applied to that batch — upload your monthly payslips as Salary,
    then switch to Holiday pay and upload the once-a-year payout
    separately. Resets to Salary after each batch.
  - The monthly log has a **Type** column; Holiday pay rows carry a
    badge so they're easy to spot among regular salary rows.
  - The yearly summary notes how much of the year's gross total was
    holiday pay, e.g. "— includes €2,681.50 holiday pay (gross)".
  - Missing months no longer counts holiday pay as "logged" — it isn't
    expected every month, so it doesn't hide a genuinely missing
    salary payslip.
  - No changes needed on Income's Overview — holiday pay is still a
    payslip, so it's already included in Gross/Net/Tax and Total
    income there.

## v1.9.0 — 2026-09-03

- **Income's Overview now pulls from Payslips.** It previously
  duplicated data entry (per-country totals from manually logged Income
  entries only) with no link to the payslips you'd already uploaded.
  Now the Overview shows, for the selected year vs last year, all
  EUR-converted:
  - **Gross pay**, **Net pay**, and **Tax withheld** — summed directly
    from your Payslips log.
  - **Other income** — anything logged manually below (freelance, side
    income, etc.), kept separate from salary.
  - **Total income** — Payslips' net pay plus other income.
- The Exchange rates card now covers currencies used in Payslips too,
  not just manually logged Income entries.
- Manual Income entries and their table are unchanged — still there for
  anything that isn't on a payslip.

## v1.8.1 — 2026-09-03

- **Payslips: removed Country and Employer.** Same employer every time,
  so asking for it on every bulk upload (or showing it in every row) was
  pure noise:
  - Bulk upload no longer has Country/Employer fields.
  - The monthly log table no longer has Country/Employer columns.
  - "Yearly summary by country" is now just "Yearly summary" — one set
    of Gross/Net/Tax totals for the year, no per-country grouping.
  - AI-extracted country is still used internally to guess a currency
    when Gemini doesn't return one directly — just not stored or shown.

## v1.8.0 — 2026-09-03

- **Income gained an Overview card**: per-country totals for a selected
  year, all converted to your home currency (EUR), with a **Last year**
  column and a **Change** badge (New / +X% / −X%) comparing the two —
  plus a totals row.
- **New Exchange rates card** on the Income page: one "1 EUR = ? [code]"
  input per non-EUR currency you've actually logged income in (no
  live rate feed — you set these). Rates are saved and included in
  Settings' Export/Import backup.
- A country/year with entries in a currency that has no rate set yet is
  flagged (⚠) and excluded from that total, rather than silently
  under-counting it — set the rate and it's included immediately.

## v1.7.0 — 2026-09-03

- **New Settings page** (`settings.html`), reached via a ⚙ icon on the
  right of every page's header — separate from the Tax Tracker / Income
  Tracker switcher, since it isn't part of either tracker:
  - The Gemini API key and model, moved off the Payslips page.
  - Export/Import/Wipe, moved off Tax Tracker.
- **Removed the Currency converter** from Tax Tracker's Overview tab,
  along with the DKK columns it fed in the per-country summary table —
  the summary table is EUR-only now.
- **Payslips: removed the single-file "Add a payslip" form.** Bulk
  upload (which already worked fine with just one file selected) is now
  the only way to add a payslip — always AI-analyzed and auto-saved, no
  manual-entry-only path.
- **Header switcher is now a real interactive button** with a working
  dropdown (it was previously a clickable button on the live site, but
  the Artifact preview's own header — built separately from the real
  page markup — was still a static, non-interactive label; fixed).

## v1.6.0 — 2026-09-03

- **Tax Tracker merged into one page.** Dashboard, Tax Years, and
  Correspondence are no longer three separate nav pages — Tax Tracker is
  now a single flow: pick (or create) a tax year at the top, then switch
  between three tabs, all scoped to that year:
  - **Overview** — status checklist, EUR→DKK converter, per-country
    income/tax summary table with totals, and the payment-activity
    ledger.
  - **Tax information** — the per-country tabs where you enter income
    and tax figures (unchanged from v1.5.0's country tabs).
  - **Correspondence** — the full communication log (counterparty,
    channel, category, subject, country, notes, amount, follow-up date,
    status), now living inside the tax year it belongs to instead of one
    global, unscoped list.
- Retired the old flat, global Correspondence log and the lightweight
  "Tax follow up" log that used to sit in the Overview tab — Correspondence
  now covers that need directly, per tax year.
- Since Tax Tracker is one page, its header no longer shows a nav bar —
  the only way to leave it is the Tax Tracker / Income Tracker switcher
  under the logo.

## v1.5.0 — 2026-09-03

- **Split into two trackers**: Tax Tracker (Dashboard, Tax Years,
  Correspondence) and Income Tracker (Income, Payslips), switchable from
  a dropdown under the logo in the header — click it to jump between
  apps without hunting through one long nav bar.
- **Removed Residency and Countries.** Both were deprioritized for now:
  - Residency (day-count tracking) is gone entirely — planned for a
    later stage.
  - Countries (the managed list of countries/currencies/tax brackets) is
    gone, along with the Dashboard's bracket-based tax estimate that
    depended on it. Every country field across the site (Income,
    Payslips, Tax Years, Correspondence) is now free text with
    suggestions, so you're never blocked adding a country that wasn't
    pre-registered.
  - Export/Import/Wipe data controls moved from the old Countries page
    to a new "Data" card on the Dashboard.
- **Dashboard rebuilt** to summarize Tax Years data instead: totals paid
  per country for a selected income year, and a table of every tax-year
  record with its completion status.
- **Tax Years restructured**: instead of one flat table, pick a tax year
  and get an **Overview** tab (status checklist, EUR→DKK converter, the
  per-country summary table and totals, payment activities, follow-up
  log) plus **one tab per country** you've paid tax in, each holding just
  that country's income/tax figures. Add a country with free text — new
  countries start blank, no placeholder figures.
- **Payslips**: added **bulk upload** (pick several files at once; each
  is analyzed with AI and saved automatically, no per-file review) and a
  **missing months** tracker showing which months of the selected year
  have no payslip logged yet.

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
