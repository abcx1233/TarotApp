# Reader Console

Private internal dashboard for Deep Blue Divination. Manages tarot reading orders, generates AI readings via OpenAI GPT-4o, and handles client tracking.

---

## Stack

- **Next.js 14** App Router
- **TypeScript**
- **Tailwind CSS**
- **Supabase** — auth + Postgres
- **OpenAI GPT-4o** — AI reading generation
- **Gmail API** — outbound email delivery

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `OPENAI_API_KEY` | Your OpenAI API key — get one at [platform.openai.com](https://platform.openai.com) |

Optional (add when ready):

| Variable | Description |
|---|---|
| `OPENAI_MODEL` | OpenAI model name (default: `gpt-4o`) |
| `STRIPE_WEBHOOK_SECRET` | For Stripe inbound order webhook |
| `WEBHOOK_SECRET` | For generic inbound webhook (Supabase/Zapier) |
| `GMAIL_CLIENT_ID` | Gmail OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth2 refresh token |
| `GMAIL_SENDER_ADDRESS` | Sender email address |
| `WEBSITE_SUPABASE_URL` | Public website Supabase URL (for status sync) |
| `WEBSITE_SUPABASE_SERVICE_KEY` | Public website service role key |

### 3. Set up the database

In your Supabase project, open the SQL editor and run the full contents of `supabase/schema.sql`.

This creates all tables, enables RLS, sets up triggers, and seeds the tone presets.

### 4. Create your auth user

In Supabase → Authentication → Users, create a user with your email and password. This is the only login that will work.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

1. Push to a GitHub repo
2. Connect to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

The app is Vercel-ready with no custom configuration needed.

---

## Gmail setup

To enable sending readings by email:

1. Create a Google Cloud project and enable the Gmail API
2. Create OAuth 2.0 credentials (Desktop application type)
3. Add `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` to your environment
4. Visit `GET /api/auth/gmail` in the browser (while logged in)
5. Complete the Google OAuth flow
6. Copy the refresh token shown on screen
7. Add it as `GMAIL_REFRESH_TOKEN` and redeploy

---

## Inbound webhooks

Reader Console accepts orders automatically from the public website via webhook.

### Stripe (recommended)

**Endpoint:** `POST /api/webhooks/inbound-order`

1. In Stripe Dashboard → Webhooks, add your endpoint URL
2. Select event: `checkout.session.completed`
3. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

Fields mapped from Stripe metadata:

| Stripe metadata key | Maps to |
|---|---|
| `client_name` | `clients.full_name` |
| `email` | `clients.email` |
| `star_sign` | `clients.star_sign` |
| `reading_tier` | `orders.reading_tier` |
| `format` | `orders.delivery_format` |
| `rush_24h` | `orders.is_rush` + `order_addons` |
| `oracle_card` | `order_addons` + `readings.include_oracle_card` |
| `energy_cleansing` | `order_addons` + `readings.include_energy_cleansing` |
| `question` | `readings.question_or_focus` |

### Generic webhook (Supabase DB webhook or Zapier)

Same endpoint. Set `WEBHOOK_SECRET` and send `X-Webhook-Secret: <your-secret>` header.

Body fields: `client_name`, `email`, `star_sign`, `reading_tier`, `format`, `question`, `price_total`, `order_id`, `is_rush`, `oracle_card`, `energy_cleansing`.

### Zapier email parsing

1. Set up a Zapier zap: trigger = new email, action = Webhooks by Zapier (POST)
2. URL: `https://your-domain.com/api/webhooks/inbound-order`
3. Headers: `X-Webhook-Secret: <your secret>`, `Content-Type: application/json`
4. Body: map parsed email fields to the expected keys above

---

## Status flow

Orders follow this flow — never skip steps:

```
pending → in_progress → awaiting_review → sent → archived
```

"Mark Sent" is only available after a reading has been approved (`final_approved = true`).

---

## AI reading generation

Readings are generated in three steps:
1. **Full reading** — long-form, character-targeted, tone-preset driven
2. **Email version** — adapted for email delivery with subject line
3. **WhatsApp version** — plain text, no formatting, chunked for messaging

All generation happens server-side only. `OPENAI_API_KEY` is never exposed to the browser.

Max tokens is set to `4096` to support readings up to ~12,000 characters.

---

## Project structure

```
app/               Next.js App Router pages and API routes
components/        Reusable UI and feature components
  layout/          Sidebar, TopBar, DashboardLayout
  readings/        New reading form, card entry, output panel
  orders/          Orders table and filters
  clients/         Client list and profile panel
  ui/              Design system components
data/              Tarot card dataset (78 Light Seers cards)
lib/
  supabase/        Client, server, and middleware helpers
  ai/              OpenAI client, prompt builder, generation pipeline
  gmail/           OAuth2 and send helpers
  webhooks/        Stripe parser and order creation
  integrations/    Website status sync
types/             Shared TypeScript types
supabase/          schema.sql — full database setup
```
