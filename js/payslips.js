(function () {
  // --- Claude settings ---
  const apiKeyInput = document.getElementById("claude-api-key");
  const modelInput = document.getElementById("claude-model");
  const toggleKeyBtn = document.getElementById("toggle-key-visibility");
  const saveSettingsBtn = document.getElementById("save-claude-settings");
  const clearKeyBtn = document.getElementById("clear-claude-key");
  const settingsStatus = document.getElementById("claude-settings-status");

  function loadClaudeSettingsIntoForm() {
    const settings = Store.getClaudeSettings();
    apiKeyInput.value = settings.apiKey || "";
    modelInput.value = settings.model || CLAUDE_DEFAULT_MODEL;
  }

  toggleKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  saveSettingsBtn.addEventListener("click", () => {
    Store.saveClaudeSettings({
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim() || CLAUDE_DEFAULT_MODEL,
    });
    settingsStatus.textContent = "Saved.";
    setTimeout(() => { settingsStatus.textContent = ""; }, 2500);
  });

  clearKeyBtn.addEventListener("click", () => {
    Store.clearClaudeApiKey();
    apiKeyInput.value = "";
    settingsStatus.textContent = "API key cleared.";
    setTimeout(() => { settingsStatus.textContent = ""; }, 2500);
  });

  // --- Add-payslip form ---
  const form = document.getElementById("payslip-form");
  const yearInput = document.getElementById("payslip-year");
  const monthSelect = document.getElementById("payslip-month");
  const countrySelect = document.getElementById("payslip-country");
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

  function populateStaticSelects() {
    monthSelect.innerHTML = PAYSLIP_MONTHS
      .map((name, i) => `<option value="${i + 1}">${name}</option>`)
      .join("");
    countrySelect.innerHTML = Store.getCountries()
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
    currencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
  }

  function countryCurrency(countryId) {
    const country = Store.getCountries().find((c) => c.id === countryId);
    return country ? country.currencyCode : "";
  }

  countrySelect.addEventListener("change", () => {
    const currency = countryCurrency(countrySelect.value);
    if (currency && [...currencySelect.options].some((o) => o.value === currency)) {
      currencySelect.value = currency;
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      analyzeStatus.textContent = "Choose a payslip file first.";
      return;
    }
    const settings = Store.getClaudeSettings();
    if (!settings.apiKey) {
      analyzeStatus.textContent = "Add and save a Claude API key above first.";
      return;
    }

    analyzeBtn.disabled = true;
    analyzeStatus.textContent = "Analyzing with Claude…";

    try {
      const result = await analyzePayslipWithClaude({
        apiKey: settings.apiKey,
        model: settings.model || CLAUDE_DEFAULT_MODEL,
        file,
      });

      if (result.currency && [...currencySelect.options].some((o) => o.value === result.currency)) {
        currencySelect.value = result.currency;
      }
      if (typeof result.grossPay === "number") grossInput.value = result.grossPay;
      if (typeof result.netPay === "number") netInput.value = result.netPay;
      if (typeof result.taxWithheld === "number") taxInput.value = result.taxWithheld;
      if (result.employer && !employerInput.value) employerInput.value = result.employer;

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
    const countries = Store.getCountries();
    const payslips = Store.getPayslips().filter((p) => p.year === year);
    const byCountry = {};
    payslips.forEach((p) => {
      if (!byCountry[p.countryId]) byCountry[p.countryId] = { gross: 0, net: 0, tax: 0, count: 0 };
      byCountry[p.countryId].gross += Number(p.grossPay || 0);
      byCountry[p.countryId].net += Number(p.netPay || 0);
      byCountry[p.countryId].tax += Number(p.taxWithheld || 0);
      byCountry[p.countryId].count += 1;
    });

    const rows = Object.keys(byCountry);
    if (!rows.length) {
      summaryGrid.innerHTML = `<div class="empty-state">No payslips logged yet for ${year}.</div>`;
      return;
    }

    summaryGrid.innerHTML = rows
      .map((countryId) => {
        const country = countries.find((c) => c.id === countryId);
        const name = country ? country.name : "(deleted country)";
        const symbol = country ? country.currencySymbol : "";
        const totals = byCountry[countryId];
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

  function renderTable() {
    const countries = Store.getCountries();
    const countryById = Object.fromEntries(countries.map((c) => [c.id, c]));
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
          const country = countryById[p.countryId];
          const symbol = country ? country.currencySymbol : "";
          const name = country ? country.name : "(deleted country)";
          return `
            <tr>
              <td>${PAYSLIP_MONTHS[p.month - 1] || p.month}</td>
              <td>${escapeHtml(name)}</td>
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
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number(yearInput.value);
    if (!year) return;

    Store.addPayslip({
      year,
      month: Number(monthSelect.value),
      countryId: countrySelect.value,
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

  loadClaudeSettingsIntoForm();
  populateStaticSelects();
  yearInput.value = currentYear();
  monthSelect.value = new Date().getMonth() + 1;
  populateYearFilter();
  renderTable();
})();
