# Reader Console — Feature Audit

Audited directly against the code at commit `cec3532` on 2026-09-16, by reading every file under
`app/`, `components/`, `lib/`, `contexts/`, `data/`, `types/`, `middleware.ts`, `scripts/` and
`supabase/`. This was a static read only: no code was run, and no connection was made to the live
Supabase project, Vercel, Stripe, Google or OpenAI. Anything that depends on live DB state, dashboard
configuration or model behaviour is marked as such rather than assumed.

Line numbers refer to `cec3532`. The companion documents are `PROJECT_STATUS.md` (state of the
project) and `STYLE.md` (design system). This file covers what each control actually does.

**Confidence labels used throughout**

- **Confirmed in code**: traced end-to-end through the source and SQL in this repo.
- **Inferred**: follows from the code, but the outcome depends on something outside the repo (live
  schema, a library's runtime behaviour, a browser, the model).
- **Could not confirm, needs a manual check**: static code alone can't settle it.

**Scope labels**: *per-reading*, *per-order*, *per-client*, *per-date* (daily messages),
*per-form* (browser state only, nothing persisted), *per-browser-session*, *global* (every
record / every user of the app), *env* (deployment environment variable).

---

## Contents

0. [Highest-impact findings](#0-highest-impact-findings)
1. [Deep dive: the "Returning client" toggle](#1-deep-dive-the-returning-client-toggle)
2. [AI generation option matrix](#2-ai-generation-option-matrix)
3. [Global shell: layout, sidebar, Test Mode banner](#3-global-shell-layout-sidebar-test-mode-banner)
4. [Auth](#4-auth)
5. [Dashboard](#5-dashboard)
6. [New Reading / Edit Reading](#6-new-reading--edit-reading)
7. [Orders](#7-orders)
8. [Clients](#8-clients)
9. [History](#9-history) (not in the requested list, but it's a real page with its own write paths)
10. [Templates](#10-templates)
11. [Settings](#11-settings)
12. [Daily Card Message](#12-daily-card-message)
13. [Trash](#13-trash)
14. [Webhooks & integrations](#14-webhooks--integrations)
15. [README.md cross-check](#15-readmemd-cross-check)
16. [STYLE.md cross-check](#16-stylemd-cross-check)
17. [Consolidated lists: dead, partial, broader-than-labelled, unclear DB scope](#17-consolidated-lists)
18. [Needs a manual check](#18-needs-a-manual-check)

---

## 0. Highest-impact findings

Ordered roughly by how likely each one is to cause real damage or a wrong belief about the app.

1. **"Returning client" pulls no client data at all.** It adds one sentence to the prompt, `This is a
   returning client.` (`lib/ai/prompts/builder.ts:312-314`). No previous readings, cards, notes or
   history are read or sent. [§1](#1-deep-dive-the-returning-client-toggle)
2. **Test Mode rewrites `is_test` on existing records, and "Clear all test data" hard-deletes by
   that flag.** With Test Mode on, Regenerate or Save Draft on a *real* order stamps that order
   and its reading `is_test = true` (`app/api/readings/generate/route.ts:443,512`,
   `app/api/readings/save-draft/route.ts:88,133`). A later "Clear all test data" then permanently
   deletes them (`app/dashboard/settings/page.tsx:85-87`), including anything sitting in Trash.
   Test Mode is also global. It's stored in the single `app_settings` row, not per browser.
   [§11](#11-settings)
3. **Opening an order whose reading was trashed reopens the trashed reading.** Regenerating it then
   writes to a row that stays soft-deleted, so it never shows up in History
   (`app/dashboard/readings/new/page.tsx:68-74` has no `deleted_at` filter). [§6.1](#61-page-load-and-restore)
4. **"Mark sent" on the Orders table doesn't set `sent_at`** (`app/dashboard/orders/page.tsx:62-69`).
   The Dashboard's "Sent today", "Revenue today" and "Revenue this week" filter on `sent_at`, so
   orders marked sent from that table never count towards revenue. [§7](#7-orders)
5. **A soft-deleted daily-message date can't be regenerated.** The race guard re-reads the row
   *without* a `deleted_at` filter, so any trashed row for that date blocks the write. The UI then
   shows "deleted or skipped elsewhere while generating", which is misleading
   (`lib/daily-message/generate-for-date.ts:98-113`). "Generate next 30 days" quietly counts those
   dates as skipped. And "Skip this day" on such a date **overwrites and destroys** the trashed
   message (`app/api/daily-message/skip/route.ts:34-68`). [§12](#12-daily-card-message)
6. **Private notes on the Clients page show stale or empty data.** `ClientProfile` copies its
   `notes` prop into `useState` once, and the Clients page never remounts it
   (`components/clients/ClientProfile.tsx:23`, `app/dashboard/clients/page.tsx:187`). Notes load
   after the profile mounts, so the list comes up empty, and when you switch clients the previous
   client's notes stay on screen. The trash-confirm box also carries over to the next client.
   [§8](#8-clients)
7. **Schema drift: `readings.future_timeframe` is written and read by the code but exists in
   neither `supabase/schema.sql` nor any migration.** On a DB built only from repo SQL, generation
   and Save Draft would fail to save the reading, and nothing checks the error. The live DB must
   have the column if production works. **Could not confirm.** [§6.6](#66-generation-pipeline-server)
8. **The Orders table's reading embed is probably an array, not an object.** `readings.order_id` has
   no UNIQUE constraint, so `reading:readings(...)` comes back as an array. That means the
   "Extend link" button and the link-expiry badge never render on Orders, and "Open" always takes
   the `orderId` fallback (`components/orders/OrdersTable.tsx:93,159,169`). **Inferred** from
   schema.sql plus PostgREST behaviour. [§7](#7-orders)
9. **Several deep links drop their parameters.** Clients → "New reading" sends
   `?clientId=&clientName=&email=`, which `/dashboard/readings/new` ignores, so you get a blank form
   (`components/clients/ClientProfile.tsx:79`). Clients → reading "View" sends
   `/dashboard/history?readingId=`, which History ignores (`ClientProfile.tsx:184`).
10. **Reopening a reading drops its Follow-up add-on (and sometimes Extra Question and future
    settings), and the next Regenerate deletes those `order_addons` rows.** The restore always sets
    `includeFollowUp: false` (`components/readings/ReadingForm.tsx:186`). `future_timeframe` isn't
    in the restore select. Generate deletes and re-inserts each add-on row by flag
    (`generate/route.ts:460-485`). [§6.1](#61-page-load-and-restore)
11. **The Settings page mostly saves values nothing reads.** Reader name, Sign-off name, Booking URL,
    Instagram, WhatsApp number, Default topic and Default delivery format are all saved to
    `app_settings` and read nowhere else. Only Business name and Test Mode have any effect.
    [§11](#11-settings)
12. **"Delete all pending" in the calendar also deletes *skipped-day markers*.** Skipped rows have
    `approved = false` (`app/api/daily-message/delete-batch/route.ts:35-37`). It's global from
    today onward, not limited to the month on screen.
13. **README step 3 ("run schema.sql") yields a DB that the generate route can't write to.** The
    audit columns only exist in a migration, and `future_timeframe` isn't anywhere. [§15](#15-readmemd-cross-check)
14. **Nothing ever purges Trash.** The Trash page says "Items are permanently deleted after 30 days".
    Items older than 30 days simply disappear from the Trash view and the sidebar count but stay
    in the DB forever (`app/dashboard/trash/page.tsx:110-136,187-189`). There's no purge job in
    the repo.
15. **Webhook orders never get a `due_at`**, even though the New Reading form says "Auto-filled when
    orders come in via Stripe" (`ReadingForm.tsx:864` vs `lib/webhooks/inbound-order.ts:67-82`).
    All webhook orders are stamped `source: 'stripe'`, including the generic and email-parser
    paths.

---

## 1. Deep dive: the "Returning client" toggle

### New Reading → Returning client (toggle)

- **What it looks like it does:** tells the AI this client has had readings before. The natural
  reading is that it pulls in their history (past readings, cards, notes) so the new reading can
  build on it.
- **What it actually does (confirmed in code):**
  - **UI:** `components/readings/ReadingForm.tsx:831` renders
    `<Toggle checked={state.isReturningClient} onChange={(v) => set('isReturningClient', v)} />`.
    It changes browser form state and nothing else. It doesn't affect price
    (`ReadingForm.tsx:302-321` has no reference to it).
  - **Initial value:**
    - On a fresh form it's always `false` (`ReadingForm.tsx:67`).
    - When the page is opened with `?readingId=` or `?orderId=`, it's pre-filled from
      `clients.is_returning` of the reading's or order's linked client (`app/dashboard/readings/new/page.tsx:55,86`
      → `ReadingForm.tsx:171`).
    - Picking an existing client from the name autocomplete does **not** update it
      (`ReadingForm.tsx:687-694` sets id, name, email and phone only). So a client whose DB flag
      is `true` still shows OFF unless you arrived via an order or reading link.
  - **Sent to the server:** the whole form state goes to `POST /api/readings/generate`
    (`ReadingForm.tsx:542-546`), which copies it to `promptInput.isReturningClient`
    (`app/api/readings/generate/route.ts:174`).
  - **Effect on the prompt:** exactly one hook, `lib/ai/prompts/builder.ts:311-314`:
    ```ts
    // 7. Returning client
    if (input.isReturningClient) {
      parts.push(`This is a returning client.`)
    }
    ```
    That sentence is the whole effect. No other part of `builder.ts` or `future-section.ts` reads
    the flag.
  - **Data it pulls:** **none.** The generate route runs no query for the client's previous
    readings, `reading_cards`, `client_notes`, `general_notes` or `total_spent`. The prompt doesn't
    even get the client's name: `PromptInput` (`builder.ts:10-28`) has no name field. The only
    client-derived values that reach the model are star sign, topic and questions, and those come
    from the form, not from the DB.
  - **DB writes:**
    - It writes `clients.is_returning` **only when the route inserts a brand-new client row**
      (`generate/route.ts:408,423`; same in `save-draft/route.ts:54,69`).
    - If the client already exists, the flag isn't written. That covers a client picked via
      autocomplete (`clientId` set, `route.ts:383-386`) and a client matched by email
      (`route.ts:388-399`).
    - Readings don't store it in a dedicated column. The sentence only survives as part of
      `readings.generated_prompt`.
  - **Audit:** not checked by any audit rule (`lib/ai/audit/*`).
- **Other code that sets or reads `clients.is_returning`:**
  - **Webhooks set it `true`** when an inbound order's email matches *any* existing `clients` row
    (`lib/webhooks/inbound-order.ts:31-46`). The lookup is a plain email match across the whole
    table, with no `deleted_at` or `is_test` filter, so a trashed or test client with the same
    email counts.
  - **Clients → New** always inserts `is_returning: false` (`app/dashboard/clients/page.tsx:137`).
  - **Display only:** amber star in the client list (`components/clients/ClientList.tsx:60-62`),
    star plus "Returning"/"New" stat in the profile (`components/clients/ClientProfile.tsx:68-70,131-132`).
  - **No UI anywhere edits `is_returning` on an existing client.**
- **Scope:**
  - The label reads as per-reading.
  - The value it pre-fills from is **per-client** (`clients.is_returning` via the reading's or
    order's `client_id`).
  - The only thing it persists is a **per-client** flag, and only on first creation of that client.
  - The data it pulls into the AI is **nothing**, neither for that client nor for any other client.
  - The webhook that sets the flag decides it with a **global** email match.
- **Confidence:** confirmed in code. **Inferred:** what GPT-4o does with a bare "This is a
  returning client." is up to the model. With no history supplied, any reference to "last time"
  or earlier readings would be invented. That can't be checked statically; review a few generated
  readings with the toggle on.

---

## 2. AI generation option matrix

Every control that could plausibly affect the OpenAI call, with where it hooks in.

- **"Prompt?"** means it changes the text sent by `generateFullReading`
  (`lib/ai/generate.ts:18-47`, system prompt `generate.ts:32`).
- **"Pricing/logistics?"** means price, `order_addons`, order fields or UI only.
- `builder.ts` means `lib/ai/prompts/builder.ts`, and the route is
  `app/api/readings/generate/route.ts`.

| Option | Prompt? | Hook in builder.ts / future-section.ts | Pricing / logistics? | Also affects |
|---|---|---|---|---|
| Client name / email / phone | **No** | none (not in `PromptInput`) | client upsert; WhatsApp/Email target | `clients` row |
| Reading tier | **Yes** | default `characterTarget` (route `:165-166`); future-section tier sizing `getTierConfig` (`future-section.ts:64-103`); mini-only future gate (`builder.ts:377`) | base price (`lib/config/pricing.ts:11-16`); default card count; tone suggestion | `orders.reading_tier` |
| Topic | **Yes** | §4 `builder.ts:256-260`; Love-specific block §4a `:263-269` | email subject line | audit relevance check (`lib/ai/audit/model.ts:103`) |
| Star sign | **Yes** | §6 `builder.ts:286-309` | none | `clients.star_sign` on *new* client only |
| Questions or Areas of Focus | **Yes** | §4 fallback `:258-259`; §5 `:272-276` | none | `readings.question_or_focus`; audit |
| Include future energy + timeframe | **Yes** | §12 `builder.ts:377-387` → `buildFutureSectionInstruction` (`future-section.ts:117-170`) | **not priced**, no add-on row | `readings.future_timeframe` (see [§6.6](#66-generation-pipeline-server)) |
| Delivery format | **No** | none | base price; OutputPanel voice/video UI | `orders.delivery_format` |
| Returning client | **Yes, one sentence** | §7 `builder.ts:311-314` | none | `clients.is_returning` on new client only |
| Price (manual) | No | none | `orders.price_total` | Dashboard revenue |
| Due date & time | No | none | `orders.due_at` | Dashboard "Due today" |
| Extra Question add-on | **Yes, only if text entered** | §5a `builder.ts:279-283` | +£6, `order_addons` row | audit relevance (`model.ts:105-107`) |
| 24-Hour Delivery (rush) | No | none | +£10, `orders.is_rush`, `order_addons` | rush banner and sorting |
| Follow-Up Within 48 Hours | No | none | +£5, `order_addons` | Follow-up badge on Orders |
| Tone preset | **Yes** | §2 `builder.ts:222` (the preset's `prompt_text` from DB, verbatim) | none | `readings.tone_preset_id` |
| Reading length (characters) | **Yes** | §3 `builder.ts:225-237` (±10%) | none | `max_tokens = target/3 + 500` (route `:189`); continuation loop (`:222-265`); trim (`:306-308`); audit length check |
| Cards + orientation (+ Celtic Cross position labels) | **Yes** | §0 `:204-216`, §8 `:317-327`, §13 `:390-407` | card count validation | `reading_cards`; continuation card list (route `:226-229`); audit fidelity |
| Suit filter | No | none | UI filtering only | nothing persisted |
| Bottom of Deck card | **Yes** | §0 `:199-201`, §9 `:330-336`, §13 `:394` | none | `reading_cards` row `sort_order 999`; audit allow-list |
| Oracle Card toggle + name | **Yes, only if a name is entered** | §3a `:240-253`, §10 `:339-343`, output order `:412` | +£10 and `order_addons` **even with a blank name** | heading repair (route `:213`); audit `addon_oracle` |
| Energy Cleansing Ritual | **Yes** | §3a `:249-251`, §11 `:346-374`, §13 `:404-406`, §14 `:415-424` | +£8, `order_addons` | ritual hard-cut (route `:272-296`); audit |
| Test Mode | **No** | none | none (tokens are still spent) | `is_test` on client/order/reading |
| Templates: sign-off / disclaimer | **No** (the model is told not to sign off, `builder.ts:230,457,544`) | none | none | appended after generation (route `:324-340`); truncation anchor (`:304,315`); audit |
| `OPENAI_MODEL` env | model choice | `lib/ai/config.ts:2` | none | `readings.groq_model` |

Two options change the prompt only partially:

- **Include future energy on Mini** with no timeframe selected is silently ignored
  (`builder.ts:377`: `includeFuture && (tier !== 'mini' || !!futureTimeframe)`). The "no future
  section" instruction is sent instead (`:384-386`).
- **Oracle Card** with the toggle on but a blank name charges £10, writes an `oracle_card`
  add-on row and `include_oracle_card = true`, but sends **no** oracle instruction. The route only
  sets `oracleCardName` when both are present (`route.ts:180`), and `builder.ts:240` keys off the
  name. The audit then fails `addon_oracle` with a 40-point penalty (`lib/ai/audit/deterministic.ts:112-118`).

Model calls per "Generate Reading" click:

- 1 main call.
- 0 to 2 continuation calls (0 to 4 when target ≥ 10,000). Each uses `max_tokens 4096`
  (`route.ts:245-265`).
- 1 audit call (`max_tokens 400`, `lib/ai/audit/model.ts:119`).

All calls use the same `AI_CONFIG.model` and `temperature 0.85` (`lib/ai/client.ts:30-38`).

---

## 3. Global shell: layout, sidebar, Test Mode banner

### Shell → Auth gate on /dashboard/*
- **What it looks like it does:** keeps logged-out users out of the dashboard.
- **What it actually does (confirmed in code):**
  - `app/dashboard/layout.tsx:11-20` redirects to `/login` if `getSession()` returns nothing. It
    deliberately uses the cookie-only check; the comment explains that this avoids a redirect loop.
  - The cryptographic check happens earlier in middleware (`lib/supabase/middleware.ts:37-45`,
    `getUser()`).
  - It then reads `app_settings.test_mode_enabled` (`layout.tsx:22-28`) to seed the Test Mode
    context.
- **Scope:** global (any authenticated Supabase user gets full access; see [§4](#4-auth)).
- **Confidence:** confirmed in code.

### Shell → Test Mode banner ("Test Mode active — data will be marked as test")
- **What it looks like it does:** warns that anything you create now is test data.
- **What it actually does (confirmed in code):**
  - Renders when the context `isTestMode` is true (`components/layout/DashboardLayout.tsx:44`,
    `components/ui/TestModeBanner.tsx`). It's display only.
  - What actually gets marked is covered under [Settings → Test Mode](#settings--test-mode-toggle).
  - Its claim is only partly true: webhook orders, Clients → New, Orders duplicate (dead) and daily
    messages ignore Test Mode.
- **Scope:** global (DB-backed flag). Another browser that's already open won't see a change until
  it reloads.
- **Confidence:** confirmed in code.

### Shell → Hamburger menu (mobile, "Open menu")
- **What it looks like it does:** opens the nav drawer on small screens.
- **What it actually does (confirmed in code):** `components/layout/TopBar.tsx:13-19` calls
  `setSidebarOpen(true)` (`DashboardLayout.tsx:45`). Clicking the scrim (`DashboardLayout.tsx:24-30`)
  or any nav link (`Sidebar.tsx:140,146,155` → `onClose`) closes it. State only.
- **Scope:** per-browser-session UI.
- **Confidence:** confirmed in code.

### Shell → TopBar title
- **What it looks like it does:** shows a page title.
- **What it actually does (confirmed in code):** `DashboardLayout` accepts a `title` prop and passes
  it on (`DashboardLayout.tsx:12,45`), but `app/dashboard/layout.tsx:30` never supplies one. The
  TopBar is always empty apart from the hamburger. **Dead prop.**
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Sidebar → Nav links (Dashboard, New Reading, Daily Card Message, Orders, Clients, History, Templates, Settings)
- **What it looks like it does:** navigation.
- **What it actually does (confirmed in code):** plain `next/link`s (`components/layout/Sidebar.tsx:23-35`).
  Active state is exact-match for Dashboard and prefix-match for everything else (`:48`), so the
  calendar highlights "Daily Card Message". No data access.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Sidebar → Trash link + count badge
- **What it looks like it does:** shows how many items are in Trash.
- **What it actually does (confirmed in code):**
  - On mount, it counts `clients`, `orders` and `readings` with `deleted_at` inside the last 30 days
    (`Sidebar.tsx:80-104`). **It doesn't count `daily_messages`**, even though the Trash page has a
    Daily Messages tab.
  - It refreshes only on the `trash-count-changed` window event (`:112-114`). That event is
    dispatched only by History's trash and undo (`app/dashboard/history/page.tsx:135,172`).
  - Trashing from Orders or Clients, restoring or deleting in Trash, and Clear test data all leave
    the badge stale until the page reloads.
  - The badge is hidden below the `lg` breakpoint (`:64`).
- **Scope:** global counts (every soft-deleted client, order and reading from the last 30 days,
  test data included).
- **Confidence:** confirmed in code.

### Sidebar → Sign out
- **What it looks like it does:** logs out.
- **What it actually does (confirmed in code):** `supabase.auth.signOut()`, then `router.push('/login')`
  (`Sidebar.tsx:117-122,157-163`).
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code.

---

## 4. Auth

### Auth → Middleware route protection
- **What it looks like it does:** requires login everywhere except public routes.
- **What it actually does (confirmed in code):**
  - `lib/supabase/middleware.ts:37-45` calls `supabase.auth.getUser()` on every matched request.
  - Public prefixes (`:52-64`): `/login`, `/auth/confirm`, `/auth/set-password`, `/api/webhooks`,
    `/api/daily-message/fetch`, `/api/daily-message/cron-generate`, `/_next`, `/favicon`.
  - Everything else without a user gets redirected to `/login` (`:70-74`). That includes
    authenticated API routes, which therefore return a 307 rather than a 401.
  - A logged-in user on any URL with `?type=invite|recovery` gets sent to `/auth/set-password`
    (`:79-85`).
  - A logged-in user on `/login` gets sent to `/dashboard` (`:90-94`).
- **Scope:** global.
  - Supabase RLS is `FOR ALL TO authenticated USING (true)` on every table
    (`supabase/schema.sql:297-316`), so **any** user in the Supabase project's Auth has full
    read/write access to all data.
  - README calls this "the only login that will work", which only holds while exactly one Auth
    user exists.
- **Confidence:** confirmed in code. Which users exist in Supabase Auth could not be confirmed.

### Auth → Root URL `/`
- **What it looks like it does:** entry point.
- **What it actually does (confirmed in code):** `app/page.tsx:4-13` redirects to `/dashboard` if
  `getUser()` returns a user, otherwise to `/login`.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Login → Email / Password fields + "Sign in"
- **What it looks like it does:** password login.
- **What it actually does (confirmed in code):**
  - `supabase.auth.signInWithPassword` from the browser (`app/login/page.tsx:31-50`).
  - Errors are shown inline.
  - The `?error=` query param from `/auth/confirm` pre-fills the error box (`:29`).
  - The form has `noValidate`, so the browser's own required and email checks are off. Supabase
    returns the error instead.
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code.

### Login → Show/Hide password (eye icon)
- **What it looks like it does:** reveals the password.
- **What it actually does (confirmed in code):** toggles the input type (`login/page.tsx:97-104`).
  State only.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Login → "Forgot your password? Contact your administrator."
- **What it looks like it does:** static help text.
- **What it actually does (confirmed in code):** plain text (`:120-122`). There's no self-service
  reset flow in the app. Recovery emails can only be triggered from the Supabase dashboard.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Auth → `/auth/confirm` (email link landing)
- **What it looks like it does:** validates an invite or recovery link.
- **What it actually does (confirmed in code):** `verifyOtp({ type, token_hash })`. On success it
  redirects to `/auth/set-password?type=…`. Otherwise it redirects to `/login?error=That link is invalid…`
  (`app/auth/confirm/route.ts:13-29`).
- **Scope:** per-user.
- **Confidence:** confirmed in code. That the Supabase email templates point here (per
  PROJECT_STATUS) **could not be confirmed**; it's dashboard config.

### Set password → New password / Confirm / Show toggle / "Set password"
- **What it looks like it does:** sets the password after an invite or reset.
- **What it actually does (confirmed in code):**
  - Checks for a session first (`app/auth/set-password/page.tsx:49-62`).
  - Validates: at least 8 characters, and both fields match (`:68-75`).
  - Calls `supabase.auth.updateUser({ password })`, then goes to `/dashboard` (`:77-88`).
  - The show toggle affects both fields (`:125,152`).
- **Scope:** the current Auth user.
- **Confidence:** confirmed in code.

### Set password → "Back to sign in" (expired link state)
- **What it looks like it does:** returns to login.
- **What it actually does (confirmed in code):** `router.push('/login')` (`:112`).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

---

## 5. Dashboard

`app/dashboard/page.tsx` is a server component. None of its queries filter `is_test`, so **test
data counts towards every KPI, including revenue.** "Today" and "this week" come from `date-fns`
`startOfDay` / `startOfWeek` on the **server clock** (`:22-24`), which is UTC on Vercel.

### Dashboard → "New Reading" button
- **What it looks like it does:** starts a reading.
- **What it actually does (confirmed in code):** links to `/dashboard/readings/new` (`:136-141`).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Dashboard → "Add Manual Order" button
- **What it looks like it does:** opens some kind of order-entry form.
- **What it actually does (confirmed in code):** links to the **same** `/dashboard/readings/new`
  URL as "New Reading" (`:142-147`). There's no separate order form, and no way to create an
  order without either generating a reading or saving a draft *after* generating one (see
  [Save Draft](#output-panel--save-draft)).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Dashboard → KPI cards (Pending, In Progress, Due Today, Sent today, Revenue today, Revenue this week)
- **What it looks like it does:** business metrics.
- **What it actually does (confirmed in code):**
  - **Pending / In Progress:** head counts on `orders` by status, `deleted_at IS NULL` (`:36-37`).
    The "oldest from N days ago" sub-label comes from the oldest pending `created_at` (`:58-64,90-93`).
  - **Due Today:** status is `pending` or `in_progress` and `due_at` falls within the server's today
    (`:51-57`).
  - **Sent today / Revenue today:** status `sent` and `sent_at` within today, summing
    `price_total` (`:38-44,82-85`).
  - **Revenue this week:** status `sent` and `sent_at` on or after Monday (`:45-50`).
  - Because Orders → "Mark sent" never sets `sent_at` ([§7](#orders--mark-sent-row-action)), those
    orders are excluded from Sent/Revenue.
  - Revenue is `orders.price_total` as entered. Stripe add-on prices are stored as £0, though
    `price_total` comes from `amount_total`.
  - The cards aren't clickable.
- **Scope:** global (all orders, test included).
- **Confidence:**
  - Queries: confirmed in code.
  - UTC vs UK day boundary: **inferred**. It depends on the Vercel runtime timezone, which should
    be UTC.

### Dashboard → "Today's queue" table + "View all"
- **What it looks like it does:** today's workload.
- **What it actually does (confirmed in code):**
  - Shows up to 10 orders with status `pending` or `in_progress`, **not** filtered to today
    (`:65-73`).
  - Sorted rush first, then `due_at`, then newest.
  - Badges: RUSH, DUE TODAY, TEST.
  - "View all" links to `/dashboard/orders` (`:190`).
- **Scope:** global.
- **Confidence:** confirmed in code.

### Dashboard → Queue row "Open"
- **What it looks like it does:** opens the order.
- **What it actually does (confirmed in code):** links to `/dashboard/readings/new?orderId=<id>`
  (`:263-265`). For what that load does, and the trashed-reading issue, see [§6.1](#61-page-load-and-restore).
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### Dashboard → "You're all caught up" → New Reading
- **What it looks like it does / what it actually does (confirmed in code):** same link as the
  header button (`:201-206`).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Dashboard → "Recent readings" cards + "View all"
- **What it looks like it does:** latest readings.
- **What it actually does (confirmed in code):**
  - Shows the 8 most recent non-deleted `readings` with client and order joins (`:74-79`).
  - The cards are **not clickable** (`:294-310`).
  - The status badge falls back to `pending` when there's no order (`:308`).
  - "View all" links to `/dashboard/history` (`:279`).
- **Scope:** global.
- **Confidence:** confirmed in code.

---

## 6. New Reading / Edit Reading

The page is `app/dashboard/readings/new/page.tsx`, a server component that loads data, and it
renders `components/readings/ReadingForm.tsx`, which holds all form state in a `useReducer`.
Nothing is persisted until **Generate Reading** runs, or **Save Draft**, which only appears after
generating.

### 6.1 Page load and restore

### New Reading → Load with no params
- **What it actually does (confirmed in code):**
  - Loads every `tone_presets` row (`page.tsx:10-31`). If that query errors or returns nothing, it
    falls back to the hardcoded `lib/ai/prompts/tone-presets.ts` with ids `fallback-0/1` (`:18-27`).
    Those aren't UUIDs, so writing them to `readings.tone_preset_id` would fail. **Inferred.**
  - Blank form: tier `mini`, 3 card rows (`ReadingForm.tsx:54-90`).
  - Business name comes from `app_settings.business_name` (`:365-374`). A second, identical effect
    (`:377-386`) covers the restore path, so the two effects are redundant but harmless.

### New Reading → Load with `?readingId=`
- **What it looks like it does:** reopens a saved reading for editing.
- **What it actually does (confirmed in code):**
  - `fetchReadingById` (`page.tsx:33-62`) selects the reading, its order, its client and its cards.
    **It has no `deleted_at` filter**, so trashed readings open fine.
  - It **doesn't select** `future_timeframe`, `media_*`, `reader_notes` usage, or any order add-ons.
  - The `RESTORE` reducer then (`ReadingForm.tsx:160-197`):
    - sets `includeFollowUp: false` **always** (`:186`);
    - sets `includeFuture` / `futureTimeframe` from `data.future_timeframe`, which was never
      selected, so it's **always off** (`:187-188`);
    - sets `includeExtraQuestion` only when `specific_question` has text, so an extra-question
      add-on without text (webhook orders) comes back **off** (`:184`);
    - sets `isReturningClient` from `clients.is_returning` (`:171`);
    - sets `status` to `awaiting_review` whenever a reading id exists, even for a webhook-created
      reading that has never been generated (`:193`).
  - `isPriceAutoSet` is set to `false` (`:336`), so the stored price is kept.
  - The header says "Edit Reading" and an amber banner appears (`:609,630-650`).
  - OutputPanel's media state starts empty, so a voice-note reading must be **re-uploaded** before
    WhatsApp or Email unlock ([§6.5](#65-output-panel)).
  - **Knock-on (confirmed in code):**
    - A Regenerate or Save Draft after reopening deletes the order's `follow_up` add-on row
      (`generate/route.ts:461`, `save-draft/route.ts:106`).
    - Generate also deletes `extra_question` (`generate/route.ts:476`) when the text was empty.
    - Generate writes `future_timeframe: null`, so the future section disappears from the new
      prompt unless you re-enable it.
- **Scope:** per-reading. The DB side effects happen only on the next Generate or Save.
- **Confidence:** confirmed in code.

### New Reading → Load with `?orderId=`
- **What it looks like it does:** opens an order to work on it.
- **What it actually does (confirmed in code):**
  - `fetchReadingByOrderId` (`page.tsx:64-125`) takes the **newest `readings` row for that
    `order_id` regardless of `deleted_at`** (`:68-74`).
  - If it finds one, it behaves exactly like `?readingId=`. Otherwise it pre-fills from the order
    and client only.
  - **Consequence:** History → trash a reading (which resets the order to `pending`) → Orders or
    Dashboard → Open → the *trashed* reading is loaded. Generate then updates that row, whose
    `deleted_at` stays set, so the new reading stays invisible in History and Dashboard.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### New Reading → Load with `?clientId=&clientName=&email=` (from Clients → "New reading")
- **What it looks like it does:** pre-fills the chosen client.
- **What it actually does (confirmed in code):** the page only reads `readingId` and `orderId`
  (`page.tsx:130-133`). These params are **ignored** and the form is blank.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### 6.2 Header controls

### New Reading → "Back"
- **What it looks like it does:** returns to the previous page.
- **What it actually does (confirmed in code):** asks for confirmation if the form is dirty, then
  always goes to `/dashboard`, not the previous page (`ReadingForm.tsx:410-413,604-607`).
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### New Reading → "Clear form"
- **What it looks like it does:** resets to a blank form.
- **What it actually does (confirmed in code):**
  - After a confirm, it dispatches `RESET`, clears reopen mode, and does `router.replace('/dashboard/readings/new')`
    (`:415-423`).
  - It also sets `isPriceAutoSet(false)` (`:421`). The price then stays blank and the auto-price
    hint disappears until you touch tier, format or an add-on.
  - Nothing in the DB is deleted.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### New Reading → "Start fresh instead" (reopen banner)
- **What it actually does (confirmed in code):** same as Clear form minus the confirm dialog,
  including the price auto-set left off (`:635-648`). Nothing is deleted.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### New Reading → Rush banner
- **What it looks like it does:** flags the order as a rush.
- **What it actually does (confirmed in code):** display only. It expands when `state.isRush` is
  true (`:617-627`).
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### 6.3 Order Info section

### New Reading → Client name (with autocomplete)
- **What it looks like it does:** search existing clients or type a new one.
- **What it actually does (confirmed in code):**
  - Every keystroke of 2+ characters runs `clients.select(id, full_name, email, phone).ilike('full_name', %q%).limit(6)`
    (`:403-408`).
    - There's **no `deleted_at` filter and no `is_test` filter**, so trashed and test clients are
      suggested, and you can attach new orders to a trashed client.
    - Queries aren't debounced and results can arrive out of order.
  - Selecting a suggestion sets `clientId`, name, email and phone (`:687-694`). It does **not**
    set star sign or returning status.
  - Editing the name afterwards leaves `clientId` pointing at the old client, and the server
    never updates the client's name ([§6.6](#66-generation-pipeline-server)).
  - Required-field check happens only on Generate (`:474-476`). The name never reaches the AI.
- **Scope:** reads are global across all clients. The selection is per-form.
- **Confidence:** confirmed in code.

### New Reading → Email
- **What it actually does (confirmed in code):**
  - Required, with a regex check on Generate (`:478-483`).
  - It's used server-side to **match an existing client by exact email** when no `clientId` is set
    (`generate/route.ts:388-399`). That lookup has no `deleted_at` or `is_test` filter.
  - It's the `mailto:` target (`OutputPanel.tsx:266`).
  - Changing the email of an already-linked client is **not** saved to that client.
  - Not sent to the AI.
- **Scope:** per-form; the lookup is global.
- **Confidence:** confirmed in code.

### New Reading → Phone
- **What it actually does (confirmed in code):**
  - Optional.
  - When a client is linked or matched, the server **overwrites `clients.phone`** with this value
    if it's non-empty (`generate/route.ts:384-386,397-399`; `save-draft/route.ts:30-32,43-45`).
  - It enables WhatsApp and builds the `wa` link (`OutputPanel.tsx:253-259`).
  - Not sent to the AI.
- **Scope:** per-client write.
- **Confidence:** confirmed in code.

### New Reading → Reading tier (Mini / Core / Premium / Celtic Cross)
- **What it looks like it does:** chooses the product.
- **What it actually does (confirmed in code):** `handleTierChange` (`:426-469`) does the following:
  - Forces the format to `written` for Celtic Cross.
  - Adjusts card rows to the tier default (3/6/10/10). If named cards exist, it asks via
    `window.confirm` whether to keep them. Celtic Cross fixes 10 labelled positions.
  - Resets the character target to `READING_CHARACTER_TARGETS` (3000/6000/12000/6000,
    `lib/ai/config.ts:7-12`) unless the length is overridden.
  - Re-enables price auto-set.
  - Marks the tier as user-chosen, which triggers the tone-preset suggestion
    ([§6.4](#new-reading--tone-preset-cards)).
  - The prompt and pricing effects are in [§2](#2-ai-generation-option-matrix).
- **Scope:** per-form; `orders.reading_tier` on save.
- **Confidence:** confirmed in code. The Celtic Cross written price is **£10, the same as Mini**
  (`lib/config/pricing.ts:15`). Whether that's intended **could not be confirmed.**

### New Reading → Topic (select)
- **What it actually does (confirmed in code):**
  - Options: Love & Relationships, Career & Work, Finance & Abundance, Spiritual Guidance, General
    Guidance, or blank (`:748-757`).
  - Effects: prompt §4 and §4a, the email subject, the audit, and `orders.topic`.
  - Blank is saved as `'General'` (`generate/route.ts:436`, `save-draft/route.ts:82`). That isn't
    one of the options, so on reopen the select shows blank while the state holds `'General'`.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### New Reading → Star sign (select)
- **What it actually does (confirmed in code):**
  - Prompt §6 (`builder.ts:286-309`).
  - Stored on `clients.star_sign` **only when a new client is inserted**. An existing client's star
    sign is never updated.
- **Scope:** per-form; per-client on creation only.
- **Confidence:** confirmed in code.

### New Reading → Questions or Areas of Focus (textarea)
- **What it actually does (confirmed in code):** prompt §4 fallback and §5, `readings.question_or_focus`,
  and the audit relevance check (`generate/route.ts:369`).
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### New Reading → "Include future energy" toggle + "Future timeframe" select
- **What it looks like it does:** adds a forward-looking section.
- **What it actually does (confirmed in code):**
  - Toggling off clears the timeframe (`:783-790`).
  - Timeframes: Next 3 months, Next 6 months, Rest of the year, Full 12 months, 24 months, or
    blank (`:799-804`). Each maps to a title and coverage guide in `future-section.ts:124-169`.
    Blank means "What I'm Sensing Ahead" through year end.
  - The section's size scales with tier (`future-section.ts:64-103`).
  - It's gated at `builder.ts:377`, so on **Mini without a timeframe the toggle does nothing.**
  - Not priced and no add-on row.
  - Saved to `readings.future_timeframe` (only the timeframe; the toggle itself isn't stored).
  - Never restored on reopen ([§6.1](#61-page-load-and-restore)).
  - `buildFutureSectionInstruction` takes a `_now` date it never uses (`future-section.ts:118`), so
    "rest of the year" relies on the model knowing the current date.
- **Scope:** per-reading.
- **Confidence:** confirmed in code. The `future_timeframe` column's existence **could not be
  confirmed** ([§6.6](#66-generation-pipeline-server)).

### New Reading → Delivery format pills (Written / Voice Note / Video)
- **What it actually does (confirmed in code):**
  - Sets `deliveryFormat` and re-enables auto-price (`:813-824`). Voice and Video are disabled for
    Celtic Cross.
  - Affects price, `orders.delivery_format`, and OutputPanel (the voice-note upload box and the
    "Video coming soon" notice).
  - **Not sent to the AI.**
  - `orders.delivery_channel` is always written as `'email'` regardless (`generate/route.ts:438`).
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### New Reading → Returning client
See [§1](#1-deep-dive-the-returning-client-toggle).

### New Reading → Price (£) + "edit to override"
- **What it looks like it does:** order price, auto-calculated.
- **What it actually does (confirmed in code):**
  - With auto-set on, the effect sets `priceTotal` to base price plus add-ons (`:302-321`), and the
    breakdown hint shows (`:850-859`).
  - Typing in the field or clicking "edit to override" turns auto-set off (`:845,855`).
  - Changing tier, format or any priced add-on turns auto-set **back on** and overwrites a manual
    price without warning (`:468,822,876,878,879,940,942`).
  - Saved as `orders.price_total` (`parseFloat || 0`).
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### New Reading → Due date & time
- **What it looks like it does:** the order's due date. The hint says "Auto-filled when orders come
  in via Stripe — override if needed".
- **What it actually does (confirmed in code):**
  - A `datetime-local` string without a timezone is sent as `orders.due_at`
    (`generate/route.ts:442`).
  - On reopen the stored value is `.slice(0, 16)`'d (`ReadingForm.tsx:177`).
  - **The hint is false:** no webhook sets `due_at` (`lib/webhooks/inbound-order.ts:67-82`).
- **Scope:** per-order.
- **Confidence:** confirmed in code. **Inferred:** the timezone round-trip (UK local wall time
  stored as UTC, shown back as a UTC wall time) probably shifts by an hour during BST. **Needs a
  manual check.**

### New Reading → Order Add-Ons: Extra Question (+£6) toggle + "What is the extra question?"
- **What it actually does (confirmed in code):**
  - Adds £6 (`OrderAddOnsSection.tsx:66-83`; the price label is a hardcoded string that currently
    matches `ADDON_PRICES`).
  - On Generate: prompt §5a only if the text is non-empty (`generate/route.ts:182`), plus an
    `order_addons` row of type `extra_question` (`:476-479`), plus `readings.specific_question`,
    plus the audit.
  - **Save Draft doesn't write this add-on row** (`save-draft/route.ts:104-115` handles `follow_up` only).
- **Scope:** per-order / per-reading.
- **Confidence:** confirmed in code.

### New Reading → Order Add-Ons: 24-Hour Delivery (+£10)
- **What it looks like it does:** marks a rush order.
- **What it actually does (confirmed in code):** `isRush` feeds the price, `orders.is_rush`, an
  `order_addons` `rush_24h` row (Generate only, `generate/route.ts:481-484`), the rush banner, and
  the rush sort and badges. **Not sent to the AI.** Nothing schedules or enforces 24h; it only
  prioritises the sort order.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### New Reading → Order Add-Ons: Follow-Up Within 48 Hours (+£5)
- **What it actually does (confirmed in code):**
  - Affects the price and writes an `order_addons` `follow_up` row. Both Generate and Save Draft
    write it (`generate/route.ts:461-464`, `save-draft/route.ts:105-115`).
  - Shows a "Follow-up" badge on Orders (`OrdersTable.tsx:94,147`).
  - No reminder or follow-up workflow exists. Not sent to the AI. Lost on reopen ([§6.1](#61-page-load-and-restore)).
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### 6.4 Reading Setup, Card Entry, Spirit Led Add-Ons

### New Reading → Tone preset cards
- **What it looks like it does:** chooses the writing voice.
- **What it actually does (confirmed in code):**
  - Clicking a card sets `tonePresetId` (`components/readings/TonePresetSelect.tsx:18-35`).
  - On Generate, that preset's `prompt_text`, as loaded at page load, is sent as
    `tonePresetText` (`ReadingForm.tsx:528,545`) and inserted verbatim as prompt §2
    (`builder.ts:222`).
  - Default is the `is_default` preset, or the first one (`ReadingForm.tsx:389-394`).
  - **Changing the tier silently replaces any manually chosen preset** with the one whose
    `default_for_tier` contains the new tier (`:396-401`).
  - There's no UI to edit presets. The DB seed texts (`supabase/schema.sql:356-393`) differ from the
    fallback texts in `lib/ai/prompts/tone-presets.ts`.
- **Scope:** preset contents are global (DB); the selection is per-reading (`readings.tone_preset_id`).
- **Confidence:** confirmed in code. Which preset text is live **could not be confirmed** (DB state).

### New Reading → Reading length: "Override" / "Reset to default" / number input
- **What it actually does (confirmed in code):**
  - "Override" makes the input editable (`:890-894`). Min, max and step are HTML attributes only
    (500–20000, step 500).
  - `parseInt` of an emptied field gives `NaN`. The server falls back via `f.readingLength || …`
    (`generate/route.ts:165-166`).
  - "Reset to default" re-applies the tier target (`:895-897`).
  - Effects: prompt §3 (±10%), `max_tokens`, the continuation threshold (0.85×), trimming (1.15×),
    audit length, the OutputPanel counter, and `readings.character_target`.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Card Entry → Tier guidance text
- **What it actually does (confirmed in code):** static text per tier (`CardEntry.tsx:132-137,179-181`).
  It says Premium is "10–12+" while validation requires ≥10.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Card Entry → "Filter by suit" pills (All Cards / Major Arcana / Cups / Pentacles / Wands / Swords)
- **What it actually does (confirmed in code):** sets `suitFilter`, which narrows the autocomplete
  lists for **all** rows and the bottom card (`SuitFilter.tsx`, `CardAutocomplete.tsx:31-33`). Not
  persisted and not sent to the AI (the whole formState is posted, but the server ignores it).
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Card Entry → Card name autocomplete (per row)
- **What it actually does (confirmed in code):**
  - Substring search over the 78-card catalogue (`data/tarot-cards.ts:100-105`).
  - The list opens on focus (`CardAutocomplete.tsx:104`), and an empty query returns the whole
    (suit-filtered) deck (`:31-33`). Enter selects the highlighted result, so **pressing Enter in a
    freshly focused empty field fills in the first card (The Fool under "All Cards")** rather than
    adding a row. Enter only adds a new row (non-Celtic) when the list is closed (after Escape or a
    selection) or nothing matches (`:56-58,68-74`).
  - **Free text is accepted:** typing sets the name even if it isn't a real card (`:80-86`). It's
    saved with `suit: 'Unknown'` (`generate/route.ts:556`) and sent to the AI as a card.
  - "Two of Cups" doesn't match the catalogue's "2 of Cups" in search.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Card Entry → Orientation "↑ Up" / "↓ Rev"
- **What it actually does (confirmed in code):** sets `orientation` (`CardEntry.tsx:47-82,113-116`).
  It goes to prompt §8 as "(Upright)" or "(Reversed)" and to `reading_cards.orientation`.
  Section 0 and §13 of the prompt list names only.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Card Entry → Remove card (×, hover)
- **What it actually does (confirmed in code):** removes the row unless it's the last one
  (`CardEntry.tsx:166-172,118-127`). Hidden for Celtic Cross.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Card Entry → "Add Card"
- **What it actually does (confirmed in code):** appends a blank row (`:149-157,215-224`). Hidden for
  Celtic Cross.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Card Entry → Celtic Cross position labels
- **What it actually does (confirmed in code):** 10 fixed labels (`CardEntry.tsx:12-23`). They're
  used as the position names in prompt §8 (`builder.ts:320`) and saved to
  `reading_cards.position_label`. Non-Celtic rows go to the prompt as "Card N".
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Card Entry → Bottom of Deck Card (autocomplete + orientation)
- **What it looks like it does:** the "undercurrent" card.
- **What it actually does (confirmed in code):**
  - Prompt §0, §9 and §13 (`builder.ts:199-201,330-336,394`), plus the continuation card list.
  - Saved as a `reading_cards` row with `is_bottom_card = true`, `sort_order 999`, and also as
    `readings.bottom_of_deck_card` / `_orientation`.
  - The audit allows it but doesn't require it (`lib/ai/audit/deterministic.ts:66-99`).
  - Optional; there's no validation.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Spirit Led Add-Ons → Oracle Card (+£10) toggle + "Oracle card name"
- **What it actually does (confirmed in code):**
  - Price +£10.
  - `order_addons` `oracle_card` row (Generate only).
  - `readings.include_oracle_card` / `oracle_card_name`.
  - Prompt effects only when a name is entered (see [§2](#2-ai-generation-option-matrix)).
  - The route rewrites the model's "Oracle Card — X" heading to "Oracle Card: X" after stripping
    dashes (`generate/route.ts:207-213`).
- **Scope:** per-reading / per-order.
- **Confidence:** confirmed in code.

### Spirit Led Add-Ons → Energy Cleansing Ritual (+£8)
- **What it actually does (confirmed in code):**
  - Price +£8.
  - `order_addons` `energy_cleansing` row (Generate only).
  - `readings.include_energy_cleansing`.
  - Prompt §3a, §11, §13 and §14.
  - The route then hard-cuts the ritual to its first sentence ending between 150 and 700 characters
    after the heading (`generate/route.ts:272-296`).
  - `readings.energy_cleansing_notes` is always written `null`; there's no notes input.
- **Scope:** per-reading / per-order.
- **Confidence:** confirmed in code.

### New Reading → "Generate Reading" (mobile button in the form, and desktop button in the empty output panel)
- **What it looks like it does:** writes the reading with AI.
- **What it actually does (confirmed in code):** `handleGenerate` (`ReadingForm.tsx:508-558`) runs
  this sequence:
  1. Client-side validation (`:471-506`): name required; valid email; at least 3/6/10 named cards
     for Mini/Core/Premium; all 10 for Celtic Cross.
  2. Requires a tone preset.
  3. `POST /api/readings/generate` with `{ formState, tonePresetText, isTestMode }`.
  4. On success, sets the output and `status = awaiting_review`, then `router.replace(?readingId=…)`.

  The server pipeline is covered in [§6.6](#66-generation-pipeline-server). The two buttons are the
  same handler (`:954-965`; `OutputPanel.tsx:470-477`).
- **Scope:** writes a per-client row, a per-order row and a per-reading row. Spends OpenAI tokens.
- **Confidence:** confirmed in code.

### 6.5 Output panel

`components/readings/OutputPanel.tsx`. The generated text is **read-only**: there's no in-app
editor for a reading. The only thing Save Draft saves is the form fields plus the already-generated
text. The audit migration mentions "a later hand-edit of generated_reading", but no UI for that
exists.

### Output panel → Header chips (tier, topic, character count, "Audit N/100", "Incomplete")
- **What it actually does (confirmed in code):**
  - Display only (`:352-388`).
  - The character-count colour is green at ≥90% of target, amber at ≥75%, red below that. It's
    measured on the full text **including sign-off and disclaimer**.
  - The footer counter (`:483-491`) labels any excess over the target as "add-ons" when an oracle
    or ritual add-on is on. Sign-off and disclaimer length is counted as "add-ons" too.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Output panel → "Quality audit" collapsible row
- **What it looks like it does:** shows a QA checklist.
- **What it actually does (confirmed in code):**
  - Toggles the open state (`:63-89`). It's open by default when the band isn't green or the audit
    is degraded.
  - Data comes from the Generate response or from `readings.audit_checks` on reopen.
  - Nine checks (`lib/ai/audit/types.ts:44-79`):
    - **7 deterministic:** card hallucination −45, omission −15, oracle −40, ritual −40,
      length −15, sign-off/disclaimer −12, stray dashes −12.
    - **2 from a second OpenAI call:** relevance −20, voice −12.
  - Bands: green ≥90, amber ≥70, red <70.
  - The audit is re-run only on Generate. Save Draft doesn't re-audit.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Output panel → "Try again" (error state)
- **What it actually does (confirmed in code):** calls the same `handleGenerate` (`:428-431`).
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Output panel → Regenerate
- **What it looks like it does:** writes a new version.
- **What it actually does (confirmed in code):**
  - Same `handleGenerate` (`:582-585`). Because `savedReadingId` / `savedOrderId` are set, the
    server **updates** the same rows (`generate/route.ts:447-449,523-537`).
  - `regenerated_count` goes up by 1.
  - `final_approved` is reset to `false`.
  - **The order status is forced to `awaiting_review` even if it was `sent` or `archived`**
    (`:439,583-588`).
  - `is_test` is rewritten to the current Test Mode.
  - `delivery_channel` is rewritten to `email`.
  - All `reading_cards` rows are deleted and re-inserted.
  - Priced add-on rows are deleted and re-inserted by flag.
  - OutputPanel's "Ready ✓" state doesn't reset after a regenerate (component state persists), so it
    can read as ready while the DB says `final_approved = false`.
- **Scope:** per-reading + per-order.
- **Confidence:** confirmed in code.

### Output panel → Save Draft
- **What it looks like it does:** saves work in progress.
- **What it actually does (confirmed in code):**
  - **Only visible after a reading has been generated** (the action bar sits inside `hasOutput`,
    `:578`). There's no way to save a draft before generating.
  - `POST /api/readings/save-draft` (`ReadingForm.tsx:560-575` → `app/api/readings/save-draft/route.ts`)
    does the following:
    - Same client upsert rules as Generate.
    - Order update **without** changing status (insert would use `pending`).
    - Rewrites `is_test`.
    - Writes the `follow_up` add-on row only.
    - Updates the reading fields including `generated_reading` (unchanged text) and
      `future_timeframe`.
    - Replaces cards when at least one is named.
  - **It doesn't touch the oracle, energy, extra-question or rush add-on rows, the audit, the prompt,
    or `final_approved`.**
  - The button shows Saving… / Saved ✓ / Failed — retry.
- **Scope:** per-reading + per-order (+ per-client phone).
- **Confidence:** confirmed in code.

### Output panel → Copy
- **What it actually does (confirmed in code):** `navigator.clipboard.writeText(generatedReading)`
  (`:237-242,606-613`). Always the full reading text, even for voice notes.
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code.

### Output panel → WhatsApp
- **What it looks like it does:** sends the reading on WhatsApp.
- **What it actually does (confirmed in code):**
  - Opens `https://web.whatsapp.com/send?phone=<digits>&text=<message>` in a new tab
    (`:253-259`). You still press send in WhatsApp; nothing is sent server-side.
  - The message is the full reading text, or for voice notes with an uploaded file, a templated
    "Hi <first name>…<signed URL>…<business name>" (`:244-251`).
  - Disabled when there's no phone, for video, or for a voice note that hasn't been uploaded
    (`:615-625`).
  - The phone is digits only, with no country-code handling.
  - Nothing is written to the DB, and order status doesn't change.
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code. **Inferred:** a UK number entered as `07…` without `44` won't
  resolve in WhatsApp, and very long readings in a URL may be truncated by the browser or WhatsApp.
  **Needs a manual check.**

### Output panel → Email
- **What it looks like it does:** emails the reading (README: "Gmail API — outbound email delivery").
- **What it actually does (confirmed in code):**
  - Opens a `mailto:` with subject "Your <Tier> <Topic> Reading from <Business name>" and the
    reading or voice-note message as the body (`:261-268`).
  - **Gmail API isn't used** (`lib/gmail/send.ts` is never imported).
  - Disabled for video and for un-uploaded voice notes.
  - Nothing is written to the DB.
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code. **Inferred:** mail clients may truncate very long `mailto:`
  bodies. **Needs a manual check.**

### Output panel → Mark Ready
- **What it looks like it does:** moves the order to a "ready" state.
- **What it actually does (confirmed in code):**
  - Sets `readings.final_approved = true`, and sets `orders.status = 'awaiting_review'`, which
    Generate already set (`ReadingForm.tsx:577-584`). **In practice it only flips `final_approved`.**
  - Neither update's error is checked, so the button shows "Ready ✓" even if the write failed.
  - Nothing in the UI reads `final_approved` ([§15](#15-readmemd-cross-check)).
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### Output panel → Mark Sent
- **What it looks like it does:** records delivery. README says it's only available after approval.
- **What it actually does (confirmed in code):**
  - Enabled whenever a `readingId` exists (`OutputPanel.tsx:670`). **No approval check.**
  - Sets `orders.status = 'sent'` and `sent_at = now()`, then `readings.final_approved = true`
    (`ReadingForm.tsx:586-598`).
  - Redirects to `/dashboard` after 2s (`OutputPanel.tsx:300`).
  - Doesn't call `syncOrderStatusToWebsite` and doesn't send anything.
- **Scope:** per-order + per-reading.
- **Confidence:** confirmed in code.

### Output panel → Voice Note Upload: "Choose file" / "try again"
- **What it looks like it does:** uploads the recording and makes a share link.
- **What it actually does (confirmed in code):**
  - Shown for `voice_note` after generation (`:494-565`). The file input is `audio/*`, with a 25 MB
    client-side cap.
  - The browser uploads to Supabase Storage bucket `reading-media` at
    `readings/<readingId>/voice-note-<timestamp>.<ext>` (`:316-325`).
  - `POST /api/readings/upload-media` creates a 30-day signed URL and writes
    `readings.media_file_path`, `media_signed_url` and `media_url_expires_at`
    (`app/api/readings/upload-media/route.ts:21-37`). That update's error isn't checked.
  - Every upload gets a new filename, so re-uploading after a reopen leaves the old object orphaned.
  - Nothing ever deletes storage objects, including permanent deletes in Trash.
  - "try again" only resets local state (`:535`).
- **Scope:** per-reading; storage objects persist.
- **Confidence:** confirmed in code. That the bucket exists with the policies described in
  `supabase/migrations/add_media_fields.sql:8-31` **could not be confirmed** (dashboard config).

### Output panel → "Video readings coming soon" notice
- **What it actually does (confirmed in code):** static notice (`:568-575`). There's no video
  upload, even though the migration comment says the bucket allows `video/*`.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### 6.6 Generation pipeline (server)

`POST /api/readings/generate` (`app/api/readings/generate/route.ts`), in order:

1. `getUser()` auth check (`:135-142`). It validates the tone text and requires at least one named
   card (`:155-162`).
2. Builds `PromptInput` (`:168-186`) and `max_tokens = round(target/3) + 500` (`:189`), then makes the
   main OpenAI call (`:194`).
3. Strips dashes and repairs the oracle heading (`:207-213`).
4. Reads the **`is_default = true`** `reading_templates` row (`:215-220`).
5. Continuation loop: if the main body is under 0.85× target, up to 2 extra calls (4 if target is
   ≥10k), appended to the body before the add-on sections (`:222-268`).
6. Ritual hard-cut (`:272-296`).
7. Truncation: `[END OF READING]` marker, then sign-off phrase, then trim to 1.15×, then the
   closing-lines heuristic, then marker and sign-off again (`:303-315`).
8. Strips hardcoded "with love and light" variants and appends the template sign-off (falling back
   to `With love and light ✨`) and the disclaimer (`:324-340`).
   - **Inferred edge case:** if the template sign-off is something else and the model writes it
     anyway, `truncateAfterSignOff` keeps it (`:45-74`) and the strip loop doesn't remove it, so
     the sign-off appears twice.
9. Audit, non-fatal (`:351-378`).
10. Client upsert (`:381-429`):
    - With `clientId`, only the phone is updated.
    - Else it matches by email: phone is updated on a match, otherwise a new client is inserted
      with name, email, phone, star sign, `is_returning` and `is_test`.
    - Else, with a name and no email, it inserts. The UI makes email required, so this is
      effectively unreachable.
11. Order insert or update (`:431-457`) with `status: 'awaiting_review'`, `delivery_channel: 'email'`
    and `is_test` from the current mode. `source: 'manual'` is set on insert only.
12. `order_addons`: delete, then re-insert for each of the 5 types by flag (`:460-485`), at
    `ADDON_PRICES`.
13. Reading insert or update (`:491-545`). The payload includes `future_timeframe`, `audit_*`,
    `groq_model`, `generated_prompt`, `final_approved: false`, `email_version: null` and
    `whatsapp_version: null`.
14. `reading_cards`: delete all, then re-insert (`:548-580`).
15. Order status set to `awaiting_review` again (`:583-588`).

**None of the DB writes in steps 10–15 check for errors.** A failed insert surfaces only as an
empty `readingId`/`orderId` in the response.

- **Schema drift:** `future_timeframe` is written here (`:504`) and in `save-draft/route.ts:124`,
  but the column isn't in `supabase/schema.sql:129-161` or any migration. **Could not confirm the
  live column.** If it's missing, every reading insert or update here fails silently.

---

## 7. Orders

`app/dashboard/orders/page.tsx` (client component).

### Orders → Table load
- **What it actually does (confirmed in code):**
  - Selects up to 200 non-deleted `orders`, joining client, `reading:readings(id, media_signed_url, media_url_expires_at)`
    and `order_addons(addon_type)` (`:25-32`).
  - Sorted rush first, then due date, then newest.
  - No `is_test` filter.
  - Readings aren't filtered by `deleted_at` in the embed.
  - **The `reading` embed is one-to-many** (`readings.order_id` isn't UNIQUE, `schema.sql:131,163`),
    so PostgREST returns an array. `order.reading?.id` and `.media_signed_url` are then `undefined`
    (`OrdersTable.tsx:93,159,169`), with these effects:
    - the link-expiry indicator never renders;
    - "Extend link" never renders;
    - "Open" always takes the `?orderId=` path.
- **Scope:** global.
- **Confidence:** queries confirmed in code. The array shape is **inferred** from schema.sql plus
  PostgREST behaviour. **Needs a manual check** if the live DB has a unique constraint.

### Orders → Search ("Search client or ID…")
- **What it actually does (confirmed in code):** client-side filter on client name or the order UUID
  substring, applied **after** the 200-row limit (`:42-49`).
- **Scope:** per-browser-session filter.
- **Confidence:** confirmed in code.

### Orders → Status / Tier / Topic selects
- **What it actually does (confirmed in code):** server-side `.eq()` filters (`:34-36`) re-run the
  query. The Topic options match the form's five topics; manual orders saved with a blank topic are
  stored as `'General'`, and no option matches that (`OrderFilters.tsx:63-72`).
- **Scope:** global read.
- **Confidence:** confirmed in code.

### Orders → "Due today" toggle
- **What it actually does (confirmed in code):** client-side filter using `isToday(due_at)` in
  **browser** local time (`:50-52`). This differs from the Dashboard KPI, which uses server time.
- **Scope:** per-browser-session filter.
- **Confidence:** confirmed in code.

### Orders → Row "Open"
- **What it actually does (confirmed in code):** links to `?readingId=` when the embed has an id,
  otherwise `?orderId=` (`OrdersTable.tsx:157-168`). In practice it's `?orderId=` (see Table load),
  which runs into the trashed-reading issue in [§6.1](#61-page-load-and-restore).
- **Scope:** per-order.
- **Confidence:** confirmed in code (the path taken is inferred).

### Orders → Row "Extend link"
- **What it looks like it does:** renews the voice-note share URL for 30 days.
- **What it actually does (confirmed in code):**
  - `POST /api/readings/extend-link` creates a new 30-day signed URL and updates the reading's
    `media_signed_url` / `media_url_expires_at` (`app/api/readings/extend-link/route.ts:21-46`).
  - It then refetches orders.
  - It doesn't send the client the new URL; the old URL stays valid until it expires.
  - Almost certainly **never visible here** (see Table load). History has a working copy.
- **Scope:** per-reading.
- **Confidence:** route confirmed in code; visibility inferred.

### Orders → Row "Start" (pending only)
- **What it actually does (confirmed in code):** `orders.status = 'in_progress'`, `updated_at` (`:62-69`).
  This is the **only** place anything sets `in_progress`. No error handling.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### Orders → Row "Mark sent" (awaiting_review only)
- **What it looks like it does:** the same as the Output panel's Mark Sent.
- **What it actually does (confirmed in code):** `orders.status = 'sent'` **only**.
  - It doesn't set `sent_at` (`:62-69`), so the order is missing from Dashboard Sent/Revenue.
  - It doesn't set `readings.final_approved`.
  - No confirmation.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### Orders → Row "Archive"
- **What it actually does (confirmed in code):** `status = 'archived'` from **any** status, with no
  confirm (`:71-73`). Archived orders stay in the default "All statuses" list.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### Orders → Row Trash icon ("Move to Trash")
- **What it actually does (confirmed in code):**
  - Sets `orders.deleted_at = now()` with no confirm (`:75-82`).
  - The linked readings are **not** trashed, so they stay in History and on the Dashboard with the
    order join still resolving.
  - `order_addons` are untouched.
  - The sidebar badge isn't refreshed.
- **Scope:** per-order.
- **Confidence:** confirmed in code.

### Orders → Duplicate (handler exists, no button)
- **What it actually does (confirmed in code):**
  - `handleDuplicate` (`:84-97`) is passed as `onDuplicate`, but `OrdersTable` never renders a
    control for it (`OrdersTable.tsx:41`). **Dead.**
  - If it were wired, it would copy `is_test`, `source`, `source_order_id` and `deleted_at`, but not
    add-ons or readings.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

---

## 8. Clients

`app/dashboard/clients/page.tsx` + `components/clients/*`.

### Clients → List load
- **What it actually does (confirmed in code):**
  - All non-deleted `clients` ordered by name, **including test clients** (`:49-53`).
  - Also **every** `client_notes.client_id` in the table, used for the note icon (`:54-56`).
- **Scope:** global.
- **Confidence:** confirmed in code.

### Clients → "Search clients…"
- **What it actually does (confirmed in code):** client-side name or email substring filter
  (`ClientList.tsx:17-23`).
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code.

### Clients → List row (click)
- **What it actually does (confirmed in code):**
  - Selects the client.
  - Loads **all** `readings` where `client_id` matches, with **no `deleted_at` or `is_test` filter**
    (`page.tsx:82-86`), so trashed readings appear in the profile's history and count.
  - Loads that client's `client_notes` (`:87-91`).
  - Row icons: note icon when notes exist; star when `is_returning`.
  - "£X total" shows `clients.total_spent`, which **nothing in the app ever updates**. It's `0` for
    every client, apart from whatever the live DB holds from outside the app.
- **Scope:** per-client (by `client_id`).
- **Confidence:** confirmed in code.

### Clients → "New" + slide-over (Full name*, Email, Phone, Star sign, Instagram handle, General notes; Cancel / × / backdrop / Save)
- **What it actually does (confirmed in code):**
  - Save inserts into `clients` with `total_spent: 0`, `is_returning: false` and **`is_test: false`
    even in Test Mode** (`page.tsx:118-157`).
  - Errors are swallowed silently (`:152-154`).
  - No duplicate-email check.
  - On success it selects the new client and shows a toast.
  - Cancel, × and the backdrop just close the panel.
  - No field for birthday or relationship context.
- **Scope:** per-client (new row).
- **Confidence:** confirmed in code.

### Client profile → Stats (Readings / Total spent / Returning-New)
- **What it actually does (confirmed in code):** `readings.length` (includes trashed); `total_spent`
  (never updated, see above); `is_returning` (`ClientProfile.tsx:121-134`). Display only.
- **Scope:** per-client.
- **Confidence:** confirmed in code.

### Client profile → Instagram / Birthday / General notes display
- **What it actually does (confirmed in code):**
  - Display only (`:137-160`).
  - **Nothing in the app can set `birthday`**, and General notes can only be set when creating a
    client.
  - There's no edit UI for any client field; `onUpdate` is never called.
- **Scope:** per-client.
- **Confidence:** confirmed in code.

### Client profile → "New reading"
- **What it looks like it does:** starts a reading for this client.
- **What it actually does (confirmed in code):** links to
  `/dashboard/readings/new?clientId=…&clientName=…&email=…` (`:79-84`). **All three params are
  ignored** (see [§6.1](#61-page-load-and-restore)), so you get a blank form.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Client profile → Trash icon → "Move to Trash" / "Cancel"
- **What it actually does (confirmed in code):**
  - Sets `clients.deleted_at = now()` (`page.tsx:65-75`).
  - **The client's orders and readings are not trashed.** They stay on Orders, History and the
    Dashboard, still showing the client's name.
  - The sidebar badge isn't refreshed.
  - The `confirmTrash` state isn't reset when you pick another client, because the component is
    reused ([finding 6](#0-highest-impact-findings)). If you open the confirm and then click a
    different client, the box shows and acts on **that** client.
- **Scope:** per-client (label implies client only, and that's accurate, but no cascade happens).
- **Confidence:** confirmed in code (React state semantics). A quick manual check is still worthwhile.

### Client profile → Reading history "View"
- **What it looks like it does:** opens that reading.
- **What it actually does (confirmed in code):** links to `/dashboard/history?readingId=<id>`
  (`:184-186`). History ignores query params entirely, so you land on the unfiltered 100-reading
  list.
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Client profile → Private Notes: textarea + "Save note"
- **What it looks like it does:** private notes that "inform future readings". The helper text also
  says they're "never sent to clients or included in readings".
- **What it actually does (confirmed in code):**
  - Inserts into `client_notes` `{ client_id, note, tag: 'private' }` (`:32-49`).
  - The second claim is accurate: no AI or delivery path reads `client_notes`. So they only
    "inform future readings" if you remember to read them yourself.
  - **Display bug:** notes are held in `useState(initialNotes)` (`:23`), and `ClientProfile` isn't
    keyed by client (`page.tsx:187`). The notes list therefore doesn't reflect the loaded notes, and
    it carries over between clients. Saving a note while viewing client B still inserts it with B's
    id (`client.id` is a live prop), but the list mixes in whatever was already on screen.
- **Scope:** per-client write. Protection is RLS only (any authenticated user).
- **Confidence:** write confirmed in code. The display bug is confirmed by React state semantics;
  **worth a manual check.**

### Client profile → Delete note (× on hover)
- **What it actually does (confirmed in code):** hard `DELETE` from `client_notes` by id, with no
  confirm and no Trash (`:51-59`).
- **Scope:** per-note.
- **Confidence:** confirmed in code.

### Clients → `/dashboard/clients/[id]` route
- **What it actually does (confirmed in code):**
  - A server-rendered profile (`app/dashboard/clients/[id]/page.tsx`).
  - **Nothing links to it.**
  - No `deleted_at` filter, so trashed clients render.
  - `onUpdate` is a no-op, and `onTrash` isn't passed, so there's no trash button.
- **Scope:** per-client.
- **Confidence:** confirmed in code (dead route).

---

## 9. History

`app/dashboard/history/page.tsx`. Not in the requested list, but it has its own write paths.

### History → List load + filters (search client name, tier, topic)
- **What it actually does (confirmed in code):**
  - 100 most recent non-deleted `readings` with order and client joins (`:70-80`). No `is_test`
    filter.
  - All filters run client-side over those 100 (`:175-181`).
  - Query params are ignored.
- **Scope:** global.
- **Confidence:** confirmed in code.

### History → Row click (expand)
- **What it actually does (confirmed in code):**
  - Toggles the expanded panel (`:232-235`), which shows the Media Link, Full Reading, Email
    Version, WhatsApp Version and "Private Notes" (`readings.reader_notes`).
  - **Email/WhatsApp versions are always null**, so those blocks never render.
  - **`reader_notes` is never written anywhere**, so that block never renders either. It's also a
    different thing from the client "Private Notes".
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### History → "Extend link"
- **What it actually does (confirmed in code):** shown when `media_file_path` exists. Calls
  `/api/readings/extend-link` and updates the row in place (`:86-102,253-264`). This one works,
  unlike the Orders copy.
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### History → Copy
- **What it actually does (confirmed in code):** copies `generated_reading` (`:18-36,265-269`).
- **Scope:** per-browser-session.
- **Confidence:** confirmed in code.

### History → Reopen
- **What it actually does (confirmed in code):** links to `/dashboard/readings/new?readingId=` (`:270-278`).
- **Scope:** per-reading.
- **Confidence:** confirmed in code.

### History → Trash icon + "Undo" toast
- **What it looks like it does:** moves the reading to Trash.
- **What it actually does (confirmed in code):**
  - If the order was `awaiting_review` or `in_progress`, it **sets the order to `pending`**.
  - Then `readings.deleted_at = now()`.
  - It shows a 5s undo toast and dispatches `trash-count-changed` (`:104-136`).
  - Undo clears `deleted_at` and restores the previous order status (`:138-173`).
  - The order-status side effect isn't mentioned in the UI.
  - After the 5s window, restoring from Trash **doesn't** restore the order status.
- **Scope:** per-reading + per-order.
- **Confidence:** confirmed in code.

---

## 10. Templates

`app/dashboard/templates/page.tsx`.

### Templates → Page intro ("…automatically appended to every generated reading")
- **What it actually does (confirmed in code):**
  - Lists **all** `reading_templates` (`:92-105`).
  - Generation only ever uses the **`is_default = true`** row (`generate/route.ts:215-220`).
  - There's no UI to set `is_default`, and no UI to create or delete templates. The empty state
    says "Add one to get started", but nothing on the page does that (`:132-136`).
  - Editing a non-default template therefore has no effect on readings.
- **Scope:** global.
- **Confidence:** confirmed in code. How many templates exist live **could not be confirmed.**

### Templates → Template name (inline input)
- **What it actually does (confirmed in code):** local draft, saved by Save (`:48-53`). The name
  isn't used anywhere else.
- **Scope:** per-template.
- **Confidence:** confirmed in code.

### Templates → Sign-off text
- **What it looks like it does:** the closing line appended to readings.
- **What it actually does (confirmed in code):**
  - Appended after truncation (`generate/route.ts:324-337`).
  - Also a truncation anchor: text after its first occurrence is cut (`:304,315`).
  - Checked by the audit.
  - Changes apply only to readings **generated after** saving; stored readings aren't rewritten.
  - **Not used by the Daily Card Message**, which hardcodes "Love and light, Rhiannon x"
    (`lib/ai/prompts/daily-message.ts:85-87`).
- **Scope:** global (every future reading).
- **Confidence:** confirmed in code.

### Templates → Disclaimer text
- **What it actually does (confirmed in code):** appended after the sign-off when non-empty
  (`generate/route.ts:338-340`), and checked by the audit. Same "future readings only" scope.
- **Scope:** global.
- **Confidence:** confirmed in code.

### Templates → Save
- **What it actually does (confirmed in code):**
  - `reading_templates.upsert({ ...draft })` (`:27-42`). This round-trips every column, including
    `booking_cta`, `email_subject_template` and `whatsapp_opening_line`, which aren't editable here
    and aren't read anywhere.
  - On error it shows nothing: the button just stops loading.
- **Scope:** per-template (global effect if it's the default).
- **Confidence:** confirmed in code.

---

## 11. Settings

`app/dashboard/settings/page.tsx`. It reads the first `app_settings` row (`:25-38`).

### Settings → "Save changes"
- **What it actually does (confirmed in code):**
  - `app_settings.update({ ...settings })` by id, or an insert if no row exists (`:44-65`).
  - It shows "Saved!" **regardless of error**; the result isn't checked.
- **Scope:** global (single row).
- **Confidence:** confirmed in code.

### Settings → Reader name / Sign-off name / Booking URL / Instagram handle / WhatsApp number
- **What it looks like it does:** identity used in readings and messages.
- **What it actually does (confirmed in code):** saved to `app_settings` and **read nowhere else in
  the app** (grep: only `settings/page.tsx`). The reading sign-off comes from Templates; the daily
  message sign-off is hardcoded. Delivery doesn't use the WhatsApp number or Booking URL.
- **Scope:** global, no effect.
- **Confidence:** confirmed in code. **Dead settings.**

### Settings → Business name
- **What it actually does (confirmed in code):** used only in the Output panel's email subject and
  the voice-note WhatsApp/Email message (`ReadingForm.tsx:365-386`, `OutputPanel.tsx:248,265`). It
  falls back to "Deep Blue Divination". Not used in the AI prompt.
- **Scope:** global.
- **Confidence:** confirmed in code.

### Settings → Default topic (Love / Career / General / Spiritual Guidance)
- **What it actually does (confirmed in code):** saved to `app_settings.default_topic` and **never
  read**. Its option values don't match the form's topic values either ("Love" vs "Love &
  Relationships").
- **Scope:** global, no effect.
- **Confidence:** confirmed in code. **Dead setting.**

### Settings → Default delivery format
- **What it actually does (confirmed in code):** saved to `app_settings.default_delivery_format`
  and **never read**. New readings always start as Written (`ReadingForm.tsx:63`).
- **Scope:** global, no effect.
- **Confidence:** confirmed in code. **Dead setting.**

### Settings → AI model (read-only display)
- **What it looks like it does:** shows the model in use ("set via OPENAI_MODEL env var").
- **What it actually does (confirmed in code):** displays `process.env.NEXT_PUBLIC_AI_MODEL_DISPLAY ?? 'gpt-4o'`
  (`:229`), a **different** env var from the `OPENAI_MODEL` the generator actually uses
  (`lib/ai/config.ts:2`). If `OPENAI_MODEL` is changed, this still shows `gpt-4o` unless the display
  var is also set. `NEXT_PUBLIC_AI_MODEL_DISPLAY` isn't documented anywhere.
- **Scope:** env.
- **Confidence:** confirmed in code.

### Settings → "Connect Gmail account"
- **What it looks like it does:** connects Gmail so the app can send readings. The page text says
  "send readings directly from Reader Console".
- **What it actually does (confirmed in code):**
  - Navigates to `GET /api/auth/gmail` (`:94-96`), which redirects to Google OAuth (scope
    `gmail.send`).
  - The callback shows the refresh token on screen for you to paste into env vars
    (`app/api/auth/gmail/callback/route.ts:48-65`).
  - Nothing is stored, and **nothing in the app ever sends via Gmail** ([§14](#14-webhooks--integrations)).
- **Scope:** env (manual).
- **Confidence:** confirmed in code.

### Settings → "Dark mode (coming soon)" toggle
- **What it actually does (confirmed in code):** disabled; local state only (`:19,264-269`).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Settings → Test Mode toggle
- **What it looks like it does:** "All clients, orders, and readings created while active will be
  flagged as test data. A yellow banner will appear across the app."
- **What it actually does (confirmed in code):**
  - Updates the React context and writes `app_settings.test_mode_enabled` straight away (`:67-77`),
    or only the context if no settings row exists.
  - The dashboard layout reads the value on each server render (`app/dashboard/layout.tsx:22-28`),
    so it's **global**: every browser and device sees Test Mode after reloading.
  - **What gets flagged:**
    - The generate and save-draft routes stamp `is_test = <current mode>` on new clients, and on
      **new and existing** orders and readings (`generate/route.ts:409,424,443,512`;
      `save-draft/route.ts:55,70,88,133`).
    - Regenerate or Save Draft on a real order while Test Mode is on turns it into test data, and
      the reverse is also true.
  - **Ignored by:**
    - Clients → New (always `false`, `clients/page.tsx:138`);
    - all webhooks (never set `is_test`);
    - daily messages (the table has no `is_test`);
    - OpenAI calls (tokens are still spent);
    - dashboard KPIs, revenue and lists (no `is_test` filters anywhere, only TEST badges).
- **Scope:** global (label implies session-local "while active"). The flag writes are per record,
  including existing records.
- **Confidence:** confirmed in code.

### Settings → "Clear all test data" → "Yes, delete all test data" / "Cancel"
- **What it looks like it does:** removes test clients, orders and readings.
- **What it actually does (confirmed in code):**
  - Hard `DELETE` in this order: `readings where is_test`, `orders where is_test`,
    `clients where is_test` (`:79-92`).
  - Cascades remove `reading_cards`, `order_addons` and `client_notes`.
  - It **includes soft-deleted items in Trash**.
  - Non-test orders or readings linked to a deleted test client keep existing with
    `client_id = NULL` ("No client").
  - Records flipped to test by the Regenerate/Save behaviour above are deleted.
  - Storage media files aren't deleted.
  - Errors aren't checked, and "All test data cleared." always shows.
  - The sidebar badge isn't refreshed.
  - The page never states that it's global.
- **Scope:** global.
- **Confidence:** confirmed in code.

---

## 12. Daily Card Message

Pages: `app/dashboard/daily-message/page.tsx` (today) and `.../calendar/page.tsx`. Shared pipeline:
`lib/daily-message/generate-for-date.ts`. "Today" is always `todayDateString()` in Europe/London
(`lib/daily-message/dates.ts:14-26`).

Prompt: `lib/ai/prompts/daily-message.ts`, `max_tokens 700` (`lib/ai/generate.ts:49-75`). The only
inputs are **card name + orientation**; there's no client or business data. The sign-off
"Love and light, Rhiannon x" is hardcoded (`:85-87`). The header emoji is decided in code
(`:10-16,39-44`).

### 12.1 Today page (`DailyMessageForm`)

### Daily Message → Page load
- **What it actually does (confirmed in code):**
  - Today's row where `deleted_at IS NULL` (`page.tsx:10-25`). That includes a *skipped* row, which
    then shows an empty card and message.
  - **"Last 7 days"** actually means the 7 rows with the **latest `message_date`**, not the last
    7 calendar days (`page.tsx:27-42`). After "Generate next 30 days", this list shows future dates.
    It also includes skipped rows (blank card name, "Draft" badge).
- **Scope:** global (one row per date).
- **Confidence:** confirmed in code.

### Daily Message → "View calendar"
- **What it actually does (confirmed in code):** links to `/dashboard/daily-message/calendar` (`DailyMessageForm.tsx:138-144`).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Daily Message → "Draw a card"
- **What it looks like it does:** a random card that avoids recent repeats.
- **What it actually does (confirmed in code):** client-side `drawRandomCard(excludeNames)`
  (`:51-56`). `excludeNames` is the card names from that same "latest 7 rows" list (`:44`), which
  may be future-dated. This isn't the same exclusion window as the server auto-draw (7 days before
  the date, `generate-for-date.ts:58-75`). Orientation is 50/50. Nothing is saved.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Daily Message → Card select + "Reversed" toggle
- **What it actually does (confirmed in code):** local state (`:170-188`). Sent to Generate.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Daily Message → Generate / Regenerate
- **What it looks like it does:** writes today's message.
- **What it actually does (confirmed in code):**
  - `POST /api/daily-message/generate` `{ cardName, orientation }`, with no date, so the server uses
    today (`:58-89`; `app/api/daily-message/generate/route.ts:27-38`).
  - Pipeline: generate → strip dashes → **re-read the date's row without a `deleted_at` filter**
    (`generate-for-date.ts:98-102`) → skip the write if deleted or skipped → otherwise upsert on
    `message_date`.
  - The upsert sets `approved: false`, `final_text: null`, `skipped: false`, `deleted_at: null`
    (`:115-133`).
  - **Regenerate on an already-approved message un-approves it with no confirm.** The public fetch
    endpoint then returns `NOT_READY` until you approve again.
  - If a soft-deleted row exists for today, the write is always refused, with "deleted or skipped
    elsewhere while generating".
- **Scope:** per-date (today).
- **Confidence:** confirmed in code.

### Daily Message → Message textarea
- **What it actually does (confirmed in code):**
  - Editing clears the **local** "Approved" badge (`:216-219`) but writes nothing.
  - The DB row stays `approved = true` with the old `final_text`, so the fetch endpoint keeps
    serving the **old** text while the UI suggests it's unapproved.
  - Edits are lost on reload unless you click Approve & Save.
- **Scope:** per-form.
- **Confidence:** confirmed in code.

### Daily Message → "Approve & Save"
- **What it actually does (confirmed in code):** `POST /api/daily-message/approve { finalText }`
  (`:91-117`). This updates today's non-deleted row: `final_text`, `approved = true`, `approved_at`
  (`app/api/daily-message/approve/route.ts:28-45`). It returns 404 if there's no row.
  "Saved — today's message is live for the Shortcut to fetch."
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### 12.2 Calendar (`components/daily-message/CalendarView.tsx`)

### Calendar → Month grid + ‹ › month navigation
- **What it actually does (confirmed in code):**
  - Loads the month's non-deleted rows (`:74-101`).
  - Cells before today (London) are "locked". An empty locked cell isn't clickable; a locked cell
    with a row opens read-only (`:560-597`).
  - Today gets a red ring and dot if there's no row or it isn't approved or skipped.
- **Scope:** per-month read.
- **Confidence:** confirmed in code.

### Calendar → Day modal close (× / backdrop)
- **What it actually does (confirmed in code):** local state reset (`:126-130,614,637`).
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Calendar → "Generate for this day" (empty date)
- **What it actually does (confirmed in code):** `POST /generate { date }` with no card, so the server
  auto-draws avoiding the 7 days before that date (`:144-171`; `generate-for-date.ts:58-75`).
  - **Confirmed bug:** if that date has a soft-deleted row, for example after "Delete" or a bulk
    delete, the write is always refused and the modal says the date was "deleted or skipped
    elsewhere while generating". The date can't be regenerated until the Trash row is restored or
    permanently deleted.
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### Calendar → "Skip this day" (empty date)
- **What it looks like it does:** marks the date as intentionally empty.
- **What it actually does (confirmed in code):**
  - `POST /api/daily-message/skip` (`app/api/daily-message/skip/route.ts`) refuses past dates.
  - It refuses dates with a **non-deleted** row (`:34-48`).
  - It then upserts `{ card_name: '', skipped: true, deleted_at: null, ... }` on `message_date`
    (`:50-68`).
  - **If the date has a soft-deleted message in Trash, this upsert overwrites that same row**,
    because `message_date` is UNIQUE. The trashed message's text and card are lost and it vanishes
    from Trash.
- **Scope:** per-date; destructive to trashed data for that date.
- **Confidence:** confirmed in code.

### Calendar → "Un-skip" (skipped date)
- **What it looks like it does:** returns the date to Empty.
- **What it actually does (confirmed in code):**
  - Sets `skipped = false` on the row (`app/api/daily-message/unskip/route.ts:28-35`).
  - **The row isn't removed**, so a stub remains: `card_name ''`, `generated_text NULL`,
    `approved false`.
  - The calendar removes it locally (`CalendarView.tsx:321`). After a reload the date renders as an
    amber "generated" cell with a blank card name, offering Regenerate / Save edit / Approve / Delete
    on an empty message.
  - The cron route will generate into it (`cron-generate/route.ts:116-117`).
  - Un-skip has **no past-date lock** server-side; the UI hides the button for past dates.
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### Calendar → Regenerate (existing date)
- **What it actually does (confirmed in code):** `POST /generate { date, cardName, orientation }`,
  keeping the same card (`:173-204`). It resets approval and `final_text`, and discards any saved
  edit (`generated_text` is overwritten). No confirm, even for approved dates.
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### Calendar → "Save edit"
- **What it actually does (confirmed in code):** `POST /api/daily-message/save { date, text }` writes
  `generated_text`, and also `final_text` if the row is already approved, so the live text updates
  straight away (`app/api/daily-message/save/route.ts:52-65`). No past-date lock server-side.
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### Calendar → Approve
- **What it actually does (confirmed in code):** `POST /approve { date, finalText }` (`:229-250`),
  the same route as the today page. No past-date lock server-side.
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### Calendar → Delete (existing date)
- **What it actually does (confirmed in code):**
  - After a confirm (with an extra warning for today's approved message), `POST /delete { date }`
    sets `deleted_at` for today or later only (`app/api/daily-message/delete/route.ts:28-44`).
  - The row then shows in the Trash → Daily Messages tab.
  - See "Generate for this day" and "Skip this day" above for what that soft-deleted row blocks or
    destroys.
- **Scope:** per-date.
- **Confidence:** confirmed in code.

### Calendar → "Generate next 30 days"
- **What it looks like it does:** fills the next 30 days with drafts.
- **What it actually does (confirmed in code):**
  - `POST /api/daily-message/generate-batch { startDate: today, days: 30 }` (`CalendarView.tsx:330-351`).
  - The server reads non-deleted rows from 7 days before start through the end of the range. It
    leaves dates that have any non-deleted row alone (approved, draft or skipped), draws cards with
    a rolling 7-day no-repeat, and runs 6 OpenAI calls at a time
    (`app/api/daily-message/generate-batch/route.ts:43-146`).
  - It re-checks each date before writing (without a `deleted_at` filter), so **dates with
    soft-deleted rows are generated, billed, then discarded and counted as "skipped".**
  - `days` is capped at 90 server-side.
  - A 30-call batch runs inside one request. **Could not confirm** it finishes inside the Vercel
    function timeout.
- **Scope:** global over 30 dates from today. Spends up to 30 OpenAI calls.
- **Confidence:** confirmed in code (timeout: needs a manual check).

### Calendar → "Approve all pending (N)"
- **What it looks like it does:** approves every pending draft.
- **What it actually does (confirmed in code):**
  - Collects dates **in the currently displayed month only** with `!approved && !skipped && generated_text`
    (`:353-362`). The confirm dialog names the month; the button label doesn't.
  - `approve-batch` sets `final_text = generated_text`, `approved = true` for each
    (`app/api/daily-message/approve-batch/route.ts:27-55`).
  - It includes past dates in that month, with no lock server-side.
- **Scope:** per-displayed-month.
- **Confidence:** confirmed in code.

### Calendar → "Delete all pending"
- **What it looks like it does:** deletes unapproved drafts.
- **What it actually does (confirmed in code):**
  - `delete-batch { mode: 'pending' }` soft-deletes **every** row with `message_date >= today`,
    `approved = false`, not deleted (`delete-batch/route.ts:29-37`).
  - That is **all future months, not just the one on screen**, and it **includes skipped-day rows**
    (they're `approved = false`) and un-skip stubs.
  - After this, those dates can't be regenerated (see above).
- **Scope:** global, today onward (broader than the visible month and broader than "drafts").
- **Confidence:** confirmed in code.

### Calendar → "Delete all including approved"
- **What it actually does (confirmed in code):**
  - Checks today's row to word the warning, then requires typing `DELETE` (`:411-445`).
  - `delete-batch { mode: 'all' }` soft-deletes every non-deleted row from today onward, including
    approved and skipped rows (`delete-batch/route.ts:29-33`).
- **Scope:** global, today onward.
- **Confidence:** confirmed in code.

### 12.3 Server-to-server endpoints

### Daily Message → `GET /api/daily-message/fetch?key=…` (public)
- **What it looks like it does:** hands today's approved text to an external automation.
- **What it actually does (confirmed in code):**
  - Middleware lets it through (`lib/supabase/middleware.ts:57`).
  - It compares the `key` **query param** to `DAILY_MESSAGE_FETCH_SECRET` with plain `!==`
    (`app/api/daily-message/fetch/route.ts:20-25`), so the secret travels in URLs and can end up in
    logs.
  - It queries today's non-deleted row as the anon role, relying on RLS
    `approved = true AND deleted_at IS NULL` (`schema.sql:322-324`).
  - It returns `final_text` as plain text, or `NOT_READY` 404, or `ERROR` 500.
  - The consumer (UI copy says "the Shortcut") isn't in this repo.
- **Scope:** global (today's single row).
- **Confidence:** confirmed in code. The consumer **could not be confirmed.**

### Daily Message → `POST /api/daily-message/cron-generate` (public, secret header)
- **What it looks like it does:** scheduled generation of today's draft.
- **What it actually does (confirmed in code):**
  - Checks `x-daily-message-cron-secret` against `DAILY_MESSAGE_CRON_SECRET` with a timing-safe
    compare (`cron-generate/route.ts:27-62`).
  - Uses a service-role client (`:43-51`).
  - Returns no-ops if today's row is deleted, skipped, approved or already drafted (`:86-118`).
  - Otherwise auto-draws and generates via the shared pipeline.
  - The schedule is in `supabase/migrations/add_daily_message_pg_cron.sql` (`0 3 * * *` UTC).
- **Scope:** per-date (today).
- **Confidence:** route confirmed in code.
  - **Could not confirm:** whether the pg_cron job is applied live.
  - PROJECT_STATUS says "not yet applied" as of 2026-09-05. The migration's comment now calls the
    Vercel-protection precondition "RESOLVED" with a bypass header. The two disagree and need a live
    check (`SELECT * FROM cron.job`).

---

## 13. Trash

`app/dashboard/trash/page.tsx`.

### Trash → Tabs (Clients / Orders / Readings / Daily Messages)
- **What it actually does (confirmed in code):**
  - Loads rows from all four tables where `deleted_at` is within the last 30 days (`:107-144`).
  - Anything deleted longer ago is invisible here but **still in the DB** (no purge job exists).
  - Tab counts are client-side lengths.
- **Scope:** global.
- **Confidence:** confirmed in code.

### Trash → "Items are permanently deleted after 30 days."
- **What it looks like it does:** automatic purge.
- **What it actually does (confirmed in code):** static text (`:187-189`). No code, cron or SQL in
  the repo purges anything. The "Nd left" tag (`:30-41`) is cosmetic.
- **Scope:** n/a.
- **Confidence:** confirmed in code. A purge job configured directly in Supabase **could not be
  ruled out.** Check `cron.job`.

### Trash → Restore (per row)
- **What it actually does (confirmed in code):**
  - `update({ deleted_at: null })` where the row is still deleted, then reports an error if 0 rows
    matched (`:150-165`).
  - Restoring a reading **doesn't** restore the order status that History changed.
  - Restoring a client doesn't touch their orders (they were never trashed).
  - The sidebar badge isn't refreshed.
- **Scope:** per-row.
- **Confidence:** confirmed in code.

### Trash → Delete → "Delete permanently" / Cancel
- **What it actually does (confirmed in code):** hard `DELETE` by id (`:167-172`). By FK:
  - **Client:** `client_notes` cascade; `orders.client_id` and `readings.client_id` set to NULL.
  - **Order:** `order_addons` cascade; `readings.order_id` set to NULL.
  - **Reading:** `reading_cards` cascade.
  - **Daily message:** the row is gone.

  Storage files aren't deleted, errors aren't checked, and the sidebar badge isn't refreshed.
- **Scope:** per-row (with the FK side effects above).
- **Confidence:** confirmed in code + `schema.sql`.

---

## 14. Webhooks & integrations

### Webhooks → `POST /api/webhooks/inbound-order`, Stripe path (has `stripe-signature`)
- **What it looks like it does:** creates an order from Stripe Checkout.
- **What it actually does (confirmed in code):**
  - `new Stripe(STRIPE_WEBHOOK_SECRET)`: the **webhook secret is passed as the API key**
    (`app/api/webhooks/inbound-order/route.ts:15-17`). It works only because `constructEvent`
    doesn't call the API.
  - Handles only `checkout.session.completed`.
  - `parseStripeMetadata` (`lib/webhooks/stripe-parser.ts:47-93`) reads:
    - email from `customer_details.email` first, then `metadata.email`;
    - tier and format by substring;
    - question from `question|focus|questions_or_focus`;
    - add-on flags from `addon_*` or the bare keys, with **each add-on price recorded as £0**;
    - `priceTotal = amount_total/100`.
  - It then calls `createOrderFromWebhook` (`lib/webhooks/inbound-order.ts:24-129`), which:
    - upserts the client by email, setting `is_returning = true` on a match (see [§1](#1-deep-dive-the-returning-client-toggle));
    - otherwise inserts with `is_returning: false`;
    - suggests a topic from keywords;
    - inserts the order with `source: 'stripe'`, `status: 'pending'`, **no `due_at`, no `is_test`**;
    - inserts the add-on rows;
    - inserts an initial reading with the tone preset looked up **by seed name**. `character_target`
      is **5000 for Celtic Cross** (vs 6000 in `lib/ai/config.ts`), and `specific_question` isn't
      captured.
  - **No idempotency:** a Stripe retry creates a duplicate order and reading (nothing checks
    `source_order_id`).
  - Uses the service role, silently falling back to the publishable key if it isn't set (`:13`). RLS
    would then block the writes.
- **Scope:** creates per-client, per-order and per-reading rows; the client match is global by email.
- **Confidence:** confirmed in code. Stripe dashboard config **could not be confirmed.**

### Webhooks → `POST /api/webhooks/inbound-order`, generic path (`X-Webhook-Secret`)
- **What it actually does (confirmed in code):**
  - Plain `!==` secret compare (`route.ts:49`).
  - Maps the body fields (`:54-67`).
  - `Boolean(body.oracle_card)` and `Boolean(body.energy_cleansing)` treat the **string `"false"`
    as true** (`:64-65`).
  - **`addons` is always `[]`**, so no `order_addons` rows are ever created on this path, even with
    `is_rush` or `oracle_card` set.
  - `sourceOrderId` from `order_id|stripe_payment_id`.
  - It then runs the same `createOrderFromWebhook`, so the order is still labelled `source: 'stripe'`.
- **Scope:** as above.
- **Confidence:** confirmed in code.

### Webhooks → `POST /api/webhooks/email-order` (`X-Webhook-Secret`, plain-text body)
- **What it actually does (confirmed in code):**
  - Parses `Key: value` lines ("Name", "Email", "Reading Tier", "Format", "Oracle Card: Yes", …,
    "Total Paid") (`lib/webhooks/email-parser.ts:23-61`).
  - Add-on prices come from `ADDON_PRICES`; `sourceOrderId` is `''`.
  - Same `createOrderFromWebhook`, so also `source: 'stripe'`.
  - **Not documented in README.**
- **Scope:** as above.
- **Confidence:** confirmed in code.

### Integrations → Gmail OAuth (`/api/auth/gmail`, `/callback`)
- **What it actually does (confirmed in code):**
  - Auth-guarded. The callback swaps the code for tokens and **prints the refresh token into an
    HTML page** (`callback/route.ts:48-65`).
  - The `error` query param is interpolated into HTML unescaped (`:23`). That's a reflected-HTML
    issue, reachable only by a logged-in user.
  - `lib/gmail/auth.ts:22-26` `createOAuth2Client` builds its redirect URI from the **Supabase URL's
    origin**. That's wrong, though it's harmless for refresh-token-only use.
- **Scope:** env.
- **Confidence:** confirmed in code.

### Integrations → `sendReadingEmail` (`lib/gmail/send.ts`)
- **What it actually does (confirmed in code):** complete, and **never imported anywhere.** The
  `orders.gmail_send_status` column is never written. **Dead.**
- **Scope:** n/a.
- **Confidence:** confirmed in code.

### Integrations → `syncOrderStatusToWebsite` (`lib/integrations/website-sync.ts`)
- **What it actually does (confirmed in code):** would update an external Supabase table's status
  column where `stripe_session_id = sourceOrderId`. It's **never called**, and
  `orders.website_sync_status` is never written. **Dead.**
- **Scope:** n/a.
- **Confidence:** confirmed in code.

---

## 15. README.md cross-check

| README claim | What the code does | Verdict |
|---|---|---|
| "Gmail API — outbound email delivery" (Stack) | The Email button is `mailto:`; `sendReadingEmail` is never called | **False in practice** |
| Required env: three vars | The webhooks and cron also need `SUPABASE_SERVICE_ROLE_KEY`; daily message needs `DAILY_MESSAGE_FETCH_SECRET` / `DAILY_MESSAGE_CRON_SECRET`; website sync needs `WEBSITE_ORDERS_TABLE` / `_STATUS_COLUMN` / `_STATUS_SENT_VALUE`; Settings reads `NEXT_PUBLIC_AI_MODEL_DISPLAY`. None are in README (most are in `.env.local.example`) | **Incomplete** |
| "Run the full contents of schema.sql" | schema.sql lacks the audit columns (in `add_reading_audit_columns.sql`), `readings.future_timeframe` (nowhere) and the storage bucket (manual). The generate route writes all three, so a schema.sql-only DB can't save readings | **Insufficient** |
| "Create a user … This is the only login that will work" | RLS grants every authenticated user full access; any Supabase Auth user can log in | **Only true with one Auth user** |
| "Vercel-ready with no custom configuration needed" | `vercel.ts` pins `fra1`; cron needs Vercel protection bypass + Vault secrets | **Outdated** |
| Gmail setup: "Desktop application type" credentials | The callback uses a web redirect URI `${origin}/api/auth/gmail/callback` | **Inferred mismatch**, needs a manual check |
| Gmail setup: "To enable sending readings by email" | Nothing sends | **False in practice** |
| Stripe `email` → `clients.email` | `customer_details.email` preferred, metadata `email` fallback | Mostly accurate |
| Stripe `rush_24h`/`oracle_card`/`energy_cleansing` → `order_addons` + flags | True on the Stripe path (at £0 add-on price); also accepts `addon_*`, `extra_question`, `follow_up` (undocumented) | Accurate, incomplete |
| Generic webhook body fields incl. `is_rush`, `oracle_card`, `energy_cleansing` | Flags set, but **no `order_addons` rows**; `"false"` strings read as true | **Partially true** |
| "Zapier email parsing" → POST to `/inbound-order` with mapped JSON | Works, but a dedicated plain-text `/api/webhooks/email-order` route exists and isn't mentioned | **Undocumented route** |
| Status flow "never skip steps" | Generate jumps pending → awaiting_review; Archive allowed from any status; nothing enforces order | **Convention only, not enforced** |
| "Mark Sent is only available after … `final_approved = true`" | Output panel Mark Sent enabled whenever a reading id exists; Orders "Mark sent" ignores it too; nothing reads `final_approved` | **False** |
| AI generation "in three steps" (full → email → WhatsApp) | One main call (+ continuations + audit); email/WhatsApp builders unused; those columns always null | **False** (already noted in PROJECT_STATUS) |
| "Max tokens is set to 4096" | Main call `target/3 + 500` (1,500 / 2,500 / 4,500 / 2,500); continuations 4,096; audit 400; daily message 700 | **Outdated** |
| `OPENAI_API_KEY` never exposed to the browser | True: only server modules import `lib/ai/client.ts` | Accurate |
| Project structure `data/` "78 Light Seers cards" | 78 cards confirmed; naming ("The Hanged One") is consistent with Light Seer's, but the deck isn't named in code | 78 confirmed; deck inferred |
| Project structure `integrations/ Website status sync` | Implemented, never called | **Dead** |

**Behaviour neither README.md nor STYLE.md documents:** Daily Card Message (whole feature, calendar,
fetch, cron), Trash + soft delete, Test Mode + Clear test data, reading audit, History page and undo,
voice-note upload and signed links, Templates page, `/auth/confirm` + `/auth/set-password`, the
continuation and truncation pipeline, the email-order webhook, `scripts/test-audit.ts`, and
`content/guide.html`.

**Drift vs PROJECT_STATUS.md** (noted for completeness, not a full re-audit):
- PROJECT_STATUS says there's "no automated test suite". `scripts/test-audit.ts` (added in
  `cec3532`) is a runnable offline check for the audit module via `npx tsx`. `tsx` isn't a
  dependency, and the script wasn't run for this audit.
- PROJECT_STATUS says pg_cron is "not yet applied" and blocked by Vercel protection. The migration
  file now says that precondition is resolved. The live state is unconfirmed.
- PROJECT_STATUS mentions the dead `/dashboard/clients/[id]` route. Confirmed still dead.

---

## 16. STYLE.md cross-check

Spot-checked against `tailwind.config.ts`, `app/globals.css` and the components. Most token and
recipe claims hold: the brand and navy scale, Inter, animations, Badge variants, Button sizes,
KPICard, Tabs, Toggle, Sidebar breakpoints, calendar cell classes, modal, slide-over, toasts, "no
`shadow-md`". Discrepancies:

| STYLE.md claim | Code | Verdict |
|---|---|---|
| Navy is "Sidebar only" | `SuitFilter` active pill uses `bg-navy` (`components/readings/SuitFilter.tsx:31`) | **Drift** |
| Semantic colours limited to red/amber/blue/green/purple | Rush banner uses `rose-*` (`ReadingForm.tsx:623-625`); orientation toggle uses `sky-500` / `amber-500` (`CardEntry.tsx:62,74`); Celtic Cross rows and the bottom-card panel use raw `indigo-*` (`CardEntry.tsx:88,91,227-247`, same hexes as `brand-*`, but not the token) | **Undocumented colours** |
| Focus rings "brand-colored and consistent everywhere" | `Button` uses `ring-slate-400` for secondary/outline/ghost and `ring-red-500` for danger (`components/ui/Button.tsx:20-30`); several raw buttons (WhatsApp, Email, Copy, calendar nav) set no ring and fall back to the global outline | **Inaccurate** |
| Table header "uppercase tracking-wide" | Dashboard queue (`app/dashboard/page.tsx:213-217`) and every Trash table (`trash/page.tsx:222-226` etc.) omit `uppercase tracking-wide` | **Drift** |
| Buttons via `components/ui/Button.tsx` | Output panel WhatsApp (`bg-green-600`), Email (`bg-blue-600`), Copy, and the Generate CTAs are hand-rolled `<button>`s | **Undocumented variants** |
| `.scrollbar-thin`, `.text-balance` (globals.css) | Defined, never used | Minor dead CSS (not claimed by STYLE) |
| Sidebar trash count badge | `rounded-full bg-slate-600 text-slate-300 text-[10px]` (`Sidebar.tsx:64`); not documented | **Undocumented** |
| `darkMode: 'class'`, not used | Confirmed; the Settings toggle is disabled | Accurate |

---

## 17. Consolidated lists

### Dead / unwired
- `lib/gmail/send.ts` `sendReadingEmail`, `isGmailConfigured`; `orders.gmail_send_status`
- `lib/integrations/website-sync.ts`; `orders.website_sync_status`
- `builder.ts` `buildEmailVersionPrompt` / `buildWhatsAppVersionPrompt`; `lib/ai/config.ts`
  `EMAIL_VERSION_MAX_CHARS`, `WHATSAPP_VERSION_MAX_CHARS`, `WHATSAPP_CHUNK_MAX_WORDS`;
  `readings.email_version` / `whatsapp_version` (always null; History blocks never render)
- `lib/ai/prompts/tone-presets.ts` `getDefaultTonePresetForTier`; `lib/ai/errors.ts` `GroqConfigError` (never thrown)
- Orders `handleDuplicate` (no button)
- `/dashboard/clients/[id]` route (no links)
- TopBar `title` prop; ClientProfile `onUpdate` prop
- Settings: Reader name, Sign-off name, Booking URL, Instagram, WhatsApp number, Default topic,
  Default delivery format; `app_settings.default_reading_length`, `default_tone_preset_id`, `groq_model`
- `reading_templates.booking_cta`, `email_subject_template`, `whatsapp_opening_line`; templates' `name` beyond display
- `readings.reader_notes` (displayed in History, never written), `readings.reading_length`,
  `readings.pdf_url`, `readings.energy_cleansing_notes` (always null), `orders.internal_notes`
- `clients.total_spent` (displayed, never updated), `clients.birthday` and `relationship_context` (no input)
- `readings.final_approved` (written, never read)
- `future-section.ts` `_now` parameter
- `app/globals.css` `.scrollbar-thin`, `.text-balance`
- `content/guide.html` (unrelated to the app, per PROJECT_STATUS)

### Partial / broken
- Clients → "New reading" prefill (params ignored)
- Clients → reading "View" (History ignores `readingId`)
- Client profile private-notes list and trash-confirm state (not reset per client)
- Orders "Extend link" and expiry badge (array embed; inferred)
- Orders "Mark sent" (no `sent_at`, no `final_approved`)
- Reopen restore: follow-up, future timeframe, textless extra question, voice-note media all lost; DB add-on rows deleted on next Regenerate
- Reopen via `?orderId=` loads trashed readings
- Save Draft only after generation; doesn't persist 4 of 5 add-on rows
- Clear form / Start fresh disable auto-price
- Oracle Card with blank name (charged, no prompt, audit fails)
- Include future energy on Mini without timeframe (ignored)
- Due-date hint claims Stripe auto-fill (never happens)
- Daily message: soft-deleted date can't be regenerated; Skip destroys the trashed row; Un-skip leaves a stub; "Last 7 days" is really "latest 7 rows"; editing on the today page un-approves locally only
- Trash "permanently deleted after 30 days" (no purge)
- Sidebar trash badge (excludes daily messages; not refreshed by most actions)
- Generic webhook add-ons (no rows; `"false"` → true); all webhook orders labelled `source: 'stripe'`; no Stripe idempotency
- Settings AI model display reads the wrong env var
- Settings / Templates / Mark Ready / Clear test data report success without checking errors

### Scoped more broadly than the label implies
- **Test Mode toggle:** global, DB-backed; flips `is_test` on *existing* orders and readings you touch.
- **Clear all test data:** includes Trash and records re-flagged by the above; orphans client links.
- **Calendar "Delete all pending":** every future month plus skipped markers, not just the visible month's drafts.
- **Calendar "Delete all including approved":** every date from today onward (the confirm text does say so).
- **Tier change:** silently replaces a manually chosen tone preset.
- **History trash icon:** also resets the linked order to `pending`.
- **Regenerate:** resets order status to `awaiting_review` (even from `sent`/`archived`) and resets `final_approved`.
- **Phone field:** overwrites the stored phone on an existing client.
- **Templates:** edits apply to every *future* reading, but only for the one `is_default` template.

### Scoped more narrowly than the label implies
- **"Returning client":** no data pulled; one sentence; only persisted when creating a new client.
- **Calendar "Approve all pending":** only the displayed month.
- **Client trash:** doesn't trash that client's orders or readings.
- **Order trash:** doesn't trash its readings.

### DB reads/writes whose scope isn't obvious from the UI
| Action | Table / fields | Match |
|---|---|---|
| Client name autocomplete | `clients` id/name/email/phone | Global `ilike full_name`, incl. trashed + test |
| Generate / Save Draft client match | `clients` | Global exact `email`, incl. trashed + test |
| Webhook client match → `is_returning = true` | `clients` | Global exact `email`, incl. trashed + test |
| Client profile reading history | `readings` | By `client_id`, incl. trashed + test |
| Clients list note icons | `client_notes.client_id` | Every note in the table |
| Dashboard KPIs / revenue | `orders` | Global, incl. test |
| Sidebar trash count | `clients`/`orders`/`readings` | Global, last 30 days, excl. daily messages |
| Clear test data | `readings`/`orders`/`clients` | Global `is_test = true`, incl. trashed |
| Delete-batch | `daily_messages` | Global `message_date >= today` |
| Reopen by order | `readings` | Newest by `order_id`, incl. trashed |

---

## 18. Needs a manual check

1. **Live schema:** does `readings.future_timeframe` exist? Are the audit columns applied? Is
   `readings.order_id` UNIQUE (it decides whether Orders "Extend link" can ever render)?
2. **Supabase Storage:** does the `reading-media` bucket exist with the policies described in
   `add_media_fields.sql`?
3. **Supabase Auth:** how many users exist? RLS gives every one of them full access.
4. **pg_cron:** is `daily-message-generate` scheduled and succeeding (`cron.job`,
   `cron.job_run_details`, `net._http_response`)? Is there any purge job for Trash?
5. **`reading_templates`:** how many rows, and which is `is_default`? **`tone_presets`:** which
   `prompt_text` is live?
6. **`app_settings`:** does exactly one row exist? (Several queries use `.limit(1).single()`.)
7. **Returning-client output:** generate a reading with the toggle on and check whether the model
   invents references to past readings.
8. **Timezones:** `due_at` round-trip during BST; the Dashboard "today" and "this week" boundaries on
   UTC servers.
9. **Delivery links:** WhatsApp with UK `07…` numbers and long readings; `mailto:` body length limits
   in the reader's mail client.
10. **Clients page:** confirm the stale private-notes list and trash-confirm carry-over in a browser.
11. **Generate next 30 days:** does it finish within the Vercel function timeout?
12. **Gmail OAuth:** does it work with the README's "Desktop application" client type?
13. **Stripe:** what does the Checkout metadata actually send? Is the webhook subscribed only to
   `checkout.session.completed`?
14. **Celtic Cross at £10 written** (the same as Mini): intended?
