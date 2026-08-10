// ai-suggest-quote-items: given a job's description + inspection findings
// (items marked "attention"/"replace") and this shop's OWN inventory
// catalog, asks an AI model which inventory items (and roughly how many)
// a mechanic would likely need to complete the repair -- a starting point
// for building a quotation/invoice in POS (src/views/pos.js), never a
// final bill on its own. The mechanic still reviews, adjusts quantities,
// and adds/removes items by hand exactly as before; this only pre-fills.
//
// Uses Google's Gemini API as the primary model, with Groq as an optional
// fallback -- same reasoning as ai-suggest-checklist/ai-assistant (both
// have real free tiers, no credit card, no subscription):
//   https://ai.google.dev/gemini-api/docs/pricing
//   https://console.groq.com/docs/rate-limits
//
// DEPLOY (same process as the other functions here -- see
// supabase/functions/README.md): Dashboard -> Edge Functions -> Deploy a
// new function -> name it exactly `ai-suggest-quote-items` -> paste this
// file's contents.
//
// SECRETS (Dashboard -> Edge Functions -> Manage secrets):
//   GEMINI_API_KEY -- free, from https://aistudio.google.com/apikey
//   GROQ_API_KEY   -- optional fallback, free, from https://console.groq.com/keys
// Same two keys already used by ai-suggest-checklist/ai-assistant -- if
// those are already configured, this function works immediately with no
// extra setup. SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
// are all provided automatically to every Edge Function.
//
// Until at least one of GEMINI_API_KEY/GROQ_API_KEY is set, this returns
// { error: "not_configured" } (200, not 500) so the client can fall back
// to just hiding the button instead of showing a broken one.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Supabase's gateway does NOT add CORS headers on its own -- see the same
// header comment/fix already in ai-assistant/ai-suggest-checklist/
// create-toyyibpay-bill. Every response here (including the OPTIONS
// preflight) must carry these.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Caps how many of the shop's own inventory items get sent to the model
// per call -- an unbounded catalog would bloat the prompt (cost + latency)
// for no benefit past a point. Matches the same kind of cap this codebase
// already applies to other unbounded lists sent to a render/request (see
// POS_CUSTOMER_OPTIONS_CAP in src/views/pos.js).
const MAX_INVENTORY_ITEMS = 400;
const MAX_FINDINGS = 20;

function langInstruction(lang: unknown): string {
  return lang === "en"
    ? "Reply in English."
    : "Reply in Bahasa Malaysia (everyday spoken register used in Malaysian workshops, not overly formal).";
}

function buildPrompt(
  safeModel: string,
  safeDescription: string,
  findings: { item: string; status: string }[],
  inventory: { id: string; name: string }[],
  lang: unknown,
): string {
  const findingsText = findings.length
    ? findings.map((f) => `- ${f.item}: ${f.status === "replace" ? "needs replacement" : "needs attention"}`).join("\n")
    : "(no inspection findings recorded)";
  const inventoryText = inventory.map((i) => `${i.id} | ${i.name}`).join("\n");
  return (
    `You are helping a car workshop in Malaysia prepare a quotation for a ` +
    `repair job. Vehicle: ${safeModel || "unknown model"}. Customer's ` +
    `reported problem: "${safeDescription || "(none given)"}".\n\n` +
    `Inspection findings so far:\n${findingsText}\n\n` +
    `Below is this shop's OWN inventory catalog, one item per line as ` +
    `"id | name". Suggest which of these EXACT items (by id, copied ` +
    `exactly) a mechanic would likely need to complete this repair, and a ` +
    `reasonable quantity for each (usually 1, occasionally 2-4 for things ` +
    `like brake pads sold individually) -- choose ONLY items that exist ` +
    `in this list below, max 8 items, most relevant first. If nothing in ` +
    `the catalog is clearly relevant, return an empty list rather than ` +
    `guessing:\n${inventoryText}\n\n` +
    `${langInstruction(lang)} Respond as a JSON object with exactly one ` +
    `key "items": an array of objects, each with "id" (string, copied ` +
    `exactly from the list above), "qty" (integer 1-20), and "reason" ` +
    `(short phrase, plain text, no markdown). No text outside the JSON object.`
  );
}

