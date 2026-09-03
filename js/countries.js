(function () {
  const list = document.getElementById("countries-list");
  const addBtn = document.getElementById("add-country-btn");
  const resetBtn = document.getElementById("reset-countries-btn");
  const exportBtn = document.getElementById("export-data-btn");
  const importInput = document.getElementById("import-data-input");
  const wipeBtn = document.getElementById("wipe-data-btn");

  function bracketRowHtml(bracket, index) {
    const upToValue = bracket.upTo === null || bracket.upTo === undefined ? "" : bracket.upTo;
    return `
      <div class="bracket-row" data-index="${index}">
        <div>
          <label>Up to (blank = no limit)</label>
          <input type="number" min="0" step="1" class="bracket-upto" value="${upToValue}">
        </div>
        <div>
          <label>Rate (%)</label>
          <input type="number" min="0" max="100" step="0.1" class="bracket-rate" value="${(bracket.rate * 100).toFixed(2)}">
        </div>
        <button type="button" class="icon-btn remove-bracket" title="Remove bracket">✕</button>
      </div>
    `;
  }

  function countryCardHtml(country) {
    const brackets = country.brackets.length ? country.brackets : [{ upTo: null, rate: 0 }];
    return `
      <div class="card country-edit-card" data-id="${country.id}">
        <div class="card-header">
          <h2>${escapeHtml(country.name) || "New country"}</h2>
          <button type="button" class="danger-outline small delete-country">Delete</button>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Country name</label>
            <input type="text" class="country-name-input" value="${escapeHtml(country.name)}" placeholder="e.g. Spain">
          </div>
          <div class="field">
            <label>Currency code</label>
            <input type="text" class="country-currency-code" value="${escapeHtml(country.currencyCode)}" placeholder="EUR">
          </div>
          <div class="field">
            <label>Currency symbol</label>
            <input type="text" class="country-currency-symbol" value="${escapeHtml(country.currencySymbol)}" placeholder="€">
          </div>
          <div class="field">
            <label>Residency threshold (days)</label>
            <input type="number" min="1" class="country-threshold" value="${country.residencyThresholdDays || 183}">
          </div>
        </div>

        <label>Tax brackets (national/federal level, simplified)</label>
        <div class="bracket-list">
          ${brackets.map(bracketRowHtml).join("")}
        </div>
        <div class="actions-row" style="margin-top:10px;">
          <button type="button" class="small add-bracket">+ Add bracket</button>
          <span class="spacer"></span>
          <button type="button" class="primary small save-country">Save</button>
        </div>
        <p class="hint">${escapeHtml(country.notes || "")}</p>
      </div>
    `;
  }

  function render() {
    const countries = Store.getCountries();
    list.innerHTML = countries.map(countryCardHtml).join("");
  }

  function readBracketsFromCard(card) {
    return Array.from(card.querySelectorAll(".bracket-row"))
      .map((row) => {
        const upToRaw = row.querySelector(".bracket-upto").value;
        const rateRaw = row.querySelector(".bracket-rate").value;
        return {
          upTo: upToRaw === "" ? null : Number(upToRaw),
          rate: Number(rateRaw) / 100,
        };
      })
      .sort((a, b) => {
        if (a.upTo === null) return 1;
        if (b.upTo === null) return -1;
        return a.upTo - b.upTo;
      });
  }

  list.addEventListener("click", (event) => {
    const card = event.target.closest(".country-edit-card");
    if (!card) return;
    const id = card.dataset.id;

    if (event.target.classList.contains("add-bracket")) {
      const bracketList = card.querySelector(".bracket-list");
      const div = document.createElement("div");
      div.innerHTML = bracketRowHtml({ upTo: null, rate: 0 }, bracketList.children.length);
      bracketList.appendChild(div.firstElementChild);
      return;
    }

    if (event.target.classList.contains("remove-bracket")) {
      event.target.closest(".bracket-row").remove();
      return;
    }

    if (event.target.classList.contains("save-country")) {
      const countries = Store.getCountries();
      const country = countries.find((c) => c.id === id);
      if (!country) return;
      country.name = card.querySelector(".country-name-input").value.trim() || country.name;
      country.currencyCode = card.querySelector(".country-currency-code").value.trim().toUpperCase();
      country.currencySymbol = card.querySelector(".country-currency-symbol").value.trim();
      country.residencyThresholdDays = Number(card.querySelector(".country-threshold").value) || 183;
      country.brackets = readBracketsFromCard(card);
      Store.saveCountries(countries);
      render();
      return;
    }

    if (event.target.classList.contains("delete-country")) {
      if (!confirm(`Delete ${card.querySelector("h2").textContent}? Income/residency entries referencing it will remain but show as "deleted country".`)) {
        return;
      }
      const countries = Store.getCountries().filter((c) => c.id !== id);
      Store.saveCountries(countries);
      render();
    }
  });

  addBtn.addEventListener("click", () => {
    const countries = Store.getCountries();
    countries.push({
      id: uid(),
      name: "",
      currencyCode: "",
      currencySymbol: "",
      residencyThresholdDays: 183,
      notes: "",
      brackets: [{ upTo: null, rate: 0 }],
    });
    Store.saveCountries(countries);
    render();
    list.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all countries to the built-in defaults? Custom countries and edits will be lost. Income/residency entries are not affected.")) {
      return;
    }
    Store.resetCountriesToDefaults();
    render();
  });

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
    if (!confirm("This deletes ALL data (countries, income, residency) stored in this browser. This cannot be undone. Continue?")) {
      return;
    }
    Store.wipeAll();
    render();
  });

  render();
})();
