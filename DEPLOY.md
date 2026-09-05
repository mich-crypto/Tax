# Deploying to Cloudflare (Pages + D1 + Access)

This turns the static, browser-only Tax Tracker into a site backed by a
real database (Cloudflare D1), so the same data shows up on another
device — while the browser still keeps its own local copy and works
offline (see `js/sync.js` for how that works, and its trade-offs).

**This document is a walkthrough for you to run yourself.** It needs your
own Cloudflare login, so none of it can be done from this session — every
command below is one you paste into your own terminal.

Nothing here is optional if real tax data is going into it: skip the
Access section and anyone with the URL can read (and, worse, silently
overwrite) everything in the database.

## 0. Before you start

You'll need:
- **Node.js** installed (for `npx`/`npm`) — if `node -v` works in a
  terminal, you have it.
- A **Cloudflare account** — sign up free at
  [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). No
  credit card needed for what this uses (Pages, D1 and Access all have
  free tiers this app fits comfortably inside).

Everything else below installs as you go.

## 1. Install Wrangler and log in

Wrangler is Cloudflare's CLI — it creates the database, deploys the site,
and is how you'll run any of these commands.

```sh
npm install -g wrangler
wrangler login
```

`wrangler login` opens a browser tab to authorize the CLI against your
Cloudflare account. Do this once.

## 2. Create the D1 database

From the repo root (this folder):

```sh
wrangler d1 create tax-tracker-db
```

This prints something like:

```
[[d1_databases]]
binding = "DB"
database_name = "tax-tracker-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Open `wrangler.toml` in this repo and replace
`REPLACE_WITH_YOUR_DATABASE_ID` with the `database_id` value it printed.
Leave `binding = "DB"` exactly as it is — `functions/api/sync.js` expects
that name.

## 3. Apply the schema

```sh
wrangler d1 execute tax-tracker-db --remote --file=schema.sql
```

This creates the one table (`sync_state`) the backend uses — see
`schema.sql` for what it holds and why it's deliberately this simple.

## 4. Deploy the site

```sh
wrangler pages deploy .
```

The first time, it asks you to name the Pages project (e.g.
`tax-tracker`) and create it. This uploads every static file (the HTML,
`css/`, `js/`) **and** `functions/api/sync.js` as a serverless function —
Pages wires up `/api/sync` automatically because of where that file
lives (`functions/api/sync.js` → the URL path `/api/sync`; that's how
Pages Functions routing works, nothing to configure).

You'll get a URL like `https://tax-tracker-<hash>.pages.dev`. Opening it
now would work, but **stop here and do the next section before actually
using it** — right now it's a real database with no lock on the door.

### Binding D1 to the deployed project

`wrangler.toml`'s `[[d1_databases]]` section should bind it automatically
on deploy. If `/api/sync` returns a 500 once deployed, bind it by hand
instead: Cloudflare dashboard → Workers & Pages → your project → Settings
→ Functions → D1 database bindings → add one named `DB` pointing at
`tax-tracker-db`, then redeploy (`wrangler pages deploy .` again).

## 5. Lock it down with Cloudflare Access

This is the step that actually protects your data — everything above
just gets the site running.

1. Cloudflare dashboard → **Zero Trust** (left sidebar) → if this is your
   first time there, it asks you to pick a team name and a plan; the
   Free plan covers this.
2. **Access → Applications → Add an application → Self-hosted.**
3. **Application domain**: your `*.pages.dev` URL from step 4 (or a
   custom domain, if you've attached one to the Pages project).
4. **Policies**: add one policy, action **Allow**, rule **Emails** —
   list your own email address (add more if more than one person should
   get in). This is what actually keeps everyone else out.
5. Save. Reload your `*.pages.dev` URL — Cloudflare now shows its own
   login page (an emailed one-time code, by default) before anything
   else loads, `/api/sync` included, since Access sits in front of the
   whole domain.

From here on, only people on that email list can reach the site or the
database behind it at all — this app has no login code of its own on
purpose, because Access already does that job at the edge, before a
request ever reaches `functions/api/sync.js`.

## 6. Try it

Open the site, add a test tax year, then open the same URL in a private/
incognito window (or another device) and log in with Access again — the
test year should appear there too within a few seconds (`js/sync.js`
pulls on every page load).

## Updating the site later

Any time you (or Claude, on your instruction) change the static files or
`functions/api/sync.js`:

```sh
wrangler pages deploy .
```

Schema changes (if the data model ever grows) go through
`wrangler d1 execute tax-tracker-db --remote --file=<new-migration>.sql`
the same way step 3 did.

## What's NOT covered by any of this

- **API keys** (Gemini/Claude, under Settings) never touch the database
  or `functions/api/sync.js` — they stay in that browser's own
  `localStorage`, exactly as before, sent only straight from your
  browser to the AI provider. Deploying this doesn't change that.
- **Local dev**: `wrangler pages dev .` runs the whole thing (static
  files + the Function + a local D1 replica) on your machine before you
  deploy anywhere, if you want to try changes first. Add
  `--d1 DB=tax-tracker-db` to point it at the same binding.
