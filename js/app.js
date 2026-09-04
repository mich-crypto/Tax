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
 *   taxPaid   sum of tax actually paid, across every country
 *   refunded  what Denmark paid back
 *   balance   refunded − taxPaid → positive = ahead, negative = short
 *   netIncome gross − taxPaid
 *   rate      taxPaid / gross
 */
function taxYearTotals(record) {
  const gross = Number(record.grossIncomeEur) || 0;
  const refunded = Number(record.refundedFromDkEur) || 0;
  const taxPaid = (record.countries || []).reduce((sum, c) => sum + (Number(c.taxEur) || 0), 0);
  return {
    gross,
    refunded,
    taxPaid,
    balance: refunded - taxPaid,
    netIncome: gross - taxPaid,
    rate: gross ? taxPaid / gross : 0,
  };
}

/** How many of the four completion checks are ticked. */
function statusProgress(record) {
  const done = TAX_YEAR_STATUS_FIELDS.filter((f) => record.status && record.status[f.key]).length;
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
