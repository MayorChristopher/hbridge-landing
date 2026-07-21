-- Formalize the subscriptions table + profile columns (previously only applied
-- ad hoc via CLEAN_DATABASE.sql / the dashboard) and lock writes down to the
-- service role so only the paystack-verify edge function can grant a plan.

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id text not null,
  status text not null default 'pending',
  amount numeric(10, 2) not null,
  payment_reference text not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

alter table profiles
  add column if not exists subscription_plan text,
  add column if not exists subscription_status text default 'free',
  add column if not exists subscription_expires_at timestamptz;

-- consultations.payment_reference is already written by the client today but
-- was never captured in a migration; bring it under version control here.
-- (No unique constraint added: the edge function guards against
-- double-processing by checking payment_status before writing.)
alter table consultations
  add column if not exists payment_reference text;

alter table subscriptions enable row level security;

create policy "subscriptions_select_own"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Intentionally no insert/update policy for authenticated users: only the
-- service-role key (used exclusively by the paystack-verify edge function)
-- can write to this table, which is the fix for the client-trust issue.
