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

  document.getElementById("delete-year-btn").addEventListener("click", async () => {
    const sure = await confirmAction(
      `Delete ${yearLabel(record)} entirely? Countries, payments and correspondence for this year go with it. This can't be undone.`,
      "Delete year"
    );
    if (!sure) return;
    Store.deleteTaxYearRecord(yearId);
    window.location.href = "index.html";
  });

  // ---------- The money ----------

  const moneyStatsEl = document.getElementById("money-stats");
  const moneyNoteEl = document.getElementById("money-note");

  // Every country row keeps its figures in its own currency, so the picker
  // lives per row.
  const CURRENCY_OPTIONS = ["EUR"].concat(CURRENCIES.map((c) => c.code).filter((c) => c !== "EUR"));

  function currencyOptionsHtml(selected) {
    return CURRENCY_OPTIONS
      .map((code) => `<option value="${code}"${code === selected ? " selected" : ""}>${code}</option>`)
      .join("");
  }

  /**
   * The year's headline: everything derived from the Countries table below
   * — nothing entered separately here. Denmark's tax return gets its own
   * tile since it's the one country in this model that withholds all year
   * and pays part of it back — other countries' refunds still count in the
   * Actual Tax column below, they just aren't singled out up here.
   */
  function renderMoneyStats() {
    const current = reload();
    const totals = taxYearTotals(current);
    const denmark = denmarkRow(current);
    const dkRefund = denmark ? countryEur(denmark, "refunded") : null;

    const tiles = [
      { label: "Gross income", value: formatMoney(totals.gross, "€"), hint: "sum of taxable income, all countries" },
      { label: "Tax paid", value: formatMoney(totals.taxPaid, "€"), hint: "sum of pre-paid tax, all countries" },
      { label: "Net income", value: formatMoney(totals.netIncome, "€"), hint: "gross minus tax paid" },
      { label: "Tax rate", value: totals.gross ? formatPercent(totals.rate) : "—", hint: "tax paid ÷ gross income" },
      {
        label: "Tax return from Denmark",
        value: dkRefund === null ? "—" : formatMoney(dkRefund, "€"),
        hint: denmark ? "coming back to you" : "add a Denmark row below",
      },
    ];
    moneyStatsEl.innerHTML = tiles
      .map((t) => `
        <div class="stat-tile">
          <div class="stat-label">${escapeHtml(t.label)}</div>
          <div class="stat-value${t.tone ? " tone-" + t.tone : ""}">${escapeHtml(t.value)}</div>
          <div class="stat-hint">${escapeHtml(t.hint)}</div>
        </div>
      `)
      .join("");
    moneyNoteEl.textContent = totals.missingRates.length
      ? `No exchange rate set for ${totals.missingRates.join(", ")} — add one under Settings; those countries are excluded from the figures above until then.`
      : "";
    renderRefundWarning();
  }

  const refundWarningEl = document.getElementById("refund-warning");

  function renderRefundWarning() {
    const incomplete = incompleteRefunds(reload());
    if (!incomplete.length) {
      refundWarningEl.hidden = true;
      return;
    }
    const names = incomplete.map((c) => c.country || "a country").join(", ");
    refundWarningEl.hidden = false;
    refundWarningEl.innerHTML =
      `⚠️ <span>${escapeHtml(names)} refunded more than the tax recorded as paid there. ` +
      `That normally means the tax paid figure is still missing — Denmark withholds all year and returns part of it, ` +
      `so both numbers belong on its row.</span>`;
  }

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

    // Gross tax paid per country, so the parts add back up to the bar they
    // leave: gross = net income + the tax paid in every country. A refund
    // is a separate, later event — Denmark's shows on its own tile above
    // the diagram rather than being netted into a ribbon here.
    const flows = (record.countries || [])
      .map((c) => ({ label: `Tax ${c.country || "Unnamed"}`, value: countryEur(c, "tax") || 0, kind: "tax" }))
      .filter((f) => f.value > 0)
      .sort((a, b) => b.value - a.value);

    if (totals.netIncome > 0) flows.unshift({ label: "Net income", value: totals.netIncome, kind: "kept" });

    if (!totals.gross || !flows.length) {
      flowEl.innerHTML = `<p class="hint">Add a country below with income and tax paid, and the split appears here.</p>`;
      return;
    }

    // Tax can exceed gross in a bad year; scale to whatever is larger so the
    // ribbons still add up to the bar they leave.
    const scaleTotal = Math.max(totals.gross, flows.reduce((s, f) => s + f.value, 0));
    const overspent = totals.taxPaid > totals.gross;

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
      ${overspent ? `<p class="hint">Tax paid is more than the gross income for this year — check the figures below.</p>` : ""}`;
  }

  // ---------- Where you were ----------

  const travelCard = document.getElementById("travel-card");
  const travelBody = document.querySelector("#travel-table tbody");
  const travelFoot = document.querySelector("#travel-table tfoot");

  /** A tax year is the year the income was earned, so travel is the same year. */
  function travelCalendarYear() {
    return reload().taxYear;
  }

  function renderTravel() {
    const summary = travelYearSummary(Store.getTravel(), travelCalendarYear());
    if (!summary || !summary.countries.length) {
      travelCard.hidden = true;
      return;
    }
    travelCard.hidden = false;

    const cell = (n) => (n ? String(n) : "—");
    travelBody.innerHTML = summary.countries
      .map((c) => `
        <tr>
          <td>${escapeHtml(c.country)}</td>
          <td class="num"><strong>${c.presence}</strong></td>
          <td class="num">${cell(c.activities.Working)}</td>
          <td class="num">${cell(c.activities["Not Working"])}</td>
          <td class="num">${cell(c.activities["On Vacation"])}</td>
          <td class="num">${cell(c.activities.Sick)}</td>
          <td class="num">${cell(c.transit)}</td>
        </tr>
      `)
      .join("");

    travelFoot.innerHTML = `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${summary.totalPresence}</strong></td>
        <td class="num"><strong>${summary.totalWorking}</strong></td>
        <td colspan="4"></td>
      </tr>`;
  }

  // ---------- Progress ----------

  const statusEl = document.getElementById("status-checks");

  /** Derived from the country rows — nothing to tick here. */
  function renderStatus() {
    const status = taxYearStatus(reload());
    statusEl.innerHTML = TAX_YEAR_STATUS_FIELDS
      .map((f) => `
        <div class="check state${status[f.key] ? " done" : ""}">
          <span class="check-mark" aria-hidden="true">${status[f.key] ? "✓" : "○"}</span>
          <span>${escapeHtml(f.label)}</span>
        </div>
      `)
      .join("");
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
    const flagCell = (f, extraClass) => `
      <td class="center${extraClass || ""}">
        <input type="checkbox" data-row="${row.id}" data-field="${f.key}"${row[f.key] ? " checked" : ""}${row.notLiable && f.key !== "notLiable" ? " disabled" : ""} title="${escapeHtml(f.label)}">
      </td>`;
    const checks = COUNTRY_STATUS_FIELDS.map((f) => flagCell(f)).join("")
      + flagCell(COUNTRY_NOT_LIABLE_FIELD, " na-cell");

    const moneyCellHtml = (field) => `
      <td class="num">
        <input type="text" inputmode="decimal" class="cell-input num money" data-row="${row.id}" data-field="${field}" value="${moneyCell(row[field])}" placeholder="0.00">
      </td>`;

    const actualTax = countryNetTax(row);
    return `
      <tr>
        <td class="col-name"><input type="text" class="cell-input" list="country-list" data-row="${row.id}" data-field="country" value="${escapeHtml(row.country)}"></td>
        <td><select class="cell-input" data-row="${row.id}" data-field="currency" data-currency="${row.currency || "EUR"}">${currencyOptionsHtml(row.currency || "EUR")}</select></td>
        ${moneyCellHtml("income")}
        ${moneyCellHtml("tax")}
        <td class="num net-cell">${actualTax ? escapeHtml(moneyCell(actualTax)) : "—"}</td>
        ${moneyCellHtml("refunded")}
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

    const totals = taxYearTotals(current);
    countriesFoot.innerHTML = `
      <tr class="total-row">
        <td colspan="2"><strong>Total in EUR</strong></td>
        <td class="num"><strong>${formatMoney(totals.gross, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totals.taxPaid, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totals.tax, "€")}</strong></td>
        <td class="num"><strong>${formatMoney(totals.refunded, "€")}</strong></td>
        <td colspan="6"></td>
      </tr>
    `;

    countriesBody.querySelectorAll("input.cell-input").forEach((input) => {
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
        // Money is kept in the row's own currency; EUR is derived on render.
        const value = isMoney ? parseMoney(input.value) : input.value;
        Store.updateCountryRow(yearId, input.dataset.row, { [field]: value });
        if (field === "comment") {
          input.title = value;
          return;
        }
        renderMoneyStats();
        renderCountries();
        renderFlow();
      });
    });

    countriesBody.querySelectorAll("select.cell-input").forEach((select) => {
      const from = select.dataset.currency;
      select.addEventListener("change", () => {
        const to = select.value;
        const rates = Store.getCurrencyRates();
        const row = (reload().countries || []).find((c) => c.id === select.dataset.row);
        if (!row) return;

        // Convert through EUR so 575,597 DKK becomes €76,996.76 rather than
        // €575,597 — the row means the same money, said differently.
        const changes = { currency: to };
        for (const field of ["income", "tax", "refunded"]) {
          const amount = Number(row[field]) || 0;
          if (!amount) continue;
          const eur = toEur(amount, from, rates);
          const converted = eur === null ? null : fromEur(eur, to, rates);
          if (converted === null) {
            notify(`No exchange rate set for ${eur === null ? from : to} — add one under Settings.`);
            renderCountries();
            return;
          }
          changes[field] = Number(converted.toFixed(2));
        }
        Store.updateCountryRow(yearId, select.dataset.row, changes);
        renderMoneyStats();
        renderCountries();
        renderFlow();
      });
    });

    countriesBody.querySelectorAll("input[type=checkbox]").forEach((box) => {
      box.addEventListener("change", () => {
        Store.updateCountryRow(yearId, box.dataset.row, { [box.dataset.field]: box.checked });
        // A year's status is read off these, so it moves with them.
        if (box.dataset.field === "notLiable") renderCountries();
        renderStatus();
      });
    });

    countriesBody.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = (reload().countries || []).find((c) => c.id === btn.dataset.remove);
        const sure = await confirmAction(`Remove ${row ? row.country : "this country"} from ${yearLabel(record)}?`, "Remove");
        if (!sure) return;
        Store.deleteCountryRow(yearId, btn.dataset.remove);
        renderCountries();
        renderFlow();
        renderStatus();
      });
    });

    renderMoneyStats();
  }

  addCountryBtn.addEventListener("click", () => {
    const country = newCountryInput.value.trim();
    if (!country) return;
    const existing = (reload().countries || []).some((c) => c.country.toLowerCase() === country.toLowerCase());
    if (existing) {
      notify(`${country} is already listed for this year.`);
      return;
    }
    Store.addCountryRow(yearId, {
      country,
      currency: COUNTRY_CURRENCY_HINTS[country.toLowerCase()] || "EUR",
    });
    newCountryInput.value = "";
    renderCountries();
    renderFlow();
    renderStatus();
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
          <td>${formatDate(p.date) || "—"}</td>
          <td class="num">${formatMoney(p.amount, currencySymbolFor(p.currency))}${p.currency && p.currency !== "EUR" ? " " + escapeHtml(p.currency) : ""}</td>
          <td>${escapeHtml(p.country || "")}</td>
          <td><button type="button" class="icon-btn small" data-delete="${p.id}" title="Delete">✕</button></td>
        </tr>
      `)
      .join("");
    paymentsBody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmAction("Delete this payment?"))) return;
        Store.deletePayment(yearId, btn.dataset.delete);
        renderPayments();
      });
    });
  }

  paymentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const typedDate = document.getElementById("payment-date").value.trim();
    if (typedDate && !parseDateInput(typedDate)) {
      notify("Enter the date as DD-MM-YYYY.");
      return;
    }
    const action = document.getElementById("payment-action").value.trim();
    if (!action) return;
    Store.addPayment(yearId, {
      action,
      date: parseDateInput(document.getElementById("payment-date").value),
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
          e.date ? `<time>${escapeHtml(formatDate(e.date))}</time>` : "",
          escapeHtml(e.counterparty || ""),
          escapeHtml(e.category || ""),
          escapeHtml(e.country || ""),
          e.channel ? escapeHtml(e.channel) : "",
          e.followUp ? `follow up ${escapeHtml(formatDate(e.followUp))}` : "",
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
      btn.addEventListener("click", async () => {
        if (!(await confirmAction("Delete this correspondence entry?"))) return;
        Store.deleteCorrespondence(yearId, btn.dataset.delete);
        renderCorrespondence();
      });
    });
  }

  corrForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const counterparty = document.getElementById("corr-counterparty").value.trim();
    if (!counterparty) return;
    for (const id of ["corr-date", "corr-followup"]) {
      const typed = document.getElementById(id).value.trim();
      if (typed && !parseDateInput(typed)) {
        notify("Enter dates as DD-MM-YYYY.");
        return;
      }
    }
    Store.addCorrespondence(yearId, {
      date: parseDateInput(document.getElementById("corr-date").value) || todayIso(),
      counterparty,
      channel: document.getElementById("corr-channel").value,
      category: document.getElementById("corr-category").value,
      subject: document.getElementById("corr-subject").value.trim(),
      country: document.getElementById("corr-country").value.trim(),
      notes: document.getElementById("corr-notes").value.trim(),
      followUp: parseDateInput(document.getElementById("corr-followup").value),
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

  renderStatus();
  renderTravel();
  renderCountries();
  renderFlow();
  renderPayments();
  renderCorrespondence();
})();
