/**
 * Client-side helpers for hospital letterheads.
 *
 * A letterhead lives on `HospitalSettings.letterhead` as a Cloudinary URL and
 * may be an image (IMAGE) or a PDF (PDF). Browsers can neither render a PDF in
 * an <img> tag nor draw one onto a canvas, so PDF letterheads are rasterised
 * to a PNG of their first page through a Cloudinary URL transformation
 * (`f_png,pg_1`).
 *
 * NOTE: keep this file free of server-only imports — it is bundled into the
 * browser.
 */

export type Letterhead = {
  /** Transformed URL usable in an <img> tag or a CSS background. */
  url: string;
  /** Data URL of the rasterised letterhead, ready for jsPDF `addImage`. */
  dataUrl: string;
  /** Natural pixel dimensions of the letterhead image. */
  width: number;
  height: number;
  /**
   * Fraction of the image height at which the header artwork ends, i.e. below
   * which the prescription body may start.
   */
  headerEnd: number;
  /**
   * Fraction of the image height at which the footer artwork starts, i.e. above
   * which the prescription body must end.
   */
  footerStart: number;
};

/** Matches a letterhead URL that points at a PDF file. */
const PDF_EXT = /\.pdf$/i;

/** Fallbacks used when the artwork cannot be located inside the letterhead. */
const DEFAULT_HEADER_END = 0.16;
const DEFAULT_FOOTER_START = 0.87;

/**
 * Convert a stored letterhead URL into one a browser can display.
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v1/.../letterhead.pdf
 *   → https://res.cloudinary.com/<cloud>/image/upload/f_png,pg_1/v1/.../letterhead.png
 */
export const letterheadImageUrl = (raw?: string | null): string => {
  if (!raw) return "";
  if (PDF_EXT.test(raw) || raw.includes("/raw/upload/")) {
    return raw.replace("/upload/", "/upload/f_png,pg_1/").replace(PDF_EXT, ".png");
  }
  return raw;
};

const cache = new Map<string, Promise<Letterhead | null>>();

/** Read a cross-origin image into a data URL without going through a canvas. */
const fetchAsDataUrl = async (url: string): Promise<string> => {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) return "";
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
};

/**
 * Locate the artwork inside a letterhead.
 *
 * A letterhead is a full-page background: a header block at the top, a footer
 * block at the bottom and (usually) a faint watermark in between. The
 * prescription body has to be laid out between the header and the footer, so
 * we scan the image row by row and find where the ink is.
 *
 * Returns the bottom of the top artwork block and the top of the bottom
 * artwork block, both as a fraction of the image height.
 */
const findArtwork = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { headerEnd: number; footerStart: number } => {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;

    // A row counts as "inked" when more than 2% of it is not near-white.
    const inked: number[] = [];
    const step = 2;
    const samples = Math.ceil(width / step);
    const threshold = samples * 0.02;
    for (let y = 0; y < height; y++) {
      let n = 0;
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (l < 245) n++;
      }
      inked.push(n > threshold ? 1 : 0);
    }

    // Group consecutive inked rows into runs, then merge runs separated by a
    // gap of up to 3% of the height (the letterhead often has thin rules and
    // small gaps inside its header block).
    const runs: Array<[number, number]> = [];
    let start = -1;
    for (let y = 0; y < height; y++) {
      if (inked[y]) { if (start < 0) start = y; }
      else if (start >= 0) { runs.push([start, y - 1]); start = -1; }
    }
    if (start >= 0) runs.push([start, height - 1]);

    const maxGap = Math.max(2, Math.round(height * 0.03));
    const merged: Array<[number, number]> = [];
    for (const run of runs) {
      const last = merged[merged.length - 1];
      if (last && run[0] - last[1] - 1 <= maxGap) last[1] = run[1];
      else merged.push([run[0], run[1]]);
    }

    // A single block covering the whole page means a full-bleed design with no
    // usable header/footer split — fall back to sane defaults.
    if (merged.length < 2) {
      return { headerEnd: DEFAULT_HEADER_END, footerStart: DEFAULT_FOOTER_START };
    }

    const headerEnd = merged[0][1] / height;
    const footerStart = merged[merged.length - 1][0] / height;
    if (footerStart - headerEnd < 0.3) {
      return { headerEnd: DEFAULT_HEADER_END, footerStart: DEFAULT_FOOTER_START };
    }
    return { headerEnd, footerStart };
  } catch {
    return { headerEnd: DEFAULT_HEADER_END, footerStart: DEFAULT_FOOTER_START };
  }
};

/**
 * Load a letterhead and return its display URL, rasterised data URL, natural
 * dimensions and the artwork offsets the document layout is derived from.
 *
 * Resolves to `null` when the letterhead is missing or cannot be loaded, so
 * callers can degrade gracefully instead of silently producing a PDF without
 * a background.
 */
export const loadLetterhead = (raw?: string | null): Promise<Letterhead | null> => {
  const url = letterheadImageUrl(raw);
  if (!url) return Promise.resolve(null);

  const cached = cache.get(url);
  if (cached) return cached;

  const pending = new Promise<Letterhead | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) { resolve(null); return; }

      let dataUrl = "";
      let artwork = { headerEnd: DEFAULT_HEADER_END, footerStart: DEFAULT_FOOTER_START };
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          artwork = findArtwork(ctx, width, height);
          // JPEG keeps the generated PDF small; the letterhead is a background.
          dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        }
      } catch {
        // Canvas tainted by the origin — fall back to reading the bytes.
        dataUrl = "";
      }
      if (!dataUrl) {
        try { dataUrl = await fetchAsDataUrl(url); } catch { dataUrl = ""; }
      }
      resolve({ url, dataUrl, width, height, ...artwork });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  cache.set(url, pending);
  // Never cache a failure — a transient network error should not permanently
  // strip the letterhead from the session.
  pending.then((r) => { if (!r) cache.delete(url); });
  return pending;
};

/** Paper sizes a hospital can pick for its letterhead. */
export type LetterheadPageFormat = "a4" | "a5" | "letter";

/**
 * Map the `letterheadSize` setting to a jsPDF page format.
 *
 * The same mapping is used by the bill, pharmacy and pathology documents, so
 * every document of a hospital prints on the same paper.
 */
export const letterheadPageFormat = (size?: string | null): LetterheadPageFormat => {
  const s = (size || "A4").toLowerCase();
  if (s === "a5" || s === "letter") return s;
  return "a4";
};

/**
 * Margins (mm) for the document body, derived from where the letterhead
 * artwork starts and ends.
 *
 * The body is placed between the header block and the footer block of the
 * letterhead, so it can never overlap them no matter how the artwork is laid
 * out.
 */
export const letterheadMargins = (
  lh: Pick<Letterhead, "headerEnd" | "footerStart">,
  pageH: number,
  gapMm = 5
) => ({
  top: lh.headerEnd * pageH + gapMm,
  bottom: (1 - lh.footerStart) * pageH + gapMm,
});

/**
 * Padding for the on-screen preview, as a percentage of the container width.
 *
 * Percentage padding resolves against the width, and the letterhead is drawn
 * at `100% auto`, so the artwork offsets have to be converted through the
 * letterhead's aspect ratio first.
 */
export const letterheadScreenPadding = (
  lh: Pick<Letterhead, "headerEnd" | "footerStart" | "width" | "height">,
  gapPctOfWidth = 2
) => {
  const ratio = lh.height / lh.width;
  return {
    topPct: lh.headerEnd * ratio * 100 + gapPctOfWidth,
    bottomPct: (1 - lh.footerStart) * ratio * 100 + gapPctOfWidth,
  };
};
