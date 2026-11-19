import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requirePatient } from "../../../../../../backend/middlewares/patient.middleware";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

/* ── GET /api/patient/me/appointments — this patient's visits (newest first) ── */
export async function GET(req: NextRequest) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

  try {
    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id, hospitalId: patient.hospitalId },
      include: {
        doctor: { select: { id: true, name: true, specialization: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ appointmentDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    // ── Link each visit to its bill so the patient can see the consultation fee
    //    and whether it was already collected at the counter. ──
    const visitIds = appointments.map((a) => a.id);
    const bills = visitIds.length
      ? await prisma.bill.findMany({
          where: { visitId: { in: visitIds }, hospitalId: patient.hospitalId },
          select: {
            visitId: true, total: true, paidAmount: true,
            status: true, paymentMethod: true, paidAt: true,
          },
        })
      : [];
    const billByVisit = new Map(bills.map((b) => [b.visitId, b]));

    const result = appointments.map((a) => {
      const bill = billByVisit.get(a.id);
      const total = bill?.total ?? a.consultationFee ?? 0;
      const paid = bill?.paidAmount ?? 0;
      return {
        ...a,
        doctorName: a.doctor?.name || "",
        departmentName: a.department?.name || "",
        feeAmount: a.consultationFee ?? 0,
        billStatus: bill?.status || null,
        paymentStatus: bill?.status || null,
        isFeePaid: bill?.status === "PAID",
        paidAmount: paid,
        dueAmount: Math.max(0, total - paid),
        paymentMethod: bill?.paymentMethod || null,
        paidAt: bill?.paidAt || null,
      };
    });

    return successResponse(result, "Appointments fetched");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
