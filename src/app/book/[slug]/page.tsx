"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2, Loader2, CalendarPlus,
  User, Phone, Mail, AlertCircle, CalendarCheck, Clock,
  Stethoscope, Sparkles, Heart, Check, Cake,
} from "lucide-react";
import styles from "../../appointment/appointment.module.css";
import { initializeCashfreeCheckout, launchCashfreeCheckout } from "../../../lib/cashfree-checkout";
import { calculateOnlineBookingAmounts, paiseToRupees } from "../../../lib/online-booking-fee";
import { getBookingIdempotencyKey, verifyCashfreeBooking } from "../../../lib/cashfree-booking-verification";

/* ── Types ── */
interface Doctor { id: string; name: string; specialization?: string; departmentId?: string; department?: { name: string }; consultationFee?: number; onlineBookingFee?: number; followUpFee?: number | null; emergencyFee?: number | null; }
interface Department { id: string; name: string; code: string; type?: string; }
interface HospitalInfo { id: string; name: string; logo?: string | null; phone?: string | null; }

/* ── Helpers ── */
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmt12 = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const fmtDate = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};

const isSlotPassed = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0) < new Date();
};

/* ──────────────────────────────────────────────────────────────────────── */
/* SLUG-BASED BOOKING PAGE — /book/[slug]                                  */
/* ──────────────────────────────────────────────────────────────────────── */
export default function SlugBookingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";

  /* ── Data state ── */
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  /* ── Form state ── */
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", age: "", gender: "",
    departmentId: "", doctorId: "", appointmentDate: "", timeSlot: "",
    notes: "", consultationFee: "", type: "OPD",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentReturnMessage, setPaymentReturnMessage] = useState("");
  const [cashfreeMode, setCashfreeMode] = useState<"sandbox" | "production" | null>(null);
  const [cashfreeReady, setCashfreeReady] = useState(false);
  const [bookedInfo, setBookedInfo] = useState<{ appointmentId?: string; date: string; time: string; doctor: string; department: string; email: string; token?: number } | null>(null);
  const bookingKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const resolvedHid = hospitalInfo?.id || "";
  const returnedOrderId = searchParams.get("order_id");

  const todayStr = toLocalDateStr(new Date());
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
  const tomorrowStr = toLocalDateStr(tmrw);

  /* ── Derived ── */
  const selectedDept = departments.find(d => d.id === form.departmentId);
  const isDiagnostic = selectedDept?.type === "DIAGNOSTIC";
  const filteredDoctors = form.departmentId
    ? allDoctors.filter(d => d.departmentId === form.departmentId)
    : allDoctors;
  const selectedDoctor = allDoctors.find(d => d.id === form.doctorId);
  const onlineBookingAmounts = calculateOnlineBookingAmounts(Number(selectedDoctor?.onlineBookingFee || 0));
  const hasOnlineBookingFee = onlineBookingAmounts.baseAmountPaise > 0;
  const canPayOnline = hasOnlineBookingFee && cashfreeReady;

  /* ── Fetch hospital + departments by slug ── */
  useEffect(() => {
    if (!slug) return;
    setLoadingHospital(true);
    fetch(`/api/public/booking?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.hospital) {
          setHospitalInfo(d.data.hospital);
          setDepartments(d.data?.departments || []);
          if (d.data?.cashfreeMode === "sandbox" || d.data?.cashfreeMode === "production") {
            setCashfreeMode(d.data.cashfreeMode);
          }
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingHospital(false));
  }, [slug]);

  useEffect(() => {
    if (!cashfreeMode) return;
    let active = true;
    setCashfreeReady(false);
    initializeCashfreeCheckout(cashfreeMode)
      .then(() => { if (active) setCashfreeReady(true); })
      .catch(() => { if (active) setCashfreeReady(false); });
    return () => { active = false; };
  }, [cashfreeMode]);

  /* ── Fetch doctors ── */
  useEffect(() => {
    if (!resolvedHid) return;
    setLoadingDoctors(true);
    fetch(`/api/public/booking/doctors?hid=${resolvedHid}`)
      .then(r => r.json())
      .then(d => setAllDoctors(d.data || []))
      .finally(() => setLoadingDoctors(false));
  }, [resolvedHid]);

  /* ── Fetch slots when doctor + date change ── */
  useEffect(() => {
    if (!form.doctorId || !form.appointmentDate || !resolvedHid) {
      setSlots([]); setBookedSlots([]); return;
    }
    setLoadingSlots(true);
    fetch(`/api/public/booking/slots?hid=${resolvedHid}&doctorId=${form.doctorId}&date=${form.appointmentDate}`)
      .then(r => r.json())
      .then(d => {
        setSlots(d.data?.allSlots || d.data?.slots || []);
        setBookedSlots(d.data?.bookedSlots || []);
      })
      .finally(() => setLoadingSlots(false));
  }, [resolvedHid, form.doctorId, form.appointmentDate]);

  useEffect(() => {
    bookingKeyRef.current = null;
  }, [form.doctorId]);

  useEffect(() => {
    if (!returnedOrderId || !resolvedHid) return;
    let active = true;
    setSaving(true);
    verifyCashfreeBooking(returnedOrderId, resolvedHid)
      .then(({ ok, data }) => {
        if (!active) return;
        const appointment = data.data?.appointment;
        if (ok && data.success && data.data?.status === "PAID" && appointment) {
          setBookedInfo({
            appointmentId: appointment.id,
            date: String(appointment.appointmentDate).slice(0, 10),
            time: appointment.timeSlot || "",
            doctor: appointment.doctor?.name || "",
            department: appointment.department?.name || "",
            email: appointment.patient?.email || "",
            token: appointment.tokenNumber || undefined,
          });
          setIsSuccess(true);
          return;
        }
        setErrors({ submit: data.message || "Payment was not confirmed. No online appointment has been booked." });
      })
      .catch(() => {
        if (active) setErrors({ submit: "Unable to verify payment right now. Please try again or contact the hospital." });
      })
      .finally(() => {
        if (active) setSaving(false);
      });

    return () => { active = false; };
  }, [returnedOrderId, resolvedHid]);

  /* ── Helpers ── */
  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; delete n.submit; return n; });
  };

  /* ── Step 1 validation ── */
  const goToStep2 = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.phone.trim()) errs.phone = "Phone is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Invalid email";
    if (form.age.trim()) {
      const ageNum = Number(form.age.trim());
      if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 150) errs.age = "Age must be between 0 and 150";
    }
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep(2);
  };

  /* ── Submit booking ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isDiagnostic && !form.doctorId) errs.doctorId = "Select a doctor";
    if (!form.appointmentDate) errs.appointmentDate = "Select a date";
    if (!isDiagnostic && !form.timeSlot) errs.timeSlot = "Select a time slot";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (!isDiagnostic && isSlotPassed(form.appointmentDate, form.timeSlot)) {
      setErrors({ submit: "The selected time slot has already passed. Please choose a future time." });
      return;
    }

    setSaving(true); setErrors({});

    // Enforce online payment only for public bookings
    const onlinePayment = !isDiagnostic && Boolean(selectedDoctor);
    if (onlinePayment && !canPayOnline) {
      setErrors({ submit: hasOnlineBookingFee ? "Cashfree Checkout is unavailable. Please try again later." : "Online payment is unavailable for this doctor." });
      setSaving(false);
      return;
    }

    const bookingPayload = {
      hospitalId: resolvedHid,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      ...(form.age.trim() ? { age: Number(form.age.trim()) } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      doctorId: form.doctorId,
      departmentId: form.departmentId || null,
      appointmentDate: form.appointmentDate,
      timeSlot: form.timeSlot,
      type: form.type,
      consultationFee: form.consultationFee ? Number(form.consultationFee) : null,
      notes: form.notes || null,
    };

    try {
      if (onlinePayment) {
        const fingerprint = JSON.stringify(bookingPayload);
        if (!bookingKeyRef.current || bookingKeyRef.current.fingerprint !== fingerprint) {
          bookingKeyRef.current = {
            fingerprint,
            key: await getBookingIdempotencyKey(window.location.pathname, fingerprint),
          };
        }
        const res = await fetch("/api/public/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...bookingPayload,
            action: "create-order",
            idempotencyKey: bookingKeyRef.current.key,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.data?.paymentSessionId) {
          setErrors({ submit: data.message || "Unable to start online payment." });
          return;
        }
        const mode = data.data.environment === "production" ? "production" : "sandbox";
        const checkoutResult = await launchCashfreeCheckout(data.data.paymentSessionId, mode);
        if (checkoutResult.redirect) return;
        const checkoutDismissedOrErrored = Boolean(checkoutResult.error);
        const paymentAttemptSubmitted = Boolean(checkoutResult.paymentDetails);

        const { ok: verifyResponseOk, data: verification } = await verifyCashfreeBooking(
          data.data.orderId,
          resolvedHid,
        );
        const paidAppointment = verification.data?.appointment;
        if (verifyResponseOk && verification.success && verification.data?.status === "PAID" && paidAppointment) {
          setBookedInfo({
            appointmentId: paidAppointment.id,
            date: String(paidAppointment.appointmentDate).slice(0, 10),
            time: paidAppointment.timeSlot || "",
            doctor: paidAppointment.doctor?.name || "",
            department: paidAppointment.department?.name || "",
            email: paidAppointment.patient?.email || "",
            token: paidAppointment.tokenNumber || undefined,
          });
          setIsSuccess(true);
        } else {
          setErrors({
            submit: checkoutDismissedOrErrored
              ? "Payment was not completed. No appointment was confirmed; you can retry."
              : paymentAttemptSubmitted
                ? verification.message || "Payment is not confirmed yet. No appointment has been booked."
                : verification.message || "Payment is not confirmed yet. No appointment has been booked.",
          });
        }
        return;
      }
    } catch (err: unknown) {
      setErrors({ submit: err instanceof Error ? err.message : "Network error. Please check your connection." });
    } finally {
      setSaving(false);
    }
  };

  /* ── Common field style ── */
  const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5 };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" };
  const inputStyle: React.CSSProperties = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#1e293b", outline: "none", width: "100%" };
  const errStyle: React.CSSProperties = { fontSize: 11, color: "#ef4444", fontWeight: 600, marginTop: 2 };

  /* ────────────────────────── RENDER ────────────────────────── */

  /* ── Full-page success view ── */
  if (isSuccess && bookedInfo) {
    return (
      <div className={styles.pageWrap}>
        <div className={styles.container}>
          <div className={styles.successPage}>
            <div className={styles.successSparkle} style={{ top: 20, right: 30 }}><Sparkles size={24} /></div>
            <div className={styles.successSparkle} style={{ bottom: 30, left: 20 }}><Sparkles size={18} /></div>
            <div className={styles.successSparkle} style={{ top: 60, left: 40 }}><Heart size={14} /></div>

            <div className={styles.successCircle}>
              <div className={styles.successCircleInner}>
                <Check size={36} strokeWidth={3} />
              </div>
              <div className={styles.successRing} />
            </div>

            <h2 className={styles.successTitle}>Appointment Confirmed!</h2>
            <p className={styles.successSubtitle}>
              Your appointment at <strong>{hospitalInfo?.name || "the hospital"}</strong> has been booked successfully.
            </p>

            <div className={styles.successCard}>
              <div className={styles.successCardRow}>
                <div className={styles.successCardItem}>
                  <div className={styles.successCardIcon}><Stethoscope size={16} /></div>
                  <div>
                    <div className={styles.successCardLabel}>Doctor</div>
                    <div className={styles.successCardValue}>{bookedInfo.doctor}</div>
                    {bookedInfo.department && <div className={styles.successCardSub}>{bookedInfo.department}</div>}
                  </div>
                  {bookedInfo.appointmentId && (
                    <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 12 }}>
                      Appointment reference: <strong>{bookedInfo.appointmentId}</strong>
                    </p>
                  )}
                </div>
                <div className={styles.successCardDivider} />
                <div className={styles.successCardItem}>
                  <div className={styles.successCardIcon}><CalendarCheck size={16} /></div>
                  <div>
                    <div className={styles.successCardLabel}>Date</div>
                    <div className={styles.successCardValue}>{fmtDate(bookedInfo.date)}</div>
                  </div>
                </div>
                <div className={styles.successCardDivider} />
                <div className={styles.successCardItem}>
                  <div className={styles.successCardIcon}><Clock size={16} /></div>
                  <div>
                    <div className={styles.successCardLabel}>Time</div>
                    <div className={styles.successCardValue}>{fmt12(bookedInfo.time)}</div>
                  </div>
                </div>
              </div>
              {bookedInfo.token && (
                <div className={styles.successTokenRow}>
                  <span className={styles.successTokenLabel}>Token Number</span>
                  <span className={styles.successTokenBadge}>#{bookedInfo.token}</span>
                </div>
              )}
            </div>

            <div className={styles.successEmailNotice}>
              <Mail size={14} />
              <span>A confirmation email will be sent to <strong>{bookedInfo.email}</strong></span>
            </div>

            <div className={styles.successActions}>
              <button type="button" onClick={() => { setIsSuccess(false); setStep(1); setForm({ name: "", phone: "", email: "", age: "", gender: "", departmentId: "", doctorId: "", appointmentDate: "", timeSlot: "", notes: "", consultationFee: "", type: "OPD" }); }}
                className={styles.successPrimaryBtn}>
                <CalendarPlus size={14} /> Book Another Appointment
              </button>
              <button type="button" onClick={() => router.push(`/patient/${slug}`)}
                className={styles.successPrimaryBtn} style={{ background: "linear-gradient(135deg,#0f766e,#115e59)" }}>
                <User size={14} /> Go to Patient Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrap}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}><CalendarPlus size={22} /></div>
            <div>
              <h1 className={styles.headerH1}>
                {loadingHospital ? "Loading..." : hospitalInfo ? `Book at ${hospitalInfo.name}` : "Book an Appointment"}
              </h1>
              <p className={styles.headerSub}>Schedule your visit in a few simple steps</p>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          {/* ── Loading / error ── */}
          {loadingHospital && (
            <div className={styles.loadingState}><Loader2 size={28} className={styles.spinner} /><span>Loading form...</span></div>
          )}
          {!loadingHospital && notFound && (
            <div className={styles.errorState}>
              This booking page was not found. Please check the URL or contact the hospital for the correct booking link.
            </div>
          )}
          {!loadingHospital && !notFound && !resolvedHid && (
            <div className={styles.errorState}>Unable to load booking form. Please try again later.</div>
          )}

          {/* ══════════ STEP 1: Patient Info ══════════ */}
          {!loadingHospital && resolvedHid && step === 1 && (
            <div style={{ padding: "28px 28px 20px" }}>
              {errors.submit && (
                <div role="alert" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 9, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 13 }}>
                  {errors.submit}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#14B8A6,#0d7a7f)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>1</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Your Information</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Full Name *</label>
                  <div style={{ position: "relative" }}>
                    <User size={14} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                    <input style={{ ...inputStyle, paddingLeft: 34 }} placeholder="e.g. John Doe"
                      value={form.name} onChange={e => set("name", e.target.value)} />
                  </div>
                  {errors.name && <span style={errStyle}>{errors.name}</span>}
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Phone Number *</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={14} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                    <input style={{ ...inputStyle, paddingLeft: 34 }} type="tel" placeholder="e.g. 9876543210"
                      value={form.phone} onChange={e => set("phone", e.target.value)} />
                  </div>
                  {errors.phone && <span style={errStyle}>{errors.phone}</span>}
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Email Address *</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={14} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                    <input style={{ ...inputStyle, paddingLeft: 34 }} type="email" placeholder="e.g. john@example.com"
                      value={form.email} onChange={e => set("email", e.target.value)} />
                  </div>
                  {errors.email && <span style={errStyle}>{errors.email}</span>}
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Age</label>
                  <div style={{ position: "relative" }}>
                    <Cake size={14} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                    <input style={{ ...inputStyle, paddingLeft: 34 }} type="number" min={0} max={150} placeholder="e.g. 32"
                      value={form.age} onChange={e => set("age", e.target.value)} />
                  </div>
                  {errors.age && <span style={errStyle}>{errors.age}</span>}
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Gender</label>
                  <div style={{ position: "relative" }}>
                    <User size={14} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                    <select style={{ ...inputStyle, paddingLeft: 34 }} value={form.gender} onChange={e => set("gender", e.target.value)}>
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button type="button" onClick={goToStep2}
                  style={{ padding: "10px 28px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#14B8A6,#0d7a7f)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  Next — Appointment Details →
                </button>
              </div>
            </div>
          )}

          {/* ══════════ STEP 2: Appointment Booking ══════════ */}
          {!loadingHospital && resolvedHid && step === 2 && (
            <div style={{ padding: "28px 28px 20px" }}>
              {/* Patient banner */}
              <div style={{ background: "linear-gradient(135deg,#14B8A6,#0d7a7f)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>
                  {form.name.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{form.name}</div>
                  <div style={{ fontSize: 11, color: "#bae6fd" }}>{form.phone} &middot; {form.email}</div>
                </div>
                <button type="button" onClick={() => setStep(1)}
                  style={{ marginLeft: "auto", background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 600 }}>
                  Edit
                </button>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#14B8A6,#0d7a7f)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>2</div>
                Appointment Details
              </div>

              <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Department */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Department *</label>
                  <select style={inputStyle} value={form.departmentId}
                    onChange={e => { set("departmentId", e.target.value); set("doctorId", ""); set("timeSlot", ""); set("consultationFee", ""); }}>
                    <option value="">Select Department...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                {/* Doctor — hidden for DIAGNOSTIC */}
                {!isDiagnostic && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Doctor *</label>
                  <select required style={inputStyle} value={form.doctorId}
                    onChange={e => {
                      const doc = allDoctors.find(d => d.id === e.target.value);
                      set("doctorId", e.target.value);
                      set("timeSlot", "");
                      if (doc?.consultationFee) set("consultationFee", String(doc.consultationFee));
                      if (doc?.departmentId && !form.departmentId) set("departmentId", doc.departmentId);
                    }}>
                    <option value="">{loadingDoctors ? "Loading..." : "Select Doctor..."}</option>
                    {filteredDoctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : d.department?.name ? ` — ${d.department.name}` : ""}</option>
                    ))}
                  </select>
                  {errors.doctorId && <span style={errStyle}>{errors.doctorId}</span>}
                </div>
                )}

                {/* Date */}
                <div style={fieldStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={labelStyle}>Appointment Date *</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => { set("appointmentDate", todayStr); set("timeSlot", ""); }}
                        style={{ padding: "2px 8px", borderRadius: 6, border: `1px solid ${form.appointmentDate === todayStr ? "#14B8A6" : "#e2e8f0"}`, background: form.appointmentDate === todayStr ? "#F0FDFA" : "#f8fafc", color: form.appointmentDate === todayStr ? "#14B8A6" : "#64748b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Today
                      </button>
                      <button type="button" onClick={() => { set("appointmentDate", tomorrowStr); set("timeSlot", ""); }}
                        style={{ padding: "2px 8px", borderRadius: 6, border: `1px solid ${form.appointmentDate === tomorrowStr ? "#14B8A6" : "#e2e8f0"}`, background: form.appointmentDate === tomorrowStr ? "#F0FDFA" : "#f8fafc", color: form.appointmentDate === tomorrowStr ? "#14B8A6" : "#64748b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Tomorrow
                      </button>
                    </div>
                  </div>
                  <input required type="date" min={todayStr} style={inputStyle}
                    value={form.appointmentDate} onChange={e => { set("appointmentDate", e.target.value); set("timeSlot", ""); }} />
                  {errors.appointmentDate && <span style={errStyle}>{errors.appointmentDate}</span>}
                </div>

                {/* Type */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Appointment Type</label>
                  <select style={inputStyle} value={form.type} onChange={e => set("type", e.target.value)}>
                    <option value="OPD">OPD</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>

                {selectedDoctor && (
                  <div style={{ gridColumn: "1/-1", padding: "12px 16px", background: "#F0FDFA", border: "1px solid #99F6E4", borderRadius: 9, fontSize: 12, color: "#0F766E" }}>
                    <strong>Online Payment Required</strong>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#14B8A6,#0d7a7f)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>✓</span>
                        <span><strong>Pay online with Cashfree</strong> — secure online payment with instant confirmation.</span>
                      </div>
                      {hasOnlineBookingFee && (
                        <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid #99F6E4", display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Online booking fee (consultation included)</span>
                            <span>₹{paiseToRupees(onlineBookingAmounts.baseAmountPaise).toFixed(2)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Convenience fee (2%)</span>
                            <span>₹{paiseToRupees(onlineBookingAmounts.convenienceFeePaise).toFixed(2)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#115e59" }}>
                            <span>Total payable</span>
                            <span>₹{paiseToRupees(onlineBookingAmounts.totalAmountPaise).toFixed(2)}</span>
                          </div>
                          <small>The 2% convenience fee is charged only during online payment. Consultation is not added separately.</small>
                        </div>
                      )}
                      {!hasOnlineBookingFee && (
                        <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid #99F6E4", color: "#ef4444" }}>
                          Online payment is unavailable for this doctor. Please contact the hospital.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Diagnostic info banner */}
                {isDiagnostic && form.appointmentDate && (
                  <div style={{ gridColumn: "1/-1", padding: "12px 16px", background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 9, fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
                    Our team will confirm your appointment time. Please arrive at the selected date and we will schedule your diagnostic visit.
                  </div>
                )}

                {/* Time Slots — clinical only */}
                {!isDiagnostic && form.doctorId && form.appointmentDate && (
                  <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={labelStyle}>
                      Time Slot * {loadingSlots && <Loader2 size={11} style={{ marginLeft: 6, animation: "spin .7s linear infinite" }} />}
                    </label>
                    {loadingSlots ? (
                      <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>Loading available slots...</div>
                    ) : slots.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#ef4444", padding: "12px 16px", background: "#fff5f5", borderRadius: 9, border: "1px solid #fecaca" }}>
                        No available slots for this date. Doctor may be unavailable or fully booked.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {slots.map(slot => {
                          const isBooked = bookedSlots.includes(slot);
                          const isPast = isSlotPassed(form.appointmentDate, slot);
                          const disabled = isBooked || isPast;
                          const selected = form.timeSlot === slot;
                          return (
                            <button key={slot} type="button" disabled={disabled}
                              onClick={() => !disabled && set("timeSlot", slot)}
                              title={isPast ? "Time has passed" : isBooked ? "Already booked" : "Available"}
                              style={{
                                padding: "6px 4px", borderRadius: 9, textAlign: "center",
                                border: `1.5px solid ${selected ? "#14B8A6" : disabled ? "#fecaca" : "#e2e8f0"}`,
                                background: selected ? "#14B8A6" : disabled ? "#fef2f2" : "#fff",
                                color: selected ? "#fff" : disabled ? "#ef4444" : "#334155",
                                fontSize: 11, fontWeight: selected ? 700 : 500,
                                cursor: disabled ? "not-allowed" : "pointer",
                                transition: "all .15s",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                              }}>
                              <span>{fmt12(slot)}</span>
                              {disabled && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{isBooked ? "Booked" : "Past"}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {errors.timeSlot && <span style={errStyle}>{errors.timeSlot}</span>}
                  </div>
                )}

                {/* Notes */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Notes / Reason</label>
                  <input style={inputStyle} placeholder="Chief complaint or notes..."
                    value={form.notes} onChange={e => set("notes", e.target.value)} />
                </div>

                {/* Error */}
                {errors.submit && (
                  <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ef4444", fontWeight: 600, background: "#fff5f5", padding: "10px 14px", borderRadius: 9, border: "1px solid #fecaca" }}>
                    <AlertCircle size={14} />{errors.submit}
                  </div>
                )}

                {/* Actions */}
                <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(1)}
                    style={{ padding: "10px 20px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ← Back
                  </button>
                  <button type="submit" disabled={saving || (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee}
                    style={{
                      padding: "10px 24px", borderRadius: 9, border: "none",
                      background: (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee ? "#e2e8f0" : "linear-gradient(135deg,#14B8A6,#0d7a7f)",
                      color: (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee ? "#94a3b8" : "#fff",
                      fontSize: 13, fontWeight: 700,
                      cursor: (saving || (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      boxShadow: (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee ? "none" : "0 4px 12px rgba(14,137,143,.3)",
                    }}>
                    {saving ? <><Loader2 size={14} style={{ animation: "spin .7s linear infinite" }} /> {returnedOrderId ? "Verifying payment..." : "Processing..."}</> : <><CheckCircle2 size={14} /> {hasOnlineBookingFee ? `Pay ₹${paiseToRupees(onlineBookingAmounts.totalAmountPaise).toFixed(2)} & Confirm Appointment` : "Online payment unavailable"}</>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}