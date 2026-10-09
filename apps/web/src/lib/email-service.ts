import { Resend } from 'resend';

export interface SendOtpEmailParams {
  email: string;
  name?: string | undefined;
  otp: string;
}

export interface SendOtpEmailResult {
  success: boolean;
  messageId?: string | undefined;
  simulated?: boolean | undefined;
  error?: string | undefined;
}

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export function generateOtpEmailHtml(otp: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FBUploadPro Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0d12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0c0d12; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #12141c; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 36px 32px; text-align: left;">
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 20px; font-weight: 700; color: #f59e0b; letter-spacing: -0.02em;">FBUploadPro</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px; font-size: 15px; line-height: 1.6; color: #d1d5db;">
              ${greeting}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 24px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
              Thank you for starting your account setup. Use the verification code below to confirm your email address and activate your automated publishing workspace:
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <div style="background-color: #1a1d28; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 18px 24px; display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 0.35em; color: #f59e0b; font-family: monospace;">
                ${otp}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 16px; padding-bottom: 24px; font-size: 13px; line-height: 1.5; color: #6b7280; text-align: center;">
              This code expires in 10 minutes. If you did not request this verification, you can safely ignore this email.
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 20px; font-size: 12px; color: #4b5563; text-align: center;">
              &copy; ${new Date().getFullYear()} FBUploadPro. High-throughput Facebook & Instagram automation.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateOtpEmailText(otp: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  return `
${greeting}

Your FBUploadPro verification code is: ${otp}

Enter this 6-digit code on the verification screen to activate your account.
This code expires in 10 minutes.

If you did not request this code, you can safely ignore this email.

--
FBUploadPro Security Team
  `.trim();
}

export async function sendOtpEmail(params: SendOtpEmailParams): Promise<SendOtpEmailResult> {
  const { email, name, otp } = params;
  const resend = getResendClient();

  if (!resend) {
    // Graceful offline/test logging
    console.log(`[EmailService] Simulated OTP dispatch to ${email}: ${otp}`);
    return {
      success: true,
      simulated: true,
    };
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || 'FBUploadPro <verify@resend.dev>';
    const response = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: `${otp} is your FBUploadPro verification code`,
      html: generateOtpEmailHtml(otp, name),
      text: generateOtpEmailText(otp, name),
    });

    if (response.error) {
      console.error('[EmailService] Resend API error:', response.error);
      return {
        success: false,
        error: response.error.message,
      };
    }

    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to send verification email';
    console.error('[EmailService] Dispatch exception:', msg);
    return {
      success: false,
      error: msg,
    };
  }
}
