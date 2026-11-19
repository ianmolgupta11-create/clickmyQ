import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import {
  summarizeChiefComplaint,
  ComplaintSummaryError,
} from "../../../../../backend/services/complaint-summary.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_ROLES = ["DOCTOR", "HOSPITAL_ADMIN"];

/* ── POST /api/prescriptions/complaint-summary ──
   Takes a raw doctor↔patient conversation transcript (Hindi / Hinglish / English),
   translates it to English and returns a concise clinical chief-complaint summary
   that the doctor can drop straight into the Chief Complaint field. */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ALLOWED_ROLES);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const transcriptText = String(body?.transcriptText || "").trim();
    if (!transcriptText) {
      return errorResponse("Transcript is required — record the conversation first", 400);
    }

    const result = await summarizeChiefComplaint(transcriptText, {
      language: body?.language || undefined,
      patientName: body?.patientName || undefined,
      doctorName: body?.doctorName || undefined,
    });

    return successResponse(result, "Chief complaint summarised");
  } catch (e: any) {
    if (e instanceof ComplaintSummaryError) return errorResponse(e.message, e.status);
    console.error("[Complaint AI] API error:", e);
    return errorResponse(e.message || "Could not summarise the conversation", 500);
  }
}
