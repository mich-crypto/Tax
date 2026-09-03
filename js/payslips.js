(function () {
  const countryListEl = document.getElementById("payslip-country-list");

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

  function populateStaticLists() {
    countryListEl.innerHTML = COMMON_COUNTRIES
      .map((name) => `<option value="${escapeHtml(name)}">`)
      .join("");
  }

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  function currencyHintFor(countryName) {
    return COUNTRY_CURRENCY_HINTS[(countryName || "").trim().toLowerCase()] || "";
  }

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
  // away (no per-file review — that's the point of "bulk", and covers the
  // single-file case too — just pick one file). Files are processed one at a
  // time so a single failure doesn't lose the rest. ---

  bulkAnalyzeBtn.addEventListener("click", async () => {
    const files = Array.from(bulkFilesInput.files || []);
    if (!files.length) {
      bulkStatus.textContent = "Choose one or more payslip files first.";
      return;
    }
    const settings = Store.getGeminiSettings();
    if (!settings.apiKey) {
      bulkStatus.textContent = "Add and save a Gemini API key under Settings first.";
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
        const currency = (result.currency && CURRENCIES.some((c) => c.code === result.currency))
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

  populateStaticLists();
  populateYearFilter();
  renderTable();
})();
