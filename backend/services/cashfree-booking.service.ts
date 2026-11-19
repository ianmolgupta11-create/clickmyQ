import { createHmac, timingSafeEqual } from "crypto";
import type { PaymentTransaction, Prisma } from "@prisma/client";
import prisma from "../config/db";
import { bookAppointment, AppointmentServiceError } from "./appointment.service";
import { generateBillFromAppointment, logRevenue } from "./billing.service";
import { notify } from "./notification.service";
import { calculateOnlineBookingAmounts } from "../../src/lib/online-booking-fee";

const CASHFREE_API_VERSION = "2026-01-01";
const PROCESSING_LEASE_MS = 60_000;

type BookingAppointment = {
  id: string;
  doctorId: string | null;
  appointmentDate: Date;
  timeSlot: string | null;
  tokenNumber: number | null;
  patient?: { email: string | null } | null;
  doctor?: { name: string } | null;
  department?: { name: string } | null;
};

type SavedBookingData = {
  appointmentId: string;
  departmentId: string | null;
  appointmentDate: string;
  timeSlot: string | null;
  confirmationEmail: string | null;
  type: "OPD" | "EMERGENCY" | "ONLINE" | "FOLLOW_UP";
  notes: string | null;
  consultationFee: number | null;
};

function getBookingConfirmationEmail(bookingData: Prisma.JsonValue): string | null {
  if (!bookingData || typeof bookingData !== "object" || Array.isArray(bookingData)) return null;
  const email = (bookingData as Prisma.JsonObject).confirmationEmail;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function includeBookingConfirmationEmail(
  appointment: BookingAppointment | null,
  transaction: PaymentTransaction,
): BookingAppointment | null {
  const email = getBookingConfirmationEmail(transaction.bookingData);
  if (!appointment || !email) return appointment;
  return {
    ...appointment,
    patient: { ...appointment.patient, email },
  };
}

export class CashfreeBookingError extends Error {
  constructor(
    message: string,
    public status: number = 502,
    public code?: string,
    public providerStatus?: number,
    public providerCode?: string,
  ) {
    super(message);
    this.name = "CashfreeBookingError";
  }
}

type CashfreeConfig = {
  appId: string;
  secretKey: string;
  mode: "sandbox" | "production";
  apiBaseUrl: string;
};

function getCashfreeEnvironment(): "sandbox" | "production" {
  const configuredMode = process.env.CASHFREE_ENV;
  if (configuredMode && configuredMode !== "sandbox" && configuredMode !== "production") {
    throw new CashfreeBookingError("CASHFREE_ENV must be sandbox or production", 503, "CASHFREE_ENV_INVALID");
  }
  return configuredMode === "production" ? "production" : "sandbox";
}

function getCashfreeConfig(): CashfreeConfig {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const mode = getCashfreeEnvironment();

  if (!appId || !secretKey) {
    throw new CashfreeBookingError("Online payments are not configured", 503, "CASHFREE_NOT_CONFIGURED");
  }

  const credentialMode = appId.startsWith("TEST")
    ? "sandbox"
    : /^\d/.test(appId)
      ? "production"
      : "unknown";
  if (credentialMode !== "unknown" && credentialMode !== mode) {
    console.warn("[Cashfree] Environment and credential formats do not match", {
      configuredMode: mode,
      credentialMode,
    });
  }

  return {
    appId,
    secretKey,
    mode,
    apiBaseUrl: mode === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg",
  };
}

export function getCashfreeMode(): "sandbox" | "production" {
  return getCashfreeEnvironment();
}

export function normalizeCashfreeCustomerPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
  return /^[6-9]\d{9}$/.test(nationalNumber) ? nationalNumber : null;
}

