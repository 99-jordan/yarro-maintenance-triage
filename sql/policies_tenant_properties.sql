-- Allow tenants to read their assigned property
-- Run this in Supabase SQL editor

-- Ensure RLS is enabled on properties (safe if already enabled)
alter table public.properties enable row level security;

-- Replace existing policy (if any) for tenant property read
drop policy if exists "tenant can read assigned property" on public.properties;
create policy "tenant can read assigned property"
on public.properties
for select
to authenticated
using (
  exists (
    select 1 from public.tenancies t
    where t.property_id = properties.id
      and t.tenant_id = auth.uid()
      and t.is_active
  )
);
