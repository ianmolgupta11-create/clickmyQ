"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CalendarDays, FileText, Receipt, Loader2, AlertCircle, RefreshCw, QrCode, Clock, Users, AlertTriangle, MessageCircle, MapPin, RefreshCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PrescriptionModal } from "@/components/PrescriptionModal";
import { cn } from "@/lib/utils";
import type { Patient, Appointment, Prescription, Bill, QueueStatus, QueueAppointment } from "@/types/patient";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-jakarta" });

interface ApiResponse<T> { success: boolean; data: T; message?: string }
interface DashboardContentProps { slug?: string }

const TABS = [
  { id: "home" as const, label: "Live Queue", icon: Users },
  { id: "visits" as const, label: "Visits History", icon: CalendarDays },
  { id: "prescriptions" as const, label: "Prescriptions", icon: FileText },
  { id: "bills" as const, label: "Bills & Receipts", icon: Receipt },
];

const STATUS_CFG: Record<string, { label: string; variant: any }> = {
  SCHEDULED: { label: "Scheduled", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  CHECKED_IN: { label: "Checked In", variant: "warning" },
  IN_PROGRESS: { label: "In Consultation", variant: "primary" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "error" },
  NO_SHOW: { label: "No Show", variant: "error" },
  RESCHEDULED: { label: "Rescheduled", variant: "info" },
};

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <Card className="text-center py-8">
      <CardContent className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardContent({ slug }: DashboardContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const loginPath = slug ? `/patient/${slug}` : "/patient/login";
  const tab = (searchParams.get("tab") as any) || "home";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Patient | null>(null);
  const [queueData, setQueueData] = useState<{ appointment: QueueAppointment | null; queue: QueueStatus | null } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [viewRxApptId, setViewRxApptId] = useState<string | null>(null);
  const [delayAlert, setDelayAlert] = useState<any | null>(null);
  const [prevNowServing, setPrevNowServing] = useState<string | null>(null);
  const [nowServingJustChanged, setNowServingJustChanged] = useState(false);
  // Doctor interruption status from the queue API (Emergency / Break / ACTIVE)
  const [doctorInterruption, setDoctorInterruption] = useState<{
    status: string;
    statusStartedAt: string | null;
    expectedReturnAt: string | null;
    actualReturnAt: string | null;
  } | null>(null);
  // Remaining delay minutes (computed client-side from expectedReturnAt − now)
  const [remainingDelayMin, setRemainingDelayMin] = useState<number | null>(null);
  // Ref to track previous interruption for early-return detection
  const prevInterruptionRef = useRef<{ status: string; expectedReturnAt: string | null } | null>(null);

  const gotoLogin = useCallback(() => router.replace(loginPath), [router, loginPath]);

  const loadQueue = useCallback(async () => {
    try {
      const r = await fetch("/api/patient/me/queue", { credentials: "include" });
      if (r.status === 401) return gotoLogin();
      const d: ApiResponse<{
        appointment: QueueAppointment | null;
        queue: QueueStatus | null;
        doctorInterruption: {
          status: string;
          statusStartedAt: string | null;
          expectedReturnAt: string | null;
          actualReturnAt: string | null;
        } | null;
      }> = await r.json();
      if (d.success) {
        setQueueData(d.data);
        setDoctorInterruption(d.data.doctorInterruption ?? null);
      }
    } catch {}
  }, [gotoLogin]);

  const loadDelayAlert = useCallback(async () => {
    try {
      const r = await fetch("/api/patient/me/delay-alert", { credentials: "include" });
      if (r.status === 401) return gotoLogin();
      const d: ApiResponse<{ delayAlert: any | null }> = await r.json();
      if (d.success) setDelayAlert(d.data?.delayAlert || null);
    } catch {}
  }, [gotoLogin]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await fetch("/api/patient/me", { credentials: "include" });
      if (m.status === 401) return gotoLogin();
      const md: ApiResponse<Patient> = await m.json();
      if (!md.success) return gotoLogin();
      const patient = md.data;
      if (slug) {
        try {
          const r = await fetch(`/api/public/booking?slug=${encodeURIComponent(slug)}`, { credentials: "include" });
          const d = await r.json();
          if (d.success && d.data?.hospital?.id !== (patient.hospital?.id ?? "")) return gotoLogin();
        } catch {}
      }
      setMe(patient);
      const [a, p, b, q] = await Promise.all([
        fetch("/api/patient/me/appointments", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/patient/me/prescriptions", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/patient/me/bills", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/patient/me/queue", { credentials: "include" }).then((r) => r.json()),
      ]);
      if (a.success) setAppointments(a.data || []);
      if (p.success) setPrescriptions(p.data || []);
      if (b.success) setBills(b.data || []);
      if (q.success) setQueueData(q.data);
      await loadDelayAlert();
      setLoading(false);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }, [slug, gotoLogin]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { const iv = setInterval(loadQueue, 15000); return () => clearInterval(iv); }, [loadQueue]);
  useEffect(() => { const iv2 = setInterval(loadDelayAlert, 15000); return () => clearInterval(iv2); }, [loadDelayAlert]);

  const q = queueData?.queue ?? null;
  useEffect(() => {
    const current = q?.nowServingToken ?? null;
    if (prevNowServing !== null && prevNowServing !== current && current !== null) {
      setNowServingJustChanged(true);
      setTimeout(() => setNowServingJustChanged(false), 2000);
    }
    setPrevNowServing(current);
  }, [q?.nowServingToken, prevNowServing]);

  // ── Recompute remaining delay every second while interrupted ──
  useEffect(() => {
    if (!doctorInterruption || doctorInterruption.status === "ACTIVE") {
      setRemainingDelayMin(null);
      return;
    }
    const iv = setInterval(() => {
      const expected = doctorInterruption.expectedReturnAt
        ? new Date(doctorInterruption.expectedReturnAt).getTime()
        : null;
      if (!expected) {
        setRemainingDelayMin(null);
        return;
      }
      const now = Date.now();
      const mins = Math.max(0, Math.ceil((expected - now) / 60000));
      setRemainingDelayMin(mins);
    }, 1000);
    return () => clearInterval(iv);
  }, [doctorInterruption]);

  // ── Early-return detection: interrupted → ACTIVE before deadline shows happy toast ──
  const [earlyReturnToast, setEarlyReturnToast] = useState<{
    shown: boolean;
    wasInterrupted: boolean;
  } | null>(null);

  useEffect(() => {
    const prev = prevInterruptionRef.current;
    const curr = doctorInterruption;

    // Detect transition: was interrupted, now ACTIVE
    const wasInterrupted = prev
      ? prev.status === "EMERGENCY" || prev.status === "ON_BREAK"
      : false;
    const nowActive = curr && curr.status === "ACTIVE";

    if (wasInterrupted && nowActive && curr) {
      const deadline = prev?.expectedReturnAt ? new Date(prev.expectedReturnAt).getTime() : null;
      const now = Date.now();
      const isEarly = deadline ? now < deadline : false;
      if (isEarly) {
        setEarlyReturnToast({
          shown: true,
          wasInterrupted: true,
        });
        // Auto-dismiss after 5 seconds
        const t = setTimeout(() => setEarlyReturnToast(null), 5000);
        return () => clearTimeout(t);
      }
      // If resuming after the deadline, do NOT show early-return message.
    }

    prevInterruptionRef.current = curr ?? null;
  }, [doctorInterruption]);

  const appt = queueData?.appointment ?? null;
  const apptStatus = appt?.status || "";
  const initials = (me?.name || "Patient").charAt(0).toUpperCase();

  const logout = async () => {
    try { await fetch("/api/patient/auth/logout", { method: "POST", credentials: "include" }); } catch {}
    gotoLogin();
  };

  if (loading) {
    return (
      <div className={cn("min-h-screen bg-brand-creamLight flex items-center justify-center", plusJakartaSans.className)}>
        <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn("min-h-screen bg-brand-creamLight flex items-center justify-center px-4", plusJakartaSans.className)}>
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Something went wrong</p>
              <p className="text-sm text-slate-600 mt-1">{error}</p>
            </div>
            <Button onClick={loadDashboard} leftIcon={<RefreshCw className="w-4 h-4" />}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = bills.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
  const paid = bills.reduce((s, b) => s + (b.paidAmount ?? 0), 0);
  const due = bills.reduce((s, b) => s + Math.max(0, (b.totalAmount ?? 0) - (b.paidAmount ?? 0)), 0);

  const switchTab = (id: string) => router.push(`${pathname}?tab=${id}`);

  const heroTheme = (() => {
    // Doctor interruption takes priority over appointment status for the hero theme.
    if (doctorInterruption && doctorInterruption.status === "EMERGENCY") {
      const remaining = remainingDelayMin ?? 0;
      return {
        bg: "bg-gradient-to-tr from-rose-500 to-rose-700",
        shadow: "shadow-clay-hero",
        dot: "text-rose-400 bg-rose-400",
        label: "🚨 Doctor is in an emergency",
        sub: `Expected delay: approximately ${remaining} minute${remaining !== 1 ? "s" : ""}.`,
        actionLabel: "Live OPD Queue",
        pulse: true,
        interruption: true,
      };
    }
    if (doctorInterruption && doctorInterruption.status === "ON_BREAK") {
      const remaining = remainingDelayMin ?? 0;
      return {
        bg: "bg-gradient-to-tr from-amber-400 to-amber-600",
        shadow: "shadow-clay-hero",
        dot: "text-amber-300 bg-amber-300",
        label: "☕ Doctor is currently on a break",
        sub: `Expected delay: approximately ${remaining} minute${remaining !== 1 ? "s" : ""}.`,
        actionLabel: "Live OPD Queue",
        pulse: true,
        interruption: true,
      };
    }
    if (apptStatus === "IN_PROGRESS") {
      return {
        bg: "bg-gradient-to-tr from-emerald-500 to-emerald-600",
        shadow: "shadow-clay-hero",
        dot: "text-emerald-400 bg-emerald-400",
        label: "You're with the doctor now",
        sub: `Consultation in progress — Dr. ${appt?.doctorName || "the doctor"} is with you`,
        actionLabel: "Consultation Active",
        pulse: true,
      };
    }
    if (apptStatus === "CHECKED_IN") {
      return {
        bg: "bg-gradient-to-tr from-emerald-500 to-emerald-600",
        shadow: "shadow-clay-hero",
        dot: "text-emerald-400 bg-emerald-400",
        label: "You're in the queue",
        sub: q?.nowServingToken ? `Now serving #${q.nowServingToken} · ${q.patientsAhead} ahead` : "Waiting to be called",
        actionLabel: "Scan at Reception Kiosk",
        pulse: true,
      };
    }
    if (apptStatus === "COMPLETED") {
      return {
        bg: "bg-gradient-to-tr from-brand-teal to-brand-tealDark",
        shadow: "shadow-clay-hero",
        dot: "text-brand-tealLight bg-brand-tealLight",
        label: "Visit completed",
        sub: "Hope you feel better soon! Your prescription is ready.",
        actionLabel: "Download Prescription",
        pulse: false,
      };
    }
    return {
      bg: "bg-[linear-gradient(142deg,#C27803_0%,#A45F00_55%,#8B4E00_100%)]",
      shadow: "shadow-clay-amber",
      dot: "text-amber-300 bg-amber-300",
      label: "Not checked in yet",
      sub: "Please check in at the reception when you arrive",
      actionLabel: "Scan at Reception Kiosk",
      pulse: false,
    };
  })();

  return (
    <div className={cn("min-h-screen font-jakarta text-slate-800 antialiased bg-brand-creamLight selection:bg-brand-teal selection:text-white flex flex-col justify-between", plusJakartaSans.className)}>
      <header className="w-full bg-[#FFFFFF]/90 backdrop-blur-md border-b border-brand-cream/80 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-brand-teal text-brand-cream flex items-center justify-center font-bold text-lg shadow-clay-pill border border-teal-600/30">
                <svg className="w-6 h-6 text-brand-amberGold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"></path></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-brand-teal tracking-tight">Aarogya Multispeciality Hospital</h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">OPD Active</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Patient Portal • Powered by Rojgaar OS Health</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/80 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Sync (15s)</span>
              </div>
              <div className="flex items-center gap-2.5 bg-brand-creamLight px-3 py-1.5 rounded-xl border border-brand-cream shadow-inner">
                <div className="h-7 w-7 rounded-lg bg-brand-teal text-white flex items-center justify-center font-bold text-xs">{initials}</div>
                <div className="text-left text-xs leading-tight">
                  <span className="font-bold text-slate-800 block">{me?.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{me?.patientId}</span>
                </div>
              </div>
              <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-all shadow-sm active:scale-95">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 013-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                <span className="hidden xs:inline">Logout</span>
              </button>
            </div>
          </div>
          <nav aria-label="Portal Tabs" className="flex space-x-1 sm:space-x-4 pt-2 overflow-x-auto pb-0.5">
            {TABS.map((t) => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => switchTab(t.id)} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold border-b-2 transition-colors", isActive ? "border-brand-teal bg-brand-cream/30 text-brand-teal" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50")}>
                  <t.icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {t.id === "home" && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-teal text-white text-[10px] font-bold">#1</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {delayAlert && delayAlert.isActive && (
          <div className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <Card className="border-0 shadow-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-white mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-base sm:text-lg font-bold">{delayAlert.type === "EMERGENCY" ? "Emergency / Important Update" : "Queue delay"}</p>
                      <p className="text-sm sm:text-base mt-1 font-medium">{delayAlert.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {earlyReturnToast && (
          <div className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <Card className="border-0 shadow-2xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-white overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 text-white mt-0.5">😊</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base sm:text-lg font-bold">Good news!</p>
                      <p className="text-sm sm:text-base mt-1 font-medium">The doctor has arrived early and resumed appointments.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {tab === "home" && (
          <div className="space-y-6">
            {loading ? (
              <div className="rounded-[28px] p-6 sm:p-8 bg-brand-creamLight border border-brand-cream animate-pulse h-48" />
            ) : appt ? (
              <section className={cn(heroTheme.bg, heroTheme.shadow, "rounded-[28px] p-6 sm:p-8 text-white relative overflow-hidden", heroTheme.pulse && "animate-subtle-pulse")} data-purpose="live-queue-hero">
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl" />
                <div className="absolute -left-12 -bottom-12 w-52 h-52 bg-yellow-300/15 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider border border-white/30 shadow-inner", apptStatus === "IN_PROGRESS" || apptStatus === "CHECKED_IN" ? "text-emerald-100" : apptStatus === "COMPLETED" ? "text-brand-tealLight" : "text-amber-100")}>
                      <span className={cn("w-2 h-2 rounded-full", heroTheme.dot)} /> Live OPD Queue
                    </span>
                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", apptStatus === "IN_PROGRESS" || apptStatus === "CHECKED_IN" ? "text-emerald-100/80" : apptStatus === "COMPLETED" ? "text-brand-cream/80" : "text-amber-100/80")}>
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Auto-refreshes every 15s
                    </span>
                  </div>
                  {heroTheme.interruption && (
                    <div className="mb-6 p-4 rounded-2xl border border-white/30 backdrop-blur-md bg-white/10 text-white text-center">
                      <span className="text-xl font-bold block mb-1">{heroTheme.label}</span>
                      <p className="text-sm opacity-90">{heroTheme.sub}</p>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <p className="text-5xl sm:text-6xl font-black tracking-tighter">{q?.patientsAhead ?? 0}</p>
                    <p className="text-lg font-bold mt-2">Patients Ahead</p>
                    <p className="text-sm opacity-90 mt-1">{heroTheme.sub}</p>
                  </div>
                  <div className="flex justify-center mb-6">
                    <button onClick={apptStatus === "COMPLETED" ? () => switchTab("prescriptions") : undefined} className={cn("inline-flex items-center gap-2 px-6 py-3 bg-white font-bold rounded-2xl shadow-clay-btn active:scale-95 transition-transform", apptStatus === "IN_PROGRESS" || apptStatus === "CHECKED_IN" || apptStatus === "COMPLETED" ? "text-emerald-700" : "text-amber-700")}>
                      <QrCode className="w-5 h-5" /> {heroTheme.actionLabel}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                      <p className="text-xs opacity-80">Your Token</p>
                      <p className="text-2xl font-black">#{appt.tokenNumber || "—"}</p>
                      <p className="text-[10px] opacity-70">Your assigned token number</p>
                    </div>
                    <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                      <p className="text-xs opacity-80">Est. Wait</p>
                      <p className="text-2xl font-black">~{q?.estimatedWaitMin ?? 0} min</p>
                      <p className="text-[10px] opacity-70">Immediate</p>
                    </div>
                    <div className={cn("rounded-2xl p-3 text-center backdrop-blur-sm", nowServingJustChanged ? "bg-emerald-500/30" : "bg-white/15")}>
                      <p className="text-xs opacity-80 flex items-center justify-center gap-1">Now Serving {nowServingJustChanged && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />}</p>
                      <p className="text-2xl font-black">{q?.nowServingToken ? `#${q.nowServingToken}` : "—"}</p>
                      {nowServingJustChanged && <p className="text-[10px] opacity-90 font-semibold">Just called!</p>}
                      <p className="text-[10px] opacity-70">Doctor ready for token</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs mb-6">
                    {["Token Created","Reception Check-in","Waiting in Lobby","Consultation"].map((s,i)=>(
                      <div key={s} className={cn("flex-1 text-center py-2 rounded-xl", i===1?"bg-white/25 font-bold":"bg-white/10")}>{s}</div>
                    ))}
                  </div>
                  <div className="bg-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div><p className="font-bold">Dr. {appt.doctorName || "—"}</p><p className="text-xs opacity-80">{appt.doctorSpecialization || "Pediatrics"}</p></div>
                    <div><p className="font-bold">{appt.departmentName || "Pediatrics OPD"} • Block B</p><p className="text-xs opacity-80">Scheduled Slot: {appt.timeSlot || "11:15 AM"} Today</p></div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] p-6 sm:p-8 bg-[#FAF8F5] shadow-clay-card border border-brand-cream relative overflow-hidden" data-purpose="live-queue-hero-empty">
                <div className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="w-16 h-16 rounded-full bg-brand-creamLight flex items-center justify-center">
                    <CalendarDays className="w-8 h-8 text-brand-teal" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-brand-teal tracking-tight">No Appointment Booked</h2>
                    <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Appointment Not Fixed
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                    You don't have an upcoming appointment yet. Book an appointment to view your doctor details and check-in pass here.
                  </p>
                  <Button onClick={() => {
                    const slug = me?.hospital?.bookingSlug;
                    if (slug) router.push(`/book/${slug}`);
                    else setMsg?.("") || setError("Booking is unavailable for this hospital.");
                  }} className="mt-2">
                    Book Appointment
                  </Button>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-[#FAF8F5] rounded-[24px] p-6 shadow-clay-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-brand-teal">Patient Information & Check-In Pass</h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Active File</span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-teal text-white flex items-center justify-center font-bold">{initials}</div>
                    <div>
                      <p className="font-bold text-slate-800">{me?.name || "Patient"}</p>
                      <p className="text-xs text-slate-500">{me?.gender || "—"} • {me?.age != null ? `${me.age} yrs` : "—"}</p>
                      <p className="text-xs text-slate-500 font-mono">Hospital ID {me?.patientId || "PT-0005"}</p>
                      {me?.phone && <p className="text-xs text-slate-500">{me.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-2 bg-white rounded-xl border border-brand-cream"><QrCode className="w-20 h-20 text-slate-400" /></div>
                    <p className="text-xs font-semibold text-slate-600">Fast Scan #{me?.patientId || "PT-0005"}</p>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1 mb-4">
                    <li>• Present QR at reception kiosk</li>
                    <li>• Keep token visible</li>
                    <li>• Wait for your number</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Reschedule Slot</Button>
                  <Button size="sm" variant="outline">Call OPD Desk</Button>
                </div>
              </div>
              <div className="bg-[#FAF8F5] rounded-[24px] p-6 shadow-clay-card flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold text-brand-teal mb-4">Doctor & Room</h2>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-amberLight flex items-center justify-center text-xl">🩺</div>
                    <div>
                      <p className="font-bold text-slate-800">Dr. {appt?.doctorName || "Meera"}</p>
                      <p className="text-xs text-slate-500">{appt?.doctorSpecialization || "Pediatric Specialist"}</p>
                      <p className="text-xs text-slate-500">MD (Pediatrics), 12+ Yrs Exp.</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 mb-4">
                    <p><MapPin className="inline w-3 h-3" /> Room 104, Block B 1st Floor</p>
                    <p><Clock className="inline w-3 h-3" /> Morning OPD (10:00 - 02:00)</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 mb-4">
                    SMS Notifications Active
                  </div>
                </div>
                <Button size="sm" className="w-full">Indoor Hospital Map (Room 104)</Button>
              </div>
            </div>
          </div>
        )}

        {tab === "visits" && (
          <Card>
            <CardHeader><CardTitle>My Visits</CardTitle><CardDescription>Appointment history</CardDescription></CardHeader>
            <CardContent>
              {appointments.length === 0 ? <EmptyState icon={CalendarDays} title="No appointments yet" description="Your appointments will appear here" /> : (
                <div className="divide-y divide-slate-100">
                  {appointments.map((a) => (
                    <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{fmtDate(a.appointmentDate)} {a.timeSlot ? `• ${a.timeSlot}` : ""}</p>
                        <p className="text-sm text-slate-600">{a.doctorName ? `Dr. ${a.doctorName}` : ""} {a.departmentName ? `• ${a.departmentName}` : ""}</p>
                      </div>
                      <Badge variant={STATUS_CFG[a.status]?.variant || "default"}>{STATUS_CFG[a.status]?.label || a.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "prescriptions" && (
          <Card>
            <CardHeader><CardTitle>Prescriptions</CardTitle><CardDescription>Your prescriptions</CardDescription></CardHeader>
            <CardContent>
              {prescriptions.length === 0 ? <EmptyState icon={FileText} title="No prescriptions" description="Prescriptions from your visits will appear here" /> : (
                <div className="divide-y divide-slate-100">
                  {prescriptions.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{p.diagnosis || "Prescription"}</p>
                        <p className="text-sm text-slate-500">{fmtDate(p.createdAt)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setViewRxApptId(p.appointmentId)}>View</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "bills" && (
          <Card>
            <CardHeader><CardTitle>Bills & Payments</CardTitle><CardDescription>Billing summary</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {bills.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold text-slate-900">₹{total.toLocaleString("en-IN")}</p></div>
                  <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Paid</p><p className="text-lg font-bold text-emerald-800">₹{paid.toLocaleString("en-IN")}</p></div>
                  <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-700">Due</p><p className="text-lg font-bold text-amber-800">₹{due.toLocaleString("en-IN")}</p></div>
                </div>
              )}
              {bills.length === 0 ? <EmptyState icon={Receipt} title="No bills" description="Your bills will appear here" /> : (
                <div className="divide-y divide-slate-100">
                  {bills.map((b) => {
                    const bd = Math.max(0, (b.totalAmount ?? 0) - (b.paidAmount ?? 0));
                    return (
                      <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">Bill #{b.billNo || b.id.slice(-6)}</p>
                          <p className="text-sm text-slate-500">{fmtDate(b.billDate || b.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm text-slate-600">₹{(b.paidAmount ?? 0).toLocaleString("en-IN")} / ₹{(b.totalAmount ?? 0).toLocaleString("en-IN")}</p>
                            {bd > 0 && <p className="text-xs text-amber-700">Due: ₹{bd.toLocaleString("en-IN")}</p>}
                          </div>
                          <Badge variant={bd === 0 ? "success" : "warning"}>{bd === 0 ? "Paid" : "Due"}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mt-8 border-t border-brand-cream bg-[#FFFFFF]/70 py-4 text-center text-xs text-slate-500">
        © 2025 Aarogya Multispeciality Hospital. All medical records HIPAA & ABDM compliant.
        <span className="mx-2">•</span> Need Assistance? <span className="mx-2">•</span> Privacy Policy <span className="mx-2">•</span> Rojgaar OS v2.4
      </footer>

      <aside aria-label="Quick Support Help" className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3.5">
        <div className="relative">
          <button className="w-12 h-12 rounded-full bg-brand-teal hover:bg-brand-tealDark text-white shadow-clay-hero flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </button>
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
        </div>
        <a href="https://wa.me/919336001167" target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-clay-hero flex items-center justify-center">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
      </aside>

      {viewRxApptId && <PrescriptionModal appointmentId={viewRxApptId} onClose={() => setViewRxApptId(null)} />}
    </div>
  );
}
