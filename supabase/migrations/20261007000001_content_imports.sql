-- MVP 4 spike: admin + content imports

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.content_imports (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.game_editions (id) on delete cascade,
  image_path text not null,
  image_hash text,
  requested_type text not null
    check (requested_type in ('QUEST', 'TREASURE', 'ENCOUNTER', 'STATUS', 'REFERENCE', 'OTHER')),
  model text,
  prompt_version text not null default 'v1',
  raw_response jsonb,
  parsed_data jsonb,
  confidence_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'UPLOADED'
    check (status in (
      'UPLOADED',
      'PROCESSING',
      'NEEDS_REVIEW',
      'APPROVED',
      'REJECTED',
      'FAILED'
    )),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  published_card_id uuid references public.cards (id)
);

alter table public.app_admins enable row level security;
alter table public.content_imports enable row level security;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = auth.uid()
  );
$$;

create policy "admins_select_self_or_admin"
  on public.app_admins for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

create policy "content_imports_admin_all"
  on public.content_imports for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Storage bucket for card images (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "card_images_admin_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'card-images' and public.is_app_admin());

create policy "card_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'card-images' and public.is_app_admin());
