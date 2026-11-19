// Shared patient-portal navigation helpers
import { useRouter } from "next/navigation";

export const PATIENT_ROUTES = {
  login: "/patient/login",
  select: "/patient/select",
  dashboard: "/patient/dashboard",
} as const;

export function safePatientFallback(hasSession: boolean) {
  return hasSession ? PATIENT_ROUTES.dashboard : PATIENT_ROUTES.login;
}

export function usePatientNav() {
  const router = useRouter();
  return {
    goToLogin: (replace = true) => (replace ? router.replace(PATIENT_ROUTES.login) : router.push(PATIENT_ROUTES.login)),
    goToSelect: (replace = false) => (replace ? router.replace(PATIENT_ROUTES.select) : router.push(PATIENT_ROUTES.select)),
    goToDashboard: (replace = false) => (replace ? router.replace(PATIENT_ROUTES.dashboard) : router.push(PATIENT_ROUTES.dashboard)),
    goBackOrFallback: (fallback: string) => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.replace(fallback);
      }
    },
  };
}
