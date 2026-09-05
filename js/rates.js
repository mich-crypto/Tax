/**
 * Exchange rates from the European Central Bank, via Frankfurter
 * (frankfurter.dev) — a free, key-less proxy for the ECB's published
 * reference rates. Rates are quoted as "1 EUR = ? X", which is the same
 * direction this app stores them in.
 *
 * Two things worth knowing before relying on a fetched number:
 *  - The ECB publishes on working days only, so "today" may be Friday's
 *    rate on a Sunday. The API returns the date it actually used.
 *  - Tax authorities usually want a specific published rate or a yearly
 *    average, not whatever today's is — hence fetchYearAverageRates().
 *
 * The call goes straight from the browser to the ECB proxy; there's no
 * server in between and nothing about you is sent.
 */

const RATES_API = "https://api.frankfurter.dev/v1";

/** Currencies to ask for — everything the app offers except EUR itself. */
function ratesSymbols() {
  return CURRENCIES.map((c) => c.code).filter((code) => code !== "EUR").join(",");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The rate service answered ${response.status}. Try again in a moment.`);
  }
  return response.json();
}

/** The most recent published ECB rates: { date, rates: { DKK: 7.46, ... } }. */
async function fetchLatestRates() {
  const data = await fetchJson(`${RATES_API}/latest?base=EUR&symbols=${ratesSymbols()}`);
  if (!data || !data.rates) throw new Error("The rate service returned something unexpected.");
  return { date: data.date, rates: data.rates };
}

/**
 * The average of every rate the ECB published in a calendar year — the
 * figure most tax authorities expect for converting a year's income.
 */
async function fetchYearAverageRates(year) {
  const data = await fetchJson(
    `${RATES_API}/${year}-01-01..${year}-12-31?base=EUR&symbols=${ratesSymbols()}`
  );
  const days = (data && data.rates) || {};
  const dates = Object.keys(days);
  if (!dates.length) {
    throw new Error(`No published rates for ${year} yet.`);
  }

  const totals = {};
  const counts = {};
  dates.forEach((date) => {
    Object.entries(days[date]).forEach(([code, rate]) => {
      totals[code] = (totals[code] || 0) + rate;
      counts[code] = (counts[code] || 0) + 1;
    });
  });

  const rates = {};
  Object.keys(totals).forEach((code) => {
    rates[code] = Number((totals[code] / counts[code]).toFixed(6));
  });

  return { rates, days: dates.length, from: dates[0], to: dates[dates.length - 1] };
}
