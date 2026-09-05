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

const GEMINI_EXTRACTION_PROMPT = `You are extracting figures from a payslip (also called a loenseddel/lønseddel, payslip, or salary statement) for THIS PAY PERIOD ONLY.

Two things trip this up on real payslips — read carefully before answering:
1. Most payslips also print an "Accumulated Year-to-date" / "YTD" box with running totals since the start of the year, often repeated on every page. IGNORE that box completely — every number you extract must be for the single pay period stated at the top of the document (its own date range or month), never a year-to-date figure.
2. Some payslips (e.g. shift workers, offshore/rotational work) attach a multi-page daily time/attendance breakdown after the payslip itself. Ignore those detail pages — use only the payslip's own labeled summary/total lines.

Read the attached document carefully and respond with ONLY a JSON object — no markdown fences, no commentary — matching exactly this shape:

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

Field-by-field rules:
- "employer": the paying company's name.
- "country": the country whose payroll/tax rules produced this document — infer it from the terminology used (e.g. "AM-bidrag"/"A-tax"/"ATP" and CPR numbers mean Denmark), not from the employee's home address, which may be in a different country.
- "currency": a 3-letter ISO code (e.g. DKK, USD, EUR) if determinable.
- "payPeriodStart" / "payPeriodEnd": this pay period's own date range (YYYY-MM-DD) — not the document's print/issue date.
- "grossPay": this period's total gross pay before deductions — prefer a line explicitly labeled "gross pay" (or local equivalent) over any other subtotal.
- "netPay": the amount actually paid out this period — prefer a line showing the bank transfer/payout amount ("transferred to account", "net pay", "udbetalt") over any other subtotal.
- "taxWithheld": all compulsory statutory tax/contribution deductions this period — income tax plus any labor-market or social-security contribution withheld at source (e.g. Denmark's "A-tax" plus "AM-bidrag"/labor market contribution, summed together). Do not include voluntary items here.
- "otherDeductions": voluntary or non-tax deductions this period only (pension, health/dental insurance, savings schemes) — never a YTD figure.
- "notes": anything else worth a human's attention — bonuses, overtime, allowances, sick pay, or a field you had to choose between two candidate numbers for.
- Numbers are plain numbers only — no currency symbols, letters, or thousands separators. Many European payslips (Danish ones included) print numbers with a period as the thousands separator and a comma as the decimal point — a figure printed "39.371,08" is 39371.08 in your answer, not 39371 or 3937108.
- If a field truly cannot be determined, use null. Never guess a number you didn't actually find on the document.`;

/**
 * Extraction prompt for an official tax assessment (a "final numbers" letter
 * from a tax authority or accountant — e.g. a Danish årsopgørelse, a Belgian
 * aanslagbiljet, a Polish PIT-36 decision), as opposed to a monthly payslip.
 * Deliberately narrow: just the two figures a country row's Actual Tax edit
 * needs (see js/year.js) — Tax return is derived from these, not read off
 * the document. Country and currency are NOT asked for here: the person
 * reviewing the result already knows which country row a given letter
 * belongs to, and figures are expected in that row's own currency.
 */
const ASSESSMENT_EXTRACTION_PROMPT = `You are extracting figures from an official tax assessment for ONE TAX YEAR — a final-numbers document from a tax authority or accountant (e.g. a Danish "årsopgørelse", a Belgian "aanslagbiljet"/"avertissement-extrait de rôle", a Polish PIT-36 decision, or similar), NOT a monthly payslip.

Respond with ONLY a JSON object — no markdown fences, no commentary — matching exactly this shape:

{
  "taxableIncome": number or null,
  "actualTax": number or null,
  "notes": string or null
}

Field-by-field rules:
- "taxableIncome": the total income subject to tax for the year, as stated on the assessment (terms like "taxable income", "skattepligtig indkomst", "podstawa opodatkowania", "revenu imposable").
- "actualTax": the final tax liability actually assessed for the year — not a monthly or provisional withholding figure, and not a balance-due or refund amount (which is the difference between this and what was already paid, not this figure itself).
- "notes": anything worth a human's attention — which tax year this covers, if you had to choose between two candidate numbers, or anything unclear.
- Numbers are plain numbers only — no currency symbols or thousands separators. Documents may use a period as thousands separator and comma as decimal (e.g. "575.597,00" is 575597.00), or the reverse — infer from context.
- If a field truly cannot be determined, use null. Never guess a number you didn't actually find on the document.`;

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
 * Vision APIs generally tokenize images by resolution, not by how legible
 * the text needs to be — a straight-from-the-phone photo is easily 3000px+
 * on a side. 1280px keeps a payslip perfectly readable at a fraction of the
 * tokens (and upload bytes). Returns a re-encoded JPEG Blob, or the original
 * file unchanged if it's already small enough or fails to load (never block
 * analysis over this).
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
      resolve(file); // Not an image we can decode this way (e.g. a PDF) — send it as-is.
    };
    img.src = objectUrl;
  });
}

/**
 * Sends a payslip file to Gemini and returns the parsed extraction object.
 * Throws with a human-readable message on any failure (network, API error,
 * or an unparseable response).
 */
async function analyzePayslipWithGemini({ apiKey, model, file, prompt }) {
  if (!apiKey) throw new Error("No Gemini API key set. Add one under Payslip settings.");
  if (!file) throw new Error("No file selected.");

  const isPdf = (file.type || "") === "application/pdf";
  const uploadFile = isPdf ? file : await downscaleImageIfNeeded(file);

  const base64Data = await fileToBase64(uploadFile);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt || GEMINI_EXTRACTION_PROMPT },
          { inline_data: { mime_type: uploadFile.type || file.type || "application/octet-stream", data: base64Data } },
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
