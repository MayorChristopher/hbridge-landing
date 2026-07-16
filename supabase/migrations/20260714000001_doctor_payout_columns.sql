-- Add payout account columns to doctors table
alter table doctors
  add column if not exists paystack_subaccount text,
  add column if not exists bank_code text,
  add column if not exists account_number text;
