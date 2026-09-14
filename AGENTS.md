# Website/AGENTS.md — GrainBroker site: technical operating notes

This file is scoped to the `Website/` subfolder — deploy process, integration
details, and known issues for the grainbroker.com.au site. For business rules,
authority limits, and who Grain Broker acts for, see `../company/AGENTS.md`
first — that's the company-wide charter and takes precedence on any business
question. This file only covers how the website itself works.

## Site structure

Live source of truth: `grainbroker-site/` (static HTML/CSS/JS, edit here
first). Pages: `index.html`, `sell.html` (grower wizard), `buy.html` (buyer
intake — **has a known live bug**, see below), `check.html` (buyer quick
market-check), `prices.html`, `news.html`, `about.html`. Data files
`data/news.js` and `data/prices.js` feed the site.

## Brand

Single source of truth: `brand/grainbroker-brand-guide.md` (duplicate,
higher-res assets also live in `../Marketing/Logo/` and `../Marketing/Brand
Kit/` — same files, checked byte-identical 14 Jul 2026). Key values — do not
substitute or improvise:
- Colours: orange #F57C00, lime green #A5D66A, deep green #1B2A00, neutrals
  #222222 / #F5F5F5.
- Font: **Montserrat only**.
- Tagline: "Connect. Negotiate. Transact." Hero line: "The smarter way to
  trade grain" ("to trade grain" in primary green).

## Hosting & deploy

- GitHub Pages, repo **Police26953/grainbroker-website**, custom domain
  www.grainbroker.com.au.
- To update the live site: edit files in `grainbroker-site/`, then git
  commit + push to that repo's main branch, authenticating with the deploy
  token described under Credentials below.
- Contact info live on site: phone 0414 503 466 (Jack's mobile),
  email info@grainbroker.com.au.
- The daily news automation (Claude scheduled task `grainbroker-daily-news`,
  not this Website/ folder's own responsibility) clones the live repo fresh
  into a temp dir each run, edits `data/news.js`, and pushes — it does not
  edit this local copy directly first. Treat `data/news.js` as automation
  output; don't hand-edit it without reason.

## Brevo (CRM/email) integration

- Lists: **#4 "Grain Broker - Growers"**, **#3 "Grain Broker - Buyers"**.
  Free plan caps sends at 300/day.
- Rule: Brevo is for people/communications only — grain deal status lives in
  the dashboard, never in Brevo. See `../company/AGENTS.md` for who Grain
  Broker actually represents (growers only) before drafting any buyer-facing
  copy.
- Grower form (`sell.html` → `gbSubmitGrower` in `js/site.js`) is live and
  verified working, posts to list #4.
- Buyer quick-check (`check.html` → `gbSubmitBuyerCheck`) is live and
  verified, posts to list #3. Important nuance: this endpoint only
  **updates existing** Brevo contacts — a brand-new email silently
  "succeeds" but never creates a contact. Updates aren't instant (~2 min to
  reflect).
- **buy.html submit (fixed 15 Sep 2026)**: page embeds official GHL Buyer
  Needs form `ydhWyeSBO8IfFxYPCQRS` (iframe + form_embed.js). Form submitted
  → workflow Buyer Needs Tag → tag `buyer-needs`. Custom `gbSubmit` / inbound
  webhook paths were abandoned (Turnstile 429; webhook stuck in test mode).
  Grower + buyer-check still Brevo.
- Technical gotchas for any new Brevo sibforms integration: POST to the
  resolved `/v2/serve/...` URL (the configured `.../serve/...` URL
  302-redirects and can drop the POST body on redirect); use plain CORS
  fetch, not `mode:"no-cors"` (Brevo supports real CORS — `no-cors` masks
  real failures behind an always-"ok" opaque response); required fields are
  `EMAIL`, `SMS` (digits + country code, no `+`/leading `0`), `FIRSTNAME`,
  plus a honeypot `email_address_check` (must stay empty) and `locale=en`.
- **Important gap**: the form-based integrations above work without a Brevo
  API key (they POST to public sibforms endpoints). There is currently **no
  stored Brevo API key** anywhere in this folder — the CRM was only ever
  connected via an OAuth connector inside a Claude/Cowork session. If an
  agent needs to do anything beyond what the existing forms do (read/search
  contacts, send campaigns, update records directly via the Brevo API),
  that access doesn't exist yet — flag it to Jack rather than assuming it.
- Note: `../Clients/` holds separately-classified CSV exports (Growers.csv
  1,603 rows, Buyers.csv 327, Merchants.csv 81, Agronomists.csv 15) that
  haven't been reconciled against these Brevo list counts (1,586 / 323 per
  `../company/AGENTS.md`) — don't assume they're identical without checking.

## Critical operating lesson: verify file writes independently

This pipeline has repeatedly produced **silently truncated files** — from
in-process file write tools on files in the 8-12KB+ range, from `cp` into
git clones, and from OneDrive sync round-trips on user-edited files. A
same-pipeline diff right after a write is not proof the file is correct.

