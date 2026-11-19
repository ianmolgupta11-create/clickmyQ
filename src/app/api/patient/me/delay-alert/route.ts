import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requirePatient } from "../../../../../../backend/middlewares/patient.middleware";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

// GET /api/patient/me/delay-alert - get active delay alert for patient's active appointment today
export async function GET(req: NextRequest) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appt = await prisma.appointment.findFirst({
      where: { patientId: patient.id, hospitalId: patient.hospitalId, appointmentDate: { gte: today, lt: tomorrow } },
      orderBy: { createdAt: "desc" },
    });
    if (!appt) {
      return successResponse({ delayAlert: null }, "No active appointment");
    }

    const alert = await (prisma as any).appointmentDelayAlert.findFirst({
      where: { appointmentId: appt.id, hospitalId: patient.hospitalId, patientId: patient.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return successResponse({ delayAlert: alert || null }, "Delay alert fetched");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
