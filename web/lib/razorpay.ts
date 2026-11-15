/**
 * Razorpay Checkout (checkout.js) loader and a promise wrapper around it.
 * The key id comes from the backend's create-order response, so the website
 * needs no Razorpay setting of its own, and the key secret never reaches the
 * browser.
 */

export interface RazorpayPaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: RazorpayFailure) => void): void;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayPaymentResult) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export class CheckoutDismissed extends Error {
  constructor() {
    super("Payment cancelled.");
  }
}

/** Opens the payment window. Resolves with Razorpay's signed result after a
 * successful payment; rejects with CheckoutDismissed if the window is closed,
 * or an Error carrying Razorpay's message if the payment fails. */
export async function openCheckout(opts: {
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  contact?: string;
}): Promise<RazorpayPaymentResult> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("The payment window is not available.");

  return new Promise<RazorpayPaymentResult>((resolve, reject) => {
    const checkout = new Razorpay({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountMinor,
      currency: opts.currency,
      name: "Uniscope",
      description: opts.description,
      prefill: opts.contact ? { contact: opts.contact } : undefined,
      theme: { color: "#2148c9" },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new CheckoutDismissed()) },
    });
    checkout.on("payment.failed", (response) =>
      reject(new Error(response.error?.description ?? "The payment failed. You were not charged.")),
    );
    checkout.open();
  });
}