Rules to follow for this project:
- For any generated file expected to land above ~8KB (long JS/JSON/docs),
  write it via a bash heredoc (`cat > path << 'EOF' ... EOF`), then verify
  by reading it back through the shell directly.
- After any deploy/push, re-fetch the pushed file from an independent
  authoritative source (e.g. the GitHub Contents API) rather than trusting
  a local diff taken in the same breath as the write.
- For anything executable (JS/JSON), run a syntax/parse check
  (`node --check`, `python -m json.tool`) against that independently-fetched
  copy before considering the push good.
- For files coming back from Jack via the OneDrive-synced folder (especially
  zip-based formats like .xlsx/.docx/.pptx), verify structural integrity
  (e.g. EOCD signature) before trusting content.
- If "it's not showing up" is reported for a live page, check the browser
  console for exceptions before assuming it's just a caching issue.

## Open items / known TODOs (as of 14 Jul 2026)

- ~~Fix `buy.html`~~ done 15 Sep 2026 — `gbSubmit` → GHL Buyer Needs (not Brevo).
- Privacy policy + terms pages still placeholder/missing.
- Confirm "Enforce HTTPS" is ticked in repo Settings → Pages.
- info@grainbroker.com.au mailbox was on a free trial of GoDaddy Email
  Essentials — confirm it's been converted to paid, or mail will start
  bouncing.
- Test contacts tagged "TEST DELETE ME - Claude QA" were left in Brevo lists
  during integration testing (including jackharrington@bigpond.com added to
  the Buyers list as a side effect) — flag for cleanup if not already done.
- No Brevo API key is stored anywhere — needed for any CRM action beyond
  what the existing site forms already do.
- Reconcile `../Clients/` CSV counts against the live Brevo list counts (see
  Brevo section above).
- This file moved here from a folder called "Website Site Builder Skills"
  on 14 Jul 2026 as part of consolidating everything into this business
  folder — that old location may still have stale copies; this folder is
  now the authoritative one.

## Credentials in this folder

- **`.grainbroker-deploy-token`** — GitHub fine-grained personal access
  token, scoped to repo `Police26953/grainbroker-website`, Contents
  read/write only. Use to authenticate `git push` to that repo (e.g.
  `https://<token>@github.com/Police26953/grainbroker-website.git` as the
  push remote). Expires ~8 July 2027 — if pushes start failing with auth
  errors after that date, generate a fresh fine-grained PAT with the same
  scope and replace this file's contents.
- **`.mobilemessage-api-credentials.txt`** — SMS API credentials
  (MobileMessage service), referenced in `../company/AGENTS.md` as the SMS
  platform for buyer/grower outreach.

Handle both with care: never print their contents into chat, logs, commits,
or persisted memory/notes. Never copy them into `grainbroker-site/` (the
folder that actually gets pushed to GitHub Pages) — they must stay outside
anything that becomes publicly visible on the live site.

## buy.html / sell.html CRM intake (15 Sep 2026)

### Cause
- Custom `buy.html` called `gbSubmit` → GHL `forms/submit` fails with Cloudflare Turnstile (`missing-input-response` / 429). GHL’s Turnstile site key is hostname-bound to LeadConnector, not `grainbroker.com.au`.
- GHL inbound webhook “Website buy.html intake” returns `Success: test request received` and never creates contacts (abandoned).
- Official GHL Buyer Needs iframe embed (`ydhWyeSBO8IfFxYPCQRS`) works for CRM + tag `buyer-needs` (temporary fallback).
- `sell.html` branded wizard was posting to Brevo (`gbSubmitGrower` / sibforms), not Grain Broker GHL. Grower Interest form id `mroKpzQ2kJCJ1Z3O8RYS`; tag `grower-interested`.

### Fix (long-term)
- Branded buy + sell UX kept (Montserrat, orange/green, phone **0414 503 466** only).
- Thin intake proxy (Cloudflare Worker `grainbroker-buy-api`, code in `/workspace/grainbroker-buy-api`) uses Grain Broker Private Integration (contacts.readonly + contacts.write). Token file: `grainbroker-site-meta/.ghl-grainbroker-pit` (never in client JS).
- POST `{type:"buyer"|"grower", ...}` → upsert contact in `DJQBTIQasTdt54iPJuny` + tag `buyer-needs` / `grower-interested` + note.
- `js/site.js`: `buyerIntakeUrl` drives `gbSubmit` and `gbSubmitGrower`. Broken webhook URL cleared. Brevo grower endpoint cleared.

### Status
- PIT + upsert/tag proven in Grain Broker SA.
- Temporary intake URL (15 Sep 2026): `https://gentle-integrating-commitment-riverside.trycloudflare.com` (box Node + cloudflared; PIT server-side). Branded buy/sell deployed via this path. Durable Cloudflare Worker still preferred later.
