"use client";
import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft, Phone, Mail, Calendar, Droplets, MapPin,
  Hash, AlertCircle, Loader2,
  CalendarCheck, Plus, X, Stethoscope, FileText, Eye,
  Activity, ChevronDown, ChevronUp, User, Heart, UserRound,
} from "lucide-react";
import {
  loadLetterhead, letterheadImageUrl, letterheadPageFormat,
  letterheadMargins, letterheadScreenPadding, type Letterhead,
} from "@/lib/letterhead";

const api = async (url: string, method = "GET", body?: any) => {
  const opts: any = { method, credentials: "include", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
};

/** Generate a prescription PDF (A4 portrait, letterhead on every page) for the given element.
 *  Reused by both Download PDF and Print so both produce identical output. */
const generateRxPDF = async (el: HTMLDivElement, hs: any, fname: string) => {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const lh = await loadLetterhead(hs?.letterhead);

  if (lh && lh.dataUrl) {
    const saved = {
      pt: el.style.paddingTop, pb: el.style.paddingBottom,
      bi: el.style.backgroundImage, ar: el.style.aspectRatio,
    };
    el.style.paddingTop = "0px";
    el.style.paddingBottom = "0px";
    el.style.backgroundImage = "none";
    el.style.aspectRatio = "auto";
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: "#ffffff" });
    } finally {
      el.style.paddingTop = saved.pt;
      el.style.paddingBottom = saved.pb;
      el.style.backgroundImage = saved.bi;
      el.style.aspectRatio = saved.ar || "";
    }

    const pageFormat = letterheadPageFormat(hs?.letterheadSize);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: pageFormat });
    const pgW = pdf.internal.pageSize.getWidth();
    const pgH = pdf.internal.pageSize.getHeight();
    const { top: topM, bottom: botM } = letterheadMargins(lh, pgH);
    const cH = pgH - topM - botM;
    const scaledH = (canvas.height * pgW) / canvas.width;

    const findSafeCut = (tgt: number): number => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return tgt;
      const sL = Math.round(canvas.width * 0.1), sR = Math.round(canvas.width * 0.9);
      const step = Math.max(1, Math.floor((sR - sL) / 40));
      for (let y = Math.min(tgt, canvas.height - 1); y > Math.max(0, tgt - 250); y--) {
        const row = ctx.getImageData(sL, y, sR - sL, 1).data;
        let w = 0, t = 0;
        for (let x = 0; x < (sR - sL) * 4; x += step * 4) { if (row[x] > 240 && row[x+1] > 240 && row[x+2] > 240) w++; t++; }
        if (t > 0 && w / t > 0.95) return y;
      }
      return tgt;
    };

    const pageHPx = Math.round((cH / scaledH) * canvas.height);
    let cut = 0, pg = 0;
    while (cut < canvas.height) {
      if (pg > 0) pdf.addPage(pageFormat);
      pdf.addImage(lh.dataUrl, "JPEG", 0, 0, pgW, pgH);
      const rawEnd = Math.min(cut + pageHPx, canvas.height);
      const safeCut = rawEnd >= canvas.height ? canvas.height : findSafeCut(rawEnd);
      const srcHt = safeCut - cut;
      if (srcHt <= 0) break;
      const sc = document.createElement("canvas");
      sc.width = canvas.width; sc.height = srcHt;
      sc.getContext("2d")!.drawImage(canvas, 0, cut, canvas.width, srcHt, 0, 0, canvas.width, srcHt);
      pdf.addImage(sc.toDataURL("image/jpeg", 0.95), "JPEG", 0, topM, pgW, (srcHt * pgW) / canvas.width);
      cut = safeCut;
      pg++;
      if (pg > 20) break;
    }
    return pdf;
  }

  const savedBi = el.style.backgroundImage;
  el.style.backgroundImage = "none";
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, logging: false });
  } finally {
    el.style.backgroundImage = savedBi;
  }
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdfW = 210;
  const pdfH = (canvas.height * pdfW) / canvas.width;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfW, pdfH] });
  pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
  return pdf;
};

