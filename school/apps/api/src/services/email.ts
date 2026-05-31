import { env } from "../env.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface ResendErrorResponse {
  message?: string;
}

export function isEmailServiceConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!isEmailServiceConfigured()) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email service is not configured");
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ResendErrorResponse;
    throw new Error(body.message ?? "Failed to send email");
  }
}
