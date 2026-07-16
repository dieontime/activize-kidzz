-- Activize Kidzz — auth schema
--
-- Auth model: custom username + 4-emoji PIN (NOT Supabase Auth).
-- Hashing: SHA-256(secret || salt) using pgcrypto's digest().
-- All credential validation, lockout enforcement, and token issuance
-- happens server-side inside SECURITY DEFINER RPC functions so the anon
-- key alone cannot read pin_hash / recovery_hash / salt.
--
-- RLS: profiles has RLS enabled with NO anon/authenticated policy at all
-- (default-deny). Only the SECURITY DEFINER RPCs below can touch this
-- table — they bypass RLS by design, so a permissive policy would only
-- ever weaken things. This is stricter than the reference implementation
-- this was ported from, which flagged its own permissive policy as
-- temporary.

create schema if not exists extensions;
create extension if not exists pgcrypto;

create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  username        text not null,
  avatar          text not null,
  age_band        text not null check (age_band in ('3-5', '6-8')),
  pin_hash        text not null,
  salt            text not null,
  recovery_hash   text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_uniq
  on profiles (lower(username));

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function sha256_hex(p_input text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_input, 'sha256'), 'hex');
$$;

create or replace function generate_salt()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(gen_random_bytes(16), 'hex');
$$;

create or replace function generate_recovery_code()
returns text
language plpgsql
volatile
as $$
declare
  adjs text[] := array[
    'BRAVE','COOL','EPIC','FAST','GLAD','HAPPY','HUGE','JOLLY',
    'KIND','LUSH','MEGA','NEON','PROUD','QUICK','RADIANT','SHARP',
    'SWIFT','TALL','ULTRA','VIVID','WILD','ZESTY'
  ];
  nouns text[] := array[
    'BEAR','BIRD','CAT','CLOUD','DRAGON','EAGLE','FOX','FROG',
    'HAWK','HORSE','LION','MOON','PANDA','PLANET','RABBIT','ROCKET',
    'SHARK','STAR','TIGER','UNICORN','WOLF','ZEBRA'
  ];
begin
  return adjs[1 + floor(random() * array_length(adjs, 1))::int]
    || '-' || nouns[1 + floor(random() * array_length(nouns, 1))::int]
    || '-' || lpad(floor(random() * 10000)::text, 4, '0');
end;
$$;

create or replace function contains_profanity(p_input text)
returns boolean
language plpgsql
immutable
as $$
declare
  blocked text[] := array[
    'ass','damn','hell','crap','shit','fuck','bitch','piss',
    'butt','sex','porn','kill','nazi','dick','cock','tit'
  ];
  separated text;
  tok text;
begin
  if p_input is null or length(p_input) = 0 then
    return false;
  end if;

  separated := regexp_replace(p_input, '([a-z])([A-Z])', '\1 \2', 'g');

  for tok in
    select lower(t) from regexp_split_to_table(separated, '[^a-zA-Z]+') as t
    where t <> ''
  loop
    if tok = any(blocked) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function lockout_interval(p_failed_attempts integer)
returns interval
language sql
immutable
as $$
  select case
    when p_failed_attempts >= 10 then interval '24 hours'
    when p_failed_attempts >= 8  then interval '5 minutes'
    when p_failed_attempts >= 5  then interval '1 minute'
    else null
  end;
$$;

create or replace function issue_token(p_profile_id uuid)
returns text
language sql
volatile
as $$
  select 'sb-' || p_profile_id::text || '-' || md5(random()::text);
$$;

-- =============================================================================
-- RPCs
--
-- Error contract: exceptions whose MESSAGE starts with a hint code in
-- square brackets, e.g. "[TAKEN] Username already in use". Clients
-- pattern-match on the prefix:
--   [INVALID] [PROFANITY] [TAKEN] [WRONG_CREDENTIALS] [WRONG_RECOVERY] [LOCKED]
-- =============================================================================

create or replace function rpc_check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(p_username)
  );
$$;

create or replace function rpc_signup(
  p_username text,
  p_pin      text,
  p_avatar   text,
  p_age_band text
)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_id            uuid;
  v_salt          text;
  v_pin_hash      text;
  v_recovery_code text;
  v_recovery_hash text;
  v_token         text;