async function cashfreeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getCashfreeConfig();
  let response: Response;

  try {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("x-api-version", CASHFREE_API_VERSION);
    headers.set("x-client-id", config.appId);
    headers.set("x-client-secret", config.secretKey);
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers,
    });
  } catch (error) {
    const errorRecord = error && typeof error === "object"
      ? error as { name?: unknown; cause?: { code?: unknown }; message?: unknown }
      : null;
    console.error("[Cashfree] Provider request failed before receiving a response", {
      endpoint: path === "/orders" ? "create-order" : "order-operation",
      ...(typeof errorRecord?.name === "string" ? { errorType: errorRecord.name } : {}),
      ...(typeof errorRecord?.cause?.code === "string" ? { networkCode: errorRecord.cause.code } : {}),
    });
    throw new CashfreeBookingError("Unable to reach the payment provider", 502, "CASHFREE_UNREACHABLE");
  }

  if (!response.ok) {
    let providerCode: string | undefined;
    let providerMessage: string | undefined;
    try {
      const errorBody: unknown = JSON.parse(await response.text());
      if (errorBody && typeof errorBody === "object") {
        const body = errorBody as Record<string, unknown>;
        const candidate = body.code ?? body.error_code ?? body.type;
        if (typeof candidate === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(candidate)) {
          providerCode = candidate;
        }
        const message = body.message ?? body.error_description;
        if (typeof message === "string" && message.trim()) {
          providerMessage = message
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
            .replace(/\b(?:\+?\d[\d\s().-]{8,}\d)\b/g, "[redacted-number]")
            .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[redacted-id]")
            .replace(/[\r\n\t]+/g, " ")
            .slice(0, 240);
        }
      }
    } catch {
      // Provider error bodies are optional; the HTTP status is still diagnostic.
    }
    console.error("[Cashfree] Provider rejected request", {
      endpoint: path === "/orders" ? "create-order" : "order-operation",
      status: response.status,
      ...(providerCode ? { providerCode } : {}),
      ...(providerMessage ? { providerMessage } : {}),
    });
    throw new CashfreeBookingError(
      "The payment provider rejected the request",
      502,
      "CASHFREE_PROVIDER_REJECTED",
      response.status,
      providerCode,
    );
  }

  try {
    return await response.json() as T;
  } catch {
    console.error("[Cashfree] Provider returned an invalid response", {
      endpoint: path === "/orders" ? "create-order" : "order-operation",
      status: response.status,
    });
    throw new CashfreeBookingError("The payment provider returned an invalid response");
  }
}

export async function createCashfreeOrder(input: {
  orderId: string;
  idempotencyKey: string;
  amountPaise: number;
  patient: { id: string; patientId: string; name: string; phone: string; email?: string | null };
  returnUrl: string;
  notifyUrl: string;
}): Promise<{ cf_order_id?: string | number; payment_session_id?: string }> {
  const customerPhone = normalizeCashfreeCustomerPhone(input.patient.phone);
  if (!customerPhone) {
    throw new CashfreeBookingError(
      "Enter a valid 10-digit Indian mobile number for online payment",
      400,
      "INVALID_CUSTOMER_PHONE",
    );
  }

  return cashfreeRequest("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": input.idempotencyKey },
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amountPaise / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: input.patient.patientId || input.patient.id,
        customer_name: input.patient.name,
        customer_phone: customerPhone,
        ...(input.patient.email ? { customer_email: input.patient.email } : {}),
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
      },
      order_note: "Online appointment booking",
    }),
  });
}

type CashfreeOrder = {
  order_status?: string;
  order_amount?: number | string;
  order_currency?: string;
};

type CashfreePayment = {
  cf_payment_id?: number | string;
  payment_status?: string;
  payment_amount?: number | string;
  payment_currency?: string;
};

const TERMINAL_UNSUCCESSFUL_PAYMENT_STATUSES = new Set([
  "FAILED",
  "CANCELLED",
  "VOID",
  "USER_DROPPED",
]);

