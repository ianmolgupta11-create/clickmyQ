import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { verifyMobileOTP } from "../../../../../../backend/services/otp.service";
import { generateToken } from "../../../../../../backend/utils/jwt";
import prisma from "../../../../../../backend/config/db";
import { z } from "zod";
import { generatePatientId } from "../../../../../../backend/repositories/patient.repo";
import { resolvePatientAge } from "../../../../../../backend/services/patient.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  mobile: z.string().trim().min(10).max(15),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
  name: z.string().trim().min(2, "Enter your full name"),
  age: z.coerce.number().int().min(0, "Age cannot be negative").max(150, "Age must be 150 or less").optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  hospitalId: z.string().optional(),
  slug: z.string().optional(),
});

/* ── POST /api/patient/auth/register-verify ──
   Step 2 of patient registration. Verifies the OTP, creates a new patient
   record, issues a PATIENT-scoped JWT and sets the http-only `patient_session`
   cookie (separate from the staff `hms_session` cookie). */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const { mobile, otp, name, age, dateOfBirth, hospitalId: hidIn, slug } = parsed.data;

    let hid = hidIn || null;
    if (!hid && slug) {
      const s = await prisma.hospitalSettings.findUnique({
        where: { bookingSlug: slug },
        select: { hospitalId: true },
      });
      hid = s?.hospitalId || null;
    }
    if (!hid) return errorResponse("Hospital not found", 404);

    const digits = mobile.replace(/\D/g, "").slice(-10);

    // Verify OTP
    await verifyMobileOTP(digits, otp).catch((e: any) => {
      throw new Error(e.message || "Invalid OTP");
    });

    // Always create a new patient record (no phone uniqueness enforcement)
    const patientIdStr = await generatePatientId(hid);
    const patient = await prisma.patient.create({
      data: {
        patientId: patientIdStr,
        name,
        phone: digits,
        hospitalId: hid,
        age: resolvePatientAge({ age, dateOfBirth }),
        patientType: "NEW",
        isActive: true,
      },
      select: {
        id: true, patientId: true, name: true, phone: true, patientType: true,
        hospital: { select: { id: true, name: true } },
      },
    });

    const token = generateToken(
      { userId: patient.id, role: "PATIENT", patientId: patient.id, hospitalId: hid },
      "7d"
    );

    const response = successResponse({ patient }, "Registration successful");
    const secureFlag = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: "patient_session",
      value: token,
      httpOnly: true,
      secure: secureFlag,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (e: any) {
    return errorResponse(e.message || "Registration failed", e.message?.includes("OTP") ? 400 : 500);
  }
}
