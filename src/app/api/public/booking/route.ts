import { createHash, randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";
import { bookAppointment, AppointmentServiceError } from "../../../../../backend/services/appointment.service";
import { checkSlotConflict } from "../../../../../backend/repositories/appointment.repo";
import { notify } from "../../../../../backend/services/notification.service";
import { findPatientsByPhone, generatePatientId, createPatient } from "../../../../../backend/repositories/patient.repo";
import { resolvePatientAge } from "../../../../../backend/services/patient.service";
import {
  calculateBookingAmounts,
  CashfreeBookingError,
  createCashfreeOrder,
  getCashfreeMode,
  normalizeCashfreeCustomerPhone,
  verifyAndConfirmOnlineBooking,
} from "../../../../../backend/services/cashfree-booking.service";

export const dynamic = "force-dynamic";

type PublicBookingBody = {
  action?: string;
  hospitalId?: string | null;
  slug?: string | null;
  name?: string;
  phone?: string;
  email?: string | null;
  age?: string | number;
  gender?: string;
  dateOfBirth?: string;
  existingPatientId?: string;
  forceNew?: boolean;
  doctorId?: string | null;
  departmentId?: string | null;
  appointmentDate?: string;
  timeSlot?: string | null;
  type?: string;
  notes?: string | null;
  idempotencyKey?: string;
  orderId?: string;
};

async function resolveHospitalId(hid: string | null, slug: string | null): Promise<string | null> {
  if (hid) return hid;
  if (slug) {
    const settings = await prisma.hospitalSettings.findUnique({
      where: { bookingSlug: slug },
      select: { hospitalId: true },
    });
    return settings?.hospitalId || null;
  }
  return null;
}

async function resolveBookingPatient(hospitalId: string, body: PublicBookingBody) {
  const name = body.name?.trim() || "";
  const phone = body.phone?.trim() || "";
  const email = body.email?.trim() || null;
  const ageValue = typeof body.age === "number" ? body.age : Number(body.age);
  const age = Number.isFinite(ageValue) ? ageValue : undefined;
  const dateValue = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  const dateOfBirth = dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : null;

  const validGenders = ["MALE", "FEMALE", "OTHER"] as const;
  const gender = body.gender && validGenders.includes(body.gender as any) ? body.gender : undefined;

  if (body.existingPatientId) {
    const patient = await prisma.patient.findFirst({ where: { id: body.existingPatientId, hospitalId } });
    if (!patient) throw new AppointmentServiceError("Patient not found", "PATIENT_NOT_FOUND", 404);
    return patient;
  }

  if (body.forceNew) {
    return createPatient({
      hospitalId,
      patientId: await generatePatientId(hospitalId),
      name: name.trim(),
      phone: phone.trim(),
      email,
      age: resolvePatientAge({ age, dateOfBirth }),
      gender,
    });
  }

  const matches = await findPatientsByPhone(hospitalId, phone.trim());
  if (matches.length === 1) return matches[0];

  return createPatient({
    hospitalId,
    patientId: await generatePatientId(hospitalId),
    name: name.trim(),
    phone: phone.trim(),
    email,
    age: resolvePatientAge({ age, dateOfBirth }),
    gender,
  });
}

function getBookingFingerprint(hospitalId: string, body: PublicBookingBody): string {
  const validGenders = ["MALE", "FEMALE", "OTHER"] as const;
  const gender = body.gender && validGenders.includes(body.gender as any) ? body.gender : null;

  const fingerprintInput = {
    hospitalId,
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    age: body.age ?? null,
    gender,
    dateOfBirth: body.dateOfBirth ?? null,
    existingPatientId: body.existingPatientId ?? null,
    forceNew: Boolean(body.forceNew),
    doctorId: body.doctorId ?? null,
    departmentId: body.departmentId ?? null,
    appointmentDate: body.appointmentDate,
    timeSlot: body.timeSlot ?? null,
    type: getAppointmentType(body.type),
    notes: body.notes ?? null,
  };
  return createHash("sha256").update(JSON.stringify(fingerprintInput)).digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function getSafeErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.message) return undefined;
  return error.message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\d\s().-]{8,}\d)\b/g, "[redacted-number]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[redacted-id]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 300);
}

