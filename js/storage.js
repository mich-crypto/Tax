/**
 * Thin localStorage-backed data layer. Everything lives entirely in the
 * browser — nothing is sent anywhere. Every page includes this before its
 * own script.
 *
 * The tax-year shape mirrors the spreadsheet this app replaces:
 * A year is named by the year the income was EARNED — the 2025 tax year is
 * the money you earned in 2025, whenever the return for it gets filed.
 *
 *   - ONE gross income for the year (the Danish payroll salary). Countries
 *     don't each add income — the same salary is taxed in several places,
 *     so summing per-country income would double-count it.
 *   - Each country row carries the tax paid there AND how much of it came
 *     back, so "paid 43,119 in Denmark, 28,637 of it refunded" is one row
 *     rather than a single figure that can only mean one of the two.
 *   - That country's own progress flags live on the same row.
 * Everything else — the year's refund total, net tax, net income, rate and
 * its overall status — is derived from those rows. See taxYearTotals() and
 * taxYearStatus() in app.js.
 */

const STORAGE_KEYS = {
  // v3: years are labelled by the year the income was EARNED, not the year
  // the return was filed — see migrateTaxYears() below.
  taxYears: "taxtracker_taxyears_v3",
  taxYearsV2: "taxtracker_taxyears_v2",
  payslips: "taxtracker_payslips_v1",
  currencyRates: "taxtracker_currency_rates_v1",
  travel: "taxtracker_travel_v1",
  // Deliberately separate: never touched by exportAll/importAll, so an API
  // key can never end up inside a shared/exported JSON backup.
  geminiSettings: "taxtracker_gemini_settings_v1",
  claudeSettings: "taxtracker_claude_settings_v1",
  aiProvider: "taxtracker_ai_provider_v1",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage`, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write ${key} to localStorage`, e);
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Tax years used to be labelled by the year the return is FILED, so the
 * income earned in 2025 sat under "2026". They are labelled by the year the
 * income was earned now, which is how the returns are actually referred to.
 *
 * Runs once: it only reads v2 when v3 does not exist yet, and leaves v2
 * untouched as a fallback. A record already under v3 is never shifted again.
 */
function migrateTaxYears() {
  if (localStorage.getItem(STORAGE_KEYS.taxYears) !== null) return;
  const old = readJSON(STORAGE_KEYS.taxYearsV2, null);
  if (!old || !old.length) return;
  writeJSON(
    STORAGE_KEYS.taxYears,
    old.map((year) => ({ ...year, taxYear: Number(year.taxYear) - 1 }))
  );
}

/**
 * The year's gross income and every country figure used to be stored
 * already converted to EUR. They are kept
 * in the country's own currency now, so a corrected exchange rate restates
 * them. An older record is read forward here rather than rewritten, so an
 * export taken before the change still imports.
 */
function normalizeCountryRow(row) {
  if (row.currency !== undefined) return row;
  return {
    ...row,
    currency: "EUR",
    income: Number(row.incomeEur) || 0,
    tax: Number(row.taxEur) || 0,
    refunded: Number(row.refundedEur) || 0,
  };
}

function normalizeTaxYear(year) {
  const normalized = year.grossCurrency !== undefined
    ? year
    : { ...year, grossCurrency: "EUR", grossIncome: Number(year.grossIncomeEur) || 0 };
  if (!normalized.countries || !normalized.countries.length) return normalized;
  return { ...normalized, countries: normalized.countries.map(normalizeCountryRow) };
}

