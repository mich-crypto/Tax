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

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      countries: this.getCountries(),
      income: this.getIncome(),
      residency: this.getResidency(),
      correspondence: this.getCorrespondence(),
    };
  },

  importAll(data) {
    if (data.countries) this.saveCountries(data.countries);
    if (data.income) this.saveIncome(data.income);
    if (data.residency) this.saveResidency(data.residency);
    if (data.correspondence) this.saveCorrespondence(data.correspondence);
  },

  wipeAll() {
    localStorage.removeItem(STORAGE_KEYS.countries);
    localStorage.removeItem(STORAGE_KEYS.income);
    localStorage.removeItem(STORAGE_KEYS.residency);
    localStorage.removeItem(STORAGE_KEYS.correspondence);
  },
};