function getAppointmentType(value: string | undefined): "OPD" | "EMERGENCY" | "ONLINE" | "FOLLOW_UP" {
  return value === "FOLLOW_UP" || value === "EMERGENCY" || value === "ONLINE" || value === "OPD"
    ? value
    : "OPD";
}

function getBookingReturnUrls(hospitalId: string, orderId: string, bookingSlug?: string | null) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new CashfreeBookingError("The application URL is not configured", 503, "APP_URL_NOT_CONFIGURED");

  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    throw new CashfreeBookingError("The application URL is invalid", 503, "APP_URL_INVALID");
  }

  const returnUrl = new URL("/booking/success", baseUrl);
  if (bookingSlug) returnUrl.searchParams.set("slug", bookingSlug);
  else returnUrl.searchParams.set("hid", hospitalId);
  returnUrl.searchParams.set("payment", "return");
  returnUrl.searchParams.set("order_id", orderId);

  return {
    returnUrl: returnUrl.toString(),
    notifyUrl: new URL("/api/cashfree/webhook", baseUrl).toString(),
  };
}

/* ── GET /api/public/booking?hid=HOSPITAL_ID or ?slug=SLUG ── */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    const hid = await resolveHospitalId(searchParams.get("hid"), searchParams.get("slug"));
    if (!hid) return errorResponse("No hospital found. Please use a valid booking link.", 404);
    const hospital = await prisma.hospital.findUnique({
      where: { id: hid },
      select: { id: true, name: true },
    });
    if (!hospital) return errorResponse("Hospital not found", 404);

    const settings = await prisma.hospitalSettings.findUnique({
      where: { hospitalId: hid },
      select: { hospitalName: true, logo: true, phone: true, address: true },
    });

    const departments = await prisma.department.findMany({
      where: { hospitalId: hid, isActive: true, allowAppointments: true, type: "CLINICAL" },
      select: { id: true, name: true, code: true, type: true },
      orderBy: { name: "asc" },
    });

    return successResponse({
      hospital: {
        id: hospital.id,
        name: settings?.hospitalName || hospital.name,
        logo: settings?.logo || null,
        phone: settings?.phone || null,
        address: settings?.address || null,
      },
      departments,
      cashfreeMode: getCashfreeMode(),
    }, "Public booking info");
  } catch {
    return errorResponse("Unable to load public booking information", 500);
  }
}

