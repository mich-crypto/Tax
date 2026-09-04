/**
 * A client-side password gate for the deployed site — NOT real security.
 * There's no server here, so "the password" can only ever be a value
 * checked by JavaScript shipped to every visitor's browser: anyone who
 * opens devtools can read the check, and — because only a hash is stored
 * below, never the plaintext — could attempt to brute-force it offline.
 * Treat this as a deterrent against a stranger stumbling onto the URL, not
 * as protection for genuinely sensitive data on a hostile network. For real
 * protection, use your static host's own access control instead — e.g.
 * Netlify's site-wide password under Site settings → Visitor access, which
 * is enforced on Netlify's server before this code (or anything else on the
 * page) is even sent to the browser.
 *
 * How to set or change the site password:
 *   1. Open Settings → Site lock → type a new password → "Generate hash".
 *   2. Copy the hash it shows you (never the password itself — the
 *      generator runs entirely in your browser and never sends it
 *      anywhere) and paste it in below as SITE_LOCK_HASH, replacing
 *      whatever is there.
 *   3. Commit and deploy. Every visitor is now asked for the new password
 *      once per browser, until their storage is cleared or the hash
 *      changes again.
 *
 * Leave SITE_LOCK_HASH as "" to ship with the gate switched off (the
 * default — nothing is asked, every page loads straight through).
 */
const SITE_LOCK_HASH = "";

(function () {
  if (!SITE_LOCK_HASH) return; // gate switched off

  const UNLOCK_KEY = "taxtracker_site_unlocked_v1";
  if (localStorage.getItem(UNLOCK_KEY) === SITE_LOCK_HASH) return; // already unlocked for the current password

  // Hide the real page immediately (before it paints) rather than merely
  // overlaying it, so a screenshot or a quick glance during the lock screen
  // never shows real data underneath. The overlay re-enables its own
  // visibility below, which wins over this inherited hidden state.
  document.documentElement.style.visibility = "hidden";

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function showLock() {
    const overlay = document.createElement("div");
    overlay.id = "site-lock-overlay";
    overlay.innerHTML = `
      <style>
        #site-lock-overlay { visibility:visible; position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:#0b0f14; font-family:'IBM Plex Sans', system-ui, sans-serif; }
        #site-lock-overlay .box { background:#141b23; border:1px solid #2a3540; border-radius:10px; padding:32px; width:min(320px, 90vw); text-align:center; }
        #site-lock-overlay h1 { font-size:16px; font-weight:600; color:#e8edf2; margin:0 0 16px; }
        #site-lock-overlay input { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:6px; border:1px solid #33404b; background:#0b0f14; color:#e8edf2; font-size:14px; }
        #site-lock-overlay button { margin-top:12px; width:100%; padding:10px 12px; border-radius:6px; border:none; background:#2f7d6b; color:#fff; font-size:14px; cursor:pointer; }
        #site-lock-overlay .err { color:#e2726b; font-size:12px; min-height:16px; margin-top:8px; }
      </style>
      <div class="box">
        <h1>🔒 Enter the site password</h1>
        <input type="password" id="site-lock-input" autocomplete="off">
        <button type="button" id="site-lock-submit">Unlock</button>
        <div class="err" id="site-lock-err"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#site-lock-input").focus();

    const input = overlay.querySelector("#site-lock-input");
    const err = overlay.querySelector("#site-lock-err");

    async function attempt() {
      const hash = await sha256Hex(input.value);
      if (hash === SITE_LOCK_HASH) {
        localStorage.setItem(UNLOCK_KEY, SITE_LOCK_HASH);
        overlay.remove();
        document.documentElement.style.visibility = "";
      } else {
        err.textContent = "Wrong password.";
        input.value = "";
        input.focus();
      }
    }
    overlay.querySelector("#site-lock-submit").addEventListener("click", attempt);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") attempt();
    });
  }

  if (document.body) showLock();
  else document.addEventListener("DOMContentLoaded", showLock);
})();
