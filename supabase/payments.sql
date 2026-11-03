-- Run in Supabase SQL Editor after schema.sql.
-- Only the server's service_role may grant purchased credits.
begin;
alter table public.orders add column if not exists paypal_order_id text unique;
alter table public.orders add column if not exists credits bigint not null default 0 check (credits >= 0);
alter table public.orders add column if not exists environment text not null default 'sandbox' check (environment in ('sandbox','live'));
create table if not exists public.credit_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 order_id uuid unique references public.orders(id),
 amount bigint not null,
 environment text not null check (environment in ('sandbox','live')),
 created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to authenticated;
drop policy if exists "Read own credits" on public.credit_ledger;
create policy "Read own credits" on public.credit_ledger for select to authenticated using ((select auth.uid())=user_id);
create or replace function public.fulfill_paypal_order(p_order_id uuid, p_paypal_order_id text, p_capture_id text, p_amount_minor bigint, p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.orders%rowtype;
begin
 select * into item from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if item.paypal_order_id is distinct from p_paypal_order_id or item.amount_minor<>p_amount_minor or item.currency<>p_currency then
  raise exception 'Payment mismatch';
 end if;
 if item.status='paid' then
  if item.provider_transaction is distinct from p_capture_id then raise exception 'Capture mismatch'; end if;
  return;
 end if;
 if item.status<>'pending' or item.credits<=0 then raise exception 'Order not fulfillable'; end if;
 update public.orders set status='paid',provider_transaction=p_capture_id,paid_at=now() where id=p_order_id;
 insert into public.credit_ledger(user_id,order_id,amount,environment) values(item.user_id,item.id,item.credits,item.environment);
end;
$$;
revoke all on function public.fulfill_paypal_order(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.fulfill_paypal_order(uuid,text,text,bigint,text) to service_role;
commit;
