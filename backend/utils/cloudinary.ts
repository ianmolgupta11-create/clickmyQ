import { v2 as cloudinary } from "cloudinary";

/**
 * Central Cloudinary configuration + upload rules.
 *
 * Every asset lives under `hms/hospitals/{hospitalId}/...` so that a hospital
 * can only ever list or delete its own files. Accounts without a hospital
 * (platform SUPER_ADMIN) fall back to `hms/platform/...`.
 */

export const CLOUDINARY_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

export const isCloudinaryConfigured = () =>
  CLOUDINARY_ENV_VARS.every((k) => !!process.env[k]?.trim());

export const cloudinaryConfig = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

export const UPLOAD_ROLES = [
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "STAFF",
  "SUB_DEPT_HEAD",
  "DEPT_HEAD",
  "FINANCE_HEAD",
  "SUPER_ADMIN",
];

/** Upload kinds that carry an image (and may be transformed). */
export const IMAGE_UPLOAD_TYPES = [
  "image",
  "profile",
  "signature",
  "stamp",
  "patient-photo",
  "logo",
  "inventory",
  "blog",
];

/** Upload kinds that may also carry a PDF. */
export const DOC_UPLOAD_TYPES = [
  "document",
  "patient-document",
  "letterhead",
];

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const DOC_MIME_TYPES = [...IMAGE_MIME_TYPES, "application/pdf"];

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_DOC_SIZE = 10 * 1024 * 1024;

export const isDocUploadType = (type: string) =>
  DOC_UPLOAD_TYPES.includes(type) || type === "document";

/**
 * Resolve the Cloudinary folder for an upload kind.
 * Every folder is namespaced by hospital so deletes can be scoped safely.
 */
export const resolveFolder = (
  uploadType: string,
  ctx: { hospitalId?: string | null; userId?: string | null }
): string => {
  const hid = (ctx.hospitalId || "").trim();
  const uid = (ctx.userId || "").trim();

  // Platform accounts (SUPER_ADMIN) have no hospital — keep their assets apart.
  if (!hid) {
    return `hms/platform/${uploadType}`;
  }

  switch (uploadType) {
    case "document":
      return `hms/hospitals/${hid}/doctors/documents`;
    case "signature":
      return `hms/hospitals/${hid}/doctors/${uid || "shared"}/signatures`;
    case "stamp":
      return `hms/hospitals/${hid}/doctors/${uid || "shared"}/stamps`;
    case "profile":
      return `hms/hospitals/${hid}/doctors/profiles`;
    case "patient-photo":
      return `hms/hospitals/${hid}/patients/photos`;
    case "patient-document":
      return `hms/hospitals/${hid}/patients/documents`;
    case "logo":
      return `hms/hospitals/${hid}/logos`;
    case "letterhead":
      return `hms/hospitals/${hid}/letterheads`;
    case "inventory":
      return `hms/hospitals/${hid}/inventory`;
    case "blog":
      return `hms/hospitals/${hid}/blog`;
    default:
      return `hms/hospitals/${hid}/images`;
  }
};

/**
 * Root prefix that the caller is allowed to read or delete assets from.
 * Everything outside this prefix is off-limits.
 */
export const allowedAssetRoot = (hospitalId?: string | null): string => {
  const hid = (hospitalId || "").trim();
  return hid ? `hms/hospitals/${hid}/` : "hms/platform/";
};

/** @deprecated kept for readability at delete call sites */
export const allowedDeleteRoot = allowedAssetRoot;

/**
 * Server-side transform applied to image uploads.
 * Signatures, stamps and letterheads are left untouched — they need exact
 * print fidelity, so no re-encoding and no resizing.
 */
export const buildTransform = (
  uploadType: string
): { width: number; height: number; crop: string; quality: string; fetch_format: string } | null => {
  if (!IMAGE_UPLOAD_TYPES.includes(uploadType)) return null;
  if (uploadType === "signature" || uploadType === "stamp" || uploadType === "letterhead") {
    return null;
  }
  return {
    width: 1600,
    height: 1600,
    crop: "limit",
    quality: "auto",
    fetch_format: "auto",
  };
};

/** Validate the file's declared MIME type against the upload kind. */
export const validateMimeType = (
  uploadType: string,
  mimeType: string
): { ok: true } | { ok: false; message: string } => {
  const mime = (mimeType || "").toLowerCase().split(";")[0].trim();

  if (isDocUploadType(uploadType)) {
    if (!DOC_MIME_TYPES.includes(mime)) {
      return {
        ok: false,
        message: `Unsupported file type "${mime || "unknown"}". Allowed: JPG, PNG, WebP, GIF, PDF.`,
      };
    }
    return { ok: true };
  }

  if (!IMAGE_MIME_TYPES.includes(mime)) {
    return {
      ok: false,
      message: `Unsupported file type "${mime || "unknown"}". Allowed: JPG, PNG, WebP, GIF.`,
    };
  }
  return { ok: true };
};

export const maxSizeFor = (uploadType: string) =>
  isDocUploadType(uploadType) ? MAX_DOC_SIZE : MAX_IMAGE_SIZE;
