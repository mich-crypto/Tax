/**
 * Thin localStorage-backed data layer. Everything lives entirely in the
 * browser — nothing is sent anywhere. Every page includes this before its
 * own script.
 *
 * The tax-year shape mirrors the spreadsheet this app replaces:
 *   - ONE gross income for the year (the Danish payroll salary). Countries
 *     don't each add income — the same salary is taxed in several places,
 *     so summing per-country income would double-count it.
 *   - Refunded from Denmark is its own field (money coming back).
 *   - Each country row carries the tax actually paid there, plus that
 *     country's own progress flags.
 * Everything else (balance, net income, effective rate) is derived — see
 * taxYearTotals() in app.js.
 */

const STORAGE_KEYS = {
  // v2: reshaped around gross income + refund + per-country tax (see above).
  taxYears: "taxtracker_taxyears_v2",
  payslips: "taxtracker_payslips_v1",
  currencyRates: "taxtracker_currency_rates_v1",
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

const Store = {
  // ---------- Tax years ----------

  getTaxYears() {
    return readJSON(STORAGE_KEYS.taxYears, []);
  },

  saveTaxYears(years) {
    writeJSON(STORAGE_KEYS.taxYears, years);
  },

  /** Newest tax year first. */
  sortTaxYears(years) {
    years.sort((a, b) => b.taxYear - a.taxYear || b.incomeYear - a.incomeYear);
    return years;
  },

  getTaxYearById(id) {
    return this.getTaxYears().find((y) => y.id === id) || null;
  },

  blankTaxYear(incomeYear, taxYear) {
    return {
      id: uid(),
      incomeYear,
      taxYear,
      grossIncomeEur: 0,
      refundedFromDkEur: 0,
      status: {
        yearCompleted: false,
        questionnairesDone: false,
        returnsFiled: false,
        paidAndReturned: false,
      },
      forms: { a1: false, s1: false, blueCard: false },
      countries: [],
      payments: [],
      correspondence: [],
    };
  },

  /** Finds the record for this income-year/tax-year pair, creating a blank one if it doesn't exist. */
  ensureTaxYear(incomeYear, taxYear) {
    const years = this.getTaxYears();
    let record = years.find((y) => y.incomeYear === incomeYear && y.taxYear === taxYear);
    if (!record) {
      record = this.blankTaxYear(incomeYear, taxYear);
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

  /** Merges top-level fields (grossIncomeEur, refundedFromDkEur, status, forms...) into one record. */
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
      incomeEur: 0,
      taxEur: 0,
      questionnaireDone: false,
      returnFiled: false,
      paidReturned: false,
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
      schema: 2,
      taxYears: this.getTaxYears(),
      payslips: this.getPayslips(),
      currencyRates: this.getCurrencyRates(),
    };
  },

  importAll(data) {
    if (data.taxYears) this.saveTaxYears(data.taxYears);
    if (data.payslips) this.savePayslips(data.payslips);
    if (data.currencyRates) this.saveCurrencyRates(data.currencyRates);
  },

  wipeAll() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
