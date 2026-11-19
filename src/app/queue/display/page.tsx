"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

/* ── Public "Now Serving" queue display board ──
   Waiting-room TV screen. No auth — hospital scoped via ?hid= or ?slug=.
   Shows currently consulted tokens + next up. Auto-refreshes every 10s. */

export default function QueueDisplayPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0B1120", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: "#64748b", fontSize: 15 }}>Loading queue…</div>}>
      <QueueDisplayContent />
    </Suspense>
  );
}

function QueueDisplayContent() {
  const searchParams = useSearchParams();
  const hid = searchParams.get("hid");
  const slug = searchParams.get("slug");
  const departmentId = searchParams.get("dept");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (hid) qs.set("hid", hid);
      if (slug) qs.set("slug", slug);
      if (departmentId) qs.set("departmentId", departmentId);
      const r = await fetch(`/api/public/queue?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (j.success) {
        setData(j.data);
        setError("");
        setLastRefresh(new Date());
      } else {
        setError(j.message || "Failed to load queue");
      }
    } catch {
      setError("Connection error — retrying…");
    }
  }, [hid, slug, departmentId]);

  useEffect(() => {
    if (!hid && !slug) {
      setError("Missing hospital link. Use /queue/display?slug=your-hospital");
      return;
    }
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [hid, slug, load]);

  // Wall clock tick every second
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B1120", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: "'Inter',sans-serif", color: "#94a3b8" }}>
        <div style={{ fontSize: 48 }}>🖥️</div>
        <div style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 700 }}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B1120", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: "#64748b", fontSize: 15 }}>
        Loading queue…
      </div>
    );
  }

  const nowServing = data.nowServing || [];
  const nextUp = data.nextUp || [];
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0B1120 0%,#111C33 60%,#0B1120 100%)", fontFamily: "'Inter',sans-serif", color: "#e2e8f0", padding: "28px 4%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {data.hospital?.logo && <img src={data.hospital.logo} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "contain", background: "#fff", padding: 4 }} />}
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>{data.hospital?.name}</div>
            <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700, letterSpacing: ".14em" }}>OPD QUEUE · NOW SERVING</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 700, color: "#7dd3fc" }}>{clock}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{lastRefresh && `updated ${lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, flex: 1, minHeight: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".18em", color: "#94a3b8", marginBottom: 14 }}>🔴 NOW SERVING</div>
          {nowServing.length === 0 ? (
            <div style={{ background: "rgba(30,41,59,.5)", border: "1px solid #1e293b", borderRadius: 20, padding: "40px 24px", textAlign: "center", color: "#475569", fontSize: 15 }}>No patient in consultation</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {nowServing.map((s: any) => (
                <div key={s.appointmentId} style={{ background: "linear-gradient(135deg,#0F766E,#115E59)", borderRadius: 20, padding: "22px 28px", display: "flex", alignItems: "center", gap: 22, boxShadow: "0 10px 40px rgba(15,118,110,.35)" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#fff" }}>{s.tokenNumber ? `#${s.tokenNumber}` : "—"}</div>
                  <div style={{ borderLeft: "1px solid rgba(255,255,255,.25)", paddingLeft: 22 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{s.patientName}</div>
                    <div style={{ fontSize: 13, color: "#99f6e4", marginTop: 3 }}>{s.doctorName || "Doctor"} {s.departmentName ? `· ${s.departmentName}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".18em", color: "#94a3b8", marginBottom: 14 }}>⏭ NEXT UP</div>
          {nextUp.length === 0 ? (
            <div style={{ background: "rgba(30,41,59,.5)", border: "1px solid #1e293b", borderRadius: 20, padding: "40px 24px", textAlign: "center", color: "#475569", fontSize: 15 }}>Queue is empty</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nextUp.map((n: any, i: number) => (
                <div key={n.appointmentId} style={{ background: i === 0 ? "rgba(249,115,22,.14)" : "rgba(30,41,59,.6)", border: i === 0 ? "1px solid rgba(249,115,22,.4)" : "1px solid #1e293b", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontFamily: "monospace", fontSize: i === 0 ? 34 : 26, fontWeight: 800, color: i === 0 ? "#fb923c" : "#7dd3fc", minWidth: 86 }}>{n.tokenNumber ? `#${n.tokenNumber}` : "—"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: i === 0 ? 16 : 14, fontWeight: 600, color: "#e2e8f0" }}>{n.patientName}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{n.doctorName || n.departmentName || ""}</div>
                  </div>
                  {i === 0 && <div style={{ fontSize: 10, fontWeight: 800, color: "#fb923c", letterSpacing: ".1em" }}>NEXT</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div style={{ display: "flex", gap: 30, marginTop: 26, paddingTop: 18, borderTop: "1px solid #1e293b" }}>
        <div><span style={{ fontSize: 26, fontWeight: 800, color: "#38bdf8" }}>{data.stats?.waiting ?? 0}</span> <span style={{ fontSize: 12, color: "#64748b" }}>patients waiting</span></div>
        <div><span style={{ fontSize: 26, fontWeight: 800, color: "#38bdf8" }}>{data.stats?.avgWaitMin ?? 0}m</span> <span style={{ fontSize: 12, color: "#64748b" }}>avg wait time</span></div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#334155" }}>Please wait for your token number to be called</div>
      </div>
    </div>
  );
}
