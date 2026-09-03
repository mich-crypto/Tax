/** Shared helpers used across every page. */

function formatMoney(amount, symbol) {
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function currentYear() {
  return new Date().getFullYear();
}

/** Days spanned by a start/end date pair, inclusive of both ends. */
function daysBetweenInclusive(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((end - start) / msPerDay) + 1;
  return diff > 0 ? diff : 0;
}

/** Days of [startDate, endDate] (inclusive) that fall within calendar `year`. */
function daysInYearOverlap(startDate, endDate, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const start = new Date(startDate);
  const end = new Date(endDate);

  const overlapStart = start > yearStart ? start : yearStart;
  const overlapEnd = end < yearEnd ? end : yearEnd;

  if (overlapStart > overlapEnd) return 0;
  return daysBetweenInclusive(overlapStart, overlapEnd);
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

/** Highlights the current page's link in the shared nav. */
function markActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll(".app-nav a").forEach((link) => {
    if (link.dataset.page === page) link.classList.add("active");
  });
}

/** Builds a <select> of years covering any data present, plus the current year. */
function collectYearsFromDates(dates) {
  const years = new Set([currentYear()]);
  dates.forEach((d) => {
    const y = new Date(d).getFullYear();
    if (!Number.isNaN(y)) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}

document.addEventListener("DOMContentLoaded", () => {
  markActiveNav();
  renderVersionFooter();
});
