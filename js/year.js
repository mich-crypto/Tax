(function () {
  const params = new URLSearchParams(window.location.search);
  const yearId = params.get("id");
  const bodyEl = document.getElementById("year-body");
  const missingEl = document.getElementById("year-missing");

  let record = yearId ? Store.getTaxYearById(yearId) : null;
  if (!record) {
    missingEl.hidden = false;
    return;
  }
  bodyEl.hidden = false;

  /** Re-read from storage so every render works off the saved truth. */
  function reload() {
    record = Store.getTaxYearById(yearId);
    return record;
  }

  function currencySymbolFor(code) {
    return (CURRENCIES.find((c) => c.code === code) || {}).symbol || "";
  }

  // ---------- Header ----------

  document.getElementById("year-heading").textContent = `Tax year ${record.taxYear}`;
  document.getElementById("year-subheading").textContent = `Income earned in ${record.incomeYear}, filed in ${record.taxYear}.`;
  document.title = `${yearLabel(record)} — Multi-Country Tax Tracker`;

  document.getElementById("delete-year-btn").addEventListener("click", () => {
    if (!confirm(`Delete ${yearLabel(record)} entirely? Countries, payments and correspondence for this year go with it. This can't be undone.`)) return;
    Store.deleteTaxYearRecord(yearId);
    window.location.href = "index.html";
  });

  // ---------- The money ----------

  const grossInput = document.getElementById("gross-income");
  const refundedInput = document.getElementById("refunded-dk");
  const moneyStatsEl = document.getElementById("money-stats");

  function renderMoneyStats() {
    const totals = taxYearTotals(reload());
    const tiles = [
      { label: "Tax paid", value: formatMoney(totals.taxPaid, "€"), hint: "sum of the countries below" },
      {
        label: "Balance",
        value: formatSigned(totals.balance, "€"),
        hint: totals.balance >= 0 ? "refund covers what you owe" : "you're short by this much",
        tone: totals.balance >= 0 ? "ok" : "danger",
      },
      { label: "Net income", value: formatMoney(totals.netIncome, "€"), hint: "gross minus tax paid" },
      { label: "Effective rate", value: totals.gross ? formatPercent(totals.rate) : "—", hint: "tax paid ÷ gross income" },
    ];
    moneyStatsEl.innerHTML = tiles
      .map((t) => `
        <div class="card stat-tile">
          <div class="stat-label">${escapeHtml(t.label)}</div>
          <div class="stat-value${t.tone ? " tone-" + t.tone : ""}">${escapeHtml(t.value)}</div>
          <div class="stat-hint">${escapeHtml(t.hint)}</div>
        </div>
      `)
      .join("");
  }

  grossInput.value = record.grossIncomeEur || "";
  refundedInput.value = record.refundedFromDkEur || "";

  grossInput.addEventListener("change", () => {
    Store.updateTaxYear(yearId, { grossIncomeEur: Number(grossInput.value) || 0 });
    renderMoneyStats();
  });
  refundedInput.addEventListener("change", () => {
    Store.updateTaxYear(yearId, { refundedFromDkEur: Number(refundedInput.value) || 0 });
    renderMoneyStats();
  });

  // ---------- Progress ----------

  function renderChecks(containerId, fields, bucket) {
    const el = document.getElementById(containerId);
    const current = reload();
    el.innerHTML = fields
      .map((f) => `
        <label class="check">
          <input type="checkbox" data-bucket="${bucket}" data-key="${f.key}"${(current[bucket] || {})[f.key] ? " checked" : ""}>
          <span>${escapeHtml(f.label)}</span>
        </label>
      `)
      .join("");
    el.querySelectorAll("input[type=checkbox]").forEach((box) => {
      box.addEventListener("change", () => {
        const fresh = reload();
        const group = { ...(fresh[bucket] || {}) };
        group[box.dataset.key] = box.checked;
        Store.updateTaxYear(yearId, { [bucket]: group });
      });
    });
  }

  // ---------- Countries ----------

  const countriesTable = document.getElementById("countries-table");
  const countriesBody = document.querySelector("#countries-table tbody");
  const countriesFoot = document.querySelector("#countries-table tfoot");
  const countriesEmpty = document.getElementById("countries-empty-state");
  const newCountryInput = document.getElementById("new-country");
  const addCountryBtn = document.getElementById("add-country-btn");

  function countryRowHtml(row) {
    const checks = COUNTRY_STATUS_FIELDS.map((f) => `
      <td class="center">
        <input type="checkbox" data-row="${row.id}" data-field="${f.key}"${row[f.key] ? " checked" : ""} title="${escapeHtml(f.label)}">
      </td>
    `).join("");
    return `
      <tr>
        <td><input type="text" class="cell-input" list="country-list" data-row="${row.id}" data-field="country" value="${escapeHtml(row.country)}"></td>
        <td class="num"><input type="number" class="cell-input num" data-row="${row.id}" data-field="incomeEur" step="0.01" value="${row.incomeEur || ""}" placeholder="0.00"></td>
        <td class="num"><input type="number" class="cell-input num" data-row="${row.id}" data-field="taxEur" step="0.01" value="${row.taxEur || ""}" placeholder="0.00"></td>
        ${checks}
        <td><input type="text" class="cell-input" data-row="${row.id}" data-field="comment" value="${escapeHtml(row.comment || "")}" placeholder="—"></td>
        <td><button type="button" class="icon-btn small" data-remove="${row.id}" title="Remove country">✕</button></td>
      </tr>
    `;
  }

  function renderCountries() {
    const current = reload();
    const rows = current.countries || [];
    if (!rows.length) {
      countriesTable.style.display = "none";
      countriesEmpty.style.display = "block";
      countriesBody.innerHTML = "";
      countriesFoot.innerHTML = "";
      renderMoneyStats();
      return;
    }
    countriesTable.style.display = "";
    countriesEmpty.style.display = "none";
    countriesBody.innerHTML = rows.map(countryRowHtml).join("");

    const totalTax = rows.reduce((s, r) => s + (Number(r.taxEur) || 0), 0);
    countriesFoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total tax paid</strong></td>
        <td></td>
        <td class="num"><strong>${formatMoney(totalTax, "€")}</strong></td>
        <td colspan="5"></td>
      </tr>
    `;

    countriesBody.querySelectorAll(".cell-input").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.field;
        const value = input.type === "number" ? Number(input.value) || 0 : input.value;
        Store.updateCountryRow(yearId, input.dataset.row, { [field]: value });
        if (field === "taxEur") {
          renderMoneyStats();
          renderCountries();
        }
      });
    });

    countriesBody.querySelectorAll("input[type=checkbox]").forEach((box) => {
      box.addEventListener("change", () => {
        Store.updateCountryRow(yearId, box.dataset.row, { [box.dataset.field]: box.checked });
      });
    });

    countriesBody.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = (reload().countries || []).find((c) => c.id === btn.dataset.remove);
        if (!confirm(`Remove ${row ? row.country : "this country"} from ${yearLabel(record)}?`)) return;
        Store.deleteCountryRow(yearId, btn.dataset.remove);
        renderCountries();
      });
    });

    renderMoneyStats();
  }

  addCountryBtn.addEventListener("click", () => {
    const country = newCountryInput.value.trim();
    if (!country) return;
    const existing = (reload().countries || []).some((c) => c.country.toLowerCase() === country.toLowerCase());
    if (existing) {
      alert(`${country} is already listed for this year.`);
      return;
    }
    Store.addCountryRow(yearId, { country });
    newCountryInput.value = "";
    renderCountries();
  });

  // ---------- Payments ----------

  const paymentForm = document.getElementById("payment-form");
  const paymentsTable = document.getElementById("payments-table");
  const paymentsBody = document.querySelector("#payments-table tbody");
  const paymentsEmpty = document.getElementById("payments-empty-state");
  const paymentCurrency = document.getElementById("payment-currency");

  function renderPayments() {
    const rows = (reload().payments || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!rows.length) {
      paymentsTable.style.display = "none";
      paymentsEmpty.style.display = "block";
      paymentsBody.innerHTML = "";
      return;
    }
    paymentsTable.style.display = "";
    paymentsEmpty.style.display = "none";
    paymentsBody.innerHTML = rows
      .map((p) => `
        <tr>
          <td>${escapeHtml(p.action)}</td>
          <td>${p.date || "—"}</td>
          <td class="num">${formatMoney(p.amount, currencySymbolFor(p.currency))}${p.currency && p.currency !== "EUR" ? " " + escapeHtml(p.currency) : ""}</td>
          <td>${escapeHtml(p.country || "")}</td>
          <td><button type="button" class="icon-btn small" data-delete="${p.id}" title="Delete">✕</button></td>
        </tr>
      `)
      .join("");
    paymentsBody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm("Delete this payment?")) return;
        Store.deletePayment(yearId, btn.dataset.delete);
        renderPayments();
      });
    });
  }

  paymentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const action = document.getElementById("payment-action").value.trim();
    if (!action) return;
    Store.addPayment(yearId, {
      action,
      date: document.getElementById("payment-date").value || "",
      amount: Number(document.getElementById("payment-amount").value) || 0,
      currency: paymentCurrency.value,
      country: document.getElementById("payment-country").value.trim(),
    });
    paymentForm.reset();
    paymentCurrency.value = "EUR";
    renderPayments();
  });

  // ---------- Correspondence ----------

  const corrForm = document.getElementById("correspondence-form");
  const corrTable = document.getElementById("correspondence-table");
  const corrBody = document.querySelector("#correspondence-table tbody");
  const corrEmpty = document.getElementById("correspondence-empty-state");
  const openCountEl = document.getElementById("open-count");

  document.getElementById("toggle-corr-form").addEventListener("click", () => {
    corrForm.hidden = !corrForm.hidden;
    if (!corrForm.hidden) document.getElementById("corr-counterparty").focus();
  });

  function renderCorrespondence() {
    const entries = (reload().correspondence || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    openCountEl.textContent = entries.filter((e) => e.status !== "Resolved").length;

    if (!entries.length) {
      corrTable.style.display = "none";
      corrEmpty.style.display = "block";
      corrBody.innerHTML = "";
      return;
    }
    corrTable.style.display = "";
    corrEmpty.style.display = "none";
    corrBody.innerHTML = entries
      .map((e) => `
        <tr>
          <td>${e.date || "—"}</td>
          <td>${escapeHtml(e.counterparty)}</td>
          <td>${escapeHtml(e.category || "")}</td>
          <td>${escapeHtml(e.subject || "")}</td>
          <td>${escapeHtml(e.country || "")}</td>
          <td class="notes-cell">${escapeHtml(e.notes || "")}</td>
          <td>${e.followUp || "—"}</td>
          <td>${e.status === "Resolved" ? '<span class="badge ok">Resolved</span>' : '<span class="badge warn">Open</span>'}</td>
          <td class="actions-row" style="flex-wrap:nowrap;">
            <button type="button" class="icon-btn small" data-toggle="${e.id}" title="${e.status === "Resolved" ? "Reopen" : "Mark resolved"}">${e.status === "Resolved" ? "↺" : "✓"}</button>
            <button type="button" class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button>
          </td>
        </tr>
      `)
      .join("");

    corrBody.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = (reload().correspondence || []).find((e) => e.id === btn.dataset.toggle);
        if (!entry) return;
        Store.updateCorrespondence(yearId, btn.dataset.toggle, { status: entry.status === "Resolved" ? "Open" : "Resolved" });
        renderCorrespondence();
      });
    });
    corrBody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm("Delete this correspondence entry?")) return;
        Store.deleteCorrespondence(yearId, btn.dataset.delete);
        renderCorrespondence();
      });
    });
  }

  corrForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const counterparty = document.getElementById("corr-counterparty").value.trim();
    if (!counterparty) return;
    Store.addCorrespondence(yearId, {
      date: document.getElementById("corr-date").value || new Date().toISOString().slice(0, 10),
      counterparty,
      channel: document.getElementById("corr-channel").value,
      category: document.getElementById("corr-category").value,
      subject: document.getElementById("corr-subject").value.trim(),
      country: document.getElementById("corr-country").value.trim(),
      notes: document.getElementById("corr-notes").value.trim(),
      followUp: document.getElementById("corr-followup").value || "",
      status: "Open",
    });
    corrForm.reset();
    corrForm.hidden = true;
    renderCorrespondence();
  });

  // ---------- Boot ----------

  document.getElementById("country-list").innerHTML = COMMON_COUNTRIES
    .map((name) => `<option value="${escapeHtml(name)}">`).join("");
  document.getElementById("payment-action-list").innerHTML = PAYMENT_ACTIONS
    .map((a) => `<option value="${escapeHtml(a)}">`).join("");
  document.getElementById("counterparty-list").innerHTML = CORRESPONDENCE_COUNTERPARTIES
    .map((name) => `<option value="${escapeHtml(name)}">`).join("");
  paymentCurrency.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code}</option>`).join("");
  paymentCurrency.value = "EUR";
  document.getElementById("corr-channel").innerHTML = CORRESPONDENCE_CHANNELS
    .map((c) => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("corr-category").innerHTML = CORRESPONDENCE_CATEGORIES
    .map((c) => `<option value="${c}">${c}</option>`).join("");

  renderChecks("status-checks", TAX_YEAR_STATUS_FIELDS, "status");
  renderChecks("forms-checks", TAX_YEAR_FORM_FIELDS, "forms");
  renderCountries();
  renderPayments();
  renderCorrespondence();
})();
