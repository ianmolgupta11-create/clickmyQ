import { NextRequest } from "next/server";
import { requireRole } from "../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../backend/utils/response";
import {
  UPLOAD_ROLES,
  allowedDeleteRoot,
  buildTransform,
  cloudinaryConfig,
  isCloudinaryConfigured,
  maxSizeFor,
  resolveFolder,
  validateMimeType,
} from "../../../../backend/utils/cloudinary";

export const dynamic = "force-dynamic";

// POST /api/upload — upload a file to Cloudinary
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, UPLOAD_ROLES);
  if (auth.error) return auth.error;

  if (!isCloudinaryConfigured()) {
    return errorResponse(
      "File upload is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.",
      503
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const uploadType = (formData.get("type") as string) || "image";

    if (!file) return errorResponse("No file provided", 400);

    const maxSize = maxSizeFor(uploadType);
    if (file.size > maxSize) {
      return errorResponse(
        `File too large. Max size is ${maxSize / (1024 * 1024)}MB`,
        400
      );
    }

    // Reject unsupported file types before anything reaches Cloudinary.
    const mime = validateMimeType(uploadType, file.type || "");
    if (!mime.ok) return errorResponse(mime.message, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = resolveFolder(uploadType, {
      hospitalId: auth.hospitalId,
      userId: auth.user?.userId,
    });

    const transform = buildTransform(uploadType);
    const cloudinary = cloudinaryConfig();

    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: "auto",
            allowed_formats: ["jpg", "jpeg", "png", "pdf", "webp", "gif"],
            ...(transform ? { transformation: transform } : {}),
          },
          (error, res) => {
            if (error) {
              reject(error);
            } else {
              resolve(res);
            }
          }
        )
        .end(buffer);
    });

    return successResponse(
      { url: result.secure_url, publicId: result.public_id, format: result.format },
      "File uploaded successfully"
    );
  } catch (e: any) {
    return errorResponse(e.message || "Upload failed", 500);
  }
}

// DELETE /api/upload — remove an asset this hospital owns
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, UPLOAD_ROLES);
  if (auth.error) return auth.error;

  if (!isCloudinaryConfigured()) {
    return errorResponse(
      "File upload is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.",
      503
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { publicId?: string };
    const publicId = (body?.publicId || "").trim();

    if (!publicId) return errorResponse("publicId is required", 400);

    // Only allow deleting assets inside the caller's own hospital root.
    const root = allowedDeleteRoot(auth.hospitalId);
    if (!publicId.startsWith(root)) {
      return errorResponse("Forbidden: asset does not belong to this hospital", 403);
    }

    const cloudinary = cloudinaryConfig();
    await cloudinary.uploader.destroy(publicId);

    return successResponse({ deleted: true, publicId }, "File deleted successfully");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return errorResponse(message, 500);
  }
}
