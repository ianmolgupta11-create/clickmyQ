"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, ArrowLeft, Loader2, ShieldCheck, RefreshCw, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hid = searchParams.get("hid") || "";
  const slug = searchParams.get("slug") || "";
  const prefillMobile = searchParams.get("mobile") || "";

  const [step, setStep] = useState<1 | 2>(1);
  const [hospital, setHospital] = useState<any>(null);
  const [mobile, setMobile] = useState(prefillMobile);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [selectionToken, setSelectionToken] = useState("");
  const [candidates, setCandidates] = useState<Array<{ id: string; patientId: string; name: string; age?: number; dateOfBirth?: string }>>([]);
  const [selecting, setSelecting] = useState(false);
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string; slug?: string; patientCount: number }>>([]);
  const [hospitalSelectionToken, setHospitalSelectionToken] = useState("");

  useEffect(() => {
    const param = hid ? `hid=${hid}` : slug ? `slug=${slug}` : "";
    fetch(`/api/public/booking?${param}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setHospital(d.data.hospital); })
      .catch(() => {});
  }, [hid, slug]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestOtp = async () => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 10) { setMsg("Enter a valid 10-digit mobile number"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/request-otp", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ mobile: digits, ...(hid ? { hospitalId: hid } : { slug }) }),
      });
      const d = await r.json();
      if (d.success) {
        setStep(2); setResendIn(30);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else setMsg(d.message || "Failed to send OTP");
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
  };

  const verifyOtp = async (code?: string) => {
    const full = code || otp.join("");
    if (full.length !== 6) { setMsg("Enter the 6-digit OTP"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ mobile: mobile.replace(/\D/g, ""), otp: full, ...(hid ? { hospitalId: hid } : { slug }) }),
      });
      const d = await r.json();
      if (d.success) {
        if (d.data?.requiresHospitalSelection || d.data?.requiresSelection) {
          router.push("/patient/select");
          return;
        }
        if (d.data?.selectionToken && Array.isArray(d.data?.patients) && d.data.patients.length > 0) {
          router.push("/patient/select");
          return;
        }
        // Prefer slug-specific dashboard if slug in context
        if (slug) { router.push(`/patient/${slug}/dashboard`); return; }
        router.push("/patient/dashboard");
        return;
      } else setMsg(d.message || "Invalid OTP");
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
  };

  const selectPatient = async (patientId: string) => {
    if (!selectionToken || !patientId) return;
    setSelecting(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/select-patient", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ selectionToken, patientId }),
      });
      const d = await r.json();
      if (d.success) {
        setCandidates([]);
        setSelectionToken("");
        router.push("/patient/dashboard");
        return;
      } else {
        setMsg(d.message || "Failed to select patient");
      }
    } catch {
      setMsg("Connection error. Please try again.");
    }
    setSelecting(false);
  };

  const selectHospital = async (hospitalId: string) => {
    if (!hospitalSelectionToken) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/select-hospital", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ selectionToken: hospitalSelectionToken, hospitalId }),
      });
      const d = await r.json();
      if (d.success) {
        setHospitals([]);
        setHospitalSelectionToken("");
        setSelectionToken(d.data.patientSelectToken);
        setCandidates(d.data.patients);
      } else setMsg(d.message || "Failed");
    } catch { setMsg("Connection error."); }
    setBusy(false);
  };

  const resetSelection = () => {
    setCandidates([]);
    setSelectionToken("");
    setHospitals([]);
    setHospitalSelectionToken("");
    setMsg("");
  };

  const setOtpDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    if (next.every((c) => c)) verifyOtp(next.join(""));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-secondary-900 border border-white/10 flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6 text-cyan-300" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{hospital?.name || "Patient Portal"}</h1>
          <Badge variant="info" className="mt-2">LOGIN</Badge>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>{step === 1 ? "Sign in with your mobile" : "Verify OTP"}</CardTitle>
            <CardDescription>
              {step === 1
                ? "Enter the mobile number you registered with. We'll send you a one-time code."
                : `Code sent to ••••• ${mobile.replace(/\D/g, "").slice(-4)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hospitals.length > 0 && (
              <>
                <button onClick={resetSelection} className="flex items-center gap-1.5 text-secondary-500 text-sm font-semibold mb-4 hover:text-secondary-700">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="space-y-3 mb-4">
                  {hospitals.map((h) => (
                    <button key={h.id} onClick={() => selectHospital(h.id)} disabled={busy}
                      className="w-full text-left p-4 rounded-xl border border-white/10 bg-secondary-900/40 hover:bg-secondary-900/70 transition disabled:opacity-60">
                      <div className="text-white font-bold">{h.name}</div>
                      <div className="text-sm text-secondary-400 mt-1">{h.patientCount} patient(s)</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {candidates.length > 0 && (
              <>
                <button onClick={resetSelection} className="flex items-center gap-1.5 text-secondary-500 text-sm font-semibold mb-4 hover:text-secondary-700">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="space-y-3 mb-4">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectPatient(c.id)}
                      disabled={selecting || busy}
                      className="w-full text-left p-4 rounded-xl border border-white/10 bg-secondary-900/40 hover:bg-secondary-900/70 transition disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-bold">{c.name}</div>
                          <div className="text-sm text-secondary-400 mt-1">Patient ID: {c.patientId}</div>
                          {(c.age || c.dateOfBirth) && (
                            <div className="text-sm text-secondary-400 mt-0.5">{c.age ? `Age: ${c.age}` : c.dateOfBirth}</div>
                          )}
                        </div>
                        {selecting && <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />}
                      </div>
                    </button>
                  ))}
                </div>
                {msg && <div className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{msg}</div>}
              </>
            )}

            {candidates.length === 0 && step === 1 && (
              <>
                <div className="space-y-4">
                  <Input
                    label="Mobile number"
                    leftIcon={<Phone className="w-4 h-4" />}
                    autoComplete="tel"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobile.replace(/\D/g, "").slice(-10)}
                    onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(-10)); setMsg(""); }}
                    onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                    placeholder="9876543210"
                    autoFocus
                  />
                </div>
                {msg && <div className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{msg}</div>}
                <Button className="w-full mt-5" onClick={requestOtp} isLoading={busy} leftIcon={<ShieldCheck className="w-4 h-4" />}>Send OTP</Button>
                <div className="mt-4 text-sm text-secondary-500 text-center">
                  New patient?{" "}
                  <a href={`/patient/register${hid ? `?hid=${hid}` : slug ? `?slug=${slug}` : ""}`} className="text-primary-600 font-bold hover:underline">Create account</a>
                </div>
              </>
            )}

            {candidates.length === 0 && step === 2 && (
              <>
                <button onClick={() => { setStep(1); setOtp(["", "", "", "", "", ""]); }} className="flex items-center gap-1.5 text-secondary-500 text-sm font-semibold mb-4 hover:text-secondary-700">
                  <ArrowLeft className="w-4 h-4" /> Change number
                </button>
                <div className="flex gap-2 justify-center mb-5">
                  {otp.map((d, i) => (
                    <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="tel" inputMode="numeric" maxLength={1} value={d}
                      onChange={(e) => setOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                      className={`w-12 h-14 text-center text-2xl font-extrabold font-mono rounded-xl border-2 outline-none transition ${d ? "border-primary-500 bg-primary-50 text-primary-900" : "border-secondary-200 bg-secondary-50 text-secondary-900"}`} />
                  ))}
                </div>
                <Button className="w-full" onClick={() => verifyOtp()} isLoading={busy} leftIcon={<ShieldCheck className="w-4 h-4" />}>Verify & Sign In</Button>
                <Button variant="ghost" className="w-full mt-3" onClick={requestOtp} disabled={resendIn > 0 || busy}>
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : (<><RefreshCw className="w-4 h-4" /> Resend OTP</>)}
                </Button>
              </>
            )}

            {candidates.length === 0 && msg && <div className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{msg}</div>}
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
          🔒 Your data is private. Signing in shows only your own records at this hospital.
        </p>
      </div>
    </div>
  );
}

export default function PatientLoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><LoginInner /></Suspense>;
}
