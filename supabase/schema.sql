-- Sauvegardes League of Bonk : une ligne par joueur, lisible/modifiable uniquement par lui.
create table if not exists public.lob_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lob_saves enable row level security;

create policy "lob_saves_select_own" on public.lob_saves for select using (auth.uid() = user_id);
create policy "lob_saves_insert_own" on public.lob_saves for insert with check (auth.uid() = user_id);
create policy "lob_saves_update_own" on public.lob_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lob_saves_delete_own" on public.lob_saves for delete using (auth.uid() = user_id);
