"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { Phone, ArrowLeft, Loader2, ShieldCheck, RefreshCw, UserPlus } from "lucide-react";

/* ── Patient Portal — slug-scoped (e.g. /patient/rajshree-1) ──
   Unified entry point: login (existing patient) or register (new patient).
   Hospital is resolved from the URL slug → HospitalSettings.bookingSlug.
   Auth APIs already accept `slug` and resolve hospitalId server-side. */

function PortalInner() {
  const router = useRouter();
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<1 | 2>(1);
  const [hospital, setHospital] = useState<any>(null);
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [redirecting, setRedirecting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ── Resolve hospital from slug ── */
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/booking?slug=${encodeURIComponent(slug)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setHospital(d.data.hospital);
        else setHospital(null);
      })
      .catch(() => setHospital(null));
  }, [slug]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const clearOtp = () => setOtp(["", "", "", "", "", ""]);
  /* ── Request OTP (shared for login & register) ── */
  const requestOtp = async () => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 10) { setMsg("Enter a valid 10-digit mobile number"); return; }
    if (mode === "register" && name.trim().length < 2) { setMsg("Enter your full name"); return; }

    setBusy(true); setMsg("");
    try {
      const endpoint = mode === "register"
        ? "/api/patient/auth/register-request-otp"
        : "/api/patient/auth/request-otp";
      const body: any = { mobile: digits, slug };
      if (mode === "register") body.name = name.trim();

      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setStep(2); setResendIn(30);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        if (d.status === 409 && mode === "register") {
          setMsg(d.message || "Already registered — switch to Sign In?");
        } else {
          setMsg(d.message || "Failed to send OTP");
        }
      }
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
  };

  /* ── Verify OTP ── */
  const verifyOtp = async () => {
    const full = otp.join("");
    if (full.length !== 6) { setMsg("Enter the 6-digit OTP"); return; }
    setBusy(true); setMsg("");

    try {
      const endpoint = mode === "register"
        ? "/api/patient/auth/register-verify"
        : "/api/patient/auth/verify-otp";
      const body: any = { mobile: mobile.replace(/\D/g, ""), otp: full, slug };
      if (mode === "register") body.name = name.trim();
      if (mode === "register" && age.trim()) body.age = Number(age.trim());

    const r = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success) {
      // Handle selection flows (multi-patient or multi-hospital)
      if (
        d.data?.requiresHospitalSelection
        || d.data?.requiresSelection
        || (d.data?.selectionToken && Array.isArray(d.data?.patients) && d.data.patients.length > 0)
      ) {
        setRedirecting(true);
        router.push("/patient/select");
        return;
      }
      setRedirecting(true);
      router.push(`/patient/${slug}/dashboard`);
    } else {
        setMsg(d.message || "Invalid OTP");
      }
    } catch { setMsg("Connection error. Please try again."); }
    setBusy(false);
  };

  const setOtpDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    if (next.every((c) => c)) verifyOtp();
  };

  const hospitalName = hospital?.name || "Hospital";
  const isLogin = mode === "login";

  return (
    <div style={{ minHeight: "100vh", background: "#0B1120", fontFamily: "'Inter',sans-serif", color: "#0f172a" }}>
      <div style={{ padding: "24px 20px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <UserPlus size={20} style={{ color: "#22d3ee" }} />
          <span style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Patient Portal</span>
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>
          {hospitalName}{slug ? <> • <span style={{ color: "#22d3ee", fontWeight: 700 }}>{slug}</span></> : ""}
        </div>
      </div>
      <div style={{ padding: "16px 20px", display: "flex", gap: 2, background: "#132A4A", borderRadius: 12, margin: "0 20px 20px 20px" }}>
        <button
          onClick={() => { setMode("login"); setStep(1); clearOtp(); setMsg(""); }}
          style={{ flex: 1, border: "none", background: isLogin ? "#22d3ee" : "transparent", color: isLogin ? "#0B1120" : "#94a3b8", padding: "10px 0", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          Sign In
        </button>
        <button
          onClick={() => { setMode("register"); setStep(1); clearOtp(); setMsg(""); }}
          style={{ flex: 1, border: "none", background: !isLogin ? "#22d3ee" : "transparent", color: !isLogin ? "#0B1120" : "#94a3b8", padding: "10px 0", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          Create Account
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px" }}>
        {step === 1 && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>
              {isLogin ? "Welcome back" : "Create your account"}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 18 }}>
              {isLogin
                ? "Enter your registered mobile number to receive an OTP"
                : "Enter your mobile number and full name to register"}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: "20px 18px", border: "1px solid #e2e8f0", marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                Mobile Number
              </label>
              <input
                type="tel" inputMode="numeric" maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9876543210"
                autoFocus
                style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", outline: "none" }}
              />
              {!isLogin && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.trim())}
                    placeholder="John Doe"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", outline: "none" }}
                  />
                </div>
              )}
              {!isLogin && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                    Age
                  </label>
                  <input
                    type="number" inputMode="numeric" min={0} max={150}
                    value={age}
                    onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                    placeholder="32"
                    style={{ width: "100%", padding: "12px 14px", fontSize: 16, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", outline: "none" }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={requestOtp}
              disabled={busy}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: busy ? "#a5f3fc" : "linear-gradient(135deg,#0891b2,#0e7490)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
              {isLogin ? "Send OTP" : "Send OTP & Register"}
            </button>
            {msg && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 12px" }}>{msg}</div>}
          </>
        )}
        {step === 2 && (
          <>
            <button
              onClick={() => { setStep(1); clearOtp(); setMsg(""); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 10 }}
            >
              <ArrowLeft size={13} /> Change number
            </button>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>Verify OTP</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
              Code sent to ••••• {mobile.replace(/\D/g, "").slice(-4)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="tel" inputMode="numeric" maxLength={1} value={d}
                  onChange={(e) => setOtpDigit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }}
                  style={{
                    width: 44, height: 52, textAlign: "center", fontSize: 20, fontWeight: 800,
                    fontFamily: "monospace", color: "#0f172a",
                    border: d ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                    borderRadius: 10, background: d ? "#ECFEFF" : "#f8fafc", outline: "none",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => verifyOtp()}
              disabled={busy}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: busy ? "#a5f3fc" : "linear-gradient(135deg,#0891b2,#0e7490)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
              {isLogin ? "Verify & Sign In" : "Verify & Create Account"}
            </button>
            <button
              onClick={requestOtp}
              disabled={resendIn > 0 || busy}
              style={{ width: "100%", marginTop: 10, padding: 8, background: "none", border: "none", color: resendIn > 0 ? "#94a3b8" : "#0891b2", fontSize: 12, fontWeight: 700, cursor: resendIn > 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {resendIn > 0 ? `Resend OTP in ${resendIn}s` : <><RefreshCw size={12} /> Resend OTP</>}
            </button>
            {msg && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 12px" }}>{msg}</div>}
          </>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 10.5, color: "#475569", textAlign: "center", maxWidth: 320, lineHeight: 1.5, padding: "0 20px" }}>
        🔒 Your data is private. Signing in shows only your own records at this hospital.
      </div>
    </div>
  );
}

export default function PatientPortalPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0B1120" }} />}>
      <PortalInner />
    </Suspense>
  );
}
