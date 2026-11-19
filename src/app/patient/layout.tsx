import { ReactNode } from "react";
import { PatientToastProvider } from "@/components/patient/PatientToast";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <PatientToastProvider>
      {children}
    </PatientToastProvider>
  );
}
