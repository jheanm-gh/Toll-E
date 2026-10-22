-- Toll-E initial schema.
--
-- Design rules enforced in the database (not only in the apps):
--   * Money is integer cents. Dates are SA-local calendar dates; effective ranges are inclusive.
--   * Published tariffs are immutable apart from verification, expiry and withdrawal.
--     Corrections create a new record; nothing published is ever deleted.
--   * Overlapping published tariffs for the same plaza, class and direction are impossible.
--   * Verification must cite an official source and name the verifier.
--   * The public (anon) role can read published data only. Writes need an admin_users row.
--   * Every change to content tables is written to audit_log.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------
create type public.verification_status as enum ('verified', 'unverified', 'pending_review', 'illustrative');
create type public.publication_status as enum ('draft', 'published', 'withdrawn');
create type public.province_code as enum ('EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC');
create type public.plaza_type as enum ('mainline', 'ramp', 'unknown');
create type public.travel_direction as enum ('northbound', 'southbound', 'eastbound', 'westbound');
create type public.tariff_direction as enum ('any', 'northbound', 'southbound', 'eastbound', 'westbound');
create type public.source_kind as enum (
  'government_gazette', 'agency_publication', 'operator_publication', 'operator_website',
  'news', 'secondary_compilation', 'map_data'
);
create type public.operator_kind as enum ('national_agency', 'concessionaire', 'provincial_concession');
create type public.admin_role as enum ('editor', 'publisher');

-- Stable kebab-case identifiers, shared with the app's data model.
create domain public.slug as text check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) between 2 and 80);

-- ---------------------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.admin_role not null default 'editor',
  created_at timestamptz not null default now()
);
comment on table public.admin_users is
  'People allowed to edit (editor) or publish and verify (publisher) toll data. Managed with the service role only.';

create function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create function public.is_publisher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'publisher');
$$;

create function public.current_admin_name() returns text
language sql stable security definer set search_path = public as $$
  select display_name from public.admin_users where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------------------
create table public.sources (
  id public.slug primary key,
  title text not null check (length(title) >= 3),
  publisher text not null,
  url text not null check (url ~ '^https?://'),
  kind public.source_kind not null,
  official boolean not null,
  published_on date,
  retrieved_on date not null,
  reference text,
  notes text,
  updated_at timestamptz not null default now()
);

create table public.operators (
  id public.slug primary key,
  name text not null,
  short_name text not null,
  kind public.operator_kind not null,
  website text check (website is null or website ~ '^https://'),
  phone text,
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_status public.verification_status not null default 'unverified',
  payment_methods text[] check (payment_methods <@ array['cash', 'contactless_card', 'e_tag']),
  payment_status public.verification_status,
  payment_source_ids text[] not null default '{}',
  payment_notes text,
  source_ids text[] not null check (cardinality(source_ids) > 0),
  notes text,
  updated_at timestamptz not null default now(),
  check ((payment_methods is null) = (payment_status is null))
);

