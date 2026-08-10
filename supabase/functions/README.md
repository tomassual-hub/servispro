# Edge Functions

Real Web Push for support chat (see `src/push-notifications.js`) needs one
Edge Function actually running on Supabase's infrastructure -- something
outside this repo's usual "paste SQL into the dashboard" setup, since Edge
Functions are Deno code, deployed separately from the database.

## notify-support-message

Sends a push notification when a new row lands in `support_messages`
(triggered by `notify_new_support_message` in `backend/schema.sql`, via
`pg_net`).

### Deploy

Either:
```
supabase functions deploy notify-support-message
```
(needs the [Supabase CLI](https://supabase.com/docs/guides/cli), logged in
and linked to the project: `supabase link --project-ref <project-ref>`), or
with no CLI at all: Dashboard → Edge Functions → "Deploy a new function" →
name it exactly `notify-support-message` → paste the contents of
`notify-support-message/index.ts`.

### Secrets

Dashboard → Edge Functions → Manage secrets (or `supabase secrets set
NAME=value`):

| Secret | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | Same value as `PUSH_VAPID_PUBLIC_KEY` in `src/push-notifications.js` |
| `VAPID_PRIVATE_KEY` | The matching private half from `npx web-push generate-vapid-keys` — **never** put this in client-side code |
| `VAPID_SUBJECT` | A `mailto:` or `https:` URL identifying the sender, e.g. `mailto:you@example.com` — required by the Web Push spec |
| `EDGE_FUNCTION_SECRET` | A long random string (e.g. `openssl rand -hex 32`) — must match `edge_function_config.edge_function_secret` below exactly. Proves a call really came from this project's own trigger; the anon key alone doesn't (it's intentionally public) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to
every Edge Function — nothing to set for those.

### Point the trigger at it

Once deployed, run this once in the SQL Editor (fill in the real values —
`edge_function_secret` must be the SAME string as `EDGE_FUNCTION_SECRET`
above). Note this is a table update, not `alter database ... set` -- that
needs superuser, which the SQL Editor's role doesn't have on a managed
Supabase project (`edge_function_config` exists specifically to avoid
needing it):
```sql
update edge_function_config set
  edge_function_url = 'https://<project-ref>.functions.supabase.co/notify-support-message',
  edge_function_anon_key = '<this project''s anon key>',
  edge_function_secret = '<the same random string as EDGE_FUNCTION_SECRET>'
where id = 'singleton';
```
`<project-ref>` is the subdomain in the project's URL (e.g.
`knvevgtoigcteqdinyvk` for `https://knvevgtoigcteqdinyvk.supabase.co`).

Until that's run, `notify_new_support_message` silently no-ops (see its
comment in `backend/schema.sql`) — support chat itself keeps working fine
either way, it just won't push a notification yet.

## create-toyyibpay-bill + toyyibpay-webhook

Real payment for a plan upgrade (see `upgradePlanReal()` in
`src/license.js`). `create-toyyibpay-bill` starts a ToyyibPay bill and
returns a payment URL to redirect to; `toyyibpay-webhook` is what ToyyibPay
calls back once the customer actually pays, and is the ONLY place a
license gets upgraded from a real payment (never from
`create-toyyibpay-bill` directly).

**⚠️ Built from ToyyibPay's publicly documented API, not yet tested
against a real account** (none existed when this was written) — see the
header comment in each file for exactly what to re-verify. Test against a
[ToyyibPay sandbox account](https://dev.toyyibpay.com) end to end before
trusting this with real money.

### Deploy

Same as `notify-support-message` above — Dashboard → Edge Functions →
Deploy a new function → name it exactly `create-toyyibpay-bill` (paste
`create-toyyibpay-bill/index.ts`) and separately `toyyibpay-webhook` (paste
`toyyibpay-webhook/index.ts`).

### Secrets (on `create-toyyibpay-bill` only)

| Secret | Value |
|---|---|
| `TOYYIBPAY_SECRET_KEY` | From your ToyyibPay account settings |
| `TOYYIBPAY_CATEGORY_CODE` | The Category you create in ToyyibPay for ServisPro subscription payments |
| `TOYYIBPAY_BASE_URL` | `https://dev.toyyibpay.com` (sandbox — test here first) or `https://toyyibpay.com` (production) |
| `PUBLIC_APP_URL` | This app's live URL, e.g. `https://tomassual-hub.github.io/servispro/ServisPro.html` |

`toyyibpay-webhook` needs no secrets of its own beyond `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` (provided automatically).

Until `TOYYIBPAY_SECRET_KEY`/`TOYYIBPAY_CATEGORY_CODE`/`TOYYIBPAY_BASE_URL`/
`PUBLIC_APP_URL` are all set, `create-toyyibpay-bill` returns
`{ error: "not_configured" }` and the plan picker's "Pay with ToyyibPay"
button doesn't even show — the existing test-mode upgrade button keeps
working regardless.

## ai-suggest-checklist

Suggests likely causes and which inspection checklist items to check first,
based on a job's description (see the "AI Suggestion" button in the
Inspection Checklist modal, `src/ai-assist.js`). A starting point for the
mechanic, never a diagnosis on its own — the checklist is still filled in
by hand exactly as before.

