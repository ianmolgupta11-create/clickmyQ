"use client";

import { Suspense } from "react";
import DashboardContent from "@/components/patient/DashboardContent";

export default function PatientDashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
