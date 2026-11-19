import { NextRequest } from "next/server";
import { authMiddleware } from "./auth.middleware";
import { errorResponse } from "../utils/response";
import { getSubscriptionState } from "../utils/subscription";
import { getPlanConfig, FEATURE_LABELS, PlanFeatureKey } from "../config/plans";
import { JwtPayload } from "../utils/jwt";

/**
 * Combined auth + subscription feature guard.
 * Returns the authenticated user, hospitalId and the plan config, or an error.
 * Usage: const auth = await requireFeature(req, "ipd");
 */
export const requireFeature = async (
  req: NextRequest,
  feature: PlanFeatureKey
): Promise<
  | { user: JwtPayload; hospitalId: string; planConfig: ReturnType<typeof getPlanConfig>; error: null }
  | { user: null; hospitalId: null; planConfig: null; error: Response }
> => {
  const { user, error } = await authMiddleware(req);
  if (error) return { user: null, hospitalId: null, planConfig: null, error };

  if (!user!.hospitalId) {
    return {
      user: null,
      hospitalId: null,
      planConfig: null,
      error: errorResponse("No hospital associated with this account", 400),
    };
  }

  const sub = await getSubscriptionState(user!.hospitalId);
  if (!sub.ok) {
    return {
      user: null,
      hospitalId: null,
      planConfig: null,
      error: errorResponse(`${sub.code}::${sub.message}`, 403),
    };
  }

  const planConfig = getPlanConfig(sub.status, sub.plan);
  if (!planConfig.features[feature]) {
    return {
      user: null,
      hospitalId: null,
      planConfig: null,
      error: errorResponse(
        `PLAN_FEATURE_REQUIRED::The feature "${FEATURE_LABELS[feature]}" is not included in your current plan. Please upgrade to Professional or Enterprise. Email: support@clickmyq.com | Phone: +91 93360 01167`,
        403
      ),
    };
  }

  return { user: user!, hospitalId: user!.hospitalId, planConfig, error: null };
};
