import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { verifyToken } from "../../../../../../backend/utils/jwt";
import { generateToken } from "../../../../../../backend/utils/jwt";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

interface HospitalSelectionPayload {
  phone: string;
  hospitalIds: string[];
  patientIds: string[];
  purpose: string;
  jti: string;
}

const consumed = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const selectionToken = body.selectionToken || req.cookies.get("patient_select_token")?.value;
    const { hospitalId } = body;
    if (!selectionToken || !hospitalId) return errorResponse("selectionToken and hospitalId are required", 400);

    const payload = verifyToken(selectionToken) as HospitalSelectionPayload | null;
    if (!payload || payload.purpose !== "hospital_select") return errorResponse("Invalid or expired selection token", 401);
    if (!payload.hospitalIds?.includes(hospitalId)) return errorResponse("Hospital not eligible", 403);
    if (consumed.has(payload.jti)) return errorResponse("Selection token already consumed", 401);

    const digits = payload.phone;
    const patients = await prisma.patient.findMany({
      where: { hospitalId, isActive: true, OR: [{ phone: digits }, { phone: { contains: digits } }] },
      select: { id: true, name: true, patientId: true, phone: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    if (patients.length === 0) return errorResponse("Registered patient not found", 404);

    consumed.add(payload.jti);

    const patientIds = patients.map(p => p.id);
    const patientSelectToken = generateToken({ phone: digits, hospitalId, patientIds, purpose: "patient_select", jti: crypto.randomUUID() }, "5m");
    const response = successResponse({ patients, patientSelectToken }, "Select your patient profile");
    const secureFlag = process.env.NODE_ENV === "production";
    response.cookies.set({ name: "patient_select_token", value: patientSelectToken, httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 300 });
    return response;
  } catch (e: any) {
    return errorResponse(e.message || "Failed", 500);
  }
}
