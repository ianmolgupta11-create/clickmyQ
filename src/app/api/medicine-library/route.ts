import { NextRequest } from "next/server";
import { requireRole } from "../../../../backend/middlewares/role.middleware";
import { errorResponse, successResponse } from "../../../../backend/utils/response";
import { searchHospitalMedicines } from "../../../../backend/services/medicine-library.service";

const ALLOWED_ROLES = ["DOCTOR", "HOSPITAL_ADMIN"];

export const dynamic = "force-dynamic";

// GET /api/medicine-library?q=panto&limit=20
// The hospital is always taken from the authenticated session.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ALLOWED_ROLES);
  if (auth.error) return auth.error;

  try {
    const query = req.nextUrl.searchParams.get("q") || "";
    const parsedLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const medicines = await searchHospitalMedicines(auth.hospitalId, query, Number.isFinite(parsedLimit) ? parsedLimit : 20);
    return successResponse(medicines, "Medicine library fetched");
  } catch (error: unknown) {
    console.error("Medicine library search failed:", error instanceof Error ? error.message : error);
    return errorResponse("Could not search the medicine library", 500);
  }
}
