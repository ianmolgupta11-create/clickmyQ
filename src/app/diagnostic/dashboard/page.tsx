"use client";

import DeptDashboardPage from "@/components/DeptDashboardPage";
import { Microscope } from "lucide-react";

const cfg = {
  accent:       "#14B8A6",
  accent2:      "#115E59",
  accentLight:  "#F0FDFA",
  accentBorder: "#99F6E4",
  label:        "Diagnostic",
  basePath:     "/diagnostic/dashboard",
  icon:         <Microscope size={26} color="#fff" />,
};

export default function DiagnosticDashboardPage() {
  return <DeptDashboardPage cfg={cfg} />;
}
