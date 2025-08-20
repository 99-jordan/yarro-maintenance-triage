-- Comprehensive Multi-Tenant Onboarding Migration
-- Adds invite tables, helper functions, triggers, RLS policies, and onboarding RPCs

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================
-- 1) AGENCY STATUS ENHANCEMENT
-- =====================================

-- Add status to agencies table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agencies' AND column_name = 'status') THEN
    ALTER TABLE public.agencies ADD COLUMN status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'live', 'suspended'));
  END IF;
END $$;

-- =====================================
-- 2) INVITE TABLES
-- =====================================

-- Agent invites table
CREATE TABLE IF NOT EXISTS public.agent_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent')),
  passcode_hash TEXT NOT NULL, -- bcrypt hash of the passcode
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email, agency_id) DEFERRABLE INITIALLY DEFERRED
);

-- Tenant invites table
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  passcode_hash TEXT NOT NULL, -- bcrypt hash of the passcode
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '30 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email, property_id) DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_invites_agency ON public.agent_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_agent_invites_email ON public.agent_invites(email);
CREATE INDEX IF NOT EXISTS idx_agent_invites_status ON public.agent_invites(status);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_agency ON public.tenant_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_property ON public.tenant_invites(property_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON public.tenant_invites(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_status ON public.tenant_invites(status);

-- Enable RLS
ALTER TABLE public.agent_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- =====================================
-- 3) HELPER FUNCTIONS
-- =====================================

-- Function to hash passcodes using bcrypt
CREATE OR REPLACE FUNCTION hash_passcode(passcode TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pgcrypto's crypt function with bcrypt
  RETURN crypt(passcode, gen_salt('bf'));
END;
$$;

-- Function to verify passcodes
CREATE OR REPLACE FUNCTION verify_passcode(passcode TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(passcode, hash) = hash;
END;
$$;

-- Function to generate random passcode
CREATE OR REPLACE FUNCTION generate_passcode()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Generate 8-character alphanumeric passcode
  RETURN upper(substr(md5(random()::text), 1, 8));
END;
$$;

-- Function to set agency_id from profile (trigger function)
CREATE OR REPLACE FUNCTION set_agency_id_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_agency_id UUID;
BEGIN
  -- Get the agency_id from the user's profile
  SELECT agency_id INTO user_agency_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF user_agency_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found or no agency associated';
  END IF;
  
  -- Set the agency_id in the NEW record
  NEW.agency_id = user_agency_id;
  
  RETURN NEW;
END;
$$;

-- =====================================
-- 4) TRIGGERS
-- =====================================

-- Trigger to auto-set agency_id on agent invites
DROP TRIGGER IF EXISTS tr_agent_invites_set_agency ON public.agent_invites;
CREATE TRIGGER tr_agent_invites_set_agency
  BEFORE INSERT ON public.agent_invites
  FOR EACH ROW
  EXECUTE FUNCTION set_agency_id_from_profile();

-- Trigger to auto-set agency_id on tenant invites
DROP TRIGGER IF EXISTS tr_tenant_invites_set_agency ON public.tenant_invites;
CREATE TRIGGER tr_tenant_invites_set_agency
  BEFORE INSERT ON public.tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION set_agency_id_from_profile();

-- =====================================
-- 5) RLS POLICIES
-- =====================================

-- Agent invites policies
DROP POLICY IF EXISTS "agent_invites_select_policy" ON public.agent_invites;
CREATE POLICY "agent_invites_select_policy" ON public.agent_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.agency_id = agent_invites.agency_id
      AND p.role IN ('owner', 'agent')
    )
  );

DROP POLICY IF EXISTS "agent_invites_insert_policy" ON public.agent_invites;
CREATE POLICY "agent_invites_insert_policy" ON public.agent_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.agency_id = agent_invites.agency_id
      AND p.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "agent_invites_update_policy" ON public.agent_invites;
CREATE POLICY "agent_invites_update_policy" ON public.agent_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.agency_id = agent_invites.agency_id
      AND p.role = 'owner'
    )
  );

-- Tenant invites policies
DROP POLICY IF EXISTS "tenant_invites_select_policy" ON public.tenant_invites;
CREATE POLICY "tenant_invites_select_policy" ON public.tenant_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.agency_id = tenant_invites.agency_id
      AND p.role IN ('owner', 'agent')
    )
  );

DROP POLICY IF EXISTS "tenant_invites_insert_policy" ON public.tenant_invites;
CREATE POLICY "tenant_invites_insert_policy" ON public.tenant_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.agency_id = tenant_invites.agency_id
      AND p.role IN ('owner', 'agent')
    )
  );

DROP POLICY IF EXISTS "tenant_invites_update_policy" ON public.tenant_invites;
CREATE POLICY "tenant_invites_update_policy" ON public.tenant_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.agency_id = tenant_invites.agency_id
      AND p.role IN ('owner', 'agent')
    )
  );

-- =====================================
-- 6) ONBOARDING RPC FUNCTIONS
-- =====================================

