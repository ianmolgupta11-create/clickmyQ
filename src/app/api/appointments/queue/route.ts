import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import { getQueue } from "../../../../../backend/services/appointment.service";

export const dynamic = "force-dynamic";

/* ── GET /api/appointments/queue?date&doctorId&departmentId&emergencyOnly ──
   Live OPD queue: grouped waiting/in-progress/completed + wait-time analytics.
   Powers receptionist queue tab and doctor "Call Next".
   Pass emergencyOnly=1 to get only EMERGENCY-type appointments. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["HOSPITAL_ADMIN", "RECEPTIONIST", "STAFF", "DOCTOR", "SUB_DEPT_HEAD"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const queue = await getQueue(auth.hospitalId, {
      date: searchParams.get("date") || undefined,
      doctorId: searchParams.get("doctorId") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      emergencyOnly: searchParams.get("emergencyOnly") === "1",
    });
    return successResponse(queue, "Queue fetched");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}