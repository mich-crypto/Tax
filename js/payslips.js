(function () {
  const yearFilter = document.getElementById("payslip-year-filter");
  const summaryEl = document.getElementById("payslip-summary");
  const tableBody = document.querySelector("#payslip-table tbody");
  const table = document.getElementById("payslip-table");
  const emptyState = document.getElementById("payslip-empty-state");

  const missingMonthsYearEl = document.getElementById("missing-months-year");
  const missingMonthsListEl = document.getElementById("missing-months-list");

  // --- Bulk upload ---
  const bulkTypeSelect = document.getElementById("bulk-type");
  const bulkFilesInput = document.getElementById("bulk-files");
  const bulkAnalyzeBtn = document.getElementById("bulk-analyze-btn");
  const bulkStatus = document.getElementById("bulk-status");

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  function currencyHintFor(countryName) {
    return COUNTRY_CURRENCY_HINTS[(countryName || "").trim().toLowerCase()] || "";
  }

  // TEMPORARY: Payslips' AI analysis can call either Gemini or Claude,
  // switchable under Settings — this app will revert to Gemini before
  // release. Returns { name, run(file) } for whichever is selected.
  function activeAIProvider() {
    const provider = Store.getAIProvider();
    if (provider === "claude") {
      const settings = Store.getClaudeSettings();
      return {
        name: "Claude",
        apiKey: settings.apiKey,
        run: (file) => analyzePayslipWithClaude({ apiKey: settings.apiKey, model: settings.model || CLAUDE_DEFAULT_MODEL, file }),
      };
    }
    const settings = Store.getGeminiSettings();
    return {
      name: "Gemini",
      apiKey: settings.apiKey,
      run: (file) => analyzePayslipWithGemini({ apiKey: settings.apiKey, model: settings.model || GEMINI_DEFAULT_MODEL, file }),
    };
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
    if (!payslips.length) {
      summaryEl.innerHTML = `<div class="empty-state">No payslips logged yet for ${year}.</div>`;
      return;
    }

    const totals = { gross: 0, net: 0, tax: 0 };
    let holidayGross = 0;
    payslips.forEach((p) => {
      totals.gross += Number(p.grossPay || 0);
      totals.net += Number(p.netPay || 0);
      totals.tax += Number(p.taxWithheld || 0);
      if (p.type === "Holiday pay") holidayGross += Number(p.grossPay || 0);
    });
    const symbol = currencySymbolFor(payslips[0].currency);
    const holidayNote = holidayGross ? ` — includes ${formatMoney(holidayGross, symbol)} holiday pay (gross)` : "";

    summaryEl.innerHTML = `
      <div class="stat-row"><span>Gross</span><strong>${formatMoney(totals.gross, symbol)}</strong></div>
      <div class="stat-row"><span>Net</span><strong>${formatMoney(totals.net, symbol)}</strong></div>
      <div class="stat-row"><span>Tax withheld</span><strong>${formatMoney(totals.tax, symbol)}</strong></div>
      <p class="hint">${payslips.length} payslip${payslips.length === 1 ? "" : "s"} logged for ${year}${holidayNote}.</p>
    `;
  }

  function renderMissingMonths(year) {
    missingMonthsYearEl.textContent = year;
    // Holiday pay isn't expected every month, so it doesn't count toward "logged".
    const loggedMonths = new Set(
      Store.getPayslips().filter((p) => p.year === year && p.type !== "Holiday pay").map((p) => p.month)
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
              <td>${p.type === "Holiday pay" ? '<span class="badge ok">Holiday pay</span>' : "Salary"}</td>
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
    const provider = activeAIProvider();
    if (!provider.apiKey) {
      bulkStatus.textContent = `Add and save a ${provider.name} API key under Settings first.`;
      return;
    }

    bulkAnalyzeBtn.disabled = true;
    let saved = 0;
    const failures = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      bulkStatus.textContent = `Analyzing ${i + 1} / ${files.length} with ${provider.name}: ${file.name}…`;
      try {
        const result = await provider.run(file);

        // Country/employer aren't tracked as fields (same employer every time) —
        // AI-extracted country is still used transiently as a currency hint.
        const currency = (result.currency && CURRENCIES.some((c) => c.code === result.currency))
          ? result.currency
          : (currencyHintFor(result.country) || "EUR");

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
          type: bulkTypeSelect.value,
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
    bulkTypeSelect.value = "Salary";

    populateYearFilter();
    renderTable();
  });

  bulkTypeSelect.innerHTML = PAYSLIP_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
  populateYearFilter();
  renderTable();
})();
