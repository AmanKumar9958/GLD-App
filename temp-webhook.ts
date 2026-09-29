// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

// Ambient declaration for IDE environments where Deno language server is not loaded
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  serve(options: any, handler: (req: Request) => Response | Promise<Response>): void;
};

const CASHFREE_SECRET =
  Deno.env.get("CASHFREE_SECRET_KEY") ||
  Deno.env.get("CASHFREE_SECRET") ||
  "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Ensure server configuration is valid
  if (!CASHFREE_SECRET) {
    console.error("Critical: CASHFREE_SECRET_KEY or CASHFREE_SECRET is not configured.");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  // ─── 1. Verify Cashfree webhook headers ──────────────────────────────────
  const timestamp = req.headers.get("x-webhook-timestamp");
  const receivedSig = req.headers.get("x-webhook-signature");

  if (!timestamp || !receivedSig) {
    console.error("Webhook rejected: missing x-webhook-signature or x-webhook-timestamp");
    return new Response(JSON.stringify({ error: "Missing required signature headers" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── 2. Guard against Replay Attacks (Timestamp Validation) ──────────────
  const timestampNum = Number(timestamp);
  if (!Number.isFinite(timestampNum) || timestampNum <= 0) {
    console.error("Webhook rejected: invalid timestamp format", timestamp);
    return new Response(JSON.stringify({ error: "Invalid timestamp header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Normalize milliseconds (13 digits) vs seconds (10 digits)
  const webhookTimeMs = timestampNum > 1e11 ? timestampNum : timestampNum * 1000;
  const now = Date.now();
  const MAX_ALLOWED_DRIFT_MS = 10 * 60 * 1000; // 10 minutes tolerance

  if (Math.abs(now - webhookTimeMs) > MAX_ALLOWED_DRIFT_MS) {
    console.error(`Webhook rejected: timestamp expired. Timestamp: ${timestampNum}, Now: ${now}`);
    return new Response(JSON.stringify({ error: "Webhook request expired" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── 3. Constant-Time Signature Verification ─────────────────────────────
  const signedPayload = timestamp + rawBody;
  const expectedSig = createHmac("sha256", CASHFREE_SECRET)
    .update(signedPayload)
    .digest("base64");

  const expectedBuf = Buffer.from(expectedSig, "utf-8");
  const receivedBuf = Buffer.from(receivedSig, "utf-8");

  if (
    expectedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    console.error("Webhook rejected: signature mismatch");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── 4. Parse event payload ───────────────────────────────────────────────
  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error("Webhook rejected: invalid JSON body", err);
    return new Response(JSON.stringify({ error: "Bad Request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = event.type as string;
  const data = (event.data || {}) as Record<string, any>;
  const orderData = (data.order || {}) as Record<string, any>;
  const paymentData = (data.payment || {}) as Record<string, any>;
  const orderId = (orderData.order_id || paymentData.order_id) as string;

  if (!orderId) {
    console.warn("Webhook missing order_id in event payload", event);
    return new Response(JSON.stringify({ message: "Ignored: Missing order_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`Webhook authenticated: ${eventType} for order ${orderId}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ─── 5. Handle PAYMENT_SUCCESS_WEBHOOK ───────────────────────────────────
  if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
    // 5a. Retrieve order from database
    const { data: existingPayment, error: fetchErr } = await supabase
      .from("payments")
      .select("id, user_id, course_id, amount, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`Database error fetching order ${orderId}:`, fetchErr);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!existingPayment) {
      console.error(`Payment record not found for order ${orderId}`);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5b. Idempotency: If already marked as paid, return 200 without duplicate work
    if (existingPayment.status === "paid") {
      console.log(`Order ${orderId} already marked as paid. Acknowledging webhook.`);
      return new Response(JSON.stringify({ message: "Already processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5c. Defense in depth: Verify paid amount if provided
    const webhookAmount = Number(orderData.order_amount ?? paymentData.payment_amount);
    if (
      webhookAmount &&
      existingPayment.amount &&
      webhookAmount < Number(existingPayment.amount)
    ) {
      console.error(
        `Payment amount mismatch for order ${orderId}: expected at least ${existingPayment.amount}, received ${webhookAmount}`
      );
      return new Response(JSON.stringify({ error: "Payment amount mismatch" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5d. Update payment status to paid
    const { error: payErr } = await supabase
      .from("payments")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (payErr) {
      console.error(`Failed to update payment status for order ${orderId}:`, payErr);
      return new Response(JSON.stringify({ error: "Internal Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5e. Enroll user in the course (upsert prevents race duplicate inserts)
    const { error: enrollErr } = await supabase.from("user_courses").upsert(
      {
        user_id: existingPayment.user_id,
        course_id: existingPayment.course_id,
        progress: 0,
        state: "ongoing",
      },
      { onConflict: "user_id,course_id" }
    );

    if (enrollErr) {
      console.error(`Failed to enroll user ${existingPayment.user_id} in course ${existingPayment.course_id}:`, enrollErr);
      return new Response(JSON.stringify({ error: "Internal Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`User ${existingPayment.user_id} successfully enrolled in course ${existingPayment.course_id}`);
    return new Response(JSON.stringify({ message: "Payment processed and user enrolled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── 6. Handle PAYMENT_FAILED / USER_DROPPED ─────────────────────────────
  if (
    eventType === "PAYMENT_FAILED_WEBHOOK" ||
    eventType === "PAYMENT_USER_DROPPED_WEBHOOK"
  ) {
    const { error: updateErr } = await supabase
      .from("payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (updateErr) {
      console.error(`Failed to mark payment as failed for order ${orderId}:`, updateErr);
    } else {
      console.log(`Payment marked as failed for order ${orderId} (${eventType})`);
    }

    return new Response(JSON.stringify({ message: "Failure acknowledged" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── 7. Acknowledge any other events ─────────────────────────────────────
  console.log(`Unhandled webhook event type: ${eventType}`);
  return new Response(JSON.stringify({ message: "Event ignored" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
