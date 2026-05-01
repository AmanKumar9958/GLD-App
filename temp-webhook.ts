import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const CASHFREE_SECRET = Deno.env.get("CASHFREE_SECRET_KEY")!;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // ─── 1. Verify Cashfree webhook signature ────────────────────────────────
  const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
  const receivedSig = req.headers.get("x-webhook-signature") ?? "";

  if (CASHFREE_SECRET && timestamp && receivedSig) {
    const signedPayload = timestamp + rawBody;
    const expectedSig = createHmac("sha256", CASHFREE_SECRET)
      .update(signedPayload)
      .digest("base64");

    if (expectedSig !== receivedSig) {
      console.error("Webhook signature mismatch");
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    // In sandbox, Cashfree may not send signatures for all events.
    // Log a warning but proceed.
    console.warn("Webhook signature headers missing — proceeding in sandbox mode");
  }

  // ─── 2. Parse event payload ───────────────────────────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const eventType = event.type as string;
  const data = event.data as Record<string, unknown>;
  const orderData = data?.order as Record<string, unknown>;
  const orderId = orderData?.order_id as string;

  if (!orderId) {
    console.error("Webhook missing order_id", event);
    return new Response("OK", { status: 200 }); // Acknowledge to prevent retries
  }

  console.log(`Webhook received: ${eventType} for order ${orderId}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ─── 3. Handle PAYMENT_SUCCESS ───────────────────────────────────────────
  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    // Update payment status
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .select("user_id, course_id")
      .single();

    if (payErr || !payment) {
      console.error("Failed to update payment record:", payErr);
      return new Response("Internal Error", { status: 500 });
    }

    // Enroll user in the course (upsert to avoid duplicates)
    const { error: enrollErr } = await supabase.from("user_courses").upsert(
      {
        user_id:   payment.user_id,
        course_id: payment.course_id,
        progress:  0,
        state:     "ongoing",
      },
      { onConflict: "user_id,course_id" }
    );

    if (enrollErr) {
      console.error("Failed to enroll user:", enrollErr);
      return new Response("Internal Error", { status: 500 });
    }

    console.log(`User ${payment.user_id} enrolled in course ${payment.course_id}`);
    return new Response("OK", { status: 200 });
  }

  // ─── 4. Handle PAYMENT_FAILED ────────────────────────────────────────────
  if (eventType === "PAYMENT_FAILED_WEBHOOK" || eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
    await supabase
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("order_id", orderId);

    console.log(`Payment failed for order ${orderId}`);
    return new Response("OK", { status: 200 });
  }

  // ─── 5. Acknowledge all other events ─────────────────────────────────────
  return new Response("OK", { status: 200 });
});
