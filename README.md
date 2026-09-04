# Multi-Country Tax Tracker

A static, client-only site for tracking tax across several countries, and
the payslips the income comes from.

No build step, no server, no database — open `index.html` in a browser or
serve the folder with any static file host. All data is kept in the
browser's `localStorage`; nothing is sent anywhere (except a payslip you
choose to analyze with AI — see below).

Every page's footer shows the current version (hover it for a few recent
highlights) — full history in [CHANGELOG.md](CHANGELOG.md).

## The model

The whole app hangs off one idea, so it's worth stating plainly:

**A tax year has one gross income.** That's the salary you actually
earned — a single Danish payroll figure. It is *not* the sum of the
country rows: the same salary is taxable in Belgium, the UK and the
Netherlands as well as Denmark, so adding those up counts it two or three
times over.

A year is identified by the year the income was **earned** — the 2025 tax
year is the money you earned in 2025, whenever the return for it is
actually filed. There is no separate income year to enter.

**Denmark withholds tax all year and refunds part of it back.** That
refund is the year's other headline figure, and it's what pays the tax
owed everywhere else. Everything else is derived from those two numbers
plus the tax on each country row — see `taxYearTotals()` in `js/app.js`:

| Figure | How it's derived |
| --- | --- |
| Gross income | sum of each country's `income`, converted to EUR |
| Tax paid (`taxPaid`) | sum of each country's `tax`, converted — everything handed over, before any of it came back |
| Refunded | sum of each country's `refunded`, converted — how much came back |
| Actual tax (`tax`) | `taxPaid − refunded` — what the year really cost, summed per country |
| Net income | gross − **`taxPaid`** (gross, not actual tax) |
| Effective rate | **`taxPaid`** ÷ gross (gross, not actual tax) |

Net income and the rate use **gross** tax paid (`taxPaid`), matching the
source spreadsheet's own definitions exactly — not netted against
refunds. The year page's own **"Tax paid" tile is the odd one out**: it
shows `tax` (actual tax, net of refunds) rather than `taxPaid`, so it
reads as what the year really cost — while Net income and the rate
alongside it keep the gross-`taxPaid` basis above. Tax returned is
reported on its own too (Denmark's, specifically, as its own headline
figure — that's the one country here that withholds all year and pays
part back) rather than folded into a single "final cost" figure.

There is no manual gross-income entry any more — every figure above comes
from the Countries table. That makes gross only as reliable as the rows
that feed it: summing taxable income across countries tells the truth
when each row is a genuine slice of the year (work done in Denmark,
Polish-source income, ...), and overstates it when a row repeats the
whole salary again. `incompleteRefunds()` still catches a refund recorded
with no matching paid figure; there is no equivalent check for a doubled
income row — a gross that looks too large or small for the year is the
sign to look at.

Nothing derived is ever stored, so the numbers can't drift out of sync
with what they're computed from.

## Two trackers plus Settings, all from the header

The site is split into two small apps, switchable from the dropdown under
the logo in the header, with a gear icon on the right for shared settings:

- **Tax Tracker** — `index.html` (all years) and `year.html` (one year).
- **Income Tracker** — `payslips.html`.
- **Settings** (`settings.html`) — reached via the ⚙ icon, not the app
  switcher, since it isn't part of either tracker.

## Pages

- **Tax years** (`index.html`) — the landing page: one row per tax year
  with gross income, tax paid, net income, effective rate and a progress
  badge, and a totals row underneath. Add a year by entering its tax
  year. The refund and the balance are deliberately not here — they're
  entered and derived on the year's own page.
