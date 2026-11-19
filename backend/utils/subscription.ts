import prisma from "../config/db";
import { isPlansUnlockedInDev } from "../config/plans";

// In-memory cache: hospitalId -> { state, checkedAt }
// 60s TTL avoids a DB hit on every single API request.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { state: SubscriptionCheckState; checkedAt: number }>();

export type SubscriptionCheckState =
  | { ok: true; status: string; plan: string | null }
  | { ok: false; code: string; message: string };

export const getSubscriptionState = async (
  hospitalId: string
): Promise<SubscriptionCheckState> => {
  const cached = cache.get(hospitalId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.state;
  }

  let state: SubscriptionCheckState;
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        trialEndDate: true,
        subscriptionEndDate: true,
      },
    });

    if (!hospital) {
      // Unknown hospital — don't hard-block here; login/role checks handle it.
      state = { ok: true, status: "TRIAL", plan: null };
    } else {
      const now = new Date();
      const status = hospital.subscriptionStatus as string;
      const trialEnd = hospital.trialEndDate ? new Date(hospital.trialEndDate) : null;
      const subEnd = hospital.subscriptionEndDate ? new Date(hospital.subscriptionEndDate) : null;
      const plan = hospital.subscriptionPlan as string | null;

      if (isPlansUnlockedInDev()) {
        // Dev mode: never block on subscription state, never mutate the DB.
        state = { ok: true, status, plan };
      } else if (status === "SUSPENDED") {
        state = {
          ok: false,
          code: "ACCOUNT_SUSPENDED",
          message:
            "Your hospital account has been suspended. Please contact clickmyQ+ support for assistance. Email: support@clickmyq.com | Phone: +91 93360 01167",
        };
      } else if (status === "CANCELLED") {
        state = {
          ok: false,
          code: "ACCOUNT_CANCELLED",
          message:
            "Your hospital subscription has been cancelled. Please contact clickmyQ+ support to reactivate. Email: support@clickmyq.com | Phone: +91 93360 01167",
        };
      } else if (status === "EXPIRED") {
        state = {
          ok: false,
          code: "SUBSCRIPTION_EXPIRED",
          message:
            "Your subscription has expired. Please contact clickmyQ+ support to renew your plan. Email: support@clickmyq.com | Phone: +91 93360 01167",
        };
      } else if (status === "TRIAL" && trialEnd && now > trialEnd) {
        // Lazy transition: mark trial as expired once (no cron needed).
        await prisma.hospital.update({
          where: { id: hospitalId },
          data: { subscriptionStatus: "EXPIRED" },
        });
        cache.delete(hospitalId);
        state = {
          ok: false,
          code: "TRIAL_EXPIRED",
          message:
            "Your 14-day free trial has ended. Please contact clickmyQ+ support to subscribe and continue using the platform. Email: support@clickmyq.com | Phone: +91 93360 01167",
        };
      } else if (status === "ACTIVE" && subEnd && now > subEnd) {
        // Lazy transition: mark subscription as expired once.
        await prisma.hospital.update({
          where: { id: hospitalId },
          data: { subscriptionStatus: "EXPIRED" },
        });
        cache.delete(hospitalId);
        state = {
          ok: false,
          code: "SUBSCRIPTION_EXPIRED",
          message:
            "Your subscription has expired. Please contact clickmyQ+ support to renew your plan. Email: support@clickmyq.com | Phone: +91 93360 01167",
        };
      } else {
        state = { ok: true, status, plan };
      }
    }
  } catch {
    // On DB errors, don't block requests (fail-open) — auth still enforced.
    state = { ok: true, status: "TRIAL", plan: null };
  }

  cache.set(hospitalId, { state, checkedAt: Date.now() });
  return state;
};

/** Clear the cache (call after subscription updates so changes apply immediately). */
export const clearSubscriptionCache = (hospitalId?: string) => {
  if (hospitalId) cache.delete(hospitalId);
  else cache.clear();
};
