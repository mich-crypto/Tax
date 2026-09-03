/**
 * Client-side Claude API integration for payslip analysis.
 *
 * This calls https://api.anthropic.com/v1/messages directly from the
 * browser using the API key you paste into Payslip settings. That means:
 *   - Your API key is stored only in this browser's localStorage. It is
 *     never written to any file this app writes to disk (export/import
 *     deliberately skip it) and never sent anywhere except Anthropic's API.
 *   - Requests (including the payslip image/PDF you upload) go straight
 *     from your browser to Anthropic — this app has no server of its own.
 *   - The Anthropic API blocks browser-origin requests unless they carry
 *     the `anthropic-dangerous-direct-browser-access` header — the same
 *     opt-in the official SDK's `dangerouslyAllowBrowser` flag sets. This
 *     app sends it deliberately, which is exactly the risk it names:
 *     anyone who can read this browser's localStorage (e.g. via another
 *     extension, or physical device access) can read your key. Get a key
 *     at https://console.anthropic.com/settings/keys and treat it like a
 *     password — set spend limits on it if you can.
 */

const CLAUDE_EXTRACTION_PROMPT = `You are extracting structured data from a payslip (also called a loenseddel, payslip, or salary statement). Read the attached document carefully and respond with ONLY a JSON object — no markdown fences, no commentary — matching exactly this shape:

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
 * Sends a payslip file to Claude and returns the parsed extraction object.
 * Throws with a human-readable message on any failure (network, API error,
 * a declined/refused request, or an unparseable response).
 */
async function analyzePayslipWithClaude({ apiKey, model, file }) {
  if (!apiKey) throw new Error("No Claude API key set. Add one under Payslip settings.");
  if (!file) throw new Error("No file selected.");

  const base64Data = await fileToBase64(file);
  const mimeType = file.type || "application/octet-stream";
  const documentBlock = mimeType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } };

  const requestBody = {
    model,
    max_tokens: 2048,
    // Simple extraction from a clear document doesn't need deep reasoning.
    output_config: { effort: "low" },
    // Opus-tier models can decline a request via safety classifiers; let the
    // API retry it on Anthropic's recommended fallback rather than failing.
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: [documentBlock, { type: "text", text: CLAUDE_EXTRACTION_PROMPT }],
      },
    ],
  };

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    throw new Error("Could not reach the Claude API. Check your connection (and that nothing is blocking api.anthropic.com).");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.error?.message || "";
    throw new Error(`Claude API error (${response.status})${detail ? ": " + detail : ""}`);
  }

  if (data.stop_reason === "refusal") {
    const category = data.stop_details?.category;
    throw new Error(`Claude declined to analyze this document${category ? " (" + category + ")" : ""}. Try again or enter the figures manually.`);
  }

  const textBlock = (data.content || []).find((block) => block.type === "text");
  if (!textBlock || !textBlock.text.trim()) {
    throw new Error("Claude returned an empty response.");
  }

  try {
    return JSON.parse(textBlock.text);
  } catch (e) {
    throw new Error("Claude's response wasn't valid JSON. Try again, or enter the figures manually.");
  }
}
