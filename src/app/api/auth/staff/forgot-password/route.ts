import { NextRequest } from "next/server";
import { findStaffByEmailGlobal } from "../../../../../../backend/repositories/staff.repo";
import { requestOTP } from "../../../../../../backend/services/otp.service";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email format"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return errorResponse("Validation Failed", 400, result.error.issues);
    }

    const { email } = result.data;

    // Check if the staff account exists (email is stored lowercased)
    const staff = await findStaffByEmailGlobal(email);
    if (!staff) {
      return errorResponse("No staff account found with this email address.", 404);
    }

    if (!staff.isActive) {
      return errorResponse("Your account is inactive. Contact your hospital administrator.", 403);
    }

    if (!staff.userId) {
      return errorResponse("No user account linked to this staff member. Contact your hospital administrator.", 400);
    }

    // Send OTP for password reset (reuses existing email/SMS OTP delivery)
    await requestOTP(email);

    return successResponse({ email }, "Password reset OTP sent to your email");
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
