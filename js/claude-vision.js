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
 * Claude tokenizes images by pixel area (~1 token per 28x28 patch), so cost
 * scales with resolution, not with how legible the text needs to be. A
 * straight-from-the-phone photo is easily 3000px+ on a side — 1280px keeps a
 * payslip perfectly readable at a fraction of the tokens (and bytes). Returns
 * a re-encoded JPEG Blob, or the original file unchanged if it's already
 * small enough or fails to load (never block analysis over this).
 */
function downscaleImageIfNeeded(file, maxDimension = 1280) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(file);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Not an image we can decode this way — send it as-is.
    };
    img.src = objectUrl;
  });
}

// Server-side fallback ("declined? retry on Anthropic's recommended model")
// is a safety net for Opus/Fable-tier safety classifiers, which cheaper
// models don't run the same way — and isn't a supported parameter on every
// model. Only send it for models known to support it, so switching the
// model field to something cheaper (e.g. claude-haiku-4-5) never 400s.
const MODELS_WITH_SERVER_SIDE_FALLBACK = new Set(["claude-opus-5"]);

/**
 * Sends a payslip file to Claude and returns the parsed extraction object.
 * Throws with a human-readable message on any failure (network, API error,
 * a declined/refused request, or an unparseable response).
 */
async function analyzePayslipWithClaude({ apiKey, model, file }) {
  if (!apiKey) throw new Error("No Claude API key set. Add one under Payslip settings.");
  if (!file) throw new Error("No file selected.");

  const mimeType = file.type || "application/octet-stream";
  const isPdf = mimeType === "application/pdf";
  const uploadFile = isPdf ? file : await downscaleImageIfNeeded(file);

  const base64Data = await fileToBase64(uploadFile);
  const documentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
    : { type: "image", source: { type: "base64", media_type: uploadFile.type || mimeType, data: base64Data } };

  const useFallback = MODELS_WITH_SERVER_SIDE_FALLBACK.has(model);
  const requestBody = {
    model,
    max_tokens: 2048,
    // Simple extraction from a clear document doesn't need deep reasoning.
    output_config: { effort: "low" },
    // See MODELS_WITH_SERVER_SIDE_FALLBACK above for why this is conditional.
    ...(useFallback ? { fallbacks: "default" } : {}),
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
        ...(useFallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
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
