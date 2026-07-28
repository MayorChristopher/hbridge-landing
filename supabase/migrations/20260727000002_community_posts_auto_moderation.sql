-- Automated moderation for community_posts: a BEFORE INSERT trigger decides the
-- real status server-side (client-supplied status/answer/upvotes are ignored),
-- so "auto-approve good content, hold the rest for review" can't be spoofed.
create or replace function public.community_posts_moderate()
returns trigger
language plpgsql
as $$
declare
  c text := lower(coalesce(new.content, ''));
  word_count int;
  bad_words text[] := array[
    'fuck','shit','bitch','asshole','nigger','cunt','whore','slut','bastard',
    'porn','viagra','sex cam'
  ];
  w text;
  is_bad boolean := false;
begin
  foreach w in array bad_words loop
    if c like '%' || w || '%' then
      is_bad := true;
      exit;
    end if;
  end loop;

  if c ~ '(https?://|www\.)' then
    is_bad := true; -- links -> review before publishing
  end if;

  if c ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    is_bad := true; -- email addresses -> avoid public contact-info / phishing spam
  end if;

  if c ~ '(.)\1{4,}' then
    is_bad := true; -- "aaaaa" / "!!!!!" keyboard-mash or spam pattern
  end if;

  word_count := array_length(regexp_split_to_array(trim(c), '\s+'), 1);
  if word_count is null or word_count < 2 then
    is_bad := true; -- too short to meaningfully auto-publish
  end if;

  if length(new.content) > 12 and new.content = upper(new.content) then
    is_bad := true; -- ALL CAPS shouting
  end if;

  new.status := case when is_bad then 'pending' else 'approved' end;
  new.answer := null;
  new.answered_at := null;
  new.upvotes := 0;

  return new;
end;
$$;

drop trigger if exists community_posts_moderate_trigger on public.community_posts;
create trigger community_posts_moderate_trigger
  before insert on public.community_posts
  for each row execute function public.community_posts_moderate();

-- The trigger is now the sole authority on status; drop the client-supplied
-- status requirement but keep blocking client-forced answer/upvotes.
drop policy if exists "community_posts_insert_pending_only" on public.community_posts;
create policy "community_posts_insert_moderated"
  on public.community_posts
  for insert
  to anon, authenticated
  with check (answer is null and answered_at is null and upvotes = 0);
