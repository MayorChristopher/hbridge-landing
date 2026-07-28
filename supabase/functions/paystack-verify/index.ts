import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mirrors src/config/subscriptions.ts — keep prices in sync if plans change.
const PLAN_PRICES: Record<string, number> = {
  patient_free: 0,
  patient_premium: 5000,
  doctor_free: 0,
  doctor_pro: 10000,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const fail = (message: string, status = 400) =>
    new Response(JSON.stringify({ verified: false, message }), {
      status, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const { reference, kind, planId, userId, consultationId, hospitalId } = await req.json();
    if (!reference || !kind) return fail('Missing reference or kind');

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      return fail('Payment not confirmed by Paystack');
    }
    const paidAmount = verifyData.data.amount / 100; // kobo -> naira

    if (kind === 'subscription') {
      if (!planId || !userId) return fail('Missing planId or userId');
      const expectedPrice = PLAN_PRICES[planId];
      if (expectedPrice === undefined) return fail('Unknown plan');
      if (paidAmount < expectedPrice) return fail('Paid amount does not match plan price');

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: inserted, error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          amount: paidAmount,
          payment_reference: reference,
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (insertError) {
        // Unique violation on payment_reference means this reference was already processed.
        if (insertError.code === '23505') return fail('This payment has already been processed');
        return fail(insertError.message, 500);
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ subscription_plan: planId, subscription_status: 'active', subscription_expires_at: expiresAt })
        .eq('id', userId);
      if (profileError) return fail(profileError.message, 500);

      return new Response(JSON.stringify({ verified: true, subscription: inserted }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'consultation') {
      if (!consultationId) return fail('Missing consultationId');

      const { data: consultation, error: fetchError } = await supabase
        .from('consultations')
        .select('id, consultation_fee, payment_status')
        .eq('id', consultationId)
        .single();
      if (fetchError || !consultation) return fail('Consultation not found', 404);
      if (consultation.payment_status === 'paid') return fail('This consultation has already been paid for');
      if (paidAmount < Number(consultation.consultation_fee)) {
        return fail('Paid amount does not match consultation fee');
      }

      const { error: updateError } = await supabase
        .from('consultations')
        .update({
          status: 'scheduled',
          payment_status: 'paid',
          payment_reference: reference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', consultationId);
      if (updateError) return fail(updateError.message, 500);

      return new Response(JSON.stringify({ verified: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'folder') {
      if (!hospitalId || !userId) return fail('Missing hospitalId or userId');

      const { data: hospital, error: hospError } = await supabase
        .from('hospitals')
        .select('id, name, folder_creation_fee')
        .eq('id', hospitalId)
        .single();
      if (hospError || !hospital) return fail('Hospital not found', 404);
      if (paidAmount < Number(hospital.folder_creation_fee)) {
        return fail('Paid amount does not match folder creation fee');
      }

      const { data: assignedNumber, error: numberError } = await supabase
        .rpc('assign_folder_number', { p_hospital_id: hospitalId });
      if (numberError) return fail(numberError.message, 500);

      const { data: folder, error: insertError } = await supabase
        .from('record_folders')
        .insert({
          owner_id: userId,
          folder_name: hospital.name,
          folder_type: 'hospital',
          linked_id: hospitalId,
          // "OL-" prefix is deliberate — a hospital's own physical/walk-in
          // filing numbers are a separate, staff-managed sequence with no
          // knowledge of this app. A plain zero-padded number here (e.g.
          // "0001") could coincide with an existing physical folder number
          // for a completely different patient, causing real mix-ups at the
          // front desk. The prefix makes an online-registered folder
          // unmistakable at a glance, regardless of the hospital's own scheme.
          folder_number: `OL-${String(assignedNumber).padStart(4, '0')}`,
          payment_reference: reference,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') return fail('This payment has already been processed');
        return fail(insertError.message, 500);
      }

      return new Response(JSON.stringify({ verified: true, folder }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return fail('Unknown kind');
  } catch (e: any) {
    return fail(e.message, 500);
  }
});
