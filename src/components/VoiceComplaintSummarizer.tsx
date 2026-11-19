"use client";
import { useState, useRef } from "react";

export default function VoiceComplaintSummarizer({ patientName, doctorName, onSummary, disabled }: { patientName?: string; doctorName?: string; onSummary: (cc: string, translation: string) => void; disabled?: boolean; }) {
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const recogRef = useRef<any>(null);
  const finalRef = useRef("");

  const stop = () => {
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    setListening(false);
    const transcript = finalRef.current.trim();
    if (!transcript) return;
    setSummarizing(true);
    fetch("/api/prescriptions/complaint-summary", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcriptText: transcript, language: "Hindi", patientName, doctorName })
    }).then(r => r.json()).then(r => {
      if (r.success) onSummary(r.data.chiefComplaint || "", r.data.translation || "");
    }).finally(() => setSummarizing(false));
  };

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported"); return; }
    finalRef.current = "";
    const rec = new SR();
    rec.lang = "hi-IN";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setLive((finalRef.current + interim).trim());
    };
    rec.onend = () => { if (recogRef.current) try { rec.start(); } catch {} };
    recogRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button onClick={listening ? stop : start} disabled={disabled || summarizing}
      style={{ border: "none", background: listening ? "#fecaca" : "#f1f5f9", color: listening ? "#ef4444" : "#64748b", padding: "4px 10px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600 }}>
      {summarizing ? "..." : (listening ? "Stop & Summarize" : "Voice Summary")}
    </button>
  );
}
