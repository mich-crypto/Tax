(function () {
  // --- Gemini settings ---
  const apiKeyInput = document.getElementById("gemini-api-key");
  const modelInput = document.getElementById("gemini-model");
  const toggleKeyBtn = document.getElementById("toggle-key-visibility");
  const saveSettingsBtn = document.getElementById("save-gemini-settings");
  const clearKeyBtn = document.getElementById("clear-gemini-key");
  const settingsStatus = document.getElementById("gemini-settings-status");

  function loadGeminiSettingsIntoForm() {
    const settings = Store.getGeminiSettings();
    apiKeyInput.value = settings.apiKey || "";
    modelInput.value = settings.model || GEMINI_DEFAULT_MODEL;
  }

  toggleKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  saveSettingsBtn.addEventListener("click", () => {
    Store.saveGeminiSettings({
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim() || GEMINI_DEFAULT_MODEL,
    });
    settingsStatus.textContent = "Saved.";
    setTimeout(() => { settingsStatus.textContent = ""; }, 2500);
  });

  clearKeyBtn.addEventListener("click", () => {
    Store.clearGeminiApiKey();
    apiKeyInput.value = "";
    settingsStatus.textContent = "API key cleared.";
    setTimeout(() => { settingsStatus.textContent = ""; }, 2500);
  });

  loadGeminiSettingsIntoForm();

  // --- Data export / import / wipe ---
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
        alert("Import complete.");
      } catch (e) {
        alert("That file doesn't look like a valid export (invalid JSON).");
      }
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  wipeBtn.addEventListener("click", () => {
    if (!confirm("This deletes ALL data (income, residency, tax years, correspondence, payslips) stored in this browser. This cannot be undone. Continue?")) {
      return;
    }
    Store.wipeAll();
  });
})();
