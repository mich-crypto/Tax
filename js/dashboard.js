(function () {
  const yearSelect = document.getElementById("year-select");
  const grid = document.getElementById("country-summary-grid");
  const totalsEl = document.getElementById("overall-totals");
  const tableBody = document.querySelector("#tax-years-table tbody");
  const table = document.getElementById("tax-years-table");
  const yearsEmptyState = document.getElementById("tax-years-empty-state");

  function isComplete(record) {
    return TAX_YEAR_STATUS_FIELDS.every((f) => record.status[f.key]);
  }

  function recordTotals(record) {
    return {
      income: record.countries.reduce((s, c) => s + Number(c.incomeEur || 0), 0),
      tax: record.countries.reduce((s, c) => s + Number(c.taxEur || 0), 0),
    };
  }

  function renderYearsTable(years) {
    if (!years.length) {
      table.style.display = "none";
      yearsEmptyState.style.display = "block";
      tableBody.innerHTML = "";
      return;
    }
    table.style.display = "";
    yearsEmptyState.style.display = "none";
    tableBody.innerHTML = years
      .map((y) => {
        const { income, tax } = recordTotals(y);
        return `
          <tr>
            <td>${y.incomeYear}</td>
            <td>${y.taxYear}</td>
            <td>${isComplete(y) ? '<span class="badge ok">Complete</span>' : '<span class="badge warn">In progress</span>'}</td>
            <td class="num">${formatMoney(income, "€")}</td>
            <td class="num">${formatMoney(tax, "€")}</td>
            <td><a href="tax-years.html">Open →</a></td>
          </tr>
        `;
      })
      .join("");
  }

  function render() {
    const years = Store.sortTaxYears(Store.getTaxYears().slice());
    renderYearsTable(years);

    if (!years.length) {
      yearSelect.innerHTML = "";
      grid.innerHTML = "";
      totalsEl.innerHTML = `<div class="empty-state">No tax years yet. Start one on the <a href="tax-years.html">Tax Years</a> page.</div>`;
      return;
    }

    const incomeYears = Array.from(new Set(years.map((y) => y.incomeYear))).sort((a, b) => b - a);
    if (yearSelect.options.length === 0) {
      incomeYears.forEach((y) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      });
      yearSelect.value = incomeYears[0];
    } else if (!incomeYears.includes(Number(yearSelect.value))) {
      yearSelect.innerHTML = incomeYears.map((y) => `<option value="${y}">${y}</option>`).join("");
      yearSelect.value = incomeYears[0];
    }

    const selectedYear = Number(yearSelect.value);
    const recordsForYear = years.filter((y) => y.incomeYear === selectedYear);

    const byCountry = {};
    recordsForYear.forEach((record) => {
      record.countries.forEach((c) => {
        const key = (c.country || "").trim() || "(unnamed)";
        if (!byCountry[key]) byCountry[key] = { income: 0, tax: 0 };
        byCountry[key].income += Number(c.incomeEur || 0);
        byCountry[key].tax += Number(c.taxEur || 0);
      });
    });

    const countryNames = Object.keys(byCountry);
    if (!countryNames.length) {
      grid.innerHTML = `<div class="empty-state">No countries added yet for ${selectedYear}. Add some on the <a href="tax-years.html">Tax Years</a> page.</div>`;
    } else {
      grid.innerHTML = countryNames
        .map((name) => {
          const totals = byCountry[name];
          const rate = totals.income ? (totals.tax / totals.income) * 100 : 0;
          return `
            <div class="card country-card">
              <div class="country-head">
                <div><div class="country-name">${escapeHtml(name)}</div></div>
              </div>
              <div class="stat-row"><span>Income (${selectedYear})</span><strong>${formatMoney(totals.income, "€")}</strong></div>
              <div class="stat-row"><span>Tax</span><strong>${formatMoney(totals.tax, "€")}</strong></div>
              <div class="stat-row"><span>Effective rate</span><strong>${totals.income ? rate.toFixed(1) + "%" : "—"}</strong></div>
            </div>
          `;
        })
        .join("");
    }

    const complete = years.filter(isComplete).length;
    totalsEl.innerHTML = `
      <div class="stat-row"><span>Tax years tracked</span><strong>${years.length}</strong></div>
      <div class="stat-row"><span>Complete</span><strong>${complete} / ${years.length}</strong></div>
    `;
  }

  yearSelect.addEventListener("change", render);
  render();

  // --- Data export / import / wipe (moved here from the retired Countries page) ---
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
        render();
        alert("Import complete.");
      } catch (e) {
        alert("That file doesn't look like a valid export (invalid JSON).");
      }
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  wipeBtn.addEventListener("click", () => {
    if (!confirm("This deletes ALL data (income, residency, correspondence, tax years, payslips) stored in this browser. This cannot be undone. Continue?")) {
      return;
    }
    Store.wipeAll();
    render();
  });
})();
