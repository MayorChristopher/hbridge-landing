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

const BUCKET = 'attachments';
const SIGNED_URL_TTL_SECONDS = 3600;

function extractStoragePath(urlOrPath: string): string {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = urlOrPath.indexOf(marker);
  return idx === -1 ? urlOrPath : urlOrPath.slice(idx + marker.length);
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

    const { context, recordId, messageId } = await req.json();

    let filePath: string | null = null;

    if (context === 'medical_record') {
      if (!recordId) return fail('Missing recordId');

      const { data: record, error } = await admin
        .from('medical_records')
        .select('id, user_id, file_url, attachment_url')
        .eq('id', recordId)
        .single();
      if (error || !record) return fail('Record not found', 404);

      let authorized = record.user_id === caller.id;

      if (!authorized) {
        const { data: grant } = await admin
          .from('medical_record_access')
          .select('id, expires_at')
          .eq('record_id', recordId)
          .eq('is_active', true)
          .or(`patient_id.eq.${caller.id},doctor_id.eq.${caller.id}`)
          .maybeSingle();
        authorized = !!grant && (!grant.expires_at || new Date(grant.expires_at) > new Date());
      }

      if (!authorized) return fail('You do not have access to this record', 403);
      filePath = record.file_url || record.attachment_url;
    } else if (context === 'conversation_attachment') {
      if (!messageId) return fail('Missing messageId');

      const { data: message, error } = await admin
        .from('messages')
        .select('id, conversation_id, attachment_url')
        .eq('id', messageId)
        .single();
      if (error || !message) return fail('Message not found', 404);

      const { data: conversation, error: convError } = await admin
        .from('conversations')
        .select('patient_id, doctor_id')
        .eq('id', message.conversation_id)
        .single();
      if (convError || !conversation) return fail('Conversation not found', 404);

      let authorized = conversation.patient_id === caller.id;
      if (!authorized && conversation.doctor_id) {
        const { data: doctor } = await admin
          .from('doctors')
          .select('user_id')
          .eq('id', conversation.doctor_id)
          .single();
        authorized = doctor?.user_id === caller.id;
      }

      if (!authorized) return fail('You do not have access to this attachment', 403);
      filePath = message.attachment_url;
    } else {
      return fail('Unknown context');
    }

    if (!filePath) return fail('No file associated with this record', 404);

    const path = extractStoragePath(filePath);
    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed) return fail(signError?.message || 'Could not sign URL', 500);

    return new Response(JSON.stringify({ verified: true, url: signed.signedUrl }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
});
