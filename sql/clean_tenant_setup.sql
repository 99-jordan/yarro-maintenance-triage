-- TENANT PORTAL: MAIN SETUP (STEP 2)
-- IMPORTANT: Run step1_enum_update.sql FIRST, then run this file!

-- =====================================
-- 1) SCHEMA CHANGES
-- =====================================

-- Enable extension if not present (for gen_random_uuid)
create extension if not exists pgcrypto;

-- 1.1) Tenancies table
create table if not exists public.tenancies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  agent_id uuid references public.profiles (id) on delete set null,
  start_date date not null default now(),
  end_date date,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_tenancies_tenant on public.tenancies (tenant_id) where is_active;
create index if not exists idx_tenancies_property on public.tenancies (property_id) where is_active;
create index if not exists idx_tenancies_agency on public.tenancies (agency_id);
create unique index if not exists uniq_tenancies_active_per_tenant on public.tenancies (tenant_id) where is_active;

alter table public.tenancies enable row level security;

-- 1.2) Tenant tickets table
create table if not exists public.tenant_tickets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  agent_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text not null,
  status text not null default 'open',
  severity text not null default 'normal',
  created_by uuid not null references public.profiles (id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_tenant_tickets_tenant on public.tenant_tickets (tenant_id);
create index if not exists idx_tenant_tickets_property on public.tenant_tickets (property_id);
create index if not exists idx_tenant_tickets_agency on public.tenant_tickets (agency_id);

-- Helper function for updated_at trigger
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_tenant_tickets_updated_at
before update on public.tenant_tickets
for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.tenant_tickets enable row level security;

-- 1.3) Tenant messages table
create table if not exists public.tenant_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tenant_tickets (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_tenant_messages_ticket on public.tenant_messages (ticket_id);
create index if not exists idx_tenant_messages_agency on public.tenant_messages (agency_id);

alter table public.tenant_messages enable row level security;

-- =====================================
-- 2) RLS POLICIES
-- =====================================

-- 2.1) Tenancies policies
drop policy if exists "tenants can read their own tenancy" on public.tenancies;
create policy "tenants can read their own tenancy"
on public.tenancies
for select
to authenticated
using (tenant_id = auth.uid());

drop policy if exists "staff can read tenancies by agency" on public.tenancies;
create policy "staff can read tenancies by agency"
on public.tenancies
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = tenancies.agency_id
      and p.role in ('owner','agent')
  )
);

drop policy if exists "staff can manage tenancies" on public.tenancies;
create policy "staff can manage tenancies"
on public.tenancies
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = tenancies.agency_id
      and p.role in ('owner','agent')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = tenancies.agency_id
      and p.role in ('owner','agent')
  )
);

-- 2.2) Tenant tickets policies
drop policy if exists "tenant can read own tickets" on public.tenant_tickets;
create policy "tenant can read own tickets"
on public.tenant_tickets
for select
to authenticated
using (
  tenant_id = auth.uid()
  and exists (
    select 1 from public.tenancies t
    where t.tenant_id = auth.uid()
      and t.property_id = tenant_tickets.property_id
      and t.is_active
  )
);

drop policy if exists "tenant can create own tickets" on public.tenant_tickets;
create policy "tenant can create own tickets"
on public.tenant_tickets
for insert
to authenticated
with check (
  tenant_id = auth.uid()
  and exists (
    select 1 from public.tenancies t
    where t.tenant_id = auth.uid()
      and t.property_id = tenant_tickets.property_id
      and t.is_active
  )
);

drop policy if exists "tenant can update own tickets" on public.tenant_tickets;
create policy "tenant can update own tickets"
on public.tenant_tickets
for update
to authenticated
using (tenant_id = auth.uid())
with check (tenant_id = auth.uid());

drop policy if exists "owner or assigned agent can read tickets" on public.tenant_tickets;
create policy "owner or assigned agent can read tickets"
on public.tenant_tickets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = tenant_tickets.agency_id
      and (
        p.role = 'owner'
        or tenant_tickets.agent_id = p.id
        or exists (
          select 1 from public.properties pr
          where pr.id = tenant_tickets.property_id
            and pr.letting_agent = p.id
        )
      )
  )
);

