import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CASHFREE_APP_ID  = Deno.env.get("CASHFREE_APP_ID") || Deno.env.get("EXPO_PUBLIC_CASHFREE_APP_ID") || "TEST110557079396652921cdb5c865e970755011";
const CASHFREE_SECRET  = Deno.env.get("CASHFREE_SECRET_KEY") || Deno.env.get("CASHFREE_SECRET") || "";
const CASHFREE_BASE    = "https://sandbox.cashfree.com/pg";
const CASHFREE_VERSION = "2023-08-01";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET) {
      return error(500, `Missing Cashfree credentials. AppID set: ${!!CASHFREE_APP_ID}, Secret set: ${!!CASHFREE_SECRET}`);
    }

    // ─── 1. Verify caller JWT ───────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return error(401, "Missing Authorization header");

    // Use anon key client to verify the JWT token
    const supabaseAnon = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
    if (authErr || !user) return error(401, "Unauthorized");

    // ─── 2. Parse body ──────────────────────────────────────────────────────
    const { courseId } = await req.json() as { courseId: string };
    if (!courseId) return error(400, "courseId is required");

    // ─── 3. Service-role client (bypasses RLS) ──────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // ─── 4. Fetch course price ───────────────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title, price")
      .eq("id", courseId)
      .single();
    if (courseErr || !course) return error(404, "Course not found");
    if (course.price <= 0) return error(400, "This course is free — no payment needed");

    // ─── 5. Check if already enrolled ───────────────────────────────────────
    const { data: existingEnrollment } = await supabase
      .from("user_courses")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingEnrollment) return error(409, "Already enrolled in this course");

    // ─── 6. Fetch user profile (name, email, phone) ──────────────────────────
    const { data: profile } = await supabase
      .from("users")
      .select("name, email, phone")
      .eq("id", user.id)
      .single();

    const customerPhone = profile?.phone || "9999999999";
    const customerEmail = profile?.email || user.email || "student@example.com";
    const customerName  = profile?.name  || "Student";

    // ─── 7. Generate unique order ID ─────────────────────────────────────────
    const orderId = `GLD_${user.id.replace(/-/g, "").substring(0, 8)}_${Date.now()}`;

    // ─── 8. Call Cashfree Orders API ─────────────────────────────────────────
    const cfBody = {
      order_id:         orderId,
      order_amount:     Number(course.price),
      order_currency:   "INR",
      order_note:       `GLD Institute - ${course.title.substring(0, 30)}`,
      customer_details: {
        customer_id:    user.id,
        customer_name:  customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `https://ymcqghbvduarllnybrnr.supabase.co/functions/v1/cashfree-webhook?order_id={order_id}`,
        notify_url: `https://ymcqghbvduarllnybrnr.supabase.co/functions/v1/cashfree-webhook`,
      },
    };

    const cfRes = await fetch(`${CASHFREE_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-api-version": CASHFREE_VERSION,
        "x-client-id":   CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
      },
      body: JSON.stringify(cfBody),
    });

    const cfData = await cfRes.json();
    if (!cfRes.ok) {
      console.error("Cashfree error:", cfData);
      return error(502, cfData?.message || "Failed to create Cashfree order");
    }

    // ─── 9. Persist pending payment record ───────────────────────────────────
    const { error: insertErr } = await supabase.from("payments").insert({
      user_id:            user.id,
      course_id:          courseId,
      order_id:           orderId,
      payment_session_id: cfData.payment_session_id,
      amount:             course.price,
      status:             "pending",
    });
    if (insertErr) {
      console.error("Failed to insert payment record:", insertErr);
      // Non-fatal — still return session to the app
    }

    // ─── 10. Return to app ───────────────────────────────────────────────────
    return json({
      orderId:          orderId,
      paymentSessionId: cfData.payment_session_id,
      amount:           course.price,
      courseTitle:      course.title,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return error(500, "Internal server error");
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}
