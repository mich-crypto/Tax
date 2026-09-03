(function () {
  const form = document.getElementById("residency-form");
  const countrySelect = document.getElementById("residency-country");
  const startInput = document.getElementById("residency-start");
  const endInput = document.getElementById("residency-end");
  const yearFilter = document.getElementById("residency-year-filter");
  const tableBody = document.querySelector("#residency-table tbody");
  const emptyState = document.getElementById("residency-empty-state");
  const table = document.getElementById("residency-table");
  const summaryGrid = document.getElementById("residency-summary-grid");

  function populateCountrySelect() {
    const countries = Store.getCountries();
    countrySelect.innerHTML = countries
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
  }

  function populateYearFilter() {
    const entries = Store.getResidency();
    const years = collectYearsFromDates(entries.map((e) => e.startDate));
    const previous = yearFilter.value;
    yearFilter.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    yearFilter.value = previous && [...yearFilter.options].some((o) => o.value === previous)
      ? previous
      : String(currentYear());
  }

  function renderSummary(year) {
    const countries = Store.getCountries();
    const residency = Store.getResidency();
    summaryGrid.innerHTML = countries
      .map((country) => {
        const days = residency
          .filter((r) => r.countryId === country.id)
          .reduce((sum, r) => sum + daysInYearOverlap(r.startDate, r.endDate, year), 0);
        const threshold = country.residencyThresholdDays || 183;
        const pct = Math.min(100, Math.round((days / threshold) * 100));
        let progressClass = "";
        let badge = `<span class="badge ok">${days} / ${threshold}</span>`;
        if (days >= threshold) {
          progressClass = "over";
          badge = `<span class="badge danger">Threshold reached</span>`;
        } else if (pct >= 75) {
          progressClass = "warn";
          badge = `<span class="badge warn">${days} / ${threshold}</span>`;
        }
        return `
          <div class="card country-card">
            <div class="country-head">
              <div class="country-name">${escapeHtml(country.name)}</div>
              ${badge}
            </div>
            <div class="progress ${progressClass}"><span style="width:${pct}%"></span></div>
            <div class="hint">${days} day${days === 1 ? "" : "s"} tracked in ${year}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderTable() {
    const countries = Store.getCountries();
    const countryById = Object.fromEntries(countries.map((c) => [c.id, c]));
    const year = Number(yearFilter.value) || currentYear();

    let entries = Store.getResidency().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    if (!entries.length) {
      table.style.display = "none";
      emptyState.style.display = "block";
    } else {
      table.style.display = "";
      emptyState.style.display = "none";
      tableBody.innerHTML = entries
        .map((e) => {
          const country = countryById[e.countryId];
          const name = country ? country.name : "(deleted country)";
          const days = daysBetweenInclusive(e.startDate, e.endDate);
          return `
            <tr>
              <td>${escapeHtml(name)}</td>
              <td>${e.startDate}</td>
              <td>${e.endDate}</td>
              <td class="num">${days}</td>
              <td>${escapeHtml(e.note || "")}</td>
              <td><button class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button></td>
            </tr>
          `;
        })
        .join("");
    }

    renderSummary(year);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const start = startInput.value;
    const end = endInput.value || start;
    if (!start) return;
    if (new Date(end) < new Date(start)) {
      alert("End date must be on or after the start date.");
      return;
    }

    Store.addResidency({
      countryId: countrySelect.value,
      startDate: start,
      endDate: end,
      note: document.getElementById("residency-note").value.trim(),
    });

    form.reset();
    populateYearFilter();
    renderTable();
  });

  tableBody.addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (!id) return;
    if (!confirm("Delete this residency entry?")) return;
    Store.deleteResidency(id);
    populateYearFilter();
    renderTable();
  });

  yearFilter.addEventListener("change", renderTable);

  populateCountrySelect();
  populateYearFilter();
  renderTable();
})();