async function callGemini(prompt: string): Promise<Response> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  qty: { type: "INTEGER" },
                  reason: { type: "STRING" },
                },
                required: ["id", "qty"],
              },
            },
          },
          required: ["items"],
        },
      },
    }),
  };
  const res = await fetch(url, init);
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 500));
    return await fetch(url, init);
  }
  return res;
}

async function callGroq(prompt: string): Promise<Response> {
  return await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!GEMINI_API_KEY && !GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  try {
    // Same staff-only verification as every other AI Edge Function here --
    // this costs a real (free-tier, rate-limited) API call per use, so an
    // anonymous kiosk visitor or a customer-portal account shouldn't be
    // able to trigger it.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }
    const { data: staffRow } = await callerClient.from("staff").select("id")
      .eq("user_id", user.id).maybeSingle();
    if (!staffRow) {
      return new Response(JSON.stringify({ error: "staff_only" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const body = await req.json();
    const safeDescription = String(body?.description ?? "").slice(0, 1000).trim();
    const safeModel = String(body?.vehicleModel ?? "").slice(0, 100).trim();
    const lang = body?.lang;

    const findings = Array.isArray(body?.findings)
      ? body.findings
        .filter((f: any) => f && typeof f.item === "string" && typeof f.status === "string")
        .slice(0, MAX_FINDINGS)
        .map((f: any) => ({ item: String(f.item).slice(0, 100), status: String(f.status).slice(0, 20) }))
      : [];

    const inventoryIn = Array.isArray(body?.inventory) ? body.inventory : [];
    // The only defense-in-depth that matters here: cap size and coerce
    // shape before it reaches the prompt. Which items actually exist is
    // re-verified below against this SAME list after the model replies --
    // never trusted from the model's own output.
    const inventory = inventoryIn
      .filter((i: any) => i && typeof i.id === "string" && typeof i.name === "string")
      .slice(0, MAX_INVENTORY_ITEMS)
      .map((i: any) => ({ id: String(i.id), name: String(i.name).slice(0, 150) }));

    if (!safeDescription && findings.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }
    if (inventory.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const prompt = buildPrompt(safeModel, safeDescription, findings, inventory, lang);
    const inventoryById = new Map(inventory.map((i) => [i.id, i]));

    let raw: string | null = null;
    let lastError: { error: string; detail?: string } | null = null;

    if (GEMINI_API_KEY) {
      const geminiRes = await callGemini(prompt);
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) raw = text;
        else lastError = { error: "ai_bad_response" };
      } else {
        lastError = geminiRes.status === 429
          ? { error: "rate_limited" }
          : { error: "ai_error", detail: await geminiRes.text() };
      }
    }

    if (!raw && GROQ_API_KEY) {
      const groqRes = await callGroq(prompt);
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData?.choices?.[0]?.message?.content;
        if (text) {
          raw = text;
          lastError = null;
        } else {
          lastError = { error: "ai_bad_response" };
        }
      } else {
        lastError = groqRes.status === 429
          ? { error: "rate_limited" }
          : { error: "ai_error", detail: await groqRes.text() };
      }
    }

    if (!raw) {
      return new Response(JSON.stringify(lastError ?? { error: "ai_error" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "ai_bad_response" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // Never trust the model to only reference real ids or sane quantities
    // -- filter to this shop's actual inventory (by id) and re-attach the
    // real name from OUR OWN data, not whatever the model echoed back.
    const items = Array.isArray(parsed.items)
      ? parsed.items
        .filter((it: any) => it && typeof it.id === "string" && inventoryById.has(it.id))
        .slice(0, 8)
        .map((it: any) => {
          const inv = inventoryById.get(it.id)!;
          const qty = Math.min(20, Math.max(1, Math.round(Number(it.qty) || 1)));
          return {
            id: inv.id,
            name: inv.name,
            qty,
            reason: typeof it.reason === "string" ? it.reason.slice(0, 200) : "",
          };
        })
      : [];

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
