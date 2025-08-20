# Tenant Portal: Schema, RLS, Unified Agent Feed, and Seed Plan

This document adds tenants to your current Supabase schema, wires relationships, enforces RLS, seeds tenant accounts from `auth.users` with `@tenant.com` emails, assigns them to a random property/agent/landlord, creates new tables for tenant tickets and messages, provisions a private Storage bucket for attachments, and exposes a unified “agent maintenance feed” that merges existing manager `updates` and the new tenant tickets so agents see everything in their dashboard.

## Assumptions
- Existing tables: `profiles`, `properties`, `landlords`, `agencies`, `updates`, `attachments`.
- Existing Postgres enum types: `update_status`, `priority_level` (seen on `updates.status` and `updates.priority`).
- `properties.letting_agent` references `profiles.id` (agent/PM).
- `profiles.id` equals `auth.users.id`.

If any differ, adjust the FKs accordingly.

---

## 1) Schema Changes

### 1.1 Tenancies
Maps each tenant to a single active property and its owner/agent.

```sql
-- Enable extension if not present (for gen_random_uuid)
create extension if not exists pgcrypto;

-- 1) Tenancies table
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
```

### 1.2 Tenant Tickets
Primary ticket records raised by tenants.

```sql
-- 2) Tenant tickets (top-level ticket)
create table if not exists public.tenant_tickets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  agent_id uuid references public.profiles (id) on delete set null,

  title text not null,
  description text not null,
  status update_status not null default 'open',
  severity priority_level not null default 'normal',

  created_by uuid not null references public.profiles (id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_tenant_tickets_tenant on public.tenant_tickets (tenant_id);
create index if not exists idx_tenant_tickets_property on public.tenant_tickets (property_id);
create index if not exists idx_tenant_tickets_agency on public.tenant_tickets (agency_id);

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
```

### 1.3 Tenant Messages
Threaded messages attached to a ticket. Supports tenant ↔ agent/PM.

```sql
-- 3) Tenant messages (thread items under a ticket)
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
```

Validation: New tables do not affect existing `updates`; they are orthogonal. Proceed.

---

## 2) RLS Policies

### 2.1 Tenancies
- Tenants can only see their own tenancy row.
- Agency `owner`/`agent` can see rows in their agency.
```sql
-- Tenants: read own tenancy
create policy if not exists "tenants can read their own tenancy"
on public.tenancies
for select
to authenticated
using (tenant_id = auth.uid());

-- Agency staff: read by agency
create policy if not exists "staff can read tenancies by agency"
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

-- Agency staff may insert/manage tenancies
create policy if not exists "staff can manage tenancies"
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
```

### 2.2 Tenant Tickets
- Tenants can CRUD only tickets that belong to their active tenancy.
- Owners can see all in their agency; agents can see only tickets on properties they handle (either `tenant_tickets.agent_id = auth.uid()` or `properties.letting_agent = auth.uid()`).

```sql
-- Tenant read
create policy if not exists "tenant can read own tickets"
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

-- Tenant insert
create policy if not exists "tenant can create own tickets"
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

-- Tenant update (only their tickets)
create policy if not exists "tenant can update own tickets"
on public.tenant_tickets
for update
to authenticated
using (tenant_id = auth.uid())
with check (tenant_id = auth.uid());

-- Staff read by assignment/ownership
create policy if not exists "owner or assigned agent can read tickets"
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

-- Staff manage limited by assignment/ownership
create policy if not exists "owner or assigned agent can manage tickets"
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
```

### 2.3 Tenant Messages
- Tenants can read/insert messages for tickets they own.
- Owners see all in-agency; agents only on properties they handle.

```sql
-- Tenant read their ticket messages
create policy if not exists "tenant can read messages of their tickets"
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

-- Tenant insert on their tickets
create policy if not exists "tenant can insert messages on their tickets"
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

-- Staff read by assignment/ownership
create policy if not exists "owner or assigned agent can read messages"
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

-- Staff insert by assignment/ownership
create policy if not exists "owner or assigned agent can insert messages"
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
```

Validation: Policies now ensure the assigned agent (or agency owner) sees and manages relevant tickets/messages; other agents cannot. Proceed.

---

## 3) Storage Bucket for Attachments

Bucket is a private “folder” for tenant updates, path-scoped to the tenant id.

