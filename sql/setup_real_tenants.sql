-- Setup real tenants with actual UUIDs from your system
-- Run this in Supabase SQL Editor

-- 1. First, update all @tenant.com users to have tenant role
UPDATE public.profiles 
SET role = 'tenant'::user_role 
WHERE email IN (
    'lucy@tenant.com',
    'peter@tenant.com', 
    'katie@tenant.com',
    'louise@tenant.com',
    'adam@tenant.com',
    'peter@tenant.com',
    'olly@tenant.com',
    'lenny@tenant.com',
    'henrik@tenant.com',
    'ken@tenant.com',
    'ben@tenant.com',
    'jack@tenant.com',
    'samantha@tenant.com'
);

-- 2. Get information we need for tenancy setup
-- Let's see what agencies, properties, landlords, and agents exist
SELECT 'AGENCIES:' as type, id, name FROM public.agencies LIMIT 5;
SELECT 'PROPERTIES:' as type, id, address_line1, city FROM public.properties LIMIT 10;
SELECT 'LANDLORDS:' as type, id, name, email FROM public.landlords LIMIT 10;
SELECT 'AGENTS:' as type, id, full_name, email FROM public.profiles WHERE role IN ('agent', 'owner') LIMIT 10;

-- 3. Create tenancy records for each tenant
-- I'll assign them to random properties and agents (you can modify these as needed)

-- Let's create a function to safely insert tenancies
CREATE OR REPLACE FUNCTION create_tenant_assignment(
    p_tenant_email TEXT,
    p_tenant_id UUID
) RETURNS VOID AS $$
DECLARE
    v_agency_id UUID;
    v_property_id UUID;
    v_landlord_id UUID;
    v_agent_id UUID;
BEGIN
    -- Get a random agency
    SELECT id INTO v_agency_id FROM public.agencies LIMIT 1;
    
    -- Get a random property
    SELECT id INTO v_property_id FROM public.properties 
    WHERE agency_id = v_agency_id 
    ORDER BY RANDOM() LIMIT 1;
    
    -- If no property found for that agency, get any property
    IF v_property_id IS NULL THEN
        SELECT id, agency_id INTO v_property_id, v_agency_id 
        FROM public.properties ORDER BY RANDOM() LIMIT 1;
    END IF;
    
    -- Get landlord for this property
    SELECT landlord_id INTO v_landlord_id 
    FROM public.properties 
    WHERE id = v_property_id;
    
    -- Get a random agent from the same agency
    SELECT id INTO v_agent_id 
    FROM public.profiles 
    WHERE role IN ('agent', 'owner') 
    AND agency_id = v_agency_id 
    ORDER BY RANDOM() LIMIT 1;
    
    -- If no agent found for that agency, get any agent
    IF v_agent_id IS NULL THEN
        SELECT id INTO v_agent_id 
        FROM public.profiles 
        WHERE role IN ('agent', 'owner') 
        ORDER BY RANDOM() LIMIT 1;
    END IF;
    
    -- Insert the tenancy record
    INSERT INTO public.tenancies (
        agency_id,
        tenant_id,
        property_id,
        landlord_id,
        agent_id,
        is_active
    ) VALUES (
        v_agency_id,
        p_tenant_id,
        v_property_id,
        v_landlord_id,
        v_agent_id,
        true
    ) ON CONFLICT (tenant_id, property_id, is_active) DO NOTHING;
    
    RAISE NOTICE 'Created tenancy for % with property % and agent %', p_tenant_email, v_property_id, v_agent_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create tenancy for %: %', p_tenant_email, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 4. Create tenancy assignments for all tenant users
SELECT create_tenant_assignment('lucy@tenant.com', 'd4c769fa-c90a-464f-9ffa-ddab3dca6f47');
SELECT create_tenant_assignment('peter@tenant.com', '9d39833d-f7aa-4a3d-88a7-a20a7d929f18');
SELECT create_tenant_assignment('katie@tenant.com', '8cf5f513-6367-485f-88a7-f266ddad19f4');
SELECT create_tenant_assignment('louise@tenant.com', 'dd007f7f-f5b0-4a26-a881-5c8bd39b79f');
SELECT create_tenant_assignment('adam@tenant.com', '9b29e236-5410-486f-80fb-4b70d3b63b38');
SELECT create_tenant_assignment('peter@tenant.com', '12f545f9-cf26-430e-82b2-1d5b4ad2c2f7f');
SELECT create_tenant_assignment('olly@tenant.com', '2f55f762e-2f81-4df8-a8af-ae60a8ff05c2');
SELECT create_tenant_assignment('lenny@tenant.com', '8ab296bb-f2bb-4253-8d7a-f79da795bb2ff');
SELECT create_tenant_assignment('henrik@tenant.com', '91579ff1-0b0e-4dd0-8641-f7f202fe3666');
SELECT create_tenant_assignment('ken@tenant.com', '81844aa5-50e0-4277-b39f-9f3e8f437b0a');
SELECT create_tenant_assignment('ben@tenant.com', 'a08a0907-2da9-4800-3c3a-3cabaca90d90');
SELECT create_tenant_assignment('jack@tenant.com', '2d3fcb6e-281a-4834-89d4-e4f0af82da96');
SELECT create_tenant_assignment('samantha@tenant.com', 'b466c3fd-990c-4d27-8630-5d23fc59e56c');

-- 5. Verify the setup worked
SELECT 
    t.id as tenancy_id,
    p.email as tenant_email,
    pr.address_line1 as property_address,
    pr.city,
    l.name as landlord_name,
    a.full_name as agent_name
FROM public.tenancies t
JOIN public.profiles p ON t.tenant_id = p.id
JOIN public.properties pr ON t.property_id = pr.id
JOIN public.landlords l ON t.landlord_id = l.id
LEFT JOIN public.profiles a ON t.agent_id = a.id
WHERE p.email LIKE '%@tenant.com'
ORDER BY p.email;

-- 6. Clean up the function
DROP FUNCTION create_tenant_assignment(TEXT, UUID);
