import { NextRequest } from "next/server";
import { authMiddleware } from "../../../../../backend/middlewares/auth.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";
import { z } from "zod";

const startInterruptionSchema = z.object({
  type: z.enum(["EMERGENCY", "ON_BREAK"]),
  expectedReturnMinutes: z.number().int().positive("Expected return time must be a positive whole number"),
});

/* ── PATCH /api/doctor/status ──
   Start an Emergency or Break interruption for the authenticated doctor.
   Only succeeds when the doctor is currently ACTIVE (status = 'ACTIVE'),
   which prevents duplicate/conflicting interruptions under double-click
   and forces a doctor to resume before switching Emergency <-> Break.
   Scoped to the doctor's own row (resolved via user.userId) for isolation.
*/
export async function PATCH(req: NextRequest) {
  const { user, error } = await authMiddleware(req);
  if (error) return error;

  try {
    if (user?.role !== "DOCTOR") {
      return errorResponse("Unauthorized: Only doctors can change their status", 403);
    }

    const body = await req.json();
    const result = startInterruptionSchema.safeParse(body);
    if (!result.success) {
      return errorResponse("Validation failed", 400, result.error.issues);
    }

    const { type, expectedReturnMinutes } = result.data;

    // Resolve the doctor record for this authenticated user.
    const doctor = await (prisma as any).doctor.findFirst({
      where: { userId: user.userId },
      select: { id: true, hospitalId: true, departmentId: true, status: true },
    });

    if (!doctor) {
      return errorResponse("Doctor profile not found", 404);
    }

    // Conditional update: only if currently ACTIVE. Prevents double-active
    // interruptions and forces a resume before changing Emergency <-> Break.
    // The status precondition lives in the WHERE clause so Prisma raises P2025
    // (record not found) when the doctor is already interrupted.
    const now = new Date();
    const expectedReturnAt = new Date(now.getTime() + expectedReturnMinutes * 60000);

    const updated = await (prisma as any).doctor.update({
      where: { id: doctor.id, status: "ACTIVE" },
      data: {
        status: type,
        statusStartedAt: now,
        expectedReturnAt,
        actualReturnAt: null,
      },
      select: {
        id: true,
        status: true,
        statusStartedAt: true,
        expectedReturnAt: true,
        actualReturnAt: true,
        hospitalId: true,
        departmentId: true,
      },
    });

    return successResponse(
      {
        ...updated,
        message: type === "EMERGENCY" ? "Emergency status started" : "Break status started",
      },
      `Doctor status set to ${type}`,
    );
  } catch (err: any) {
    // Prisma P2025 = record not found (the conditional WHERE matched nothing
    // because status was not ACTIVE). Return a clear conflict instead of 500.
    if (err?.code === "P2025") {
      return errorResponse(
        "Cannot start interruption: doctor is not in ACTIVE status (already on Emergency or Break). Resume first.",
        409,
      );
    }
    return errorResponse(err.message || "Failed to update doctor status", 500);
  }
}

/* ── POST /api/doctor/status/resume ──
   Clear an active Emergency or Break interruption and record the actual
   resumption time. Only succeeds when the doctor is currently interrupted.
*/
export async function POST(req: NextRequest) {
  const { user, error } = await authMiddleware(req);
  if (error) return error;

  try {
    if (user?.role !== "DOCTOR") {
      return errorResponse("Unauthorized: Only doctors can resume their status", 403);
    }

    const doctor = await (prisma as any).doctor.findFirst({
      where: { userId: user.userId },
      select: { id: true, status: true },
    });

    if (!doctor) {
      return errorResponse("Doctor profile not found", 404);
    }

    if (doctor.status === "ACTIVE") {
      return errorResponse("Doctor is already in ACTIVE status", 409);
    }

    const now = new Date();

    const updated = await (prisma as any).doctor.update({
      where: { id: doctor.id },
      data: {
        status: "ACTIVE",
        actualReturnAt: now,
      },
      select: {
        id: true,
        status: true,
        statusStartedAt: true,
        expectedReturnAt: true,
        actualReturnAt: true,
        hospitalId: true,
        departmentId: true,
      },
    });

    return successResponse(
      {
        ...updated,
        message: "Doctor has resumed appointments",
      },
      "Doctor status resumed to ACTIVE",
    );
  } catch (err: any) {
    if (err?.code === "P2025") {
      return errorResponse(
        "Cannot resume: doctor is not in an interruptible status",
        409,
      );
    }
    return errorResponse(err.message || "Failed to resume doctor status", 500);
  }
}