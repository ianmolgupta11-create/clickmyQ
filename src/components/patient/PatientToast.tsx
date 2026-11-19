"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-success-50 border-success-200 text-success-800",
  error: "bg-error-50 border-error-200 text-error-800",
  info: "bg-primary-50 border-primary-200 text-primary-800",
};

const TOAST_ICON_STYLES: Record<ToastType, string> = {
  success: "text-success-600",
  error: "text-error-600",
  info: "text-primary-600",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = TOAST_ICONS[toast.type];
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 w-full max-w-sm p-4 rounded-xl border shadow-lg animate-slide-up",
        TOAST_STYLES[toast.type]
      )}
    >
      <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", TOAST_ICON_STYLES[toast.type])} />
      <p className="flex-1 text-sm font-semibold leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function ToastContainer({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Expose addToast globally for simple usage
    (window as any).addPatientToast = (message: string, type?: ToastType, duration?: number) => {
      addToast(message, type, duration);
    };
  }, [addToast]);

    return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function usePatientToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("usePatientToast must be used within PatientToastProvider");
  }
  return context;
}

export const PatientToastProvider = ToastContainer;

export function addToast(message: string, type: ToastType = "info", duration?: number) {
  if (typeof window !== "undefined" && (window as any).addPatientToast) {
    (window as any).addPatientToast(message, type, duration);
  }
}

export default ToastContainer;
