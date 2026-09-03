/**
 * Thin localStorage-backed data layer. Everything lives entirely in the
 * browser — nothing is sent anywhere. Each tax tracker page includes this
 * before its own script.
 */

const STORAGE_KEYS = {
  income: "taxtracker_income_v1",
  residency: "taxtracker_residency_v1",
  taxYears: "taxtracker_taxyears_v1",
  payslips: "taxtracker_payslips_v1",
  currencyRates: "taxtracker_currency_rates_v1",
  // Deliberately separate from the rest: never touched by exportAll/importAll,
  // so an API key can never end up inside a shared/exported JSON backup.
  geminiSettings: "taxtracker_gemini_settings_v1",
  // TEMPORARY (testing only — see js/claude-vision.js): Claude API settings,
  // same exclusion as geminiSettings.
  claudeSettings: "taxtracker_claude_settings_v1",
  // TEMPORARY (testing only): which provider Payslips' AI analysis calls —
  // "gemini" or "claude". Also excluded from export/import so a backup never
  // freezes in whichever provider happened to be selected for testing.
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
  getIncome() {
    return readJSON(STORAGE_KEYS.income, []);
  },

  saveIncome(entries) {
    writeJSON(STORAGE_KEYS.income, entries);
  },

  addIncome(entry) {
    const entries = this.getIncome();
    entries.push({ id: uid(), ...entry });
    this.saveIncome(entries);
  },

  deleteIncome(id) {
    const entries = this.getIncome().filter((e) => e.id !== id);
    this.saveIncome(entries);
  },

  // Exchange rates for converting logged income to EUR, keyed by currency
  // code, stored as "1 EUR = ? [code]" (e.g. { DKK: 7.46 }). You set these;
  // there's no live rate feed.
  getCurrencyRates() {
    return readJSON(STORAGE_KEYS.currencyRates, {});
  },

  saveCurrencyRates(rates) {
    writeJSON(STORAGE_KEYS.currencyRates, rates);
  },

  getResidency() {
    return readJSON(STORAGE_KEYS.residency, []);
  },

  saveResidency(entries) {
    writeJSON(STORAGE_KEYS.residency, entries);
  },

  addResidency(entry) {
    const entries = this.getResidency();
    entries.push({ id: uid(), ...entry });
    this.saveResidency(entries);
  },

  deleteResidency(id) {
    const entries = this.getResidency().filter((e) => e.id !== id);
    this.saveResidency(entries);
  },

  // ---------- Tax years (mirrors the income-year/tax-year spreadsheet workflow:
  // a status checklist, per-country income/tax, a payment-activity ledger, and
  // a correspondence log — all scoped to one income-year/tax-year pair, e.g.
  // "income 2025 / tax year 2026") ----------

  getTaxYears() {
    return readJSON(STORAGE_KEYS.taxYears, []);
  },

  saveTaxYears(years) {
    writeJSON(STORAGE_KEYS.taxYears, years);
  },

  getTaxYearById(id) {
    return this.getTaxYears().find((y) => y.id === id) || null;
  },

  findTaxYear(incomeYear, taxYear) {
    return this.getTaxYears().find((y) => y.incomeYear === incomeYear && y.taxYear === taxYear) || null;
  },

  sortTaxYears(years) {
    years.sort((a, b) => b.taxYear - a.taxYear || b.incomeYear - a.incomeYear);
    return years;
  },

  /** Finds the record for this income-year/tax-year pair, creating a blank one if it doesn't exist yet. */
  ensureTaxYear(incomeYear, taxYear) {
    const years = this.getTaxYears();
    let record = years.find((y) => y.incomeYear === incomeYear && y.taxYear === taxYear);
    if (!record) {
      record = {
        id: uid(),
        incomeYear,
        taxYear,
        status: {
          yearCompleted: false,
          questionnairesDone: false,
          returnsFiled: false,
          paidAndReturned: false,
        },
        countries: [],
        activities: [],
        correspondence: [],
      };
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

  updateTaxYearMeta(id, fields) {
    const record = this.getTaxYearById(id);
    if (!record) return;
    Object.assign(record, fields);
    this.saveTaxYearRecord(record);
  },

  addCountryRow(taxYearId, row) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.countries.push({ id: uid(), ...row });
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

  addTaxYearActivity(taxYearId, activity) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.activities.push({ id: uid(), ...activity });
    this.saveTaxYearRecord(record);
  },

  deleteTaxYearActivity(taxYearId, activityId) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.activities = record.activities.filter((a) => a.id !== activityId);
    this.saveTaxYearRecord(record);
  },

  addTaxYearCorrespondence(taxYearId, entry) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    if (!record.correspondence) record.correspondence = [];
    record.correspondence.push({ id: uid(), ...entry });
    this.saveTaxYearRecord(record);
  },

  updateTaxYearCorrespondence(taxYearId, entryId, changes) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    const entry = (record.correspondence || []).find((e) => e.id === entryId);
    if (!entry) return;
    Object.assign(entry, changes);
    this.saveTaxYearRecord(record);
  },

  deleteTaxYearCorrespondence(taxYearId, entryId) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.correspondence = (record.correspondence || []).filter((e) => e.id !== entryId);
    this.saveTaxYearRecord(record);
  },

  // ---------- Monthly payslips ----------

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

  // ---------- Gemini API settings (never exported/imported/backed up) ----------

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

  // ---------- TEMPORARY: Claude API settings (testing only — see
  // js/claude-vision.js; never exported/imported/backed up, same as Gemini's) ----------

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

  // TEMPORARY: which AI provider Payslips uses — "gemini" or "claude".
  // Defaults to "claude" for now, per the current test; switch back to
  // "gemini" (or delete this whole provider-toggle layer) before release.
  getAIProvider() {
    return readJSON(STORAGE_KEYS.aiProvider, "claude");
  },

  saveAIProvider(provider) {
    writeJSON(STORAGE_KEYS.aiProvider, provider);
  },

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      income: this.getIncome(),
      residency: this.getResidency(),
      taxYears: this.getTaxYears(),
      payslips: this.getPayslips(),
      currencyRates: this.getCurrencyRates(),
    };
  },

  importAll(data) {
    if (data.income) this.saveIncome(data.income);
    if (data.residency) this.saveResidency(data.residency);
    if (data.taxYears) this.saveTaxYears(data.taxYears);
    if (data.payslips) this.savePayslips(data.payslips);
    if (data.currencyRates) this.saveCurrencyRates(data.currencyRates);
  },

  wipeAll() {
    localStorage.removeItem(STORAGE_KEYS.income);
    localStorage.removeItem(STORAGE_KEYS.residency);
    localStorage.removeItem(STORAGE_KEYS.taxYears);
    localStorage.removeItem(STORAGE_KEYS.payslips);
    localStorage.removeItem(STORAGE_KEYS.geminiSettings);
    localStorage.removeItem(STORAGE_KEYS.currencyRates);
    localStorage.removeItem(STORAGE_KEYS.claudeSettings);
    localStorage.removeItem(STORAGE_KEYS.aiProvider);
  },
};