drop policy if exists "owner or assigned agent can manage tickets" on public.tenant_tickets;
create policy "owner or assigned agent can manage tickets"
on public.tenant_tickets
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = tenant_tickets.agency_id
      and (
        p.role = 'owner'
        or tenant_tickets.agent_id = p.id
        or exists (
          select 1 from public.properties pr
          where pr.id = tenant_tickets.property_id
            and pr.letting_agent = p.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = tenant_tickets.agency_id
      and (
        p.role = 'owner'
        or tenant_tickets.agent_id = p.id
        or exists (
          select 1 from public.properties pr
          where pr.id = tenant_tickets.property_id
            and pr.letting_agent = p.id
        )
      )
  )
);

-- 2.3) Tenant messages policies
drop policy if exists "tenant can read messages of their tickets" on public.tenant_messages;
create policy "tenant can read messages of their tickets"
on public.tenant_messages
for select
to authenticated
using (
  exists (
    select 1 from public.tenant_tickets tt
    where tt.id = tenant_messages.ticket_id
      and tt.tenant_id = auth.uid()
  )
);

drop policy if exists "tenant can insert messages on their tickets" on public.tenant_messages;
create policy "tenant can insert messages on their tickets"
on public.tenant_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.tenant_tickets tt
    where tt.id = tenant_messages.ticket_id
      and tt.tenant_id = auth.uid()
  )
);

drop policy if exists "owner or assigned agent can read messages" on public.tenant_messages;
create policy "owner or assigned agent can read messages"
on public.tenant_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.tenant_tickets tt on tt.id = tenant_messages.ticket_id
    where p.id = auth.uid()
      and p.agency_id = tenant_messages.agency_id
      and (
        p.role = 'owner'
        or tt.agent_id = p.id
        or exists (
          select 1 from public.properties pr
          where pr.id = tt.property_id
            and pr.letting_agent = p.id
        )
      )
  )
);

drop policy if exists "owner or assigned agent can insert messages" on public.tenant_messages;
create policy "owner or assigned agent can insert messages"
on public.tenant_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    join public.tenant_tickets tt on tt.id = tenant_messages.ticket_id
    where p.id = auth.uid()
      and p.agency_id = tenant_messages.agency_id
      and (
        p.role = 'owner'
        or tt.agent_id = p.id
        or exists (
          select 1 from public.properties pr
          where pr.id = tt.property_id
            and pr.letting_agent = p.id
        )
      )
  )
);

-- =====================================
-- 3) STORAGE BUCKET
-- =====================================

-- Create bucket for tenant attachments
insert into storage.buckets (id, name, public)
values ('tenant-updates', 'tenant-updates', false)
on conflict (id) do nothing;

-- Tenant file policies
drop policy if exists "tenant can manage own files" on storage.objects;
create policy "tenant can manage own files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'tenant-updates'
  and split_part(name, '/', 2)::uuid = auth.uid()
)
with check (
  bucket_id = 'tenant-updates'
  and split_part(name, '/', 2)::uuid = auth.uid()
);

-- Helper view for staff file access
create or replace view public.v_tenant_object_agency as
select
  o.id as object_id,
  o.bucket_id,
  o.name,
  tt.agency_id
from storage.objects o
join lateral (
  select
    (split_part(o.name, '/', 2))::uuid as tenant_id,
    (split_part(o.name, '/', 4))::uuid as ticket_id
) p on true
join public.tenant_tickets tt on tt.id = p.ticket_id;

drop policy if exists "staff can read tenant files by agency" on storage.objects;
create policy "staff can read tenant files by agency"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-updates'
  and exists (
    select 1
    from public.v_tenant_object_agency v
    join public.profiles p on p.id = auth.uid()
    where v.object_id = storage.objects.id
      and p.agency_id = v.agency_id
      and p.role in ('owner','agent')
  )
);

-- =====================================
-- 4) REALTIME PUBLICATION
-- =====================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tenant_tickets;
    alter publication supabase_realtime add table public.tenant_messages;
  end if;
