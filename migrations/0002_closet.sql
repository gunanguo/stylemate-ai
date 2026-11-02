-- Per-user wardrobe. Photos are kept out of the garment row so a closet
-- load does not ship every JPEG. Applied to PGLite on startup and to
-- DATABASE_URL by scripts/migrate.mjs.

create table if not exists closet_profiles (
  user_id text primary key references "user" ("id") on delete cascade,
  name text not null,
  city text not null,
  styles jsonb not null default '[]'::jsonb,
  salt integer not null default 1,
  daily_date text not null default '',
  daily_outfit_id text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists garments (
  user_id text not null references "user" ("id") on delete cascade,
  id text not null,
  name text not null,
  brand text not null default '',
  category text not null,
  slot text not null,
  color text not null,
  hex text not null,
  styles jsonb not null default '[]'::jsonb,
  cut text not null default '',
  price integer not null default 0,
  owned boolean not null default true,
  image text not null default '',
  warmth smallint not null default 1,
  formality smallint not null default 1,
  added_at bigint not null,
  primary key (user_id, id)
);

create table if not exists outfits (
  user_id text not null references "user" ("id") on delete cascade,
  id text not null,
  name text not null,
  tags jsonb not null default '[]'::jsonb,
  garment_ids jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  occasion text not null default '',
  note text not null default '',
  saved boolean not null default false,
  created_at bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists worn_entries (
  user_id text not null references "user" ("id") on delete cascade,
  day text not null,
  outfit_id text not null,
  garment_ids jsonb not null default '[]'::jsonb,
  primary key (user_id, day)
);

create table if not exists shopping_items (
  user_id text not null references "user" ("id") on delete cascade,
  garment_id text not null,
  primary key (user_id, garment_id)
);

create table if not exists garment_images (
  user_id text not null references "user" ("id") on delete cascade,
  garment_id text not null,
  data_url text not null,
  primary key (user_id, garment_id)
);