-- Agency owner signup
CREATE OR REPLACE FUNCTION signup_agency_owner(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_agency_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  new_agency_id UUID;
  agency_slug TEXT;
BEGIN
  -- Create agency slug
  agency_slug := lower(regexp_replace(p_agency_name, '[^a-zA-Z0-9]+', '-', 'g'));
  agency_slug := trim(both '-' from agency_slug);
  
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM public.agencies WHERE slug = agency_slug) LOOP
    agency_slug := agency_slug || '-' || substr(md5(random()::text), 1, 4);
  END LOOP;
  
  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create agency
  INSERT INTO public.agencies (name, slug, status)
  VALUES (p_agency_name, agency_slug, 'setup')
  RETURNING id INTO new_agency_id;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    agency_id,
    full_name,
    role,
    signature_id,
    managed_properties,
    permissions,
    is_active
  ) VALUES (
    new_user_id,
    new_agency_id,
    p_full_name,
    'owner',
    upper(substr(agency_slug, 1, 3)) || '-' || upper(substr(p_full_name, 1, 2)) || '-1',
    '[]',
    '{"full_access": true}',
    true
  );

  RETURN json_build_object(
    'success', true,
    'user_id', new_user_id,
    'agency_id', new_agency_id,
    'slug', agency_slug
  );
END;
$$;

