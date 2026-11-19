import { NextRequest } from "next/server";
import { verifyToken } from "../utils/jwt";
import { errorResponse } from "../utils/response";
import { getSubscriptionState } from "../utils/subscription";
import { getPlanConfig, FEATURE_LABELS, PlanFeatureKey } from "../config/plans";

/**
 * Plan-based feature gating by API path.
 * STARTER plan (and any plan without the feature) gets a 403 on these paths.
 */
const FEATURE_PATHS: { prefix: string; feature: PlanFeatureKey }[] = [
  { prefix: "/api/ipd", feature: "ipd" },
  { prefix: "/api/config/wards", feature: "ipd" },
  { prefix: "/api/config/beds", feature: "ipd" },
  { prefix: "/api/pharmacy", feature: "pharmacy" },
  { prefix: "/api/subdept/inventory", feature: "pharmacy" },
  { prefix: "/api/prescriptions/ai-assist", feature: "aiRx" },
  { prefix: "/api/prescriptions/voice-transcribe", feature: "aiRx" },
];

export const authMiddleware = async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get("authorization");
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      token = req.cookies.get("hms_session")?.value || "";
    }

    if (!token) {
      return { user: null, error: errorResponse("Unauthorized", 401) };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return { user: null, error: errorResponse("Invalid token", 401) };
    }

    // Enforce trial/subscription status on every protected request.
    // SUPER_ADMIN is exempt so they always have platform access.
    if (payload.role !== "SUPER_ADMIN" && payload.hospitalId) {
      const sub = await getSubscriptionState(payload.hospitalId);
      if (!sub.ok) {
        return {
          user: null,
          error: errorResponse(`${sub.code}::${sub.message}`, 403),
        };
      }

      // Plan-based feature gating (e.g. STARTER has no IPD/pharmacy/AI).
      const path = req.nextUrl.pathname;
      const gated = FEATURE_PATHS.find((f) => path.startsWith(f.prefix));
      if (gated) {
        const planConfig = getPlanConfig(sub.status, sub.plan);
        if (!planConfig.features[gated.feature]) {
          return {
            user: null,
            error: errorResponse(
              `PLAN_FEATURE_REQUIRED::The feature "${FEATURE_LABELS[gated.feature]}" is not included in your current plan. Please upgrade to Professional or Enterprise. Email: support@clickmyq.com | Phone: +91 93360 01167`,
              403
            ),
          };
        }
      }
    }

    return { user: payload, error: null };
  } catch (error) {
    return { user: null, error: errorResponse("Unauthorized", 401) };
  }
};
