-- Fix: the prior migration's REVOKE targeted PUBLIC, but a live check
-- (calling contains_profanity directly via the anon key after applying
-- it) showed the function was still callable. Supabase provisions
-- explicit EXECUTE grants to anon/authenticated directly at project
-- setup (not merely via the PUBLIC pseudo-role), so "revoke ... from
-- public" doesn't touch those. Revoking from the actual roles instead,
-- matching how this file's own GRANT statements already target
-- "anon, authenticated" explicitly rather than PUBLIC.

revoke execute on function sha256_hex(text) from anon, authenticated;
revoke execute on function generate_salt() from anon, authenticated;
revoke execute on function generate_recovery_code() from anon, authenticated;
revoke execute on function contains_profanity(text) from anon, authenticated;
revoke execute on function lockout_interval(integer) from anon, authenticated;
revoke execute on function issue_token(uuid) from anon, authenticated;
