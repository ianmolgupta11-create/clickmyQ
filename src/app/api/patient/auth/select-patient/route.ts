import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { verifyToken } from "../../../../../../backend/utils/jwt";
import prisma from "../../../../../../backend/config/db";
import { generateToken } from "../../../../../../backend/utils/jwt";

export const dynamic = "force-dynamic";

interface SelectionPayload {
  phone: string;
  hospitalId: string;
  patientIds: string[];
  purpose: string;
  jti: string;
}

// Process-level set of consumed selection-token JTIs. This prevents replay
// of a selection token after it has been used. It is in-memory only and will
// not survive a server restart or multi-instance deployment; acceptable for
// the short 5-minute token lifetime.
const consumedSelectionTokens = new Set<string>();

/* ── POST /api/patient/auth/select-patient ──
   Consumes a short-lived `patient_select` token (issued by verify-otp when
   multiple patients share the same phone) and the caller's chosen patient id.
   Validates eligibility, marks the token as consumed, and issues a normal
   7-day `patient_session` cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const selectionToken = body.selectionToken || req.cookies.get("patient_select_token")?.value;
    const { patientId } = body;

    if (!selectionToken || !patientId) {
      return errorResponse("selectionToken and patientId are required", 400);
    }

    const payload = verifyToken(selectionToken) as SelectionPayload | null;
    if (!payload) {
      return errorResponse("Invalid or expired selection token", 401);
    }

    if (payload.purpose !== "patient_select") {
      return errorResponse("Invalid token purpose", 401);
    }

    if (!payload.patientIds || !Array.isArray(payload.patientIds)) {
      return errorResponse("Invalid token payload", 401);
    }

    if (consumedSelectionTokens.has(payload.jti)) {
      return errorResponse("Selection token already consumed", 401);
    }

    // Verify the requested patient is among the eligible ids and belongs to
    // the same hospital/phone context.
    if (!payload.patientIds.includes(patientId)) {
      return errorResponse("Selected patient is not eligible for this session", 403);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId: payload.hospitalId, isActive: true },
      select: {
        id: true, name: true, patientId: true, phone: true, email: true,
        gender: true, dateOfBirth: true, bloodGroup: true, address: true,
        patientType: true, allergies: true,
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404);
    }

    // Mark the selection token as consumed before issuing the session token.
    consumedSelectionTokens.add(payload.jti);

    const token = generateToken(
      { userId: patient.id, role: "PATIENT", patientId: patient.id, hospitalId: payload.hospitalId },
      "7d"
    );

    const response = successResponse({ patient }, "Login successful");
    const secureFlag = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: "patient_session",
      value: token,
      httpOnly: true,
      secure: secureFlag,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.set({ name: "patient_select_token", value: "", httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (e: any) {
    return errorResponse(e.message || "Failed to select patient", 500);
  }
}
