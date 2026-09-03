(function () {
  const statsEl = document.getElementById("headline-stats");
  const table = document.getElementById("years-table");
  const tbody = document.querySelector("#years-table tbody");
  const tfoot = document.querySelector("#years-table tfoot");
  const emptyState = document.getElementById("years-empty-state");
  const newIncomeYear = document.getElementById("new-income-year");
  const newTaxYear = document.getElementById("new-tax-year");
  const addYearBtn = document.getElementById("add-year-btn");

  function balanceBadge(amount) {
    if (!amount) return `<span class="badge neutral">—</span>`;
    const cls = amount > 0 ? "ok" : "danger";
    return `<span class="badge ${cls}">${formatSigned(amount, "€")}</span>`;
  }

  function progressBadge(record) {
    const { done, total } = statusProgress(record);
    const cls = done === total ? "ok" : done === 0 ? "neutral" : "warn";
    return `<span class="badge ${cls}">${done}/${total}</span>`;
  }

  function renderHeadlineStats(rows) {
    if (!rows.length) {
      statsEl.innerHTML = "";
      return;
    }
    const open = rows.filter((r) => statusProgress(r.record).done < statusProgress(r.record).total).length;
    const totalBalance = rows.reduce((s, r) => s + r.totals.balance, 0);
    const totalRefunded = rows.reduce((s, r) => s + r.totals.refunded, 0);
    const totalPaid = rows.reduce((s, r) => s + r.totals.taxPaid, 0);

    const tiles = [
      { label: "Refunded from Denmark", value: formatMoney(totalRefunded, "€"), hint: "across all years" },
      { label: "Tax paid elsewhere", value: formatMoney(totalPaid, "€"), hint: "across all years" },
      { label: "Balance", value: formatSigned(totalBalance, "€"), hint: totalBalance >= 0 ? "ahead overall" : "short overall", tone: totalBalance >= 0 ? "ok" : "danger" },
      { label: "Years still open", value: String(open), hint: `of ${rows.length} tracked` },
    ];

    statsEl.innerHTML = tiles
      .map((t) => `
        <div class="card stat-tile">
          <div class="stat-label">${escapeHtml(t.label)}</div>
          <div class="stat-value${t.tone ? " tone-" + t.tone : ""}">${escapeHtml(t.value)}</div>
          <div class="stat-hint">${escapeHtml(t.hint)}</div>
        </div>
      `)
      .join("");
  }

  function render() {
    const records = Store.sortTaxYears(Store.getTaxYears().slice());
    const rows = records.map((record) => ({ record, totals: taxYearTotals(record) }));

    renderHeadlineStats(rows);

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
            <a href="year.html?id=${encodeURIComponent(record.id)}"><strong>Tax ${record.taxYear}</strong></a>
            <div class="cell-sub">income ${record.incomeYear}</div>
          </td>
          <td class="num">${formatMoney(totals.gross, "€")}</td>
          <td class="num">${formatMoney(totals.refunded, "€")}</td>
          <td class="num">${formatMoney(totals.taxPaid, "€")}</td>
          <td class="num">${balanceBadge(totals.balance)}</td>
          <td class="num">${formatMoney(totals.netIncome, "€")}</td>
          <td class="num">${totals.gross ? formatPercent(totals.rate) : "—"}</td>
          <td>${progressBadge(record)}</td>
          <td><a class="btn small" href="year.html?id=${encodeURIComponent(record.id)}">View</a></td>
        </tr>
      `)
      .join("");

    const sum = (key) => rows.reduce((s, r) => s + r.totals[key], 0);
    const totalGross = sum("gross");
    const totalPaid = sum("taxPaid");
    tfoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${formatMoney(totalGross, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(sum("refunded"), "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totalPaid, "€")}</strong></td>
        <td class="num"><strong>${balanceBadge(sum("balance"))}</strong></td>
        <td class="num"><strong>${formatMoney(sum("netIncome"), "€")}</strong></td>
        <td class="num"><strong>${totalGross ? formatPercent(totalPaid / totalGross) : "—"}</strong></td>
        <td></td><td></td>
      </tr>
    `;
  }

  addYearBtn.addEventListener("click", () => {
    const incomeYear = Number(newIncomeYear.value);
    const taxYear = Number(newTaxYear.value);
    if (!Number.isInteger(incomeYear) || !Number.isInteger(taxYear)) {
      alert("Enter both an income year and a tax year.");
      return;
    }
    const existing = Store.getTaxYears().find((y) => y.incomeYear === incomeYear && y.taxYear === taxYear);
    const record = Store.ensureTaxYear(incomeYear, taxYear);
    if (existing) {
      alert(`${yearLabel(record)} already exists — opening it.`);
    }
    window.location.href = `year.html?id=${encodeURIComponent(record.id)}`;
  });

  // A tax return is filed the year after the income was earned.
  newIncomeYear.value = currentYear() - 1;
  newTaxYear.value = currentYear();
  render();
})();
