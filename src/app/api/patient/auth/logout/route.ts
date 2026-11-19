import { NextRequest } from "next/server";
import { successResponse } from "../../../../../../backend/utils/response";

export const dynamic = "force-dynamic";

/* ── POST /api/patient/auth/logout — clear the patient session cookie ── */
export async function POST(_req: NextRequest) {
  const response = successResponse(null, "Logged out");
  response.cookies.set({
    name: "patient_session",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
