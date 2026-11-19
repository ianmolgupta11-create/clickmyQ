"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft, ChevronRight, ChevronDown, Calendar, Clock, User, Phone, Mail,
  Stethoscope, Shield, Check, CheckCircle2, Loader2, AlertCircle, CalendarPlus,
  MapPin, ArrowLeft, ArrowRight, Search, X, Edit2, CreditCard, Zap,
  Building2, UserRound, CalendarCheck, Sparkles, Heart, CalendarDays,
  Sun, CloudSun, Moon, Info,
} from "lucide-react";
import styles from "./booking.module.css";
import "./globals-booking.css";
import { initializeCashfreeCheckout, launchCashfreeCheckout } from "../../lib/cashfree-checkout";
import { calculateOnlineBookingAmounts, paiseToRupees } from "../../lib/online-booking-fee";
import { getBookingIdempotencyKey, verifyCashfreeBooking } from "../../lib/cashfree-booking-verification";

/* ── Types ── */
interface Doctor {
  id: string;
  name: string;
  specialization?: string;
  departmentId?: string;
  department?: { name: string };
  consultationFee?: number;
  onlineBookingFee?: number;
  followUpFee?: number | null;
  emergencyFee?: number | null;
  photoUrl?: string | null;
  experienceYears?: number | null;
}
interface Department { id: string; name: string; code: string; type?: string; }
interface HospitalInfo { id: string; name: string; logo?: string | null; phone?: string | null; address?: string | null; }

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

const fmtDateShort = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getDayName = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
};

const isSlotPassed = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0) < new Date();
};

const getPeriod = (timeStr: string) => {
  const [h] = timeStr.split(":").map(Number);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
};

const periodLabel = (period: string) => {
  switch (period) {
    case "morning": return "Morning";
    case "afternoon": return "Afternoon";
    default: return "Evening";
  }
};

const periodIcon = (period: string) => {
  switch (period) {
    case "morning": return <Sun size={12} style={{ color: "#f59e0b" }} />;
    case "afternoon": return <CloudSun size={12} style={{ color: "#3b82f6" }} />;
    default: return <Moon size={12} style={{ color: "#8b5cf6" }} />;
  }
};

