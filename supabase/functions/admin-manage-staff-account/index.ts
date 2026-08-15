// admin-manage-staff-account: lets an Admin/Pemilik directly set a staff
// member's login email and/or password -- something the client-side app
// can never do on its own, since Supabase's client SDK (running on the
// anon key) has no way to touch ANOTHER user's Auth credentials. That
// requires auth.admin.* calls, which only work with the service-role key,
// which must never reach the browser. This function is the one place that
// key gets used, and only after independently verifying the caller is
// really an Admin/Pemilik of THIS shop first.
//
// Two cases, both driven by the same "Login Email" field + a password
// field on the staff modal (src/views/staff.js):
//   - staff.user_id already set (linked to a real auth.users row):
//     updates that user's email and/or password directly, no email
//     confirmation step, effective immediately.
//   - staff.user_id is null (never signed up): creates the Auth user
//     outright (email_confirm:true, so no confirmation email needed) and
//     links it by setting staff.user_id -- the staff member can log in
//     immediately with the credentials the Admin just set, instead of
//     waiting for them to self-signup with "New staff? Create an account".
//
// DEPLOY (same process as the other functions here -- see
// supabase/functions/README.md): Dashboard -> Edge Functions -> Deploy a
// new function -> name it exactly `admin-manage-staff-account` -> paste
// this file's contents.
//
// No secrets to set beyond what's auto-provided to every Edge Function
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY) -- unlike
// the AI functions, this one has no "not_configured" state; it works as
// soon as it's deployed.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Supabase's gateway does NOT add CORS headers on its own -- see the same
// header comment/fix already in every other Edge Function here.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Verify the CALLER is really an Admin/Pemilik of this shop, using
    // their own JWT (never the service-role key) so this lookup runs
    // under their real RLS-scoped session -- same trust boundary as every
    // other Edge Function here, and the same is_admin() definition as
    // backend/schema.sql, just re-checked here since that SQL function
    // isn't reachable from Deno.
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
    const { data: callerStaff } = await callerClient.from("staff")
      .select("data").eq("user_id", user.id).maybeSingle();
    const callerRole = callerStaff?.data?.role;
    if (callerRole !== "Admin" && callerRole !== "Pemilik") {
      return new Response(JSON.stringify({ error: "owner_only" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const body = await req.json();
    const staffId = String(body?.staffId ?? "").trim();
    // Empty string means "leave unchanged" for both -- distinguished from
    // undefined/null the same way, so the client can send just a password
    // (keep the email as-is) or just an email (keep the password as-is).
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!staffId) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // Everything from here on uses the service-role key -- bypasses RLS
    // entirely, which is exactly why the is_admin()-equivalent check above
    // has to happen first, against the CALLER's own session, not this one.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: targetStaff } = await adminClient.from("staff")
      .select("id,user_id,data").eq("id", staffId).maybeSingle();
    if (!targetStaff) {
      return new Response(JSON.stringify({ error: "staff_not_found" }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    if (targetStaff.user_id) {
      // Already linked -- update whichever of email/password was actually
      // provided. email_confirm:true skips Supabase's own re-verification
      // email for the changed address, since an Admin setting this
      // directly IS the verification.
      const updates: Record<string, unknown> = {};
      if (email) { updates.email = email; updates.email_confirm = true; }
      if (password) updates.password = password;
      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "nothing_to_update" }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      }
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(
        targetStaff.user_id,
        updates,
      );
      if (updateErr) {
        return new Response(
          JSON.stringify({ error: "auth_error", detail: updateErr.message }),
          { status: 200, headers: JSON_HEADERS },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, userId: targetStaff.user_id }),
        { status: 200, headers: JSON_HEADERS },
      );
    }

    // Not linked yet -- create the Auth user outright and link it, rather
    // than waiting for the staff member to self-signup. Both fields are
    // required here (there's no existing account to partially update).
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email_and_password_required" }),
        { status: 200, headers: JSON_HEADERS },
      );
    }
    const { data: created, error: createErr } = await adminClient.auth.admin
      .createUser({ email, password, email_confirm: true });
    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({
          error: "auth_error",
          detail: createErr?.message ?? "createUser returned no user",
        }),
        { status: 200, headers: JSON_HEADERS },
      );
    }
    const { error: linkErr } = await adminClient.from("staff")
      .update({ user_id: created.user.id }).eq("id", staffId);
    if (linkErr) {
      // The Auth user now exists but isn't linked -- surface this
      // distinctly rather than as a generic auth_error, since the fix is
      // different (retry linking, not retry account creation) and
      // creating a second Auth user for the same staff row would be wrong.
      return new Response(
        JSON.stringify({ error: "created_but_link_failed", detail: linkErr.message }),
        { status: 200, headers: JSON_HEADERS },
      );
    }
    return new Response(
      JSON.stringify({ ok: true, userId: created.user.id }),
      { status: 200, headers: JSON_HEADERS },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
