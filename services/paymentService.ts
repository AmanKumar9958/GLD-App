import { CFPaymentGatewayService } from "react-native-cashfree-pg-sdk";
import {
  CFEnvironment,
  CFSession,
  CFThemeBuilder,
  CFDropCheckoutPayment,
  CFPaymentComponentBuilder,
} from "cashfree-pg-api-contract";
import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateOrderResult = {
  orderId: string;
  paymentSessionId: string;
  amount: number;
  courseTitle: string;
};

export type PaymentCallbacks = {
  onSuccess: (orderId: string) => void;
  onError: (code: string, message: string) => void;
  onExit: () => void;
};

// ─── Create Order (calls Edge Function) ──────────────────────────────────────

/**
 * Creates a Cashfree order via the `create-cashfree-order` Edge Function.
 * Requires an active Supabase session (JWT is forwarded automatically).
 */
export async function createCashfreeOrder(
  courseId: string
): Promise<CreateOrderResult> {
  // Ensure we have a valid, fresh session before calling the edge function.
  // supabase.auth.getSession() returns the cached token which may be expired;
  // calling getUser() forces a refresh if needed.
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error("Session expired — please sign in again to continue.");
  }

  const { data, error } = await supabase.functions.invoke<CreateOrderResult>(
    "create-cashfree-order",
    { body: { courseId } }
  );

  if (error) {
    let actualError = error.message;
    // Supabase wraps edge-function HTTP errors in FunctionsHttpError with a
    // `context` property containing the raw Response object.
    if (error instanceof Error && 'context' in error) {
      try {
        const response = (error as any).context as Response;
        if (response && typeof response.json === 'function') {
          const errBody = await response.json();
          if (errBody && errBody.error) {
            actualError = errBody.error;
          }
        }
      } catch (_) {
        // Fallback to original message if JSON parsing fails
      }
    }
    throw new Error(actualError || "Failed to create payment order");
  }

  if (!data) {
    throw new Error("Empty response from payment server");
  }

  return data;
}

// ─── Start Payment (Cashfree SDK) ────────────────────────────────────────────

const envValue = (process.env.EXPO_PUBLIC_CASHFREE_ENV as string)?.toUpperCase() ?? "";
const CASHFREE_ENV =
  envValue === "PRODUCTION" || envValue === "PROD"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

const CASHFREE_APP_ID = process.env.EXPO_PUBLIC_CASHFREE_APP_ID as string;

/**
 * Launches the Cashfree payment sheet.
 */
export function startCashfreePayment(
  orderId: string,
  paymentSessionId: string,
  callbacks: PaymentCallbacks
): void {
  // Build session object
  const session = new CFSession(paymentSessionId, orderId, CASHFREE_ENV);

  // Premium theme matching the GLD brand
  const theme = new CFThemeBuilder()
    .setNavigationBarBackgroundColor("#1A56DB")
    .setNavigationBarTextColor("#FFFFFF")
    .setButtonBackgroundColor("#1A56DB")
    .setButtonTextColor("#FFFFFF")
    .build();

  const paymentComponents = new CFPaymentComponentBuilder().build();
  const checkoutPayment = new CFDropCheckoutPayment(session, paymentComponents, theme);

  // Wire up global callbacks BEFORE calling doPayment
  CFPaymentGatewayService.setCallback({
    onVerify(orderId: string) {
      CFPaymentGatewayService.removeCallback();
      callbacks.onSuccess(orderId);
    },
    onError(error: { code: string; message: string }, orderId: string) {
      CFPaymentGatewayService.removeCallback();
      
      if (error.code === 'action_cancelled') {
        console.log(`Payment cancelled by user [${orderId}]`);
        callbacks.onExit();
        return;
      }

      console.error(`Cashfree error [${orderId}]:`, error);
      callbacks.onError(error.code, error.message);
    },
  });

  // Launch payment sheet
  CFPaymentGatewayService.doPayment(checkoutPayment);
}
