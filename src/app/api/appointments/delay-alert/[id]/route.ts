import { NextRequest } from "next/server";
import { requireRole } from "../../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import prisma from "../../../../../../backend/config/db";

const ALLOWED_ROLES = ["HOSPITAL_ADMIN", "RECEPTIONIST", "STAFF", "DOCTOR", "SUB_DEPT_HEAD", "DEPT_HEAD"];
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const px = prisma as any;

// PUT /api/appointments/delay-alert/[id]/resolve - resolve/clear alert
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ALLOWED_ROLES);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const alert = await px.appointmentDelayAlert.findFirst({
      where: { id, hospitalId: auth.hospitalId },
    });
    if (!alert) return errorResponse("Delay alert not found", 404);

    const updated = await px.appointmentDelayAlert.update({
      where: { id },
      data: { isActive: false, resolvedAt: new Date(), resolvedByUserId: (auth as any).user?.id || null },
    });

    return successResponse(updated, "Delay alert resolved");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
