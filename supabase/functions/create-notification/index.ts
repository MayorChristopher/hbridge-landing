import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  is_read?: boolean;
}

async function isRelated(callerId: string, targetId: string): Promise<boolean> {
  if (callerId === targetId) return true;

  // Consultation relationship, either direction (patient <-> doctor).
  const { data: asPatient } = await admin
    .from('consultations')
    .select('id, doctors!inner(user_id)')
    .eq('patient_id', callerId)
    .eq('doctors.user_id', targetId)
    .limit(1);
  if (asPatient && asPatient.length > 0) return true;

  const { data: asDoctor } = await admin
    .from('consultations')
    .select('id, doctors!inner(user_id)')
    .eq('patient_id', targetId)
    .eq('doctors.user_id', callerId)
    .limit(1);
  if (asDoctor && asDoctor.length > 0) return true;

  // Hospital-staff relationship, either direction (hospital admin <-> doctor),
  // admin identity resolved the same way the app already does it:
  // profiles.hospital_name vs hospitals.name.
  const { data: callerAsDoctor } = await admin.from('doctors').select('id').eq('user_id', callerId).maybeSingle();
  if (callerAsDoctor) {
    const { data: staffRows } = await admin
      .from('hospital_staff')
      .select('hospital_id, hospitals!inner(name)')
      .eq('doctor_id', callerAsDoctor.id);
    for (const row of staffRows ?? []) {
      const hospName = (row as any).hospitals?.name;
      if (!hospName) continue;
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .ilike('hospital_name', `%${hospName}%`)
        .eq('id', targetId)
        .limit(1);
      if (admins && admins.length > 0) return true;
    }
  }

  const { data: targetAsDoctor } = await admin.from('doctors').select('id').eq('user_id', targetId).maybeSingle();
  if (targetAsDoctor) {
    const { data: staffRows } = await admin
      .from('hospital_staff')
      .select('hospital_id, hospitals!inner(name)')
      .eq('doctor_id', targetAsDoctor.id);
    for (const row of staffRows ?? []) {
      const hospName = (row as any).hospitals?.name;
      if (!hospName) continue;
      const { data: callerProfile } = await admin
        .from('profiles')
        .select('id, hospital_name')
        .eq('id', callerId)
        .maybeSingle();
      if (callerProfile?.hospital_name && hospName.toLowerCase().includes(callerProfile.hospital_name.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const fail = (message: string, status = 400) =>
    new Response(JSON.stringify({ verified: false, message }), {
      status, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return fail('Not authenticated', 401);

    const { notifications } = await req.json() as { notifications: NotificationInput[] };
    if (!Array.isArray(notifications) || notifications.length === 0) return fail('Missing notifications');

    for (const n of notifications) {
      if (!n.userId || !n.title || !n.message) return fail('Each notification needs userId, title, message');
      const related = await isRelated(caller.id, n.userId);
      if (!related) return fail(`Not authorized to notify user ${n.userId}`, 403);
    }

    const { error } = await admin.from('notifications').insert(
      notifications.map((n) => ({
        user_id: n.userId,
        title: n.title,
        message: n.message,
        type: n.type ?? 'system',
        is_read: n.is_read ?? false,
      }))
    );
    if (error) return fail(error.message, 500);

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
});
