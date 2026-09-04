(function () {
  // --- Exchange rates (→ EUR) ---
  // Only payslips carry a non-EUR amount now — tax years are EUR throughout —
  // so the fields shown are driven by the currencies actually logged, plus DKK,
  // which the Danish payroll always uses.
  const rateFieldsEl = document.getElementById("exchange-rate-fields");
  const ratesStatus = document.getElementById("rates-status");

  function currenciesNeedingRates() {
    const set = new Set(["DKK"]);
    Store.getPayslips().forEach((p) => {
      if (p.currency && p.currency !== "EUR") set.add(p.currency);
    });
    return Array.from(set).sort();
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

  renderRateFields();
  renderTravel();
})();
