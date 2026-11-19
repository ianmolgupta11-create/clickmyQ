import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../../backend/utils/response";
import { requirePatient } from "../../../../../../../backend/middlewares/patient.middleware";
import prisma from "../../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

/* ── GET /api/patient/me/prescriptions/[appointmentId]
     One of this patient's own prescriptions, matched by appointment id
     (falls back to the prescription id). Scoped to the logged-in patient and
     their hospital, and includes the hospital settings so the letterhead
     travels with the payload. */
export async function GET(req: NextRequest, { params }: { params: { appointmentId: string } }) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

  const id = params.appointmentId;
  if (!id) return errorResponse("Prescription id is required", 400);

  try {
    const rx = await prisma.prescription.findFirst({
      where: {
        hospitalId: patient.hospitalId,
        patientId: patient.id,
        OR: [{ appointmentId: id }, { id }],
      },
      include: {
        patient: true,
        doctor: { include: { department: true, hospital: { include: { settings: true } } } },
        appointment: true,
      },
    });

    if (!rx) return successResponse(null, "No prescription found");
    return successResponse(rx, "Prescription fetched");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load prescription";
    return errorResponse(message, 500);
  }
}
