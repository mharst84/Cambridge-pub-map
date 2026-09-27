-- Accounts, synced check-ins and friends for the Cambridge Pub Map.
--
-- Security model (enforced with row level security):
--   * You can read and write your own profile and check-ins.
--   * You can read the profile and check-ins of your friends, and nothing else.
--   * Friendships are mutual. They are created with add_friend(code), using the
--     code from someone's invite link, and removed with remove_friend(id).

-- ---------- profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  -- Secret code used in invite links. Anyone with the code can add you as a friend.
  friend_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at timestamptz not null default now()
);

-- Every new account gets a profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- friendships ----------

-- Stored in both directions: (a, b) and (b, a).
create table public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Security definer so policies can call it without recursing into RLS.
create function public.is_friend(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_id = (select auth.uid()) and friend_id = other
  );
$$;

-- ---------- check-ins ----------

create table public.checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pub_key text not null check (char_length(pub_key) between 1 and 64),
  checked_in_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, pub_key, checked_in_at)
);

create index checkins_user_time on public.checkins (user_id, checked_in_at desc);

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.checkins enable row level security;

create policy "Read own and friends' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_friend(id));

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Read own friendships" on public.friendships
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Read own and friends' check-ins" on public.checkins
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend(user_id));

create policy "Add own check-ins" on public.checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Delete own check-ins" on public.checkins
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Signed-out visitors get nothing. Signed-in users may only change their display
-- name (not their id or friend code), and change friendships through the functions below.
revoke all on public.profiles, public.friendships, public.checkins from anon;
revoke all on public.profiles, public.friendships, public.checkins from authenticated;
grant select on public.profiles, public.friendships, public.checkins to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (pub_key, checked_in_at), delete on public.checkins to authenticated;

-- ---------- friend functions ----------

-- Adds the owner of `code` as a friend (both ways). Returns their id and name.
create function public.add_friend(code text)
returns table (id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  them public.profiles;
begin
  if me is null then
    raise exception 'Sign in to add friends' using errcode = '28000';
  end if;
  select * into them from public.profiles p where p.friend_code = code;
  if them.id is null then
    raise exception 'That invite link is not valid' using errcode = 'P0002';
  end if;
  if them.id = me then
    raise exception 'That is your own invite link' using errcode = '22023';
  end if;
  insert into public.friendships (user_id, friend_id)
  values (me, them.id), (them.id, me)
  on conflict do nothing;
  return query select them.id, them.display_name;
end;
$$;

create function public.remove_friend(friend uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
  where (user_id = (select auth.uid()) and friend_id = friend)
     or (user_id = friend and friend_id = (select auth.uid()));
$$;

revoke execute on function public.add_friend(text), public.remove_friend(uuid), public.is_friend(uuid) from public, anon;
grant execute on function public.add_friend(text), public.remove_friend(uuid), public.is_friend(uuid) to authenticated;
