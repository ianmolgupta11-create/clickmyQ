"use client";

type CashfreeInstance = {
  checkout(options: { paymentSessionId: string; redirectTarget: "_self" }): Promise<CashfreeCheckoutResult>;
};

export type CashfreeCheckoutResult = {
  error?: { message?: string } | string;
  redirect?: boolean;
  paymentDetails?: unknown;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

let sdkPromise: Promise<void> | null = null;
let cashfreeInstance: CashfreeInstance | null = null;
let initializedMode: "sandbox" | "production" | null = null;

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout is only available in a browser"));
  if (window.Cashfree) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  const loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => window.Cashfree
      ? resolve()
      : reject(new Error("Cashfree Checkout did not initialize"));
    script.onerror = () => reject(new Error("Unable to load Cashfree Checkout"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    sdkPromise = null;
    throw error;
  });

  sdkPromise = loadPromise;
  return loadPromise;
}

export async function initializeCashfreeCheckout(mode: "sandbox" | "production"): Promise<void> {
  if (cashfreeInstance) {
    if (initializedMode !== mode) throw new Error("Cashfree Checkout was initialized for a different environment");
    return;
  }
  await loadCashfreeSdk();
  const cashfree = window.Cashfree?.({ mode });
  if (!cashfree) throw new Error("Cashfree Checkout is unavailable");
  cashfreeInstance = cashfree;
  initializedMode = mode;
}

export async function launchCashfreeCheckout(
  paymentSessionId: string,
  mode: "sandbox" | "production",
): Promise<CashfreeCheckoutResult> {
  if (!cashfreeInstance || initializedMode !== mode) {
    throw new Error("Cashfree Checkout has not been initialized");
  }
  return cashfreeInstance.checkout({ paymentSessionId, redirectTarget: "_self" });
}
