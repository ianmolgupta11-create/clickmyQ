import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { errorResponse } from "../../../../../backend/utils/response";
import {
  UPLOAD_ROLES,
  allowedAssetRoot,
  isCloudinaryConfigured,
} from "../../../../../backend/utils/cloudinary";

export const dynamic = "force-dynamic";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * GET /api/upload/file?publicId=...&download=1
 *
 * Streams an asset the caller owns.
 *
 * Cloudinary does not serve PDFs (and other non-image formats) from the public
 * CDN by default — the account's delivery ACL rejects them with a 401. So
 * documents are fetched here with the server-side API secret and streamed to
 * the browser. This also keeps patient documents and prescriptions private
 * instead of publicly linkable.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, UPLOAD_ROLES);
  if (auth.error) return auth.error;

  if (!isCloudinaryConfigured()) {
    return errorResponse("File delivery is not configured.", 503);
  }

  const publicId = (req.nextUrl.searchParams.get("publicId") || "").trim();
  if (!publicId) return errorResponse("publicId is required", 400);

  // Only assets inside the caller's own hospital root may be read.
  const root = allowedAssetRoot(auth.hospitalId);
  if (!publicId.startsWith(root)) {
    return errorResponse("Forbidden: asset does not belong to this hospital", 403);
  }

  const cloud = process.env.CLOUDINARY_CLOUD_NAME as string;
  const key = process.env.CLOUDINARY_API_KEY as string;
  const secret = process.env.CLOUDINARY_API_SECRET as string;

  const upstreamUrl =
    `https://api.cloudinary.com/v1_1/${cloud}/image/download` +
    `?public_id=${encodeURIComponent(publicId)}&type=upload`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      },
      cache: "no-store",
    });
  } catch {
    return errorResponse("Could not reach Cloudinary", 502);
  }

  if (!upstream.ok) {
    return errorResponse(
      upstream.status === 404 ? "File not found" : "Could not fetch the file",
      upstream.status === 404 ? 404 : 502
    );
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  const base = (publicId.split("/").pop() || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = EXT_BY_MIME[contentType.split(";")[0].trim()];
  const filename = base.includes(".") ? base : ext ? `${base}.${ext}` : base;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
