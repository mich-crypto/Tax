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
 * The whole money model for one tax year, in one place.
 *
 *   gross     one salary for the year (Danish payroll) — NOT the sum of the
 *             country rows, since the same salary is taxed in several places
 *   taxPaid   tax handed over across every country, before any of it came back
 *   refunded  how much of that came back (Denmark refunds most of its own)
 *   netTax    taxPaid − refunded → what the year actually cost in tax
 *   netIncome gross − netTax → what you actually kept
 *   rate      netTax / gross
 *
 * Paid and refunded are tracked per country rather than as one figure,
 * because Denmark withholds tax all year and returns most of it: a single
 * number there can only ever mean one of the two.
 */
function taxYearTotals(record) {
  const gross = Number(record.grossIncomeEur) || 0;
  const countries = record.countries || [];
  const taxPaid = countries.reduce((sum, c) => sum + (Number(c.taxEur) || 0), 0);
  const refunded = countries.reduce((sum, c) => sum + (Number(c.refundedEur) || 0), 0);
  const netTax = taxPaid - refunded;
  return {
    gross,
    taxPaid,
    refunded,
    netTax,
    // Net income and the rate stay on GROSS tax paid, matching the
    // spreadsheet these figures come from. Netting the refund off them
    // would be wrong wherever a country's refund is recorded but the tax
    // paid there is not — Denmark, for most years — and would report a net
    // income ABOVE the gross salary. incompleteRefunds flags exactly that.
    netIncome: gross - taxPaid,
    rate: gross ? taxPaid / gross : 0,
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
    (c) => (Number(c.refundedEur) || 0) > (Number(c.taxEur) || 0)
  );
}

/** What one country's row actually cost: paid there, less what came back. */
function countryNetTax(row) {
  return (Number(row.taxEur) || 0) - (Number(row.refundedEur) || 0);
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
