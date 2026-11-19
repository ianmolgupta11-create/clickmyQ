"use client";

import { Loader2 } from "lucide-react";

export default function PatientLoading() {
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
