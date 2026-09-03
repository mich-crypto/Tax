(function () {
  const yearSelect = document.getElementById("tax-year-select");
  const addYearBtn = document.getElementById("add-year-btn");
  const deleteYearBtn = document.getElementById("delete-year-btn");
  const alsoTrackedHint = document.getElementById("also-tracked-hint");

  const denmarkForm = document.getElementById("denmark-form");
  const dkIncomeInput = document.getElementById("dk-income");
  const dkTaxPaidInput = document.getElementById("dk-tax-paid");
  const dkTaxRefundInput = document.getElementById("dk-tax-refund");
  const dkNotesInput = document.getElementById("dk-notes");

  const abroadForm = document.getElementById("abroad-form");
  const abroadCountryInput = document.getElementById("abroad-country");
  const abroadCountryList = document.getElementById("abroad-country-list");
  const abroadAmountInput = document.getElementById("abroad-amount");
  const abroadCurrencySelect = document.getElementById("abroad-currency");
  const abroadDateInput = document.getElementById("abroad-date");
  const abroadNotesInput = document.getElementById("abroad-notes");
  const abroadTableBody = document.querySelector("#abroad-table tbody");
  const abroadTable = document.getElementById("abroad-table");
  const abroadEmptyState = document.getElementById("abroad-empty-state");

  const summaryEl = document.getElementById("tax-year-summary");

  function currentSelectedYear() {
    return Number(yearSelect.value);
  }

  function populateStaticLists() {
    abroadCountryList.innerHTML = Store.getCountries()
      .map((c) => `<option value="${escapeHtml(c.name)}">`)
      .join("");
    abroadCurrencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
  }

  function populateYearSelect(selectYear) {
    const existingYears = Store.getTaxYears().map((y) => y.year);
    const years = new Set([...existingYears, currentYear()]);
    if (selectYear) years.add(selectYear);
    const sorted = Array.from(years).sort((a, b) => b - a);
    const previous = selectYear || Number(yearSelect.value) || currentYear();
    yearSelect.innerHTML = sorted.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearSelect.value = sorted.includes(previous) ? previous : sorted[0];
  }

  function renderAlsoTracked(year) {
    const incomeCount = Store.getIncome().filter((e) => new Date(e.date).getFullYear() === year).length;
    const residencyDays = Store.getResidency().reduce(
      (sum, r) => sum + daysInYearOverlap(r.startDate, r.endDate, year), 0
    );
    alsoTrackedHint.innerHTML = `Also tracked for ${year}: <a href="income.html">${incomeCount} income entr${incomeCount === 1 ? "y" : "ies"}</a> · <a href="residency.html">${residencyDays} residency day${residencyDays === 1 ? "" : "s"}</a> logged elsewhere in the tracker.`;
  }

  function loadDenmarkForm(year) {
    const record = Store.getTaxYear(year);
    dkIncomeInput.value = record ? record.denmarkIncome || "" : "";
    dkTaxPaidInput.value = record ? record.denmarkTaxPaid || "" : "";
    dkTaxRefundInput.value = record ? record.denmarkTaxRefund || "" : "";
    dkNotesInput.value = record ? record.notes || "" : "";
  }

  function renderAbroadTable(year) {
    const record = Store.getTaxYear(year);
    const payments = (record ? record.abroadPayments : []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    if (!payments.length) {
      abroadTable.style.display = "none";
      abroadEmptyState.style.display = "block";
      return;
    }
    abroadTable.style.display = "";
    abroadEmptyState.style.display = "none";

    const symbolFor = (code) => (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";

    abroadTableBody.innerHTML = payments
      .map((p) => `
        <tr>
          <td>${p.date || "—"}</td>
          <td>${escapeHtml(p.country)}</td>
          <td class="num">${formatMoney(p.amount, symbolFor(p.currency))} ${escapeHtml(p.currency || "")}</td>
          <td>${escapeHtml(p.notes || "")}</td>
          <td><button class="icon-btn small" data-delete="${p.id}" title="Delete">✕</button></td>
        </tr>
      `)
      .join("");
  }

  function renderSummary(year) {
    const record = Store.getTaxYear(year);
    const symbolFor = (code) => (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";

    const dkIncome = record ? record.denmarkIncome || 0 : 0;
    const dkTaxPaid = record ? record.denmarkTaxPaid || 0 : 0;
    const dkTaxRefund = record ? record.denmarkTaxRefund || 0 : 0;

    const byCurrency = {};
    (record ? record.abroadPayments : []).forEach((p) => {
      byCurrency[p.currency] = (byCurrency[p.currency] || 0) + Number(p.amount || 0);
    });
    const abroadTotalDkk = byCurrency.DKK || 0;

    const abroadLines = Object.keys(byCurrency).length
      ? Object.entries(byCurrency)
          .map(([code, total]) => `<div class="stat-row"><span>Paid abroad — ${escapeHtml(code)}</span><strong>${formatMoney(total, symbolFor(code))}</strong></div>`)
          .join("")
      : `<div class="stat-row"><span>Paid abroad</span><strong>${formatMoney(0, "kr")}</strong></div>`;

    summaryEl.innerHTML = `
      <div class="stat-row"><span>Income from Denmark</span><strong>${formatMoney(dkIncome, "kr")}</strong></div>
      <div class="stat-row"><span>Tax paid in Denmark</span><strong>${formatMoney(dkTaxPaid, "kr")}</strong></div>
      <div class="stat-row"><span>Tax refunded from Denmark</span><strong>${formatMoney(dkTaxRefund, "kr")}</strong></div>
      ${abroadLines}
      ${abroadTotalDkk ? `<div class="stat-row"><span>Danish refund left after DKK payments abroad</span><strong>${formatMoney(dkTaxRefund - abroadTotalDkk, "kr")}</strong></div>` : ""}
      <p class="hint">Amounts in different currencies aren't converted or summed together — no exchange rate is applied. Compare the lines above to see roughly how the Danish refund covers what you paid abroad.</p>
    `;
  }

  function loadYear(year) {
    renderAlsoTracked(year);
    loadDenmarkForm(year);
    renderAbroadTable(year);
    renderSummary(year);
  }

  yearSelect.addEventListener("change", () => loadYear(currentSelectedYear()));

  addYearBtn.addEventListener("click", () => {
    const input = prompt("Which tax year? (e.g. 2025)", String(currentYear() + 1));
    if (!input) return;
    const year = Number(input);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      alert("Enter a valid 4-digit year.");
      return;
    }
    populateYearSelect(year);
    loadYear(year);
  });

  deleteYearBtn.addEventListener("click", () => {
    const year = currentSelectedYear();
    if (!confirm(`Delete all Tax Year data for ${year} (Denmark figures and abroad payments)? This can't be undone.`)) return;
    Store.deleteTaxYear(year);
    populateYearSelect();
    loadYear(currentSelectedYear());
  });

  denmarkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = currentSelectedYear();
    Store.upsertTaxYear(year, {
      denmarkIncome: Number(dkIncomeInput.value) || 0,
      denmarkTaxPaid: Number(dkTaxPaidInput.value) || 0,
      denmarkTaxRefund: Number(dkTaxRefundInput.value) || 0,
      notes: dkNotesInput.value.trim(),
    });
    populateYearSelect(year);
    renderSummary(year);
  });

  abroadForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = currentSelectedYear();
    const country = abroadCountryInput.value.trim();
    if (!country) return;

    Store.addAbroadPayment(year, {
      country,
      amount: Number(abroadAmountInput.value) || 0,
      currency: abroadCurrencySelect.value,
      date: abroadDateInput.value || "",
      notes: abroadNotesInput.value.trim(),
    });

    abroadForm.reset();
    abroadCurrencySelect.value = "USD";
    renderAbroadTable(year);
    renderSummary(year);
  });

  abroadTableBody.addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    if (!confirm("Delete this abroad payment?")) return;
    Store.deleteAbroadPayment(currentSelectedYear(), id);
    renderAbroadTable(currentSelectedYear());
    renderSummary(currentSelectedYear());
  });

  populateStaticLists();
  populateYearSelect();
  abroadCurrencySelect.value = "USD";
  loadYear(currentSelectedYear());
})();
