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

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

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
  });

  tableBody.addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    if (!confirm("Delete this income entry?")) return;
    Store.deleteIncome(id);
    populateYearFilter();
    renderTable();
  });

  yearFilter.addEventListener("change", renderTable);

  dateInput.value = new Date().toISOString().slice(0, 10);
  populateSelects();
  currencySelect.value = "EUR";
  populateYearFilter();
  renderTable();
})();
