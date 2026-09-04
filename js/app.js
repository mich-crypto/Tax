/** Shared helpers used across every page. */

function formatMoney(amount, symbol) {
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Money with an explicit +/- sign — for balances, where direction is the point. */
function formatSigned(amount, symbol) {
  const n = Number(amount) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${symbol}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(fraction) {
  return `${((Number(fraction) || 0) * 100).toFixed(1)}%`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function currentYear() {
  return new Date().getFullYear();
}

/**
 * The whole money model for one tax year, in one place — everything derived
 * from the country rows below it, nothing entered separately.
 *
 *   gross      sum of every country's taxable income, in EUR
 *   taxPaid    sum of pre-paid tax across every country, before any came back
 *   refunded   sum of tax returned across every country
 *   tax        taxPaid − refunded → what the year actually, finally cost
 *              (not the headline "Net income"/"Tax rate" driver — see below)
 *   netIncome  gross − taxPaid → income after what was withheld, before any
 *              of it comes back. Matches the source spreadsheet's own
 *              definition (verified against its "Net income" column) and
 *              what a payslip means by "net pay": withholding, not a later
 *              refund, is what nets against gross here.
 *   rate       taxPaid / gross, same reasoning — this is the figure the
 *              spreadsheet's own "tax rate" cells reproduce exactly.
 *
 * Pre-paid tax and tax returned are tracked per country rather than as one
 * figure, because Denmark withholds tax all year and returns most of it: a
 * single number there can only ever mean one of the two.
 *
 * Summing taxable income across countries only tells the truth when each
 * row holds a genuine SLICE of the year's income (work done in Denmark,
 * Polish-source income, ...) — a row that repeats the WHOLE salary again
 * inflates gross rather than reflecting it. incompleteRefunds() catches the
 * other half of that same problem (a refund recorded with no matching
 * pre-paid figure); there is no equivalent automatic check for a doubled
 * income row; it shows up as a gross that looks too large for the year.
 */
function taxYearTotals(record) {
  const countries = record.countries || [];
  const rates = Store.getCurrencyRates();

  // Each country holds its figures in its own currency; a country whose
  // rate isn't set is named rather than counted as zero.
  const missingRates = [];
  const eur = (amount, code) => {
    const value = toEur(amount, code, rates);
    if (value === null) {
      if (!missingRates.includes(code)) missingRates.push(code);
      return 0;
    }
    return value;
  };

  const gross = countries.reduce((sum, c) => sum + eur(c.income, c.currency), 0);
  const taxPaid = countries.reduce((sum, c) => sum + eur(c.tax, c.currency), 0);
  const refunded = countries.reduce((sum, c) => sum + eur(c.refunded, c.currency), 0);
  return {
    gross,
    taxPaid,
    refunded,
    tax: taxPaid - refunded,
    netIncome: gross - taxPaid,
    rate: gross ? taxPaid / gross : 0,
    missingRates,
  };
}

/**
 * Country rows refunding more than they record as paid. That is never real:
 * it means the tax paid in that country was never entered (Denmark withholds
 * all year and refunds part of it, and the source spreadsheet only ever
 * recorded the refund). Surfaced rather than silently netted.
 */
function incompleteRefunds(record) {
  return (record.countries || []).filter(
    (c) => (Number(c.refunded) || 0) > (Number(c.tax) || 0)
  );
}

/** What one country's row cost, in its own currency: paid less refunded. */
function countryNetTax(row) {
  return (Number(row.tax) || 0) - (Number(row.refunded) || 0);
}

/** A country row's figure in EUR, or null when its rate isn't set. */
function countryEur(row, field) {
  return toEur(row[field], row.currency, Store.getCurrencyRates());
}

/**
 * Denmark withholds tax all year through the employer and settles up with a
 * refund afterwards — a genuine "pre-paid, then partly returned" cycle.
 * Everywhere else in this model, what's assessed is simply what's paid: one
 * number, no separate advance-withholding phase. So Pre-paid tax and Actual
 * Tax mean the same thing for any other country, and only Denmark's row
 * treats them as independently meaningful (see the Actual Tax edit handler
 * in js/year.js).
 */
function isDenmarkRow(row) {
  return (row && row.country || "").trim().toLowerCase() === "denmark";
}

/** The Denmark row in a tax year, if one has been added — Denmark is the one country that withholds all year and refunds part of it back. */
function denmarkRow(record) {
  return (record.countries || []).find(isDenmarkRow) || null;
}

/**
 * A year's status, read off the country rows rather than kept as its own
 * set of checkboxes — a year is only done when every country in it is, so
 * ticking it separately just invites the two to disagree.
 */
function taxYearStatus(record) {
  // Only a row explicitly marked "not liable" sits the year out. Inferring
  // it from an empty row instead would report a year as done while a country
  // nobody has started on is still listed in it.
  const countries = (record.countries || []).filter((c) => !c.notLiable);
  const every = (key) => countries.length > 0 && countries.every((c) => c[key]);
  const questionnairesDone = every("questionnaireDone");
  const returnsFiled = every("returnFiled");
  const paidAndReturned = every("paidReturned");
  return {
    questionnairesDone,
    returnsFiled,
    paidAndReturned,
    yearCompleted: questionnairesDone && returnsFiled && paidAndReturned,
  };
}

/** How many of the four completion checks the country rows add up to. */
function statusProgress(record) {
  const status = taxYearStatus(record);
  const done = TAX_YEAR_STATUS_FIELDS.filter((f) => status[f.key]).length;
  return { done, total: TAX_YEAR_STATUS_FIELDS.length };
}

function yearLabel(record) {
  return `tax year ${record.taxYear}`;
}

/** Converts a local-currency amount to EUR using the saved rates ("1 EUR = ? code"). Null if the rate is unknown. */
function toEur(amount, currencyCode, rates) {
  if (!currencyCode || currencyCode === "EUR") return Number(amount) || 0;
  const rate = Number(rates[currencyCode]);
  if (!rate) return null;
  return (Number(amount) || 0) / rate;
}

/** EUR into a local currency ("1 EUR = ? code"). Null if the rate is unknown. */
function fromEur(amountEur, currencyCode, rates) {
  if (!currencyCode || currencyCode === "EUR") return Number(amountEur) || 0;
  const rate = Number(rates[currencyCode]);
  if (!rate) return null;
  return (Number(amountEur) || 0) * rate;
}

/** Builds a list of years covering any data present, plus the current year. */
function collectYearsFromDates(dates) {
  const years = new Set([currentYear()]);
  dates.forEach((d) => {
    const y = new Date(d).getFullYear();
    if (!Number.isNaN(y)) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}

/** Fills in the footer's version span, with recent changes as a hover tooltip. */
function renderVersionFooter() {
  const el = document.getElementById("app-version");
  if (!el || typeof APP_VERSION === "undefined") return;
  el.textContent = `v${APP_VERSION} (${APP_VERSION_DATE})`;
  if (typeof APP_CHANGELOG !== "undefined") {
    el.title = APP_CHANGELOG.map((e) => `v${e.version} — ${e.summary}`).join("\n");
  }
}




/**
 * Dates are STORED as YYYY-MM-DD (sortable, unambiguous) and SHOWN as
 * DD-MM-YYYY.
 *
 * These are plain text fields rather than <input type="date"> because that
 * control renders in the browser's own locale — the same page shows
 * mm/dd/yyyy on a US machine and dd/mm/yyyy on a Belgian one, and the page
 * cannot override it. Parsing it here is the only way the format is the
 * same for everyone.
 */
function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

/** Reads DD-MM-YYYY (also DD/MM/YYYY, and YYYY-MM-DD) into storage form. */
function parseDateInput(text) {
  const value = String(text || "").trim();
  if (!value) return "";

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) return isoOrEmpty(iso[1], iso[2], iso[3]);

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (dmy) return isoOrEmpty(dmy[3], dmy[2], dmy[1]);

  return "";
}

/** Builds YYYY-MM-DD, or "" if those parts aren't a real calendar date. */
function isoOrEmpty(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return "";
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today, in storage form. */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Confirmations and notices the page draws itself.
 *
 * window.confirm() and window.alert() are silently IGNORED wherever the page
 * is framed with a sandbox that omits "allow-modals" — the browser logs
 * "Ignored call to 'confirm()'" and the call returns undefined. Every
 * `if (!confirm(...)) return;` then bails out, so the delete never happens
 * and the button looks dead. A <dialog> is not covered by that restriction
 * and works in a sandboxed frame as well as on the deployed site.
 */

let confirmEl = null;

function ensureConfirmDialog() {
  if (confirmEl) return confirmEl;
  confirmEl = document.createElement("dialog");
  confirmEl.className = "confirm-sheet";
  confirmEl.innerHTML = `
    <p class="confirm-message"></p>
    <div class="confirm-actions">
      <button type="button" data-confirm-cancel>Cancel</button>
      <button type="button" class="danger-solid" data-confirm-ok>Delete</button>
    </div>`;
  document.body.appendChild(confirmEl);
  return confirmEl;
}

/** Resolves true if the viewer confirms, false on Cancel, Esc or a backdrop click. */
function confirmAction(message, confirmLabel = "Delete") {
  return new Promise((resolve) => {
    const el = ensureConfirmDialog();
    el.querySelector(".confirm-message").textContent = message;
    const ok = el.querySelector("[data-confirm-ok]");
    const cancel = el.querySelector("[data-confirm-cancel]");
    ok.textContent = confirmLabel;

    let settled = false;
    function finish(value) {
      if (settled) return;
      settled = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      el.removeEventListener("close", onClose);
      el.removeEventListener("click", onBackdrop);
      if (el.open) el.close();
      resolve(value);
    }
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onClose = () => finish(false);
    const onBackdrop = (event) => { if (event.target === el) finish(false); };

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    el.addEventListener("close", onClose);
    el.addEventListener("click", onBackdrop);
    el.showModal();
    cancel.focus();
  });
}

/** A brief message, in place of alert(). */
function notify(message) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("visible"), 3500);
}

/** Header dropdown: click the brand to switch between Tax Tracker and Income Tracker. */
function wireTrackerSwitcher() {
  const btn = document.getElementById("tracker-switch-btn");
  const menu = document.getElementById("tracker-switch-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !btn.contains(event.target)) {
      menu.hidden = true;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireTrackerSwitcher();
  renderVersionFooter();
});
