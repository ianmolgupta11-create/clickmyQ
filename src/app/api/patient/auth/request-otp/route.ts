import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requestMobileOTP } from "../../../../../../backend/services/otp.service";
import { findLatestMobileOTP } from "../../../../../../backend/repositories/otp.repo";
import prisma from "../../../../../../backend/config/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mobile: z.string().trim().min(10, "Enter a valid 10-digit mobile number").max(15),
  hospitalId: z.string().optional(),
  slug: z.string().optional(),
  channel: z.enum(["whatsapp", "sms"]).optional(),
});

const COOLDOWN_SECONDS = 60;

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Valid mobile number is required", 400);
    }
    const { mobile, hospitalId: hidIn, slug, channel } = parsed.data;

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

    // 1-minute cooldown: check if an OTP was created recently
    const latestOTP = await findLatestMobileOTP(digits);
    if (latestOTP) {
      const createdAt = new Date(latestOTP.expiresAt.getTime() - 10 * 60 * 1000); // expiresAt = createdAt + 10min
      const elapsed = (Date.now() - createdAt.getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        return errorResponse(`Please wait ${Math.ceil(COOLDOWN_SECONDS - elapsed)}s before requesting another OTP`, 429);
      }
    }

    const result = await requestMobileOTP(digits, channel);
    return successResponse(
      {
        sent: result.sms?.success ?? result.whatsapp?.success ?? false,
        channel: result.channel,
        maskedMobile: `••••• ${digits.slice(-4)}`,
        sms: result.sms,
        whatsapp: result.whatsapp,
      },
      result.message
    );
  } catch (e: any) {
    return errorResponse(e.message || "Failed to send OTP", 500);
  }
}
