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
        renderAll();
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

  /** This year's EUR-converted "Refund received" activities from the matching Tax Tracker year (same incomeYear), across all its countries. */
  function refundedForIncomeYear(year, rates) {
    const record = Store.getTaxYears().find((r) => r.incomeYear === year);
    if (!record) return { total: 0, missingRate: false };
    let total = 0;
    let missingRate = false;
    (record.activities || [])
      .filter((a) => (a.action || "").trim().toLowerCase() === "refund received")
      .forEach((a) => {
        const eur = toEur(a.amount, a.currency, rates);
        if (eur === null) missingRate = true;
        else total += eur;
      });
    return { total, missingRate };
  }

  // --- Income flow: a small Sankey-style diagram — Gross pay splits into Net
  // pay (kept) and Tax withheld, which itself splits into Refunded (comes
  // back) and Net tax (what actually stays with the tax authority). ---

  const flowChartEl = document.getElementById("income-flow-chart");
  const flowEmptyEl = document.getElementById("income-flow-empty-state");

  function ribbonPath(x0, y0top, y0bot, x1, y1top, y1bot) {
    const xm = (x0 + x1) / 2;
    return `M ${x0} ${y0top} C ${xm} ${y0top} ${xm} ${y1top} ${x1} ${y1top} L ${x1} ${y1bot} C ${xm} ${y1bot} ${xm} ${y0bot} ${x0} ${y0bot} Z`;
  }

  function renderIncomeFlow(year, rates) {
    const pay = payslipTotalsForYear(year, rates);
    const { total: refunded, missingRate: refundMissing } = refundedForIncomeYear(year, rates);

    if (!pay.gross) {
      flowChartEl.style.display = "none";
      flowEmptyEl.style.display = "block";
      flowChartEl.innerHTML = "";
      return;
    }
    flowChartEl.style.display = "";
    flowEmptyEl.style.display = "none";

    const gross = pay.gross;
    const net = Math.max(pay.net, 0);
    const taxWithheld = Math.max(pay.tax, 0);
    const netTax = Math.max(taxWithheld - refunded, 0);
    const hasRefund = refunded > 0;
    // Payslips don't track "other deductions" as a number (only free-text notes),
    // so the diagram scales by what it can actually account for — net + tax
    // withheld — rather than gross. The Gross pay label still shows the real
    // figure even if it's a little higher than net + tax (pension etc.).
    const accounted = net + taxWithheld;

    const W = 680, H = 200, top = 30, colW = 14, gap = 5;
    const col0X = 16, col1X = 240, col2X = 480;
    const scale = accounted > 0 ? H / accounted : 0;

    // Column 1 destinations, top to bottom: Net pay, then Tax withheld.
    const netH = Math.max(net * scale - gap / 2, 0);
    const netY0 = top;
    const netY1 = netY0 + netH;
    const taxH = Math.max(taxWithheld * scale - gap / 2, 0);
    const taxY0 = netY1 + gap;
    const taxY1 = taxY0 + taxH;

    // Column 2 destinations partition the SAME vertical span as "Tax withheld"
    // above (col1's taxY0..taxY1) — Refunded on top, Net tax below.
    let col2Segments;
    if (hasRefund) {
      const refundH = Math.max(refunded * scale - gap / 2, 0);
      const netTaxH = Math.max(netTax * scale - gap / 2, 0);
      const rY0 = taxY0;
      const rY1 = rY0 + refundH;
      const ntY0 = rY1 + gap;
      const ntY1 = ntY0 + netTaxH;
      col2Segments = [
        { label: "Refunded", amount: refunded, y0: rY0, y1: rY1, color: "var(--success)" },
        { label: "Net tax", amount: netTax, y0: ntY0, y1: ntY1, color: "var(--danger)" },
      ];
    } else {
      col2Segments = [{ label: "Net tax", amount: netTax, y0: taxY0, y1: taxY1, color: "var(--danger)" }];
    }

    function node(x, y0, y1, color) {
      return `<rect x="${x}" y="${y0}" width="${colW}" height="${Math.max(y1 - y0, 1)}" rx="2" fill="${color}" />`;
    }
    function ribbon(x0, y0top, y0bot, x1, y1top, y1bot, color) {
      return `<path d="${ribbonPath(x0, y0top, y0bot, x1, y1top, y1bot)}" fill="${color}" fill-opacity="0.28" />`;
    }
    function edgeLabel(x, y, anchor, text, color) {
      return `<text x="${x}" y="${y}" font-size="12" text-anchor="${anchor}" fill="${color}">${escapeHtml(text)}</text>`;
    }

    let svg = `<svg viewBox="0 0 ${W} ${H + top + 20}" width="${W}" height="${H + top + 20}" role="img" aria-label="Income flow for ${year}: gross pay of ${formatMoney(gross, "€")} splits into net pay ${formatMoney(net, "€")} and tax withheld ${formatMoney(taxWithheld, "€")}${hasRefund ? `, which further splits into a refund of ${formatMoney(refunded, "€")} and net tax of ${formatMoney(netTax, "€")}` : ""}.">`;

    // Column 0 (the single "Gross pay" bar) is partitioned into the exact same
    // slices as column 1's destinations, so each ribbon is a clean, non-crossing
    // band rather than every flow fanning out from the bar's full height.
    svg += ribbon(col0X + colW, netY0, netY1, col1X, netY0, netY1, "var(--success)");
    svg += ribbon(col0X + colW, taxY0, taxY1, col1X, taxY0, taxY1, "var(--text-muted)");
    col2Segments.forEach((seg) => {
      svg += ribbon(col1X + colW, seg.y0, seg.y1, col2X, seg.y0, seg.y1, seg.color);
    });

    svg += node(col0X, netY0, taxY1, "var(--accent)");
    svg += node(col1X, netY0, netY1, "var(--success)");
    svg += node(col1X, taxY0, taxY1, "var(--text-muted)");
    col2Segments.forEach((seg) => { svg += node(col2X, seg.y0, seg.y1, seg.color); });

    svg += edgeLabel(0, top - 12, "start", `Gross pay: ${formatMoney(gross, "€")}`, "var(--text)");
    svg += edgeLabel(col1X + colW + 8, (netY0 + netY1) / 2 + 4, "start", `Net pay: ${formatMoney(net, "€")}`, "var(--text)");
    svg += edgeLabel(col1X + colW + 8, (taxY0 + taxY1) / 2 + 4, "start", `Tax withheld: ${formatMoney(taxWithheld, "€")}`, "var(--text)");
    col2Segments.forEach((seg) => {
      svg += edgeLabel(col2X + colW + 8, (seg.y0 + seg.y1) / 2 + 4, "start", `${seg.label}: ${formatMoney(seg.amount, "€")}`, "var(--text)");
    });

    svg += `</svg>`;
    flowChartEl.innerHTML = svg;

    const hint = document.getElementById("overview-rate-hint");
    if (refundMissing && hint && !hint.textContent) {
      hint.textContent = "⚠ A refund is logged in a currency without a set exchange rate and is excluded from the flow diagram — set it below.";
    }
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

  function renderAll() {
    const year = Number(overviewYearSelect.value) || currentYear();
    const rates = Store.getCurrencyRates();
    renderOverview();
    renderIncomeFlow(year, rates);
  }

  overviewYearSelect.addEventListener("change", renderAll);

  populateOverviewYearSelect();
  renderRateFields();
  renderAll();
})();
