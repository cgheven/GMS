import "server-only";
import { Resend } from "resend";

// Resend's constructor throws on a falsy key at module load. Degrade to a
// placeholder instead so an environment that isn't wired for mail never 500s a
// request — every send then no-ops and returns an error object the caller can
// ignore. Configure RESEND_API_KEY + RESEND_FROM_EMAIL in env to enable mail.
const RESEND_KEY = process.env.RESEND_API_KEY;
if (!RESEND_KEY) {
  console.error("[email] RESEND_API_KEY is not set — every email send will no-op.");
}
const resend = new Resend(RESEND_KEY || "re_00000000_0000000000000000000000");

// Verified sender — must match a domain verified in Resend.
const FROM = process.env.RESEND_FROM_EMAIL ?? "Pulse GMS <noreply@yourpulse.io>";

const WHATSAPP = "923336673553";
const WHATSAPP_DISPLAY = "+92 333 6673553";

// Escape user-supplied content before embedding in HTML to prevent injection.
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Branded dark-theme shell. Uses a text wordmark (not an image) so it renders
// identically in every client regardless of whether a public SITE_URL is
// configured — no broken-image icon, no client-dependent background.
function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0f0f11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#18181b;border-radius:12px;border:1px solid #27272a;overflow:hidden;">
        <tr><td style="background:#1c1917;border-bottom:1px solid #27272a;padding:20px 28px;">
          <div style="font-size:18px;font-weight:700;color:#f5f5f5;line-height:1.1;letter-spacing:-0.3px;">Pulse</div>
          <div style="font-size:10px;font-weight:600;color:#F5A623;letter-spacing:1.6px;margin-top:4px;text-transform:uppercase;">Pulse of Your Gym</div>
        </td></tr>
        <tr><td style="padding:28px;">
          ${body}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #27272a;color:#71717a;font-size:12px;">
          Questions? WhatsApp us at
          <a href="https://wa.me/${WHATSAPP}" style="color:#F5A623;text-decoration:none;">${WHATSAPP_DISPLAY}</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Prospect-funnel confirmation. Sent (best-effort) after a public signup lands a
 * pulse_prospects lead. Never throws — a mail failure must not fail the signup.
 */
export async function sendSignupConfirmationEmail(
  to: string,
  opts: { ownerName?: string | null; gymName?: string | null },
): Promise<{ ok: boolean }> {
  if (!RESEND_KEY) return { ok: false };
  const name = opts.ownerName?.trim();
  const gym = opts.gymName?.trim();
  const greeting = name ? `Hi ${esc(name)},` : "Hi,";
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#f5f5f5;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
      Thanks for your interest in <strong style="color:#f5f5f5;">Pulse</strong>${
        gym ? ` for <strong style="color:#f5f5f5;">${esc(gym)}</strong>` : ""
      }. We've received your details and our team will reach out shortly to get you set up.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#d4d4d8;">
      Want to skip the wait? Message us directly on WhatsApp and we'll get you started today.
    </p>
    <a href="https://wa.me/${WHATSAPP}"
       style="display:inline-block;background:#F5A623;color:#18181b;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">
      Chat on WhatsApp
    </a>`;
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Welcome to Pulse — we'll be in touch",
      html: baseHtml("Welcome to Pulse", body),
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] sendSignupConfirmationEmail failed:", err);
    return { ok: false };
  }
}
