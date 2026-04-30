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
  const { data, error } = await supabase.functions.invoke<CreateOrderResult>(
    "create-cashfree-order",
    { body: { courseId } }
  );

  if (error) {
    let actualError = error.message;
    if (error instanceof Error && 'context' in error) {
      try {
        const response = (error as any).context as Response;
        const errBody = await response.json();
        if (errBody && errBody.error) {
          actualError = errBody.error;
        }
      } catch (e) {
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

const CASHFREE_ENV =
  (process.env.EXPO_PUBLIC_CASHFREE_ENV as string) === "PRODUCTION"
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
      console.error(`Cashfree error [${orderId}]:`, error);
      callbacks.onError(error.code, error.message);
    },
  });

  // Launch payment sheet
  CFPaymentGatewayService.doPayment(checkoutPayment);
}
