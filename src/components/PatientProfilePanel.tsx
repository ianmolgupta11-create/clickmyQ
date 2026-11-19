"use client";
import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft, Phone, Mail, Calendar, Droplets, MapPin,
  Hash, AlertCircle, Loader2,
  CalendarCheck, Plus, X, Stethoscope, FileText, Eye,
  Activity, ChevronDown, ChevronUp, User, Heart, UserRound,
} from "lucide-react";

import { PrescriptionModal } from "./PrescriptionModal";
const api = async (url: string, method = "GET", body?: any) => {
  const opts: any = { method, credentials: "include", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
};

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  SCHEDULED: { color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  CONFIRMED: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  COMPLETED: { color: "#14B8A6", bg: "#f5f3ff", border: "#CCFBF1" },
  CANCELLED: { color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
  NO_SHOW: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  RESCHEDULED: { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
};

const FOLLOWUP_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  PENDING: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  COMPLETED: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  CANCELLED: { color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
};

const fmt12 = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

function InfoChip({ icon: Icon, value, color = "#64748b", bg = "#f8fafc" }: { icon: any; value: string; color?: string; bg?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: bg, fontSize: 12, color, fontWeight: 500, border: `1px solid ${color}20` }}>
      <Icon size={13} color={color} />
      {value}
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | number | null | undefined; icon?: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
      {Icon && <div style={{ marginTop: 2, color: "#94a3b8" }}><Icon size={14} /></div>}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

function FollowUpScheduleModal({
  patientId, onClose, onSuccess
}: { patientId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ followUpDate: "", reason: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    const d = await api("/api/followups", "POST", { patientId, ...form, followUpDate: form.followUpDate });
    if (d.success) { onSuccess(); onClose(); }
    else setMsg(d.message || "Error");
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b" }}>Schedule Follow-up</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "#f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "followUpDate", l: "Follow-up Date *", type: "date", req: true },
            { k: "reason", l: "Reason", type: "text", req: false },
          ].map(f => (
            <div key={f.k} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" }}>{f.l}</label>
              <input required={f.req} type={f.type} min={f.type === "date" ? today : undefined}
                style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#1e293b", outline: "none" }}
                value={(form as any)[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" }}>Notes</label>
            <textarea rows={3} style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#1e293b", outline: "none", resize: "none", fontFamily: "inherit" }}
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          {msg && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{msg}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {saving && <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />}Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function PatientProfilePanel({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"appointments" | "followups">("appointments");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewPrescriptionApptId, setViewPrescriptionApptId] = useState<string | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api(`/api/patients/${patientId}`).then(d => {
      if (d.success) setPatient(d.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [patientId, refreshKey]);

  const updateFollowUpStatus = async (fid: string, status: string) => {
    await api(`/api/followups/${fid}`, "PUT", { status });
    setRefreshKey(k => k + 1);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", gap: 10, color: "#64748b", padding: "80px 0" }}>
      <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
      <span style={{ fontSize: 14 }}>Loading patient details...</span>
    </div>
  );

  if (!patient) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: "#94a3b8", padding: "80px 0", fontSize: 14 }}>
      Patient not found.
    </div>
  );

  const dob = patient.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const visits = patient._count?.appointments || 0;
  const followUpsCount = patient._count?.followUps || 0;

  const TABS = [
    { id: "appointments" as const, label: "Appointments", count: visits },
    { id: "followups" as const, label: "Follow-ups", count: followUpsCount },
  ];

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 960, margin: "0 auto" }}>
      {/* Back */}
      <button onClick={onBack}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
        <ArrowLeft size={13} /> Back to Patients
      </button>

      {viewPrescriptionApptId && (
        <PrescriptionModal appointmentId={viewPrescriptionApptId} onClose={() => setViewPrescriptionApptId(null)} />
      )}

      {/* ── Patient Header Card ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        {/* Banner Section */}
        <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "28px 32px", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "#f8fafc", border: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#14B8A6", flexShrink: 0 }}>
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 24, color: "#1e293b", lineHeight: 1.2 }}>{patient.name}</div>
            <div style={{ fontSize: 14, color: "#64748b", marginTop: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#f1f5f9", padding: "3px 10px", borderRadius: 8, fontWeight: 700, color: "#475569", fontSize: 12 }}>
                <Hash size={12} />{patient.patientId}
              </span>
              {patient.gender && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={14} />{patient.gender}</span>}
              {age && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={14} />{age} Years</span>}
              {patient.bloodGroup && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 8, background: "#fff1f2", fontSize: 12, fontWeight: 700, color: "#e11d48", border: "1px solid #ffe4e6" }}>
                  <Droplets size={12} />{patient.bloodGroup}
                </span>
              )}
            </div>
          </div>
          {/* Stats Summary */}
          <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
            <div style={{ textAlign: "center", padding: "12px 20px", background: "#f0fdf4", borderRadius: 14, border: "1px solid #dcfce7" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>{visits}</div>
              <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, textTransform: "uppercase", marginTop: 2, letterSpacing: ".02em" }}>Total Visits</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px 20px", background: "#f0f9ff", borderRadius: 14, border: "1px solid #e0f2fe" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0ea5e9" }}>{followUpsCount}</div>
              <div style={{ fontSize: 10, color: "#0ea5e9", fontWeight: 700, textTransform: "uppercase", marginTop: 2, letterSpacing: ".02em" }}>Follow-ups</div>
            </div>
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div style={{ padding: "24px 32px", background: "#fcfdfe", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px 40px" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <UserRound size={14} color="#14B8A6" /> Basic Information
            </div>
            <DetailRow label="Full Name" value={patient.name} />
            <DetailRow label="Gender" value={patient.gender} />
            <DetailRow label="Date of Birth" value={dob?.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} />
            <DetailRow label="Blood Group" value={patient.bloodGroup} />
            <DetailRow label="Age" value={age ? `${age} Years` : null} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Phone size={14} color="#14B8A6" /> Contact Details
            </div>
            <DetailRow label="Phone Number" value={patient.phone} />
            <DetailRow label="Email Address" value={patient.email} />
            <DetailRow label="Residential Address" value={patient.address} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Heart size={14} color="#e11d48" /> Medical Overview
            </div>
            <DetailRow label="Marital Status" value={patient.maritalStatus} />
            <DetailRow label="Emergency Contact" value={patient.emergencyContact} />
            <DetailRow label="Allergies" value={patient.allergies || "None Reported"} />
            <DetailRow label="Chronic Conditions" value={patient.chronicConditions || "None Reported"} />
          </div>
        </div>

        {/* Actions Row */}
        <div style={{ padding: "16px 32px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, borderTop: "1px solid #f1f5f9" }}>
          <button onClick={() => setShowFollowUp(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(16,185,129,0.2)" }}>
            <Plus size={14} />Schedule Follow-up
          </button>
          <a href={`/hospitaladmin/appointments?patientId=${patient.id}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "1.5px solid #14B8A6", background: "#fff", color: "#14B8A6", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
            <CalendarCheck size={14} />Book New Appointment
          </a>
        </div>
      </div>

      {/* ── Toggle Tabs ── */}
      <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 12, padding: 4, marginBottom: 16, width: "fit-content", border: "1px solid #e2e8f0" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 20px", borderRadius: 9, border: "none",
              background: activeTab === t.id ? "#fff" : "transparent",
              color: activeTab === t.id ? "#0369a1" : "#64748b",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
              transition: "all .15s",
            }}>
            {t.id === "appointments" ? <Activity size={13} /> : <CalendarCheck size={13} />}
            {t.label}
            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: activeTab === t.id ? "#e0f2fe" : "#e2e8f0", color: activeTab === t.id ? "#0369a1" : "#94a3b8", fontWeight: 700 }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Appointments Tab ── */}
      {activeTab === "appointments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!patient.appointments?.length ? (
            <div style={{ textAlign: "center", padding: "56px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", color: "#94a3b8", fontSize: 14 }}>
              <Activity size={32} style={{ marginBottom: 10, opacity: .3 }} />
              <div>No appointments yet</div>
            </div>
          ) : patient.appointments.map((appt: any) => {
            const sc = STATUS_COLORS[appt.status] || STATUS_COLORS.SCHEDULED;
            const date = new Date(appt.appointmentDate);
            const isExpanded = expandedAppt === appt.id;
            const isCompleted = appt.status === "COMPLETED";
            return (
              <div key={appt.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
                  onClick={() => setExpandedAppt(isExpanded ? null : appt.id)}>
                  {/* Date block */}
                  <div style={{ textAlign: "center", minWidth: 46, padding: "8px 10px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{date.getDate()}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginTop: 2 }}>
                      {date.toLocaleDateString("en-IN", { month: "short" })}
                    </div>
                    <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 1 }}>{date.getFullYear()}</div>
                  </div>
                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>
                        {appt.doctor?.name ? `Dr. ${appt.doctor.name}` : "—"}
                      </span>
                      {appt.department && (
                        <span style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                          <FileText size={10} />{appt.department.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
                        <Stethoscope size={10} />{fmt12(appt.timeSlot) || "—"}
                      </span>
                      {appt.tokenNumber && (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Token #{appt.tokenNumber}</span>
                      )}
                      {appt.consultationFee && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>₹{appt.consultationFee}</span>
                      )}
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#f1f5f9", color: "#64748b", fontWeight: 600 }}>
                        {appt.type?.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  {/* Right: status + prescription + expand */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {isCompleted && (
                      <button onClick={e => { e.stopPropagation(); setViewPrescriptionApptId(appt.id); }}
                        title="View Prescription"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, border: "1px solid #CCFBF1", background: "#faf5ff", color: "#14B8A6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        <Eye size={11} />Prescription
                      </button>
                    )}
                    <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {appt.status.replace("_", " ")}
                    </span>
                    <div style={{ color: "#cbd5e1" }}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>
                {/* Expanded notes */}
                {isExpanded && appt.notes && (
                  <div style={{ padding: "0 18px 14px", borderTop: "1px solid #f8fafc" }}>
                    <div style={{ fontSize: 12, color: "#64748b", background: "#f8fafc", padding: "9px 13px", borderRadius: 8, marginTop: 8, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: "#94a3b8", marginRight: 6, fontSize: 10, textTransform: "uppercase" }}>Notes</span>
                      {appt.notes}
                    </div>
                  </div>
                )}
                {isExpanded && !appt.notes && (
                  <div style={{ padding: "0 18px 12px", borderTop: "1px solid #f8fafc" }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1", paddingTop: 10 }}>No notes recorded.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Follow-ups Tab ── */}
      {activeTab === "followups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!patient.followUps?.length ? (
            <div style={{ textAlign: "center", padding: "56px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", color: "#94a3b8", fontSize: 14 }}>
              <CalendarCheck size={32} style={{ marginBottom: 10, opacity: .3 }} />
              <div>No follow-ups scheduled</div>
            </div>
          ) : patient.followUps.map((fu: any) => {
            const fc = FOLLOWUP_COLORS[fu.status] || FOLLOWUP_COLORS.PENDING;
            const fuDate = new Date(fu.followUpDate);
            const isPast = fuDate < new Date() && fu.status === "PENDING";
            return (
              <div key={fu.id} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${isPast ? "#fecaca" : "#e2e8f0"}`, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
                {/* Date block */}
                <div style={{ textAlign: "center", minWidth: 46, padding: "8px 10px", background: isPast ? "#fff5f5" : "#f0fdf4", borderRadius: 10, border: `1px solid ${isPast ? "#fecaca" : "#bbf7d0"}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isPast ? "#ef4444" : "#059669", lineHeight: 1 }}>{fuDate.getDate()}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: isPast ? "#fca5a5" : "#86efac", textTransform: "uppercase", marginTop: 2 }}>
                    {fuDate.toLocaleDateString("en-IN", { month: "short" })}
                  </div>
                  <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 1 }}>{fuDate.getFullYear()}</div>
                </div>
                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: isPast ? "#ef4444" : "#1e293b" }}>
                      {fuDate.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {isPast && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", fontWeight: 700 }}>OVERDUE</span>
                    )}
                  </div>
                  {fu.reason && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{fu.reason}</div>}
                  {fu.notes && (
                    <div style={{ fontSize: 12, color: "#64748b", background: "#f8fafc", padding: "7px 11px", borderRadius: 8, marginTop: 8, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: "#94a3b8", marginRight: 6, fontSize: 10, textTransform: "uppercase" }}>Notes</span>
                      {fu.notes}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: fc.bg, color: fc.color, border: `1px solid ${fc.border}`, fontWeight: 700 }}>
                    {fu.status}
                  </span>
                  {fu.status === "PENDING" && (
                    <button onClick={() => updateFollowUpStatus(fu.id, "COMPLETED")}
                      style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showFollowUp && (
        <FollowUpScheduleModal
          patientId={patient.id}
          onClose={() => setShowFollowUp(false)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
