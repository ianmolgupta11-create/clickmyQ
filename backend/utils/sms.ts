import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;
const isProd = () => process.env.NODE_ENV === "production";

// Lazy-init client only when credentials exist — initializing with undefined
// credentials throws at module load and crashes routes that import this file.
let client: ReturnType<typeof twilio> | null = null;
const getClient = () => {
  if (!client && accountSid && authToken) client = twilio(accountSid, authToken);
  return client;
};

export const sendOTPviaSMS = async (mobile: string, otp: string) => {
  const twilioConfigured = Boolean(accountSid && authToken && fromPhone);
  if (isProd() && !twilioConfigured) {
    throw new Error("Twilio not configured for production SMS delivery");
  }
  if (!twilioConfigured) {
    // Dev bypass: log OTP to server console instead of sending a real SMS
    console.log(`[SMS][DEV-BYPASS] OTP for ${mobile}: ${otp} (Twilio not configured)`);
    return { success: true, bypass: true };
  }

  // Ensure the mobile number has a country code (default to +91 for India)
  const to = mobile.startsWith("+") ? mobile : `+91${mobile.replace(/\D/g, "")}`;

  try {
    const c = getClient();
    if (!c) throw new Error("Twilio client not initialized");
    await c.messages.create({
      body: `Your clickmyQPro verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
      from: fromPhone,
      to,
    });
    console.log(`[SMS] OTP sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error("[SMS] Failed to send OTP via SMS:", error);
    if (isProd()) throw error;
    console.log(`[SMS][DEV-BYPASS] OTP for ${mobile}: ${otp} (Twilio send failed)`);
    return { success: true, bypass: true };
  }
};
