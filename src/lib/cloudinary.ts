/**
 * Client-safe Cloudinary helpers.
 *
 * NOTE: keep this file free of server-only imports (the `cloudinary` SDK) —
 * it is bundled into the browser.
 */

export const CLOUDINARY_UPLOAD_URL = "/api/upload";

/**
 * Derive the Cloudinary public id from an asset URL.
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v123/f_auto,q_auto/hms/hospitals/x/logo.png
 *   → hms/hospitals/x/logo
 */
export const publicIdFromUrl = (url: string): string => {
  if (!url) return "";

  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return "";

  const rest = url.slice(idx + marker.length).split("?")[0];
  const segments = rest.split("/").filter(Boolean);

  // Drop an optional transformation segment (f_auto,q_auto,...) and/or a
  // version segment (v1234567890). Our folders always start with "hms",
  // which has no underscore, so a real folder segment is never mistaken
  // for a transformation.
  const isTransform = (s: string) =>
    /^[a-z]+_[a-z0-9.]+(,[a-z]+_[a-z0-9.]+)*$/i.test(s);
  const isVersion = (s: string) => /^v\d+$/i.test(s);

  while (
    segments.length &&
    (isTransform(segments[0]) || isVersion(segments[0]))
  ) {
    segments.shift();
  }

  if (!segments.length) return "";

  // Strip the file extension from the last segment (public ids keep it for
  // some resource types, but images are stored without one).
  const last = segments[segments.length - 1];
  segments[segments.length - 1] = last.replace(/\.[a-z0-9]+$/i, "");

  return segments.join("/");
};

/**
 * Delete an uploaded asset from Cloudinary.
 * Returns true when the asset was removed (or was already gone).
 */
export const deleteUploadedFile = async (url: string): Promise<boolean> => {
  const publicId = publicIdFromUrl(url);
  if (!publicId) return false;

  try {
    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.success;
  } catch {
    return false;
  }
};

const DOCUMENT_FORMATS = [
  "pdf", "zip", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv",
];

/** True when the URL points at a non-image file (PDF, ZIP, ...). */
export const isDocumentUrl = (url: string): boolean => {
  if (!url) return false;
  const m = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return !!m && DOCUMENT_FORMATS.includes(m[1].toLowerCase());
};

/**
 * URL to use when linking to an uploaded file.
 *
 * Images are served straight from the Cloudinary CDN. Documents are not
 * publicly deliverable, so they are routed through the authenticated
 * `/api/upload/file` proxy instead.
 */
export const deliveryUrl = (url: string): string => {
  if (!url || !isDocumentUrl(url)) return url;
  const publicId = publicIdFromUrl(url);
  if (!publicId) return url;
  return `${CLOUDINARY_UPLOAD_URL}/file?publicId=${encodeURIComponent(publicId)}`;
};