- **One tax year** (`year.html?id=…`) — everything about a single year on
  one page, no tabs:
  - **The money** — one card, five figures, all calculated from the
    Countries table below: **Gross income** (sum of taxable income, every
    country), **Tax paid** (sum of **actual tax** — pre-paid tax minus
    tax return — every country, what the year really cost), **Net
    income** (gross minus gross pre-paid tax paid), **Tax rate** (gross
    pre-paid tax paid ÷ gross), and **Tax return from Denmark** (read
    from Denmark's own row). Nothing here is entered directly.
  - **Where the money went** — a flow diagram: the year's gross income on
    the left splitting into what you kept and the tax paid in each
    country on the right, sized to the real figures and redrawn as you
    edit them. Green is money kept, red is money out, matching the
    semantic colors used everywhere else.
  - **Progress** — the four completion checks (year completed,
    questionnaires done, returns prepared & filed, tax payed & returned),
    **read off the country rows** rather than ticked separately: a year is
    done when every country in it is. A country marked **N/A** — listed
    for the record but not liable there — sits the year out.
  - **Countries** — one editable row per country, each kept in **its own
    currency** (kroner for Denmark, złoty for Poland, ...) so the figures
    match the documents they come from: **Taxable income**, **Pre-paid
    tax** (everything handed over that year, before any of it came back),
    **Actual Tax** (what it really cost, editable straight off an
    assessment letter), and **Tax return** (how much came back). Actual
    Tax and Tax return are two views of the same fact — typing one solves
    the other backwards, holding Pre-paid tax fixed
    (`Tax return = Pre-paid tax − Actual Tax`); nothing is stored twice.
    Also its own Questionnaire / Return filed / Payed-returned flags, an
    **N/A** flag, and a free-text comment. A row's currency picker only
    offers EUR and that country's own currency, converted to EUR for the
    totals row at the rate under Settings. Country names are free text
    with suggestions — never blocked waiting on a managed list.
    **🤖 Analyze assessment**, next to "+ Add", opens a bulk uploader for
    tax assessment letters (a final-numbers document from a tax authority
    or accountant, not a payslip): AI reads each one's Taxable income and
    Actual Tax, shown for review with a Country row picker (including
    "+ New country…") before anything is applied — nothing is guessed at
    or saved automatically, since these are the two hard facts real
    assessment letters state. Needs an API key for whichever AI provider
    is active, set once under Settings, same as payslip analysis.
  - **Where you were** — days of presence and days worked per country for
    the calendar year this return covers, from the Travel Tracker report
    loaded under Settings. Hidden until a report is loaded. Transit days
    are excluded from presence, matching the report's own summary.
  - **Payments & refunds** — a dated ledger of what actually moved
    (action, date, amount, currency, country). Deliberately separate
    from the totals above, which are the year's final position rather
    than a running balance.
  - **Correspondence** — a log of communication with accountants
    (e.g. KPMG) and tax authorities for this year: date, counterparty,
    channel, category, subject, country, notes, an optional follow-up
    date, and an open/resolved toggle. The open count sits in the
    section header.
- **Payslips** (`payslips.html`) — the Income Tracker, a single page. A
  payslip can be marked **net pay only** (a checkbox on the manual entry
  form) when gross and tax withheld aren't known — those two show as
  **—** rather than `€0.00`, in the monthly log and in the Gross pay /
  Tax withheld tiles, so "not recorded" is never mistaken for "no tax was
  withheld". Net pay from a net-only entry still counts normally.
  Gross pay, net pay and tax withheld for the selected year in EUR,
  pulled from the payslips themselves and compared against the year
  before with a change badge. **Bulk upload**: pick one or more payslip
  files (image or PDF) and AI reads the figures off each one, saving it
  automatically — no per-file review, so check the monthly log
  afterwards and fix anything AI got wrong (works fine for a single file
  too, so there's no separate one-at-a-time form). No Country/Employer
  fields — that's the same every time, so it isn't tracked. A **Type**
  selector (Salary / Holiday pay) applies to each batch: upload the
  once-a-year holiday pay ("feriepenge") payout separately and it's
  tagged and shown distinctly, with a note on how much of the year's
  total it was. A **Coverage** strip shows which months of the year have
  no salary payslip logged yet (holiday pay doesn't count — it isn't
  expected every month). Needs an API key for whichever AI provider is
  active, set once under Settings.
- **Settings** (`settings.html`) — exchange rates (fetched from the ECB, or
  typed in), the **Travel Tracker** import, the AI provider and its API
  key/model, **Site lock**, and Export/Import/Wipe (plus an Excel backup
  — see [Data](#data) below). Shared across both trackers, so it lives
  outside either one. **Exchange rates** are set by hand ("1 EUR = ? DKK")
  — there's no live rate feed; a payslip in a currency with no rate set
  is flagged and excluded from the EUR figures
  rather than silently counted as zero. **Site lock** generates a
  password's SHA-256 hash for pasting into `js/site-lock.js`'s
  `SITE_LOCK_HASH` constant (see below) — Settings only prepares the
  hash, since flipping the switch means shipping that file, not writing
  to this browser's storage.

### Temporary: Claude vs. Gemini for payslip analysis

Payslip analysis can currently call **either** Google Gemini
(`js/gemini.js`) or Anthropic Claude (`js/claude-vision.js`), switchable
under Settings → **AI provider**. This exists for a one-off quality
comparison and currently defaults to Claude. **Gemini is what ships at
release** — before then, either switch the selector back to Gemini, or
remove the Claude path entirely (`js/claude-vision.js`, its `<script>` tag
on `payslips.html` and `year.html`, the Claude Settings card,
`Store.getClaudeSettings()`/`saveClaudeSettings()`/`clearClaudeApiKey()`,
`Store.getAIProvider()`/`saveAIProvider()`, and `CLAUDE_DEFAULT_MODEL`).
Both integrations take an optional `prompt` — payslip analysis passes
`GEMINI_EXTRACTION_PROMPT` (the default if omitted), the Countries table's
assessment analyzer passes `ASSESSMENT_EXTRACTION_PROMPT` — plus the same
downscaling helper, so results stay directly comparable across providers
regardless of which prompt is in use. Claude calls
`https://api.anthropic.com/v1/messages` directly from the browser with
the `anthropic-dangerous-direct-browser-access` header (Anthropic's own
opt-in for client-side calling) — same security model as Gemini: the key
lives only in `localStorage`, excluded from Export/Import.

## Site lock

`js/site-lock.js`, loaded first on every page, can show a password screen
before any page loads — off by default (`SITE_LOCK_HASH = ""`, meaning
nothing is asked). Settings → **Site lock** generates a password's
SHA-256 hash for you to paste into that constant; once set and deployed,
every visitor is asked for the password once per browser (a `localStorage`
flag remembers a correct entry until the password changes or storage is
cleared). This is a deterrent, not real security — there's no server here,
so the check ships as plain JavaScript anyone can read or attempt to
brute-force offline. For genuine access control, use your static host's
own gate instead (e.g. Netlify's site-wide password, under Site settings
→ Visitor access), which is enforced before any of this code is even sent
to a visitor's browser.

## Data

- `js/storage.js` is the only place that touches `localStorage`, and the
  only place `exportAll()`/`importAll()`/`wipeAll()` are defined (wired
  up from Settings). Countries, payments and correspondence all live
  inside their tax-year record — there are no separate top-level stores
  for them.
- **Export Excel backup** (`buildExcelWorkbook()` in `js/settings.js`,
  using [SheetJS](https://sheetjs.com)) writes a `.xlsx` with one sheet
  per tax year — the money (gross, actual tax, pre-paid tax, net income,
  rate, Denmark's tax return, the four completion checks), the Countries
  table, Payments & refunds, and Correspondence — plus one **Salary
  follow up** sheet for every payslip. This is a human-readable backup of
  last resort for when the site itself is unreachable and the JSON
  export (above) is all that's left; unlike that JSON file, it can't be
  read back in through Import.
- Tax years are stored under `taxtracker_taxyears_v3` and exports carry
  `schema: 3`. Data under the older `_v2` key is shifted down a year once,
  on first read, and an export from schema 2 or earlier is shifted on
  import — both because a year used to be numbered by when its return was
  filed. A v1 export will not import into this build.
- `js/tax-data.js` holds shared reference data: suggested country names,
  a country → likely-currency hint map (convenience only, not a managed
  list), currencies, and the payslip/status/correspondence constants.
- `js/gemini.js` calls the Gemini API directly from the browser to
  analyze an uploaded payslip (the shipped provider — see the Claude
  section above for the temporary alternative). Your API key (from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) is
  entered under Settings and saved only in `localStorage`, under a key
  that `Store.exportAll()`/`importAll()` deliberately never touch — it
  can never end up inside an export/backup JSON file. The payslip file
  itself is sent straight to the provider and is not stored by this app;
  only the figures AI extracts are kept. Images are downscaled
  client-side to at most 1280px on their long edge before upload — a
  straight-from-the-phone photo is easily 3000px+ on a side, and vision
  APIs generally cost more the higher the resolution, for no gain in
  legibility on a printed document. PDFs pass through unresized. Model
  defaults to `gemini-2.5-flash`, which is free of charge in Google AI
  Studio's standard tier as of this writing — check current limits and
  rates at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing),
  since this changes over time.

## Currencies

Every country's figures are stored in **that country's own currency** —
Denmark in DKK, Poland in PLN, Belgium in EUR — so they match the documents
they come from. Storing the converted euro instead would bake a wrong rate
in permanently; this way, correcting a rate restates every euro figure
derived from them: the countries totals, the money card, the year summary
and the flow diagram. A row shows one figure, in its own currency;
switching a row's currency converts it at the current rate, and is refused
if that currency has no rate set.

`js/rates.js` fetches ECB reference rates from
[Frankfurter](https://frankfurter.dev) — no key, straight from the browser,
nothing about you is sent. Two shapes: today's published rates, and the
average across a calendar year's publication days, which is generally what
a tax authority expects for converting a year's income. The ECB publishes
on working days only, so "today" can be Friday's rate on a Sunday; the
service reports the date it used. Hand-entered rates work exactly the same
and are the fallback wherever the request can't get out — an artifact
preview's sandbox blocks it, for one.

Dates are stored as `YYYY-MM-DD` and shown as `DD-MM-YYYY`. They are plain
text fields, not `<input type="date">`, because that control renders in the
browser's own locale and a page cannot override it — the same page would
show mm/dd/yyyy on one machine and dd/mm/yyyy on another.

## Travel Tracker

The Travel Tracker report's "Detailed" sheet is one row per day: date,
activity (Working / Not Working / On Vacation / Sick / In Transit) and
country. `js/travel.js` reads it in the browser with
[SheetJS](https://sheetjs.com) — loaded from cdnjs, pinned — and keeps
only the totals: year → country → activity → days. The daily rows are not
stored, and the file is never uploaded anywhere.

A day spent crossing a border appears twice, once per country, so transit
days are excluded from days-of-presence exactly as the report's own
summary does it. A tax year shows that same calendar year, since a year is
named for when the income was earned.

## Script load order

`js/site-lock.js` loads first of all, before anything else in `<head>` —
it needs to hide the page before it paints, if a site password is set (see
[Site lock](#site-lock) above). After that, every page loads, in this
order: `js/tax-data.js` (constants) → `js/storage.js` (the `Store`) →
`js/app.js` (shared helpers and the money model) → any AI scripts → that
page's own script. Nothing is a module and nothing is bundled, so the
order is what wires it together.

## Disclaimer

This tool is for personal record-keeping. It is **not tax advice**. Verify
real figures with an official source or a qualified tax professional
before relying on them.

## Development

Everything is plain HTML/CSS/JS — no dependencies, no build step. Edit the
files directly and refresh the page.
