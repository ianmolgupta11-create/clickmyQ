interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const smsBaseUrl = process.env.SMS_BASE_URL || "https://sms.renflair.in/V1.php";
const smsApiKey = process.env.SMS_API_KEY || "";

export const sendOTPviaSMS = async (mobile: string, otp: string): Promise<SMSResult> => {
  if (!smsApiKey) {
    console.log("[SMS][DEV-MODE] SMS_API_KEY not configured. OTP for mobile not sent via SMS.");
    return { success: false, error: "SMS API not configured" };
  }

  const phone = mobile.replace(/^\+/, "").replace(/\D/g, "");
  const url = `${smsBaseUrl}?API=${encodeURIComponent(smsApiKey)}&PHONE=${encodeURIComponent(phone)}&OTP=${encodeURIComponent(otp)}`;

  try {
    const resp = await fetch(url, { method: "GET" });
    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (resp.ok && data?.success) {
      return { success: true, messageId: data?.messageId || data?.id || data?.status };
    }

    return {
      success: false,
      error: data?.error || data?.message || data?.msg || `HTTP ${resp.status}`,
    };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error("[SMS] Failed to send OTP via SMS:", errorMsg);
    return { success: false, error: errorMsg };
  }
};
