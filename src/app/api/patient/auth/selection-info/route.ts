import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { verifyToken } from "../../../../../../backend/utils/jwt";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("patient_select_token")?.value;
    if (!token) return errorResponse("No selection token", 401);

    const payload = verifyToken(token) as any;
    if (!payload) return errorResponse("Invalid or expired selection token", 401);

    if (payload.purpose === "hospital_select") {
      const hospitals = await prisma.hospital.findMany({
        where: { id: { in: payload.hospitalIds } },
        select: { id: true, name: true },
      });
      const counts = await Promise.all(hospitals.map(async (h) => {
        const c = await prisma.patient.count({ where: { hospitalId: h.id, isActive: true, phone: { in: [payload.phone] } } });
        return { id: h.id, name: h.name, patientCount: c || 1 };
      }));
      return successResponse({ mode: "hospital", hospitals: counts }, "Selection info");
    }

    if (payload.purpose === "patient_select") {
      const patients = await prisma.patient.findMany({
        where: { id: { in: payload.patientIds } },
        select: { id: true, patientId: true, name: true, phone: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      return successResponse({ mode: "patient", patients }, "Selection info");
    }

    return errorResponse("Invalid token purpose", 401);
  } catch (e: any) {
    return errorResponse(e.message || "Failed", 500);
  }
}
