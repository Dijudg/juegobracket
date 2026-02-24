create extension if not exists "pgcrypto";

create table if not exists public.bracket_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null default 'Mi bracket',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bracket_saves_user_id_idx on public.bracket_saves (user_id);

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
