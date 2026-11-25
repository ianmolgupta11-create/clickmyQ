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

/**
 * Core environment validation for variables required at both build time and runtime.
 * These are the minimum variables needed to boot the application and serve requests.
 * Service-specific credentials (SMTP, Twilio, Cloudinary) are validated lazily
 * when their respective features are initialized, not during page data collection.
 */
export const validateEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }

  const errors: string[] = [];

  // Required core secrets
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

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

/**
 * Validates SMTP configuration at runtime when email features are initialized.
 * Called lazily — not during Next.js build / static page generation.
 */
export const validateSmtpEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }
  const errors: string[] = [];
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    errors.push("SMTP configuration (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD) is required in production for email delivery");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

/**
 * Validates Twilio configuration at runtime when SMS features are initialized.
 * Called lazily — not during Next.js build / static page generation.
 */
export const validateTwilioEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }
  const errors: string[] = [];
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    errors.push("Twilio configuration (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) is required in production for SMS OTP");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

/**
 * Validates WhatsApp configuration at runtime when WhatsApp OTP features are initialized.
 * Called lazily — not during Next.js build / static page generation.
 */
export const validateWhatsAppEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }
  const errors: string[] = [];
  if (!process.env.WHATSAPP_API_KEY) {
    errors.push("WhatsApp configuration (WHATSAPP_API_KEY) is required in production for WhatsApp OTP delivery");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

/**
 * Validates SMS configuration at runtime when SMS OTP features are initialized.
 * Called lazily — not during Next.js build / static page generation.
 */
export const validateSmsEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }
  const errors: string[] = [];
  if (!process.env.SMS_API_KEY) {
    errors.push("SMS configuration (SMS_API_KEY) is required in production for SMS OTP delivery");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

/**
 * Validates Cloudinary configuration at runtime when file upload features are initialized.
 * Called lazily — not during Next.js build / static page generation.
 */
export const validateCloudinaryEnv = () => {
  if (!isProduction()) {
    return { ok: true };
  }
  const errors: string[] = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    errors.push("Cloudinary configuration is required in production for file uploads");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
};

/**
 * Enforces all production environment checks (core + service-specific).
 * Intended for runtime use only — must NOT be called at module level in
 * Next.js layouts or pages that are imported during build.
 */
export const enforceProductionEnv = () => {
  const result = validateEnv();
  if (!result.ok && isProduction()) {
    console.error("FATAL: Production environment validation failed:");
    result.errors?.forEach((err) => console.error(`  - ${err}`));
    throw new Error("Invalid production environment configuration");
  }
};
