(function () {
  const yearSelect = document.getElementById("tax-year-select");
  const newIncomeYearInput = document.getElementById("new-income-year");
  const newTaxYearInput = document.getElementById("new-tax-year");
  const openYearBtn = document.getElementById("open-year-btn");
  const deleteYearBtn = document.getElementById("delete-year-btn");
  const alsoTrackedHint = document.getElementById("also-tracked-hint");
  const bodyEl = document.getElementById("tax-year-body");

  const statusFieldsEl = document.getElementById("status-fields");

  const fxRateInput = document.getElementById("fx-rate");
  const fxAmountEurInput = document.getElementById("fx-amount-eur");
  const fxAmountDkkInput = document.getElementById("fx-amount-dkk");

  const countryList = document.getElementById("tax-year-country-list");
  const countryRowForm = document.getElementById("country-row-form");
  const rowCountryInput = document.getElementById("row-country");
  const rowDaysInput = document.getElementById("row-days");
  const rowIncomeInput = document.getElementById("row-income");
  const rowTaxInput = document.getElementById("row-tax");
  const countryTableBody = document.querySelector("#country-table tbody");
  const countryTableFoot = document.querySelector("#country-table tfoot");
  const countryTable = document.getElementById("country-table");
  const countryEmptyState = document.getElementById("country-empty-state");

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

  const followUpForm = document.getElementById("followup-form");
  const followUpTopicInput = document.getElementById("followup-topic");
  const followUpDateInput = document.getElementById("followup-date");
  const followUpCountryInput = document.getElementById("followup-country");
  const followUpTableBody = document.querySelector("#followup-table tbody");
  const followUpTable = document.getElementById("followup-table");
  const followUpEmptyState = document.getElementById("followup-empty-state");

  let currentId = null;

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  function populateStaticLists() {
    countryList.innerHTML = Store.getCountries()
      .map((c) => `<option value="${escapeHtml(c.name)}">`)
      .join("");
    actionList.innerHTML = TAX_YEAR_ACTIONS
      .map((a) => `<option value="${escapeHtml(a)}">`)
      .join("");
    activityCurrencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
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

  function renderAlsoTracked(incomeYear) {
    const incomeCount = Store.getIncome().filter((e) => new Date(e.date).getFullYear() === incomeYear).length;
    const residencyDays = Store.getResidency().reduce(
      (sum, r) => sum + daysInYearOverlap(r.startDate, r.endDate, incomeYear), 0
    );
    alsoTrackedHint.innerHTML = `For income year ${incomeYear}, also tracked elsewhere: <a href="income.html">${incomeCount} income entr${incomeCount === 1 ? "y" : "ies"}</a> · <a href="residency.html">${residencyDays} residency day${residencyDays === 1 ? "" : "s"}</a>.`;
  }

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

  function updateFxConverter() {
    const rate = Number(fxRateInput.value);
    const amount = Number(fxAmountEurInput.value);
    if (!rate || !amount) {
      fxAmountDkkInput.value = "";
      return;
    }
    fxAmountDkkInput.value = formatMoney(amount * rate, "kr");
  }

  function renderCountryTable(record) {
    const rows = record.countries;
    const rate = Number(record.fxRateDkkPerEur) || 0;

    if (!rows.length) {
      countryTable.style.display = "none";
      countryEmptyState.style.display = "block";
      countryTableBody.innerHTML = "";
      countryTableFoot.innerHTML = "";
      return;
    }
    countryTable.style.display = "";
    countryEmptyState.style.display = "none";

    const totalDays = rows.reduce((s, r) => s + Number(r.days || 0), 0);
    const totalIncome = rows.reduce((s, r) => s + Number(r.incomeEur || 0), 0);
    const totalTax = rows.reduce((s, r) => s + Number(r.taxEur || 0), 0);

    countryTableBody.innerHTML = rows
      .map((r) => {
        const days = Number(r.days || 0);
        const incomeEur = Number(r.incomeEur || 0);
        const taxEur = Number(r.taxEur || 0);
        const pctDays = totalDays ? (days / totalDays) * 100 : 0;
        const taxRate = incomeEur ? (taxEur / incomeEur) * 100 : 0;
        return `
          <tr>
            <td>${escapeHtml(r.country)}</td>
            <td class="num">${days}</td>
            <td class="num">${pctDays.toFixed(1)}%</td>
            <td class="num">${formatMoney(incomeEur, "€")}</td>
            <td class="num">${rate ? formatMoney(incomeEur * rate, "kr") : "—"}</td>
            <td class="num">${formatMoney(taxEur, "€")}</td>
            <td class="num">${rate ? formatMoney(taxEur * rate, "kr") : "—"}</td>
            <td class="num">${incomeEur ? taxRate.toFixed(1) + "%" : "—"}</td>
            <td><button class="icon-btn small" data-delete-row="${r.id}" title="Delete">✕</button></td>
          </tr>
        `;
      })
      .join("");

    const overallRate = totalIncome ? (totalTax / totalIncome) * 100 : 0;
    countryTableFoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${totalDays}</strong></td>
        <td class="num"><strong>100%</strong></td>
        <td class="num"><strong>${formatMoney(totalIncome, "€")}</strong></td>
        <td class="num"><strong>${rate ? formatMoney(totalIncome * rate, "kr") : "—"}</strong></td>
        <td class="num"><strong>${formatMoney(totalTax, "€")}</strong></td>
        <td class="num"><strong>${rate ? formatMoney(totalTax * rate, "kr") : "—"}</strong></td>
        <td class="num"><strong>${totalIncome ? overallRate.toFixed(1) + "%" : "—"}</strong></td>
        <td></td>
      </tr>
    `;
  }

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

  function renderFollowUpTable(record) {
    const rows = record.followUps.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!rows.length) {
      followUpTable.style.display = "none";
      followUpEmptyState.style.display = "block";
      followUpTableBody.innerHTML = "";
      return;
    }
    followUpTable.style.display = "";
    followUpEmptyState.style.display = "none";

    followUpTableBody.innerHTML = rows
      .map((f) => `
        <tr>
          <td>${escapeHtml(f.topic)}</td>
          <td>${f.date || "—"}</td>
          <td>${escapeHtml(f.country || "")}</td>
          <td><button class="icon-btn small" data-delete-followup="${f.id}" title="Delete">✕</button></td>
        </tr>
      `)
      .join("");
  }

  function openYear(id) {
    const record = Store.getTaxYearById(id);
    if (!record) {
      bodyEl.hidden = true;
      alsoTrackedHint.textContent = "";
      currentId = null;
      return;
    }
    currentId = id;
    bodyEl.hidden = false;
    yearSelect.value = id;

    renderAlsoTracked(record.incomeYear);
    renderStatusFields(record);
    fxRateInput.value = record.fxRateDkkPerEur || "";
    fxAmountEurInput.value = "";
    fxAmountDkkInput.value = "";
    renderCountryTable(record);
    renderActivityTable(record);
    renderFollowUpTable(record);
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
    if (!confirm(`Delete the entire record for ${yearLabel(record)}? This removes its status, country rows, activities, and follow-ups. This can't be undone.`)) {
      return;
    }
    Store.deleteTaxYearRecord(currentId);
    populateYearSelect();
    const years = Store.getTaxYears();
    openYear(years.length ? yearSelect.value : null);
  });

  fxRateInput.addEventListener("change", () => {
    if (!currentId) return;
    Store.updateTaxYearMeta(currentId, { fxRateDkkPerEur: Number(fxRateInput.value) || null });
    renderCountryTable(Store.getTaxYearById(currentId));
    updateFxConverter();
  });
  fxAmountEurInput.addEventListener("input", updateFxConverter);

  countryRowForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentId) return;
    const country = rowCountryInput.value.trim();
    if (!country) return;
    Store.addCountryRow(currentId, {
      country,
      days: Number(rowDaysInput.value) || 0,
      incomeEur: Number(rowIncomeInput.value) || 0,
      taxEur: Number(rowTaxInput.value) || 0,
    });
    countryRowForm.reset();
    renderCountryTable(Store.getTaxYearById(currentId));
  });

  countryTableBody.addEventListener("click", (event) => {
    const rowId = event.target.dataset.deleteRow;
    if (!rowId || !currentId) return;
    if (!confirm("Delete this country row?")) return;
    Store.deleteCountryRow(currentId, rowId);
    renderCountryTable(Store.getTaxYearById(currentId));
  });

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

  followUpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentId) return;
    const topic = followUpTopicInput.value.trim();
    if (!topic) return;
    Store.addTaxYearFollowUp(currentId, {
      topic,
      date: followUpDateInput.value || "",
      country: followUpCountryInput.value.trim(),
    });
    followUpForm.reset();
    renderFollowUpTable(Store.getTaxYearById(currentId));
  });

  followUpTableBody.addEventListener("click", (event) => {
    const followUpId = event.target.dataset.deleteFollowup;
    if (!followUpId || !currentId) return;
    if (!confirm("Delete this follow up?")) return;
    Store.deleteTaxYearFollowUp(currentId, followUpId);
    renderFollowUpTable(Store.getTaxYearById(currentId));
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