function amountToPaise(value: number | string | undefined): number | null {
  if (value === undefined || value === null || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
  const [whole, fraction = ""] = String(value).split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

function getPaymentList(value: unknown): CashfreePayment[] {
  if (Array.isArray(value)) return value as CashfreePayment[];
  if (value && typeof value === "object" && Array.isArray((value as { payments?: unknown }).payments)) {
    return (value as { payments: CashfreePayment[] }).payments;
  }
  return [];
}

async function fetchVerifiedPayment(orderId: string, expectedAmountPaise: number): Promise<{
  payment: CashfreePayment | null;
  status: "PENDING" | "FAILED";
  terminal: boolean;
}> {
  const [order, payments] = await Promise.all([
    cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`),
    cashfreeRequest<unknown>(`/orders/${encodeURIComponent(orderId)}/payments`),
  ]);

  if (order.order_status === "EXPIRED") {
    return { payment: null, status: "FAILED", terminal: true };
  }

  if (
    order.order_currency !== "INR" ||
    amountToPaise(order.order_amount) !== expectedAmountPaise
  ) return { payment: null, status: "PENDING", terminal: false };

  const paymentList = getPaymentList(payments);
  const verifiedPayment = order.order_status === "PAID" ? paymentList.find((payment) =>
    payment.payment_status === "SUCCESS" &&
    payment.payment_currency === "INR" &&
    amountToPaise(payment.payment_amount) === expectedAmountPaise &&
    payment.cf_payment_id !== undefined
  ) : null;
  if (verifiedPayment) return { payment: verifiedPayment, status: "PENDING", terminal: false };

  if (
    order.order_status !== "PAID" &&
    paymentList.length > 0 &&
    paymentList.every((payment) =>
      payment.payment_status != null &&
      TERMINAL_UNSUCCESSFUL_PAYMENT_STATUSES.has(payment.payment_status)
    )
  ) {
    return { payment: null, status: "FAILED", terminal: false };
  }

  return { payment: null, status: "PENDING", terminal: false };
}

async function applyOnlineBookingPayment(
  transaction: PaymentTransaction,
  appointment: BookingAppointment,
  paymentId: string,
): Promise<void> {
  if (transaction.baseAmountPaise == null || transaction.baseAmountPaise <= 0) {
    throw new CashfreeBookingError("The saved booking amount is invalid", 500, "BOOKING_AMOUNT_INVALID");
  }
  const baseAmountPaise = transaction.baseAmountPaise;
  const baseAmount = baseAmountPaise / 100;
  const bill = await generateBillFromAppointment(appointment.id, transaction.hospitalId);

  await prisma.$transaction(async (tx) => {
    const currentBill = await tx.bill.findFirst({
      where: { id: bill.id, hospitalId: transaction.hospitalId },
    });
    if (!currentBill) throw new CashfreeBookingError("Unable to reconcile the appointment bill", 500);

    const existingPayment = await tx.payment.findFirst({
      where: { hospitalId: transaction.hospitalId, transactionId: paymentId },
    });

    if (!existingPayment) {
      if (currentBill.paidAmount > 0) {
        throw new CashfreeBookingError("The appointment bill already has a payment", 409, "BILL_ALREADY_PAID");
      }

      const billItem = {
        type: "OTHER" as const,
        referenceId: appointment.doctorId || null,
        name: "Online booking fee (consultation included)",
        quantity: 1,
        unitPrice: baseAmount,
        amount: baseAmount,
      };

      await tx.billItem.deleteMany({ where: { billId: bill.id, hospitalId: transaction.hospitalId } });
      await tx.billItem.create({
        data: { ...billItem, billId: bill.id, hospitalId: transaction.hospitalId },
      });
      await tx.payment.create({
        data: {
          hospitalId: transaction.hospitalId,
          billId: bill.id,
          amount: baseAmount,
          method: "ONLINE",
          transactionId: paymentId,
          status: "SUCCESS",
          notes: "Cashfree online booking payment; convenience fee excluded from hospital bill",
        },
      });
    }

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        items: JSON.stringify([{
          type: "OTHER",
          referenceId: appointment.doctorId || null,
          name: "Online booking fee (consultation included)",
          quantity: 1,
          unitPrice: baseAmount,
          amount: baseAmount,
        }]),
        subtotal: baseAmount,
        discount: 0,
        tax: 0,
        total: baseAmount,
        paidAmount: baseAmount,
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: "ONLINE",
      },
    });

    await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "CONFIRMED" },
    });

    await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        appointmentId: appointment.id,
        billId: bill.id,
        cashfreePaymentId: paymentId,
        status: "PAID",
        settlementStatus: "NOT_APPLICABLE",
        paidAt: new Date(),
      },
    });
  });

  logRevenue(
    transaction.hospitalId,
    "OTHER",
    baseAmount,
    bill.id,
    "Bill",
    "Cashfree online appointment booking payment",
  );
}

export async function verifyAndConfirmOnlineBooking(orderId: string, expectedHospitalId?: string): Promise<{
  status: "PAID" | "PENDING" | "PROCESSING" | "FAILED" | "REQUIRES_REVIEW";
  appointment?: BookingAppointment | null;
}> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { cashfreeOrderId: orderId },
  });
  if (!transaction) throw new CashfreeBookingError("Payment order not found", 404, "ORDER_NOT_FOUND");
  if (expectedHospitalId && transaction.hospitalId !== expectedHospitalId) {
    throw new CashfreeBookingError("Payment order not found", 404, "ORDER_NOT_FOUND");
  }

  if (transaction.status === "PAID" && transaction.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: transaction.appointmentId, hospitalId: transaction.hospitalId },
      include: {
        patient: { select: { id: true, name: true, patientId: true, email: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        department: { select: { id: true, name: true } },
      },
    });
    return { status: "PAID", appointment: includeBookingConfirmationEmail(appointment, transaction) };
  }
  if (transaction.status === "PAID_REQUIRES_REVIEW") return { status: "REQUIRES_REVIEW" };

  if (
    transaction.currency !== "INR" ||
    transaction.baseAmountPaise == null ||
    transaction.convenienceFeePaise == null ||
    transaction.grossAmountPaise !== transaction.baseAmountPaise + transaction.convenienceFeePaise
  ) {
    throw new CashfreeBookingError("The saved booking amounts are invalid", 500, "BOOKING_AMOUNT_INVALID");
  }
  const expectedAmountPaise = transaction.grossAmountPaise;
  const paymentCheck = await fetchVerifiedPayment(orderId, expectedAmountPaise);
  const payment = paymentCheck.payment;
  if (!payment) {
    if (paymentCheck.status === "FAILED" && paymentCheck.terminal) {
      await prisma.paymentTransaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: ["PENDING", "CREATING", "CREATE_FAILED"] },
        },
        data: { status: "FAILED" },
      });
    }
    if (paymentCheck.status === "FAILED" && transaction.status !== "PROCESSING") {
      return { status: "FAILED" };
    }
    return { status: transaction.status === "PROCESSING" ? "PROCESSING" : "PENDING" };
  }

  const leaseExpiredBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const claimed = await prisma.paymentTransaction.updateMany({
    where: {
      id: transaction.id,
      OR: [
        { status: { in: ["PENDING", "CREATING", "CREATE_FAILED"] } },
        { status: "PROCESSING", updatedAt: { lt: leaseExpiredBefore } },
      ],
    },
    data: {
      status: "PROCESSING",
      cashfreePaymentId: String(payment.cf_payment_id),
      paidAt: transaction.paidAt || new Date(),
    },
  });

  if (claimed.count !== 1) {
    const latest = await prisma.paymentTransaction.findUnique({ where: { id: transaction.id } });
    if (latest?.status === "PAID" && latest.appointmentId) {
      return verifyAndConfirmOnlineBooking(orderId, expectedHospitalId);
    }
    return {
      status: latest?.status === "PAID_REQUIRES_REVIEW" ? "REQUIRES_REVIEW" : "PROCESSING",
    };
  }

  const rawBookingData = transaction.bookingData;
  const bookingObject = rawBookingData && typeof rawBookingData === "object" && !Array.isArray(rawBookingData)
    ? rawBookingData as Record<string, Prisma.JsonValue>
    : null;
  const bookingData: SavedBookingData | null = bookingObject &&
    typeof bookingObject.appointmentId === "string" &&
    typeof bookingObject.appointmentDate === "string"
    ? {
        appointmentId: bookingObject.appointmentId,
        departmentId: typeof bookingObject.departmentId === "string" ? bookingObject.departmentId : null,
        appointmentDate: bookingObject.appointmentDate,
        timeSlot: typeof bookingObject.timeSlot === "string" ? bookingObject.timeSlot : null,
        confirmationEmail: typeof bookingObject.confirmationEmail === "string"
          ? bookingObject.confirmationEmail
          : null,
        type: bookingObject.type === "FOLLOW_UP" || bookingObject.type === "EMERGENCY" ||
          bookingObject.type === "ONLINE" || bookingObject.type === "OPD"
          ? bookingObject.type
          : "OPD",
        notes: typeof bookingObject.notes === "string" ? bookingObject.notes : null,
        consultationFee: typeof bookingObject.consultationFee === "number" ? bookingObject.consultationFee : null,
      }
    : null;
  const patient = transaction.customerId
    ? await prisma.patient.findFirst({
        where: { id: transaction.customerId, hospitalId: transaction.hospitalId },
      })
    : null;
  const hospital = await prisma.hospital.findUnique({
    where: { id: transaction.hospitalId },
    select: { name: true },
  });

  if (!bookingData || !patient || !hospital || typeof bookingData.appointmentId !== "string") {
    throw new CashfreeBookingError("Saved booking details are incomplete", 500, "BOOKING_DATA_INVALID");
  }
  let appointment: BookingAppointment;
  try {
    appointment = await bookAppointment(transaction.hospitalId, hospital.name, {
      patientId: patient.id,
      doctorId: transaction.doctorId,
      departmentId: bookingData.departmentId,
      appointmentDate: new Date(String(bookingData.appointmentDate)),
      timeSlot: bookingData.timeSlot,
      type: bookingData.type,
      bookingSource: "ONLINE",
      consultationFee: bookingData.consultationFee ?? undefined,
      notes: bookingData.notes,
    }, {
      id: bookingData.appointmentId,
      onlineBookingFee: transaction.baseAmountPaise / 100,
    });
  } catch (error) {
    if (error instanceof AppointmentServiceError && error.code === "SLOT_CONFLICT") {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "PAID_REQUIRES_REVIEW",
          cashfreePaymentId: String(payment.cf_payment_id),
          paidAt: new Date(),
        },
      });
      return { status: "REQUIRES_REVIEW" };
    }
    throw error;
  }

  try {
    await applyOnlineBookingPayment(transaction, appointment, String(payment.cf_payment_id));
  } catch (error) {
    if (error instanceof CashfreeBookingError && error.code === "BILL_ALREADY_PAID") {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          appointmentId: appointment.id,
          cashfreePaymentId: String(payment.cf_payment_id),
          status: "PAID_REQUIRES_REVIEW",
          paidAt: new Date(),
        },
      });
      return { status: "REQUIRES_REVIEW" };
    }
    throw error;
  }
  notify({
    hospitalId: transaction.hospitalId,
    type: "BOOKING_REQUEST",
    title: `Online Booking — ${patient.name}`,
    message: `${patient.name} (${patient.phone}) completed online payment for an appointment.`,
    metadata: { patientId: patient.id, source: "CASHFREE_ONLINE_BOOKING" },
  }).catch(() => {});
  const confirmedAppointment = await prisma.appointment.findFirst({
    where: { id: appointment.id, hospitalId: transaction.hospitalId },
    include: {
      patient: { select: { id: true, name: true, patientId: true, email: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
      department: { select: { id: true, name: true } },
    },
  });

  return {
    status: "PAID",
    appointment: includeBookingConfirmationEmail(confirmedAppointment, transaction),
  };
}

export function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret || !timestamp || !signature) return false;

  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function calculateBookingAmounts(baseAmount: number) {
  return calculateOnlineBookingAmounts(baseAmount);
}