-- Agent join function
CREATE OR REPLACE FUNCTION join_agency_as_agent(
  p_email TEXT,
  p_passcode TEXT,
  p_full_name TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
  agency_record RECORD;
  new_user_id UUID;
BEGIN
  -- Find and validate invite
  SELECT ai.*, a.status as agency_status, a.name as agency_name, a.slug as agency_slug
  INTO invite_record
  FROM public.agent_invites ai
  JOIN public.agencies a ON ai.agency_id = a.id
  WHERE ai.email = p_email
    AND ai.status = 'pending'
    AND ai.expires_at > now()
    AND verify_passcode(p_passcode, ai.passcode_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or passcode, or invitation expired';
  END IF;

  -- Check if agency is live
  IF invite_record.agency_status != 'live' THEN
    RAISE EXCEPTION 'Agency is not live and cannot accept new team members';
  END IF;

  -- Create user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    agency_id,
    full_name,
    role,
    signature_id,
    managed_properties,
    permissions,
    is_active
  ) VALUES (
    new_user_id,
    invite_record.agency_id,
    p_full_name,
    invite_record.role,
    upper(substr(invite_record.agency_slug, 1, 3)) || '-' || upper(substr(p_full_name, 1, 2)) || '-' || (
      SELECT count(*) + 1 FROM public.profiles WHERE agency_id = invite_record.agency_id
    ),
    '[]',
    '{"basic_access": true}',
    true
  );

  -- Mark invite as accepted
  UPDATE public.agent_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = invite_record.id;

  RETURN json_build_object(
    'success', true,
    'user_id', new_user_id,
    'agency_id', invite_record.agency_id,
    'agency_name', invite_record.agency_name
  );
END;
$$;

-- Tenant join function
CREATE OR REPLACE FUNCTION join_as_tenant(
  p_email TEXT,
  p_passcode TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
  new_user_id UUID;
BEGIN
  -- Find and validate invite
  SELECT ti.*, p.address_line1, p.city, a.name as agency_name
  INTO invite_record
  FROM public.tenant_invites ti
  JOIN public.properties p ON ti.property_id = p.id
  JOIN public.agencies a ON ti.agency_id = a.id
  WHERE ti.email = p_email
    AND ti.status = 'pending'
    AND ti.expires_at > now()
    AND verify_passcode(p_passcode, ti.passcode_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or passcode, or invitation expired';
  END IF;

  -- Create user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    agency_id,
    full_name,
    role,
    signature_id,
    managed_properties,
    permissions,
    is_active
  ) VALUES (
    new_user_id,
    invite_record.agency_id,
    split_part(p_email, '@', 1), -- Use email prefix as name initially
    'tenant',
    'TEN-' || substr(new_user_id::text, 1, 6),
    '[]',
    '{"tenant_access": true}',
    true
  );

  -- Create tenancy record
  INSERT INTO public.tenancies (
    agency_id,
    tenant_id,
    property_id,
    landlord_id,
    start_date,
    is_active
  )
  SELECT 
    invite_record.agency_id,
    new_user_id,
    invite_record.property_id,
    p.landlord_id,
    now()::date,
    true
  FROM public.properties p
  WHERE p.id = invite_record.property_id;

  -- Mark invite as accepted
  UPDATE public.tenant_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = invite_record.id;

  RETURN json_build_object(
    'success', true,
    'user_id', new_user_id,
    'property_address', invite_record.address_line1 || ', ' || invite_record.city,
    'agency_name', invite_record.agency_name
  );
END;
$$;

-- Agent onboarding completion
CREATE OR REPLACE FUNCTION complete_agent_onboarding(
  p_position TEXT,
  p_phone TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_specializations TEXT[] DEFAULT '{}',
  p_preferred_areas TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get current user profile
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Update profile with onboarding data
  UPDATE public.profiles
  SET 
    position = p_position,
    preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object(
      'phone', p_phone,
      'bio', p_bio,
      'specializations', to_jsonb(p_specializations),
      'preferred_areas', p_preferred_areas,
      'onboarding_completed', true,
      'onboarding_completed_at', now()
    ),
    updated_at = now()
  WHERE id = auth.uid();

  RETURN json_build_object(
    'success', true,
    'message', 'Onboarding completed successfully'
  );
END;
$$;

-- =====================================
-- 7) INVITE MANAGEMENT RPC FUNCTIONS
-- =====================================

-- Create agent invite
CREATE OR REPLACE FUNCTION create_agent_invite(
  p_email TEXT,
  p_role TEXT DEFAULT 'agent'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  user_profile RECORD;
  new_passcode TEXT;
  passcode_hash TEXT;
  invite_id UUID;
BEGIN
  -- Get current user profile and verify they're an owner
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'owner';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only agency owners can create invites';
  END IF;

  -- Check if invite already exists for this email
  IF EXISTS (
    SELECT 1 FROM public.agent_invites 
    WHERE email = p_email 
    AND agency_id = user_profile.agency_id 
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists for this email';
  END IF;

  -- Generate passcode and hash it
  new_passcode := generate_passcode();
  passcode_hash := hash_passcode(new_passcode);

  -- Create invite
  INSERT INTO public.agent_invites (
    email,
    role,
    passcode_hash,
    created_by
  ) VALUES (
    p_email,
    p_role,
    passcode_hash,
    auth.uid()
  ) RETURNING id INTO invite_id;

  RETURN json_build_object(
    'success', true,
    'invite_id', invite_id,
    'passcode', new_passcode,
    'email', p_email
  );
END;
$$;

-- List agent invites
CREATE OR REPLACE FUNCTION list_agent_invites()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  passcode TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get current user profile
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Only owners can list invites
  IF user_profile.role != 'owner' THEN
    RAISE EXCEPTION 'Only agency owners can list invites';
  END IF;

  RETURN QUERY
  SELECT 
    ai.id,
    ai.email,
    ai.role,
    '********' as passcode, -- Don't return actual passcode
    ai.status,
    ai.created_at,
    ai.expires_at,
    ai.accepted_at
  FROM public.agent_invites ai
  WHERE ai.agency_id = user_profile.agency_id
  ORDER BY ai.created_at DESC;
END;
$$;

-- Revoke agent invite
CREATE OR REPLACE FUNCTION revoke_agent_invite(p_invite_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get current user profile
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'owner';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only agency owners can revoke invites';
  END IF;

  -- Revoke the invite
  UPDATE public.agent_invites
  SET status = 'revoked'
  WHERE id = p_invite_id 
    AND agency_id = user_profile.agency_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or cannot be revoked';
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Validate agent invite (for join form)
CREATE OR REPLACE FUNCTION validate_agent_invite(
  p_email TEXT,
  p_passcode TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  SELECT ai.*, a.name, a.status
  INTO invite_record
  FROM public.agent_invites ai
  JOIN public.agencies a ON ai.agency_id = a.id
  WHERE ai.email = p_email
    AND ai.status = 'pending'
    AND ai.expires_at > now()
    AND verify_passcode(p_passcode, ai.passcode_hash);

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'name', invite_record.name,
    'status', invite_record.status
  );
END;
$$;

-- Validate tenant invite (for join form)
CREATE OR REPLACE FUNCTION validate_tenant_invite(
  p_email TEXT,
  p_passcode TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  SELECT 
    ti.*,
    p.address_line1 || COALESCE(', ' || p.address_line2, '') || ', ' || p.city as address,
    a.name as agency,
    prof.full_name as agent
  INTO invite_record
  FROM public.tenant_invites ti
  JOIN public.properties p ON ti.property_id = p.id
  JOIN public.agencies a ON ti.agency_id = a.id
  LEFT JOIN public.profiles prof ON p.letting_agent = prof.id
  WHERE ti.email = p_email
    AND ti.status = 'pending'
    AND ti.expires_at > now()
    AND verify_passcode(p_passcode, ti.passcode_hash);

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'address', invite_record.address,
    'agency', invite_record.agency,
    'agent', invite_record.agent
  );
END;
$$;

-- Get user agency (for ProfileProvider)
CREATE OR REPLACE FUNCTION get_user_agency()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get current user profile
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.slug,
    a.status,
    a.created_at,
    a.updated_at
  FROM public.agencies a
  WHERE a.id = user_profile.agency_id;
END;
$$;

-- =====================================
-- 8) GRANT PERMISSIONS
-- =====================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION hash_passcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_passcode(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_passcode() TO authenticated;
GRANT EXECUTE ON FUNCTION signup_agency_owner(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION join_agency_as_agent(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION join_as_tenant(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION complete_agent_onboarding(TEXT, TEXT, TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_agent_invite(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_agent_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_agent_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_agent_invite(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_tenant_invite(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_agency() TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.agent_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_invites TO authenticated;

COMMIT;
