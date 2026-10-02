-- =============================================================================
-- Administrator credentials
--
-- Creates the platform administrator if it does not exist, and resets its
-- password if it does. Safe to re-run: the whole block is idempotent.
--
-- The password itself is never stored here. Only its bcrypt hash (cost 10) is,
-- which is the same format Supabase Auth writes when a user sets a password.
--
-- To rotate the password later, prefer Admin → My admin account, or run the
-- `update` at the bottom of this file with a freshly generated hash. Do not
-- commit the plaintext password to this repository.
-- =============================================================================

do $$
declare
  admin_id       constant uuid := 'a0000000-0000-4000-8000-000000000001';
  admin_email    constant text := 'nnamaniafamefuna@gmail.com';
  admin_username constant text := 'admin';
  -- bcrypt($2a$, cost 10)
  admin_hash     constant text := '$2a$10$n1vWQkX4bLojAc2IJJ6Oxec4YBp3qUpG7daNuGd2aPum1w/FMobYO';
  existing_id    uuid;
begin
  select id into existing_id from auth.users where lower(email) = admin_email;

  if existing_id is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      admin_email, admin_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Platform Administrator"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    existing_id := admin_id;
  else
    -- Reset the password and make sure the account can sign in.
    update auth.users
       set encrypted_password = admin_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until       = null,
           deleted_at         = null,
           updated_at         = now()
     where id = existing_id;
  end if;

  -- An email identity is required for password sign-in.
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), existing_id, existing_id::text,
         jsonb_build_object('sub', existing_id::text, 'email', admin_email, 'email_verified', true),
         'email', now(), now(), now()
  where not exists (
    select 1 from auth.identities where user_id = existing_id and provider = 'email'
  );

  -- The on_auth_user_created trigger makes the profile, but create it here too
  -- so this migration also repairs an account whose profile row went missing.
  insert into public.profiles (id, email, full_name)
  values (existing_id, admin_email, 'Platform Administrator')
  on conflict (id) do nothing;

  -- Username is unique, so release it from any other row before claiming it.
  update public.profiles set username = null
   where username = admin_username and id <> existing_id;

  update public.profiles
     set role         = 'admin',
         email        = admin_email,
         username     = admin_username,
         full_name    = coalesce(nullif(trim(full_name), ''), 'Platform Administrator'),
         onboarded_at = coalesce(onboarded_at, now())
   where id = existing_id;

  raise notice 'Administrator ready: % (username %)', admin_email, admin_username;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rotating the password later, without committing anything
-- -----------------------------------------------------------------------------
-- 1. Generate a hash (pgcrypto is already installed by the initial migration):
--
--      select extensions.crypt('<new password>', extensions.gen_salt('bf', 10));
--
-- 2. Apply it:
--
--      update auth.users
--         set encrypted_password = '<hash from step 1>', updated_at = now()
--       where email = 'nnamaniafamefuna@gmail.com';
--
-- Run both in the Supabase SQL editor rather than in a migration file, so the
-- new hash never reaches version control.
