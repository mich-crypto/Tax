# Changelog

All notable changes to this site. Versions shown here match the footer
version tag on every page (hover it for the last few entries inline).

## v2.7.0 — 2026-09-04

- **Country figures are stored in the country's own currency.** Denmark in
  kroner, Poland in złoty, Belgium in euro, with the euro equivalent shown
  underneath each figure. They used to be converted to EUR on the way in,
  which meant a wrong exchange rate was baked in permanently; correcting a
  rate now restates every figure that depends on it. The table-wide
  "Amounts in" picker is replaced by a currency per row.
- **Rates can be fetched from the ECB** (via Frankfurter, no key, straight
  from the browser): today's published reference rates, or the average
  across a calendar year's publication days — the figure tax authorities
  generally expect for converting a year's income. Hand-entered rates
  still work, and are the fallback wherever the request can't get out.
  Every currency has a field now, not just the ones payslips use.
- **The money** card is euro throughout and reads: Gross income (entered),
  **Already payed taxes in DK**, **Actual taxes in DK**, **Tax return from
  DK** — the last three read from the Denmark row under Countries.
- **Dates are DD-MM-YYYY**, entered and displayed. They were
  `<input type="date">`, which renders in the browser's own locale — the
  same page showed mm/dd/yyyy on one machine and dd/mm/yyyy on another,
  and a page cannot override that. Stored as YYYY-MM-DD; a date that
  isn't real is refused rather than dropped.
- The flow diagram labels tax destinations **Tax <country>** so a band
  can't be mistaken for money kept.

## v2.6.0 — 2026-09-04

- **A tax year is named by the year the income was earned**, not the year
  the return is filed. What was showing as 2026 is the 2025 tax year.
  Every year shifts down by one.
- Existing data corrects itself: records under the old key are shifted
  once on first load and written to a new one, so it cannot run twice, and
  the old key is left in place as a fallback. A backup exported before
  this (schema 2 or earlier) is shifted on import; a new one is not.
- **Travel days now line up with the same year.** "Where you were" was
  reading the calendar year *before* the tax year to compensate for the
  old numbering; it reads the same year now.

## v2.5.0 — 2026-09-04

- **Travel Tracker import.** Settings takes your Travel Tracker report
  (.xlsx) and each tax year gains a **Where you were** card: days of
  presence and days worked per country for the calendar year that return
  covers. Day counts are what the residence and treaty thresholds turn
  on, so they belong next to the figures they drive.
- Transit days are excluded from days-of-presence, matching the report's
  own summary — a day spent crossing a border appears twice in the
  detailed sheet, once per country.
- Only the totals are kept (year → country → activity → days), not the
  two thousand daily rows. Settings shows a country-by-year matrix of
  what was loaded, and the import is included in Export/Import.
- The spreadsheet is read in your browser by SheetJS, loaded from a CDN;
  the file itself is never uploaded anywhere.

## v2.4.0 — 2026-09-04

- **A country records what it cost, not one ambiguous number.** Each row
  now has **Tax paid** (everything handed over that year), **Refunded**
  (how much came back) and a derived **Net**. Denmark withholds tax all
  year and returns most of it, so a single "tax" figure there could only
  ever mean one of the two — which is exactly what made the source
  spreadsheet's Denmark column flip meaning between years.
- **The year shows Tax paid / Refunded / Net tax** alongside net income
  and the effective rate. Net income and the rate still use *gross* tax
  paid, matching the spreadsheet, rather than netting the refund off.
- **A refund without a matching payment is flagged.** Where a country
  refunds more than it records as paid, the year says so: it means the
  tax paid there was never entered. Two of the imported years are in
  exactly that state.
- **Progress is derived, not ticked.** The four year-level checks are now
  read off the country rows — a year is done when every country in it is
  — instead of a second set of boxes that could disagree with them. A new
  **N/A** flag marks a country listed for the record but not liable
  (Taiwan), so it doesn't hold the year open.
- **Amounts can be typed in DKK.** "Enter in" beside gross income and
  "Amounts in" above the countries table convert on the way in and out;
  everything is still stored and reported in EUR, using the rate under
  Settings.
- Fixed `[hidden]` being overridden by any rule that sets `display`, which
  left elements on screen after they were hidden.

## v2.3.0 — 2026-09-04

- **Removed the social-security and insurance paperwork checks** (A1
  certificate, S1 form, blue insurance card) from a tax year. Progress is
  now just the four tax completion checks: year completed, questionnaires
  done, returns prepared & filed, tax payed & returned. `forms` is gone
  from the stored record and `TAX_YEAR_FORM_FIELDS` from `tax-data.js`;
  an older export carrying `forms` still imports, the field is just
  ignored.

## v2.2.0 — 2026-09-04

- **Income year removed.** A tax year is identified by its tax year alone —
  one field when adding a year, "2025" in the list rather than
  "Tax 2025 / income 2024", and no income year in the year page's
  subheading or in storage. In practice the income year was always the tax
  year minus one, so nothing is lost; if a year ever breaks that pattern it
  can come back as an optional field.
- **The Tax years list is leaner.** The headline figure bar is gone, along
  with the **Refunded from DK** and **Balance** columns. The list is now
  tax year, gross income, tax paid, net income, rate and progress. Both
  dropped figures still live on each year's own page, where the refund is
  entered and the balance is derived.
- **New: a flow diagram on each tax year.** "Where the money went" shows
  the year's gross income on the left splitting into what you kept and the
  tax paid in each country on the right, sized to the real figures and
  updating as you edit them. Green is money kept, red is money out — the
  same meaning those colors carry everywhere else in the app.

## v2.1.0 — 2026-09-04

