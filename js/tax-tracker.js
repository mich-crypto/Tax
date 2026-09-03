(function () {
  const yearSelect = document.getElementById("tax-year-select");
  const newIncomeYearInput = document.getElementById("new-income-year");
  const newTaxYearInput = document.getElementById("new-tax-year");
  const openYearBtn = document.getElementById("open-year-btn");
  const deleteYearBtn = document.getElementById("delete-year-btn");
  const bodyEl = document.getElementById("tax-year-body");

  const countryListEl = document.getElementById("tax-year-country-list");

  // ---------- Section tabs: Overview / Tax information / Correspondence ----------

  const sectionSubtabsEl = document.getElementById("section-subtabs");
  const overviewSection = document.getElementById("overview-section");
  const taxInfoSection = document.getElementById("tax-info-section");
  const correspondenceSection = document.getElementById("correspondence-section");
  let currentSection = "overview";

  function showSection(section) {
    currentSection = section;
    sectionSubtabsEl.querySelectorAll("[data-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === section);
    });
    overviewSection.hidden = section !== "overview";
    taxInfoSection.hidden = section !== "tax-info";
    correspondenceSection.hidden = section !== "correspondence";
  }

  sectionSubtabsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-section]");
    if (!btn) return;
    showSection(btn.dataset.section);
  });

  // ---------- Overview: status checklist ----------

  const statusFieldsEl = document.getElementById("status-fields");

  function renderStatusFields(record) {
    statusFieldsEl.innerHTML = TAX_YEAR_STATUS_FIELDS.map((f) => `
      <div class="field">
        <label>${escapeHtml(f.label)}</label>
        <select data-status-key="${f.key}">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
    `).join("");
    TAX_YEAR_STATUS_FIELDS.forEach((f) => {
      statusFieldsEl.querySelector(`[data-status-key="${f.key}"]`).value = record.status[f.key] ? "yes" : "no";
    });
    statusFieldsEl.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", () => {
        const record = Store.getTaxYearById(currentId);
        if (!record) return;
        record.status[select.dataset.statusKey] = select.value === "yes";
        Store.saveTaxYearRecord(record);
      });
    });
  }

  // ---------- Overview: per-country summary table ----------

  const countryTableBody = document.querySelector("#country-table tbody");
  const countryTableFoot = document.querySelector("#country-table tfoot");
  const countryTable = document.getElementById("country-table");
  const countryEmptyState = document.getElementById("country-empty-state");

  function renderCountrySummaryTable(record) {
    const rows = record.countries;

    if (!rows.length) {
      countryTable.style.display = "none";
      countryEmptyState.style.display = "block";
      countryTableBody.innerHTML = "";
      countryTableFoot.innerHTML = "";
      return;
    }
    countryTable.style.display = "";
    countryEmptyState.style.display = "none";

    const totalIncome = rows.reduce((s, r) => s + Number(r.incomeEur || 0), 0);
    const totalTax = rows.reduce((s, r) => s + Number(r.taxEur || 0), 0);

    countryTableBody.innerHTML = rows
      .map((r) => {
        const incomeEur = Number(r.incomeEur || 0);
        const taxEur = Number(r.taxEur || 0);
        const taxRate = incomeEur ? (taxEur / incomeEur) * 100 : 0;
        return `
          <tr>
            <td>${escapeHtml(r.country)}</td>
            <td class="num">${formatMoney(incomeEur, "€")}</td>
            <td class="num">${formatMoney(taxEur, "€")}</td>
            <td class="num">${incomeEur ? taxRate.toFixed(1) + "%" : "—"}</td>
          </tr>
        `;
      })
      .join("");

    const overallRate = totalIncome ? (totalTax / totalIncome) * 100 : 0;
    countryTableFoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${formatMoney(totalIncome, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totalTax, "€")}</strong></td>
        <td class="num"><strong>${totalIncome ? overallRate.toFixed(1) + "%" : "—"}</strong></td>
      </tr>
    `;
  }

  // ---------- Overview: payment activities ----------

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  const actionList = document.getElementById("tax-year-action-list");
  const activityForm = document.getElementById("activity-form");
  const activityActionInput = document.getElementById("activity-action");
  const activityDateInput = document.getElementById("activity-date");
  const activityAmountInput = document.getElementById("activity-amount");
  const activityCurrencySelect = document.getElementById("activity-currency");
  const activityCountryInput = document.getElementById("activity-country");
  const activityTableBody = document.querySelector("#activity-table tbody");
  const activityTableFoot = document.querySelector("#activity-table tfoot");
  const activityTable = document.getElementById("activity-table");
  const activityEmptyState = document.getElementById("activity-empty-state");

  function renderActivityTable(record) {
    const rows = record.activities.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!rows.length) {
      activityTable.style.display = "none";
      activityEmptyState.style.display = "block";
      activityTableBody.innerHTML = "";
      activityTableFoot.innerHTML = "";
      return;
    }
    activityTable.style.display = "";
    activityEmptyState.style.display = "none";

    activityTableBody.innerHTML = rows
      .map((a) => `
        <tr>
          <td>${escapeHtml(a.action)}</td>
          <td>${a.date || "—"}</td>
          <td class="num">${formatMoney(a.amount, currencySymbolFor(a.currency))} ${escapeHtml(a.currency || "")}</td>
          <td>${escapeHtml(a.country || "")}</td>
          <td><button class="icon-btn small" data-delete-activity="${a.id}" title="Delete">✕</button></td>
        </tr>
      `)
      .join("");

    const byCurrency = {};
    rows.forEach((a) => { byCurrency[a.currency] = (byCurrency[a.currency] || 0) + Number(a.amount || 0); });
    const totalsText = Object.entries(byCurrency)
      .map(([code, total]) => formatMoney(total, currencySymbolFor(code)) + " " + code)
      .join(" · ");
    activityTableFoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td><td></td>
        <td class="num"><strong>${totalsText}</strong></td>
        <td></td><td></td>
      </tr>
    `;
  }

  activityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentId) return;
    const action = activityActionInput.value.trim();
    if (!action) return;
    Store.addTaxYearActivity(currentId, {
      action,
      date: activityDateInput.value || "",
      amount: Number(activityAmountInput.value) || 0,
      currency: activityCurrencySelect.value,
      country: activityCountryInput.value.trim(),
    });
    activityForm.reset();
    activityCurrencySelect.value = "EUR";
    renderActivityTable(Store.getTaxYearById(currentId));
  });

  activityTableBody.addEventListener("click", (event) => {
    const activityId = event.target.dataset.deleteActivity;
    if (!activityId || !currentId) return;
    if (!confirm("Delete this activity?")) return;
    Store.deleteTaxYearActivity(currentId, activityId);
    renderActivityTable(Store.getTaxYearById(currentId));
  });

  // ---------- Tax information: one panel per country ----------

  const taxInfoEmptyState = document.getElementById("tax-info-empty-state");
  const countrySubtabsEl = document.getElementById("country-subtabs");
  const countryPanelsEl = document.getElementById("country-panels");
  const newCountryInput = document.getElementById("new-country-input");
  const addCountryBtn = document.getElementById("add-country-btn");

  let currentCountryId = null;

  function renderCountrySubtabs(record) {
    if (!record.countries.length) {
      countrySubtabsEl.innerHTML = "";
      countrySubtabsEl.style.display = "none";
      taxInfoEmptyState.style.display = "block";
      countryPanelsEl.style.display = "none";
      return;
    }
    countrySubtabsEl.style.display = "";
    taxInfoEmptyState.style.display = "none";
    countryPanelsEl.style.display = "";
    countrySubtabsEl.innerHTML = record.countries
      .map((c) => `<button type="button" class="subtab-btn${c.id === currentCountryId ? " active" : ""}" data-country-subtab="${c.id}">${escapeHtml(c.country)}</button>`)
      .join("");
  }

  function showCountrySubview(view) {
    const record = Store.getTaxYearById(currentId);
    if (!record) return;
    currentCountryId = record.countries.some((c) => c.id === view) ? view : (record.countries[0] ? record.countries[0].id : null);
    countryPanelsEl.querySelectorAll(".country-panel").forEach((panel) => {
      panel.hidden = panel.dataset.countryId !== currentCountryId;
    });
    renderCountrySubtabs(record);
  }

  function countryPanelHtml(row) {
    return `
      <div class="card country-panel" data-country-id="${row.id}" hidden>
        <div class="card-header">
          <h2>${escapeHtml(row.country)}</h2>
          <button type="button" class="danger-outline small" data-remove-country="${row.id}">Remove country</button>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Income (EUR)</label>
            <input type="number" min="0" step="0.01" class="country-income-input" data-row-id="${row.id}" value="${row.incomeEur || ""}" placeholder="0.00">
          </div>
          <div class="field">
            <label>Tax (EUR)</label>
            <input type="number" min="0" step="0.01" class="country-tax-input" data-row-id="${row.id}" value="${row.taxEur || ""}" placeholder="0.00">
          </div>
        </div>
        <p class="hint">Changes save automatically.</p>
      </div>
    `;
  }

  function renderCountryPanels(record) {
    countryPanelsEl.innerHTML = record.countries.map(countryPanelHtml).join("");
    countryPanelsEl.querySelectorAll(".country-income-input, .country-tax-input").forEach((input) => {
      input.addEventListener("change", () => {
        const record = Store.getTaxYearById(currentId);
        if (!record) return;
        const field = input.classList.contains("country-income-input") ? "incomeEur" : "taxEur";
        Store.updateCountryRow(currentId, input.dataset.rowId, { [field]: Number(input.value) || 0 });
        renderCountrySummaryTable(Store.getTaxYearById(currentId));
      });
    });
    countryPanelsEl.querySelectorAll("[data-remove-country]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm(`Remove ${btn.closest(".country-panel").querySelector("h2").textContent} from this tax year?`)) return;
        Store.deleteCountryRow(currentId, btn.dataset.removeCountry);
        const record = Store.getTaxYearById(currentId);
        renderCountryPanels(record);
        renderCountrySummaryTable(record);
        showCountrySubview(null);
      });
    });
  }

  countrySubtabsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-country-subtab]");
    if (!btn) return;
    showCountrySubview(btn.dataset.countrySubtab);
  });

  addCountryBtn.addEventListener("click", () => {
    if (!currentId) return;
    const country = newCountryInput.value.trim();
    if (!country) return;
    const record = Store.getTaxYearById(currentId);
    if (record.countries.some((c) => c.country.toLowerCase() === country.toLowerCase())) {
      alert(`${country} is already added to this tax year.`);
      return;
    }
    Store.addCountryRow(currentId, { country, incomeEur: 0, taxEur: 0 });
    newCountryInput.value = "";
    const updated = Store.getTaxYearById(currentId);
    renderCountryPanels(updated);
    renderCountrySummaryTable(updated);
    const added = updated.countries[updated.countries.length - 1];
    showCountrySubview(added.id);
  });

  // ---------- Correspondence (scoped to this tax year) ----------

  const correspondenceForm = document.getElementById("correspondence-form");
  const correspondenceCounterpartyInput = document.getElementById("correspondence-counterparty");
  const correspondenceCounterpartyList = document.getElementById("correspondence-counterparty-list");
  const correspondenceChannelSelect = document.getElementById("correspondence-channel");
  const correspondenceCategorySelect = document.getElementById("correspondence-category");
  const correspondenceDateInput = document.getElementById("correspondence-date");
  const correspondenceSubjectInput = document.getElementById("correspondence-subject");
  const correspondenceCountryInput = document.getElementById("correspondence-country");
  const correspondenceNotesInput = document.getElementById("correspondence-notes");
  const correspondenceFollowUpInput = document.getElementById("correspondence-followup");
  const correspondenceAmountInput = document.getElementById("correspondence-amount");
  const correspondenceCurrencySelect = document.getElementById("correspondence-currency");

  const correspondenceStatusFilter = document.getElementById("correspondence-status-filter");
  const correspondenceSearchInput = document.getElementById("correspondence-search");
  const correspondenceTableBody = document.querySelector("#correspondence-table tbody");
  const correspondenceEmptyState = document.getElementById("correspondence-empty-state");
  const correspondenceTable = document.getElementById("correspondence-table");
  const correspondenceOpenCountEl = document.getElementById("correspondence-open-count");

  function populateCorrespondenceStaticLists() {
    correspondenceCounterpartyList.innerHTML = CORRESPONDENCE_COUNTERPARTIES
      .map((name) => `<option value="${escapeHtml(name)}">`)
      .join("");
    correspondenceChannelSelect.innerHTML = CORRESPONDENCE_CHANNELS
      .map((ch) => `<option value="${ch}">${ch}</option>`)
      .join("");
    correspondenceCategorySelect.innerHTML = CORRESPONDENCE_CATEGORIES
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join("");
    correspondenceCurrencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
    correspondenceStatusFilter.innerHTML =
      `<option value="all">All statuses</option>` +
      CORRESPONDENCE_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
  }

  function badgeForStatus(status) {
    return status === "Resolved"
      ? `<span class="badge ok">Resolved</span>`
      : `<span class="badge warn">Open</span>`;
  }

  function renderCorrespondenceTable(record) {
    let entries = (record.correspondence || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const status = correspondenceStatusFilter.value;
    if (status !== "all") {
      entries = entries.filter((e) => e.status === status);
    }
    const query = correspondenceSearchInput.value.trim().toLowerCase();
    if (query) {
      entries = entries.filter((e) =>
        [e.counterparty, e.subject, e.notes, e.category, e.country].some((f) => (f || "").toLowerCase().includes(query))
      );
    }

    const openCount = (record.correspondence || []).filter((e) => e.status !== "Resolved").length;
    correspondenceOpenCountEl.textContent = openCount;

    if (!entries.length) {
      correspondenceTable.style.display = "none";
      correspondenceEmptyState.style.display = "block";
      return;
    }
    correspondenceTable.style.display = "";
    correspondenceEmptyState.style.display = "none";

    correspondenceTableBody.innerHTML = entries
      .map((e) => `
        <tr>
          <td>${e.date}</td>
          <td>${escapeHtml(e.counterparty)}</td>
          <td>${escapeHtml(e.channel)}</td>
          <td>${escapeHtml(e.category || "")}</td>
          <td>${escapeHtml(e.subject || "")}</td>
          <td>${escapeHtml(e.country || "")}</td>
          <td>${escapeHtml(e.notes || "")}</td>
          <td class="num">${e.amount ? formatMoney(e.amount, currencySymbolFor(e.currency)) : "—"}</td>
          <td>${e.followUp ? escapeHtml(e.followUp) : "—"}</td>
          <td>${badgeForStatus(e.status)}</td>
          <td class="actions-row" style="flex-wrap:nowrap;">
            <button type="button" class="icon-btn small" data-toggle="${e.id}" title="${e.status === "Resolved" ? "Reopen" : "Mark resolved"}">${e.status === "Resolved" ? "↺" : "✓"}</button>
            <button type="button" class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button>
          </td>
        </tr>
      `)
      .join("");
  }

  correspondenceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentId) return;
    const counterparty = correspondenceCounterpartyInput.value.trim();
    if (!counterparty) return;

    Store.addTaxYearCorrespondence(currentId, {
      date: correspondenceDateInput.value || new Date().toISOString().slice(0, 10),
      counterparty,
      channel: correspondenceChannelSelect.value,
      category: correspondenceCategorySelect.value,
      subject: correspondenceSubjectInput.value.trim(),
      country: correspondenceCountryInput.value.trim(),
      notes: correspondenceNotesInput.value.trim(),
      amount: correspondenceAmountInput.value ? Number(correspondenceAmountInput.value) : 0,
      currency: correspondenceCurrencySelect.value,
      followUp: correspondenceFollowUpInput.value || "",
      status: "Open",
    });

    correspondenceForm.reset();
    correspondenceDateInput.value = new Date().toISOString().slice(0, 10);
    correspondenceChannelSelect.value = CORRESPONDENCE_CHANNELS[0];
    correspondenceCategorySelect.value = CORRESPONDENCE_CATEGORIES[0];
    correspondenceCurrencySelect.value = "DKK";
    renderCorrespondenceTable(Store.getTaxYearById(currentId));
  });

  correspondenceTableBody.addEventListener("click", (event) => {
    if (!currentId) return;
    const toggleId = event.target.dataset.toggle;
    if (toggleId) {
      const record = Store.getTaxYearById(currentId);
      const entry = (record.correspondence || []).find((e) => e.id === toggleId);
      if (entry) {
        Store.updateTaxYearCorrespondence(currentId, toggleId, { status: entry.status === "Resolved" ? "Open" : "Resolved" });
        renderCorrespondenceTable(Store.getTaxYearById(currentId));
      }
      return;
    }
    const deleteId = event.target.dataset.delete;
    if (deleteId) {
      if (!confirm("Delete this correspondence entry?")) return;
      Store.deleteTaxYearCorrespondence(currentId, deleteId);
      renderCorrespondenceTable(Store.getTaxYearById(currentId));
    }
  });

  correspondenceStatusFilter.addEventListener("change", () => renderCorrespondenceTable(Store.getTaxYearById(currentId)));
  correspondenceSearchInput.addEventListener("input", () => renderCorrespondenceTable(Store.getTaxYearById(currentId)));

  // ---------- Year selection ----------

  let currentId = null;

  function populateStaticLists() {
    countryListEl.innerHTML = COMMON_COUNTRIES
      .map((name) => `<option value="${escapeHtml(name)}">`)
      .join("");
    actionList.innerHTML = TAX_YEAR_ACTIONS
      .map((a) => `<option value="${escapeHtml(a)}">`)
      .join("");
    activityCurrencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
    populateCorrespondenceStaticLists();
  }

  function yearLabel(record) {
    return `Income ${record.incomeYear} → Tax ${record.taxYear}`;
  }

  function populateYearSelect(selectId) {
    const years = Store.sortTaxYears(Store.getTaxYears().slice());
    const previous = selectId || yearSelect.value;
    yearSelect.innerHTML = years.length
      ? years.map((y) => `<option value="${y.id}">${yearLabel(y)}</option>`).join("")
      : `<option value="">No tax years yet</option>`;
    if (previous && years.some((y) => y.id === previous)) {
      yearSelect.value = previous;
    } else if (years.length) {
      yearSelect.value = years[0].id;
    }
  }

  function openYear(id) {
    const record = Store.getTaxYearById(id);
    if (!record) {
      bodyEl.hidden = true;
      currentId = null;
      return;
    }
    currentId = id;
    currentCountryId = null;
    bodyEl.hidden = false;
    yearSelect.value = id;
    showSection("overview");

    renderStatusFields(record);
    renderCountrySummaryTable(record);
    renderActivityTable(record);

    renderCountryPanels(record);
    showCountrySubview(record.countries[0] ? record.countries[0].id : null);

    correspondenceStatusFilter.value = "all";
    correspondenceSearchInput.value = "";
    correspondenceDateInput.value = new Date().toISOString().slice(0, 10);
    correspondenceChannelSelect.value = CORRESPONDENCE_CHANNELS[0];
    correspondenceCategorySelect.value = CORRESPONDENCE_CATEGORIES[0];
    correspondenceCurrencySelect.value = "DKK";
    renderCorrespondenceTable(record);
  }

  openYearBtn.addEventListener("click", () => {
    const incomeYear = Number(newIncomeYearInput.value);
    const taxYear = Number(newTaxYearInput.value);
    if (!Number.isInteger(incomeYear) || !Number.isInteger(taxYear)) {
      alert("Enter both an income year and a tax year.");
      return;
    }
    const record = Store.ensureTaxYear(incomeYear, taxYear);
    populateYearSelect(record.id);
    openYear(record.id);
  });

  yearSelect.addEventListener("change", () => openYear(yearSelect.value));

  deleteYearBtn.addEventListener("click", () => {
    if (!currentId) return;
    const record = Store.getTaxYearById(currentId);
    if (!record) return;
    if (!confirm(`Delete the entire record for ${yearLabel(record)}? This removes its status, country tabs, activities, and correspondence. This can't be undone.`)) {
      return;
    }
    Store.deleteTaxYearRecord(currentId);
    populateYearSelect();
    const years = Store.getTaxYears();
    openYear(years.length ? yearSelect.value : null);
  });

  // Defaults for a first-time "new" entry: last calendar year's income, filed this year.
  newIncomeYearInput.value = currentYear() - 1;
  newTaxYearInput.value = currentYear();

  populateStaticLists();
  activityCurrencySelect.value = "EUR";
  populateYearSelect();
  const years = Store.getTaxYears();
  openYear(years.length ? yearSelect.value : null);
})();
