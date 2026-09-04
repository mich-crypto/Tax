(function () {
  // --- Exchange rates (→ EUR) ---
  // Only payslips carry a non-EUR amount now — tax years are EUR throughout —
  // so the fields shown are driven by the currencies actually logged, plus DKK,
  // which the Danish payroll always uses.
  const rateFieldsEl = document.getElementById("exchange-rate-fields");
  const ratesStatus = document.getElementById("rates-status");

  function currenciesNeedingRates() {
    return CURRENCIES.map((c) => c.code).filter((code) => code !== "EUR").sort();
  }

  function renderRateFields() {
    const rates = Store.getCurrencyRates();
    rateFieldsEl.innerHTML = currenciesNeedingRates()
      .map((code) => `
        <div class="field">
          <label for="rate-${escapeHtml(code)}">1 EUR = ? ${escapeHtml(code)}</label>
          <input type="number" min="0" step="0.0001" id="rate-${escapeHtml(code)}" class="rate-input" data-currency="${escapeHtml(code)}" value="${rates[code] || ""}" placeholder="e.g. 7.46">
        </div>
      `)
      .join("");

    rateFieldsEl.querySelectorAll(".rate-input").forEach((input) => {
      input.addEventListener("change", () => {
        const current = Store.getCurrencyRates();
        const value = Number(input.value);
        if (value > 0) current[input.dataset.currency] = value;
        else delete current[input.dataset.currency];
        Store.saveCurrencyRates(current);
        ratesStatus.textContent = "Rates saved.";
        setTimeout(() => { ratesStatus.textContent = ""; }, 2500);
      });
    });
  }

  // --- Fetching rates from the ECB ---

  const fetchLatestBtn = document.getElementById("fetch-latest-rates");
  const fetchYearBtn = document.getElementById("fetch-year-rates");
  const rateYear = document.getElementById("rate-year");

  const thisYear = new Date().getFullYear();
  rateYear.innerHTML = Array.from({ length: 8 }, (_, i) => thisYear - i)
    .map((y) => `<option value="${y}">${y}</option>`)
    .join("");
  rateYear.value = String(thisYear - 1);

  /** Merges fetched rates in, leaving any currency the service didn't return. */
  function applyRates(fetched, description) {
    const current = Store.getCurrencyRates();
    Object.entries(fetched).forEach(([code, rate]) => {
      if (rate > 0) current[code] = rate;
    });
    Store.saveCurrencyRates(current);
    renderRateFields();
    ratesStatus.textContent = description;
  }

  async function withButton(button, work) {
    button.disabled = true;
    fetchLatestBtn.disabled = true;
    fetchYearBtn.disabled = true;
    ratesStatus.textContent = "Asking the ECB…";
    try {
      await work();
    } catch (e) {
      // A blocked request (offline, or a preview whose sandbox forbids it)
      // surfaces as a bare TypeError — say what to do instead of relaying it.
      const reason = e instanceof TypeError
        ? "Couldn't reach the rate service from here."
        : e.message;
      ratesStatus.textContent = `${reason} Type the rates in by hand below.`;
    }
    fetchLatestBtn.disabled = false;
    fetchYearBtn.disabled = false;
  }

  fetchLatestBtn.addEventListener("click", () =>
    withButton(fetchLatestBtn, async () => {
      const { date, rates } = await fetchLatestRates();
      applyRates(rates, `Using the ECB reference rates published on ${formatDate(date) || date}.`);
    })
  );

  fetchYearBtn.addEventListener("click", () =>
    withButton(fetchYearBtn, async () => {
      const year = rateYear.value;
      const { rates, days } = await fetchYearAverageRates(year);
      applyRates(rates, `Using the ${year} average of ${days} ECB publication days.`);
    })
  );

  // --- TEMPORARY: AI provider toggle (testing only — see js/claude-vision.js) ---
  const providerSelect = document.getElementById("ai-provider-select");
  providerSelect.value = Store.getAIProvider();
  providerSelect.addEventListener("change", () => {
    Store.saveAIProvider(providerSelect.value);
  });

  /** Wires one provider's key/model card — same three controls either way. */
  function wireProviderCard(opts) {
    const keyInput = document.getElementById(opts.keyId);
    const modelInput = document.getElementById(opts.modelId);
    const toggleBtn = document.getElementById(opts.toggleId);
    const saveBtn = document.getElementById(opts.saveId);
    const clearBtn = document.getElementById(opts.clearId);
    const status = document.getElementById(opts.statusId);

    function flash(message) {
      status.textContent = message;
      setTimeout(() => { status.textContent = ""; }, 2500);
    }

    const settings = opts.get();
    keyInput.value = settings.apiKey || "";
    modelInput.value = settings.model || opts.defaultModel;

    toggleBtn.addEventListener("click", () => {
      keyInput.type = keyInput.type === "password" ? "text" : "password";
    });

    saveBtn.addEventListener("click", () => {
      opts.save({
        apiKey: keyInput.value.trim(),
        model: modelInput.value.trim() || opts.defaultModel,
      });
      flash("Saved.");
    });

    clearBtn.addEventListener("click", () => {
      opts.clearKey();
      keyInput.value = "";
      flash("API key cleared.");
    });
  }

  wireProviderCard({
    keyId: "gemini-api-key", modelId: "gemini-model",
    toggleId: "toggle-key-visibility", saveId: "save-gemini-settings",
    clearId: "clear-gemini-key", statusId: "gemini-settings-status",
    defaultModel: GEMINI_DEFAULT_MODEL,
    get: () => Store.getGeminiSettings(),
    save: (s) => Store.saveGeminiSettings(s),
    clearKey: () => Store.clearGeminiApiKey(),
  });

  wireProviderCard({
    keyId: "claude-api-key", modelId: "claude-model",
    toggleId: "toggle-claude-key-visibility", saveId: "save-claude-settings",
    clearId: "clear-claude-key", statusId: "claude-settings-status",
    defaultModel: CLAUDE_DEFAULT_MODEL,
    get: () => Store.getClaudeSettings(),
    save: (s) => Store.saveClaudeSettings(s),
    clearKey: () => Store.clearClaudeApiKey(),
  });

  // --- Travel tracker ---

  const travelFile = document.getElementById("travel-file");
  const travelStatus = document.getElementById("travel-status");
  const travelSummary = document.getElementById("travel-summary");
  const clearTravelBtn = document.getElementById("clear-travel-btn");

  function renderTravel() {
    const travel = Store.getTravel();
    if (!travel) {
      travelSummary.innerHTML = "";
      clearTravelBtn.hidden = true;
      return;
    }
    clearTravelBtn.hidden = false;

    const years = travelYears(travel);
    const countries = Array.from(
      new Set(years.flatMap((y) => Object.keys(travel.years[y])))
    ).sort();

    travelSummary.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Country</th>
            ${years.map((y) => `<th class="num">${y}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${countries.map((country) => `
            <tr>
              <td>${escapeHtml(country)}</td>
              ${years.map((y) => {
                const summary = travelYearSummary(travel, y);
                const row = summary.countries.find((c) => c.country === country);
                return `<td class="num">${row && row.presence ? row.presence : "—"}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>Days of presence</strong></td>
            ${years.map((y) => `<td class="num"><strong>${travelYearSummary(travel, y).totalPresence}</strong></td>`).join("")}
          </tr>
        </tfoot>
      </table>`;

    travelStatus.textContent = `${travel.fileName || "Report"} — ${travel.days} days, ${travel.from} to ${travel.to}.`;
  }

  travelFile.addEventListener("change", async () => {
    const file = travelFile.files[0];
    if (!file) return;
    travelStatus.textContent = `Reading ${file.name}…`;
    try {
      const travel = await parseTravelWorkbook(file);
      Store.saveTravel(travel);
      renderTravel();
      notify(`Travel tracker loaded — ${travel.days} days across ${travelYears(travel).length} years.`);
    } catch (e) {
      travelStatus.textContent = e.message;
    }
    travelFile.value = "";
  });

  clearTravelBtn.addEventListener("click", async () => {
    if (!(await confirmAction("Remove the imported travel tracker? Your tax years keep everything else.", "Remove"))) return;
    Store.clearTravel();
    travelStatus.textContent = "";
    renderTravel();
  });

  // --- Data export / import / wipe ---
  const exportBtn = document.getElementById("export-data-btn");
  const exportExcelBtn = document.getElementById("export-excel-btn");
  const importInput = document.getElementById("import-data-input");
  const wipeBtn = document.getElementById("wipe-data-btn");

  exportBtn.addEventListener("click", () => {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // --- Excel backup -------------------------------------------------------
  // A human-readable backup, not a machine one: unlike the JSON export
  // above (the real backup - Import reads it straight back in), this can't
  // be re-imported. It exists for the day the site itself is unreachable
  // and the JSON file is all that's left - one sheet per tax year (the
  // money, the Countries table, payments, correspondence) plus one sheet
  // for the whole payslip history, so the numbers are readable in Excel or
  // Sheets with nothing else running.

  /** Excel sheet names: 31 chars max, and none of : \ / ? * [ ] */
  function safeSheetName(name) {
    return String(name).replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
  }

  function countryRowsForSheet(record) {
    const header = [
      "Country", "Currency", "Taxable income", "Pre-paid tax", "Actual Tax", "Tax return",
      "Questionnaire", "Return filed", "Payed / returned", "Not tax liable", "Comment",
    ];
    const rows = (record.countries || []).map((c) => [
      c.country || "",
      c.currency || "",
      Number(c.income) || 0,
      Number(c.tax) || 0,
      countryNetTax(c),
      Number(c.refunded) || 0,
      !!c.questionnaireDone,
      !!c.returnFiled,
      !!c.paidReturned,
      !!c.notLiable,
      c.comment || "",
    ]);
    const totals = taxYearTotals(record);
    const totalRow = ["Total (EUR)", "", totals.gross, totals.taxPaid, totals.tax, totals.refunded, "", "", "", "", ""];
    return [header, ...rows, totalRow];
  }

  function paymentRowsForSheet(record) {
    const header = ["Action", "Date", "Amount", "Currency", "Country"];
    const rows = (record.payments || []).map((p) => [
      p.action || "", formatDate(p.date) || "", Number(p.amount) || 0, p.currency || "", p.country || "",
    ]);
    return [header, ...rows];
  }

  function correspondenceRowsForSheet(record) {
    const header = ["Date", "Counterparty", "Channel", "Category", "Country", "Subject", "Notes", "Follow-up", "Status"];
    const rows = (record.correspondence || []).map((e) => [
      formatDate(e.date) || "", e.counterparty || "", e.channel || "", e.category || "", e.country || "",
      e.subject || "", e.notes || "", formatDate(e.followUp) || "", e.status || "",
    ]);
    return [header, ...rows];
  }

  function taxYearSheetRows(record) {
    const totals = taxYearTotals(record);
    const status = taxYearStatus(record);
    const denmark = denmarkRow(record);
    const dkRefund = denmark ? countryEur(denmark, "refunded") : null;

    return [
      ["Tax year", record.taxYear],
      ["Gross income (EUR)", totals.gross],
      ["Tax paid — actual (EUR)", totals.tax],
      ["Tax paid — pre-paid (EUR)", totals.taxPaid],
      ["Net income (EUR)", totals.netIncome],
      ["Tax rate", totals.gross ? formatPercent(totals.rate) : ""],
      ["Tax return from Denmark (EUR)", dkRefund === null ? "" : dkRefund],
      ["Year completed", status.yearCompleted],
      ["Questionnaires done", status.questionnairesDone],
      ["Returns filed", status.returnsFiled],
      ["Paid & returned", status.paidAndReturned],
      [],
      ["Countries"],
      ...countryRowsForSheet(record),
      [],
      ["Payments & refunds"],
      ...paymentRowsForSheet(record),
      [],
      ["Correspondence"],
      ...correspondenceRowsForSheet(record),
    ];
  }

  function payslipSheetRows() {
    const header = ["Year", "Month", "Type", "Currency", "Gross pay", "Net pay", "Tax withheld", "Net pay only", "Notes", "Read by AI"];
    const entries = Store.getPayslips().slice().sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const rows = entries.map((p) => [
      p.year, PAYSLIP_MONTHS[(p.month || 1) - 1] || p.month, p.type || "", p.currency || "",
      p.netOnly ? "" : Number(p.grossPay) || 0,
      Number(p.netPay) || 0,
      p.netOnly ? "" : Number(p.taxWithheld) || 0,
      !!p.netOnly, p.notes || "", !!p.analyzedByAI,
    ]);
    return [header, ...rows];
  }

  function buildExcelWorkbook() {
    const wb = XLSX.utils.book_new();
    const years = Store.sortTaxYears(Store.getTaxYears().slice());
    years.forEach((record) => {
      const ws = XLSX.utils.aoa_to_sheet(taxYearSheetRows(record));
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(record.taxYear));
    });
    const payslipWs = XLSX.utils.aoa_to_sheet(payslipSheetRows());
    XLSX.utils.book_append_sheet(wb, payslipWs, "Salary follow up");
    return wb;
  }

  exportExcelBtn.addEventListener("click", () => {
    const wb = buildExcelWorkbook();
    XLSX.writeFile(wb, `tax-tracker-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  importInput.addEventListener("change", () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Store.importAll(data);
        renderRateFields();
        renderTravel();
        notify("Import complete.");
      } catch (e) {
        notify("That file doesn't look like a valid export (invalid JSON).");
      }
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  wipeBtn.addEventListener("click", async () => {
    const sure = await confirmAction(
      "This deletes ALL data stored in this browser — tax years, countries, payments, correspondence, payslips and exchange rates. This cannot be undone.",
      "Wipe everything"
    );
    if (!sure) return;
    Store.wipeAll();
    renderRateFields();
    renderTravel();
    notify("All data wiped.");
  });

  // --- Site lock (see js/site-lock.js) -----------------------------------
  // Only prepares a hash for you to paste into that file's SITE_LOCK_HASH
  // constant — it can't flip the switch itself, since the file it lives in
  // has to actually ship to every visitor for the gate to apply to them,
  // not just to this browser's local storage.

  const siteLockBadge = document.getElementById("site-lock-status-badge");
  const siteLockPassword = document.getElementById("site-lock-password");
  const siteLockHashOutput = document.getElementById("site-lock-hash-output");
  const siteLockStatus = document.getElementById("site-lock-status");
  const generateSiteLockHashBtn = document.getElementById("generate-site-lock-hash");

  if (siteLockBadge) {
    const on = typeof SITE_LOCK_HASH !== "undefined" && !!SITE_LOCK_HASH;
    siteLockBadge.textContent = on ? "ON" : "OFF";
    siteLockBadge.className = `badge ${on ? "ok" : "neutral"}`;
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  generateSiteLockHashBtn?.addEventListener("click", async () => {
    const password = siteLockPassword.value;
    if (!password) {
      siteLockStatus.textContent = "Type a password first.";
      return;
    }
    siteLockHashOutput.value = await sha256Hex(password);
    siteLockStatus.textContent = "Hash generated — paste it into js/site-lock.js and deploy.";
  });

  renderRateFields();
  renderTravel();
})();
