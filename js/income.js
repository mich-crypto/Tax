(function () {
  // --- Overview: Gross/Net/Tax straight from Payslips, EUR-converted, this year vs last ---
  const overviewYearSelect = document.getElementById("overview-year-select");
  const overviewTable = document.getElementById("overview-table");
  const overviewTableBody = document.querySelector("#overview-table tbody");
  const overviewTableFoot = document.querySelector("#overview-table tfoot");
  const overviewEmptyState = document.getElementById("overview-empty-state");
  const overviewRateHint = document.getElementById("overview-rate-hint");
  const rateFieldsEl = document.getElementById("exchange-rate-fields");

  /** Converts a local-currency amount to EUR using the saved rates ("1 EUR = ? code"). Returns null if the rate is unknown. */
  function toEur(amount, currencyCode, rates) {
    if (!currencyCode || currencyCode === "EUR") return Number(amount) || 0;
    const rate = Number(rates[currencyCode]);
    if (!rate) return null;
    return (Number(amount) || 0) / rate;
  }

  function distinctNonEurCurrencies() {
    const set = new Set(Store.getPayslips().map((p) => p.currency).filter((c) => c && c !== "EUR"));
    return Array.from(set).sort();
  }

  function renderRateFields() {
    const currencies = distinctNonEurCurrencies();
    const rates = Store.getCurrencyRates();
    if (!currencies.length) {
      rateFieldsEl.innerHTML = `<p class="hint" style="margin:0;">Log a payslip in a non-EUR currency to set its exchange rate here.</p>`;
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

  /** Gross/Net/Tax for a year, straight from the Payslips log (the definitive source — see Payslips). */
  function payslipTotalsForYear(year, rates) {
    const totals = { gross: 0, net: 0, tax: 0, missingRate: false };
    Store.getPayslips()
      .filter((p) => p.year === year)
      .forEach((p) => {
        const gross = toEur(p.grossPay, p.currency, rates);
        const net = toEur(p.netPay, p.currency, rates);
        const tax = toEur(p.taxWithheld, p.currency, rates);
        if (gross === null || net === null || tax === null) {
          totals.missingRate = true;
          return;
        }
        totals.gross += gross;
        totals.net += net;
        totals.tax += tax;
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
    const years = collectYearsFromDates(Store.getPayslips().map((p) => `${p.year}-01-01`));
    const previous = overviewYearSelect.value;
    overviewYearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    overviewYearSelect.value = previous && years.some((y) => String(y) === previous)
      ? previous
      : String(currentYear());
  }

  function renderOverview() {
    const year = Number(overviewYearSelect.value) || currentYear();
    const rates = Store.getCurrencyRates();

    const thisPay = payslipTotalsForYear(year, rates);
    const lastPay = payslipTotalsForYear(year - 1, rates);

    if (!Store.getPayslips().length) {
      overviewTable.style.display = "none";
      overviewEmptyState.style.display = "block";
      overviewTableBody.innerHTML = "";
      overviewTableFoot.innerHTML = "";
      overviewRateHint.textContent = "";
      return;
    }
    overviewTable.style.display = "";
    overviewEmptyState.style.display = "none";

    const rows = [
      ["Gross pay", thisPay.gross, lastPay.gross],
      ["Net pay", thisPay.net, lastPay.net],
      ["Tax withheld", thisPay.tax, lastPay.tax],
    ];
    const missing = thisPay.missingRate || lastPay.missingRate;

    overviewTableBody.innerHTML = rows
      .map(([label, cur, prev]) => `
        <tr>
          <td>${label}</td>
          <td class="num">${formatMoney(cur, "€")}</td>
          <td class="num">${formatMoney(prev, "€")}</td>
          <td class="num">${formatChange(cur, prev)}</td>
        </tr>
      `)
      .join("");
    overviewTableFoot.innerHTML = "";

    overviewRateHint.textContent = missing
      ? "⚠ Some payslips use a currency without a set exchange rate and are excluded from these totals — set it below."
      : "";
  }

  overviewYearSelect.addEventListener("change", renderOverview);

  populateOverviewYearSelect();
  renderRateFields();
  renderOverview();
})();
