/**
 * Thin localStorage-backed data layer. Everything lives entirely in the
 * browser — nothing is sent anywhere. Each tax tracker page includes this
 * before its own script.
 */

const STORAGE_KEYS = {
  income: "taxtracker_income_v1",
  residency: "taxtracker_residency_v1",
  correspondence: "taxtracker_correspondence_v1",
  taxYears: "taxtracker_taxyears_v1",
  payslips: "taxtracker_payslips_v1",
  // Deliberately separate from the rest: never touched by exportAll/importAll,
  // so a Gemini API key can never end up inside a shared/exported JSON backup.
  geminiSettings: "taxtracker_gemini_settings_v1",
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

  getCorrespondence() {
    return readJSON(STORAGE_KEYS.correspondence, []);
  },

  saveCorrespondence(entries) {
    writeJSON(STORAGE_KEYS.correspondence, entries);
  },

  addCorrespondence(entry) {
    const entries = this.getCorrespondence();
    entries.push({ id: uid(), ...entry });
    this.saveCorrespondence(entries);
  },

  updateCorrespondence(id, changes) {
    const entries = this.getCorrespondence();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, changes);
    this.saveCorrespondence(entries);
  },

  deleteCorrespondence(id) {
    const entries = this.getCorrespondence().filter((e) => e.id !== id);
    this.saveCorrespondence(entries);
  },

  // ---------- Tax years (mirrors the income-year/tax-year spreadsheet workflow:
  // a status checklist, a EUR->DKK reference rate, per-country income/tax/days,
  // a payment-activity ledger, and a follow-up log — all scoped to one
  // income-year/tax-year pair, e.g. "income 2025 / tax year 2026") ----------

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
        fxRateDkkPerEur: null,
        status: {
          yearCompleted: false,
          questionnairesDone: false,
          returnsFiled: false,
          paidAndReturned: false,
        },
        countries: [],
        activities: [],
        followUps: [],
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

  addTaxYearFollowUp(taxYearId, followUp) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.followUps.push({ id: uid(), ...followUp });
    this.saveTaxYearRecord(record);
  },

  deleteTaxYearFollowUp(taxYearId, followUpId) {
    const record = this.getTaxYearById(taxYearId);
    if (!record) return;
    record.followUps = record.followUps.filter((f) => f.id !== followUpId);
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

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      income: this.getIncome(),
      residency: this.getResidency(),
      correspondence: this.getCorrespondence(),
      taxYears: this.getTaxYears(),
      payslips: this.getPayslips(),
    };
  },

  importAll(data) {
    if (data.income) this.saveIncome(data.income);
    if (data.residency) this.saveResidency(data.residency);
    if (data.correspondence) this.saveCorrespondence(data.correspondence);
    if (data.taxYears) this.saveTaxYears(data.taxYears);
    if (data.payslips) this.savePayslips(data.payslips);
  },

  wipeAll() {
    localStorage.removeItem(STORAGE_KEYS.income);
    localStorage.removeItem(STORAGE_KEYS.residency);
    localStorage.removeItem(STORAGE_KEYS.correspondence);
    localStorage.removeItem(STORAGE_KEYS.taxYears);
    localStorage.removeItem(STORAGE_KEYS.payslips);
    localStorage.removeItem(STORAGE_KEYS.geminiSettings);
  },
};
