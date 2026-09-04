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
  document.getElementById("year-subheading").textContent = "Everything filed, paid and refunded for this tax year.";
  document.title = `Tax year ${record.taxYear} — Multi-Country Tax Tracker`;

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
    renderFlow();
  });
  refundedInput.addEventListener("change", () => {
    Store.updateTaxYear(yearId, { refundedFromDkEur: Number(refundedInput.value) || 0 });
    renderMoneyStats();
  });


  // ---------- Where the money went ----------

  const flowEl = document.getElementById("flow-diagram");

  /**
   * A Sankey of one year: gross income on the left, splitting into what you
   * kept and the tax paid in each country on the right.
   *
   * The geometry that matters: each ribbon leaves the gross bar from its OWN
   * slice of it, sized in proportion to where it lands. Drawing every ribbon
   * from the full height of the source is the classic bug — the fills stack
   * on top of each other and the picture stops meaning anything.
   */
  function renderFlow() {
    const record = reload();
    const totals = taxYearTotals(record);

    const flows = (record.countries || [])
      .filter((c) => (Number(c.taxEur) || 0) > 0)
      .map((c) => ({ label: c.country || "Unnamed", value: Number(c.taxEur) || 0, kind: "tax" }))
      .sort((a, b) => b.value - a.value);

    const kept = totals.gross - totals.taxPaid;
    if (kept > 0) flows.unshift({ label: "Net income", value: kept, kind: "kept" });

    if (!totals.gross || !flows.length) {
      flowEl.innerHTML = `<p class="hint">Enter this year's gross income above, and the tax paid against at least one country below, and the split appears here.</p>`;
      return;
    }

    // Tax can exceed gross in a bad year; scale to whatever is larger so the
    // ribbons still add up to the bar they leave.
    const scaleTotal = Math.max(totals.gross, flows.reduce((s, f) => s + f.value, 0));

    const W = 800;
    const NODE = 14;
    const GAP = 12;
    const MIN = 4;
    const PAD = 12;
    const leftX = 168;
    const rightX = W - 168 - NODE;

    // Height follows the content: enough for every node plus the gaps.
    const inner = Math.max(200, flows.length * 46);
    const H = inner + PAD * 2;
    const usable = inner - GAP * (flows.length - 1);
    const heightFor = (value) => Math.max(MIN, (value / scaleTotal) * usable);

    const fills = {
      kept: "var(--pos)",
      tax: "var(--neg)",
    };

    let cursor = PAD;
    let sourceCursor = PAD;
    const ribbons = [];
    const nodes = [];

    flows.forEach((flow, i) => {
      const h = heightFor(flow.value);
      // The ribbon's slice of the SOURCE bar matches its share, so slices
      // sit side by side down the gross bar instead of overlapping.
      const sourceY0 = sourceCursor;
      const sourceY1 = sourceCursor + h;
      sourceCursor = sourceY1;

      const targetY0 = cursor;
      const targetY1 = cursor + h;
      cursor = targetY1 + GAP;

      const midX = (leftX + NODE + rightX) / 2;
      ribbons.push(`<path d="M ${leftX + NODE} ${sourceY0}
        C ${midX} ${sourceY0} ${midX} ${targetY0} ${rightX} ${targetY0}
        L ${rightX} ${targetY1}
        C ${midX} ${targetY1} ${midX} ${sourceY1} ${leftX + NODE} ${sourceY1} Z"
        fill="${fills[flow.kind]}" opacity="${0.5 - i * 0.05}"></path>`);

      nodes.push(`
        <rect x="${rightX}" y="${targetY0}" width="${NODE}" height="${Math.max(h, 2)}" rx="2" fill="${fills[flow.kind]}"></rect>
        <text x="${rightX + NODE + 12}" y="${targetY0 + h / 2 - 2}" class="flow-name">${escapeHtml(flow.label)}</text>
        <text x="${rightX + NODE + 12}" y="${targetY0 + h / 2 + 13}" class="flow-value">${escapeHtml(formatMoney(flow.value, "\u20ac"))}</text>`);
    });

    const grossHeight = sourceCursor - PAD;

    flowEl.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img"
           aria-label="Gross income of ${formatMoney(totals.gross, "\u20ac")} splitting into ${flows.map((f) => f.label).join(", ")}">
        ${ribbons.join("")}
        ${nodes.join("")}
        <rect x="${leftX}" y="${PAD}" width="${NODE}" height="${grossHeight}" rx="2" fill="var(--accent)"></rect>
        <text x="${leftX - 12}" y="${PAD + grossHeight / 2 - 2}" class="flow-name" text-anchor="end">Gross income</text>
        <text x="${leftX - 12}" y="${PAD + grossHeight / 2 + 13}" class="flow-value" text-anchor="end">${escapeHtml(formatMoney(totals.gross, "\u20ac"))}</text>
      </svg>
      ${totals.taxPaid > totals.gross ? `<p class="hint">Tax paid is more than the gross income entered for this year — check the figures above.</p>` : ""}`;
  }

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

  /** Grouped for reading; the raw number comes back on focus for typing. */
  function moneyCell(value) {
    const n = Number(value) || 0;
    return n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  }

  /** Accepts what moneyCell() renders, plus a comma decimal separator. */
  function parseMoney(text) {
    const cleaned = String(text).replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/[,\u00a0]/g, "");
    return Number(cleaned) || 0;
  }

  function countryRowHtml(row) {
    const checks = COUNTRY_STATUS_FIELDS.map((f) => `
      <td class="center">
        <input type="checkbox" data-row="${row.id}" data-field="${f.key}"${row[f.key] ? " checked" : ""} title="${escapeHtml(f.label)}">
      </td>
    `).join("");
    return `
      <tr>
        <td class="col-name"><input type="text" class="cell-input" list="country-list" data-row="${row.id}" data-field="country" value="${escapeHtml(row.country)}"></td>
        <td class="num"><input type="text" inputmode="decimal" class="cell-input num money" data-row="${row.id}" data-field="incomeEur" value="${moneyCell(row.incomeEur)}" placeholder="0.00"></td>
        <td class="num"><input type="text" inputmode="decimal" class="cell-input num money" data-row="${row.id}" data-field="taxEur" value="${moneyCell(row.taxEur)}" placeholder="0.00"></td>
        ${checks}
        <td class="col-grow"><input type="text" class="cell-input" data-row="${row.id}" data-field="comment" value="${escapeHtml(row.comment || "")}" title="${escapeHtml(row.comment || "")}" placeholder="—"></td>
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
      const isMoney = input.classList.contains("money");

      if (isMoney) {
        // Grouped digits are for reading, not for typing into.
        input.addEventListener("focus", () => {
          const raw = Number(input.dataset.raw ?? parseMoney(input.value)) || 0;
          input.value = raw ? String(raw) : "";
          input.select();
        });
        input.addEventListener("blur", () => {
          input.value = moneyCell(parseMoney(input.value));
        });
      }

      input.addEventListener("change", () => {
        const field = input.dataset.field;
        const value = isMoney ? parseMoney(input.value) : input.value;
        Store.updateCountryRow(yearId, input.dataset.row, { [field]: value });
        if (field === "comment") input.title = value;
        if (field === "taxEur" || field === "country") {
          renderMoneyStats();
          renderCountries();
          renderFlow();
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
        renderFlow();
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
    renderFlow();
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
  const corrList = document.getElementById("correspondence-list");
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
      corrList.hidden = true;
      corrEmpty.style.display = "block";
      corrList.innerHTML = "";
      return;
    }
    corrList.hidden = false;
    corrEmpty.style.display = "none";

    // Subject leads; everything else is one metadata line underneath. As
    // table columns these clipped each other on any real-length note.
    corrList.innerHTML = entries
      .map((e) => {
        const meta = [
          e.date ? `<time>${escapeHtml(e.date)}</time>` : "",
          escapeHtml(e.counterparty || ""),
          escapeHtml(e.category || ""),
          escapeHtml(e.country || ""),
          e.channel ? escapeHtml(e.channel) : "",
          e.followUp ? `follow up ${escapeHtml(e.followUp)}` : "",
        ].filter(Boolean).join('<span class="sep">·</span>');
        const resolved = e.status === "Resolved";
        return `
        <div class="entry">
          <div class="entry-body">
            <div class="entry-subject">${escapeHtml(e.subject || e.counterparty || "Untitled")}</div>
            <div class="entry-meta">${meta}</div>
            ${e.notes ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>` : ""}
          </div>
          <span class="badge ${resolved ? "ok" : "warn"}">${resolved ? "Resolved" : "Open"}</span>
          <div class="entry-actions">
            <button type="button" class="icon-btn small" data-toggle="${e.id}" title="${resolved ? "Reopen" : "Mark resolved"}">${resolved ? "↺" : "✓"}</button>
            <button type="button" class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button>
          </div>
        </div>`;
      })
      .join("");

    corrList.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = (reload().correspondence || []).find((e) => e.id === btn.dataset.toggle);
        if (!entry) return;
        Store.updateCorrespondence(yearId, btn.dataset.toggle, { status: entry.status === "Resolved" ? "Open" : "Resolved" });
        renderCorrespondence();
      });
    });
    corrList.querySelectorAll("[data-delete]").forEach((btn) => {
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
  renderFlow();
  renderPayments();
  renderCorrespondence();
})();
