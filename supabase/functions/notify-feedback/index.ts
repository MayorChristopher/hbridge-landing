import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TO_EMAIL       = 'hbridgenigeria@gmail.com';

serve(async (req) => {
  try {
    const payload = await req.json();
    // Supabase DB webhook sends: { type, table, record, schema, old_record }
    const record = payload.record ?? payload;

    const categoryLabel: Record<string, string> = {
      suggestion:  'Suggestion',
      improvement: 'Improvement',
      bug_report:  'Bug Report',
      general:     'General',
    };

    const userTypeLabel: Record<string, string> = {
      doctor:         'Medical Practitioner',
      patient:        'Patient',
      hospital_admin: 'Hospital Admin',
    };

    const subject = `[Hbridge Feedback] ${categoryLabel[record.category] ?? record.category} from ${record.user_name ?? 'Anonymous'}`;

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <div style="background:#083236;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h2 style="color:#fff;margin:0;font-size:20px;">New Feedback Received</h2>
          <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:13px;">Hbridge — in-app feedback</p>
        </div>
        <div style="background:#f5f3ee;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #eae5da;border-top:none;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="padding:8px 0;color:#7a8785;font-size:12px;width:120px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">From</td>
              <td style="padding:8px 0;color:#16211f;font-size:14px;">${record.user_name ?? 'Anonymous'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#7a8785;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">Role</td>
              <td style="padding:8px 0;color:#16211f;font-size:14px;">${userTypeLabel[record.user_type] ?? record.user_type ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#7a8785;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">Category</td>
              <td style="padding:8px 0;">
                <span style="background:#0b7e8a1a;color:#0b7e8a;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">
                  ${categoryLabel[record.category] ?? record.category}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#7a8785;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">Date</td>
              <td style="padding:8px 0;color:#16211f;font-size:14px;">${new Date(record.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</td>
            </tr>
          </table>
          <div style="background:#fff;border:1px solid #eae5da;border-radius:10px;padding:16px 20px;">
            <p style="color:#7a8785;font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin:0 0 8px;">Message</p>
            <p style="color:#16211f;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${record.message}</p>
          </div>
        </div>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hbridge <noreply@hbridge.ng>',
        reply_to: [TO_EMAIL],
        to: [TO_EMAIL],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('notify-feedback error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
