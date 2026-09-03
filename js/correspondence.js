(function () {
  const form = document.getElementById("correspondence-form");
  const counterpartyInput = document.getElementById("correspondence-counterparty");
  const counterpartyList = document.getElementById("correspondence-counterparty-list");
  const channelSelect = document.getElementById("correspondence-channel");
  const categorySelect = document.getElementById("correspondence-category");
  const dateInput = document.getElementById("correspondence-date");
  const subjectInput = document.getElementById("correspondence-subject");
  const notesInput = document.getElementById("correspondence-notes");
  const followUpInput = document.getElementById("correspondence-followup");
  const amountInput = document.getElementById("correspondence-amount");
  const currencySelect = document.getElementById("correspondence-currency");

  const statusFilter = document.getElementById("correspondence-status-filter");
  const searchInput = document.getElementById("correspondence-search");
  const tableBody = document.querySelector("#correspondence-table tbody");
  const emptyState = document.getElementById("correspondence-empty-state");
  const table = document.getElementById("correspondence-table");
  const openCountEl = document.getElementById("correspondence-open-count");

  function populateStaticLists() {
    counterpartyList.innerHTML = CORRESPONDENCE_COUNTERPARTIES
      .map((name) => `<option value="${escapeHtml(name)}">`)
      .join("");
    channelSelect.innerHTML = CORRESPONDENCE_CHANNELS
      .map((ch) => `<option value="${ch}">${ch}</option>`)
      .join("");
    categorySelect.innerHTML = CORRESPONDENCE_CATEGORIES
      .map((cat) => `<option value="${cat}">${cat}</option>`)
      .join("");
    currencySelect.innerHTML = CURRENCIES
      .map((c) => `<option value="${c.code}">${c.code}</option>`)
      .join("");
    statusFilter.innerHTML =
      `<option value="all">All statuses</option>` +
      CORRESPONDENCE_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
  }

  function currencySymbolFor(code) {
    const match = CURRENCIES.find((c) => c.code === code);
    return match ? match.symbol : "";
  }

  function badgeForStatus(status) {
    return status === "Resolved"
      ? `<span class="badge ok">Resolved</span>`
      : `<span class="badge warn">Open</span>`;
  }

  function renderTable() {
    let entries = Store.getCorrespondence().sort((a, b) => new Date(b.date) - new Date(a.date));

    const status = statusFilter.value;
    if (status !== "all") {
      entries = entries.filter((e) => e.status === status);
    }
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      entries = entries.filter((e) =>
        [e.counterparty, e.subject, e.notes, e.category].some((f) => (f || "").toLowerCase().includes(query))
      );
    }

    const openCount = Store.getCorrespondence().filter((e) => e.status !== "Resolved").length;
    openCountEl.textContent = openCount;

    if (!entries.length) {
      table.style.display = "none";
      emptyState.style.display = "block";
      return;
    }
    table.style.display = "";
    emptyState.style.display = "none";

    tableBody.innerHTML = entries
      .map((e) => {
        return `
          <tr>
            <td>${e.date}</td>
            <td>${escapeHtml(e.counterparty)}</td>
            <td>${escapeHtml(e.channel)}</td>
            <td>${escapeHtml(e.category || "")}</td>
            <td>${escapeHtml(e.subject || "")}</td>
            <td>${escapeHtml(e.notes || "")}</td>
            <td class="num">${e.amount ? formatMoney(e.amount, currencySymbolFor(e.currency)) : "—"}</td>
            <td>${e.followUp ? escapeHtml(e.followUp) : "—"}</td>
            <td>${badgeForStatus(e.status)}</td>
            <td class="actions-row" style="flex-wrap:nowrap;">
              <button type="button" class="icon-btn small" data-toggle="${e.id}" title="${e.status === "Resolved" ? "Reopen" : "Mark resolved"}">${e.status === "Resolved" ? "↺" : "✓"}</button>
              <button type="button" class="icon-btn small" data-delete="${e.id}" title="Delete">✕</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const counterparty = counterpartyInput.value.trim();
    if (!counterparty) return;

    Store.addCorrespondence({
      date: dateInput.value || new Date().toISOString().slice(0, 10),
      counterparty,
      channel: channelSelect.value,
      category: categorySelect.value,
      subject: subjectInput.value.trim(),
      notes: notesInput.value.trim(),
      amount: amountInput.value ? Number(amountInput.value) : 0,
      currency: currencySelect.value,
      followUp: followUpInput.value || "",
      status: "Open",
    });

    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    channelSelect.value = CORRESPONDENCE_CHANNELS[0];
    categorySelect.value = CORRESPONDENCE_CATEGORIES[0];
    currencySelect.value = "DKK";
    renderTable();
  });

  tableBody.addEventListener("click", (event) => {
    const toggleId = event.target.dataset.toggle;
    if (toggleId) {
      const entry = Store.getCorrespondence().find((e) => e.id === toggleId);
      if (entry) {
        Store.updateCorrespondence(toggleId, { status: entry.status === "Resolved" ? "Open" : "Resolved" });
        renderTable();
      }
      return;
    }
    const deleteId = event.target.dataset.delete;
    if (deleteId) {
      if (!confirm("Delete this correspondence entry?")) return;
      Store.deleteCorrespondence(deleteId);
      renderTable();
    }
  });

  statusFilter.addEventListener("change", renderTable);
  searchInput.addEventListener("input", renderTable);

  dateInput.value = new Date().toISOString().slice(0, 10);
  populateStaticLists();
  channelSelect.value = CORRESPONDENCE_CHANNELS[0];
  categorySelect.value = CORRESPONDENCE_CATEGORIES[0];
  currencySelect.value = "DKK";
  renderTable();
})();
