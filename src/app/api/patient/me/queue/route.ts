import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requirePatient } from "../../../../../../backend/middlewares/patient.middleware";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

const WAITING = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "RESCHEDULED"];

/* ── GET /api/patient/me/queue — live OPD queue position for this patient ──
   Shows the patient's own token, the doctor's current serving token,
   how many patients are ahead and an estimated wait — no other
   patients' personal data is exposed. */
export async function GET(req: NextRequest) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's appointment for this patient (most relevant active one first)
    const appts: any[] = await prisma.appointment.findMany({
      where: { patientId: patient.id, hospitalId: patient.hospitalId, appointmentDate: { gte: today, lt: tomorrow } },
      include: {
        doctor: { select: { id: true, name: true, specialization: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const active = appts.find((a) => [...WAITING, "IN_PROGRESS"].includes(a.status)) || appts[0] || null;
    if (!active) {
      return successResponse({ appointment: null, queue: null }, "No appointment today");
    }

    const base = {
      id: active.id,
      appointmentId: active.id,
      tokenNumber: active.tokenNumber,
      status: active.status,
      timeSlot: active.timeSlot,
      checkedIn: Boolean(active.checkedInAt),
      doctorName: active.doctor?.name || null,
      doctorSpecialization: active.doctor?.specialization || null,
      departmentName: active.department?.name || null,
    };

    // Diagnostic bookings (no doctor) have no token queue
    if (!active.doctorId || ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(active.status)) {
      return successResponse({ appointment: base, queue: null }, "Queue fetched");
    }

    // Same doctor, same day queue
    const doctorQueue: any[] = await prisma.appointment.findMany({
      where: {
        hospitalId: patient.hospitalId,
        doctorId: active.doctorId,
        appointmentDate: { gte: today, lt: tomorrow },
      },
      select: { id: true, tokenNumber: true, status: true, consultStartAt: true, consultEndAt: true },
    });

    // Doctor interruption status (Emergency / Break / ACTIVE) for the patient portal hero banner.
    const doctorRecord = await (prisma as any).doctor.findUnique({
      where: { id: active.doctorId },
      select: {
        id: true,
        status: true,
        statusStartedAt: true,
        expectedReturnAt: true,
        actualReturnAt: true,
      },
    });

    const nowServing = doctorQueue.find((a) => a.status === "IN_PROGRESS");
    const myToken = active.tokenNumber;

    const ahead = doctorQueue.filter(
      (a) => WAITING.includes(a.status) && a.id !== active.id && (myToken == null || (a.tokenNumber != null && a.tokenNumber < myToken))
    );
    const myPosition = ahead.length + 1;

    // Average consult duration today (fallback 10 min)
    const finished = doctorQueue.filter((a) => a.consultStartAt && a.consultEndAt);
    const avgConsultMin = finished.length
      ? Math.max(
          3,
          Math.round(
            finished.reduce((s, a) => s + (new Date(a.consultEndAt).getTime() - new Date(a.consultStartAt).getTime()) / 60000, 0) /
              finished.length
          )
        )
      : 10;

    const estimatedWaitMin = active.status === "IN_PROGRESS" ? 0 : ahead.length * avgConsultMin;

    return successResponse(
      {
        appointment: base,
        queue: {
          nowServingToken: nowServing?.tokenNumber ?? null,
          patientsAhead: ahead.length,
          myPosition,
          avgConsultMin,
          estimatedWaitMin,
        },
        doctorInterruption: doctorRecord
          ? {
              status: doctorRecord.status,
              statusStartedAt: doctorRecord.statusStartedAt,
              expectedReturnAt: doctorRecord.expectedReturnAt,
              actualReturnAt: doctorRecord.actualReturnAt,
            }
          : null,
      },
      "Queue fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
