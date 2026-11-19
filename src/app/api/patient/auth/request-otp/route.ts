import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requestMobileOTP } from "../../../../../../backend/services/otp.service";
import prisma from "../../../../../../backend/config/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mobile: z.string().trim().min(10, "Enter a valid 10-digit mobile number").max(15),
  hospitalId: z.string().optional(),
  slug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Valid mobile number is required", 400);
    }
    const { mobile, hospitalId: hidIn, slug } = parsed.data;

    let hid = hidIn || null;
    if (!hid && slug) {
      const s = await prisma.hospitalSettings.findUnique({
        where: { bookingSlug: slug },
        select: { hospitalId: true },
      });
      hid = s?.hospitalId || null;
    }

    const digits = mobile.replace(/\D/g, "").slice(-10);
    if (digits.length < 10) return errorResponse("Enter a valid 10-digit mobile number", 400);

    if (hid) {
      const patient = await prisma.patient.findFirst({
        where: {
          hospitalId: hid,
          isActive: true,
          OR: [{ phone: digits }, { phone: { contains: digits } }],
        },
        select: { id: true, name: true, phone: true },
      });
      if (!patient) {
        return errorResponse("This mobile number is not registered with this hospital. Please book an appointment first.", 404);
      }
    } else {
      const patients = await prisma.patient.findMany({
        where: {
          isActive: true,
          OR: [{ phone: digits }, { phone: { contains: digits } }],
        },
      });
      if (patients.length === 0) {
        return errorResponse("This mobile number is not registered. Please book an appointment first.", 404);
      }
    }

    const result = await requestMobileOTP(digits);
    return successResponse(
      { sent: true, maskedMobile: `••••• ${digits.slice(-4)}`, ...(result as any) },
      "OTP sent"
    );
  } catch (e: any) {
    return errorResponse(e.message || "Failed to send OTP", 500);
  }
}
