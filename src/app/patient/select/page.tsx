"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ArrowLeft, AlertCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PatientSelectPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"hospital" | "patient" | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/patient/auth/selection-info", { credentials: "include" });
      const d = await r.json();
      if (!d.success) { setMsg(d.message || "Session expired. Please sign in again."); router.replace("/patient/login"); return; }
      if (d.data.mode === "hospital") { setMode("hospital"); setHospitals(d.data.hospitals || []); }
      else { setMode("patient"); setPatients(d.data.patients || []); }
    } catch {
      setMsg("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectHospital = async (hospitalId: string) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/select-hospital", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ hospitalId }),
      });
      const d = await r.json();
      if (d.success) { await load(); }
      else setMsg(d.message || "Failed to select hospital");
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
  };

  const selectPatient = async (patientId: string) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/select-patient", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ patientId }),
      });
      const d = await r.json();
      if (d.success) {
        // Try to determine slug from patient profile and redirect to slug-specific dashboard if possible
        try {
          const pr = await fetch("/api/patient/me", { credentials: "include" });
          const pd = await pr.json();
          const slug = pd?.data?.hospital?.bookingSlug;
          if (slug) { router.push(`/patient/${slug}/dashboard`); return; }
        } catch {}
        router.push("/patient/dashboard");
      } else setMsg(d.message || "Failed to select patient");
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-creamLight flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-secondary-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-sm font-medium">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const title = mode === "hospital" ? "Choose your hospital" : "Choose your profile";
  const subtitle = mode === "hospital"
    ? "Select the hospital where your patient profile is registered."
    : "Select the patient profile you'd like to continue with.";

  return (
    <div className="min-h-screen bg-brand-creamLight px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 sm:mb-10">
          <button
            onClick={() => router.replace("/patient/login")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-500 hover:text-secondary-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg px-2 py-1 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-secondary-900">
            {title}
          </h1>
          <p className="mt-2 text-base text-secondary-600 max-w-xl leading-relaxed">
            {subtitle}
          </p>
        </div>

        {msg && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm font-medium text-error-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{msg}</span>
          </div>
        )}

        {mode === "hospital" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hospitals.length === 0 && (
              <div className="col-span-full rounded-2xl border border-secondary-200 bg-white p-10 text-center text-secondary-500">
                No eligible hospitals found.
              </div>
            )}
            {hospitals.map((h) => (
              <button
                key={h.id}
                type="button"
                disabled={busy}
                onClick={() => selectHospital(h.id)}
                className={cn(
                  "group relative flex items-start gap-4 rounded-2xl border border-secondary-200 bg-white p-5 text-left shadow-clay-card transition-all duration-200",
                  "hover:border-primary-300 hover:shadow-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-creamLight",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "active:scale-[0.99]"
                )}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-secondary-900 leading-snug break-words">
                    {h.name}
                  </div>
                  {typeof h.patientCount === "number" && (
                    <div className="mt-1.5 text-sm text-secondary-500">
                      {h.patientCount} eligible patient{h.patientCount === 1 ? "" : "s"}
                    </div>
                  )}
                </div>
                {busy && <Loader2 className="w-5 h-5 animate-spin text-primary-600" />}
              </button>
            ))}
          </div>
        )}

        {mode === "patient" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {patients.length === 0 && (
              <div className="col-span-full rounded-2xl border border-secondary-200 bg-white p-10 text-center text-secondary-500">
                No eligible patient profiles found.
              </div>
            )}
            {patients.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => selectPatient(p.id)}
                className={cn(
                  "group relative flex items-start gap-4 rounded-2xl border border-secondary-200 bg-white p-5 text-left shadow-clay-card transition-all duration-200",
                  "hover:border-primary-300 hover:shadow-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-creamLight",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "active:scale-[0.99]"
                )}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-secondary-900 leading-snug break-words">
                    {p.name}
                  </div>
                  <div className="mt-1.5 text-sm text-secondary-500">
                    {p.patientId && <span>Patient ID: {p.patientId}</span>}
                    {p.phone && <span>{p.patientId ? " · " : ""}{p.phone}</span>}
                  </div>
                  {(p.age || p.dateOfBirth) && (
                    <div className="mt-0.5 text-sm text-secondary-500">
                      {p.age ? `Age: ${p.age}` : p.dateOfBirth}
                    </div>
                  )}
                </div>
                {busy && <Loader2 className="w-5 h-5 animate-spin text-primary-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