/* ── POST /api/public/booking ── */
export async function POST(req: NextRequest) {
  let action = "hospital-booking";
  let stage = "parse-request";
  try {
    const body = await req.json() as PublicBookingBody;
    action = body.action === "create-order" || body.action === "verify-order"
      ? body.action
      : "hospital-booking";
    if (
      (body.hospitalId != null && typeof body.hospitalId !== "string") ||
      (body.slug != null && typeof body.slug !== "string")
    ) {
      return errorResponse("Invalid booking link", 400);
    }
    stage = "resolve-hospital";
    const hospitalId = await resolveHospitalId(body.hospitalId || null, body.slug || null);
    if (!hospitalId) return errorResponse("No hospital found", 404);

    if (body.action === "verify-order") {
      if (typeof body.orderId !== "string" || body.orderId.length > 64) {
        return errorResponse("A valid payment order is required", 400);
      }
      stage = "verify-payment";
      const result = await verifyAndConfirmOnlineBooking(body.orderId, hospitalId);
      if (result.status === "REQUIRES_REVIEW") {
        return errorResponse("Payment was received, but the appointment needs hospital review. Please contact the hospital.", 409, {
          code: "PAYMENT_REQUIRES_REVIEW",
        });
      }
      const appointment = result.appointment;
      return successResponse({
        status: result.status,
        ...(result.status === "PAID" && appointment ? {
          appointment: {
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            timeSlot: appointment.timeSlot,
            tokenNumber: appointment.tokenNumber,
            patient: { email: appointment.patient?.email || "" },
            doctor: { name: appointment.doctor?.name || "" },
            department: { name: appointment.department?.name || "" },
          },
        } : {}),
      }, result.status === "PAID" ? "Payment verified" : "Payment is not confirmed yet");
    }

    if (
      typeof body.name !== "string" || !body.name.trim() ||
      typeof body.phone !== "string" || !body.phone.trim() ||
      typeof body.appointmentDate !== "string"
    ) {
      return errorResponse("Missing required fields", 400);
    }
    if (
      (body.email != null && typeof body.email !== "string") ||
      (body.gender != null && typeof body.gender !== "string") ||
      (body.notes != null && typeof body.notes !== "string") ||
      (body.doctorId != null && typeof body.doctorId !== "string") ||
      (body.departmentId != null && typeof body.departmentId !== "string") ||
      (body.timeSlot != null && typeof body.timeSlot !== "string") ||
      (body.existingPatientId != null && typeof body.existingPatientId !== "string") ||
      (body.age != null && typeof body.age !== "number" && typeof body.age !== "string") ||
      (body.forceNew != null && typeof body.forceNew !== "boolean")
    ) {
      return errorResponse("Invalid booking details", 400);
    }

    if (body.action === "create-order") {
      if (typeof body.idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey)) {
        return errorResponse("A valid booking idempotency key is required", 400);
      }
      const requestPhone = normalizeCashfreeCustomerPhone(body.phone);
      if (!requestPhone) {
        return errorResponse("Enter a valid 10-digit Indian mobile number for online payment", 400, {
          code: "INVALID_CUSTOMER_PHONE",
        });
      }
      if (!body.doctorId || !body.appointmentDate || !body.timeSlot) {
        return errorResponse("Doctor, appointment date, and time are required for online payment", 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.appointmentDate)) || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(body.timeSlot))) {
        return errorResponse("Invalid appointment date or time", 400);
      }
      const bookingDate = new Date(`${body.appointmentDate}T00:00:00.000Z`);
      if (Number.isNaN(bookingDate.getTime()) || bookingDate.toISOString().slice(0, 10) !== body.appointmentDate) {
        return errorResponse("Invalid appointment date", 400);
      }

      stage = "load-payment-transaction";
      const fingerprint = getBookingFingerprint(hospitalId, body);
      const existing = await prisma.paymentTransaction.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (existing) {
        if (existing.bookingFingerprint !== fingerprint || existing.hospitalId !== hospitalId) {
          return errorResponse("This booking key has already been used for different booking details", 409);
        }
        if (existing.paymentSessionId) {
          return successResponse({
            orderId: existing.cashfreeOrderId,
            paymentSessionId: existing.paymentSessionId,
            baseAmountPaise: existing.baseAmountPaise,
            convenienceFeePaise: existing.convenienceFeePaise,
            totalAmountPaise: existing.grossAmountPaise,
            environment: getCashfreeMode(),
            status: existing.status,
          }, "Payment order already exists");
        }
      }

      stage = "load-hospital-and-department";
      const hospital = await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true },
      });
      if (!hospital) return errorResponse("Hospital not found", 404);

      const department = body.departmentId
        ? await prisma.department.findFirst({
            where: { id: body.departmentId, hospitalId },
            select: { id: true, type: true },
          })
        : null;
      if (body.departmentId && !department) return errorResponse("Department not found", 404);
      if (department?.type === "DIAGNOSTIC") {
        return errorResponse("Online payment is available for doctor appointments only", 400);
      }

      stage = "load-doctor-and-fee";
      const doctor = await prisma.doctor.findFirst({
        where: { id: body.doctorId, hospitalId, isActive: true },
        select: {
          id: true,
          departmentId: true,
          consultationFee: true,
          onlineBookingFee: true,
          followUpFee: true,
          emergencyFee: true,
        },
      });
      if (!doctor) return errorResponse("Doctor not found or unavailable", 404);
      if (await checkSlotConflict(hospitalId, doctor.id, bookingDate, body.timeSlot)) {
        return errorResponse("This time slot is already booked. Choose another available slot.", 409, {
          code: "SLOT_CONFLICT",
        });
      }

      const amounts = calculateBookingAmounts(Number(doctor.onlineBookingFee || 0));
      if (amounts.baseAmountPaise <= 0) {
        return errorResponse("Online booking is unavailable for this doctor. Choose payment at the hospital.", 400);
      }

      const patient = existing?.customerId
        ? await prisma.patient.findFirst({ where: { id: existing.customerId, hospitalId } })
        : await resolveBookingPatient(hospitalId, body);
      if (!patient) return errorResponse("Patient not found", 404);
      const customerPhone = normalizeCashfreeCustomerPhone(patient.phone);
      if (!customerPhone) {
        return errorResponse("Enter a valid 10-digit Indian mobile number for online payment", 400, {
          code: "INVALID_CUSTOMER_PHONE",
        });
      }

      let transaction = existing;
      if (!transaction) {
        const consultationFee = body.type === "EMERGENCY" && doctor.emergencyFee != null
          ? doctor.emergencyFee
          : body.type === "FOLLOW_UP" && doctor.followUpFee != null
            ? doctor.followUpFee
            : doctor.consultationFee;
        const hospitalSettings = await prisma.hospitalSettings.findUnique({
          where: { hospitalId },
          select: { bookingSlug: true },
        });
        const appointmentId = randomUUID();
        const orderId = `cmq_${randomUUID().replace(/-/g, "")}`;
        const bookingData = {
          appointmentId,
          departmentId: body.departmentId || doctor.departmentId || null,
          appointmentDate: body.appointmentDate,
          timeSlot: body.timeSlot,
          confirmationEmail: body.email?.trim() || patient.email || null,
          type: body.type || "OPD",
          notes: typeof body.notes === "string" ? body.notes : null,
          consultationFee: consultationFee ?? null,
        };
        try {
          stage = "persist-payment-order";
          transaction = await prisma.paymentTransaction.create({
            data: {
              hospitalId,
              doctorId: doctor.id,
              customerId: patient.id,
              appointmentDate: bookingDate,
              timeSlot: body.timeSlot,
              idempotencyKey: body.idempotencyKey,
              cashfreeOrderId: orderId,
              grossAmountPaise: amounts.totalAmountPaise,
              baseAmountPaise: amounts.baseAmountPaise,
              convenienceFeePaise: amounts.convenienceFeePaise,
              currency: "INR",
              bookingFingerprint: fingerprint,
              bookingData,
              commissionType: "NONE",
              commissionValue: 0,
              commissionRateBps: 0,
              commissionAmountPaise: 0,
              vendorAmountPaise: 0,
              status: "CREATING",
              settlementStatus: "NOT_APPLICABLE",
            },
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
          const concurrentOrder = await prisma.paymentTransaction.findUnique({
            where: { idempotencyKey: body.idempotencyKey },
          });
          if (!concurrentOrder || concurrentOrder.bookingFingerprint !== fingerprint) throw error;
          if (!concurrentOrder.paymentSessionId) {
            return errorResponse("This payment order is still being prepared. Please retry shortly.", 409);
          }
          return successResponse({
            orderId: concurrentOrder.cashfreeOrderId,
            paymentSessionId: concurrentOrder.paymentSessionId,
            baseAmountPaise: concurrentOrder.baseAmountPaise,
            convenienceFeePaise: concurrentOrder.convenienceFeePaise,
            totalAmountPaise: concurrentOrder.grossAmountPaise,
            environment: getCashfreeMode(),
            status: concurrentOrder.status,
          }, "Payment order already exists");
        }
        const urls = getBookingReturnUrls(hospitalId, orderId, hospitalSettings?.bookingSlug);
        try {
          stage = "create-cashfree-order";
          const providerOrder = await createCashfreeOrder({
            orderId,
            idempotencyKey: body.idempotencyKey,
            amountPaise: amounts.totalAmountPaise,
            patient: { ...patient, phone: customerPhone },
            returnUrl: urls.returnUrl,
            notifyUrl: urls.notifyUrl,
          });
          if (!providerOrder.payment_session_id) {
            throw new CashfreeBookingError("The payment provider did not return a checkout session");
          }
          stage = "persist-checkout-session";
          transaction = await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
              cfOrderId: providerOrder.cf_order_id == null ? null : String(providerOrder.cf_order_id),
              paymentSessionId: providerOrder.payment_session_id,
              status: "PENDING",
            },
          });
        } catch (error) {
          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { status: "CREATE_FAILED" },
          });
          throw error;
        }
      } else {
        const hospitalSettings = await prisma.hospitalSettings.findUnique({
          where: { hospitalId },
          select: { bookingSlug: true },
        });
        const urls = getBookingReturnUrls(
          hospitalId,
          transaction.cashfreeOrderId,
          hospitalSettings?.bookingSlug,
        );
        try {
          stage = "retry-cashfree-order";
          const providerOrder = await createCashfreeOrder({
            orderId: transaction.cashfreeOrderId,
            idempotencyKey: transaction.idempotencyKey || body.idempotencyKey,
            amountPaise: transaction.grossAmountPaise,
            patient: { ...patient, phone: customerPhone },
            returnUrl: urls.returnUrl,
            notifyUrl: urls.notifyUrl,
          });
          if (!providerOrder.payment_session_id) {
            throw new CashfreeBookingError("The payment provider did not return a checkout session");
          }
          stage = "persist-checkout-session";
          transaction = await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
              cfOrderId: providerOrder.cf_order_id == null ? null : String(providerOrder.cf_order_id),
              paymentSessionId: providerOrder.payment_session_id,
              status: "PENDING",
            },
          });
        } catch (error) {
          await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { status: "CREATE_FAILED" },
          });
          throw error;
        }
      }

      return successResponse({
        orderId: transaction.cashfreeOrderId,
        paymentSessionId: transaction.paymentSessionId,
        baseAmountPaise: transaction.baseAmountPaise,
        convenienceFeePaise: transaction.convenienceFeePaise,
        totalAmountPaise: transaction.grossAmountPaise,
        environment: getCashfreeMode(),
        status: transaction.status,
      }, "Payment order created", 201);
    }

    // Reject unpaid public bookings - online payment is now mandatory
    return errorResponse("Online payment is required for public bookings. Please use the Cashfree payment option.", 400, {
      code: "ONLINE_PAYMENT_REQUIRED",
    });
  } catch (error) {
    if (error instanceof AppointmentServiceError) {
      return errorResponse(error.message, error.status, { code: error.code });
    }
    if (error instanceof CashfreeBookingError) {
      return errorResponse(error.message, error.status, {
        ...(error.code ? { code: error.code } : {}),
        ...(error.providerStatus ? { providerStatus: error.providerStatus } : {}),
        ...(error.providerCode ? { providerCode: error.providerCode } : {}),
      });
    }

    const errorRecord = error && typeof error === "object"
      ? error as { name?: unknown; code?: unknown }
      : null;
    const prismaCode = typeof errorRecord?.code === "string" && /^P\d{4}$/.test(errorRecord.code)
      ? errorRecord.code
      : undefined;
    const safeErrorMessage = getSafeErrorMessage(error);
    console.error("[PublicBooking] Request failed", {
      action,
      stage,
      ...(typeof errorRecord?.name === "string" ? { errorType: errorRecord.name } : {}),
      ...(safeErrorMessage ? { errorMessage: safeErrorMessage } : {}),
      ...(prismaCode ? { prismaCode } : {}),
    });

    if (action === "create-order" && (prismaCode === "P2021" || prismaCode === "P2022")) {
      return errorResponse(
        "Online booking payment setup is incomplete. Please contact the hospital.",
        503,
        { code: "PAYMENT_SCHEMA_NOT_READY" },
      );
    }
    return errorResponse("Unable to create appointment booking", 500);
  }
}
