"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, RotateCw, UserRound, CalendarDays, Clock3, Hash, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { verifyCashfreeBooking } from "../lib/cashfree-booking-verification";

type ResultMode = "success" | "failure";
type ResultState = "verifying" | "pending" | "paid" | "failed" | "error";
type AppointmentDetails = {
  id: string;
  appointmentDate: string;
  timeSlot: string | null;
  tokenNumber: number | null;
  patient?: { email?: string | null };
  doctor?: { name?: string | null };
  department?: { name?: string | null };
};

function getResultUrl(mode: ResultMode, orderId: string, context: { hospitalId?: string; slug?: string }) {
  const query = new URLSearchParams({ order_id: orderId });
  if (context.hospitalId) query.set("hid", context.hospitalId);
  if (context.slug) query.set("slug", context.slug);
  query.set("payment", "return");
  return `/booking/${mode}?${query.toString()}`;
}

export default function BookingPaymentResultPage({ mode }: { mode: ResultMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id") || "";
  const hospitalId = searchParams.get("hid") || undefined;
  const slug = searchParams.get("slug") || undefined;
  const context = useMemo(() => ({ hospitalId, slug }), [hospitalId, slug]);
  const bookingUrl = useMemo(() => {
    if (slug) return `/book/${encodeURIComponent(slug)}`;
    if (hospitalId) return `/appointment?hid=${encodeURIComponent(hospitalId)}`;
    return "/appointment";
  }, [hospitalId, slug]);

  const [state, setState] = useState<ResultState>("verifying");
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [message, setMessage] = useState("");

  const requestVerification = useCallback(
    () => verifyCashfreeBooking(orderId, context),
    [context, orderId],
  );
  const applyVerification = useCallback((ok: boolean, data: Awaited<ReturnType<typeof requestVerification>>["data"]) => {
    const status = data.data?.status;
    const verifiedAppointment = data.data?.appointment;

    if (ok && data.success && status === "PAID" && verifiedAppointment) {
      setAppointment(verifiedAppointment);
      setState("paid");
      if (mode === "failure") router.replace(getResultUrl("success", orderId, context));
      return;
    }

    if (ok && data.success && status === "FAILED") {
      setState("failed");
      if (mode === "success") router.replace(getResultUrl("failure", orderId, context));
      return;
    }

    if (ok && data.success && (status === "PENDING" || status === "PROCESSING")) {
      setState("pending");
      setMessage("Cashfree has not confirmed the payment yet. You can check again shortly.");
      return;
    }

    setState("error");
    setMessage(data.message || "We could not verify the payment. Please try again or contact the hospital.");
  }, [context, mode, orderId, router]);

  useEffect(() => {
    if (!orderId || (!hospitalId && !slug)) return;
    let active = true;
    const checkPayment = async () => {
      try {
        const result = await requestVerification();
        if (active) applyVerification(result.ok, result.data);
      } catch {
        if (active) {
          setState("error");
          setMessage("We could not reach the payment verification service. Please try again.");
        }
      }
    };
    void checkPayment();
    return () => {
      active = false;
    };
  }, [applyVerification, hospitalId, orderId, requestVerification, slug]);

  const retryVerification = async () => {
    setState("verifying");
    setMessage("");
    try {
      const result = await requestVerification();
      applyVerification(result.ok, result.data);
    } catch {
      setState("error");
      setMessage("We could not reach the payment verification service. Please try again.");
    }
  };

  const missingReference = !orderId || (!hospitalId && !slug);
  const viewState: ResultState = missingReference ? "error" : state;
  const isPaid = viewState === "paid";
  const isFailed = viewState === "failed";
  const isBusy = viewState === "verifying";
  const title = isPaid
    ? "Appointment confirmed"
    : isFailed
      ? "Payment not completed"
      : isBusy
        ? "Verifying your payment"
        : viewState === "pending"
          ? "Payment is processing"
          : "Payment status unavailable";
  const visibleMessage = missingReference
    ? "The payment reference is incomplete. Please return to the booking page or contact the hospital."
    : message;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-secondary-900 border border-white/10 flex items-center justify-center mx-auto mb-3">
            {isPaid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-300" aria-hidden="true" />
            ) : isFailed ? (
              <AlertCircle className="w-6 h-6 text-red-300" aria-hidden="true" />
            ) : isBusy ? (
              <Loader2 className="w-6 h-6 text-cyan-300 animate-spin" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-300" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{title}</h1>
        </div>

        <Card variant="elevated" aria-live="polite">
          <CardHeader>
            <CardTitle>{isPaid ? "Appointment details" : title}</CardTitle>
            <CardDescription>
              {isPaid
                ? "Your online payment has been verified and your appointment is confirmed."
                : isFailed
                  ? "Cashfree reports that this payment attempt did not complete. No online appointment has been confirmed."
                  : visibleMessage || "Please keep this page open while we check the payment status."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPaid && appointment && (
              <div className="space-y-3 text-sm text-secondary-700">
                {appointment.doctor?.name && (
                  <p className="flex items-center gap-2"><UserRound className="w-4 h-4 text-primary-600" /><span><strong>Doctor:</strong> {appointment.doctor.name}</span></p>
                )}
                {appointment.department?.name && <p><strong>Department:</strong> {appointment.department.name}</p>}
                <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary-600" /><span><strong>Date:</strong> {new Date(appointment.appointmentDate).toLocaleDateString()}</span></p>
                {appointment.timeSlot && <p className="flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary-600" /><span><strong>Time:</strong> {appointment.timeSlot}</span></p>}
                {appointment.tokenNumber != null && <p className="flex items-center gap-2"><Hash className="w-4 h-4 text-primary-600" /><span><strong>Token:</strong> {appointment.tokenNumber}</span></p>}
                <p><strong>Appointment ID:</strong> {appointment.id}</p>
                {appointment.patient?.email && (
                  <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-primary-900">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Confirmation details</p>
                    <p className="mt-1 break-all font-semibold">{appointment.patient.email}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
              {!isPaid && (
                <Link
                  href={bookingUrl}
                  className="inline-flex w-full items-center justify-center rounded-xl border-2 border-primary-500 px-6 py-3 font-semibold text-primary-700 transition hover:border-primary-600 hover:bg-primary-50 sm:w-auto"
                >
                  Return to booking
                </Link>
              )}
              {!missingReference && (viewState === "pending" || viewState === "error" || isFailed) && (
                <Button
                  type="button"
                  variant={isPaid ? "outline" : "secondary"}
                  onClick={() => void retryVerification()}
                  leftIcon={<RotateCw className="w-4 h-4" />}
                >
                  {isFailed ? "Check status again" : "Retry verification"}
                </Button>
              )}
              {isPaid && (
                <Link
                  href="/patient"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:from-primary-600 hover:to-primary-800 hover:shadow-primary sm:w-auto"
                >
                  Go to Patient Portal
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