Uses Google's Gemini API as the primary model, with Groq as an optional
fallback if Gemini is unset or fails (including a real free-tier rate-limit
hit) — both have a real free tier (no credit card, no subscription): see
[ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
and [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits).

### Deploy

Same as the others — Dashboard → Edge Functions → Deploy a new function →
name it exactly `ai-suggest-checklist` → paste
`ai-suggest-checklist/index.ts`.

### Secrets

| Secret | Value |
|---|---|
| `GEMINI_API_KEY` | Free, from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — Google account, no billing needed for the free tier |
| `GROQ_API_KEY` | Optional fallback. Free, from [console.groq.com/keys](https://console.groq.com/keys) — no billing needed for the free tier. If unset, this function behaves exactly as before: Gemini only, no fallback attempt |

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are all
provided automatically to every Edge Function — the dashboard actively
rejects manually setting a secret with the `SUPABASE_` prefix, so don't
try. `SUPABASE_ANON_KEY` here is used only to verify the calling staff
member's own session server-side, never to bypass RLS.

Until at least one of `GEMINI_API_KEY`/`GROQ_API_KEY` is set, this returns
`{ error: "not_configured" }` and the button in the app shows "AI
suggestion isn't available right now" instead of a suggestion — nothing
else about the checklist changes.

Free-tier rate limits are real (a handful of requests per minute, capped
per day) — fine for one shop's occasional per-job lookup, not something to
call in a loop. Groq is only tried as a fallback after Gemini fails, never
in parallel — it's a safety net, not a way to double throughput.

## ai-assistant

A standalone general Q&A chat for staff (see the floating AI button,
`src/ai-assist.js`) — deliberately independent of any other feature, not
tied to a specific job the way `ai-suggest-checklist` above is. Answers
general automotive/workshop questions using the model's own knowledge; has
no access to this shop's own customers/jobs/inventory data.

Same Gemini-primary/Groq-fallback reasoning as `ai-suggest-checklist` above.

### Deploy

Same as the others — Dashboard → Edge Functions → Deploy a new function →
name it exactly `ai-assistant` → paste `ai-assistant/index.ts`.

### Secrets

| Secret | Value |
|---|---|
| `GEMINI_API_KEY` | Same key as `ai-suggest-checklist` above — free, from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | Optional fallback, same key as `ai-suggest-checklist` above if you set one there — free, from [console.groq.com/keys](https://console.groq.com/keys) |

Same auto-provided `SUPABASE_*` vars as every other function here.

Until at least one of `GEMINI_API_KEY`/`GROQ_API_KEY` is set, this returns
`{ error: "not_configured" }` and the assistant replies with a generic
"can't answer right now" message instead of a real one — the chat UI
itself still opens and works either way.

## ai-suggest-quote-items

Suggests which of this shop's OWN inventory items (and roughly how many)
a mechanic likely needs for a job, based on its description + inspection
findings (see the "AI Suggestion" button in POS once a job is linked in,
`src/ai-assist.js`/`src/views/pos.js`). A starting point for building a
quotation/invoice — the cart is still reviewed and adjusted by hand
exactly as before; this only pre-fills suggested rows.

Same Gemini-primary/Groq-fallback reasoning as `ai-suggest-checklist`
above — and the SAME `GEMINI_API_KEY`/`GROQ_API_KEY` secrets, so if those
are already set for the other AI functions, this one works immediately
with no extra setup.

### Deploy

Same as the others — Dashboard → Edge Functions → Deploy a new function →
name it exactly `ai-suggest-quote-items` → paste
`ai-suggest-quote-items/index.ts`.

### Secrets

| Secret | Value |
|---|---|
| `GEMINI_API_KEY` | Same key as the other AI functions above — free, from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | Optional fallback, same key as the other AI functions above if you set one there — free, from [console.groq.com/keys](https://console.groq.com/keys) |

Until at least one of `GEMINI_API_KEY`/`GROQ_API_KEY` is set, this returns
`{ error: "not_configured" }` and the button in POS shows "AI suggestion
isn't available right now" instead of a suggestion — nothing else about
POS changes.
