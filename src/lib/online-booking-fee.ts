export interface OnlineBookingAmounts {
  baseAmountPaise: number;
  convenienceFeePaise: number;
  totalAmountPaise: number;
}

export function calculateOnlineBookingAmounts(baseAmount: number): OnlineBookingAmounts {
  const baseAmountPaise = Number.isFinite(baseAmount) && baseAmount > 0
    ? Math.round(baseAmount * 100)
    : 0;
  const convenienceFeePaise = Math.round(baseAmountPaise * 0.02);

  return {
    baseAmountPaise,
    convenienceFeePaise,
    totalAmountPaise: baseAmountPaise + convenienceFeePaise,
  };
}

export function paiseToRupees(amountPaise: number): number {
  return amountPaise / 100;
}
