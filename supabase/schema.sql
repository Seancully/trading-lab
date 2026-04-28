-- Run this once in your Supabase project's SQL Editor.
-- It creates a per-user key/value table with row-level security
-- so each authenticated user only ever sees their own rows.

create table if not exists tl_data (
  user_id    uuid references auth.users(id) on delete cascade not null,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table tl_data enable row level security;

create policy "Users read own rows"   on tl_data for select using (auth.uid() = user_id);
create policy "Users insert own rows" on tl_data for insert with check (auth.uid() = user_id);
create policy "Users update own rows" on tl_data for update using (auth.uid() = user_id);
create policy "Users delete own rows" on tl_data for delete using (auth.uid() = user_id);
