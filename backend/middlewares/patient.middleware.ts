import { NextRequest } from "next/server";
import { verifyToken } from "../utils/jwt";
import { errorResponse } from "../utils/response";
import prisma from "../config/db";

/* ── Patient authentication middleware ──
   Separate from staff auth: verifies the `patient_session` cookie
   (JWT with role PATIENT + patientId), loads the patient record and
   enforces hospital scoping so a patient can only ever read their
   own data from their own hospital. */

export async function requirePatient(req: NextRequest) {
  let token = "";
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    token = req.cookies.get("patient_session")?.value || "";
  }

  if (!token) {
    return { patient: null, error: errorResponse("Please log in to continue", 401) };
  }

  const payload = verifyToken(token);
  if (!payload || payload.role !== "PATIENT" || !payload.patientId) {
    return { patient: null, error: errorResponse("Session expired. Please log in again.", 401) };
  }

  const patient = await prisma.patient
    .findUnique({
      where: { id: payload.patientId },
      include: {
         hospital: {
           select: { id: true, name: true, settings: { select: { bookingSlug: true, logo: true } } },
         },
      },
    })
    .catch(() => null);

  if (!patient || !patient.isActive) {
    return { patient: null, error: errorResponse("Session expired. Please log in again.", 401) };
  }

  return { patient, error: null };
}
