create table if not exists feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  user_name    text,
  user_type    text,
  category     text not null check (category in ('suggestion', 'bug_report', 'improvement', 'general')),
  message      text not null,
  created_at   timestamptz not null default now()
);

alter table feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can submit feedback" on feedback
  for insert with check (auth.uid() = user_id);

-- Only service role can read (you review via Supabase dashboard)
create policy "Service role reads feedback" on feedback
  for select using (false);
