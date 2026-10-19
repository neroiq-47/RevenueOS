-- Keep helper functions out of the public REST API (PostgREST exposes the public schema).
-- RLS policies still call them, so they live in a private schema the API does not serve.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_org_owner(uuid) set schema private;
alter function public.has_entitlement(uuid) set schema private;

revoke all on function private.is_org_owner(uuid) from public, anon;
revoke all on function private.has_entitlement(uuid) from public, anon;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.has_entitlement(uuid) to authenticated;

-- The signup trigger runs as its owner; no API role should be able to call it directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
