/**
 * Single source of truth for subscription plan limits & feature access.
 *
 * - STARTER:        small clinics — max 3 doctors, no IPD/pharmacy/AI
 * - PROFESSIONAL:   growing hospitals — max 25 doctors, all clinical features
 * - ENTERPRISE:     unlimited doctors, all features
 * - TRIAL:          full feature access for the 14-day trial period
 */

export type PlanKey = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export type PlanFeatureKey = "ipd" | "pharmacy" | "aiRx";

export interface PlanConfig {
  maxDoctors: number | null; // null = unlimited
  features: Record<PlanFeatureKey, boolean>;
}

export const PLAN_LIMITS: Record<PlanKey, PlanConfig> = {
  STARTER: {
    maxDoctors: 3,
    features: { ipd: false, pharmacy: false, aiRx: false },
  },
  PROFESSIONAL: {
    maxDoctors: 25,
    features: { ipd: true, pharmacy: true, aiRx: true },
  },
  ENTERPRISE: {
    maxDoctors: null,
    features: { ipd: true, pharmacy: true, aiRx: true },
  },
};

/** Trial hospitals get OPD/IPD/pharmacy access during the 14-day trial; AI prescription is disabled. */
const TRIAL_CONFIG: PlanConfig = {
  maxDoctors: null,
  features: { ipd: true, pharmacy: true, aiRx: false },
};

/** Maps landing-page plan slugs (signup ?plan=) to DB enum values. */
export const PLAN_SLUG_MAP: Record<string, PlanKey> = {
  starter: "STARTER",
  pro: "PROFESSIONAL",
  enterprise: "ENTERPRISE",
};

/**
 * Dev mode — every paid feature unlocked so the whole platform (IPD, pharmacy,
 * AI prescription, unlimited doctors) can be exercised locally.
 * Hard-disabled in production. Set DEV_UNLOCK_PLANS="false" to keep the real
 * plan limits even while developing.
 */
export const isPlansUnlockedInDev = (): boolean => {
  if (process.env.NODE_ENV === "production") return false;
  if ((process.env.DEV_UNLOCK_PLANS || "").trim().toLowerCase() === "true") return true;
  if ((process.env.DEV_UNLOCK_PLANS || "").trim().toLowerCase() === "false") return false;
  // Default to true in dev if not explicitly false (preserves existing behavior)
  return true;
};

/** All features on + unlimited doctors — the config used when the dev unlock is active. */
const UNLOCKED_CONFIG: PlanConfig = {
  maxDoctors: null,
  features: { ipd: true, pharmacy: true, aiRx: true },
};

export const getPlanConfig = (
  status: string,
  plan: string | null | undefined
): PlanConfig => {
  if (isPlansUnlockedInDev()) return UNLOCKED_CONFIG;
  if (status === "TRIAL") return TRIAL_CONFIG;
  const key = (plan || "STARTER") as PlanKey;
  return PLAN_LIMITS[key] || PLAN_LIMITS.STARTER;
};

export const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  ipd: "IPD & Ward Management",
  pharmacy: "Pharmacy & Inventory",
  aiRx: "AI Smart Prescription",
};