/* ──────────────────────────────────────────────────────────────────────── */
/* MAIN FORM COMPONENT                                                     */
/* ──────────────────────────────────────────────────────────────────────── */
function AppointmentForm() {
  const searchParams = useSearchParams();
  const hid = searchParams.get("hid") || "";

  /* ── Data state ── */
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  /* ── Form state ── */
  const [step, setStep] = useState(1); // 1: Patient Details, 2: Appointment Details, 3: Review & Pay
  const [form, setForm] = useState({
    name: "", phone: "", email: "", age: "",
    departmentId: "", doctorId: "", appointmentDate: "", timeSlot: "",
    notes: "", type: "OPD",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cashfreeMode, setCashfreeMode] = useState<"sandbox" | "production" | null>(null);
  const [cashfreeReady, setCashfreeReady] = useState(false);
  const [bookedInfo, setBookedInfo] = useState<{ appointmentId?: string; date: string; time: string; doctor: string; department: string; email: string; token?: number } | null>(null);
  const bookingKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  /* ── UI state ── */
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false);

  const resolvedHid = hospitalInfo?.id || hid;
  const returnedOrderId = searchParams.get("order_id");

  const todayStr = toLocalDateStr(new Date());
  const tomorrowStr = toLocalDateStr(new Date(Date.now() + 86400000));

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

  const totalAmountPaise = onlineBookingAmounts.totalAmountPaise;
  const totalAmount = paiseToRupees(totalAmountPaise).toFixed(2);

  /* ── Calendar helpers ── */
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const monthName = (date: Date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const calendarDays = (() => {
    const days: (Date | null)[] = [];
    const firstDay = firstDayOfMonth(calendarMonth);
    const totalDays = daysInMonth(calendarMonth);
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
    return days;
  })();

  /* ── Fetch hospital + departments ── */
  useEffect(() => {
    setLoadingHospital(true);
    const url = hid ? `/api/public/booking?hid=${hid}` : `/api/public/booking`;
    fetch(url).then(r => r.json()).then(d => {
      if (d.data?.hospital) setHospitalInfo(d.data.hospital);
      setDepartments(d.data?.departments || []);
      if (d.data?.cashfreeMode === "sandbox" || d.data?.cashfreeMode === "production") {
        setCashfreeMode(d.data.cashfreeMode);
      }
    }).finally(() => setLoadingHospital(false));
  }, [hid]);

  /* ── Initialize Cashfree ── */
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

  /* ── Reset idempotency key when doctor changes ── */
  useEffect(() => {
    bookingKeyRef.current = null;
  }, [form.doctorId]);

  /* ── Verify payment on return from Cashfree ── */
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

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".dropdownPanel")) {
        setDepartmentDropdownOpen(false);
        setDoctorDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest(".calendarWrapper")) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Helpers ── */
  const setField = useCallback((field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; delete n.submit; return n; });
  }, []);

  /* ── Step validation ── */
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

  const goToStep3 = () => {
    const errs: Record<string, string> = {};
    if (!isDiagnostic && !form.doctorId) errs.doctorId = "Select a doctor";
    if (!form.appointmentDate) errs.appointmentDate = "Select a date";
    if (!isDiagnostic && !form.timeSlot) errs.timeSlot = "Select a time slot";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (!isDiagnostic && isSlotPassed(form.appointmentDate, form.timeSlot)) {
      setErrors({ submit: "The selected time slot has already passed. Please choose a future time." });
      return;
    }
    setStep(3);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const editPatient = () => setStep(1);
  const editAppointment = () => setStep(2);

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
      doctorId: form.doctorId,
      departmentId: form.departmentId || null,
      appointmentDate: form.appointmentDate,
      timeSlot: form.timeSlot,
      type: form.type,
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

  /* ── Calendar helpers ── */
  const isDateDisabled = (date: Date | null) => {
    if (!date) return true;
    const dateStr = toLocalDateStr(date);
    if (dateStr < todayStr) return true;
    return false;
  };

  const isDateSelected = (date: Date | null) => {
    if (!date) return false;
    return toLocalDateStr(date) === form.appointmentDate;
  };

  const isDateToday = (date: Date | null) => {
    if (!date) return false;
    return toLocalDateStr(date) === todayStr;
  };

  const isDateAvailable = (date: Date | null) => {
    if (!date || isDateDisabled(date)) return false;
    return true;
  };

  const selectDate = (date: Date | null) => {
    if (!date || isDateDisabled(date)) return;
    setField("appointmentDate", toLocalDateStr(date));
    setField("timeSlot", "");
    setShowCalendar(false);
  };

  const prevMonth = () => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  /* ── Render helpers ── */
  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(departmentSearch.toLowerCase())
  );

  const filteredDoctorsList = filteredDoctors.filter(d =>
    d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  const timeSlotsByPeriod = slots.reduce((acc, slot) => {
    const period = getPeriod(slot);
    if (!acc[period]) acc[period] = [];
    acc[period].push(slot);
    return acc;
  }, {} as Record<string, string[]>);

  const periods = ["morning", "afternoon", "evening"];

  /* ── Success View ── */
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
              <button type="button" onClick={() => { setIsSuccess(false); setStep(1); setForm({ name: "", phone: "", email: "", age: "", departmentId: "", doctorId: "", appointmentDate: "", timeSlot: "", notes: "", type: "OPD" }); }}
                className={styles.successPrimaryBtn}>
                <CalendarPlus size={14} /> Book Another Appointment
              </button>
              <button type="button" onClick={() => window.location.href = "/"}
                className={styles.successPrimaryBtn} style={{ background: "linear-gradient(135deg,#0f766e,#115e59)" }}>
                <User size={14} /> Go to Homepage
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Layout ── */
  return (
    <div className={styles.pageWrap}>
      {/* Desktop Split Screen */}
      <div className={styles.desktopLayout}>

        {/* Left Column */}
        <div className={styles.leftColumn}>
          <div className={styles.contentWrapper}>
            {/* Header */}
            <div className={styles.header}>
              <a href="/" className={styles.backLink}><ArrowLeft size={16} /> Back to Home</a>
              <div className={styles.headerIcon}><CalendarPlus size={22} /></div>
              <div className={styles.headerTitle}>
                <h1 className={styles.headerH1}>{loadingHospital ? "Loading..." : hospitalInfo ? `Book at ${hospitalInfo.name}` : "Book an Appointment"}</h1>
                <p className={styles.headerSub}>Schedule your visit in a few simple steps</p>
              </div>
              {hospitalInfo?.logo && <img src={hospitalInfo.logo} alt={hospitalInfo.name} className={styles.hospitalLogo} />}
            </div>

            {/* Progress Indicator */}
            <div className={styles.progressIndicator} role="navigation" aria-label="Booking progress">
              <div className={`${styles.progressStep} ${step > 1 ? styles.completed : step === 1 ? styles.active : ""}`}>
                <div className={styles.progressCircle}><CheckCircle2 size={14} /></div>
                <span className={styles.progressLabel}>Patient Details</span>
              </div>
              <div className={`${styles.progressStep} ${step > 2 ? styles.completed : step === 2 ? styles.active : ""}`}>
                <div className={styles.progressCircle}>{step > 1 ? <Check size={14} /> : "2"}</div>
                <span className={styles.progressLabel}>Appointment</span>
              </div>
              <div className={`${styles.progressStep} ${step === 3 ? styles.active : ""}`}>
                <div className={styles.progressCircle}>{step > 2 ? <Check size={14} /> : "3"}</div>
                <span className={styles.progressLabel}>Review & Pay</span>
              </div>
            </div>

            {/* Loading / Error */}
            {loadingHospital && <div className={styles.loadingState}><span className={styles.spinner} /><span>Loading form...</span></div>}
            {!loadingHospital && !resolvedHid && <div className={styles.errorState}><AlertCircle size={16} /> Unable to load booking form. Please use the QR code link provided by the hospital.</div>}

            {/* Step 1: Patient Details */}
            {!loadingHospital && resolvedHid && step === 1 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><User className={styles.cardTitleIcon} size={18} /> Patient Details</h2>
                </div>
                <div className={styles.cardBody}>
                  {errors.submit && (
                    <div className={styles.errorState}><AlertCircle size={14} />{errors.submit}</div>
                  )}

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={`${styles.label} ${styles.required}`}>Full Name</label>
                      <div className={styles.inputWrap}>
                        <User className={styles.fieldIcon} size={18} />
                        <input className={styles.input} type="text" placeholder="e.g. John Doe"
                          value={form.name} onChange={e => setField("name", e.target.value)} autoComplete="name" />
                      </div>
                      {errors.name && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.name}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={`${styles.label} ${styles.required}`}>Phone Number</label>
                      <div className={styles.inputWrap}>
                        <Phone className={styles.fieldIcon} size={18} />
                        <input className={styles.input} type="tel" placeholder="e.g. 9876543210"
                          value={form.phone} onChange={e => setField("phone", e.target.value)} autoComplete="tel" />
                      </div>
                      {errors.phone && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.phone}</span>}
                    </div>
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={`${styles.label} ${styles.required}`}>Email Address</label>
                      <div className={styles.inputWrap}>
                        <Mail className={styles.fieldIcon} size={18} />
                        <input className={styles.input} type="email" placeholder="e.g. john@example.com"
                          value={form.email} onChange={e => setField("email", e.target.value)} autoComplete="email" />
                      </div>
                      {errors.email && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.email}</span>}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Age</label>
                      <div className={styles.inputWrap}>
                        <Calendar className={styles.fieldIcon} size={18} />
                        <input className={styles.input} type="number" min={0} max={150} placeholder="e.g. 32"
                          value={form.age} onChange={e => setField("age", e.target.value)} />
                      </div>
                      {errors.age && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.age}</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                    <button type="button" onClick={goToStep2}
                      className={styles.desktopCTABtn} style={{ padding: "12px 28px" }}>
                      Continue to Appointment Details <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Appointment Details */}
            {!loadingHospital && resolvedHid && step === 2 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><Calendar className={styles.cardTitleIcon} size={18} /> Appointment Details</h2>
                </div>
                <div className={styles.cardBody}>
                  {/* Patient Banner */}
                  <div className={styles.patientBanner}>
                    <div className={styles.patientAvatar}>{form.name.charAt(0).toUpperCase() || "?"}</div>
                    <div>
                      <p className={styles.patientName}>{form.name}</p>
                      <p className={styles.patientDetails}>{form.phone} &middot; {form.email}</p>
                    </div>
                    <button type="button" onClick={editPatient} className={styles.editBtn}>
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>

                  {/* Department Selection */}
                  <div className={styles.cardSection}>
                    <div className={styles.sectionTitle}>Select Department</div>
                    <div className={styles.field} style={{ position: "relative" }}>
                      <label className={`${styles.label} ${styles.required}`}>Department</label>
                      <div className={styles.inputWrap} onClick={() => setDepartmentDropdownOpen(!departmentDropdownOpen)}>
                        <Building2 className={styles.fieldIcon} size={18} />
                        <span style={{ flex: 1, textAlign: "left", color: form.departmentId ? "#1e293b" : "#94a3b8" }}>
                          {selectedDept?.name || "Select Department..."}
                        </span>
                        <ChevronDown className={`${styles.selectChevron} ${departmentDropdownOpen ? styles.selectChevronOpen : ""}`} size={18} />
                      </div>
                      {departmentDropdownOpen && (
                        <div className={styles.dropdownPanel}>
                          <input className={styles.dropdownSearch} placeholder="Search departments..." value={departmentSearch}
                            onChange={e => setDepartmentSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                          {filteredDepartments.length === 0 ? (
                            <div className={styles.dropdownEmpty}>No departments found</div>
                          ) : (
                            filteredDepartments.map(d => (
                              <button key={d.id} className={`${styles.dropdownOption} ${form.departmentId === d.id ? styles.dropdownOptionSelected : ""}`}
                                onClick={() => { setField("departmentId", d.id); setField("doctorId", ""); setDepartmentDropdownOpen(false); }}>
                                <span className={styles.optionName}>{d.name}</span>
                                {form.departmentId === d.id && <Check className={styles.optionCheck} size={18} />}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {errors.departmentId && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.departmentId}</span>}
                    </div>
                  </div>

                  {/* Doctor Selection */}
                  {!isDiagnostic && (
                    <div className={styles.cardSection}>
                      <div className={styles.sectionTitle}>Select Doctor</div>
                      <div className={styles.field} style={{ position: "relative" }}>
                        <label className={`${styles.label} ${styles.required}`}>Doctor</label>
                        <div className={styles.inputWrap} onClick={() => setDoctorDropdownOpen(!doctorDropdownOpen)}>
                          <UserRound className={styles.fieldIcon} size={18} />
                          <span style={{ flex: 1, textAlign: "left", color: form.doctorId ? "#1e293b" : "#94a3b8" }}>
                            {selectedDoctor?.name || "Select Doctor..."}
                          </span>
                          <ChevronDown className={`${styles.selectChevron} ${doctorDropdownOpen ? styles.selectChevronOpen : ""}`} size={18} />
                        </div>
                        {doctorDropdownOpen && (
                          <div className={styles.dropdownPanel} style={{ maxWidth: 420, minWidth: 320 }}>
                            <input className={styles.dropdownSearch} placeholder="Search doctors..." value={doctorSearch}
                              onChange={e => setDoctorSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                            {loadingDoctors ? (
                              <div className={styles.dropdownEmpty}><Loader2 size={16} className={styles.spinner} /> Loading doctors...</div>
                            ) : filteredDoctorsList.length === 0 ? (
                              <div className={styles.dropdownEmpty}>No doctors available in this department</div>
                            ) : (
                              filteredDoctorsList.map(d => (
                                <button key={d.id} className={`${styles.dropdownOption} ${form.doctorId === d.id ? styles.dropdownOptionSelected : ""}`}
                                  onClick={() => {
                                    setField("doctorId", d.id);
                                    setField("timeSlot", "");
                                    if (d.consultationFee) setField("consultationFee", String(d.consultationFee));
                                    if (d.departmentId && !form.departmentId) setField("departmentId", d.departmentId);
                                    setDoctorDropdownOpen(false);
                                  }}>
                                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                                    <span className={styles.optionName}>{d.name}</span>
                                    <span className={styles.optionDesc}>
                                      {d.specialization || d.department?.name}
                                      {d.consultationFee && ` · ₹${d.consultationFee}`}
                                      {d.experienceYears && ` · ${d.experienceYears} yrs exp`}
                                    </span>
                                  </div>
                                  {form.doctorId === d.id && <Check className={styles.optionCheck} size={18} />}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        {errors.doctorId && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.doctorId}</span>}
                      </div>
                    </div>
                  )}

                  {/* Diagnostic Info Banner */}
                  {isDiagnostic && form.appointmentDate && (
                    <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: "var(--radius-lg)", padding: "12px 16px", fontSize: 12, color: "#1e40af", fontWeight: 600, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>Our team will confirm your appointment time. Please arrive at the selected date and we will schedule your diagnostic visit.</span>
                    </div>
                  )}

                  {/* Date Selection */}
                  <div className={styles.cardSection}>
                    <div className={styles.sectionTitle}>Select Date</div>
                    <div className={styles.calendarWrapper} style={{ position: "relative" }}>
                      <label className={`${styles.label} ${styles.required}`}>Appointment Date</label>
                      <button type="button" className={styles.calendarTrigger} onClick={() => setShowCalendar(!showCalendar)}>
                        <Calendar className={styles.fieldIcon} size={18} />
                        <span style={{ flex: 1, textAlign: "left", color: form.appointmentDate ? "#1e293b" : "#94a3b8" }}>
                          {form.appointmentDate ? `${getDayName(form.appointmentDate)}, ${fmtDate(form.appointmentDate)}` : "Select Date..."}
                        </span>
                        <ChevronDown className={`${styles.selectChevron} ${showCalendar ? styles.selectChevronOpen : ""}`} size={18} />
                      </button>
                      {showCalendar && (
                        <div className={styles.calendarPanel}>
                          <div className={styles.calendarHeader}>
                            <button className={styles.calendarNavBtn} onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
                            <span className={styles.calendarTitle}>{monthName(calendarMonth)}</span>
                            <button className={styles.calendarNavBtn} onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
                          </div>
                          <div className={styles.calendarDayNames}>
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className={styles.calendarDayName}>{d}</div>)}
                          </div>
                          <div className={styles.calendarGrid}>
                            {calendarDays.map((day, i) => (
                              <button key={i} type="button"
                                disabled={!day || isDateDisabled(day)}
                                className={`${styles.calendarDay}
                                  ${!day ? styles.calendarDayOther : ""}
                                  ${day && isDateDisabled(day) ? styles.calendarDayDisabled : ""}
                                  ${day && isDateToday(day) ? styles.calendarDayToday : ""}
                                  ${day && isDateSelected(day) ? styles.calendarDaySelected : ""}
                                  ${day && isDateAvailable(day) ? styles.calendarDayAvailable : ""}`}
                                onClick={() => selectDate(day)}
                                aria-label={day ? toLocalDateStr(day) : ""}
                              >
                                {day ? day.getDate() : ""}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {errors.appointmentDate && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.appointmentDate}</span>}
                    </div>
                  </div>

                  {/* Time Slots */}
                  {!isDiagnostic && form.doctorId && form.appointmentDate && (
                    <div className={styles.cardSection}>
                      <div className={styles.sectionTitle}>Select Time Slot</div>
                      {loadingSlots ? (
                        <div className={styles.loadingState}><span className={styles.spinner} /><span>Loading available slots...</span></div>
                      ) : slots.length === 0 ? (
                        <div className={styles.noSlots}>
                          <CalendarDays size={18} style={{ display: "block", margin: "0 auto 8px", color: "var(--error)" }} />
                          No available slots for this date. Doctor may be unavailable or fully booked.
                        </div>
                      ) : (
                        <div>
                          {periods.map(period => {
                            const periodSlots = timeSlotsByPeriod[period] || [];
                            if (periodSlots.length === 0) return null;
                            return (
                              <div key={period} className={styles.timePeriod}>
                                <div className={styles.timePeriodLabel}>
                                  {periodIcon(period)} {periodLabel(period)}
                                </div>
                                <div className={styles.timeGrid}>
                                  {periodSlots.map(slot => {
                                    const isBooked = bookedSlots.includes(slot);
                                    const isPast = isSlotPassed(form.appointmentDate, slot);
                                    const disabled = isBooked || isPast;
                                    const selected = form.timeSlot === slot;
                                    return (
                                      <button key={slot} type="button" disabled={disabled}
                                        onClick={() => !disabled && setField("timeSlot", slot)}
                                        title={isPast ? "Time has passed" : isBooked ? "Already booked" : "Available"}
                                        className={`${styles.timeChip}
                                          ${selected ? styles.timeChipSelected : ""}
                                          ${disabled ? styles.timeChipDisabled : ""}`}
                                      >
                                        {fmt12(slot)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {errors.timeSlot && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.timeSlot}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div className={styles.cardSection}>
                    <label className={styles.label}>Notes / Reason</label>
                    <textarea className={`${styles.input} ${styles.textarea}`} placeholder="Chief complaint or notes..."
                      value={form.notes} onChange={e => setField("notes", e.target.value)} />
                  </div>

                  {/* Error */}
                  {errors.submit && (
                    <div className={styles.errorState}><AlertCircle size={14} />{errors.submit}</div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={goBack}
                      style={{ padding: "12px 24px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-600)", fontSize: "var(--font-size-sm)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button type="button" onClick={goToStep3}
                      disabled={saving || (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee}
                      className={styles.desktopCTABtn} style={{ padding: "12px 28px" }}>
                      {saving ? (
                        <> <span className={styles.spinner} /> <span>Processing...</span> </>
                      ) : (
                        <> <CheckCircle2 size={14} /> <span>Continue to Payment</span> </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review & Pay */}
            {!loadingHospital && resolvedHid && step === 3 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><CreditCard className={styles.cardTitleIcon} size={18} /> Review & Pay</h2>
                </div>
                <div className={styles.cardBody}>
                  {/* Patient Banner */}
                  <div className={styles.patientBanner}>
                    <div className={styles.patientAvatar}>{form.name.charAt(0).toUpperCase() || "?"}</div>
                    <div>
                      <p className={styles.patientName}>{form.name}</p>
                      <p className={styles.patientDetails}>{form.phone} &middot; {form.email}</p>
                    </div>
                    <button type="button" onClick={editPatient} className={styles.editBtn}><Edit2 size={12} /> Edit</button>
                  </div>

                  {/* Appointment Summary */}
                  <div className={styles.cardSection}>
                    <div className={styles.summarySectionTitle}>
                      <span>Appointment Details</span>
                      <button type="button" onClick={editAppointment} className={styles.summaryEditBtn}><Edit2 size={12} /> Edit</button>
                    </div>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Doctor</span>
                        <span className={styles.summaryValueStrong}>{selectedDoctor?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Specialty</span>
                        <span className={styles.summaryValue}>{selectedDoctor?.specialization || selectedDoctor?.department?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Date</span>
                        <span className={styles.summaryValueStrong}>{form.appointmentDate ? fmtDate(form.appointmentDate) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Time</span>
                        <span className={styles.summaryValueStrong}>{form.timeSlot ? fmt12(form.timeSlot) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Type</span>
                        <span className={styles.summaryValue}>{form.type}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Department</span>
                        <span className={styles.summaryValue}>{selectedDept?.name || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  {hasOnlineBookingFee && (
                    <div className={styles.cardSection}>
                      <div className={styles.sectionTitle}>Payment Summary</div>
                      <div className={styles.feeBreakdown}>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Online booking fee (consultation included)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.baseAmountPaise).toFixed(2)}</span>
                        </div>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Convenience fee (2%)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.convenienceFeePaise).toFixed(2)}</span>
                        </div>
                        <div className={`${styles.feeRow} ${styles.feeRowTotal}`}>
                          <span className={styles.feeLabel}>Total Payable</span>
                          <span className={styles.feeValue}>₹{totalAmount}</span>
                        </div>
                      </div>
                      <small style={{ color: "var(--gray-500)", fontSize: 11 }}>The 2% convenience fee is charged only during online payment. Consultation is not added separately.</small>
                    </div>
                  )}

                  {!hasOnlineBookingFee && (
                    <div className={styles.errorState}><AlertCircle size={14} /> Online payment is unavailable for this doctor. Please contact the hospital.</div>
                  )}

                  {/* Secure Payment Badge */}
                  <div className={styles.secureBadge}>
                    <Shield size={14} /> Secured by Cashfree Payments
                  </div>

                  {/* Cashfree Branding */}
                  <div className={styles.cashfreeBrand}>
                    <div className={styles.cashfreeLogo}>
                      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                        <rect width="120" height="120" rx="20" fill="#1E293B"/>
                        <text x="60" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="48" fontWeight="bold" fill="#14B8A6">₹</text>
                      </svg>
                    </div>
                    <div className={styles.cashfreeInfo}>
                      <p className={styles.cashfreeName}>Cashfree Payments</p>
                      <p className={styles.cashfreeTagline}>India's leading payment gateway</p>
                    </div>
                  </div>

                  {/* Error */}
                  {errors.submit && (
                    <div className={styles.errorState}><AlertCircle size={14} />{errors.submit}</div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={editAppointment}
                      style={{ padding: "12px 24px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-600)", fontSize: "var(--font-size-sm)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button type="button" onClick={handleSubmit}
                      disabled={saving || !hasOnlineBookingFee}
                      className={styles.desktopCTABtn} style={{ padding: "14px 32px" }}>
                      {saving ? (
                        <> <span className={styles.spinner} /> {returnedOrderId ? "Verifying payment..." : "Processing..."} </>
                      ) : (
                        <> <CheckCircle2 size={14} /> Pay ₹{totalAmount} & Confirm Appointment </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column - Sticky Summary */}
        <aside className={styles.rightColumn} aria-label="Appointment summary">
          <div className={styles.summarySticky}>
            <div className={styles.summaryCard}>
              {/* Hospital Header */}
              <div className={styles.summaryHeader}>
                {hospitalInfo?.logo && <img src={hospitalInfo.logo} alt={hospitalInfo.name} className={styles.summaryHospitalLogo} />}
                <div className={styles.summaryHospitalInfo}>
                  <h3 className={styles.summaryHospitalName}>{hospitalInfo?.name || "Hospital"}</h3>
                  {hospitalInfo?.address && <p className={styles.summaryHospitalAddress}><MapPin size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />{hospitalInfo.address}</p>}
                </div>
              </div>

              {/* Appointment Details */}
              <div className={styles.summarySection}>
                <div className={styles.summarySectionTitle}>
                  Appointment Details
                  {step > 1 && <button type="button" onClick={editAppointment} className={styles.summaryEditBtn}><Edit2 size={12} /> Edit</button>}
                </div>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Doctor</span>
                    <span className={styles.summaryValueStrong}>{selectedDoctor?.name || "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Specialty</span>
                    <span className={styles.summaryValue}>{selectedDoctor?.specialization || selectedDoctor?.department?.name || "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Date</span>
                    <span className={styles.summaryValueStrong}>{form.appointmentDate ? fmtDate(form.appointmentDate) : "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Time</span>
                    <span className={styles.summaryValueStrong}>{form.timeSlot ? fmt12(form.timeSlot) : "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Type</span>
                    <span className={styles.summaryValue}>{form.type}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Department</span>
                    <span className={styles.summaryValue}>{selectedDept?.name || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Fee Breakdown */}
              {hasOnlineBookingFee && (
                <div className={styles.summarySection}>
                  <div className={styles.summarySectionTitle}>Payment Summary</div>
                  <div className={styles.feeBreakdown}>
                    <div className={styles.feeRow}>
                      <span className={styles.feeLabel}>Online booking fee (consultation included)</span>
                      <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.baseAmountPaise).toFixed(2)}</span>
                    </div>
                    <div className={styles.feeRow}>
                      <span className={styles.feeLabel}>Convenience fee (2%)</span>
                      <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.convenienceFeePaise).toFixed(2)}</span>
                    </div>
                    <div className={`${styles.feeRow} ${styles.feeRowTotal}`}>
                      <span className={styles.feeLabel}>Total Payable</span>
                      <span className={styles.feeValue}>₹{totalAmount}</span>
                    </div>
                  </div>
                </div>
              )}

              {!hasOnlineBookingFee && (
                <div className={styles.summarySection} style={{ color: "var(--error)", fontSize: "var(--font-size-sm)" }}>
                  <AlertCircle size={16} style={{ marginRight: 8 }} /> Online payment unavailable for this doctor
                </div>
              )}

              {/* Secure Badge */}
              <div className={styles.summarySection} style={{ paddingTop: 0 }}>
                <div className={styles.secureBadge}>
                  <Shield size={14} /> Secured by Cashfree Payments
                </div>
              </div>

              {/* Cashfree Branding */}
              <div className={styles.cashfreeBrand}>
                <div className={styles.cashfreeLogo}>
                  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                    <rect width="120" height="120" rx="20" fill="#1E293B"/>
                    <text x="60" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="48" fontWeight="bold" fill="#14B8A6">₹</text>
                  </svg>
                </div>
                <div className={styles.cashfreeInfo}>
                  <p className={styles.cashfreeName}>Cashfree Payments</p>
                  <p className={styles.cashfreeTagline}>India's leading payment gateway</p>
                </div>
              </div>

              {/* Desktop CTA */}
              <div className={styles.desktopCTA}>
                <div className={styles.desktopCTAAmount}>
                  <span className={styles.desktopCTATotal}>₹{totalAmount}</span>
                  <span className={styles.desktopCTALabel}>Total Payable</span>
                </div>
                <button type="button" onClick={step === 3 ? handleSubmit : goToStep3}
                  disabled={saving || step !== 3 || !hasOnlineBookingFee || (!isDiagnostic && !form.timeSlot)}
                  className={styles.desktopCTABtn}>
                  {saving ? (
                    <> <span className={styles.spinner} /> {returnedOrderId ? "Verifying..." : "Processing..."} </>
                  ) : step === 3 ? (
                    <> <CheckCircle2 size={14} /> Pay ₹{totalAmount} & Confirm </>
                  ) : (
                    <> <ArrowRight size={14} /> Continue to Payment </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile / Tablet Layout */}
      <div className={styles.mobileLayout}>
        {/* Mobile Header */}
        <header className={styles.header} style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--white)", borderBottom: "1px solid var(--gray-100)", padding: "var(--space-4)" }}>
          <a href="/" className={styles.backLink}><ArrowLeft size={16} /> Back to Home</a>
          <div className={styles.headerIcon}><CalendarPlus size={22} /></div>
          <div className={styles.headerTitle}>
            <h1 className={styles.headerH1}>{loadingHospital ? "Loading..." : hospitalInfo ? `Book at ${hospitalInfo.name}` : "Book an Appointment"}</h1>
            <p className={styles.headerSub}>Schedule your visit in a few simple steps</p>
          </div>
          {hospitalInfo?.logo && <img src={hospitalInfo.logo} alt={hospitalInfo.name} className={styles.hospitalLogo} />}
        </header>

        {/* Mobile Progress Indicator */}
        <nav className={styles.progressIndicator} style={{ position: "sticky", top: "72px", zIndex: 40, background: "var(--white)", borderBottom: "1px solid var(--gray-100)", padding: "var(--space-4) var(--space-4) var(--space-2)" }} aria-label="Booking progress">
          <div className={`${styles.progressStep} ${step > 1 ? styles.completed : step === 1 ? styles.active : ""}`}>
            <div className={styles.progressCircle}><CheckCircle2 size={14} /></div>
            <span className={styles.progressLabel}>Patient</span>
          </div>
          <div className={`${styles.progressStep} ${step > 2 ? styles.completed : step === 2 ? styles.active : ""}`}>
            <div className={styles.progressCircle}>{step > 1 ? <Check size={14} /> : "2"}</div>
            <span className={styles.progressLabel}>Appointment</span>
          </div>
          <div className={`${styles.progressStep} ${step === 3 ? styles.active : ""}`}>
            <div className={styles.progressCircle}>{step > 2 ? <Check size={14} /> : "3"}</div>
            <span className={styles.progressLabel}>Review & Pay</span>
          </div>
        </nav>

        {/* Mobile Content */}
        <main className={styles.mobileContent}>
          {loadingHospital && <div className={styles.loadingState} style={{ padding: "var(--space-10)" }}><span className={styles.spinner} /><span>Loading form...</span></div>}
          {!loadingHospital && !resolvedHid && <div className={styles.errorState} style={{ margin: "var(--space-4)" }}><AlertCircle size={16} /> Unable to load booking form. Please use the QR code link provided by the hospital.</div>}

          {/* Step 1: Patient Details */}
          {!loadingHospital && resolvedHid && step === 1 && (
            <div className={styles.card} style={{ margin: "var(--space-4)", borderRadius: "var(--radius-xl)" }}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}><User className={styles.cardTitleIcon} size={18} /> Patient Details</h2>
              </div>
              <div className={styles.cardBody}>
                {errors.submit && <div className={styles.errorState}><AlertCircle size={14} />{errors.submit}</div>}

                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.required}`}>Full Name</label>
                  <div className={styles.inputWrap}>
                    <User className={styles.fieldIcon} size={18} />
                    <input className={styles.input} type="text" placeholder="e.g. John Doe"
                      value={form.name} onChange={e => setField("name", e.target.value)} autoComplete="name" />
                  </div>
                  {errors.name && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.name}</span>}
                </div>

                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.required}`}>Phone Number</label>
                  <div className={styles.inputWrap}>
                    <Phone className={styles.fieldIcon} size={18} />
                    <input className={styles.input} type="tel" placeholder="e.g. 9876543210"
                      value={form.phone} onChange={e => setField("phone", e.target.value)} autoComplete="tel" />
                  </div>
                  {errors.phone && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.phone}</span>}
                </div>

                <div className={styles.field}>
                  <label className={`${styles.label} ${styles.required}`}>Email Address</label>
                  <div className={styles.inputWrap}>
                    <Mail className={styles.fieldIcon} size={18} />
                    <input className={styles.input} type="email" placeholder="e.g. john@example.com"
                      value={form.email} onChange={e => setField("email", e.target.value)} autoComplete="email" />
                  </div>
                  {errors.email && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.email}</span>}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Age</label>
                  <div className={styles.inputWrap}>
                    <Calendar className={styles.fieldIcon} size={18} />
                    <input className={styles.input} type="number" min={0} max={150} placeholder="e.g. 32"
                      value={form.age} onChange={e => setField("age", e.target.value)} />
                  </div>
                  {errors.age && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.age}</span>}
                </div>

                <button type="button" onClick={goToStep2} className={styles.desktopCTABtn} style={{ width: "100%", justifyContent: "center", marginTop: "8px", padding: "14px" }}>
                  Continue to Appointment Details <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Appointment Details */}
          {!loadingHospital && resolvedHid && step === 2 && (
            <>
              {/* Mobile Collapsible Summary */}
              <button type="button" className={styles.mobileSummaryTrigger} onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)} aria-expanded={mobileSummaryOpen}>
                <div className={styles.mobileSummaryInfo}>
                  <span className={styles.mobileSummaryDoctor}>{selectedDoctor?.name || "Select doctor to see summary"}</span>
                  <span className={styles.mobileSummaryDetails}>
                    {form.appointmentDate ? `${getDayName(form.appointmentDate)}, ${fmtDateShort(form.appointmentDate)}` : "No date selected"}
                    {form.timeSlot && ` at ${fmt12(form.timeSlot)}`}
                  </span>
                </div>
                <div className={styles.mobileSummaryAmount}>
                  <span className={styles.mobileSummaryTotal}>₹{totalAmount}</span>
                  <span className={styles.mobileSummaryLabel}>Total Payable</span>
                </div>
                <ChevronDown className={`${styles.mobileSummaryChevron} ${mobileSummaryOpen ? styles.mobileSummaryChevronOpen : ""}`} size={20} />
              </button>

              <div className={`${styles.mobileSummaryPanel} ${styles.card}`} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)", display: mobileSummaryOpen ? "block" : "none" }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryHeader}>
                    {hospitalInfo?.logo && <img src={hospitalInfo.logo} alt={hospitalInfo.name} className={styles.summaryHospitalLogo} />}
                    <div className={styles.summaryHospitalInfo}>
                      <h3 className={styles.summaryHospitalName}>{hospitalInfo?.name || "Hospital"}</h3>
                      {hospitalInfo?.address && <p className={styles.summaryHospitalAddress}><MapPin size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />{hospitalInfo.address}</p>}
                    </div>
                  </div>

                  <div className={styles.summarySection}>
                    <div className={styles.summarySectionTitle}>
                      Appointment Details
                      <button type="button" onClick={editAppointment} className={styles.summaryEditBtn}><Edit2 size={12} /> Edit</button>
                    </div>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Doctor</span>
                        <span className={styles.summaryValueStrong}>{selectedDoctor?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Specialty</span>
                        <span className={styles.summaryValue}>{selectedDoctor?.specialization || selectedDoctor?.department?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Date</span>
                        <span className={styles.summaryValueStrong}>{form.appointmentDate ? fmtDate(form.appointmentDate) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Time</span>
                        <span className={styles.summaryValueStrong}>{form.timeSlot ? fmt12(form.timeSlot) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Type</span>
                        <span className={styles.summaryValue}>{form.type}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Department</span>
                        <span className={styles.summaryValue}>{selectedDept?.name || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {hasOnlineBookingFee && (
                    <div className={styles.summarySection}>
                      <div className={styles.summarySectionTitle}>Payment Summary</div>
                      <div className={styles.feeBreakdown}>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Online booking fee (consultation included)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.baseAmountPaise).toFixed(2)}</span>
                        </div>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Convenience fee (2%)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.convenienceFeePaise).toFixed(2)}</span>
                        </div>
                        <div className={`${styles.feeRow} ${styles.feeRowTotal}`}>
                          <span className={styles.feeLabel}>Total Payable</span>
                          <span className={styles.feeValue}>₹{totalAmount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasOnlineBookingFee && (
                    <div className={styles.summarySection} style={{ color: "var(--error)", fontSize: "var(--font-size-sm)" }}>
                      <AlertCircle size={16} style={{ marginRight: 8 }} /> Online payment unavailable for this doctor
                    </div>
                  )}

                  <div className={styles.summarySection} style={{ paddingTop: 0 }}>
                    <div className={styles.secureBadge}>
                      <Shield size={14} /> Secured by Cashfree Payments
                    </div>
                  </div>

                  <div className={styles.cashfreeBrand}>
                    <div className={styles.cashfreeLogo}>
                      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                        <rect width="120" height="120" rx="20" fill="#1E293B"/>
                        <text x="60" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="48" fontWeight="bold" fill="#14B8A6">₹</text>
                      </svg>
                    </div>
                    <div className={styles.cashfreeInfo}>
                      <p className={styles.cashfreeName}>Cashfree Payments</p>
                      <p className={styles.cashfreeTagline}>India's leading payment gateway</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Banner */}
              <div className={styles.card} style={{ margin: "var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                <div className={styles.patientBanner}>
                  <div className={styles.patientAvatar}>{form.name.charAt(0).toUpperCase() || "?"}</div>
                  <div>
                    <p className={styles.patientName}>{form.name}</p>
                    <p className={styles.patientDetails}>{form.phone} &middot; {form.email}</p>
                  </div>
                  <button type="button" onClick={editPatient} className={styles.editBtn}><Edit2 size={12} /> Edit</button>
                </div>
              </div>

              {/* Department Selection */}
              <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><Building2 className={styles.cardTitleIcon} size={18} /> Department</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.field} style={{ position: "relative" }}>
                    <label className={`${styles.label} ${styles.required}`}>Department</label>
                    <div className={styles.inputWrap} onClick={() => setDepartmentDropdownOpen(!departmentDropdownOpen)}>
                      <Building2 className={styles.fieldIcon} size={18} />
                      <span style={{ flex: 1, textAlign: "left", color: form.departmentId ? "#1e293b" : "#94a3b8" }}>
                        {selectedDept?.name || "Select Department..."}
                      </span>
                      <ChevronDown className={`${styles.selectChevron} ${departmentDropdownOpen ? styles.selectChevronOpen : ""}`} size={18} />
                    </div>
                    {departmentDropdownOpen && (
                      <div className={styles.dropdownPanel} style={{ position: "fixed", top: "auto", bottom: 0, left: 0, right: 0, borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", maxHeight: "60vh", zIndex: 200 }}>
                        <input className={styles.dropdownSearch} placeholder="Search departments..." value={departmentSearch}
                          onChange={e => setDepartmentSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                        {filteredDepartments.length === 0 ? (
                          <div className={styles.dropdownEmpty}>No departments found</div>
                        ) : (
                          filteredDepartments.map(d => (
                            <button key={d.id} className={`${styles.dropdownOption} ${form.departmentId === d.id ? styles.dropdownOptionSelected : ""}`}
                              onClick={() => { setField("departmentId", d.id); setField("doctorId", ""); setDepartmentDropdownOpen(false); }}>
                              <span className={styles.optionName}>{d.name}</span>
                              {form.departmentId === d.id && <Check className={styles.optionCheck} size={18} />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {errors.departmentId && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.departmentId}</span>}
                  </div>
                </div>
              </div>

              {/* Doctor Selection */}
              {!isDiagnostic && (
                <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}><UserRound className={styles.cardTitleIcon} size={18} /> Doctor</h2>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.field} style={{ position: "relative" }}>
                      <label className={`${styles.label} ${styles.required}`}>Doctor</label>
                      <div className={styles.inputWrap} onClick={() => setDoctorDropdownOpen(!doctorDropdownOpen)}>
                        <UserRound className={styles.fieldIcon} size={18} />
                        <span style={{ flex: 1, textAlign: "left", color: form.doctorId ? "#1e293b" : "#94a3b8" }}>
                          {selectedDoctor?.name || "Select Doctor..."}
                        </span>
                        <ChevronDown className={`${styles.selectChevron} ${doctorDropdownOpen ? styles.selectChevronOpen : ""}`} size={18} />
                      </div>
                      {doctorDropdownOpen && (
                        <div className={styles.dropdownPanel} style={{ position: "fixed", top: "auto", bottom: 0, left: 0, right: 0, borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", maxHeight: "70vh", zIndex: 200, minWidth: "auto" }}>
                          <input className={styles.dropdownSearch} placeholder="Search doctors..." value={doctorSearch}
                            onChange={e => setDoctorSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                          {loadingDoctors ? (
                            <div className={styles.dropdownEmpty}><Loader2 size={16} className={styles.spinner} /> Loading doctors...</div>
                          ) : filteredDoctorsList.length === 0 ? (
                            <div className={styles.dropdownEmpty}>No doctors available in this department</div>
                          ) : (
                            filteredDoctorsList.map(d => (
                              <button key={d.id} className={`${styles.dropdownOption} ${form.doctorId === d.id ? styles.dropdownOptionSelected : ""}`}
                                onClick={() => {
                                  setField("doctorId", d.id);
                                  setField("timeSlot", "");
                                  if (d.consultationFee) setField("consultationFee", String(d.consultationFee));
                                  if (d.departmentId && !form.departmentId) setField("departmentId", d.departmentId);
                                  setDoctorDropdownOpen(false);
                                }}>
                                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                                  <span className={styles.optionName}>{d.name}</span>
                                  <span className={styles.optionDesc}>
                                    {d.specialization || d.department?.name}
                                    {d.consultationFee && ` · ₹${d.consultationFee}`}
                                    {d.experienceYears && ` · ${d.experienceYears} yrs exp`}
                                  </span>
                                </div>
                                {form.doctorId === d.id && <Check className={styles.optionCheck} size={18} />}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {errors.doctorId && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.doctorId}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostic Info */}
              {isDiagnostic && form.appointmentDate && (
                <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)", background: "#eff6ff", border: "1.5px solid #93c5fd" }}>
                  <div className={styles.cardBody} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>Our team will confirm your appointment time. Please arrive at the selected date and we will schedule your diagnostic visit.</span>
                  </div>
                </div>
              )}

              {/* Date Selection */}
              <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><CalendarDays className={styles.cardTitleIcon} size={18} /> Date</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.calendarWrapper} style={{ position: "relative" }}>
                    <label className={`${styles.label} ${styles.required}`}>Appointment Date</label>
                    <button type="button" className={styles.calendarTrigger} onClick={() => setShowCalendar(!showCalendar)}>
                      <Calendar className={styles.fieldIcon} size={18} />
                      <span style={{ flex: 1, textAlign: "left", color: form.appointmentDate ? "#1e293b" : "#94a3b8" }}>
                        {form.appointmentDate ? `${getDayName(form.appointmentDate)}, ${fmtDate(form.appointmentDate)}` : "Select Date..."}
                      </span>
                      <ChevronDown className={`${styles.selectChevron} ${showCalendar ? styles.selectChevronOpen : ""}`} size={18} />
                    </button>
                    {showCalendar && (
                      <div className={styles.calendarPanel} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", right: "auto", margin: 0, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 64px)", overflowY: "auto", zIndex: 200, borderRadius: "var(--radius-xl)" }}>
                        <div className={styles.calendarHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--gray-100)", marginBottom: "var(--space-3)" }}>
                          <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 700 }}>{monthName(calendarMonth)}</h3>
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <button className={styles.calendarNavBtn} onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
                            <button className={styles.calendarNavBtn} onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
                          </div>
                        </div>
                        <div className={styles.calendarDayNames}>
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className={styles.calendarDayName}>{d}</div>)}
                        </div>
                        <div className={styles.calendarGrid}>
                          {calendarDays.map((day, i) => (
                            <button key={i} type="button"
                              disabled={!day || isDateDisabled(day)}
                              className={`${styles.calendarDay}
                                ${!day ? styles.calendarDayOther : ""}
                                ${day && isDateDisabled(day) ? styles.calendarDayDisabled : ""}
                                ${day && isDateToday(day) ? styles.calendarDayToday : ""}
                                ${day && isDateSelected(day) ? styles.calendarDaySelected : ""}
                                ${day && isDateAvailable(day) ? styles.calendarDayAvailable : ""}`}
                              onClick={() => selectDate(day)}
                              aria-label={day ? toLocalDateStr(day) : ""}
                            >
                              {day ? day.getDate() : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {errors.appointmentDate && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.appointmentDate}</span>}
                  </div>
                </div>
              </div>

              {/* Time Slots */}
              {!isDiagnostic && form.doctorId && form.appointmentDate && (
                <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}><Clock className={styles.cardTitleIcon} size={18} /> Time Slot</h2>
                  </div>
                  <div className={styles.cardBody}>
                    {loadingSlots ? (
                      <div className={styles.loadingState}><span className={styles.spinner} /><span>Loading available slots...</span></div>
                    ) : slots.length === 0 ? (
                      <div className={styles.noSlots}>
                        <CalendarDays size={24} style={{ display: "block", margin: "0 auto 8px", color: "var(--error)" }} />
                        No available slots for this date. Doctor may be unavailable or fully booked.
                      </div>
                    ) : (
                      <>
                        {periods.map(period => {
                          const periodSlots = timeSlotsByPeriod[period] || [];
                          if (periodSlots.length === 0) return null;
                          return (
                            <div key={period} className={styles.timePeriod}>
                              <div className={styles.timePeriodLabel}>
                                {periodIcon(period)} {periodLabel(period)}
                              </div>
                              <div className={styles.timeGrid}>
                                {periodSlots.map(slot => {
                                  const isBooked = bookedSlots.includes(slot);
                                  const isPast = isSlotPassed(form.appointmentDate, slot);
                                  const disabled = isBooked || isPast;
                                  const selected = form.timeSlot === slot;
                                  return (
                                    <button key={slot} type="button" disabled={disabled}
                                      onClick={() => !disabled && setField("timeSlot", slot)}
                                      title={isPast ? "Time has passed" : isBooked ? "Already booked" : "Available"}
                                      className={`${styles.timeChip}
                                        ${selected ? styles.timeChipSelected : ""}
                                        ${disabled ? styles.timeChipDisabled : ""}`}
                                      style={{ minHeight: 48, fontSize: "var(--font-size-base)" }}
                                    >
                                      {fmt12(slot)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {errors.timeSlot && <span className={styles.errorMsg}><AlertCircle size={10} />{errors.timeSlot}</span>}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><Calendar className={styles.cardTitleIcon} size={18} /> Notes</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.field}>
                    <label className={styles.label}>Notes / Reason</label>
                    <textarea className={`${styles.input} ${styles.textarea}`} placeholder="Chief complaint or notes..."
                      value={form.notes} onChange={e => setField("notes", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button type="button" onClick={goBack}
                    style={{ flex: 1, minWidth: 140, padding: "14px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-600)", fontSize: "var(--font-size-sm)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={goToStep3}
                    disabled={saving || (!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee}
                    className={styles.desktopCTABtn} style={{ flex: 2, minWidth: 140, justifyContent: "center", padding: "14px" }}>
                    {saving ? (
                      <> <span className={styles.spinner} /> <span>Processing...</span> </>
                    ) : (
                      <> <CheckCircle2 size={14} /> <span>Continue to Payment</span> </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Review & Pay */}
          {!loadingHospital && resolvedHid && step === 3 && (
            <>
              {/* Mobile Collapsible Summary */}
              <button type="button" className={styles.mobileSummaryTrigger} onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)} aria-expanded={mobileSummaryOpen}>
                <div className={styles.mobileSummaryInfo}>
                  <span className={styles.mobileSummaryDoctor}>{selectedDoctor?.name || "—"}</span>
                  <span className={styles.mobileSummaryDetails}>
                    {form.appointmentDate ? `${getDayName(form.appointmentDate)}, ${fmtDateShort(form.appointmentDate)}` : "—"}
                    {form.timeSlot && ` at ${fmt12(form.timeSlot)}`}
                  </span>
                </div>
                <div className={styles.mobileSummaryAmount}>
                  <span className={styles.mobileSummaryTotal}>₹{totalAmount}</span>
                  <span className={styles.mobileSummaryLabel}>Total Payable</span>
                </div>
                <ChevronDown className={`${styles.mobileSummaryChevron} ${mobileSummaryOpen ? styles.mobileSummaryChevronOpen : ""}`} size={20} />
              </button>

              <div className={`${styles.mobileSummaryPanel} ${styles.card}`} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)", display: mobileSummaryOpen ? "block" : "none" }}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryHeader}>
                    {hospitalInfo?.logo && <img src={hospitalInfo.logo} alt={hospitalInfo.name} className={styles.summaryHospitalLogo} />}
                    <div className={styles.summaryHospitalInfo}>
                      <h3 className={styles.summaryHospitalName}>{hospitalInfo?.name || "Hospital"}</h3>
                      {hospitalInfo?.address && <p className={styles.summaryHospitalAddress}><MapPin size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />{hospitalInfo.address}</p>}
                    </div>
                  </div>

                  <div className={styles.summarySection}>
                    <div className={styles.summarySectionTitle}>
                      Appointment Details
                      <button type="button" onClick={editAppointment} className={styles.summaryEditBtn}><Edit2 size={12} /> Edit</button>
                    </div>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Doctor</span>
                        <span className={styles.summaryValueStrong}>{selectedDoctor?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Specialty</span>
                        <span className={styles.summaryValue}>{selectedDoctor?.specialization || selectedDoctor?.department?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Date</span>
                        <span className={styles.summaryValueStrong}>{form.appointmentDate ? fmtDate(form.appointmentDate) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Time</span>
                        <span className={styles.summaryValueStrong}>{form.timeSlot ? fmt12(form.timeSlot) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Type</span>
                        <span className={styles.summaryValue}>{form.type}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Department</span>
                        <span className={styles.summaryValue}>{selectedDept?.name || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {hasOnlineBookingFee && (
                    <div className={styles.summarySection}>
                      <div className={styles.summarySectionTitle}>Payment Summary</div>
                      <div className={styles.feeBreakdown}>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Online booking fee (consultation included)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.baseAmountPaise).toFixed(2)}</span>
                        </div>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Convenience fee (2%)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.convenienceFeePaise).toFixed(2)}</span>
                        </div>
                        <div className={`${styles.feeRow} ${styles.feeRowTotal}`}>
                          <span className={styles.feeLabel}>Total Payable</span>
                          <span className={styles.feeValue}>₹{totalAmount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasOnlineBookingFee && (
                    <div className={styles.summarySection} style={{ color: "var(--error)", fontSize: "var(--font-size-sm)" }}>
                      <AlertCircle size={16} style={{ marginRight: 8 }} /> Online payment unavailable for this doctor
                    </div>
                  )}

                  <div className={styles.summarySection} style={{ paddingTop: 0 }}>
                    <div className={styles.secureBadge}>
                      <Shield size={14} /> Secured by Cashfree Payments
                    </div>
                  </div>

                  <div className={styles.cashfreeBrand}>
                    <div className={styles.cashfreeLogo}>
                      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                        <rect width="120" height="120" rx="20" fill="#1E293B"/>
                        <text x="60" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="48" fontWeight="bold" fill="#14B8A6">₹</text>
                      </svg>
                    </div>
                    <div className={styles.cashfreeInfo}>
                      <p className={styles.cashfreeName}>Cashfree Payments</p>
                      <p className={styles.cashfreeTagline}>India's leading payment gateway</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Banner */}
              <div className={styles.card} style={{ margin: "var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                <div className={styles.patientBanner}>
                  <div className={styles.patientAvatar}>{form.name.charAt(0).toUpperCase() || "?"}</div>
                  <div>
                    <p className={styles.patientName}>{form.name}</p>
                    <p className={styles.patientDetails}>{form.phone} &middot; {form.email}</p>
                  </div>
                  <button type="button" onClick={editPatient} className={styles.editBtn}><Edit2 size={12} /> Edit</button>
                </div>
              </div>

              {/* Appointment Summary Card */}
              <div className={styles.card} style={{ margin: "0 var(--space-4) var(--space-4)", borderRadius: "var(--radius-xl)" }}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}><CreditCard className={styles.cardTitleIcon} size={18} /> Payment Summary</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.summarySection}>
                    <div className={styles.summarySectionTitle}>
                      Appointment Details
                      <button type="button" onClick={editAppointment} className={styles.summaryEditBtn}><Edit2 size={12} /> Edit</button>
                    </div>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Doctor</span>
                        <span className={styles.summaryValueStrong}>{selectedDoctor?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Specialty</span>
                        <span className={styles.summaryValue}>{selectedDoctor?.specialization || selectedDoctor?.department?.name || "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Date</span>
                        <span className={styles.summaryValueStrong}>{form.appointmentDate ? fmtDate(form.appointmentDate) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Time</span>
                        <span className={styles.summaryValueStrong}>{form.timeSlot ? fmt12(form.timeSlot) : "—"}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Type</span>
                        <span className={styles.summaryValue}>{form.type}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Department</span>
                        <span className={styles.summaryValue}>{selectedDept?.name || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {hasOnlineBookingFee && (
                    <div className={styles.summarySection}>
                      <div className={styles.summarySectionTitle}>Fee Breakdown</div>
                      <div className={styles.feeBreakdown}>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Online booking fee (consultation included)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.baseAmountPaise).toFixed(2)}</span>
                        </div>
                        <div className={styles.feeRow}>
                          <span className={styles.feeLabel}>Convenience fee (2%)</span>
                          <span className={styles.feeValue}>₹{paiseToRupees(onlineBookingAmounts.convenienceFeePaise).toFixed(2)}</span>
                        </div>
                        <div className={`${styles.feeRow} ${styles.feeRowTotal}`}>
                          <span className={styles.feeLabel}>Total Payable</span>
                          <span className={styles.feeValue}>₹{totalAmount}</span>
                        </div>
                      </div>
                      <small style={{ color: "var(--gray-500)", fontSize: 11, display: "block", marginTop: "var(--space-2)" }}>The 2% convenience fee is charged only during online payment. Consultation is not added separately.</small>
                    </div>
                  )}

                  {!hasOnlineBookingFee && (
                    <div className={styles.errorState}><AlertCircle size={14} /> Online payment is unavailable for this doctor. Please contact the hospital.</div>
                  )}

                  <div className={styles.secureBadge}>
                    <Shield size={14} /> Secured by Cashfree Payments
                  </div>

                  <div className={styles.cashfreeBrand}>
                    <div className={styles.cashfreeLogo}>
                      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                        <rect width="120" height="120" rx="20" fill="#1E293B"/>
                        <text x="60" y="78" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="48" fontWeight="bold" fill="#14B8A6">₹</text>
                      </svg>
                    </div>
                    <div className={styles.cashfreeInfo}>
                      <p className={styles.cashfreeName}>Cashfree Payments</p>
                      <p className={styles.cashfreeTagline}>India's leading payment gateway</p>
                    </div>
                  </div>

                  {errors.submit && <div className={styles.errorState}><AlertCircle size={14} />{errors.submit}</div>}

                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={editAppointment}
                      style={{ flex: 1, minWidth: 140, padding: "14px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-600)", fontSize: "var(--font-size-sm)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button type="button" onClick={handleSubmit}
                      disabled={saving || !hasOnlineBookingFee}
                      className={styles.desktopCTABtn} style={{ flex: 2, minWidth: 140, justifyContent: "center", padding: "16px" }}>
                      {saving ? (
                        <> <span className={styles.spinner} /> {returnedOrderId ? "Verifying payment..." : "Processing..."} </>
                      ) : (
                        <> <CheckCircle2 size={14} /> Pay ₹{totalAmount} & Confirm Appointment </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

        </main>

        {/* Mobile Sticky Bottom CTA */}
        <footer className={styles.mobileBottomCTA} style={{ display: hasOnlineBookingFee ? "block" : "none" }}>
          <div className={styles.mobileBottomCTAInner}>
            <div className={styles.mobileBottomCTAAmount}>
              <span className={styles.mobileBottomCTATotal}>₹{totalAmount}</span>
              <span className={styles.mobileBottomCTALabel}>Total Payable</span>
            </div>
            <button type="button" onClick={step === 3 ? handleSubmit : step === 2 ? goToStep3 : goToStep2}
              disabled={saving || (step === 3 && !hasOnlineBookingFee) || (step === 2 && ((!isDiagnostic && !form.timeSlot) || !hasOnlineBookingFee))}
              className={styles.mobileBottomCTABtn}>
              {saving ? (
                <> <span className={styles.spinner} /> {returnedOrderId ? "Verifying..." : "Processing..."} </>
              ) : step === 3 ? (
                <> <CheckCircle2 size={14} /> Pay ₹{totalAmount} & Confirm </>
              ) : step === 2 ? (
                <> <ArrowRight size={14} /> Continue to Payment </>
              ) : (
                <> <ArrowRight size={14} /> Continue to Appointment </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function AppointmentPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /></div>}>
      <AppointmentForm />
    </Suspense>
  );
}