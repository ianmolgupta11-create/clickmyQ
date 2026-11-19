import { NextRequest } from "next/server";
import { findStaffByEmailGlobal } from "../../../../../../backend/repositories/staff.repo";
import { updateStaff as updateStaffRepo } from "../../../../../../backend/repositories/staff.repo";
import { updateUser } from "../../../../../../backend/repositories/user.repo";
import { verifyOTP } from "../../../../../../backend/services/otp.service";
import { hashPassword } from "../../../../../../backend/utils/hash";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return errorResponse("Validation Failed", 400, result.error.issues);
    }

    const { email, otp, newPassword } = result.data;

    // Verify the OTP first
    await verifyOTP(email, otp);

    // Check staff account exists
    const staff = await findStaffByEmailGlobal(email) as any;
    if (!staff) {
      return errorResponse("No staff account found with this email address.", 404);
    }

    if (!staff.userId) {
      return errorResponse("No user account linked to this staff member.", 400);
    }

    // Hash the new password and update BOTH staff and user records so staff login stays in sync
    const hashedPassword = await hashPassword(newPassword);

    await Promise.all([
      updateStaffRepo(staff.id, staff.hospitalId, {
        password: hashedPassword,
        mustChangePassword: false,
      } as any),
      updateUser(staff.userId, { password: hashedPassword }),
    ]);

    return successResponse({}, "Password reset successfully. You can now log in with your new password.");
  } catch (error: any) {
    return errorResponse(error.message, 400);
  }
}
