import { NextRequest } from "next/server";
import { requireRole } from "../../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { updateAppointment, AppointmentServiceError } from "../../../../../../backend/services/appointment.service";

export const dynamic = "force-dynamic";

/* ── POST /api/appointments/[id]/checkin ──
   Receptionist marks the patient as arrived → status CHECKED_IN + checkedInAt stamped.
   The patient then appears in the live waiting queue with their wait timer running. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["HOSPITAL_ADMIN", "RECEPTIONIST", "STAFF"]);
  if (auth.error) return auth.error;

  try {
    const updated = await updateAppointment(params.id, auth.hospitalId, { status: "CHECKED_IN" });
    return successResponse(
      { id: updated.id, status: (updated as any).status, checkedInAt: (updated as any).checkedInAt },
      "Patient checked in"
    );
  } catch (e: any) {
    if (e instanceof AppointmentServiceError) return errorResponse(e.message, e.status, { code: e.code });
    return errorResponse(e.message, 500);
  }
}
