import { NextRequest } from "next/server";
import { requireRole } from "../../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import prisma from "../../../../../../backend/config/db";

const ALLOWED_ROLES = ["HOSPITAL_ADMIN", "RECEPTIONIST", "STAFF", "DOCTOR", "SUB_DEPT_HEAD", "DEPT_HEAD"];
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const px = prisma as any;

// POST /api/appointments/[id]/delay-alert - create/update active delay alert for appointment
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ALLOWED_ROLES);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { message, reason, revisedWaitMin, delayMinutes, type } = body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return errorResponse("Message is required", 400);
    }

    const appt = await px.appointment.findFirst({
      where: { id, hospitalId: auth.hospitalId },
      include: { patient: true },
    });
    if (!appt) return errorResponse("Appointment not found", 404);
    if (!appt.patientId) return errorResponse("Patient not linked", 400);

    // Deactivate existing active alerts for this appointment
    await px.appointmentDelayAlert.updateMany({
      where: { appointmentId: id, hospitalId: auth.hospitalId, isActive: true },
      data: { isActive: false, resolvedAt: new Date(), resolvedByUserId: (auth as any).user?.id || null },
    });

    const alert = await px.appointmentDelayAlert.create({
      data: {
        hospitalId: auth.hospitalId,
        appointmentId: appt.id,
        patientId: appt.patientId,
        createdByUserId: (auth as any).user?.id || null,
        type: type === "EMERGENCY" ? "EMERGENCY" : "QUEUE_DELAY",
        message: message.trim(),
        reason: reason ? String(reason).trim() : null,
        revisedWaitMin: typeof revisedWaitMin === "number" ? revisedWaitMin : null,
        delayMinutes: typeof delayMinutes === "number" ? delayMinutes : null,
        isActive: true,
      },
    });

    return successResponse(alert, "Delay alert created", 201);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
