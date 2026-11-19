"use client";

type ConfirmedBookingAppointment = {
  id: string;
  appointmentDate: string;
  timeSlot: string | null;
  tokenNumber: number | null;
  patient?: { email?: string | null };
  doctor?: { name?: string | null };
  department?: { name?: string | null };
};

type VerificationPayload = {
  success?: boolean;
  message?: string;
  data?: {
    status?: "PAID" | "PENDING" | "PROCESSING" | "FAILED" | "REQUIRES_REVIEW";
    appointment?: ConfirmedBookingAppointment;
  };
};

type VerificationResult = {
  ok: boolean;
  data: VerificationPayload;
};

const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_RETRY_DELAY_MS = 3_000;

function waitForRetry(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, VERIFICATION_RETRY_DELAY_MS));
}

export async function verifyCashfreeBooking(
  orderId: string,
  bookingContext: { hospitalId?: string; slug?: string } | string,
): Promise<VerificationResult> {
  const context = typeof bookingContext === "string"
    ? { hospitalId: bookingContext }
    : bookingContext;
  let lastResult: VerificationResult | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_VERIFICATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-order", orderId, ...context }),
      });
      const data = await response.json() as VerificationPayload;
      lastResult = { ok: response.ok, data };

      const status = data.data?.status;
      const isBeingProcessed = response.ok && data.success &&
        (status === "PENDING" || status === "PROCESSING");
      if (
        !isBeingProcessed ||
        attempt === MAX_VERIFICATION_ATTEMPTS - 1
      ) {
        return lastResult;
      }
    } catch (error) {
      lastError = error;
      if (attempt === MAX_VERIFICATION_ATTEMPTS - 1) throw error;
      await waitForRetry();
      continue;
    }

    await waitForRetry();
  }

  if (lastResult) return lastResult;
  throw lastError instanceof Error ? lastError : new Error("Unable to verify Cashfree payment");
}

export async function getBookingIdempotencyKey(
  scope: string,
  fingerprint: string,
): Promise<string> {
  const fingerprintBytes = new TextEncoder().encode(fingerprint);
  const digest = await crypto.subtle.digest("SHA-256", fingerprintBytes);
  const fingerprintHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const storageKey = `clickmyq:booking-idempotency:${scope}`;

  let stored: { fingerprintHash?: string; key?: string } | null = null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    stored = raw ? JSON.parse(raw) as { fingerprintHash?: string; key?: string } : null;
  } catch {
    stored = null;
  }

  if (
    stored?.fingerprintHash === fingerprintHash &&
    typeof stored.key === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored.key)
  ) {
    return stored.key;
  }

  const key = crypto.randomUUID();
  sessionStorage.setItem(storageKey, JSON.stringify({ fingerprintHash, key }));
  return key;
}
