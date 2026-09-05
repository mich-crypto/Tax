/**
 * Optional sync layer for a Cloudflare Pages + D1 deployment — see
 * DEPLOY.md for how to actually stand one up. js/storage.js stays the
 * synchronous, localStorage-backed source of truth every page reads and
 * writes; this module just keeps a database in step with it in the
 * background, so the same data shows up on another device, or survives
 * this browser's storage being cleared.
 *
 * Not deployed with a backend at all? Nothing changes. storage.js's calls
 * to notifySynced() are no-ops when `scheduleSync` doesn't exist (this
 * script not loaded, or /api/sync not reachable), so the app is exactly
 * the original offline-only, browser-only tool.
 *
 * How it works:
 *   - On page load, pulls all four collections from GET /api/sync. Any
 *     collection where the server's copy is newer than this browser's
 *     last-known sync point overwrites the local copy, and the page
 *     reloads once so it renders what was just pulled.
 *   - After a local change (via storage.js's save*()/wipeAll()/
 *     clearTravel() calling notifySynced()), pushes that WHOLE collection
 *     to POST /api/sync, debounced, stamped with the current time.
 *   - Whole-collection, last-write-wins: the unit of sync is "all tax
 *     years" as one blob, not one tax year at a time. Simple and safe for
 *     how this app is actually used — one person, rarely two devices
 *     editing within seconds of each other — but a real trade-off worth
 *     knowing: editing the SAME collection on two open tabs or devices
 *     before either has synced loses one side's changes. Give a sync a
 *     few seconds to finish before switching devices.
 *   - API keys (Gemini/Claude) and which provider is active are never
 *     synced — same "stays in this browser" rule Export/Import already
 *     follows under Settings, untouched by any of this.
 */

(function () {
  const API_BASE = "/api/sync";
  const SYNC_META_KEY = "taxtracker_sync_meta_v1"; // { [collection]: last-known server updated_at }
  const RELOAD_GUARD_KEY = "taxtracker_sync_reload_guard"; // sessionStorage — avoids a reload loop
  const DEBOUNCE_MS = 1500;

  /** The four synced collections, and the localStorage key each lives under. */
  const COLLECTION_KEYS = {
    tax_years: () => STORAGE_KEYS.taxYears,
    payslips: () => STORAGE_KEYS.payslips,
    currency_rates: () => STORAGE_KEYS.currencyRates,
    travel: () => STORAGE_KEYS.travel,
  };

  function readMeta() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_META_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function writeMeta(meta) {
    try {
      localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
    } catch (e) {
      // Storage full or unavailable — sync degrades to "always push,
      // sometimes re-pull the same thing", not a correctness problem.
    }
  }

  function readLocal(collection) {
    try {
      const raw = localStorage.getItem(COLLECTION_KEYS[collection]());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocal(collection, value) {
    const key = COLLECTION_KEYS[collection]();
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  // ---------- Pull (on page load) ----------

  async function pull() {
    let response;
    try {
      response = await fetch(API_BASE);
    } catch (e) {
      return; // Offline, or no backend at this URL — stay on the local copy.
    }
    if (!response.ok) return;

    let body;
    try {
      body = await response.json();
    } catch (e) {
      return;
    }

    const meta = readMeta();
    let changed = false;

    (body.collections || []).forEach((row) => {
      if (!COLLECTION_KEYS[row.collection]) return;
      const known = meta[row.collection] || 0;
      if (row.updated_at <= known) return;
      let data;
      try {
        data = JSON.parse(row.data);
      } catch (e) {
        return;
      }
      writeLocal(row.collection, data);
      meta[row.collection] = row.updated_at;
      changed = true;
    });

    if (!changed) return;
    writeMeta(meta);

    // Reload once so the page's own script re-reads Store with what was
    // just pulled — simpler and safer than threading a live re-render
    // into every page. Guarded so a fetch that keeps returning something
    // "newer" (clock skew, a server bug) can't reload in a tight loop.
    const guardUntil = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() > guardUntil) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now() + 5000));
      location.reload();
    }
  }

  // ---------- Push (after a local change) ----------

  const timers = {};
  const pendingCollections = new Set();

  /**
   * Sends the current value of one collection. Two delivery modes:
   *   - normal (fetch): can read the response, so it updates sync meta on
   *     acceptance — the common case, when nothing is navigating away.
   *   - beacon (navigator.sendBeacon): fire-and-forget, but — unlike
   *     fetch — guaranteed to actually go out even as the page unloads.
   *     Used only when flushing on pagehide/visibilitychange, below. No
   *     response to read, so sync meta isn't updated here; the next
   *     successful round-trip (another push, or the next page's pull)
   *     reconciles it — not incorrect, just not the fast path.
   */
  function sendCollection(collection, useBeacon) {
    pendingCollections.delete(collection);
    const data = readLocal(collection);
    const updatedAt = Date.now();
    const payload = JSON.stringify({ collection, data, updatedAt });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(API_BASE, new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch(API_BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!result || !result.accepted) return;
        const meta = readMeta();
        meta[collection] = updatedAt;
        writeMeta(meta);
      })
      .catch(() => {
        // Offline — the next successful push (or the next pull, on
        // whichever device gets there first) reconciles this later.
      });
  }

  /** Called by storage.js after any of the four collections changes locally. Debounced per collection, so several quick edits push once. */
  function scheduleSync(collection) {
    if (!COLLECTION_KEYS[collection]) return;
    pendingCollections.add(collection);
    clearTimeout(timers[collection]);
    timers[collection] = setTimeout(() => sendCollection(collection, false), DEBOUNCE_MS);
  }

  /**
   * A debounced push due in 1.5s never gets to fire if the page navigates
   * away sooner — exactly what happens right after adding a tax year,
   * which jumps straight to year.html. Flush anything still pending,
   * via sendBeacon, whenever the page is about to disappear (unloading)
   * or merely go to the background (another tab, switching apps) —
   * either way, better synced sooner than lost.
   */
  function flushPending() {
    pendingCollections.forEach((collection) => {
      clearTimeout(timers[collection]);
      sendCollection(collection, true);
    });
  }

  window.addEventListener("pagehide", flushPending);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPending();
  });

  window.scheduleSync = scheduleSync;

  pull();
})();
