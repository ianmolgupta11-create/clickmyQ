import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requirePatient } from "../../../../../../backend/middlewares/patient.middleware";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

function safeParse(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text; // plain-text fallback
  }
}

/* ── GET /api/patient/me/prescriptions — this patient's prescriptions ── */
export async function GET(req: NextRequest) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

  try {
    const rows = await prisma.prescription.findMany({
      where: { patientId: patient.id, hospitalId: patient.hospitalId },
      include: {
        doctor: { select: { id: true, name: true, specialization: true } },
        appointment: { select: { id: true, appointmentDate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const prescriptions = rows.map((r: any) => ({
      id: r.id,
      appointmentId: r.appointment?.id || null,
      prescriptionNo: r.prescriptionNo,
      date: r.appointment?.appointmentDate || r.createdAt,
      doctorName: r.doctor?.name || null,
      chiefComplaint: r.chiefComplaint,
      diagnosis: r.diagnosis,
      medications: safeParse(r.medications) || [],
      labTests: safeParse(r.labTests),
      advice: safeParse(r.advice) || [],
      followUpDate: r.followUpDate,
      followUpNotes: r.followUpNotes,
      status: r.status,
    }));

    return successResponse(prescriptions, "Prescriptions fetched");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
