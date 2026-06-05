import { createAdminClient } from "@/lib/supabase/admin";

// Streams a shared receipt PDF from the PRIVATE `invoices` bucket via the
// service role, on our own domain — the Supabase storage URL is never exposed.
// Access is a time-limited bearer token (the link id); expiry is enforced here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

function notice(message: string, status: number): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt</title></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0d1a;color:#e6e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="text-align:center;padding:24px;max-width:360px"><div style="font-size:32px;margin-bottom:12px">🧾</div><h1 style="font-size:17px;font-weight:600;margin:0 0 8px">${message}</h1><p style="color:#8a8fa3;font-size:14px;line-height:1.5;margin:0">Please ask your gym to resend your receipt.</p></div></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  if (!UUID.test(token)) return notice("This receipt link is invalid.", 404);

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("pulse_invoice_links")
    .select("storage_path, expires_at")
    .eq("id", token)
    .maybeSingle();

  if (!link) return notice("This receipt link is invalid.", 404);
  if (new Date(link.expires_at as string).getTime() < Date.now()) {
    return notice("This receipt link has expired.", 410);
  }

  const { data: file, error } = await admin.storage.from("invoices").download(link.storage_path as string);
  if (error || !file) return notice("This receipt is no longer available.", 404);

  return new Response(file, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="receipt.pdf"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
