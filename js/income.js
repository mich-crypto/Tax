(function () {
  const form = document.getElementById("income-form");
  const countryInput = document.getElementById("income-country");
  const countryListEl = document.getElementById("income-country-list");
  const categorySelect = document.getElementById("income-category");
  const currencySelect = document.getElementById("income-currency");
  const dateInput = document.getElementById("income-date");
  const yearFilter = document.getElementById("income-year-filter");
  const tableBody = document.querySelector("#income-table tbody");
  const emptyState = document.getElementById("income-empty-state");
  const table = document.getElementById("income-table");

  // --- Overview: EUR-converted totals by country, this year vs last ---
  const overviewYearSelect = document.getElementById("overview-year-select");
  const overviewTable = document.getElementById("overview-table");
  const overviewTableBody = document.querySelector("#overview-table tbody");
  const overviewTableFoot = document.querySelector("#overview-table tfoot");
  const overviewEmptyState = document.getElementById("overview-empty-state");
  const overviewRateHint = document.getElementById("overview-rate-hint");
  const rateFieldsEl = document.getElementById("exchange-rate-fields");

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  /** Converts a local-currency amount to EUR using the saved rates ("1 EUR = ? code"). Returns null if the rate is unknown. */
  function toEur(amount, currencyCode, rates) {
    if (!currencyCode || currencyCode === "EUR") return Number(amount) || 0;
    const rate = Number(rates[currencyCode]);
    if (!rate) return null;
    return (Number(amount) || 0) / rate;
  }

  function distinctNonEurCurrencies() {
    const set = new Set(Store.getIncome().map((e) => e.currency).filter((c) => c && c !== "EUR"));
    return Array.from(set).sort();
  }

  function renderRateFields() {
    const currencies = distinctNonEurCurrencies();
    const rates = Store.getCurrencyRates();
    if (!currencies.length) {
      rateFieldsEl.innerHTML = `<p class="hint" style="margin:0;">Log an entry in a non-EUR currency to set its exchange rate here.</p>`;
      return;
    }
    rateFieldsEl.innerHTML = currencies
      .map((code) => `
        <div class="field">
          <label>1 EUR = ? ${escapeHtml(code)}</label>
          <input type="number" min="0" step="0.0001" class="rate-input" data-currency="${escapeHtml(code)}" value="${rates[code] || ""}" placeholder="e.g. 7.46">
        </div>
      `)
      .join("");
    rateFieldsEl.querySelectorAll(".rate-input").forEach((input) => {
      input.addEventListener("change", () => {
        const rates = Store.getCurrencyRates();
        const value = Number(input.value);
        if (value > 0) rates[input.dataset.currency] = value;
        else delete rates[input.dataset.currency];
        Store.saveCurrencyRates(rates);
        renderOverview();
      });
    });
  }

  function countryTotalsForYear(year, rates) {
    const totals = {};
    Store.getIncome()
      .filter((e) => new Date(e.date).getFullYear() === year)
      .forEach((e) => {
        const country = (e.country || "").trim() || "(no country)";
        if (!totals[country]) totals[country] = { eur: 0, missingRate: false };
        const eur = toEur(e.amount, e.currency, rates);
        if (eur === null) totals[country].missingRate = true;
        else totals[country].eur += eur;
      });
    return totals;
  }

  function formatChange(thisAmount, lastAmount) {
    if (!lastAmount) {
      return thisAmount ? `<span class="badge ok">New</span>` : `<span class="badge neutral">—</span>`;
    }
    const pct = ((thisAmount - lastAmount) / lastAmount) * 100;
    const cls = pct > 0 ? "ok" : pct < 0 ? "danger" : "neutral";
    const sign = pct > 0 ? "+" : "";
    return `<span class="badge ${cls}">${sign}${pct.toFixed(1)}%</span>`;
  }

  function populateOverviewYearSelect() {
    const years = collectYearsFromDates(Store.getIncome().map((e) => e.date));
    const previous = overviewYearSelect.value;
    overviewYearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    overviewYearSelect.value = previous && years.some((y) => String(y) === previous)
      ? previous
      : String(currentYear());
  }

  function renderOverview() {
    const year = Number(overviewYearSelect.value) || currentYear();
    const rates = Store.getCurrencyRates();
    const thisYear = countryTotalsForYear(year, rates);
    const lastYear = countryTotalsForYear(year - 1, rates);

    const countries = Array.from(new Set([...Object.keys(thisYear), ...Object.keys(lastYear)]))
      .sort((a, b) => (thisYear[b]?.eur || 0) - (thisYear[a]?.eur || 0));

    if (!countries.length) {
      overviewTable.style.display = "none";
      overviewEmptyState.style.display = "block";
      overviewTableBody.innerHTML = "";
      overviewTableFoot.innerHTML = "";
      overviewRateHint.textContent = "";
      return;
    }
    overviewTable.style.display = "";
    overviewEmptyState.style.display = "none";

    let anyMissing = false;
    overviewTableBody.innerHTML = countries
      .map((country) => {
        const cur = thisYear[country] || { eur: 0, missingRate: false };
        const prev = lastYear[country] || { eur: 0, missingRate: false };
        if (cur.missingRate || prev.missingRate) anyMissing = true;
        const flag = cur.missingRate || prev.missingRate
          ? ` <span class="badge warn" title="Some entries here use a currency without a set exchange rate and are excluded">⚠</span>`
          : "";
        return `
          <tr>
            <td>${escapeHtml(country)}${flag}</td>
            <td class="num">${formatMoney(cur.eur, "€")}</td>
            <td class="num">${formatMoney(prev.eur, "€")}</td>
            <td class="num">${formatChange(cur.eur, prev.eur)}</td>
          </tr>
        `;
      })
      .join("");

    const totalThis = countries.reduce((s, c) => s + (thisYear[c]?.eur || 0), 0);
    const totalLast = countries.reduce((s, c) => s + (lastYear[c]?.eur || 0), 0);
    overviewTableFoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${formatMoney(totalThis, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totalLast, "€")}</strong></td>
        <td class="num"><strong>${formatChange(totalThis, totalLast)}</strong></td>
      </tr>
    `;

    overviewRateHint.textContent = anyMissing
      ? "⚠ Some entries use a currency without a set exchange rate and are excluded from these totals — set it below."
      : "";
  }

  overviewYearSelect.addEventListener("change", renderOverview);

  function populateSelects() {
    countryListEl.innerHTML = COMMON_COUNTRIES
      .map((name) => `<option value="${escapeHtml(name)}">`)
      .join("");
    categorySelect.innerHTML = INCOME_CATEGORIES
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join("");
    currencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
  }

  countryInput.addEventListener("change", () => {
    const hint = COUNTRY_CURRENCY_HINTS[countryInput.value.trim().toLowerCase()];
    if (hint && [...currencySelect.options].some((o) => o.value === hint)) {
      currencySelect.value = hint;
    }
  });

  function populateYearFilter() {
    const entries = Store.getIncome();
    const years = collectYearsFromDates(entries.map((e) => e.date));
    const previous = yearFilter.value;
    yearFilter.innerHTML =
      `<option value="all">All years</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearFilter.value = previous && [...yearFilter.options].some((o) => o.value === previous)
      ? previous
      : String(currentYear());
  }

  function renderTable() {
    const yearValue = yearFilter.value;

    let entries = Store.getIncome().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (yearValue !== "all") {
      entries = entries.filter((e) => new Date(e.date).getFullYear() === Number(yearValue));
    }

    if (!entries.length) {
      table.style.display = "none";
      emptyState.style.display = "block";
      return;
    }
    table.style.display = "";
    emptyState.style.display = "none";

    tableBody.innerHTML = entries
      .map((e) => {
        const symbol = currencySymbolFor(e.currency);
        return `
          <tr>
            <td>${e.date}</td>
            <td>${escapeHtml(e.country || "")}</td>
            <td>${escapeHtml(e.category)}</td>
            <td>${escapeHtml(e.description || "")}</td>
            <td class="num">${formatMoney(e.amount, symbol)} ${escapeHtml(e.currency || "")}</td>
            <td><button class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button></td>
          </tr>
        `;
      })
      .join("");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(document.getElementById("income-amount").value);
    const country = countryInput.value.trim();
    if (!amount || amount <= 0 || !country) return;

    Store.addIncome({
      country,
      currency: currencySelect.value,
      date: dateInput.value || new Date().toISOString().slice(0, 10),
      category: categorySelect.value,
      description: document.getElementById("income-description").value.trim(),
      amount,
    });

    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    currencySelect.value = "EUR";
    populateYearFilter();
    renderTable();
    populateOverviewYearSelect();
    renderRateFields();
    renderOverview();
  });

  tableBody.addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    if (!confirm("Delete this income entry?")) return;
    Store.deleteIncome(id);
    populateYearFilter();
    renderTable();
    populateOverviewYearSelect();
    renderRateFields();
    renderOverview();
  });

  yearFilter.addEventListener("change", renderTable);

  dateInput.value = new Date().toISOString().slice(0, 10);
  populateSelects();
  currencySelect.value = "EUR";
  populateYearFilter();
  renderTable();
  populateOverviewYearSelect();
  renderRateFields();
  renderOverview();
})();
