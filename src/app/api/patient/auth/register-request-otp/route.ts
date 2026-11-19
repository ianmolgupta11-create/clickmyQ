import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requestMobileOTP } from "../../../../../../backend/services/otp.service";
import prisma from "../../../../../../backend/config/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mobile: z.string().trim().min(10, "Enter a valid 10-digit mobile number").max(15),
  name: z.string().trim().min(2, "Enter your full name").optional(),
  hospitalId: z.string().optional(),
  slug: z.string().optional(),
});

/* ── POST /api/patient/auth/register-request-otp ──
   Step 1 of patient registration. Sends an OTP to a NEW patient's mobile
   (no existing patient record required). Returns an error if the mobile is
   already registered — those users should use the login flow instead.
   Dev-bypass OTP exposed when Twilio is not configured. */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || "Valid mobile number is required",
        400
      );
    }
    const { mobile, name, hospitalId: hidIn, slug } = parsed.data;

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
    if (digits.length < 10) return errorResponse("Enter a valid 10-digit mobile number", 400);

    // Send OTP regardless of existing registrations — uniqueness is no
    // longer enforced; callers decide how to handle multiple matches.
    const result = await requestMobileOTP(digits);
    return successResponse(
      {
        sent: true,
        maskedMobile: `••••• ${digits.slice(-4)}`,
        ...(result as any),
      },
      "OTP sent"
    );
  } catch (e: any) {
    return errorResponse(e.message || "Failed to send OTP", 500);
  }
}
