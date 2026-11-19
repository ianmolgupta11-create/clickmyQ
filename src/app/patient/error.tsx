"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";

export default function PatientError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    try {
      reset();
    } catch {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col items-center justify-center animate-fade-in">
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-full bg-error-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error-600" />
        </div>
        <h2 className="text-xl font-bold text-secondary-900 mb-2">Something went wrong</h2>
        <p className="text-secondary-600 mb-6 max-w-sm mx-auto">
          {error.message || "Unable to load the patient portal."}
        </p>
        <Button
          onClick={handleRetry}
          disabled={retrying}
          variant="primary"
          className="w-full sm:w-auto"
        >
          {retrying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </>
          )}
        </Button>
        <Button
          onClick={() => router.push("/patient/login")}
          variant="outline"
          size="sm"
          className="mt-3 w-full sm:w-auto"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to login
        </Button>
      </div>
    </div>
  );
}
