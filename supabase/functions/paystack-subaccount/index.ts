import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { action, bank_code, account_number, doctor_id, business_name, email, phone } = await req.json();

    // ── Verify account name ───────────────────────────────────────────────
    if (action === 'verify') {
      const res = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
      );
      const data = await res.json();
      if (!data.status) {
        return new Response(JSON.stringify({ error: data.message || 'Could not verify account' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ account_name: data.data.account_name }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Create or update subaccount ───────────────────────────────────────
    if (action === 'create') {
      // Check if doctor already has a subaccount
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data: doctor } = await supabase
        .from('doctors')
        .select('paystack_subaccount')
        .eq('id', doctor_id)
        .single();

      let subaccount_code: string;

      if (doctor?.paystack_subaccount) {
        // Update existing subaccount
        const res = await fetch(`https://api.paystack.co/subaccount/${doctor.paystack_subaccount}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settlement_bank: bank_code, account_number }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Failed to update subaccount');
        subaccount_code = data.data.subaccount_code;
      } else {
        // Create new subaccount
        const res = await fetch('https://api.paystack.co/subaccount', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            business_name,
            settlement_bank: bank_code,
            account_number,
            percentage_charge: 15, // platform takes 15%, doctor receives 85%
            description: 'Medical practitioner on Hbridge',
            primary_contact_email: email || undefined,
            primary_contact_name: business_name,
            primary_contact_phone: phone || undefined,
          }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Failed to create subaccount');
        subaccount_code = data.data.subaccount_code;
      }

      // Save to doctors table
      const { error } = await supabase
        .from('doctors')
        .update({
          paystack_subaccount: subaccount_code,
          bank_code,
          account_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doctor_id);

      if (error) throw error;

      return new Response(JSON.stringify({ subaccount_code }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
