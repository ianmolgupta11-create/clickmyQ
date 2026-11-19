import { NextResponse } from "next/server";

const INSECURE_DEFAULTS = [
  "dev-secret-change-me-in-production",
  "dev-session-secret-123456",
  "change-me",
  "changeme",
  "secret",
  "your-secret-key",
];

const isProduction = () => process.env.NODE_ENV === "production";

export const validateEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }

  const errors: string[] = [];

  // Required secrets
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required in production");
  }
  if (!process.env.JWT_SECRET) {
    errors.push("JWT_SECRET is required in production");
  } else if (INSECURE_DEFAULTS.includes(process.env.JWT_SECRET)) {
    errors.push("JWT_SECRET uses an insecure default value in production");
  }
  if (!process.env.SESSION_SECRET) {
    errors.push("SESSION_SECRET is required in production");
  } else if (INSECURE_DEFAULTS.includes(process.env.SESSION_SECRET)) {
    errors.push("SESSION_SECRET uses an insecure default value in production");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    errors.push("NEXT_PUBLIC_APP_URL is required in production");
  }
  if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD || !process.env.SUPER_ADMIN_SECURITY_KEY) {
    errors.push("SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_SECURITY_KEY are required in production");
  }

  if (process.env.DEV_UNLOCK_PLANS === "true") {
    errors.push("DEV_UNLOCK_PLANS cannot be true in production");
  }

  // Critical production services should be configured (fail clearly if missing)
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    errors.push("SMTP configuration (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD) is required in production");
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    errors.push("Twilio configuration (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) is required in production for SMS OTP");
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    errors.push("Cloudinary configuration is required in production for file uploads");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

export const enforceProductionEnv = () => {
  const result = validateEnv();
  if (!result.ok && isProduction()) {
    console.error("FATAL: Production environment validation failed:");
    result.errors?.forEach((err) => console.error(`  - ${err}`));
    throw new Error("Invalid production environment configuration");
  }
};
