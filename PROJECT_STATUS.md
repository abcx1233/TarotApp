# Reader Console — Project Status

Audited directly against the code, `git log`, and `supabase/schema.sql` on 2026-09-04.
Where something couldn't be confirmed from the repo itself, it's marked as such rather than assumed.

---

## Purpose & context

Reader Console is the private internal ops dashboard for **Deep Blue Divination**, a UK tarot
reading business. It exists to run the business's actual order pipeline: take a tarot order
(manual entry or via webhook from the public site/Stripe), generate a long-form AI tarot reading
in the reader's specific voice using OpenAI GPT-4o, review/edit it, and hand it off for delivery
by email or WhatsApp — while tracking clients, order status, and revenue along the way. A second,
largely independent feature runs a daily "Card of the Day" broadcast message for WhatsApp
distribution. It is a single-reader tool (one Supabase Auth user is the intended login) rather
than a multi-tenant product.

---

## Current state

### Reading generation pipeline — fully working, actively hardened
One OpenAI call per reading (`lib/ai/client.ts`, GPT-4o by default) driven by a large structured
prompt (`lib/ai/prompts/builder.ts`, ~550 lines) that locks the model to an exact card list, a
very specific writing-style guide (banned phrases, preferred phrasing, closing-line rules), tone
preset, character target, and optional sections (topic, star sign, oracle card, energy cleansing,
future section). `app/api/readings/generate/route.ts` then does substantial post-processing:
server-side dash stripping, a continuation loop (up to 4 retries at the 12k-character Premium
tier) if the model undershoots length, a hard cut on the ritual add-on, and a multi-pass
truncation pipeline (`[END OF READING]` marker → detected sign-off phrase → sentence-boundary
trim → heuristic closing-line detection → one more marker+sign-off pass) before the canonical
sign-off/disclaimer from `reading_templates` is appended. This truncation logic has clearly been
iterated on hard (see `git log`: "Fix continuation END OF READING marker", "Hard ritual terminal",
"Terminal ritual, route boundary, continuation fix", "Fix sign-off always appended after
truncation") but none of those commits are in the recent history — the pipeline looks settled,
not currently fragile.

Two things README.md claims that the code doesn't actually do:
- README describes reading generation as three AI calls (full reading → email version → WhatsApp
  version). `buildEmailVersionPrompt` / `buildWhatsAppVersionPrompt` exist in `builder.ts` but are
  **never called anywhere** in the app. `readings.email_version` / `whatsapp_version` are always
  written as `null` (`app/api/readings/generate/route.ts:468-469`). In practice the one generated
  reading is reused verbatim for both email and WhatsApp delivery (see `OutputPanel.buildDeliveryMessage`).
- `readings.reading_length` (column + type field) is declared but never populated anywhere —
  `character_target` is the field actually used throughout.

Also confirmed: leftover naming from a prior Groq→OpenAI migration — `GroqConfigError` /
`GroqGenerationError` (`lib/ai/errors.ts`), the `groq_model` columns on `readings` and
`app_settings` (seeded with `llama-3.3-70b-versatile`), and the commented-out `GROQ_API_KEY` in
`.env.local.example`. Purely cosmetic — `lib/ai/client.ts` only ever calls OpenAI — but confusing
to anyone reading the code cold.

**No automated test suite exists in this repo.** There's no test framework in `package.json` and
no `*.test.*` files anywhere. One commit (`b1d9724`, "All tests passing - 346 tests total, 0
failures") only touched application files, not test files — that message almost certainly refers
to manual/external verification of that session's changes, not a suite that can be rerun. Don't
assume test coverage exists.

### Tiers & pricing — fully working
`lib/config/pricing.ts` defines the full price matrix (mini/core/premium/celtic_cross ×
written/voice_note/video) and add-on prices. `ReadingForm` auto-computes price from
tier + format + add-ons unless the reader manually overrides it. Celtic Cross is written-only,
enforced in two places: the price matrix has `null` for its voice_note/video cells, and
`ReadingForm.handleTierChange` force-switches `deliveryFormat` to `'written'` and the delivery
format `PillGroup` disables those two options whenever `isCelticCross` is true.

### Card entry / deck — fully working
78-card deck (`data/tarot-cards.ts`: Major Arcana + Cups/Pentacles/Wands/Swords) with autocomplete
search and suit filtering. Celtic Cross auto-populates the 10 canonical positions
(`CELTIC_CROSS_POSITIONS` in `CardEntry.tsx`) and locks the row count; other tiers allow free
add/remove with tier-specific minimums enforced client-side in `ReadingForm.validateForm`. The
bottom-of-deck card is entered separately and threaded into the prompt as a distinct "undercurrent"
energy, not just another spread position.

### Add-ons — fully working, two independent groups
"Spirit Led" add-ons (Oracle Card, Energy Cleansing — `AddOnsSection.tsx`) change the actual prompt
content and are stored on the `readings` row. "Order" add-ons (Extra Question, 24h Rush, Follow-up
— `OrderAddOnsSection.tsx`) are logistics/pricing only, stored as `order_addons` rows; of these,
only Extra Question feeds back into the prompt (as `specificQuestion`).

### Client / order management — fully working
Orders board with a status pipeline (`pending → in_progress → awaiting_review → sent → archived`,
enforced by UI convention, not a DB constraint), client list/profile with private notes (never
sent to clients — protection is RLS-only, see below), and a soft-delete + 30-day Trash/restore
flow for clients, orders, readings, and daily messages via a shared `deleted_at` pattern. The
sidebar shows a live trash count.

One dead route: `app/dashboard/clients/[id]/page.tsx` exists and works, but nothing in the app
links to it — the Clients page does everything through client-side selection state instead of
navigation to that route.

### Daily card message + automation — fully working, most recently and heavily iterated feature
The last ~10 commits are entirely on this feature. Single-day form (`DailyMessageForm`) and a
30-day `CalendarView` with batch generate/approve/delete, soft-delete + explicit "skip this day"
support, no-repeat-in-7-days card drawing, and a public **unauthenticated** `GET
/api/daily-message/fetch` endpoint gated by `DAILY_MESSAGE_FETCH_SECRET` for pulling today's
approved text into an external automation (README implies an iOS Shortcuts-style consumer; nothing
in this repo builds or calls that consumer). A real race — generation in flight while the date gets
deleted or skipped — is explicitly closed with a re-check-before-write guard
(`shouldSkipWrite` in `lib/daily-message/dates.ts`), applied consistently in both the single and
batch generate routes.

One inconsistency worth knowing: the sign-off "Love and light, Rhiannon x" is hardcoded into the
daily-message prompt (`lib/ai/prompts/daily-message.ts`), unlike the main reading pipeline, which
pulls its sign-off from the editable `reading_templates.signoff_text`. If the reader's name or
sign-off phrase ever changes, this one needs a code edit, not a Settings change.

### Gmail integration — implemented but dormant
The OAuth2 flow (`lib/gmail/auth.ts`, `app/api/auth/gmail/*`) and `sendReadingEmail`
(`lib/gmail/send.ts`) are fully built and wired to a "Connect Gmail account" button in Settings.
But **`sendReadingEmail` is never called anywhere in the app.** The actual "Email" button in
`OutputPanel` just opens a `mailto:` link with the reading as the body — delivery is a manual send
from the reader's own email client, not the Gmail API. The Gmail integration code works if you
call it, but nothing in the current UI does.

### Webhooks — fully working
`POST /api/webhooks/inbound-order` branches on the presence of a `stripe-signature` header: the
Stripe path verifies the signature and parses `checkout.session.completed` metadata
(`lib/webhooks/stripe-parser.ts`); the generic path checks an `X-Webhook-Secret` header for
Supabase DB webhooks or Zapier. Both converge on `createOrderFromWebhook`
(`lib/webhooks/inbound-order.ts`), which upserts the client by email, creates the order + add-ons
+ an initial `readings` row, auto-suggests a topic from keyword matching on the question text, and
auto-assigns a default tone preset by tier. A separate `POST /api/webhooks/email-order` handles the
"Zapier parses an order-confirmation email" path described in the README, via a different
plain-text field parser (`lib/webhooks/email-parser.ts`).

`lib/integrations/website-sync.ts` (`syncOrderStatusToWebsite`) is fully implemented, documented
in README's env var table, and silently no-ops if its three env vars aren't all set — but it is
**never called from any route or component in this repo.** It's dead/unwired even when configured.

---

## On the horizon

- **Gmail send and website-sync are built but not wired up** (see above) — either finish wiring
  them to the UI, or remove them and the README sections that describe them as active.
- **README overstates the AI pipeline**: says three generation steps (full/email/WhatsApp); code
  only does one. Either implement the email/WhatsApp rewrite calls that already exist as unused
  functions in `builder.ts`, or update the README and drop the dead functions.
- **Several DB columns are declared, sometimes seeded, and never read anywhere in the app** —
  worth a cleanup pass rather than urgent: `readings.reading_length`, `app_settings.default_reading_length`,
  `app_settings.default_tone_preset_id`, and on `reading_templates`: `booking_cta`,
  `email_subject_template`, `whatsapp_opening_line` (the Templates page only edits `signoff_text`
  and `disclaimer_text`).
- **`content/guide.html`** is a large (2000-line), fully self-contained "Manifest Your Dream Life"
  lead-magnet ebook (print-CSS styled for PDF export, gold/navy design, unrelated visual system to
  the rest of the app) with no code in this repo referencing it. It isn't dead code exactly — it's
  just not part of Reader Console at all. Worth flagging: there is a separate Vercel project on
  this account (`manifestationguidev1`, `guide-sand-tau.vercel.app`) whose name strongly suggests
  it's this file's real home — **that connection is an inference from the project list, not
  confirmed** by anything in this repo, so verify before assuming it's safe to delete here.
- **No automated tests** (see above) — if reliability of the truncation/continuation pipeline
  matters going forward, that pipeline in particular has no regression safety net.

### Resolved since this audit

- **`/auth/set-password` 404 — fixed 2026-09-04 (`3477a4a`).** Added `app/auth/confirm/route.ts`
  (exchanges the email link's `token_hash` for a session via `supabase.auth.verifyOtp()`) and
  `app/auth/set-password/page.tsx` (the actual password form), and added `/auth/confirm` to
  `middleware.ts`'s public-route list. The Supabase dashboard's Invite and Reset Password email
  templates were also updated (by the project owner, outside this repo) to link to
  `/auth/confirm?token_hash={{ .TokenHash }}&type=...` instead of whatever they pointed at before —
  that half of the fix can't be verified from the code, so if invite/recovery emails ever stop
  working again, check the email templates in Authentication → Email Templates first.

---

## Key learnings & principles

Everything below is pointed at actual code — flagged inline if it's an inference rather than
something stated directly.

- **The future section has its own separate style rules** (`FUTURE_STYLE_RULES` in
  `lib/ai/prompts/future-section.ts`) instead of reusing `WRITING_STYLE_GUIDE` from `builder.ts`,
  because it has structurally different requirements the main body doesn't: no month-name headers,
  a "channelling in real time" tense rather than reflective-on-the-spread tense, a required number
  of tier-scaled "watch for this" moments each tied to a named card, and its own closing-line count
  by tier (`getTierConfig`). The main body's closing-line rules are about landing an emotional gut
  punch on cards already discussed; the future section's are about not turning into a fortune-teller
  calendar.
- **The card-list enforcement appears three times in `builder.ts`, in three different roles**, not
  as redundant copy-paste: once at the very top (section 0, before the style guide) as a hard
  anti-hallucination gate the model reads first; once in the middle (section 8, "Cards in this
  spread") as the actual working list with position labels, used for the narrative; and once near
  the end (section 13, "CRITICAL CARD LIST") as a final reinforcement placed right before the
  output-order instructions, explicitly there to stop hallucinated cards from creeping in during
  the long generation. `cardListText` itself is built once and reused in the first and third.
- **WhatsApp delivery must always be a manual tap, never an automatic send.** `handleWhatsApp` in
  `OutputPanel.tsx` opens `web.whatsapp.com/send` with the message pre-filled in the URL and lets
  WhatsApp's own UI require the final send tap — there is no server-side WhatsApp Business API
  call anywhere in the repo. This is a hard architectural constraint, not a missing feature: the
  reader always reviews and sends the final message herself.
- **Celtic Cross is written-only** — confirmed in two independent places (`READING_PRICES.celtic_cross`
  has `null` for voice_note/video in `lib/config/pricing.ts`, and `ReadingForm` force-switches and
  disables those formats whenever the tier is Celtic Cross), so this is a deliberate product
  decision baked into both pricing and the form, not an oversight in one place that the other
  forgot to enforce.

---

## Approach & patterns

House rules worth continuing to follow in this codebase:

- **Server-side safety nets regardless of model compliance.** Dash stripping
  (`.replace(/—/g, ', ').replace(/–/g, ', ')...`) runs on every generated reading and every daily
  message unconditionally, even though the prompt already has a "ZERO TOLERANCE DASH RULE" section.
  Never trust prompt instructions alone for something enforceable in code — the pattern here is
  "instruct the model, then verify/fix server-side anyway."
- **`[END OF READING]` as an explicit machine-readable terminator**, always the primary truncation
  anchor before any heuristic fallback. When adding new generated-content types, give them their
  own unambiguous end marker rather than relying on length or phrase-sniffing alone.
- **RLS is authenticated-only, all-or-nothing, single internal user in mind.** Every table has one
  `FOR ALL TO authenticated USING (true) WITH CHECK (true)` policy (`supabase/schema.sql`) — this
  is a private single-reader tool, not a multi-tenant app, and the RLS model reflects that
  deliberately rather than by accident. The one exception is `daily_messages`, which also has a
  narrow `anon` SELECT policy limited to `approved = true AND deleted_at IS NULL`, because the
  public fetch endpoint runs unauthenticated and gates itself with `DAILY_MESSAGE_FETCH_SECRET`
  instead of a Supabase session.
- **`is_test` + `deleted_at` as the two standing conventions for non-production and non-live data.**
  Test Mode (`TestModeContext`) stamps every record created while active with `is_test = true`,
  and Settings has a one-click "Clear all test data" that deletes by that flag. Soft-delete via
  `deleted_at` (never a hard delete from the UI) with a 30-day Trash/restore window is used
  identically across `clients`, `orders`, `readings`, and `daily_messages` — new deletable entities
  should follow the same column name and the same restore pattern rather than inventing a new one.
- **Re-check state immediately before a slow write, not just at the start of the request.** The
  daily-message generate/generate-batch routes re-query `deleted_at`/`skipped` right before the
  upsert that follows the OpenAI call, specifically to narrow (not fully eliminate — the code says
  so directly) the race window where a slow generation call overwrites a delete/skip that happened
  while it was in flight. Apply the same pattern anywhere else a slow external call precedes a
  write to a record a user might concurrently delete.
- **Explicit timezone pinning for "today," never implicit local time.** `todayDateString()` in
  `lib/daily-message/dates.ts` always resolves to Europe/London via `Intl.DateTimeFormat`, because
  the API runs on Vercel (UTC) while the admin's browser is in UK local time — relying on either
  side's own "local" would reproduce the mismatch. Everything in the daily-message feature is
  required to import this rather than deriving "today" independently.

---

## Tools & resources

- **Framework**: Next.js 14.2.5, App Router, TypeScript, React 18.
- **Styling**: Tailwind CSS 3 + `@tailwindcss/forms`, `clsx` + `tailwind-merge` (`cn()` helper),
  `lucide-react` icons. Design system documented in `STYLE.md` (see that file for the current,
  code-verified version).
- **Database/auth**: Supabase (Postgres + Auth), accessed via `@supabase/ssr` /
  `@supabase/supabase-js`. Project ref `hljetvmewhoqbqjlkpwt` per the task brief — **this could
  not be independently confirmed in this session**: the Supabase MCP connection available here is
  linked to a different project (tables `leads`/`discovery_runs`, which belong to the sibling
  `dbd-leadgen-dashboard` project, not this one), so the schema analysis above is based entirely on
  `supabase/schema.sql` and the three files in `supabase/migrations/` rather than a live schema
  read. Reconnect the MCP to the correct project before trusting any live-schema claims beyond what
  the SQL files show.
- **AI**: OpenAI GPT-4o via the `openai` npm SDK (`lib/ai/client.ts`), model overridable via
  `OPENAI_MODEL` env var. No other provider is actually wired despite the Groq-era naming leftovers
  noted above.
- **Email**: Gmail API via `googleapis`, OAuth2 (implemented, not currently invoked — see above).
- **Deployment**: Vercel. Confirmed directly via `vercel project ls` (not assumed): project name
  **`tarot-app`**, current production domain **`https://tarot-app-goldd.vercel.app`** (note: two
  d's, not `tarot-app-gold`). `vercel.ts` pins the deployment region to `fra1` (Frankfurt)
  specifically to sit close to the Supabase project's `eu-west-1` region — this was a deliberate
  fix for a prior cross-region auth timeout, documented inline in `lib/supabase/middleware.ts` and
  `vercel.ts`.
- **Source control**: GitHub, `abcx1233/TarotApp`, confirmed public (per task brief; `git remote -v`
  confirms the HTTPS URL but visibility itself isn't something `git remote` can confirm from inside
  the repo).
