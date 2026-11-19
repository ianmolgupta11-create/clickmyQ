"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Hospital, LogOut, Home, CalendarDays, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui";
import type { Patient } from "@/types/patient";

type TabId = "home" | "visits" | "prescriptions" | "bills";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "visits", label: "Visits", icon: CalendarDays },
  { id: "prescriptions", label: "Prescriptions", icon: FileText },
  { id: "bills", label: "Bills", icon: Receipt },
];

interface PatientNavbarProps {
  children: React.ReactNode;
}

export default function PatientNavbar({ children }: PatientNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/patient/me", { credentials: "include" });
        if (res.status === 401) {
          if (!cancelled) { setPatient(null); setLoading(false); }
          return;
        }
        const data = await res.json();
        if (!cancelled) setPatient(data.success ? (data.data as Patient | null) : null);
      } catch {
        if (!cancelled) setPatient(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/patient/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.push("/patient/login");
    }
  }, [router]);

  const segments = pathname.split("/").filter(Boolean);
  const isSlugDashboard =
    segments.length === 3 && segments[0] === "patient" && segments[2] === "dashboard";
  const base = isSlugDashboard ? `/patient/${segments[1]}/dashboard` : "/patient/dashboard";
  const activeTab = (searchParams.get("tab") ?? "home") as TabId;

  const firstName = patient?.name?.split(" ")[0] || "";
  const hospitalName = patient?.hospital?.name || "Patient Portal";
  const hospitalLogo = patient?.hospital?.logo ?? null;
  const showTabs = patient != null;

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-50 animate-fade-in">
        <header className="sticky top-0 z-40 border-b border-secondary-200 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-200" />
            <div className="flex flex-col leading-tight">
              <div className="w-24 h-4 rounded bg-secondary-200" />
              <div className="w-16 h-3 rounded bg-secondary-200 mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary-200" />
            <div className="w-20 h-3 rounded bg-secondary-200" />
          </div>
        </header>
        <main className="p-4 space-y-4">
          <div className="h-32 rounded-2xl bg-secondary-200" />
          <div className="grid gap-4">
            <div className="h-4 w-3/4 rounded bg-secondary-200" />
            <div className="h-4 w-1/2 rounded bg-secondary-200" />
            <div className="h-4 w-3/4 rounded bg-secondary-200" />
          </div>
          <div className="h-24 rounded-2xl bg-secondary-200" />
        </main>
        <footer className="border-t border-secondary-200 bg-white flex items-center justify-center px-4 pb-4">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-10 h-5 rounded-full bg-secondary-200" />
            ))}
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <header className="sticky top-0 z-40 border-b border-secondary-200 bg-white/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hospitalLogo ? (
            <img src={hospitalLogo} alt={hospitalName} className="w-10 h-10 rounded-xl object-contain bg-white p-1" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Hospital className="w-5 h-5 text-primary-600" />
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-secondary-900">{hospitalName}</span>
            {patient && <span className="text-xs text-secondary-500">Patient Portal</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {patient ? (
            <>
              <span className="hidden sm:block text-sm text-secondary-600">
                Hi, {firstName}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="text-secondary-600 border-secondary-300 hover:bg-secondary-50 hover:text-secondary-900"
              >
                <LogOut className="w-4 h-4 mr-1.5" /> Sign out
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <main className="pt-1">{children}</main>

      {showTabs && (
        <footer className="border-t border-secondary-200 bg-white/90 backdrop-blur fixed bottom-0 left-0 right-0 z-40">
          <div className="flex justify-center px-3 py-2 sm:px-6 pb-8">
            <div className="flex gap-1">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => router.push(`${base}?tab=${tab.id}`)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-primary-50 text-primary-600 shadow-sm"
                        : "text-secondary-400 hover:bg-secondary-50 hover:text-secondary-600"
                    }`}
                  >
                    <tab.icon className={`w-5 h-5 ${isActive ? "text-primary-600" : "text-secondary-400"}`} />
                    <span className={`text-[10px] font-semibold leading-none ${isActive ? "text-primary-600" : "text-secondary-400"}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
