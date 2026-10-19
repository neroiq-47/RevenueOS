-- Cross-tenant + entitlement RLS test (run in the Supabase SQL editor after migrations). Safe to run against any database: every change
-- is rolled back by the final RAISE. Success ends with "RLS TESTS PASSED".
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  org_a uuid;
  org_b uuid;
  opp_a uuid;
  n int;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (user_a, 'a-' || user_a || '@test.local', '{"company":"Org A"}', 'authenticated', 'authenticated'),
         (user_b, 'b-' || user_b || '@test.local', '{"company":"Org B"}', 'authenticated', 'authenticated');

  select id into org_a from public.organizations where owner_user_id = user_a;
  select id into org_b from public.organizations where owner_user_id = user_b;
  if org_a is null or org_b is null then raise exception 'FAIL: signup trigger did not create organisations'; end if;

  -- Org A is paid, org B is not.
  insert into public.subscriptions (organization_id, status, current_period_end)
  values (org_a, 'active', now() + interval '30 days');
  insert into public.opportunities (organization_id, title, amount_cents, last_activity_at)
  values (org_a, 'A deal', 100000, now() - interval '10 days') returning id into opp_a;

  -- Act as user B.
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.organizations;
  if n <> 1 then raise exception 'FAIL: user B sees % organisations', n; end if;
  select count(*) into n from public.opportunities;
  if n <> 0 then raise exception 'FAIL: user B can read org A opportunities'; end if;
  select count(*) into n from public.subscriptions;
  if n <> 0 then raise exception 'FAIL: user B can read org A subscription'; end if;

  update public.opportunities set title = 'hacked' where id = opp_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B updated org A opportunity'; end if;
  delete from public.opportunities where id = opp_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B deleted org A opportunity'; end if;

  begin
    insert into public.opportunities (organization_id, title, last_activity_at) values (org_a, 'x', now());
    raise exception 'FAIL: user B inserted into org A';
  exception when insufficient_privilege then null;
  end;

  -- Unpaid: user B cannot write into their own org.
  begin
    insert into public.opportunities (organization_id, title, last_activity_at) values (org_b, 'x', now());
    raise exception 'FAIL: unpaid user B could insert opportunities';
  exception when insufficient_privilege then null;
  end;

  -- Nobody can grant themselves a subscription.
  begin
    insert into public.subscriptions (organization_id, status) values (org_b, 'active');
    raise exception 'FAIL: user B created a subscription';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.webhook_events (stripe_event_id, type) values ('evt_x', 'x');
    raise exception 'FAIL: user wrote webhook_events';
  exception when insufficient_privilege then null;
  end;

  -- Act as paid user A: can read and write own data.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.opportunities;
  if n <> 1 then raise exception 'FAIL: user A sees % opportunities', n; end if;
  insert into public.opportunities (organization_id, title, last_activity_at) values (org_a, 'A2', now());
  insert into public.drafts (organization_id, opportunity_id, content) values (org_a, opp_a, 'hello');

  reset role;
  raise exception 'RLS TESTS PASSED';
end $$;
