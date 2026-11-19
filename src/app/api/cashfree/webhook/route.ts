import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import prisma from "../../../../../backend/config/db";
import { CashfreeBookingError, verifyAndConfirmOnlineBooking, verifyCashfreeWebhookSignature } from "../../../../../backend/services/cashfree-booking.service";
import { errorResponse, successResponse } from "../../../../../backend/utils/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CashfreeWebhookPayload = {
  type?: unknown;
  data?: {
    order?: { order_id?: unknown };
    payment?: { cf_payment_id?: unknown };
  };
};

function getEventId(request: NextRequest, eventType: string, orderId: string, paymentId: string): string {
  const providerId = request.headers.get("x-idempotency-key");
  if (providerId && providerId.length <= 190) return providerId;
  return createHash("sha256").update(`${eventType}:${orderId}:${paymentId}`).digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return errorResponse("Webhook payload is too large", 413);

  if (!verifyCashfreeWebhookSignature(
    rawBody,
    request.headers.get("x-webhook-timestamp"),
    request.headers.get("x-webhook-signature"),
  )) {
    return errorResponse("Invalid webhook signature", 401);
  }

  let payloadValue: unknown;
  try {
    payloadValue = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid webhook payload", 400);
  }
  if (!payloadValue || typeof payloadValue !== "object" || Array.isArray(payloadValue)) {
    return errorResponse("Invalid webhook payload", 400);
  }
  const payload = payloadValue as CashfreeWebhookPayload;

  const eventType = typeof payload.type === "string" ? payload.type : "UNKNOWN";
  const isPaymentSuccessEvent = eventType === "PAYMENT_SUCCESS_WEBHOOK";
  const orderId = payload.data?.order?.order_id;
  const paymentId = payload.data?.payment?.cf_payment_id;
  const eventId = getEventId(
    request,
    eventType,
    typeof orderId === "string" ? orderId : "",
    paymentId == null ? "" : String(paymentId),
  );

  let event = await prisma.cashfreeWebhookEvent.findUnique({ where: { eventId } });
  if (event?.processed) return successResponse({ received: true }, "Webhook already processed");

  if (!event) {
    try {
      event = await prisma.cashfreeWebhookEvent.create({
        data: { eventId, eventType, payload: payloadValue as Prisma.InputJsonValue, processed: false },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      event = await prisma.cashfreeWebhookEvent.findUnique({ where: { eventId } });
    }
  }
  if (!event) return errorResponse("Unable to record webhook event", 500);
  if (event.processed) return successResponse({ received: true }, "Webhook already processed");

  if (typeof orderId === "string" && orderId.length <= 64) {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { cashfreeOrderId: orderId },
      select: { id: true },
    });
    if (transaction) {
      try {
        const result = await verifyAndConfirmOnlineBooking(orderId);
        if (result.status === "PROCESSING" && isPaymentSuccessEvent) {
          return errorResponse("Payment confirmation is still processing", 503);
        }
        if (result.status === "PENDING" && isPaymentSuccessEvent) {
          return errorResponse("Payment confirmation is pending", 503);
        }
      } catch (error) {
        if (error instanceof CashfreeBookingError && error.status === 404) {
          await prisma.cashfreeWebhookEvent.update({ where: { id: event.id }, data: { processed: true } });
          return successResponse({ received: true }, "Webhook does not match an online booking");
        }
        return errorResponse("Unable to process payment webhook", 503);
      }
    }
  }

  await prisma.cashfreeWebhookEvent.update({
    where: { id: event.id },
    data: { processed: true },
  });

  return successResponse({ received: true }, "Webhook processed");
}
