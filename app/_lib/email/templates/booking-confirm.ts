/**
 * Booking Confirmation Email Template
 * 
 * Magic link email for confirming pending bookings.
 * Simple, clean design with clear CTA.
 * 
 * STANDARDS:
 * - No PII in subject line
 * - Clear expiry warning
 * - Mobile-friendly design
 * - Plain text fallback
 */

export interface BookingConfirmationTemplateParams {
  workspaceName: string;
  staffName: string;
  serviceName: string;
  sessionTime: string;
  confirmUrl: string;
  expiryMinutes: number;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate booking confirmation email content
 */
export function bookingConfirmationTemplate(
  params: BookingConfirmationTemplateParams
): EmailTemplate {
  const { workspaceName, staffName, serviceName, sessionTime, confirmUrl, expiryMinutes } = params;

  const subject = 'Confirm your session';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your session</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">
                Confirm Your Session
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #3f3f46;">
                You've requested to book a session at <strong>${escapeHtml(workspaceName)}</strong>. Please confirm your booking by clicking the button below.
              </p>
              
              <!-- Booking Details -->
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Session Details</p>
                    <p style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: #18181b;">
                      ${escapeHtml(serviceName)}
                    </p>
                    <p style="margin: 0 0 4px; font-size: 14px; color: #3f3f46;">
                      with ${escapeHtml(staffName)}
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #3f3f46;">
                      ${escapeHtml(sessionTime)}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(confirmUrl)}" 
                       style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; border-radius: 8px;">
                      Confirm Session
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Expiry Warning -->
              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; text-align: center;">
                This link expires in ${expiryMinutes} minutes.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                If you didn't request this booking, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = `
Confirm Your Session

You've requested to book a session at ${workspaceName}. Please confirm your booking by clicking the link below.

Session Details:
${serviceName}
with ${staffName}
${sessionTime}

Confirm your session: ${confirmUrl}

This link expires in ${expiryMinutes} minutes.

If you didn't request this booking, you can safely ignore this email.
`.trim();

  return { subject, html, text };
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}