end $$;

-- =====================================
-- 5) UNIFIED VIEW AND RPC
-- =====================================

-- Unified view for agent dashboard
create or replace view public.v_unified_property_updates as
select
  u.id,
  'manager_update'::text as source,
  u.agency_id,
  u.landlord_id,
  u.property_id,
  u.created_by,
  u.status::text as status,
  u.priority::text as priority,
  u.title,
  u.description,
  u.event_date as occurred_at,
  u.created_at,
  u.updated_at
from public.updates u

union all

select
  tt.id,
  'tenant_ticket'::text as source,
  tt.agency_id,
  tt.landlord_id,
  tt.property_id,
  tt.tenant_id as created_by,
  tt.status::text as status,
  tt.severity::text as priority,
  tt.title,
  tt.description,
  tt.created_at as occurred_at,
  tt.created_at,
  tt.updated_at
from public.tenant_tickets tt;

-- RPC function for agent property feed
create or replace function public.fn_agent_property_feed(p_property_id uuid)
returns table (
  id uuid,
  source text,
  agency_id uuid,
  landlord_id uuid,
  property_id uuid,
  created_by uuid,
  status text,
  priority text,
  title text,
  description text,
  occurred_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
as $$
  select v.id, v.source, v.agency_id, v.landlord_id, v.property_id, v.created_by,
         v.status, v.priority, v.title, v.description, v.occurred_at, v.created_at, v.updated_at
  from public.v_unified_property_updates v
  join public.properties p on p.id = v.property_id
  join public.profiles me on me.id = auth.uid()
  where p.id = p_property_id
    and me.agency_id = v.agency_id
    and (me.role = 'owner' or p.letting_agent = me.id)
  order by v.occurred_at desc, v.created_at desc;
$$;

-- =====================================
-- 6) SEED TENANTS
-- =====================================

-- Create profiles and tenancies for existing @tenant.com users
with tenant_candidates as (
  select u.id as tenant_id, u.email
  from auth.users u
  where u.email ilike '%@tenant.com'
),
assignments as (
  select
    tc.tenant_id,
    tc.email,
    p.id as property_id,
    p.agency_id,
    p.landlord_id,
    p.letting_agent as agent_id
  from tenant_candidates tc
  join lateral (
    select p.*
    from public.properties p
    order by random()
    limit 1
  ) p on true
),
upsert_profiles as (
  insert into public.profiles (
    id, agency_id, full_name, role, signature_id,
    managed_properties, permissions, is_active, created_at, updated_at
  )
  select
    a.tenant_id,
    a.agency_id,
    split_part(a.email, '@', 1) as full_name,
    'tenant'::user_role as role,
    ('TEN-' || substr(a.tenant_id::text, 1, 6)) as signature_id,
    '[]'::jsonb as managed_properties,
    '{}'::jsonb as permissions,
    true,
    now(), now()
  from assignments a
  on conflict (id) do update
    set role = excluded.role,
        agency_id = excluded.agency_id,
        is_active = true,
        updated_at = now()
  returning id
)
insert into public.tenancies (
  agency_id, tenant_id, property_id, landlord_id, agent_id, start_date, is_active
)
select
  a.agency_id,
  a.tenant_id,
  a.property_id,
  a.landlord_id,
  a.agent_id,
  now()::date,
  true
from assignments a
where not exists (
  select 1 from public.tenancies t
  where t.tenant_id = a.tenant_id
    and t.is_active
);

-- Optional: Create welcome tickets
insert into public.tenant_tickets (
  id, agency_id, tenant_id, property_id, landlord_id, agent_id,
  title, description, status, severity, created_by
)
select
  gen_random_uuid(),
  t.agency_id, t.tenant_id, t.property_id, t.landlord_id, t.agent_id,
  'Welcome ticket',
  'This is a seeded ticket. Feel free to reply here.',
  'open',
  'normal',
  t.tenant_id
from public.tenancies t
where t.is_active
  and not exists (
    select 1 from public.tenant_tickets tt
    where tt.tenant_id = t.tenant_id
  );