begin
  if p_username is null or length(p_username) < 3 or length(p_username) > 20 then
    raise exception '[INVALID] Username must be 3-20 characters';
  end if;

  if p_age_band not in ('3-5', '6-8') then
    raise exception '[INVALID] Age band must be 3-5 or 6-8';
  end if;

  if p_pin is null or length(p_pin) = 0 then
    raise exception '[INVALID] PIN is required';
  end if;

  if contains_profanity(p_username) then
    raise exception '[PROFANITY] Username contains a blocked word';
  end if;

  if exists (select 1 from profiles where lower(username) = lower(p_username)) then
    raise exception '[TAKEN] Username "%" is already taken', p_username;
  end if;

  v_id            := gen_random_uuid();
  v_salt          := generate_salt();
  v_pin_hash      := sha256_hex(p_pin || v_salt);
  v_recovery_code := generate_recovery_code();
  v_recovery_hash := sha256_hex(v_recovery_code || v_salt);

  insert into profiles (
    id, username, avatar, age_band,
    pin_hash, salt, recovery_hash,
    failed_attempts, locked_until
  ) values (
    v_id, p_username, p_avatar, p_age_band,
    v_pin_hash, v_salt, v_recovery_hash,
    0, null
  );

  v_token := issue_token(v_id);

  return json_build_object(
    'profile_id',    v_id,
    'username',      p_username,
    'avatar',        p_avatar,
    'age_band',      p_age_band,
    'recovery_code', v_recovery_code,
    'token',         v_token
  );
end;
$$;

create or replace function rpc_login(
  p_username text,
  p_pin      text
)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_row     profiles%rowtype;
  v_attempt text;
  v_lock    interval;
  v_token   text;
begin
  select * into v_row from profiles where lower(username) = lower(p_username) limit 1;

  if not found then
    raise exception '[WRONG_CREDENTIALS] Invalid username or PIN';
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    raise exception '[LOCKED] Account is locked until %',
      to_char(v_row.locked_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if v_row.locked_until is not null and v_row.locked_until <= now() then
    update profiles set locked_until = null, failed_attempts = 0 where id = v_row.id;
    v_row.locked_until := null;
    v_row.failed_attempts := 0;
  end if;

  v_attempt := sha256_hex(p_pin || v_row.salt);

  if v_attempt <> v_row.pin_hash then
    v_row.failed_attempts := v_row.failed_attempts + 1;
    v_lock := lockout_interval(v_row.failed_attempts);
    update profiles
       set failed_attempts = v_row.failed_attempts,
           locked_until    = case when v_lock is not null then now() + v_lock else locked_until end
     where id = v_row.id;
    raise exception '[WRONG_CREDENTIALS] Invalid username or PIN';
  end if;

  update profiles set failed_attempts = 0, locked_until = null where id = v_row.id;
  v_token := issue_token(v_row.id);

  return json_build_object(
    'profile_id', v_row.id,
    'username',   v_row.username,
    'avatar',     v_row.avatar,
    'age_band',   v_row.age_band,
    'token',      v_token
  );
end;
$$;

create or replace function rpc_recover_pin(
  p_username      text,
  p_recovery_code text,
  p_new_pin       text
)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_row            profiles%rowtype;
  v_attempt        text;
  v_lock           interval;
  v_new_recovery   text;
  v_new_recovery_h text;
  v_new_pin_hash   text;
begin
  if p_new_pin is null or length(p_new_pin) = 0 then
    raise exception '[INVALID] New PIN is required';
  end if;

  select * into v_row from profiles where lower(username) = lower(p_username) limit 1;

  if not found then
    raise exception '[WRONG_RECOVERY] Username or recovery code is incorrect';
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    raise exception '[LOCKED] Account is locked until %',
      to_char(v_row.locked_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if v_row.locked_until is not null and v_row.locked_until <= now() then
    update profiles set locked_until = null, failed_attempts = 0 where id = v_row.id;
    v_row.locked_until := null;
    v_row.failed_attempts := 0;
  end if;

  v_attempt := sha256_hex(p_recovery_code || v_row.salt);

  if v_attempt <> v_row.recovery_hash then
    v_row.failed_attempts := v_row.failed_attempts + 1;
    v_lock := lockout_interval(v_row.failed_attempts);
    update profiles
       set failed_attempts = v_row.failed_attempts,
           locked_until    = case when v_lock is not null then now() + v_lock else locked_until end
     where id = v_row.id;
    raise exception '[WRONG_RECOVERY] Username or recovery code is incorrect';
  end if;

  v_new_recovery   := generate_recovery_code();
  v_new_pin_hash   := sha256_hex(p_new_pin || v_row.salt);
  v_new_recovery_h := sha256_hex(v_new_recovery || v_row.salt);

  update profiles
     set pin_hash        = v_new_pin_hash,
         recovery_hash   = v_new_recovery_h,
         failed_attempts = 0,
         locked_until    = null
   where id = v_row.id;

  return json_build_object('recovery_code', v_new_recovery);
end;
$$;

-- =============================================================================
-- RLS — default-deny on profiles (no anon/authenticated policy at all)
-- =============================================================================

alter table profiles enable row level security;

-- =============================================================================
-- Grants
-- =============================================================================

grant execute on function rpc_check_username_available(text) to anon, authenticated;
grant execute on function rpc_signup(text, text, text, text)  to anon, authenticated;
grant execute on function rpc_login(text, text)                to anon, authenticated;
grant execute on function rpc_recover_pin(text, text, text)    to anon, authenticated;