const Store = {
  // ---------- Tax years ----------

  getTaxYears() {
    migrateTaxYears();
    return readJSON(STORAGE_KEYS.taxYears, []).map(normalizeTaxYear);
  },

  saveTaxYears(years) {
    writeJSON(STORAGE_KEYS.taxYears, years);
  },

  /** Newest tax year first. */
  sortTaxYears(years) {
    years.sort((a, b) => b.taxYear - a.taxYear);
    return years;
  },

  getTaxYearById(id) {
    return this.getTaxYears().find((y) => y.id === id) || null;
  },

  blankTaxYear(taxYear) {
    return {
      id: uid(),
      taxYear,
      grossCurrency: "DKK",
      grossIncome: 0,
      countries: [],
      payments: [],
      correspondence: [],
    };
  },

  /** Finds the record for this tax year, creating a blank one if it doesn't exist. */
  ensureTaxYear(taxYear) {
    const years = this.getTaxYears();
    let record = years.find((y) => y.taxYear === taxYear);
    if (!record) {
      record = this.blankTaxYear(taxYear);
      years.push(record);
      this.saveTaxYears(this.sortTaxYears(years));
    }
    return record;
  },

  saveTaxYearRecord(record) {
    this.saveTaxYears(this.getTaxYears().map((y) => (y.id === record.id ? record : y)));
  },

  deleteTaxYearRecord(id) {
    this.saveTaxYears(this.getTaxYears().filter((y) => y.id !== id));
  },

  /** Merges top-level fields (grossIncome, grossCurrency...) into one record. */
  updateTaxYear(id, fields) {
    const record = this.getTaxYearById(id);
    if (!record) return;
    Object.assign(record, fields);
    this.saveTaxYearRecord(record);
  },

  // ---------- Countries within a tax year ----------

  blankCountryRow(country) {
    return {
      id: uid(),
      country,
      // Figures are stored in the country's OWN currency, with EUR derived
      // at the current rate — so correcting a rate restates the numbers
      // instead of leaving a stale conversion behind.
      currency: COUNTRY_CURRENCY_HINTS[(country || "").trim().toLowerCase()] || "EUR",
      income: 0,
      tax: 0,
      refunded: 0,
      questionnaireDone: false,
      returnFiled: false,
      paidReturned: false,
      // Listed for the record but nothing is owed there (Taiwan, here), so
      // it never gates the year's status.
      notLiable: false,
      comment: "",
    };
  },

  addCountryRow(taxYearId, row) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.countries.push({ ...this.blankCountryRow(""), ...row });
    this.saveTaxYearRecord(record);
  },

  updateCountryRow(taxYearId, rowId, changes) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    const row = record.countries.find((c) => c.id === rowId);
    if (!row) return;
    Object.assign(row, changes);
    this.saveTaxYearRecord(record);
  },

  deleteCountryRow(taxYearId, rowId) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.countries = record.countries.filter((c) => c.id !== rowId);
    this.saveTaxYearRecord(record);
  },

  // ---------- Payments ledger within a tax year ----------

  addPayment(taxYearId, payment) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    if (!record.payments) record.payments = [];
    record.payments.push({ id: uid(), ...payment });
    this.saveTaxYearRecord(record);
  },

  deletePayment(taxYearId, paymentId) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.payments = (record.payments || []).filter((p) => p.id !== paymentId);
    this.saveTaxYearRecord(record);
  },

  // ---------- Correspondence within a tax year ----------

  addCorrespondence(taxYearId, entry) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    if (!record.correspondence) record.correspondence = [];
    record.correspondence.push({ id: uid(), ...entry });
    this.saveTaxYearRecord(record);
  },

  updateCorrespondence(taxYearId, entryId, changes) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    const entry = (record.correspondence || []).find((e) => e.id === entryId);
    if (!entry) return;
    Object.assign(entry, changes);
    this.saveTaxYearRecord(record);
  },

  deleteCorrespondence(taxYearId, entryId) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.correspondence = (record.correspondence || []).filter((e) => e.id !== entryId);
    this.saveTaxYearRecord(record);
  },

  // ---------- Payslips ----------

  getPayslips() {
    return readJSON(STORAGE_KEYS.payslips, []);
  },

  savePayslips(entries) {
    writeJSON(STORAGE_KEYS.payslips, entries);
  },

  addPayslip(entry) {
    const entries = this.getPayslips();
    entries.push({ id: uid(), ...entry });
    this.savePayslips(entries);
  },

  deletePayslip(id) {
    const entries = this.getPayslips().filter((e) => e.id !== id);
    this.savePayslips(entries);
  },

  // ---------- Exchange rates ("1 EUR = ? [code]", e.g. { DKK: 7.4756 }) ----------

  getCurrencyRates() {
    return readJSON(STORAGE_KEYS.currencyRates, {});
  },

  saveCurrencyRates(rates) {
    writeJSON(STORAGE_KEYS.currencyRates, rates);
  },

  // ---------- Travel Tracker (year -> country -> activity -> days) ----------

  getTravel() {
    return readJSON(STORAGE_KEYS.travel, null);
  },

  saveTravel(travel) {
    writeJSON(STORAGE_KEYS.travel, travel);
  },

  clearTravel() {
    localStorage.removeItem(STORAGE_KEYS.travel);
  },

  // ---------- AI settings (never exported/imported/backed up) ----------

  getGeminiSettings() {
    return readJSON(STORAGE_KEYS.geminiSettings, { apiKey: "", model: GEMINI_DEFAULT_MODEL });
  },

  saveGeminiSettings(settings) {
    writeJSON(STORAGE_KEYS.geminiSettings, settings);
  },

  clearGeminiApiKey() {
    const settings = this.getGeminiSettings();
    settings.apiKey = "";
    this.saveGeminiSettings(settings);
  },

  getClaudeSettings() {
    return readJSON(STORAGE_KEYS.claudeSettings, { apiKey: "", model: CLAUDE_DEFAULT_MODEL });
  },

  saveClaudeSettings(settings) {
    writeJSON(STORAGE_KEYS.claudeSettings, settings);
  },

  clearClaudeApiKey() {
    const settings = this.getClaudeSettings();
    settings.apiKey = "";
    this.saveClaudeSettings(settings);
  },

  /** TEMPORARY (testing): "gemini" or "claude". Ships on Gemini — see js/claude-vision.js. */
  getAIProvider() {
    return readJSON(STORAGE_KEYS.aiProvider, "claude");
  },

  saveAIProvider(provider) {
    writeJSON(STORAGE_KEYS.aiProvider, provider);
  },

  // ---------- Backup ----------

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      schema: 3,
      taxYears: this.getTaxYears(),
      payslips: this.getPayslips(),
      currencyRates: this.getCurrencyRates(),
      travel: this.getTravel(),
    };
  },

  importAll(data) {
    if (data.taxYears) {
      // Exports before schema 3 numbered a year by when the return was
      // filed, one ahead of when the income was earned.
      const shift = (Number(data.schema) || 0) < 3 ? -1 : 0;
      this.saveTaxYears(
        shift
          ? data.taxYears.map((y) => ({ ...y, taxYear: Number(y.taxYear) + shift }))
          : data.taxYears
      );
    }
    if (data.payslips) this.savePayslips(data.payslips);
    if (data.currencyRates) this.saveCurrencyRates(data.currencyRates);
    if (data.travel) this.saveTravel(data.travel);
  },

  wipeAll() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
