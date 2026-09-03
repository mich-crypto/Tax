(function () {
  const form = document.getElementById("income-form");
  const countrySelect = document.getElementById("income-country");
  const categorySelect = document.getElementById("income-category");
  const dateInput = document.getElementById("income-date");
  const yearFilter = document.getElementById("income-year-filter");
  const tableBody = document.querySelector("#income-table tbody");
  const emptyState = document.getElementById("income-empty-state");
  const table = document.getElementById("income-table");

  function populateSelects() {
    const countries = Store.getCountries();
    countrySelect.innerHTML = countries
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
    categorySelect.innerHTML = INCOME_CATEGORIES
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join("");
  }

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
    const countries = Store.getCountries();
    const countryById = Object.fromEntries(countries.map((c) => [c.id, c]));
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
        const country = countryById[e.countryId];
        const symbol = country ? country.currencySymbol : "";
        const name = country ? country.name : "(deleted country)";
        return `
          <tr>
            <td>${e.date}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(e.category)}</td>
            <td>${escapeHtml(e.description || "")}</td>
            <td class="num">${formatMoney(e.amount, symbol)}</td>
            <td><button class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button></td>
          </tr>
        `;
      })
      .join("");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(document.getElementById("income-amount").value);
    if (!amount || amount <= 0) return;

    Store.addIncome({
      countryId: countrySelect.value,
      date: dateInput.value || new Date().toISOString().slice(0, 10),
      category: categorySelect.value,
      description: document.getElementById("income-description").value.trim(),
      amount,
    });

    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
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
  populateYearFilter();
  renderTable();
})();
