/**
 * Thin localStorage-backed data layer. Everything lives entirely in the
 * browser — nothing is sent anywhere. Each tax tracker page includes this
 * before its own script.
 */

const STORAGE_KEYS = {
  countries: "taxtracker_countries_v1",
  income: "taxtracker_income_v1",
  residency: "taxtracker_residency_v1",
  correspondence: "taxtracker_correspondence_v1",
  taxYears: "taxtracker_taxyears_v1",
  payslips: "taxtracker_payslips_v1",
  // Deliberately separate from the rest: never touched by exportAll/importAll,
  // so a Claude API key can never end up inside a shared/exported JSON backup.
  claudeSettings: "taxtracker_claude_settings_v1",
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
  getCountries() {
    let countries = readJSON(STORAGE_KEYS.countries, null);
    if (!countries) {
      countries = JSON.parse(JSON.stringify(DEFAULT_COUNTRIES));
      writeJSON(STORAGE_KEYS.countries, countries);
    }
    return countries;
  },

  saveCountries(countries) {
    writeJSON(STORAGE_KEYS.countries, countries);
  },

  resetCountriesToDefaults() {
    const countries = JSON.parse(JSON.stringify(DEFAULT_COUNTRIES));
    writeJSON(STORAGE_KEYS.countries, countries);
    return countries;
  },

  getCountry(id) {
    return this.getCountries().find((c) => c.id === id) || null;
  },

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

  // ---------- Tax years (per-year Denmark refund vs. abroad payments) ----------

  getTaxYears() {
    return readJSON(STORAGE_KEYS.taxYears, []);
  },

  saveTaxYears(years) {
    writeJSON(STORAGE_KEYS.taxYears, years);
  },

  getTaxYear(year) {
    return this.getTaxYears().find((y) => y.year === year) || null;
  },

  /** Finds the record for `year`, creating a blank one if it doesn't exist yet, and merges `fields` into it. */
  upsertTaxYear(year, fields) {
    const years = this.getTaxYears();
    let record = years.find((y) => y.year === year);
    if (!record) {
      record = {
        id: uid(),
        year,
        denmarkIncome: 0,
        denmarkTaxPaid: 0,
        denmarkTaxRefund: 0,
        notes: "",
        abroadPayments: [],
      };
      years.push(record);
    }
    Object.assign(record, fields);
    years.sort((a, b) => b.year - a.year);
    this.saveTaxYears(years);
    return record;
  },

  deleteTaxYear(year) {
    this.saveTaxYears(this.getTaxYears().filter((y) => y.year !== year));
  },

  addAbroadPayment(year, payment) {
    const record = this.upsertTaxYear(year, {});
    record.abroadPayments.push({ id: uid(), ...payment });
    this.saveTaxYears(this.getTaxYears().map((y) => (y.year === year ? record : y)));
  },

  deleteAbroadPayment(year, paymentId) {
    const record = this.getTaxYear(year);
    if (!record) return;
    record.abroadPayments = record.abroadPayments.filter((p) => p.id !== paymentId);
    this.saveTaxYears(this.getTaxYears().map((y) => (y.year === year ? record : y)));
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

  // ---------- Claude API settings (never exported/imported/backed up) ----------

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

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      countries: this.getCountries(),
      income: this.getIncome(),
      residency: this.getResidency(),
      correspondence: this.getCorrespondence(),
      taxYears: this.getTaxYears(),
      payslips: this.getPayslips(),
    };
  },

  importAll(data) {
    if (data.countries) this.saveCountries(data.countries);
    if (data.income) this.saveIncome(data.income);
    if (data.residency) this.saveResidency(data.residency);
    if (data.correspondence) this.saveCorrespondence(data.correspondence);
    if (data.taxYears) this.saveTaxYears(data.taxYears);
    if (data.payslips) this.savePayslips(data.payslips);
  },

  wipeAll() {
    localStorage.removeItem(STORAGE_KEYS.countries);
    localStorage.removeItem(STORAGE_KEYS.income);
    localStorage.removeItem(STORAGE_KEYS.residency);
    localStorage.removeItem(STORAGE_KEYS.correspondence);
    localStorage.removeItem(STORAGE_KEYS.taxYears);
    localStorage.removeItem(STORAGE_KEYS.payslips);
    localStorage.removeItem(STORAGE_KEYS.claudeSettings);
  },
};
