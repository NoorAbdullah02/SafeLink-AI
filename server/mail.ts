import { config } from './config.js';
export const mailReady = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export async function sendMail(
  to: string,
  subject: string,
  message: string,
  link?: string,
): Promise<boolean> {
  if (!mailReady()) return false;
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || 'SafeLink AI',
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject: 'SafeLink AI · ' + subject,
        textContent: message + (link ? '\n' + link : ''),
        htmlContent: `<div style="font-family:Arial;max-width:560px;margin:32px auto;line-height:1.7"><h2>SafeLink AI</h2><h3>${escape(subject)}</h3><p>${escape(message)}</p>${link ? `<p><a href="${escape(link)}">Continue securely</a></p>` : ''}<hr/><p>Before you click, let AI check. Never share your OTP, PIN or password.</p></div>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
export const accountLink = (purpose: string, t: string) =>
  config.appUrl + '/?action=' + purpose + '&token=' + encodeURIComponent(t);