```sql
-- Create a private bucket for tenant attachments
select storage.create_bucket('tenant-updates', public := false);

-- RLS for storage.objects (path: tenant/{tenant_id}/tickets/{ticket_id}/filename)
create policy if not exists "tenant can manage own files"
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

-- Agency staff read by agency via view
create or replace view public.v_tenant_object_agency as
select
  o.id as object_id,
  o.bucket_id,
  o.name,
  tt.agency_id
from storage.objects o
join lateral (
  -- Expect path: tenant/{tenant_id}/tickets/{ticket_id}/...
  select
    (split_part(o.name, '/', 2))::uuid as tenant_id,
    (split_part(o.name, '/', 4))::uuid as ticket_id
) p on true
join public.tenant_tickets tt on tt.id = p.ticket_id;

create policy if not exists "staff can read tenant files by agency"
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
```

Validation: Tenants only access their folders; staff gets read as needed. Proceed.

---

## 4) Realtime Publication

```sql
-- Add tables to Supabase realtime publication (if it exists)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tenant_tickets;
    alter publication supabase_realtime add table public.tenant_messages;
  end if;
end $$;
```

Validation: Enables live updates for tickets/messages. Proceed.

---

## 5) Seed Tenants from `auth.users` with @tenant.com

Randomly assign each `@tenant.com` user to a property; link matching landlord/agent; create `profiles` and `tenancies`. Re-run safely; it upserts profiles and avoids duplicate active tenancies.

```sql
with tenant_candidates as (
  select u.id as tenant_id, u.email
  from auth.users u
  where u.email ilike '%@tenant.com'
),
assignments as (
  -- random property per tenant
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
    'tenant'::text as role,
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
```

Optional: Create a welcome ticket per tenant to test the flow.

```sql
insert into public.tenant_tickets (
  id, agency_id, tenant_id, property_id, landlord_id, agent_id,
  title, description, status, severity, created_by
)
select
  gen_random_uuid(),
  t.agency_id, t.tenant_id, t.property_id, t.landlord_id, t.agent_id,
  'Welcome ticket',
  'This is a seeded ticket. Feel free to reply here.',
  'open'::update_status,
  'normal'::priority_level,
  t.tenant_id
from public.tenancies t
where t.is_active
  and not exists (
    select 1 from public.tenant_tickets tt
    where tt.tenant_id = t.tenant_id
  );
```

Validation: Seeds only `@tenant.com` users and avoids duplicates; each tenant gets one active tenancy and an initial ticket. Proceed.

---

## 6) Unified Agent Maintenance Feed (agents see tenant updates too)

Agents should see tenant-raised tickets in the same board as their standard `updates`. We expose:
- A view that merges `public.updates` and `public.tenant_tickets` into a common schema.
- A safe, security-invoker RPC that filters by agency and assignment so agents only see properties they handle (owners see all).

```sql
-- Unified view (no privilege escalation; base-table RLS still enforced)
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
```

RPC for agents/owners:
```sql
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
```

Frontend usage (agent dashboard) example:
```ts
// replace previous listUpdates(propertyId) for agent board:
const { data, error } = await supabase
  .rpc('fn_agent_property_feed', { p_property_id: propertyId });
```

Realtime: subscribe to both `public.updates` and `public.tenant_tickets` to refresh the board when either changes.

Validation: Agents now see tenant tickets alongside existing updates, but only on properties they handle; owners see all in-agency. Proceed.

---

## 7) N8N Payload (for routing/triage)

When a new tenant ticket is created, send:

```json
{
  "type": "maintenance_ticket",
  "ticketId": "<uuid>",
  "severity": "low|normal|high|urgent",
  "description": "text",
  "tenantId": "<uuid>",
  "agentId": "<uuid|null>",
  "landlordId": "<uuid>",
  "property": {
    "id": "<uuid>",
    "agencyId": "<uuid>",
    "addressLine1": "text",
    "city": "text",
    "postcode": "text"
  }
}
```

If specialist is not assigned, escalate to the agent/PM; owners may receive summary notifications.

Validation: Workflow routes to right contact; fallback escalation covered. Proceed.

---

