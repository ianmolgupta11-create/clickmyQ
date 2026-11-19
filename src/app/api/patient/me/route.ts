import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import { requirePatient } from "../../../../../backend/middlewares/patient.middleware";

export const dynamic = "force-dynamic";

/* ── GET /api/patient/me — the logged-in patient's own profile ── */
export async function GET(req: NextRequest) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

    return successResponse(
    {
      id: patient.id,
      patientId: patient.patientId,
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      bloodGroup: patient.bloodGroup,
      address: patient.address,
      patientType: patient.patientType,
      allergies: patient.allergies,
      hospital: patient.hospital
        ? {
            id: patient.hospital.id,
            name: patient.hospital.name,
            logo: (patient.hospital as any).settings?.logo ?? null,
            bookingSlug: (patient.hospital as any).settings?.bookingSlug ?? null,
          }
        : null,
    },
    "Profile fetched"
  );
}
