/**
 * Travel Tracker import.
 *
 * The report's "Detailed" sheet is one row per day: date, activity
 * (Working / Not Working / On Vacation / Sick / In Transit) and the country
 * you were in. A day spent crossing a border appears twice, once per
 * country, which is why the report's own summary says its day-of-presence
 * counts exclude transit — this file follows that rule so the numbers here
 * match the ones your tax adviser is looking at.
 *
 * Only the totals are kept: year -> country -> activity -> days. That is all
 * the app shows, and it keeps two thousand rows of daily detail out of
 * localStorage.
 */

/** Counted as presence in a country? Transit days are in two countries at once. */
const TRAVEL_TRANSIT_ACTIVITY = "In Transit";

/** Activity order for display — the tax-relevant ones first. */
const TRAVEL_ACTIVITIES = ["Working", "Not Working", "On Vacation", "Sick", TRAVEL_TRANSIT_ACTIVITY];

/**
 * Reads a Travel Tracker .xlsx into { importedAt, fileName, from, to, years }.
 * Throws with a readable message when the file isn't that report.
 */
async function parseTravelWorkbook(file) {
  if (typeof XLSX === "undefined") {
    throw new Error("The spreadsheet reader didn't load — check your connection and reload the page.");
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = workbook.Sheets.Detailed;
  if (!sheet) {
    throw new Error('No "Detailed" sheet in that file — export the Travel Tracker report with its detailed rows included.');
  }

  // Row 3 is the header and row 4 a second header line, so the data starts
  // on row 5. Read positionally rather than by header name: the two-line
  // header means the useful column names ("Country") sit on row 4.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, raw: false, cellDates: true });

  const years = {};
  let from = null;
  let to = null;
  let counted = 0;

  rows.forEach((row) => {
    const date = new Date(row[1]);
    const activity = (row[3] || "").trim();
    const country = (row[5] || "").trim();
    if (Number.isNaN(date.getTime()) || !country || !activity) return;

    const year = date.getFullYear();
    if (!from || date < from) from = date;
    if (!to || date > to) to = date;

    if (!years[year]) years[year] = {};
    if (!years[year][country]) years[year][country] = {};
    years[year][country][activity] = (years[year][country][activity] || 0) + 1;
    counted += 1;
  });

  if (!counted) {
    throw new Error("That file has a Detailed sheet but no dated rows in it.");
  }

  return {
    importedAt: new Date().toISOString(),
    fileName: file.name,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    days: counted,
    years,
  };
}

/**
 * One year's travel, sorted with the country you spent most days in first.
 * `presence` excludes transit, matching the report's own summary.
 */
function travelYearSummary(travel, year) {
  const byCountry = (travel && travel.years && travel.years[year]) || null;
  if (!byCountry) return null;

  const countries = Object.keys(byCountry).map((country) => {
    const activities = byCountry[country];
    const total = Object.values(activities).reduce((sum, n) => sum + n, 0);
    const transit = activities[TRAVEL_TRANSIT_ACTIVITY] || 0;
    return {
      country,
      activities,
      transit,
      presence: total - transit,
      working: activities.Working || 0,
    };
  });

  countries.sort((a, b) => b.presence - a.presence || a.country.localeCompare(b.country));

  return {
    year,
    countries,
    totalPresence: countries.reduce((sum, c) => sum + c.presence, 0),
    totalWorking: countries.reduce((sum, c) => sum + c.working, 0),
  };
}

/** Years the import covers, newest first. */
function travelYears(travel) {
  if (!travel || !travel.years) return [];
  return Object.keys(travel.years).map(Number).sort((a, b) => b - a);
}
