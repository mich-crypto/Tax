/**
 * Cloudflare Pages Function — the entire backend.
 *
 * Deployed alongside the static site, Cloudflare routes any request to
 * /api/sync here automatically (Pages Functions' file-based routing: this
 * file's path under functions/ IS the URL path). See DEPLOY.md for how to
 * create the D1 database and bind it to this project as `DB`.
 *
 * The whole database is one table, sync_state, with exactly one row per
 * collection ("tax_years", "payslips", "currency_rates", "travel") — see
 * schema.sql. Sync is whole-collection, last-write-wins: js/sync.js sends
 * the entire array/object for whichever collection changed, stamped with
 * a client-side timestamp, and this function only accepts it if it's not
 * older than what's already stored. That keeps this file — and the data
 * model — deliberately tiny; the trade-off (two devices editing the same
 * collection within the same few seconds can lose one side's change) is
 * documented in js/sync.js's own comment.
 *
 * Access control is NOT handled here on purpose: put Cloudflare Access
 * (Zero Trust) in front of the whole Pages project instead, so a request
 * never reaches this code — or the rest of the site — without already
 * being authenticated. See DEPLOY.md.
 */

const COLLECTIONS = new Set(["tax_years", "payslips", "currency_rates", "travel"]);

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT collection, data, updated_at FROM sync_state"
  ).all();
  return Response.json({ collections: results || [] });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { collection, data, updatedAt } = body || {};
  if (!COLLECTIONS.has(collection)) {
    return new Response(`Unknown collection: ${collection}`, { status: 400 });
  }
  if (!Number.isFinite(updatedAt)) {
    return new Response("updatedAt must be a number (ms since epoch)", { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT updated_at FROM sync_state WHERE collection = ?"
  ).bind(collection).first();

  // Last-write-wins: a push older than what's already stored is rejected,
  // not silently merged — the caller (js/sync.js) leaves its own copy
  // alone and picks up the newer server value on its next pull instead.
  if (existing && existing.updated_at > updatedAt) {
    return Response.json({ accepted: false, serverUpdatedAt: existing.updated_at });
  }

  await env.DB.prepare(
    `INSERT INTO sync_state (collection, data, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(collection) DO UPDATE SET data = ?2, updated_at = ?3`
  ).bind(collection, JSON.stringify(data ?? null), updatedAt).run();

  return Response.json({ accepted: true });
}
