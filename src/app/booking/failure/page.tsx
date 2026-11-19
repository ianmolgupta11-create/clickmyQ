import { Suspense } from "react";
import BookingPaymentResultPage from "../../../components/BookingPaymentResultPage";

export default function BookingFailurePage() {
  return (
    <Suspense fallback={<main style={{ padding: 32, textAlign: "center" }}>Checking payment status...</main>}>
      <BookingPaymentResultPage mode="failure" />
    </Suspense>
  );
}
