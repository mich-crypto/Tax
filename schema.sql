-- D1 schema for the Cloudflare-hosted sync backend (functions/api/sync.js).
--
-- One table, one row per synced collection — deliberately not a normalized
-- relational schema. Each row holds the WHOLE collection (every tax year,
-- every payslip, ...) as a JSON blob, exactly mirroring what already sits
-- in the browser's localStorage under js/storage.js's STORAGE_KEYS. See
-- js/sync.js for why (whole-collection, last-write-wins sync) and its
-- documented trade-off.
--
-- Apply with:
--   wrangler d1 execute tax-tracker-db --remote --file=schema.sql
-- (drop --remote to apply to the local dev database instead).

CREATE TABLE IF NOT EXISTS sync_state (
  collection TEXT PRIMARY KEY,   -- 'tax_years' | 'payslips' | 'currency_rates' | 'travel'
  data       TEXT NOT NULL,      -- JSON-encoded array or object
  updated_at INTEGER NOT NULL    -- ms since epoch, client-supplied (Date.now())
);
