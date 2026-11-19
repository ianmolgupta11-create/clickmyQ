import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import { getQueue } from "../../../../../backend/services/appointment.service";
import prisma from "../../../../../backend/config/db";

export const dynamic = "force-dynamic";

async function resolveHospitalId(hid: string | null, slug: string | null): Promise<string | null> {
  if (hid) {
    const hospital = await prisma.hospital
      .findFirst({ where: { id: hid }, select: { id: true } })
      .catch(() => null);
    return hospital?.id || null;
  }
  if (slug) {
    const settings = await prisma.hospitalSettings.findUnique({
      where: { bookingSlug: slug },
      select: { hospitalId: true },
    });
    return settings?.hospitalId || null;
  }
  return null;
}

/* ── GET /api/public/queue?hid=HOSPITAL_ID or ?slug=SLUG [&departmentId] ──
   PUBLIC endpoint for the waiting-room "Now Serving" display board.
   Returns only non-sensitive fields: token numbers, doctor/dept names, hospital branding. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    const hid = await resolveHospitalId(searchParams.get("hid"), searchParams.get("slug"));
    if (!hid) return errorResponse("No hospital found. Please use a valid display link.", 404);

    const queue = await getQueue(hid, {
      date: searchParams.get("date") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
    });

    const hospital = await prisma.hospital.findUnique({
      where: { id: hid },
      select: { id: true, name: true },
    });
    const settings = await prisma.hospitalSettings
      .findUnique({ where: { hospitalId: hid }, select: { hospitalName: true, logo: true } })
      .catch(() => null);

    return successResponse(
      {
        hospital: {
          id: hospital?.id,
          name: settings?.hospitalName || hospital?.name || "Hospital",
          logo: settings?.logo || null,
        },
        nowServing: queue.nowServing,
        nextUp: queue.nextUp,
        stats: {
          waiting: queue.stats.waiting,
          avgWaitMin: queue.stats.avgWaitMin,
        },
      },
      "Public queue fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
