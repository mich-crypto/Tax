/**
 * TEMPORARY — testing only. This client-side Claude API integration for
 * payslip analysis exists to compare quality against Gemini (js/gemini.js)
 * before release; the shipped version will revert to Gemini. Switch between
 * them any time via the "AI provider" selector under Settings.
 *
 * Same security model as the Gemini integration: this calls
 * https://api.anthropic.com/v1/messages directly from the browser using the
 * API key pasted into Settings.
 *   - Your API key is stored only in this browser's localStorage. It is
 *     never written to any file this app writes to disk (export/import
 *     deliberately skip it) and never sent anywhere except Anthropic's API.
 *   - Requests (including the payslip image/PDF you upload) go straight from
 *     your browser to Anthropic — this app has no server of its own. The
 *     "anthropic-dangerous-direct-browser-access" header is Anthropic's own
 *     opt-in for exactly this kind of client-side calling.
 *   - Get a key at https://console.anthropic.com/settings/keys — this is
 *     separate, pay-as-you-go API billing, not a claude.ai subscription.
 *     Treat it like a password: anyone with it can spend your quota.
 *
 * Uses the same extraction prompt and downscaling helper as Gemini
 * (GEMINI_EXTRACTION_PROMPT / downscaleImageIfNeeded, both from js/gemini.js
 * — load that script before this one) so results are a drop-in match.
 */

/**
 * Sends a payslip file to Claude and returns the parsed extraction object.
 * Throws with a human-readable message on any failure (network, API error,
 * refusal, or an unparseable response).
 */
async function analyzePayslipWithClaude({ apiKey, model, file }) {
  if (!apiKey) throw new Error("No Claude API key set. Add one under Settings.");
  if (!file) throw new Error("No file selected.");

  const isPdf = (file.type || "") === "application/pdf";
  const uploadFile = isPdf ? file : await downscaleImageIfNeeded(file);
  const base64Data = await fileToBase64(uploadFile);
  const mediaType = uploadFile.type || file.type || "application/octet-stream";

  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } };

  const requestBody = {
    model,
    max_tokens: 1024,
    // A fixed-schema extraction from one document is a simple, well-specified
    // task — low effort keeps this cheap without the failure modes of
    // explicitly disabling thinking (Opus 5 has thinking on by default).
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [fileBlock, { type: "text", text: GEMINI_EXTRACTION_PROMPT }],
      },
    ],
  };

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    throw new Error("Could not reach the Claude API. Check your connection (and that nothing is blocking api.anthropic.com).");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || "";
    } catch (e) {
      // ignore — fall through with empty detail
    }
    throw new Error(`Claude API error (${response.status})${detail ? ": " + detail : ""}`);
  }

  const data = await response.json();
  if (data.stop_reason === "refusal") {
    throw new Error("Claude declined to analyze this document.");
  }

  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("");
  if (!text.trim()) {
    throw new Error("Claude returned an empty response.");
  }

  // Not using structured outputs here (a bigger change than this temporary
  // test warrants) — the prompt asks for bare JSON, but strip a ```json
  // fence defensively in case the model added one anyway.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Claude's response wasn't valid JSON. Try again, or enter the figures manually.");
  }
}