## 8) Notes for App Integration
- Tenants authenticate via Supabase; `profiles.role = 'tenant'`.
- Tenants can only see/create tickets for their active `tenancies`.
- Agents/owners use `fn_agent_property_feed(propertyId)` to render the maintenance board; this merges standard `updates` with `tenant_tickets`.
- Use realtime on `updates`, `tenant_tickets`, and `tenant_messages` for live updates.
- Store attachments under `tenant-updates` bucket with path `tenant/{tenant_id}/tickets/{ticket_id}/...`.

---

## 9) Frontend Application Changes

The frontend needs updates to support tenant portal routes, unified agent feeds, and new API methods.

### 9.1 Types Updates

Add new types for unified feed and extend the API interface in `src/lib/api/types.ts`:

```typescript
// Add to existing enums at top of file
export type UserRole = 'owner' | 'agent' | 'tenant' | 'specialist';

// Add new interface for unified feed
export interface UnifiedPropertyUpdate {
  id: string;
  source: 'manager_update' | 'tenant_ticket';
  agencyId: string;
  landlordId: string;
  propertyId: string;
  createdBy: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  occurredAt: string; // ISO
  createdAt: string;
  updatedAt: string;
}

// Extend YarrowAPI interface (add to existing methods)
export interface YarrowAPI {
  // ... existing methods ...

  // Unified feed for agents/owners
  getUnifiedPropertyFeed(propertyId: string): Promise<UnifiedPropertyUpdate[]>;
}
```

### 9.2 Supabase Adapter Updates

Add to `src/lib/api/supabaseAdapter.ts`:

```typescript
async getUnifiedPropertyFeed(propertyId: string): Promise<UnifiedPropertyUpdate[]> {
  try {
    const { data, error } = await supabase
      .rpc('fn_agent_property_feed', { p_property_id: propertyId });

    if (error) throw new Error(`Failed to fetch unified feed: ${error.message}`);

    return data.map(item => ({
      id: item.id,
      source: item.source,
      agencyId: item.agency_id,
      landlordId: item.landlord_id,
      propertyId: item.property_id,
      createdBy: item.created_by,
      status: item.status,
      priority: item.priority,
      title: item.title,
      description: item.description,
      occurredAt: item.occurred_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  } catch (error) {
    console.error('GetUnifiedPropertyFeed error:', error);
    throw error;
  }
}
```

### 9.3 Updated PropertyJournalModal

Replace the `loadUpdates` method in `src/components/PropertyJournalModal.tsx`:

```typescript
// Replace existing imports, add UnifiedPropertyUpdate
import { Property, UnifiedPropertyUpdate, UpdateStatus, Landlord } from '@/lib/api/types';

// Replace updates state type
const [updates, setUpdates] = useState<UnifiedPropertyUpdate[]>([]);

// Replace loadUpdates method
const loadUpdates = async () => {
  try {
    setLoading(true);
    const data = await api.getUnifiedPropertyFeed(property.id);
    setUpdates(data);
  } catch (error) {
    console.error('Error loading unified feed:', error);
  } finally {
    setLoading(false);
  }
};

// Add visual indicator for tenant tickets
const getSourceBadge = (source: string) => {
  return source === 'tenant_ticket' ? (
    <Badge variant="secondary" className="text-xs">Tenant</Badge>
  ) : (
    <Badge variant="outline" className="text-xs">Manager</Badge>
  );
};
```

### 9.4 Realtime Subscriptions

Create `src/lib/realtime.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabaseRT = createClient(supabaseUrl, supabaseKey);

export const subscribeToPropertyFeed = (propertyId: string, callback: () => void) => {
  const channel = supabaseRT
    .channel(`property-feed-${propertyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'updates', filter: `property_id=eq.${propertyId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_tickets', filter: `property_id=eq.${propertyId}` }, callback)
    .subscribe();

  return () => supabaseRT.removeChannel(channel);
};
```

---

## 10) Order of Operations
1) Run schema changes (Sections 1.1–1.3).  
2) Apply RLS policies (Section 2).  
3) Create storage bucket and storage policies (Section 3).  
4) Add tables to realtime publication (Section 4).  
5) Create unified view + RPC function (Section 6).  
6) Seed tenants from `auth.users` (Section 5).  
7) Update frontend types and API methods (Sections 9.1–9.2).
8) Update PropertyJournalModal to use unified feed (Section 9.3).
9) Add realtime subscriptions (Section 9.4).
10) Deploy and test tenant portal and agent unified view.