A visual rework, and one new way in.

**Look**

- Figures across the whole site are set in IBM Plex Mono with tabular
  figures, so columns of money line up on the digit; page titles are set
  in IBM Plex Serif, closer to the documents this replaces. Palette moved
  off the default blue-on-grey to a petrol accent over cool paper
  neutrals, with green/red kept strictly for direction of travel (money
  back vs money out) rather than as decoration.

**Fixes**

- **Summary figures no longer misalign.** `.card + .card` gave every card
  after another a 16px top margin. A summary figure was itself a card, so
  the second, third and fourth in a row were pushed down while the first
  wasn't — the leftmost tile looked taller. They are now one band with
  hairline dividers between equal columns, so they align by construction.
- **Checkbox labels sat at the far edge of their box.** The blanket
  `input { width: 100% }` applied to checkboxes too, stretching each one
  across its container and pushing its label away. Checkboxes and radios
  now size to themselves.
- **Section headings were two different sizes** depending on whether they
  sat in a `.card-header` or a `.toolbar`. One rule now covers both.
- **Correspondence clipped.** Nine columns squeezed each other and cut off
  notes and subjects. Each entry is now a stacked block — subject first,
  then one metadata line — which cannot clip.
- Country rows show grouped figures at rest and the raw number when you
  focus one to type; the comment column takes whatever width is left over
  instead of scrolling inside a fixed box.

**Adding a payslip**

- The upload card is replaced by a **+ Add payslip** button on the Monthly
  log, opening a dialog with two tabs: read the figures off a file with
  AI, or **enter them manually** (year, month, type, currency, gross, net,
  tax, note). A manually entered row carries no AI tag, so it stays
  obvious which figures came from a document. The dialog opens set to the
  year in view and the first month with no salary payslip yet.

## v2.0.0 — 2026-09-03

Rebuilt around the model the real spreadsheet uses. The old layout summed
per-country income to get a year's total, and reported "Net tax" with the
sign flipped — both wrong, and both visible as soon as real figures went in.

**The money model**

- A tax year now has **one gross income** — the Danish payroll salary —
  instead of a sum over its countries. The same salary is taxed in
  Belgium, the UK and the Netherlands as well as Denmark, so adding the
  per-country figures counted it two or three times over (€252,610 for
  income 2022, against the real €135,157.55).
- **Refunded from Denmark** is its own figure on the year, not an entry
  buried in the payment ledger. Denmark withholds tax all year and pays
  part of it back; that refund is what covers the tax owed elsewhere, so
  it belongs next to the gross income.
- Everything else is derived from those, in one place
  (`taxYearTotals()` in `js/app.js`):
  - **Tax paid** — sum of the tax on each country row
  - **Balance** — refunded − tax paid; positive means the Danish refund
    covers what's owed elsewhere, negative means it falls short
  - **Net income** — gross − tax paid
  - **Effective rate** — tax paid ÷ gross

**Pages**

- **Tax years** (`index.html`) is now the landing page: four headline
  tiles (refunded from Denmark, tax paid elsewhere, balance, years still
  open) over one row per income year — gross, refunded, tax paid,
  balance, net income, rate and progress — with a totals row.
- **One page per tax year** (`year.html?id=…`), replacing the tab strip:
  the money, progress, countries, payments and correspondence, all in
  view at once. Country rows are edited inline and each carries its own
  Questionnaire / Return filed / Payed-returned flags and a comment.
- **A1 certificate, S1 form and blue insurance card** are tracked per
  year alongside the four completion checks.
- **Income and Payslips merged** into one page (`payslips.html`). The
  Income page's overview tiles now sit on top of the payslip log they
  were reading from, so there's no second page restating the same
  figures. `income.html` and `js/income.js` are gone, and the Income
  flow diagram with them.
- **Exchange rates moved to Settings**, since they're shared and the
  page they lived on no longer exists.

**Data**

- New storage key `taxtracker_taxyears_v2`; exports carry `schema: 2`.
  The old income and residency stores are dropped — neither had a UI
  any more. A v1 export will not import; export from the old build
  first if you need the raw JSON.

## v1.14.0 — 2026-09-03

- **Income flow diagram**: a small Sankey-style chart under Overview —
  gross pay splits into Net pay (kept) and Tax withheld, and Tax
  withheld itself splits into Refunded and Net tax (what actually
  stays with the tax authority). Pulls Gross/Net/Tax from Payslips and
  Refunded from the matching Tax Tracker year (same income year),
  same EUR conversion and missing-rate handling as the Overview table.
  No refund yet? It just shows Tax withheld flowing straight to Net tax.
- **TEMPORARY, testing only — reverts before release:** Payslips' AI
  analysis can now call Anthropic Claude instead of Google Gemini, to
  compare extraction quality. New **AI provider** selector under
  Settings (Gemini / Claude), plus a Claude API key/model card mirroring
  Gemini's. Currently defaults to Claude. To ship: switch the selector
  back to Gemini (or remove the whole provider-toggle layer —
  `js/claude-vision.js`, the Claude Store methods, and the provider
  selector — before release, since Gemini is the shipped provider).

## v1.13.0 — 2026-09-03

- **Removed the manual "Add income entry" form** and its Entries table
  from the Income page. Income's Overview is now purely Gross pay / Net
  pay / Tax withheld straight from Payslips, EUR-converted and compared
  against last year — no "Other income" row or separate manual log to
  keep in sync.
- `INCOME_CATEGORIES` (no longer used anywhere) removed from
  `tax-data.js`. `Store.getIncome()`/`addIncome()`/`deleteIncome()`
  stay in `storage.js` for backward compatibility with older exports,
  they're just not driven by any page UI now.

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
