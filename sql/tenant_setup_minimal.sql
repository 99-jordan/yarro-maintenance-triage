-- Minimal tenant setup for testing
-- Run this in your Supabase SQL editor

-- 1. Create tenancies table
CREATE TABLE IF NOT EXISTS public.tenancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    landlord_id UUID NOT NULL REFERENCES public.landlords(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    rent_amount_pennies INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, property_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Create tenant_tickets table
CREATE TABLE IF NOT EXISTS public.tenant_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    landlord_id UUID NOT NULL REFERENCES public.landlords(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    severity TEXT DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'urgent')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create tenant_messages table
CREATE TABLE IF NOT EXISTS public.tenant_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tenant_tickets(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Add tenant role to existing profiles if not exists
-- First, let's update one of your @tenant.com users to have the tenant role
-- Replace 'your-tenant-email@tenant.com' with the actual email you're testing with

-- Example: Update profile for a specific tenant email
-- UPDATE public.profiles 
-- SET role = 'tenant'::user_role 
-- WHERE email = 'lucy@tenant.com';

-- 5. RLS Policies for tenancies
DROP POLICY IF EXISTS "tenancies_tenant_read" ON public.tenancies;
CREATE POLICY "tenancies_tenant_read" ON public.tenancies
    FOR SELECT
    USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenancies_agent_read" ON public.tenancies;
CREATE POLICY "tenancies_agent_read" ON public.tenancies
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('agent', 'owner')
            AND p.agency_id = tenancies.agency_id
        )
    );

-- 6. RLS Policies for tenant_tickets
DROP POLICY IF EXISTS "tenant_tickets_tenant_access" ON public.tenant_tickets;
CREATE POLICY "tenant_tickets_tenant_access" ON public.tenant_tickets
    FOR ALL
    USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "tenant_tickets_agent_read" ON public.tenant_tickets;
CREATE POLICY "tenant_tickets_agent_read" ON public.tenant_tickets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('agent', 'owner')
            AND p.agency_id = tenant_tickets.agency_id
        )
    );

-- 7. RLS Policies for tenant_messages
DROP POLICY IF EXISTS "tenant_messages_participants_access" ON public.tenant_messages;
CREATE POLICY "tenant_messages_participants_access" ON public.tenant_messages
    FOR ALL
    USING (
        sender_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tenant_tickets tt
            WHERE tt.id = tenant_messages.ticket_id
            AND (tt.tenant_id = auth.uid() OR
                 EXISTS (
                     SELECT 1 FROM public.profiles p
                     WHERE p.id = auth.uid()
                     AND p.role IN ('agent', 'owner')
                     AND p.agency_id = tt.agency_id
                 ))
        )
    );

-- 8. Enable RLS
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_messages ENABLE ROW LEVEL SECURITY;

-- 9. Sample tenant assignment (modify with actual IDs from your database)
-- You'll need to replace these UUIDs with actual ones from your database
-- 
-- INSERT INTO public.tenancies (
--     agency_id, 
--     tenant_id, 
--     property_id, 
--     landlord_id, 
--     agent_id,
--     is_active
-- ) VALUES (
--     (SELECT id FROM public.agencies LIMIT 1),
--     (SELECT id FROM public.profiles WHERE email = 'lucy@tenant.com'),
--     (SELECT id FROM public.properties LIMIT 1),
--     (SELECT id FROM public.landlords LIMIT 1),
--     (SELECT id FROM public.profiles WHERE role = 'agent' LIMIT 1),
--     true
-- );

-- To set up a specific tenant, run this after the above:
-- 1. Find your tenant's UUID: SELECT id, email FROM public.profiles WHERE email LIKE '%@tenant.com';
-- 2. Update their role: UPDATE public.profiles SET role = 'tenant'::user_role WHERE email = 'your-email@tenant.com';
-- 3. Create tenancy record with real IDs from your database

GRANT ALL ON public.tenancies TO anon, authenticated;
GRANT ALL ON public.tenant_tickets TO anon, authenticated;
GRANT ALL ON public.tenant_messages TO anon, authenticated;
