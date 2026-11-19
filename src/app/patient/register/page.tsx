"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, ArrowLeft, Loader2, ShieldCheck, RefreshCw, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hid = searchParams.get("hid") || "";
  const slug = searchParams.get("slug") || "";
  const prefillMobile = searchParams.get("mobile") || "";

  const [step, setStep] = useState<1 | 2>(1);
  const [hospital, setHospital] = useState<any>(null);
  const [mobile, setMobile] = useState(prefillMobile);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    const nm = name.trim();
    if (digits.length < 10) { setMsg("Enter a valid 10-digit mobile number"); return; }
    if (nm.length < 2) { setMsg("Enter your full name"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/patient/auth/register-request-otp", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ mobile: digits, name: nm, ...(hid ? { hospitalId: hid } : { slug }) }),
      });
      const d = await r.json();
      if (d.success) {
        if (d.data?.devOtp) setDevOtp(d.data.devOtp);
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
      const r = await fetch("/api/patient/auth/register-verify", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          mobile: mobile.replace(/\D/g, ""), otp: full, name: name.trim(),
          ...(age.trim() ? { age: Number(age.trim()) } : {}),
          ...(hid ? { hospitalId: hid } : { slug }),
        }),
      });
      const d = await r.json();
      if (d.success) router.push("/patient/dashboard");
      else setMsg(d.message || "Registration failed");
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
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
            <UserPlus className="w-6 h-6 text-cyan-300" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{hospital?.name || "Patient Portal"}</h1>
          <Badge variant="info" className="mt-2">REGISTER</Badge>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>{step === 1 ? "Create your account" : "Verify OTP"}</CardTitle>
            <CardDescription>
              {step === 1
                ? `Join ${hospital?.name || "this hospital"}'s patient portal. We'll verify your mobile with a one-time code.`
                : `Code sent to ••••• ${mobile.replace(/\D/g, "").slice(-4)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <>
                <div className="space-y-4">
                  <Input label="Full name" autoFocus autoComplete="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarti Sharma" />
                  <Input label="Age" type="number" inputMode="numeric" min={0} max={150} value={age} onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} placeholder="e.g. 32" />
                  <Input label="Mobile number" leftIcon={<Phone className="w-4 h-4" />} autoComplete="tel" type="tel" inputMode="numeric" maxLength={10} value={mobile.replace(/\D/g, "").slice(-10)} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(-10))} placeholder="9876543210" />
                </div>
                {msg && <div className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{msg}</div>}
                <Button className="w-full mt-5" onClick={requestOtp} isLoading={busy} leftIcon={<ShieldCheck className="w-4 h-4" />}>Send OTP</Button>
                <div className="mt-4 text-sm text-secondary-500 text-center">
                  Already have an account?{" "}
                  <a href={`/patient/login${hid ? `?hid=${hid}` : slug ? `?slug=${slug}` : ""}`} className="text-primary-600 font-bold hover:underline">Sign in</a>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <button onClick={() => { setStep(1); setOtp(["", "", "", "", "", ""]); setDevOtp(""); }} className="flex items-center gap-1.5 text-secondary-500 text-sm font-semibold mb-4 hover:text-secondary-700">
                  <ArrowLeft className="w-4 h-4" /> Edit details
                </button>
                {devOtp && (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
                    🔧 Dev mode (SMS not configured) — your OTP is <strong className="font-mono text-base">{devOtp}</strong>
                  </div>
                )}
                <div className="flex gap-2 justify-center mb-5">
                  {otp.map((d, i) => (
                    <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="tel" inputMode="numeric" maxLength={1} value={d}
                      onChange={(e) => setOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                      className={`w-12 h-14 text-center text-2xl font-extrabold font-mono rounded-xl border-2 outline-none transition ${d ? "border-primary-500 bg-primary-50 text-primary-900" : "border-secondary-200 bg-secondary-50 text-secondary-900"}`} />
                  ))}
                </div>
                <Button className="w-full" onClick={() => verifyOtp()} isLoading={busy} leftIcon={<ShieldCheck className="w-4 h-4" />}>Verify & Create Account</Button>
                <Button variant="ghost" className="w-full mt-3" onClick={requestOtp} disabled={resendIn > 0 || busy}>
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : (<><RefreshCw className="w-4 h-4" /> Resend OTP</>)}
                </Button>
              </>
            )}

            {msg && <div className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{msg}</div>}
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-slate-400 text-center leading-relaxed">
          🔒 Your data is private. Your records are only visible to you at this hospital.
        </p>
      </div>
    </div>
  );
}

export default function PatientRegisterPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><RegisterInner /></Suspense>;
}
