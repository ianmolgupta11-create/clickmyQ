"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import DashboardContent from "@/components/patient/DashboardContent";

export default function PatientDashboardPage() {
  const { slug } = useParams();
  return (
    <Suspense fallback={null}>
      <DashboardContent slug={typeof slug === "string" ? slug : undefined} />
    </Suspense>
  );
}
