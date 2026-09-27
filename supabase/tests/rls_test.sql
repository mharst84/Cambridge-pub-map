-- Run after supabase_stub.sql and the migrations. Fails loudly on the first broken expectation.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
update public.profiles set friend_code = 'alicecode' where id = '00000000-0000-0000-0000-00000000000a';

create function pg_temp.act_as(who text) returns void language plpgsql as $$
begin
  if who is null then
    perform set_config('request.jwt.claim.sub', '', false);
    execute 'set role anon';
  else
    perform set_config('request.jwt.claim.sub', who, false);
    execute 'set role authenticated';
  end if;
end $$;

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

grant execute on function pg_temp.act_as(text), pg_temp.expect(boolean, text) to anon, authenticated;

-- Everyone checks in somewhere.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.checkins (pub_key, checked_in_at) values ('Eagle', '2026-09-01T20:00:00Z');
update public.profiles set display_name = 'Alice' where id = auth.uid();
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.checkins (pub_key, checked_in_at) values ('Mill', '2026-09-02T20:00:00Z');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.checkins (pub_key, checked_in_at) values ('Anchor', '2026-09-03T20:00:00Z');

-- Strangers can't see each other.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.checkins) = 1, 'Bob only sees his own check-in before making friends');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'Bob only sees his own profile');

-- Bob opens Alice's invite link.
select pg_temp.expect((select display_name from public.add_friend('alicecode')) = 'Alice', 'add_friend returns the friend''s name');
select pg_temp.expect((select count(*) from public.checkins) = 2, 'Bob sees Alice''s check-ins once they are friends');
select pg_temp.expect((select count(*) from public.add_friend('alicecode')) = 1, 'Adding the same friend twice is harmless');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) from public.checkins) = 2, 'Friendship is mutual: Alice sees Bob''s check-ins');
select pg_temp.expect(not exists (select 1 from public.checkins where pub_key = 'Anchor'), 'Alice can''t see Carol, who isn''t her friend');

-- Things that must be refused.
do $$ begin
  insert into public.checkins (user_id, pub_key, checked_in_at)
  values ('00000000-0000-0000-0000-00000000000b', 'Fake', now());
  raise exception 'FAILED: Alice checked in as Bob';
exception when insufficient_privilege then raise notice 'ok: can''t check in as someone else';
end $$;

do $$ begin
  update public.profiles set friend_code = 'mine' where id = auth.uid();
  raise exception 'FAILED: friend code was changed';
exception when insufficient_privilege then raise notice 'ok: can''t change friend code';
end $$;

with t as (update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b' returning 1)
select pg_temp.expect((select count(*) from t) = 0, 'Alice can''t rename her friend Bob');

with t as (delete from public.checkins where pub_key = 'Mill' returning 1)
select pg_temp.expect((select count(*) from t) = 0, 'Alice can''t delete Bob''s check-ins');

do $$ begin
  perform public.add_friend('alicecode');
  raise exception 'FAILED: added self as friend';
exception when invalid_parameter_value then raise notice 'ok: can''t befriend yourself';
end $$;

do $$ begin
  perform public.add_friend('nope');
  raise exception 'FAILED: bad code accepted';
exception when no_data_found then raise notice 'ok: unknown invite code is rejected';
end $$;

-- Signed-out visitors see nothing.
select pg_temp.act_as(null);
do $$ begin
  perform count(*) from public.checkins;
  raise exception 'FAILED: anon could read check-ins';
exception when insufficient_privilege then raise notice 'ok: signed-out visitors can''t read check-ins';
end $$;

-- Unfriending removes access both ways.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.remove_friend('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) from public.checkins) = 1, 'After unfriending Bob only sees his own check-in');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) from public.checkins) = 1, 'After unfriending Alice only sees her own check-in');

-- Own check-ins can be undone.
with t as (delete from public.checkins where pub_key = 'Eagle' returning 1)
select pg_temp.expect((select count(*) from t) = 1, 'Alice can delete her own check-in');

reset role;
\echo ALL DATABASE TESTS PASSED
