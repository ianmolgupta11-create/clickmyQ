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

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  bypass?: boolean;
}

export const sendOTPviaSMS = async (mobile: string, otp: string): Promise<SMSResult> => {
  const twilioConfigured = Boolean(accountSid && authToken && fromPhone);
  if (isProd() && !twilioConfigured) {
    throw new Error("Twilio not configured for production SMS delivery");
  }
  if (!twilioConfigured) {
    console.log(`[SMS][DEV-MODE] Twilio not configured. OTP for ${mobile} not sent via SMS.`);
    return { success: false, error: "Twilio not configured", bypass: true };
  }

  // Ensure the mobile number has a country code (default to +91 for India)
  const to = mobile.startsWith("+") ? mobile : `+91${mobile.replace(/\D/g, "")}`;

  try {
    const c = getClient();
    if (!c) throw new Error("Twilio client not initialized");
    const message = await c.messages.create({
      body: `Your clickmyQPro verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
      from: fromPhone,
      to,
    });
    console.log(`[SMS] OTP sent successfully to ${to}, messageId: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error(`[SMS] Failed to send OTP via SMS to ${to}:`, errorMsg);
    if (isProd()) throw error;
    // Don't expose OTP in logs
    console.log(`[SMS][DEV-MODE] SMS send failed for ${to}: ${errorMsg}`);
    return { success: false, error: errorMsg, bypass: true };
  }
};
