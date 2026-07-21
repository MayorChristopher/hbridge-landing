-- One-time manual Pro grant for a personal test account (hackonrichard@gmail.com),
-- requested so its owner can verify the practitioner-network paywall end-to-end
-- without a real Paystack transaction. Mirrors exactly what paystack-verify
-- writes on a real payment (subscriptions row + profiles.subscription_status),
-- so the app can't tell this apart from a real subscription -- it just isn't
-- backed by an actual charge. payment_reference is deterministic so re-running
-- this migration is a no-op instead of erroring on the unique constraint.
do $$
declare
  v_user_id uuid;
  v_expires timestamptz := now() + interval '30 days';
begin
  select id into v_user_id from auth.users where email = 'hackonrichard@gmail.com';

  if v_user_id is null then
    raise notice 'No auth user found for hackonrichard@gmail.com -- skipping grant';
    return;
  end if;

  insert into subscriptions (user_id, plan_id, status, amount, payment_reference, started_at, expires_at)
  values (v_user_id, 'doctor_pro', 'active', 0, 'manual_grant_' || v_user_id::text, now(), v_expires)
  on conflict (payment_reference) do update
    set status = 'active', expires_at = v_expires;

  update profiles
  set subscription_plan = 'doctor_pro', subscription_status = 'active', subscription_expires_at = v_expires
  where id = v_user_id;
end $$;
