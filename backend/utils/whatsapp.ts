interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const baseUrl = process.env.WHATSAPP_BASE_URL || "https://whatsapp.renflair.in/V1.php";
const apiKey = process.env.WHATSAPP_API_KEY || "";
const countryCode = process.env.WHATSAPP_COUNTRY_CODE || "91";

export const sendOTPviaWhatsApp = async (mobile: string, otp: string): Promise<WhatsAppResult> => {
  if (!apiKey) {
    console.log("[WhatsApp][DEV-MODE] WHATSAPP_API_KEY not configured. OTP for mobile not sent via WhatsApp.");
    return { success: false, error: "WhatsApp API not configured" };
  }

  // Strip non-digits and leading + so only digits are sent (e.g. 9876543210)
  const phone = mobile.replace(/^\+/, "").replace(/\D/g, "");
  const url = `${baseUrl}?API=${encodeURIComponent(apiKey)}&PHONE=${encodeURIComponent(phone)}&OTP=${encodeURIComponent(otp)}&COUNTRY=${encodeURIComponent(countryCode)}`;

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
    console.error("[WhatsApp] Failed to send OTP via WhatsApp:", errorMsg);
    return { success: false, error: errorMsg };
  }
};
