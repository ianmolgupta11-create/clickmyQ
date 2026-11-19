import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { requirePatient } from "../../../../../../backend/middlewares/patient.middleware";
import prisma from "../../../../../../backend/config/db";

export const dynamic = "force-dynamic";

function safeParseItems(text: string | null): any[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ── GET /api/patient/me/bills — this patient's bills & payment status ── */
export async function GET(req: NextRequest) {
  const { patient, error } = await requirePatient(req);
  if (error) return error;

  try {
    const rows = await prisma.bill.findMany({
      where: { patientId: patient.id, hospitalId: patient.hospitalId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, billNo: true, items: true, subtotal: true, discount: true,
        tax: true, total: true, paidAmount: true, status: true, paidAt: true,
        paymentMethod: true, createdAt: true,
        billItems: {
          select: {
            id: true, type: true, name: true,
            quantity: true, unitPrice: true, amount: true,
          },
        },
      },
    });

    const bills = rows.map((b) => {
      // Appointment bills keep a JSON snapshot in `items` but their real line
      // items live in billItems — prefer the latter so the patient sees
      // "Consultation — Dr. X" instead of an empty list.
      const lineItems = (b.billItems || []).map((it) => ({
        id: it.id,
        type: it.type,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.amount,
      }));
      const items = lineItems.length ? lineItems : safeParseItems(b.items);
      const paidAmount = b.paidAmount || 0;

      return {
        id: b.id,
        billNo: b.billNo,
        title: items[0]?.name || "Bill",
        date: b.createdAt,
        billDate: b.createdAt,
        items,
        subtotal: b.subtotal,
        discount: b.discount,
        tax: b.tax,
        total: b.total,
        totalAmount: b.total,
        paidAmount,
        dueAmount: Math.max(0, (b.total || 0) - paidAmount),
        status: b.status,
        isPaid: b.status === "PAID",
        paidAt: b.paidAt,
        paymentMethod: b.paymentMethod,
      };
    });

    return successResponse(bills, "Bills fetched");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