create table public.toll_roads (
  id public.slug primary key,
  name text not null,
  routes text[] not null check (cardinality(routes) > 0),
  operator_id text not null references public.operators (id),
  provinces public.province_code[] not null,
  description text,
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.vehicle_class_schemes (
  id public.slug primary key,
  name text not null,
  from_standard jsonb not null default '{}'::jsonb,
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.vehicle_classes (
  scheme_id text not null references public.vehicle_class_schemes (id) on delete cascade,
  id public.slug not null,
  label text not null,
  short_description text not null,
  description text not null,
  sort_order integer not null,
  primary key (scheme_id, id)
);

create table public.plazas (
  id public.slug primary key,
  name text not null,
  toll_road_id text not null references public.toll_roads (id),
  operator_id text not null references public.operators (id),
  route text not null check (route ~ '^[NRM][0-9]{1,3}$'),
  type public.plaza_type not null default 'unknown',
  province public.province_code,
  locality text,
  carriageway text,
  lat double precision,
  lng double precision,
  location_precision text check (location_precision in ('verified', 'approximate')),
  location_source_ids text[] not null default '{}',
  location_notes text,
  status text not null default 'active' check (status in ('active', 'decommissioned')),
  class_scheme_id text not null references public.vehicle_class_schemes (id),
  source_ids text[] not null check (cardinality(source_ids) > 0),
  aliases text[] not null default '{}',
  notes text[] not null default '{}',
  publication_status public.publication_status not null default 'draft',
  updated_at timestamptz not null default now(),
  -- a position is all-or-nothing, inside mainland South Africa, and always has a precision
  check ((lat is null) = (lng is null) and (lat is null) = (location_precision is null)),
  check (lat is null or (lat between -35.0 and -22.0 and lng between 16.3 and 33.0)),
  check (lat is null or cardinality(location_source_ids) > 0)
);
create index plazas_route_idx on public.plazas (route);
create index plazas_operator_idx on public.plazas (operator_id);

create table public.tariff_schedules (
  id public.slug primary key,
  name text not null,
  operator_ids text[] not null check (cardinality(operator_ids) > 0),
  effective_from date not null,
  effective_to date,
  next_review_expected date,
  adjustment_bps integer,
  source_ids text[] not null check (cardinality(source_ids) > 0),
  notes text,
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.tariffs (
  id public.slug primary key,
  plaza_id text not null references public.plazas (id),
  vehicle_class_id text not null,
  class_scheme_id text not null,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 200000),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  vat_inclusive boolean not null default true,
  charging_basis text not null default 'per_passage' check (charging_basis = 'per_passage'),
  direction public.tariff_direction not null default 'any',
  condition text,
  effective_from date not null,
  effective_to date,
  schedule_id text not null references public.tariff_schedules (id),
  source_id text not null references public.sources (id),
  source_locator text,
  checked_on date not null,
  verified_on date,
  verified_by text,
  verification_status public.verification_status not null default 'unverified',
  publication_status public.publication_status not null default 'draft',
  notes text,
  supersedes_id text references public.tariffs (id),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  foreign key (class_scheme_id, vehicle_class_id) references public.vehicle_classes (scheme_id, id),
  check (effective_to is null or effective_to >= effective_from),
  check (verification_status <> 'verified' or (verified_on is not null and verified_by is not null)),
  check (not (verification_status = 'illustrative' and publication_status = 'published')),
  -- no two published tariffs for the same plaza/class/direction may overlap in time
  constraint tariffs_no_overlap exclude using gist (
    plaza_id with =,
    vehicle_class_id with =,
    direction with =,
    daterange(effective_from, effective_to, '[]') with &&
  ) where (publication_status = 'published')
);
create index tariffs_plaza_idx on public.tariffs (plaza_id, vehicle_class_id, effective_from);

create table public.journeys (
  id public.slug primary key,
  name text not null,
  origin_label text not null,
  origin_query text not null,
  destination_label text not null,
  destination_query text not null,
  via text not null,
  description text not null default '',
  sequence_status public.verification_status not null default 'unverified',
  limitations text[] not null default '{}',
  source_ids text[] not null default '{}',
  publication_status public.publication_status not null default 'draft',
  updated_at timestamptz not null default now()
);

create table public.journey_events (
  journey_id text not null references public.journeys (id) on delete cascade,
  leg text not null check (leg in ('outbound', 'return')),
  seq integer not null check (seq > 0),
  plaza_id text not null references public.plazas (id),
  direction public.travel_direction not null,
  requirement text not null default 'required' check (requirement in ('required', 'conditional')),
  condition text,
  primary key (journey_id, leg, seq),
  -- a plaza is charged at most once per leg
  unique (journey_id, leg, plaza_id)
);

create table public.notices (
  id public.slug primary key,
  title text not null,
  body text not null,
  severity text not null check (severity in ('info', 'warning')),
  show_from date not null,
  show_until date,
  source_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.dataset_meta (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------------------
-- User-submitted corrections (public writes only through submit_correction)
-- ---------------------------------------------------------------------------------------
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null,
  plaza_id text references public.plazas (id) on delete set null,
  category text not null check (category in ('tariff', 'location', 'plaza_details', 'payment', 'journey', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  contact_email text check (contact_email is null or (char_length(contact_email) <= 200 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  dataset_version text check (dataset_version is null or char_length(dataset_version) <= 40),
  status text not null default 'new' check (status in ('new', 'triaged', 'accepted', 'rejected', 'duplicate')),
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamptz
);
create index corrections_client_idx on public.corrections (client_id, created_at);
create index corrections_status_idx on public.corrections (status, created_at);

-- ---------------------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz not null default now(),
  changed_fields text[],
  old_row jsonb,
  new_row jsonb
);
create index audit_log_record_idx on public.audit_log (table_name, record_id, changed_at desc);

create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  rec jsonb := coalesce(new_j, old_j);
  rid text := coalesce(rec ->> 'id', concat_ws(':', rec ->> 'journey_id', rec ->> 'leg', rec ->> 'seq'), rec ->> 'user_id');
  fields text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into fields
    from jsonb_object_keys(new_j) k
    where new_j -> k is distinct from old_j -> k and k not in ('updated_at', 'updated_by');
    if fields is null then
      return new; -- nothing meaningful changed
    end if;
  end if;
  insert into public.audit_log (table_name, record_id, action, changed_by, changed_by_email, changed_fields, old_row, new_row)
  values (tg_table_name, rid, tg_op, auth.uid(), auth.jwt() ->> 'email', fields, old_j, new_j);
  return coalesce(new, old);
end;
$$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'tariffs' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Tariff integrity triggers
-- ---------------------------------------------------------------------------------------
create function public.tariffs_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  src_official boolean;
begin
  -- class scheme always follows the plaza
  select class_scheme_id into new.class_scheme_id from public.plazas where id = new.plaza_id;

  if tg_op = 'UPDATE' then
    if old.publication_status = 'withdrawn' and new is distinct from old then
      raise exception 'withdrawn tariff % is closed; create a new tariff instead', old.id
        using errcode = 'check_violation';
    end if;
    if old.publication_status = 'published' then
      if new.publication_status = 'draft' then
        raise exception 'published tariff % cannot return to draft', old.id using errcode = 'check_violation';
      end if;
      if (new.plaza_id, new.vehicle_class_id, new.amount_cents, new.direction, new.effective_from,
          new.schedule_id, new.source_id, new.vat_inclusive, new.condition)
         is distinct from
         (old.plaza_id, old.vehicle_class_id, old.amount_cents, old.direction, old.effective_from,
          old.schedule_id, old.source_id, old.vat_inclusive, old.condition) then
        raise exception 'published tariff % is immutable; withdraw it and publish a correction', old.id
          using errcode = 'check_violation';
      end if;
      if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
        raise exception 'the end date of published tariff % is already set', old.id using errcode = 'check_violation';
      end if;
    end if;
  end if;

  -- An 'any'-direction tariff conflicts with every direction (the exclusion constraint only
  -- catches identical directions).
  if new.publication_status = 'published' and exists (
    select 1 from public.tariffs o
    where o.id <> new.id
      and o.publication_status = 'published'
      and o.plaza_id = new.plaza_id
      and o.vehicle_class_id = new.vehicle_class_id
      and (o.direction = 'any' or new.direction = 'any')
      and daterange(o.effective_from, o.effective_to, '[]') && daterange(new.effective_from, new.effective_to, '[]')
  ) then
    raise exception 'tariff % overlaps another published tariff for the same plaza, class and direction', new.id
      using errcode = 'exclusion_violation';
  end if;

  if new.verification_status = 'verified' then
    select official into src_official from public.sources where id = new.source_id;
    if not coalesce(src_official, false) then
      raise exception 'tariff % can only be verified against an official source', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create function public.tariffs_before_delete() returns trigger
language plpgsql as $$
begin
  if old.publication_status <> 'draft' then
    raise exception 'tariff % has been published and cannot be deleted; withdraw it instead', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger tariffs_before_write before insert or update on public.tariffs
  for each row execute function public.tariffs_before_write();
create trigger tariffs_before_delete before delete on public.tariffs
  for each row execute function public.tariffs_before_delete();

-- Plazas: published plazas are never deleted (tariff history references them).
create function public.plazas_before_delete() returns trigger
language plpgsql as $$
begin
  if old.publication_status <> 'draft' then
    raise exception 'plaza % has been published and cannot be deleted; set status to decommissioned or withdraw it', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger plazas_before_delete before delete on public.plazas
  for each row execute function public.plazas_before_delete();

-- Every content change bumps the dataset version so apps know to refresh.
create function public.bump_dataset_version() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  today text := to_char(now() at time zone 'Africa/Johannesburg', 'YYYY-MM-DD');
  cur text;
  n integer;
begin
  if current_setting('tolle.seeding', true) = 'on' then
    return null;
  end if;
  select value into cur from public.dataset_meta where key = 'dataset_version' for update;
  if cur is not null and split_part(cur, '.', 1) >= today then
    n := split_part(cur, '.', 2)::integer + 1;
    today := split_part(cur, '.', 1);
  else
    n := 1;
  end if;
  insert into public.dataset_meta (key, value) values ('dataset_version', today || '.' || n)
  on conflict (key) do update set value = excluded.value;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sources', 'operators', 'toll_roads', 'vehicle_class_schemes', 'plazas',
                           'tariff_schedules', 'tariffs', 'journeys', 'notices'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
  foreach t in array array['sources', 'operators', 'toll_roads', 'vehicle_class_schemes', 'vehicle_classes',
                           'plazas', 'tariff_schedules', 'tariffs', 'journeys', 'journey_events', 'notices',
                           'admin_users'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
  foreach t in array array['sources', 'operators', 'toll_roads', 'vehicle_class_schemes', 'vehicle_classes',
                           'plazas', 'tariff_schedules', 'tariffs', 'journeys', 'journey_events', 'notices'] loop
    execute format('create trigger %I_version after insert or update or delete on public.%I for each statement execute function public.bump_dataset_version()', t, t);
  end loop;
end;
$$;

-- Corrections: audit status changes only (submissions themselves are personal data and are
-- not copied into the audit log).
create function public.audit_correction_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.admin_notes is distinct from old.admin_notes then
    insert into public.audit_log (table_name, record_id, action, changed_by, changed_by_email, changed_fields, old_row, new_row)
    values ('corrections', new.id::text, 'UPDATE', auth.uid(), auth.jwt() ->> 'email', array['status'],
            jsonb_build_object('status', old.status), jsonb_build_object('status', new.status, 'admin_notes', new.admin_notes));
  end if;
  return new;
end;
$$;
create trigger corrections_audit after update on public.corrections
  for each row execute function public.audit_correction_status();

-- ---------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.sources enable row level security;
alter table public.operators enable row level security;
alter table public.toll_roads enable row level security;
alter table public.vehicle_class_schemes enable row level security;
alter table public.vehicle_classes enable row level security;
alter table public.plazas enable row level security;
alter table public.tariff_schedules enable row level security;
alter table public.tariffs enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_events enable row level security;
alter table public.notices enable row level security;
alter table public.dataset_meta enable row level security;
alter table public.corrections enable row level security;
alter table public.audit_log enable row level security;

-- Public reference data
create policy "public read" on public.sources for select using (true);
create policy "public read" on public.operators for select using (true);
create policy "public read" on public.toll_roads for select using (true);
create policy "public read" on public.vehicle_class_schemes for select using (true);
create policy "public read" on public.vehicle_classes for select using (true);
create policy "public read" on public.tariff_schedules for select using (true);
create policy "public read" on public.notices for select using (true);
create policy "public read" on public.dataset_meta for select using (true);

-- Published content only, unless you are an admin
create policy "read published" on public.plazas for select using (publication_status = 'published' or public.is_editor());
create policy "read published" on public.tariffs for select using (publication_status = 'published' or public.is_editor());
create policy "read published" on public.journeys for select using (publication_status = 'published' or public.is_editor());
create policy "read published" on public.journey_events for select
  using (exists (select 1 from public.journeys j where j.id = journey_id and (j.publication_status = 'published' or public.is_editor())));

-- Editors maintain reference data; publishers too.
do $$
declare t text;
begin
  foreach t in array array['sources', 'operators', 'toll_roads', 'vehicle_class_schemes', 'vehicle_classes',
                           'tariff_schedules', 'notices', 'journey_events'] loop
    execute format('create policy "editors insert" on public.%I for insert with check (public.is_editor())', t);
    execute format('create policy "editors update" on public.%I for update using (public.is_editor()) with check (public.is_editor())', t);
    execute format('create policy "editors delete" on public.%I for delete using (public.is_editor())', t);
  end loop;
end;
$$;

-- Plazas and journeys: editors work on drafts; only publishers publish or edit published rows.
create policy "editors insert drafts" on public.plazas for insert
  with check (public.is_publisher() or (public.is_editor() and publication_status = 'draft'));
create policy "editors update drafts" on public.plazas for update
  using (public.is_publisher() or (public.is_editor() and publication_status = 'draft'))
  with check (public.is_publisher() or (public.is_editor() and publication_status = 'draft'));
create policy "editors delete drafts" on public.plazas for delete using (public.is_editor() and publication_status = 'draft');

create policy "editors insert drafts" on public.journeys for insert
  with check (public.is_publisher() or (public.is_editor() and publication_status = 'draft'));
create policy "editors update drafts" on public.journeys for update
  using (public.is_publisher() or (public.is_editor() and publication_status = 'draft'))
  with check (public.is_publisher() or (public.is_editor() and publication_status = 'draft'));
create policy "editors delete drafts" on public.journeys for delete using (public.is_editor() and publication_status = 'draft');

-- Tariffs: editors create and edit drafts that are not verified; publishers do the rest.
create policy "editors insert drafts" on public.tariffs for insert
  with check (public.is_publisher()
              or (public.is_editor() and publication_status = 'draft' and verification_status <> 'verified'));
create policy "editors update drafts" on public.tariffs for update
  using (public.is_publisher() or (public.is_editor() and publication_status = 'draft'))
  with check (public.is_publisher()
              or (public.is_editor() and publication_status = 'draft' and verification_status <> 'verified'));
create policy "editors delete drafts" on public.tariffs for delete using (public.is_editor() and publication_status = 'draft');

-- Corrections: admins triage; nobody else can read them.
create policy "admins read" on public.corrections for select using (public.is_editor());
create policy "admins update" on public.corrections for update using (public.is_editor()) with check (public.is_editor());

-- Audit log and admin list: admins read; written only by triggers / service role.
create policy "admins read" on public.audit_log for select using (public.is_editor());
create policy "admins read" on public.admin_users for select using (public.is_editor());

revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke insert, update, delete on public.admin_users from anon, authenticated;
revoke insert, delete on public.corrections from anon, authenticated;
revoke insert, update, delete on public.dataset_meta from anon, authenticated;
