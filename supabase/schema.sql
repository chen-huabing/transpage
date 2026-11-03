-- Execute once in the project's SQL Editor. No payment write access for browsers.
begin;
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 plan text not null,
 amount_minor bigint not null check(amount_minor>=0),
 currency text not null check(currency in ('CNY','USD')),
 status text not null check(status in ('pending','paid','cancelled','refunded','failed')),
 provider_transaction text unique,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists orders_user_created on public.orders(user_id,created_at desc);
alter table public.orders enable row level security;
revoke all on public.orders from anon,authenticated;
grant select on public.orders to authenticated;
drop policy if exists "Read own orders" on public.orders;
create policy "Read own orders" on public.orders for select to authenticated using ((select auth.uid())=user_id);
commit;
