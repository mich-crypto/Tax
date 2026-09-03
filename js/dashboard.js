(function () {
  const yearSelect = document.getElementById("year-select");
  const grid = document.getElementById("country-summary-grid");
  const totalsEl = document.getElementById("overall-totals");

  function render() {
    const countries = Store.getCountries();
    const income = Store.getIncome();
    const residency = Store.getResidency();

    const years = collectYearsFromDates(income.map((e) => e.date));
    if (yearSelect.options.length === 0) {
      years.forEach((y) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      });
      yearSelect.value = currentYear();
    }
    const year = Number(yearSelect.value) || currentYear();

    grid.innerHTML = "";
    let countriesWithData = 0;

    countries.forEach((country) => {
      const yearIncome = income.filter(
        (e) => e.countryId === country.id && new Date(e.date).getFullYear() === year
      );
      const total = yearIncome.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const tax = calculateTax(country.brackets, total);
      const rate = effectiveRate(country.brackets, total);

      const days = residency
        .filter((r) => r.countryId === country.id)
        .reduce((sum, r) => sum + daysInYearOverlap(r.startDate, r.endDate, year), 0);
      const threshold = country.residencyThresholdDays || 183;
      const pct = Math.min(100, Math.round((days / threshold) * 100));
      let progressClass = "";
      let badge = `<span class="badge ok">${days} / ${threshold} days</span>`;
      if (days >= threshold) {
        progressClass = "over";
        badge = `<span class="badge danger">Resident threshold reached</span>`;
      } else if (pct >= 75) {
        progressClass = "warn";
        badge = `<span class="badge warn">${days} / ${threshold} days</span>`;
      }

      if (yearIncome.length || days) countriesWithData++;

      const card = document.createElement("div");
      card.className = "card country-card";
      card.innerHTML = `
        <div class="country-head">
          <div>
            <div class="country-name">${escapeHtml(country.name)}</div>
            <div class="country-currency">${escapeHtml(country.currencyCode)}</div>
          </div>
          ${badge}
        </div>
        <div class="stat-row"><span>Income (${year})</span><strong>${formatMoney(total, country.currencySymbol)}</strong></div>
        <div class="stat-row"><span>Est. tax</span><strong>${formatMoney(tax, country.currencySymbol)}</strong></div>
        <div class="stat-row"><span>Effective rate</span><strong>${formatPercent(rate)}</strong></div>
        <div class="progress ${progressClass}"><span style="width:${pct}%"></span></div>
        <div class="hint">Residency day count toward ${threshold}-day threshold</div>
      `;
      grid.appendChild(card);
    });

    if (countriesWithData === 0) {
      totalsEl.innerHTML = `<div class="empty-state">No income or residency data yet for ${year}. Add some on the <a href="income.html">Income</a> or <a href="residency.html">Residency</a> pages.</div>`;
    } else {
      const totalIncomeEntries = income.filter((e) => new Date(e.date).getFullYear() === year).length;
      totalsEl.innerHTML = `<div class="stat-row"><span>Tracked countries with data</span><strong>${countriesWithData} / ${countries.length}</strong></div>
      <div class="stat-row"><span>Income entries logged (${year})</span><strong>${totalIncomeEntries}</strong></div>`;
    }
  }

  yearSelect.addEventListener("change", render);
  render();
})();
