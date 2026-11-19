import { Suspense } from "react";
import BookingPaymentResultPage from "../../../components/BookingPaymentResultPage";

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32, textAlign: "center" }}>Verifying your payment...</main>}>
      <BookingPaymentResultPage mode="success" />
    </Suspense>
  );
}
