import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import { verifyMobileOTP } from "../../../../../../backend/services/otp.service";
import { generateToken } from "../../../../../../backend/utils/jwt";
import prisma from "../../../../../../backend/config/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  mobile: z.string().trim().min(10).max(15),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
  hospitalId: z.string().optional(),
  slug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const { mobile, otp, hospitalId: hidIn, slug } = parsed.data;

    let hid = hidIn || null;
    if (!hid && slug) {
      const s = await prisma.hospitalSettings.findUnique({
        where: { bookingSlug: slug },
        select: { hospitalId: true },
      });
      hid = s?.hospitalId || null;
    }

    const digits = mobile.replace(/\D/g, "").slice(-10);

    try {
      await verifyMobileOTP(digits, otp);
    } catch (e: any) {
      return errorResponse(e.message || "Invalid OTP", 400);
    }

    const patientSelect = {
      id: true, name: true, patientId: true, phone: true, email: true,
      gender: true, dateOfBirth: true, bloodGroup: true, address: true,
      patientType: true, allergies: true,
      hospital: { select: { id: true, name: true } },
    };

    if (hid) {
      const patients = await prisma.patient.findMany({
        where: { hospitalId: hid, isActive: true, OR: [{ phone: digits }, { phone: { contains: digits } }] },
        select: patientSelect,
        orderBy: { createdAt: "asc" },
      });
      if (patients.length === 0) return errorResponse("Registered patient not found", 404);
      if (patients.length === 1) {
        const patient = patients[0];
        const token = generateToken({ userId: patient.id, role: "PATIENT", patientId: patient.id, hospitalId: hid }, "7d");
        const response = successResponse({ patient }, "Login successful");
        const secureFlag = process.env.NODE_ENV === "production";
        response.cookies.set({ name: "patient_session", value: token, httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
        return response;
      }
      const patientIds = patients.map(p => p.id);
      const selectionToken = generateToken({ phone: digits, hospitalId: hid, patientIds, purpose: "patient_select", jti: crypto.randomUUID() }, "5m");
      const response = successResponse({ requiresSelection: true, patients: patients.map(p => ({ id: p.id, patientId: p.patientId, name: p.name, phone: p.phone, email: p.email })), selectionToken }, "Select your patient profile");
      const secureFlag = process.env.NODE_ENV === "production";
      response.cookies.set({ name: "patient_select_token", value: selectionToken, httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 300 });
      return response;
    }

    // no hospital context
    const patients = await prisma.patient.findMany({
      where: { isActive: true, OR: [{ phone: digits }, { phone: { contains: digits } }] },
      select: patientSelect,
      orderBy: { createdAt: "asc" },
    });
    if (patients.length === 0) return errorResponse("Registered patient not found", 404);

    // group by hospital
    const byHospital = new Map<string, any[]>();
    for (const p of patients) {
      const key = p.hospital.id;
      if (!byHospital.has(key)) byHospital.set(key, []);
      byHospital.get(key)!.push(p);
    }

    if (byHospital.size === 1) {
      const hidSingle = [...byHospital.keys()][0];
      const hpats = byHospital.get(hidSingle)!;
      if (hpats.length === 1) {
        const patient = hpats[0];
        const token = generateToken({ userId: patient.id, role: "PATIENT", patientId: patient.id, hospitalId: hidSingle }, "7d");
        const response = successResponse({ patient }, "Login successful");
        const secureFlag = process.env.NODE_ENV === "production";
        response.cookies.set({ name: "patient_session", value: token, httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
        return response;
      }
      const patientIds = hpats.map(p => p.id);
      const selectionToken = generateToken({ phone: digits, hospitalId: hidSingle, patientIds, purpose: "patient_select", jti: crypto.randomUUID() }, "5m");
      const response = successResponse({ requiresSelection: true, patients: hpats.map(p => ({ id: p.id, patientId: p.patientId, name: p.name, phone: p.phone, email: p.email })), selectionToken }, "Select your patient profile");
      const secureFlag = process.env.NODE_ENV === "production";
      response.cookies.set({ name: "patient_select_token", value: selectionToken, httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 300 });
      return response;
    }

    // multiple hospitals
    const hospitals = [...byHospital.entries()].map(([id, ps]) => ({
      id,
      name: ps[0].hospital.name,
      patientCount: ps.length,
    }));
    const hospitalIds = hospitals.map(h => h.id);
    const allPatientIds = patients.map(p => p.id);
    const hospitalSelectionToken = generateToken({ phone: digits, hospitalIds, patientIds: allPatientIds, purpose: "hospital_select", jti: crypto.randomUUID() }, "5m");
    const response = successResponse({ requiresHospitalSelection: true, hospitals, hospitalSelectionToken }, "Select your hospital");
    const secureFlag = process.env.NODE_ENV === "production";
    response.cookies.set({ name: "patient_select_token", value: hospitalSelectionToken, httpOnly: true, secure: secureFlag, sameSite: "lax", path: "/", maxAge: 300 });
    return response;
  } catch (e: any) {
    return errorResponse(e.message || "Login failed", e.message?.includes("OTP") ? 400 : 500);
  }
}
