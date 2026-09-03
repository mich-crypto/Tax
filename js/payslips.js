(function () {
  // --- Gemini settings ---
  const apiKeyInput = document.getElementById("gemini-api-key");
  const modelInput = document.getElementById("gemini-model");
  const toggleKeyBtn = document.getElementById("toggle-key-visibility");
  const saveSettingsBtn = document.getElementById("save-gemini-settings");
  const clearKeyBtn = document.getElementById("clear-gemini-key");
  const settingsStatus = document.getElementById("gemini-settings-status");

  function loadGeminiSettingsIntoForm() {
    const settings = Store.getGeminiSettings();
    apiKeyInput.value = settings.apiKey || "";
    modelInput.value = settings.model || GEMINI_DEFAULT_MODEL;
  }

  toggleKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  saveSettingsBtn.addEventListener("click", () => {
    Store.saveGeminiSettings({
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim() || GEMINI_DEFAULT_MODEL,
    });
    settingsStatus.textContent = "Saved.";
    setTimeout(() => { settingsStatus.textContent = ""; }, 2500);
  });

  clearKeyBtn.addEventListener("click", () => {
    Store.clearGeminiApiKey();
    apiKeyInput.value = "";
    settingsStatus.textContent = "API key cleared.";
    setTimeout(() => { settingsStatus.textContent = ""; }, 2500);
  });

  // --- Add-payslip form ---
  const form = document.getElementById("payslip-form");
  const yearInput = document.getElementById("payslip-year");
  const monthSelect = document.getElementById("payslip-month");
  const countryInput = document.getElementById("payslip-country");
  const countryListEl = document.getElementById("payslip-country-list");
  const employerInput = document.getElementById("payslip-employer");
  const fileInput = document.getElementById("payslip-file");
  const analyzeBtn = document.getElementById("analyze-payslip-btn");
  const analyzeStatus = document.getElementById("analyze-status");
  const currencySelect = document.getElementById("payslip-currency");
  const grossInput = document.getElementById("payslip-gross");
  const netInput = document.getElementById("payslip-net");
  const taxInput = document.getElementById("payslip-tax");
  const notesInput = document.getElementById("payslip-notes");
  const analyzedFlag = document.getElementById("payslip-analyzed-flag");

  const yearFilter = document.getElementById("payslip-year-filter");
  const summaryGrid = document.getElementById("payslip-summary-grid");
  const tableBody = document.querySelector("#payslip-table tbody");
  const table = document.getElementById("payslip-table");
  const emptyState = document.getElementById("payslip-empty-state");

  const missingMonthsYearEl = document.getElementById("missing-months-year");
  const missingMonthsListEl = document.getElementById("missing-months-list");

  // --- Bulk upload ---
  const bulkCountryInput = document.getElementById("bulk-country");
  const bulkEmployerInput = document.getElementById("bulk-employer");
  const bulkFilesInput = document.getElementById("bulk-files");
  const bulkAnalyzeBtn = document.getElementById("bulk-analyze-btn");
  const bulkStatus = document.getElementById("bulk-status");

  function populateStaticSelects() {
    monthSelect.innerHTML = PAYSLIP_MONTHS
      .map((name, i) => `<option value="${i + 1}">${name}</option>`)
      .join("");
    countryListEl.innerHTML = COMMON_COUNTRIES
      .map((name) => `<option value="${escapeHtml(name)}">`)
      .join("");
    currencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
  }

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  function currencyHintFor(countryName) {
    return COUNTRY_CURRENCY_HINTS[(countryName || "").trim().toLowerCase()] || "";
  }

  countryInput.addEventListener("change", () => {
    const hint = currencyHintFor(countryInput.value);
    if (hint && [...currencySelect.options].some((o) => o.value === hint)) {
      currencySelect.value = hint;
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      analyzeStatus.textContent = "Choose a payslip file first.";
      return;
    }
    const settings = Store.getGeminiSettings();
    if (!settings.apiKey) {
      analyzeStatus.textContent = "Add and save a Gemini API key above first.";
      return;
    }

    analyzeBtn.disabled = true;
    analyzeStatus.textContent = "Analyzing with Gemini…";

    try {
      const result = await analyzePayslipWithGemini({
        apiKey: settings.apiKey,
        model: settings.model || GEMINI_DEFAULT_MODEL,
        file,
      });

      if (result.country) countryInput.value = result.country;
      if (result.currency && [...currencySelect.options].some((o) => o.value === result.currency)) {
        currencySelect.value = result.currency;
      } else {
        const hint = currencyHintFor(result.country);
        if (hint) currencySelect.value = hint;
      }
      if (typeof result.grossPay === "number") grossInput.value = result.grossPay;
      if (typeof result.netPay === "number") netInput.value = result.netPay;
      if (typeof result.taxWithheld === "number") taxInput.value = result.taxWithheld;
      if (result.employer && !employerInput.value) employerInput.value = result.employer;

      // Prefer the period's end date (e.g. a mid-month-to-mid-month period is
      // usually filed under the month it ends in) to set Year/Month for you.
      const periodDate = new Date(result.payPeriodEnd || result.payPeriodStart);
      if (!Number.isNaN(periodDate.getTime())) {
        yearInput.value = periodDate.getFullYear();
        monthSelect.value = periodDate.getMonth() + 1;
      }

      const noteBits = [];
      if (result.notes) noteBits.push(result.notes);
      if (typeof result.otherDeductions === "number" && result.otherDeductions > 0) {
        noteBits.push(`Other deductions: ${result.otherDeductions}`);
      }
      if (result.payPeriodStart || result.payPeriodEnd) {
        noteBits.push(`Pay period: ${result.payPeriodStart || "?"} to ${result.payPeriodEnd || "?"}`);
      }
      if (noteBits.length) notesInput.value = noteBits.join(" — ");

      analyzedFlag.value = "1";
      analyzeStatus.textContent = "Done — review the figures below, then save.";
    } catch (e) {
      analyzeStatus.textContent = "AI analysis failed: " + e.message;
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  function populateYearFilter() {
    const entries = Store.getPayslips();
    const years = collectYearsFromDates(entries.map((e) => `${e.year}-01-01`));
    const previous = yearFilter.value;
    yearFilter.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearFilter.value = previous && [...yearFilter.options].some((o) => o.value === previous)
      ? previous
      : String(currentYear());
  }

  function renderSummary(year) {
    const payslips = Store.getPayslips().filter((p) => p.year === year);
    const byCountry = {};
    payslips.forEach((p) => {
      const key = (p.country || "(no country)").trim() || "(no country)";
      if (!byCountry[key]) byCountry[key] = { gross: 0, net: 0, tax: 0, count: 0, currency: p.currency };
      byCountry[key].gross += Number(p.grossPay || 0);
      byCountry[key].net += Number(p.netPay || 0);
      byCountry[key].tax += Number(p.taxWithheld || 0);
      byCountry[key].count += 1;
    });

    const rows = Object.keys(byCountry);
    if (!rows.length) {
      summaryGrid.innerHTML = `<div class="empty-state">No payslips logged yet for ${year}.</div>`;
      return;
    }

    summaryGrid.innerHTML = rows
      .map((name) => {
        const totals = byCountry[name];
        const symbol = currencySymbolFor(totals.currency);
        return `
          <div class="card country-card">
            <div class="country-head">
              <div>
                <div class="country-name">${escapeHtml(name)}</div>
                <div class="country-currency">${totals.count} payslip${totals.count === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div class="stat-row"><span>Gross</span><strong>${formatMoney(totals.gross, symbol)}</strong></div>
            <div class="stat-row"><span>Net</span><strong>${formatMoney(totals.net, symbol)}</strong></div>
            <div class="stat-row"><span>Tax withheld</span><strong>${formatMoney(totals.tax, symbol)}</strong></div>
          </div>
        `;
      })
      .join("");
  }

  function renderMissingMonths(year) {
    missingMonthsYearEl.textContent = year;
    const loggedMonths = new Set(
      Store.getPayslips().filter((p) => p.year === year).map((p) => p.month)
    );
    missingMonthsListEl.innerHTML = PAYSLIP_MONTHS
      .map((name, i) => {
        const month = i + 1;
        const logged = loggedMonths.has(month);
        return `<span class="badge ${logged ? "ok" : "warn"}">${logged ? "✓" : "—"} ${name}</span>`;
      })
      .join("");
  }

  function renderTable() {
    const year = Number(yearFilter.value) || currentYear();

    const entries = Store.getPayslips()
      .filter((p) => p.year === year)
      .sort((a, b) => a.month - b.month);

    if (!entries.length) {
      table.style.display = "none";
      emptyState.style.display = "block";
    } else {
      table.style.display = "";
      emptyState.style.display = "none";
      tableBody.innerHTML = entries
        .map((p) => {
          const symbol = currencySymbolFor(p.currency);
          return `
            <tr>
              <td>${PAYSLIP_MONTHS[p.month - 1] || p.month}</td>
              <td>${escapeHtml(p.country || "")}</td>
              <td>${escapeHtml(p.employer || "")}</td>
              <td class="num">${formatMoney(p.grossPay, symbol)}</td>
              <td class="num">${formatMoney(p.netPay, symbol)}</td>
              <td class="num">${formatMoney(p.taxWithheld, symbol)}</td>
              <td>${escapeHtml(p.notes || "")}</td>
              <td>${p.analyzedByAI ? '<span class="badge ok">AI</span>' : ""}</td>
              <td><button class="icon-btn small" data-delete="${p.id}" title="Delete">✕</button></td>
            </tr>
          `;
        })
        .join("");
    }

    renderSummary(year);
    renderMissingMonths(year);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number(yearInput.value);
    if (!year) return;

    Store.addPayslip({
      year,
      month: Number(monthSelect.value),
      country: countryInput.value.trim(),
      employer: employerInput.value.trim(),
      currency: currencySelect.value,
      grossPay: Number(grossInput.value) || 0,
      netPay: Number(netInput.value) || 0,
      taxWithheld: Number(taxInput.value) || 0,
      notes: notesInput.value.trim(),
      analyzedByAI: analyzedFlag.value === "1",
    });

    // Reset only the per-payslip fields, keep year/country as a convenience for entering several months in a row.
    fileInput.value = "";
    grossInput.value = "";
    netInput.value = "";
    taxInput.value = "";
    notesInput.value = "";
    employerInput.value = "";
    analyzedFlag.value = "0";
    analyzeStatus.textContent = "";

    populateYearFilter();
    renderTable();
  });

  tableBody.addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    if (!confirm("Delete this payslip entry?")) return;
    Store.deletePayslip(id);
    populateYearFilter();
    renderTable();
  });

  yearFilter.addEventListener("change", renderTable);

  // --- Bulk upload: analyze every selected file with AI and save it straight
  // away (no per-file review — that's the point of "bulk"). Files are
  // processed one at a time so a single failure doesn't lose the rest. ---

  bulkAnalyzeBtn.addEventListener("click", async () => {
    const files = Array.from(bulkFilesInput.files || []);
    if (!files.length) {
      bulkStatus.textContent = "Choose one or more payslip files first.";
      return;
    }
    const settings = Store.getGeminiSettings();
    if (!settings.apiKey) {
      bulkStatus.textContent = "Add and save a Gemini API key above first.";
      return;
    }

    const fallbackCountry = bulkCountryInput.value.trim();
    const fallbackEmployer = bulkEmployerInput.value.trim();

    bulkAnalyzeBtn.disabled = true;
    let saved = 0;
    const failures = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      bulkStatus.textContent = `Analyzing ${i + 1} / ${files.length}: ${file.name}…`;
      try {
        const result = await analyzePayslipWithGemini({
          apiKey: settings.apiKey,
          model: settings.model || GEMINI_DEFAULT_MODEL,
          file,
        });

        const country = result.country || fallbackCountry;
        const currency = (result.currency && [...currencySelect.options].some((o) => o.value === result.currency))
          ? result.currency
          : (currencyHintFor(country) || "EUR");

        const periodDate = new Date(result.payPeriodEnd || result.payPeriodStart);
        const hasPeriod = !Number.isNaN(periodDate.getTime());

        const noteBits = [];
        if (result.notes) noteBits.push(result.notes);
        if (typeof result.otherDeductions === "number" && result.otherDeductions > 0) {
          noteBits.push(`Other deductions: ${result.otherDeductions}`);
        }
        if (result.payPeriodStart || result.payPeriodEnd) {
          noteBits.push(`Pay period: ${result.payPeriodStart || "?"} to ${result.payPeriodEnd || "?"}`);
        }

        Store.addPayslip({
          year: hasPeriod ? periodDate.getFullYear() : currentYear(),
          month: hasPeriod ? periodDate.getMonth() + 1 : new Date().getMonth() + 1,
          country,
          employer: result.employer || fallbackEmployer,
          currency,
          grossPay: Number(result.grossPay) || 0,
          netPay: Number(result.netPay) || 0,
          taxWithheld: Number(result.taxWithheld) || 0,
          notes: noteBits.join(" — "),
          analyzedByAI: true,
        });
        saved++;
      } catch (e) {
        failures.push(`${file.name}: ${e.message}`);
      }
    }

    bulkAnalyzeBtn.disabled = false;
    bulkFilesInput.value = "";
    bulkStatus.textContent = failures.length
      ? `Saved ${saved} / ${files.length}. Failed: ${failures.join("; ")}`
      : `Saved ${saved} / ${files.length} payslips. Review them in the monthly log below.`;

    populateYearFilter();
    renderTable();
  });

  loadGeminiSettingsIntoForm();
  populateStaticSelects();
  yearInput.value = currentYear();
  monthSelect.value = new Date().getMonth() + 1;
  populateYearFilter();
  renderTable();
})();
