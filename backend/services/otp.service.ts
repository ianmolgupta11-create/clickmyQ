import { createOTP, findLatestOTP, findLatestMobileOTP, verifyOTPMark } from "../repositories/otp.repo";
import { generateOTP } from "../utils/otp";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { sendOTPviaWhatsApp } from "../utils/whatsapp";

const isProd = () => process.env.NODE_ENV === "production";

const emailUsername = env.EMAIL_USERNAME?.trim() || "";
const emailPassword = env.EMAIL_PASSWORD?.replace(/\s/g, "") || "";
const smtpConfigured = Boolean(emailUsername && emailPassword && env.EMAIL_HOST);

console.log("[OTP Mailer] SMTP config", {
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  user: emailUsername ? `${emailUsername.slice(0, 4)}***${emailUsername.slice(-10)}` : "NOT SET",
  passLength: emailPassword.length,
});

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: Number(env.EMAIL_PORT),
  secure: Number(env.EMAIL_PORT) === 465,
  auth: smtpConfigured ? { user: emailUsername, pass: emailPassword } : undefined,
  // Brevo requires explicit TLS on port 587
  requireTLS: Number(env.EMAIL_PORT) === 587,
});

interface OTPEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const sendOTPEmail = async (email: string, otp: string): Promise<OTPEmailResult> => {
  const year = new Date().getFullYear();
  const digits = otp
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 4px;"><div style="width:44px;height:52px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;font-size:24px;font-weight:700;color:#111827;font-family:monospace;text-align:center;line-height:52px;">${d}</div></td>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>OTP Verification</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
  <tr><td align="center">
    <table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

      <tr>
        <td style="padding:32px 40px 24px;border-bottom:1px solid #f3f4f6;">
          <p style="margin:0 0 2px;font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;">clickmyQPro</p>
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#111827;">Email Verification</h1>
        </td>
      </tr>

      <tr>
        <td style="padding:32px 40px 24px;">
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.65;">
            Use the one-time code below to complete your hospital registration on clickmyQPro.
            This code is valid for <strong style="color:#374151;">10 minutes</strong>.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr>${digits}</tr>
          </table>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 40px 24px;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;font-size:11px;color:#d1d5db;">
            &copy; ${year} clickmyQPro &middot; Automated message &mdash; please do not reply.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const mailOptions = {
    from: emailUsername ? `"clickmyQPro" <${emailUsername}>` : '"clickmyQPro" <no-reply@clickmyq.com>',
    to: email,
    subject: "Your Verification Code – clickmyQPro",
    text: `Your OTP is: ${otp}\n\nValid for 10 minutes. Do not share this code.`,
    html,
  };

  if (!smtpConfigured) {
    console.log(`[OTP][DEV-MODE] SMTP not configured. OTP for ${email} not sent via email.`);
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[OTP] Email sent successfully to ${email}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error(`[OTP] Failed to send email to ${email}:`, errorMsg);
    
    // Don't expose OTP in logs
    if (isProd()) {
      throw new Error(`Failed to send OTP email: ${errorMsg}`);
    }
    
    // In development, return failure but don't log OTP
    return { success: false, error: errorMsg };
  }
};

export const requestOTP = async (email: string) => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await createOTP({ email, otp, expiresAt });

  // Send email OTP only
  const emailResult = await sendOTPEmail(email, otp);

  return {
    message: emailResult.success ? "OTP sent successfully" : "OTP generated but delivery failed",
    email: { success: emailResult.success, messageId: emailResult.messageId, error: emailResult.error },
  };
};

export const verifyOTP = async (email: string, otp: string) => {
  const latestOTP = await findLatestOTP(email);

  if (!latestOTP) throw new Error("No OTP found for this email");
  if (latestOTP.verified) throw new Error("OTP already verified");
  if (latestOTP.expiresAt < new Date()) throw new Error("OTP expired");
  if (latestOTP.otp !== otp) throw new Error("Invalid OTP");

  await verifyOTPMark(latestOTP.id);

  return { success: true, message: "OTP verified successfully" };
};

/* ── Patient mobile login OTP ───────────────────────────────
   Sends OTP to the patient's mobile via WhatsApp (renflair.in API). */
export const requestMobileOTP = async (mobile: string) => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await createOTP({ email: `patient:${mobile}`, mobile, otp, expiresAt } as any);

  const whatsappResult = await sendOTPviaWhatsApp(mobile, otp);

  return {
    message: whatsappResult.success ? "OTP sent successfully via WhatsApp" : "OTP generated but WhatsApp delivery failed",
    sms: { success: whatsappResult.success, messageId: whatsappResult.messageId, error: whatsappResult.error },
  };
};

export const verifyMobileOTP = async (mobile: string, otp: string) => {
  const latestOTP = await findLatestMobileOTP(mobile);

  if (!latestOTP) throw new Error("No OTP found for this mobile number");
  if (latestOTP.verified) throw new Error("OTP already verified");
  if (latestOTP.expiresAt < new Date()) throw new Error("OTP expired");
  if (latestOTP.otp !== otp) throw new Error("Invalid OTP");

  await verifyOTPMark(latestOTP.id);

  return { success: true, message: "OTP verified successfully" };
};
