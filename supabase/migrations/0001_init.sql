-- RevenueOS Lite: initial schema
-- One owner per organisation. Every customer table is tenant-scoped by organization_id
-- and protected by row level security.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) <= 320),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  stage text not null default 'open' check (stage in ('open', 'won', 'lost')),
  last_activity_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  content text not null check (char_length(content) <= 2000),
  created_at timestamptz not null default now()
);

-- Stripe webhook idempotency. Written only by the server (service role).
create table public.webhook_events (
  stripe_event_id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- Append-only log used for rate limits and quotas (imports, AI drafts).
create table public.usage_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('import', 'draft')),
  created_at timestamptz not null default now()
);

create index contacts_org_idx on public.contacts (organization_id);
create index opportunities_org_stage_idx on public.opportunities (organization_id, stage, last_activity_at);
create index drafts_org_created_idx on public.drafts (organization_id, created_at desc);
create index drafts_opportunity_idx on public.drafts (opportunity_id);
create index usage_events_org_kind_idx on public.usage_events (organization_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org_id and o.owner_user_id = (select auth.uid())
  );
$$;

-- True when the organisation has a paid, current subscription.
create or replace function public.has_entitlement(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.organization_id = org_id
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.has_entitlement(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.has_entitlement(uuid) to authenticated;

-- Create the owner's organisation when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_name text;
begin
  org_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'company'), ''),
    split_part(new.email, '@', 2),
    'My organisation'
  );
  insert into public.organizations (name, owner_user_id)
  values (left(org_name, 120), new.id)
  on conflict (owner_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.drafts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.usage_events enable row level security;

-- organizations: the owner can read and rename their own organisation.
create policy "owner reads org" on public.organizations
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "owner renames org" on public.organizations
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- subscriptions: read-only for the owner. Only the Stripe webhook (service role) writes.
create policy "owner reads subscription" on public.subscriptions
  for select to authenticated using (public.is_org_owner(organization_id));

-- contacts / opportunities / drafts: the owner can always read (and delete, for data
-- removal), but creating or changing data requires an active subscription.
create policy "owner reads contacts" on public.contacts
  for select to authenticated using (public.is_org_owner(organization_id));
create policy "entitled owner writes contacts" on public.contacts
  for insert to authenticated
  with check (public.is_org_owner(organization_id) and public.has_entitlement(organization_id));
create policy "entitled owner updates contacts" on public.contacts
  for update to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id) and public.has_entitlement(organization_id));
create policy "owner deletes contacts" on public.contacts
  for delete to authenticated using (public.is_org_owner(organization_id));

create policy "owner reads opportunities" on public.opportunities
  for select to authenticated using (public.is_org_owner(organization_id));
create policy "entitled owner writes opportunities" on public.opportunities
  for insert to authenticated
  with check (public.is_org_owner(organization_id) and public.has_entitlement(organization_id));
create policy "entitled owner updates opportunities" on public.opportunities
  for update to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id) and public.has_entitlement(organization_id));
create policy "owner deletes opportunities" on public.opportunities
  for delete to authenticated using (public.is_org_owner(organization_id));

create policy "owner reads drafts" on public.drafts
  for select to authenticated using (public.is_org_owner(organization_id));
create policy "entitled owner writes drafts" on public.drafts
  for insert to authenticated
  with check (public.is_org_owner(organization_id) and public.has_entitlement(organization_id));
create policy "owner deletes drafts" on public.drafts
  for delete to authenticated using (public.is_org_owner(organization_id));

create policy "owner reads usage" on public.usage_events
  for select to authenticated using (public.is_org_owner(organization_id));
create policy "entitled owner logs usage" on public.usage_events
  for insert to authenticated
  with check (public.is_org_owner(organization_id) and public.has_entitlement(organization_id));

-- webhook_events: RLS on, no policies => only the service role can touch it.

-- A draft must belong to an opportunity in the same organisation.
create or replace function public.check_draft_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.opportunities o
    where o.id = new.opportunity_id and o.organization_id = new.organization_id
  ) then
    raise exception 'opportunity does not belong to organisation';
  end if;
  return new;
end;
$$;

create trigger drafts_tenant_check
  before insert or update on public.drafts
  for each row execute function public.check_draft_tenant();

-- An opportunity's contact must belong to the same organisation.
create or replace function public.check_opportunity_contact_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = new.contact_id and c.organization_id = new.organization_id
  ) then
    raise exception 'contact does not belong to organisation';
  end if;
  return new;
end;
$$;

create trigger opportunities_contact_tenant_check
  before insert or update on public.opportunities
  for each row execute function public.check_opportunity_contact_tenant();
