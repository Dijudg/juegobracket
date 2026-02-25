create extension if not exists "pgcrypto";

create table if not exists public.bracket_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null default 'Mi bracket',
  data jsonb not null,
  is_public boolean not null default true,
  short_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bracket_saves
  add column if not exists is_public boolean not null default true;

alter table public.bracket_saves
  add column if not exists expires_at timestamptz;

alter table public.bracket_saves
  add column if not exists short_code text;

create index if not exists bracket_saves_user_id_idx on public.bracket_saves (user_id);
create index if not exists bracket_saves_expires_at_idx on public.bracket_saves (expires_at);
create unique index if not exists bracket_saves_short_code_uidx
  on public.bracket_saves (short_code)
  where short_code is not null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_bracket_saves_updated_at on public.bracket_saves;
create trigger set_bracket_saves_updated_at
before update on public.bracket_saves
for each row execute procedure public.set_updated_at();

alter table public.bracket_saves enable row level security;

drop policy if exists bracket_saves_select_public on public.bracket_saves;
drop policy if exists bracket_saves_select_own on public.bracket_saves;
drop policy if exists bracket_saves_insert_own on public.bracket_saves;
drop policy if exists bracket_saves_update_own on public.bracket_saves;
drop policy if exists bracket_saves_delete_own on public.bracket_saves;

create policy bracket_saves_select_public
on public.bracket_saves
for select
to anon
using (is_public = true and (expires_at is null or expires_at > now()));

create policy bracket_saves_select_own
on public.bracket_saves
for select
to authenticated
using (auth.uid() = user_id or (is_public = true and (expires_at is null or expires_at > now())));

create policy bracket_saves_insert_own
on public.bracket_saves
for insert
to authenticated
with check (auth.uid() = user_id);

create policy bracket_saves_update_own
on public.bracket_saves
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy bracket_saves_delete_own
on public.bracket_saves
for delete
to authenticated
using (auth.uid() = user_id);
