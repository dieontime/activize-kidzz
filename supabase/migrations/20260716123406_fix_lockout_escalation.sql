-- Fix: lockout escalation was dead code.
--
-- rpc_login and rpc_recover_pin both reset failed_attempts to 0 whenever
-- an expired lock was cleared, so an account could never accumulate past
-- the first lockout tier -- lockout_interval's 5-minute (>=8) and 24-hour
-- (>=10) tiers were unreachable, contradicting the spec's stated
-- escalation ladder (5->1min, 8->5min, 10->24h). Fixed by clearing only
-- locked_until on expiry; failed_attempts now only resets on a
-- successful login/recovery. Caught during the final whole-branch review
-- of Plan 2, mirrored from the equivalent fix already applied to
-- mockBackend.ts.
--
-- Also tightens the anon-execute surface: the helper functions below
-- (sha256_hex, generate_salt, generate_recovery_code, contains_profanity,
-- lockout_interval, issue_token) are not SECURITY DEFINER and never had
-- an explicit grant, so Postgres's create-time default left them
-- callable directly by anon/authenticated via the PostgREST RPC
-- endpoint. None of them read profiles or leak credential material, but
-- this closes the unintended surface area.

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
    -- Clear the expired lock but keep failed_attempts so the ladder can
    -- actually escalate across repeated windows.
    update profiles set locked_until = null where id = v_row.id;
    v_row.locked_until := null;
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
    -- Same escalation fix as rpc_login: clear the expired lock, keep the count.
    update profiles set locked_until = null where id = v_row.id;
    v_row.locked_until := null;
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
-- Tighten anon-execute surface on internal helper functions
-- =============================================================================

revoke execute on function sha256_hex(text) from public;
revoke execute on function generate_salt() from public;
revoke execute on function generate_recovery_code() from public;
revoke execute on function contains_profanity(text) from public;
revoke execute on function lockout_interval(integer) from public;
revoke execute on function issue_token(uuid) from public;