export function PrescriptionModal({ appointmentId, onClose, zIndex = 300, scope = "staff" }: { appointmentId: string; onClose: () => void; zIndex?: number; scope?: "staff" | "patient" }) {
  const [loading, setLoading] = useState(true);
  const [rx, setRx] = useState<any>(null);
  const [error, setError] = useState("");
  const [dlPdf, setDlPdf] = useState(false);
  const [hSettings, setHSettings] = useState<any>(null);
  const [lh, setLh] = useState<Letterhead | null>(null);
  const rxDocRef = useRef<HTMLDivElement>(null);

  const doc = rx?.doctor;
  const h = doc?.hospital;
  const hs = h?.settings || hSettings;

  useEffect(() => {
    // Patients authenticate with their own session, which the staff endpoint
    // rejects — they get a patient-scoped endpoint that carries the same
    // payload (including the hospital letterhead).
    const endpoint = scope === "patient"
      ? `/api/patient/me/prescriptions/${appointmentId}`
      : `/api/prescriptions/by-appointment/${appointmentId}`;
    api(endpoint).then(d => {
      if (d.success) setRx(d.data);
      else setError(d.message || "Failed to load prescription");
      setLoading(false);
    }).catch(() => {
      setError("Failed to load prescription");
      setLoading(false);
    });
  }, [appointmentId, scope]);

  // Fallback: fetch hospital settings directly (in case prescription data doesn't include them).
  // Staff sessions only — the patient session is rejected by this endpoint.
  useEffect(() => {
    if (scope !== "staff") return;
    api("/api/config/settings").then(d => {
      if (d.success && d.data?.settings) setHSettings(d.data.settings);
    }).catch(() => {});
  }, [scope]);

  // Load the letterhead for the on-screen preview. The PDF generator does not
  // depend on this — it loads the letterhead itself — so a slow image can
  // never change the generated document.
  useEffect(() => {
    let active = true;
    loadLetterhead(hs?.letterhead).then((v) => { if (active) setLh(v); });
    return () => { active = false; };
  }, [hs?.letterhead]);

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Loader2 size={24} style={{ animation: "spin .7s linear infinite", color: "#0ea5e9" }} />
        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>Loading prescription...</span>
      </div>
    </div>
  );

  if (error || !rx) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", backdropFilter: "blur(4px)", zIndex, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 420, textAlign: "center" }}>
        <AlertCircle size={26} color="#dc2626" />
        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{error || "Prescription not found"}</span>
        <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );

  let s = {
    header: { showHospitalName: true, showHospitalAddress: true, showHospitalPhone: true, alignment: "left" },
    footer: { text: "This is a computer-generated prescription." },
    display: { showVitals: true, showDiagnosis: true, showIcdCodes: true, showReferrals: true },
    layout: { paperSize: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } }
  };
  if (doc?.prescriptionSettings) {
    try { s = JSON.parse(doc.prescriptionSettings); } catch {}
  }

  const vitals = rx?.vitals ? JSON.parse(rx.vitals) : {};
  const meds = rx?.medications ? JSON.parse(rx.medications) : [];
  const tests = rx?.labTests ? JSON.parse(rx.labTests) : [];
  const icd = rx?.icdCodes ? JSON.parse(rx.icdCodes) : [];
  const refs = rx?.referrals ? JSON.parse(rx.referrals) : [];

  const hasLh = !!hs?.letterhead;
  // Cloudinary PDF -> PNG (first page) so the browser can display it.
  const lhUrl = hasLh ? letterheadImageUrl(hs.letterhead) : "";
  // Body offsets follow the artwork inside the letterhead, so the content
  // clears its header and footer blocks.
  const lhPad = lh ? letterheadScreenPadding(lh) : { topPct: 16, bottomPct: 13 };

  return (
      <div className="rx-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", backdropFilter: "blur(4px)", zIndex, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @page :first {
          margin: 10mm;
        }
        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Strip the modal shell so only the prescription document prints. */
          .rx-modal-backdrop {
            position: static !important;
            display: block !important;
            background: none !important;
            backdrop-filter: none !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            z-index: auto !important;
          }
          .rx-modal-card {
            position: static !important;
            display: block !important;
            background: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .rx-modal-toolbar,
          .rx-modal-toolbar * {
            display: none !important;
          }
          /* The prescription document fills the printable A4 width. */
          .rx-letterhead-doc {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            aspectRatio: auto !important;
            overflow: visible !important;
            background-color: #fff !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div className="rx-modal-card" style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 850, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", position: "relative" }}>
        {/* Modal Controls */}
          <div className="rx-modal-toolbar" style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={18} color="#0ea5e9" />
            <span style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>Prescription Viewer</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={async () => {
                if (!rxDocRef.current) return;
                setDlPdf(true);
                try {
                  const fname = `Rx_${rx?.prescriptionNo || appointmentId}.pdf`;
                  const pdf = await generateRxPDF(rxDocRef.current, hs, fname);
                  pdf.save(fname);
                } catch (err) { console.error("PDF error:", err); }
                setDlPdf(false);
              }}
              disabled={dlPdf}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: dlPdf ? "#f0fdf4" : "#fff", color: dlPdf ? "#16a34a" : "#64748b", fontSize: 12, fontWeight: 700, cursor: dlPdf ? "not-allowed" : "pointer" }}
            >
              {dlPdf ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <FileText size={13} />}
              {dlPdf ? "Generating..." : "Download PDF"}
            </button>
            <button onClick={async () => {
              if (!rxDocRef.current) return;
              setDlPdf(true);
              try {
                const fname = `Rx_${rx?.prescriptionNo || appointmentId}.pdf`;
                const pdf = await generateRxPDF(rxDocRef.current, hs, fname);
                const blob = await pdf.output("blob");
                const url = URL.createObjectURL(blob);

                const win = window.open(url, "_blank");
                if (!win) {
                  // Popup blocked — fall back to download
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = fname;
                  a.click();
                  URL.revokeObjectURL(url);
                  setDlPdf(false);
                  return;
                }

                let done = false;
                const finish = () => {
                  if (done) return;
                  done = true;
                  try { win.print(); } catch {}
                  // Keep the window open so the user can print/save the PDF preview.
                };
                win.onload = finish;
                setTimeout(finish, 2500); // fallback if the PDF viewer never fires load
                // Intentionally do NOT close win: closing would dismiss the preview before printing.
                // Do NOT revoke the blob URL while the window is still displaying the PDF.
              } catch (err) { console.error("PDF error:", err); setDlPdf(false); }
            }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Print</button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}><X size={16} /></button>
          </div>
        </div>
          <div className="rx-letterhead-doc" ref={rxDocRef} style={{
            backgroundColor: "#fff",
            backgroundImage: hasLh ? `url(${lhUrl})` : "none",
            // "100% auto" keeps the letterhead at its own proportions — the
            // preview must not distort the hospital's artwork.
            backgroundSize: hasLh ? "100% auto" : "auto",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
            // One page tall while the content is shorter than the letterhead.
            aspectRatio: hasLh && lh ? `${lh.width} / ${lh.height}` : undefined,
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            paddingTop: hasLh ? `${lhPad.topPct}%` : 40,
            paddingBottom: hasLh ? `${lhPad.bottomPct}%` : 40,
            paddingLeft: hasLh ? "5%" : 40,
            paddingRight: hasLh ? "5%" : 40
          }}>
            {/* Header (only when no letterhead) */}
            {hasLh ? null : (
              <div style={{ 
                display: "flex", 
                flexDirection: s.header.alignment === "center" ? "column" : "row",
                alignItems: "center",
                justifyContent: s.header.alignment === "center" ? "center" : s.header.alignment === "right" ? "flex-end" : "space-between", 
                borderBottom: "2px solid #000", 
                paddingBottom: 20, 
                marginBottom: 25,
                gap: 20
              }}>
                {hs?.logo && <img src={hs.logo} alt="Hospital Logo" style={{ height: 60, objectFit: "contain" }} />}
                <div style={{ textAlign: s.header.alignment as any }}>
                  {s.header.showHospitalName && <h1 style={{ fontSize: "22pt", fontWeight: 800, margin: 0, color: "#000" }}>{hs?.hospitalName || h?.name || "Medical Center"}</h1>}
                  {s.header.showHospitalAddress && <p style={{ margin: "4px 0", fontSize: "10pt" }}>{hs?.address || "Hospital Address"}</p>}
                  <div style={{ display: "flex", gap: 15, justifyContent: s.header.alignment === "center" ? "center" : s.header.alignment === "right" ? "flex-end" : "flex-start", fontSize: "10pt" }}>
                    {s.header.showHospitalPhone && <span>Tel: {hs?.phone || h?.mobile || "Phone"}</span>}
                    {hs?.email && <span>Email: {hs.email}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Doctor & Patient Info Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 25, padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <div>
                <div style={{ fontSize: "14pt", fontWeight: 800 }}>Dr. {doc?.name}</div>
                <div style={{ fontSize: "11pt", color: "#000", fontWeight: 600 }}>{doc?.specialization}</div>
                <div style={{ fontSize: "10pt", color: "#444" }}>{doc?.qualification}</div>
                <div style={{ fontSize: "10pt", color: "#666" }}>Reg No: {doc?.registrationNo || "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: "12pt" }}>Patient: {rx.patient?.name}</div>
                <div style={{ fontSize: "11pt" }}>ID: {rx.patient?.patientId} | {rx.patient?.gender} | {rx.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(rx.patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)) : "—"} yrs</div>
                <div style={{ fontSize: "11pt", fontWeight: 600 }}>Date: {new Date(rx.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
            </div>

            {/* Vitals Section */}
            {s.display.showVitals && Object.values(vitals).some(v => v) && (
              <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 14 }}>
                {Object.entries(vitals).map(([k, v]: [string, any]) => v ? (
                  <div key={k}>
                    <span style={{ fontWeight: 700, textTransform: "uppercase", color: "#64748b", fontSize: "8pt" }}>{k}: </span>
                    <span style={{ fontWeight: 600, fontSize: "9pt" }}>{v}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Main Medical Content */}
            <div>
              {(rx.chiefComplaint || rx.diagnosis) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                  <div>
                    {rx.chiefComplaint && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: "9pt", marginBottom: 2, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>Chief Complaint</div>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: "10pt", color: "#1e293b" }}>{rx.chiefComplaint}</div>
                      </>
                    )}
                  </div>
                  <div>
                    {s.display.showDiagnosis && rx.diagnosis && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: "9pt", marginBottom: 2, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>Diagnosis</div>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: "10pt" }}>{rx.diagnosis}</span>
                          {s.display.showIcdCodes && icd.length > 0 && <div style={{ color: "#64748b", fontSize: "9pt", marginTop: 2 }}>(ICD: {icd.join(", ")})</div>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {meds.length > 0 && (
                <div style={{ marginBottom: 30 }}>
                  <div style={{ fontWeight: 800, fontSize: "13pt", marginBottom: 8, borderBottom: "1.5px solid #000", paddingBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "15pt", fontStyle: "italic" }}>Rx</span>
                    <span style={{ fontSize: "9pt", fontWeight: 600, color: "#64748b" }}>Medications</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #000" }}>
                        <th style={{ textAlign: "left", padding: "4px 5px", fontSize: "8pt", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Medication</th>
                        <th style={{ textAlign: "left", padding: "4px 5px", fontSize: "8pt", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Dosage</th>
                        <th style={{ textAlign: "left", padding: "4px 5px", fontSize: "8pt", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Frequency</th>
                        <th style={{ textAlign: "left", padding: "4px 5px", fontSize: "8pt", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meds.map((m: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "5px 5px" }}>
                            <div style={{ fontWeight: 700, fontSize: "10pt" }}>{m.name}</div>
                            {(m.route || m.instructions) && <div style={{ fontSize: "8pt", color: "#64748b" }}>{[m.route, m.instructions].filter(Boolean).join(" · ")}</div>}
                          </td>
                          <td style={{ padding: "5px 5px", fontSize: "9pt" }}>{m.dosage}</td>
                          <td style={{ padding: "5px 5px", fontSize: "9pt" }}>{m.frequency}</td>
                          <td style={{ padding: "5px 5px", fontSize: "9pt" }}>{m.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tests.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: "9pt", marginBottom: 4, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>Investigations</div>
                  {tests.map((t: any, i: number) => (
                    <div key={i} style={{ fontSize: "9pt", marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      {t.urgency && <span style={{ fontSize: "8pt", color: "#64748b", marginLeft: 5 }}>({t.urgency})</span>}
                    </div>
                  ))}
                </div>
              )}

              {rx.advice && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: "9pt", marginBottom: 2, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>Advice</div>
                  <div style={{ fontSize: "9pt", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{rx.advice}</div>
                </div>
              )}

              {rx.followUpDate && (
                <div style={{ marginBottom: 10, fontSize: "9pt" }}>
                  <span style={{ fontWeight: 700, color: "#475569" }}>Next Follow-up: </span>
                  <span style={{ fontWeight: 600 }}>{new Date(rx.followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                  {rx.followUpNotes && <span style={{ color: "#64748b" }}> — {rx.followUpNotes}</span>}
                </div>
              )}
            </div>

            {/* Signature */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16, marginTop: 10, paddingBottom: 8 }}>
              <div style={{ textAlign: "center", minWidth: 160, maxWidth: 220 }}>
                <div style={{ height: 90, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 4 }}>
                  {doc?.signature && (
                    <img src={doc.signature} alt="Doctor Signature" style={{ maxHeight: 85, maxWidth: 200, objectFit: "contain", mixBlendMode: "multiply", display: "block" }} />
                  )}
                </div>
                <div style={{ borderTop: "1.5px solid #000", paddingTop: 5 }}>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>Dr. {doc?.name}</div>
                  {doc?.specialization && <div style={{ fontSize: 9, color: "#475569" }}>{doc.specialization}</div>}
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>Digital Signature</div>
                </div>
              </div>
            </div>

            {!hasLh && (
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 15, fontSize: "9pt", color: "#64748b", textAlign: "center", marginTop: 16 }}>
                {s.footer?.text || "This is a computer-generated prescription and does not require a physical signature."}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
