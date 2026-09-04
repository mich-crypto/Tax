(function () {
  const table = document.getElementById("years-table");
  const tbody = document.querySelector("#years-table tbody");
  const tfoot = document.querySelector("#years-table tfoot");
  const emptyState = document.getElementById("years-empty-state");
  const newTaxYear = document.getElementById("new-tax-year");
  const addYearBtn = document.getElementById("add-year-btn");

  function progressBadge(record) {
    const { done, total } = statusProgress(record);
    const cls = done === total ? "ok" : done === 0 ? "neutral" : "warn";
    return `<span class="badge ${cls}">${done}/${total}</span>`;
  }

  function render() {
    const records = Store.sortTaxYears(Store.getTaxYears().slice());
    const rows = records.map((record) => ({ record, totals: taxYearTotals(record) }));

    if (!rows.length) {
      table.style.display = "none";
      emptyState.style.display = "block";
      tbody.innerHTML = "";
      tfoot.innerHTML = "";
      return;
    }
    table.style.display = "";
    emptyState.style.display = "none";

    tbody.innerHTML = rows
      .map(({ record, totals }) => `
        <tr>
          <td>
            <a href="year.html?id=${encodeURIComponent(record.id)}"><strong>${record.taxYear}</strong></a>
          </td>
          <td class="num">${formatMoney(totals.gross, "€")}</td>
          <td class="num">${formatMoney(totals.tax, "€")}</td>
          <td class="num">${formatMoney(totals.netIncome, "€")}</td>
          <td class="num">${totals.gross ? formatPercent(totals.rate) : "—"}</td>
          <td>${progressBadge(record)}</td>
          <td><a class="btn small" href="year.html?id=${encodeURIComponent(record.id)}">View</a></td>
        </tr>
      `)
      .join("");

    const sum = (key) => rows.reduce((s, r) => s + r.totals[key], 0);
    const totalGross = sum("gross");
    const totalTax = sum("tax");
    tfoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${formatMoney(totalGross, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totalTax, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(sum("netIncome"), "€")}</strong></td>
        <td class="num"><strong>${totalGross ? formatPercent(totalTax / totalGross) : "—"}</strong></td>
        <td></td><td></td>
      </tr>
    `;
  }

  addYearBtn.addEventListener("click", () => {
    const taxYear = Number(newTaxYear.value);
    if (!Number.isInteger(taxYear)) {
      notify("Enter the tax year.");
      return;
    }
    const existing = Store.getTaxYears().find((y) => y.taxYear === taxYear);
    const record = Store.ensureTaxYear(taxYear);
    window.location.href = `year.html?id=${encodeURIComponent(record.id)}`;
  });

  newTaxYear.value = currentYear();
  render();
})();
