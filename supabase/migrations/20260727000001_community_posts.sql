-- Public "Community" hub for the company site: suggestions, questions, and
-- open comments from visitors. Everything is reviewed before it goes public
-- (status default 'pending'; only 'approved' rows are ever selectable by anon).
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('suggestion', 'question', 'comment')),
  name text,
  email text,
  content text not null check (char_length(content) between 1 and 2000),
  answer text,
  answered_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  upvotes integer not null default 0
);

create index if not exists community_posts_status_type_idx
  on public.community_posts (status, type, created_at desc);

alter table public.community_posts enable row level security;

-- Anyone can submit a post, but it must land as 'pending' — visitors can never
-- publish directly, and can never pre-set an answer or upvote count.
create policy "community_posts_insert_pending_only"
  on public.community_posts
  for insert
  to anon, authenticated
  with check (status = 'pending' and answer is null and answered_at is null and upvotes = 0);

-- The public can only ever read approved posts.
create policy "community_posts_select_approved"
  on public.community_posts
  for select
  to anon, authenticated
  using (status = 'approved');

-- Upvoting is done through a SECURITY DEFINER function below, not a direct
-- UPDATE policy, so anon never gets column-level write access to the table.
revoke update on public.community_posts from anon, authenticated;

create or replace function public.increment_community_upvote(post_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.community_posts
    set upvotes = upvotes + 1
    where id = post_id and status = 'approved' and type = 'suggestion'
  returning upvotes;
$$;

grant execute on function public.increment_community_upvote(uuid) to anon, authenticated;
