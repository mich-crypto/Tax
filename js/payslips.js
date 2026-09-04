(function () {
  const yearFilter = document.getElementById("year-filter");
  const statsEl = document.getElementById("pay-stats");
  const summaryNote = document.getElementById("pay-summary-note");
  const coverageYearEl = document.getElementById("coverage-year");
  const coverageListEl = document.getElementById("coverage-list");
  const table = document.getElementById("payslips-table");
  const tbody = document.querySelector("#payslips-table tbody");
  const tfoot = document.querySelector("#payslips-table tfoot");
  const emptyState = document.getElementById("payslips-empty-state");

  const bulkType = document.getElementById("bulk-type");
  const bulkFiles = document.getElementById("bulk-files");
  const bulkBtn = document.getElementById("bulk-analyze-btn");
  const bulkStatus = document.getElementById("bulk-status");

  const dialog = document.getElementById("add-payslip-dialog");
  const openDialogBtn = document.getElementById("open-add-payslip");
  const manualForm = document.getElementById("manual-payslip-form");
  const manualStatus = document.getElementById("manual-status");

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  function currencyHintFor(countryName) {
    return COUNTRY_CURRENCY_HINTS[(countryName || "").trim().toLowerCase()] || "";
  }

  /** Gross/net/tax for a year, converted to EUR. Flags anything it couldn't convert. */
  function yearTotals(year, rates) {
    const totals = { gross: 0, net: 0, tax: 0, count: 0, holidayGross: 0, missingRate: false, native: {} };
    Store.getPayslips()
      .filter((p) => p.year === year)
      .forEach((p) => {
        totals.count += 1;
        const gross = toEur(p.grossPay, p.currency, rates);
        const net = toEur(p.netPay, p.currency, rates);
        const tax = toEur(p.taxWithheld, p.currency, rates);
        const code = p.currency || "EUR";
        if (!totals.native[code]) totals.native[code] = { gross: 0, net: 0, tax: 0 };
        totals.native[code].gross += Number(p.grossPay) || 0;
        totals.native[code].net += Number(p.netPay) || 0;
        totals.native[code].tax += Number(p.taxWithheld) || 0;
        if (gross === null || net === null || tax === null) {
          totals.missingRate = true;
          return;
        }
        totals.gross += gross;
        totals.net += net;
        totals.tax += tax;
        if (p.type === "Holiday pay") totals.holidayGross += gross;
      });
    return totals;
  }

  function changeBadge(now, before) {
    if (!before) return now ? `<span class="badge ok">new</span>` : "";
    const pct = ((now - before) / before) * 100;
    const cls = pct > 0 ? "ok" : pct < 0 ? "danger" : "neutral";
    const sign = pct > 0 ? "+" : "";
    return `<span class="badge ${cls}">${sign}${pct.toFixed(1)}% vs ${before ? "last year" : ""}</span>`;
  }

  function renderStats(year) {
    const rates = Store.getCurrencyRates();
    const now = yearTotals(year, rates);
    const before = yearTotals(year - 1, rates);

    if (!now.count && !before.count) {
      statsEl.innerHTML = "";
      summaryNote.textContent = "";
      return;
    }

    // With no exchange rate set, every payslip is excluded from the EUR
    // figures — show a dash rather than a confident-looking €0.00.
    const eur = (value) => (now.missingRate && !value ? "—" : formatMoney(value, "€"));
    const tiles = [
      { label: "Gross pay", value: eur(now.gross), badge: changeBadge(now.gross, before.gross) },
      { label: "Net pay", value: eur(now.net), badge: changeBadge(now.net, before.net) },
      { label: "Tax withheld", value: eur(now.tax), badge: changeBadge(now.tax, before.tax) },
    ];
    statsEl.innerHTML = tiles
      .map((t) => `
        <div class="card stat-tile">
          <div class="stat-label">${escapeHtml(t.label)}</div>
          <div class="stat-value">${escapeHtml(t.value)}</div>
          <div class="stat-hint">${t.badge}</div>
        </div>
      `)
      .join("");

    const bits = [];
    if (now.count) bits.push(`${now.count} payslip${now.count === 1 ? "" : "s"} logged for ${year}`);
    const native = Object.entries(now.native)
      .map(([code, v]) => `${formatMoney(v.net, currencySymbolFor(code))} ${code} net`)
      .join(" · ");
    if (native) bits.push(native);
    if (now.holidayGross) bits.push(`includes ${formatMoney(now.holidayGross, "€")} holiday pay (gross)`);
    if (now.missingRate) bits.push("⚠ some payslips use a currency with no exchange rate set — excluded from the € figures (set it under Settings)");
    summaryNote.textContent = bits.join(" — ");
  }

  function renderCoverage(year) {
    coverageYearEl.textContent = year;
    const logged = new Set(
      Store.getPayslips().filter((p) => p.year === year && p.type !== "Holiday pay").map((p) => p.month)
    );
    coverageListEl.innerHTML = PAYSLIP_MONTHS
      .map((name, i) => {
        const has = logged.has(i + 1);
        return `<span class="badge ${has ? "ok" : "neutral"}">${has ? "✓" : "·"} ${name.slice(0, 3)}</span>`;
      })
      .join("");
  }

  function renderTable() {
    const year = Number(yearFilter.value) || currentYear();
    const rates = Store.getCurrencyRates();
    const entries = Store.getPayslips()
      .filter((p) => p.year === year)
      .sort((a, b) => a.month - b.month || (a.type || "").localeCompare(b.type || ""));

    if (!entries.length) {
      table.style.display = "none";
      emptyState.style.display = "block";
      tbody.innerHTML = "";
      tfoot.innerHTML = "";
    } else {
      table.style.display = "";
      emptyState.style.display = "none";
      tbody.innerHTML = entries
        .map((p) => {
          const symbol = currencySymbolFor(p.currency);
          const netEur = toEur(p.netPay, p.currency, rates);
          return `
            <tr>
              <td>${PAYSLIP_MONTHS[p.month - 1] || p.month}</td>
              <td>${p.type === "Holiday pay" ? '<span class="badge ok">Holiday</span>' : "Salary"}</td>
              <td class="num">${formatMoney(p.grossPay, symbol)}</td>
              <td class="num">${formatMoney(p.netPay, symbol)}</td>
              <td class="num">${formatMoney(p.taxWithheld, symbol)}</td>
              <td class="num">${netEur === null ? '<span class="badge warn">no rate</span>' : formatMoney(netEur, "€")}</td>
              <td class="notes-cell">${escapeHtml(p.notes || "")}</td>
              <td>${p.analyzedByAI ? '<span class="badge neutral">AI</span>' : ""}</td>
              <td><button class="icon-btn small" data-delete="${p.id}" title="Delete">✕</button></td>
            </tr>
          `;
        })
        .join("");

      const totalNetEur = entries.reduce((s, p) => s + (toEur(p.netPay, p.currency, rates) || 0), 0);
      tfoot.innerHTML = `
        <tr class="total-row">
          <td colspan="5"><strong>Total net for ${year}</strong></td>
          <td class="num"><strong>${formatMoney(totalNetEur, "€")}</strong></td>
          <td colspan="3"></td>
        </tr>
      `;
    }

    renderStats(year);
    renderCoverage(year);
  }

  function populateYearFilter() {
    const years = collectYearsFromDates(Store.getPayslips().map((p) => `${p.year}-01-01`));
    const previous = yearFilter.value;
    yearFilter.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearFilter.value = previous && years.some((y) => String(y) === previous) ? previous : String(currentYear());
  }

  tbody.addEventListener("click", async (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    if (!(await confirmAction("Delete this payslip entry?"))) return;
    Store.deletePayslip(id);
    populateYearFilter();
    renderTable();
  });

  yearFilter.addEventListener("change", renderTable);

  // --- Bulk upload -----------------------------------------------------
  // TEMPORARY: analysis runs through whichever provider is selected under
  // Settings (Gemini ships; Claude is the current test) — see js/claude-vision.js.

  function activeAIProvider() {
    if (Store.getAIProvider() === "claude") {
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

  bulkBtn.addEventListener("click", async () => {
    const files = Array.from(bulkFiles.files || []);
    if (!files.length) {
      bulkStatus.textContent = "Choose one or more payslip files first.";
      return;
    }
    const provider = activeAIProvider();
    if (!provider.apiKey) {
      bulkStatus.textContent = `Add and save a ${provider.name} API key under Settings first.`;
      return;
    }

    bulkBtn.disabled = true;
    let saved = 0;
    const failures = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      bulkStatus.textContent = `Analyzing ${i + 1} / ${files.length} with ${provider.name}: ${file.name}…`;
      try {
        const result = await provider.run(file);

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
          noteBits.push(`Period: ${result.payPeriodStart || "?"} to ${result.payPeriodEnd || "?"}`);
        }

        Store.addPayslip({
          year: hasPeriod ? periodDate.getFullYear() : currentYear(),
          month: hasPeriod ? periodDate.getMonth() + 1 : new Date().getMonth() + 1,
          type: bulkType.value,
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

    bulkBtn.disabled = false;
    bulkFiles.value = "";
    bulkType.value = "Salary";
    bulkStatus.textContent = failures.length
      ? `Saved ${saved} / ${files.length}. Failed: ${failures.join("; ")}`
      : `Saved ${saved} / ${files.length}. Review them in the log below.`;

    populateYearFilter();
    renderTable();
    if (saved && !failures.length) dialog.close();
  });

  // --- Add payslip dialog -----------------------------------------------

  function showPanel(name) {
    dialog.querySelectorAll(".sheet-tab").forEach((tab) => {
      const on = tab.dataset.tab === name;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", String(on));
    });
    dialog.querySelectorAll(".sheet-panel").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  dialog.querySelectorAll(".sheet-tab").forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.tab));
  });

  openDialogBtn.addEventListener("click", () => {
    bulkStatus.textContent = "";
    manualStatus.textContent = "";
    // Default the manual form to the year being viewed and the first month
    // that has no salary payslip yet - usually the one being added.
    const year = Number(yearFilter.value) || currentYear();
    manualYear.value = year;
    const logged = new Set(
      Store.getPayslips().filter((p) => p.year === year && p.type !== "Holiday pay").map((p) => p.month)
    );
    const nextMonth = PAYSLIP_MONTHS.findIndex((_, i) => !logged.has(i + 1)) + 1;
    manualMonth.value = String(nextMonth || new Date().getMonth() + 1);
    showPanel("ai");
    dialog.showModal();
  });

  dialog.addEventListener("click", (event) => {
    // Click the backdrop (outside the dialog's own box) to dismiss.
    if (event.target === dialog) dialog.close();
  });

  // --- Manual entry ------------------------------------------------------

  const manualYear = document.getElementById("manual-year");
  const manualMonth = document.getElementById("manual-month");
  const manualType = document.getElementById("manual-type");
  const manualCurrency = document.getElementById("manual-currency");

  manualMonth.innerHTML = PAYSLIP_MONTHS
    .map((name, i) => `<option value="${i + 1}">${name}</option>`)
    .join("");
  manualType.innerHTML = PAYSLIP_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
  manualCurrency.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code}</option>`).join("");
  manualCurrency.value = "DKK";

  manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number(manualYear.value);
    if (!year) {
      manualStatus.textContent = "Enter a year.";
      return;
    }
    Store.addPayslip({
      year,
      month: Number(manualMonth.value),
      type: manualType.value,
      currency: manualCurrency.value,
      grossPay: Number(document.getElementById("manual-gross").value) || 0,
      netPay: Number(document.getElementById("manual-net").value) || 0,
      taxWithheld: Number(document.getElementById("manual-tax").value) || 0,
      notes: document.getElementById("manual-notes").value.trim(),
      analyzedByAI: false,
    });

    manualForm.reset();
    manualCurrency.value = "DKK";
    populateYearFilter();
    yearFilter.value = String(year);
    renderTable();
    dialog.close();
  });

  bulkType.innerHTML = PAYSLIP_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
  populateYearFilter();
  renderTable();
})();
