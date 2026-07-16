import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, userType, specialty } = await req.json();

    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');

    const isDoctor = userType === 'doctor';
    const displayName = isDoctor ? `Dr. ${name}` : (name || 'there');
    const doctorLabel = specialty || 'medical professional';

    const subject = isDoctor
      ? `Welcome to Hbridge, Dr. ${name} — Your profile is live!`
      : `Welcome to Hbridge, ${name || 'friend'} — Healthcare, simplified.`;

    const logoBlock = `
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
        <tr>
          <td style="background:#ffffff;padding:5px;border-radius:50%;border:3px solid #0B7E8A;">
            <img src="https://vapoyosssxnprxznnfgb.supabase.co/storage/v1/object/public/assets/hbridge3.png"
                 alt="Hbridge" width="60" height="60"
                 style="display:block;border-radius:50%;background-color:#ffffff;" />
          </td>
        </tr>
      </table>`;

    const footer = `
      <tr><td style="padding:0 40px;"><div style="height:1px;background:#EAE5DA;"></div></td></tr>
      <tr>
        <td style="padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#97A2A0;">Hbridge Nigeria</p>
          <p style="margin:0 0 4px;font-size:11px;color:#C5CAC9;">Connecting Nigerians to quality healthcare</p>
          <p style="margin:0;font-size:11px;color:#C5CAC9;">
            Questions? <a href="mailto:hbridgenigeria@gmail.com" style="color:#0B7E8A;text-decoration:none;">hbridgenigeria@gmail.com</a>
          </p>
        </td>
      </tr>`;

    const htmlBody = isDoctor ? `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Hbridge</title>
</head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(8,50,54,0.10);">
        <tr>
          <td style="background:#083236;padding:32px 40px;text-align:center;">
            ${logoBlock}
            <div style="color:#D4A843;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">HBRIDGE NIGERIA</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0C2E30;letter-spacing:-0.3px;">Welcome, ${displayName}!</h1>
            <p style="margin:0 0 24px;font-size:14px;font-weight:600;color:#0B7E8A;">Your Hbridge profile is now live.</p>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
              As a <strong>${doctorLabel}</strong> on Hbridge, you're now part of a growing network of healthcare professionals bridging the gap between patients and quality medical care across Nigeria.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              Patients can now discover your profile, book consultations, and securely share their medical records with you — all through the app.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FAFA;border-radius:14px;margin-bottom:24px;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#0B7E8A;letter-spacing:1.5px;text-transform:uppercase;">What you can do on Hbridge</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Accept and manage patient appointment requests</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Access patient-shared medical records securely</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Message patients directly through the platform</p>
                  <p style="margin:0;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Maintain digital case files for your patients</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:15px;color:#0C2E30;font-weight:600;">Thank you for choosing to make a difference.</p>
            <p style="margin:0;font-size:14px;color:#6B7280;">— The Hbridge Team</p>
          </td>
        </tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>` : `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Hbridge</title>
</head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EE;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(8,50,54,0.10);">
        <tr>
          <td style="background:#083236;padding:32px 40px;text-align:center;">
            ${logoBlock}
            <div style="color:#D4A843;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">HBRIDGE NIGERIA</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0C2E30;letter-spacing:-0.3px;">Welcome, ${displayName}!</h1>
            <p style="margin:0 0 24px;font-size:14px;font-weight:600;color:#0B7E8A;">Your health journey starts here.</p>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
              For too long, managing your health in Nigeria meant dealing with scattered paper records, long queues, and difficulty finding the right specialist. <strong>Hbridge changes that.</strong>
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              Your health profile is set up and you're ready to go. Everything you need — in one place, on your phone.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FAFA;border-radius:14px;margin-bottom:24px;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#0B7E8A;letter-spacing:1.5px;text-transform:uppercase;">What Hbridge does for you</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Store and access your medical records securely</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Book consultations with verified doctors near you</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Share records with hospitals and specialists instantly</p>
                  <p style="margin:0;font-size:14px;color:#374151;">&#10003;&nbsp;&nbsp;Get AI-powered health guidance anytime</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:15px;color:#0C2E30;font-weight:600;">We're glad you're here.</p>
            <p style="margin:0;font-size:14px;color:#6B7280;">— The Hbridge Team</p>
          </td>
        </tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Hbridge', email: 'hello@hbridge.ng' },
        replyTo: { email: 'hbridgenigeria@gmail.com' },
        to: [{ email }],
        subject,
        htmlContent: htmlBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-welcome-email error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
