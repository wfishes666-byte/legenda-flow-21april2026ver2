// Edge function: admin generates a password recovery link for a user.
// Only callable by admin/management.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Identify caller using their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify caller role: admin or management
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) => r.role === "admin" || r.role === "management");
    if (!allowed) {
      return json({ error: "Forbidden: admin/management only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { request_id, email, redirect_to } = body || {};
    if (!request_id || !email) {
      return json({ error: "request_id and email required" }, 400);
    }

    // Generate a Supabase password recovery link via admin API
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect_to || undefined },
    });
    if (linkErr || !linkData) {
      return json({ error: linkErr?.message || "Failed to generate link" }, 500);
    }

    const action_link = (linkData as any).properties?.action_link || (linkData as any).action_link;
    if (!action_link) return json({ error: "No action_link returned" }, 500);

    // Recovery links typically valid 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: upErr } = await admin
      .from("password_reset_requests")
      .update({
        status: "link_generated",
        reset_link: action_link,
        link_expires_at: expiresAt,
        handled_by: userData.user.id,
        handled_at: new Date().toISOString(),
      })
      .eq("id", request_id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ reset_link: action_link, expires_at: expiresAt });
  } catch (e: any) {
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
