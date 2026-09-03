/**
 * Client-side Gemini API integration for payslip analysis.
 *
 * This calls https://generativelanguage.googleapis.com directly from the
 * browser using the API key you paste into Payslip settings. That means:
 *   - Your API key is stored only in this browser's localStorage. It is
 *     never written to any file this app writes to disk (export/import
 *     deliberately skip it) and never sent anywhere except Google's API.
 *   - Requests (including the payslip image/PDF you upload) go straight
 *     from your browser to Google — this app has no server of its own.
 *   - Get a key at https://aistudio.google.com/apikey. Treat it like a
 *     password: anyone with it can spend your Gemini quota.
 */

const GEMINI_EXTRACTION_PROMPT = `You are extracting structured data from a payslip (also called a loenseddel, payslip, or salary statement). Read the attached document carefully and respond with ONLY a JSON object — no markdown fences, no commentary — matching exactly this shape:

{
  "employer": string or null,
  "country": string or null,
  "currency": string or null,
  "payPeriodStart": string or null,
  "payPeriodEnd": string or null,
  "grossPay": number or null,
  "netPay": number or null,
  "taxWithheld": number or null,
  "otherDeductions": number or null,
  "notes": string or null
}

Rules:
- "currency" should be a 3-letter ISO code (e.g. DKK, USD, EUR) if you can determine it.
- Dates use YYYY-MM-DD format.
- Numbers must be plain numbers with no currency symbols, letters, or thousands separators.
- "otherDeductions" covers things like pension contributions that aren't tax.
- "notes" can mention anything else useful (bonuses, one-off items, anything unclear).
- If a field cannot be determined from the document, use null for it. Never guess.`;

/** Reads a File/Blob and resolves to its base64-encoded content (no data: URL prefix). */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Sends a payslip file to Gemini and returns the parsed extraction object.
 * Throws with a human-readable message on any failure (network, API error,
 * or an unparseable response).
 */
async function analyzePayslipWithGemini({ apiKey, model, file }) {
  if (!apiKey) throw new Error("No Gemini API key set. Add one under Payslip settings.");
  if (!file) throw new Error("No file selected.");

  const base64Data = await fileToBase64(file);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: GEMINI_EXTRACTION_PROMPT },
          { inline_data: { mime_type: file.type || "application/octet-stream", data: base64Data } },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json" },
  };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    throw new Error("Could not reach the Gemini API. Check your connection (and that nothing is blocking generativelanguage.googleapis.com).");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || "";
    } catch (e) {
      // ignore — fall through with empty detail
    }
    throw new Error(`Gemini API error (${response.status})${detail ? ": " + detail : ""}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text.trim()) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini declined to answer (${blockReason}).` : "Gemini returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Gemini's response wasn't valid JSON. Try again, or enter the figures manually.");
  }
}
