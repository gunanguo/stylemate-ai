import { getSql, withTransaction, type Sql } from "../db.ts";
import { splitClosetImages } from "./snapshot.ts";
import { parseCloset, type ClosetData } from "./storage.ts";
import type { Garment, Outfit } from "./types.ts";

type ProfileRow = {
  name: string;
  city: string;
  styles: unknown;
  salt: number;
  daily_date: string;
  daily_outfit_id: string;
};

type GarmentRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  slot: string;
  color: string;
  hex: string;
  styles: unknown;
  cut: string;
  price: number;
  owned: boolean;
  image: string;
  warmth: number;
  formality: number;
  added_at: number;
};

type OutfitRow = {
  id: string;
  name: string;
  tags: unknown;
  garment_ids: unknown;
  score: number;
  occasion: string;
  note: string;
  saved: boolean;
  created_at: number;
};

function asStrings(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      return asStrings(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asLevel(value: number, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  return fallback;
}

function garmentFromRow(row: GarmentRow): Garment {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    category: row.category as Garment["category"],
    slot: row.slot as Garment["slot"],
    color: row.color,
    hex: row.hex,
    styles: asStrings(row.styles),
    cut: row.cut ?? "",
    price: Number(row.price) || 0,
    owned: Boolean(row.owned),
    image: row.image ?? "",
    warmth: asLevel(Number(row.warmth), 1),
    formality: asLevel(Number(row.formality), 1),
    addedAt: Number(row.added_at) || Date.now(),
  };
}

function outfitFromRow(row: OutfitRow): Outfit {
  return {
    id: row.id,
    name: row.name,
    tags: asStrings(row.tags),
    garmentIds: asStrings(row.garment_ids),
    score: Number(row.score) || 0,
    occasion: row.occasion ?? "",
    note: row.note ?? "",
    saved: Boolean(row.saved),
    createdAt: Number(row.created_at) || 0,
  };
}

export async function readClosetForUser(userId: string): Promise<ClosetData | null> {
  const sql = await getSql();
  const profiles = await sql<ProfileRow>`
    select name, city, styles, salt, daily_date, daily_outfit_id
    from closet_profiles where user_id = ${userId}
  `;
  const profile = profiles[0];
  if (!profile) return null;
  const garmentRows = await sql<GarmentRow>`
    select id, name, brand, category, slot, color, hex, styles, cut, price, owned, image, warmth, formality, added_at
    from garments where user_id = ${userId} order by added_at desc
  `;
  const outfitRows = await sql<OutfitRow>`
    select id, name, tags, garment_ids, score, occasion, note, saved, created_at
    from outfits where user_id = ${userId} order by created_at desc
  `;
  const wornRows = await sql<{ day: string; outfit_id: string; garment_ids: unknown }>`
    select day, outfit_id, garment_ids from worn_entries where user_id = ${userId}
  `;
  const shoppingRows = await sql<{ garment_id: string }>`
    select garment_id from shopping_items where user_id = ${userId}
  `;
  const worn: Record<string, string> = {};
  const wornItems: Record<string, string[]> = {};
  for (const row of wornRows) {
    worn[row.day] = row.outfit_id;
    wornItems[row.day] = asStrings(row.garment_ids);
  }
  return {
    profile: {
      name: profile.name,
      city: profile.city,
      styles: asStrings(profile.styles),
    },
    garments: garmentRows.map(garmentFromRow),
    outfits: outfitRows.map(outfitFromRow),
    worn,
    wornItems,
    shopping: shoppingRows.map((row) => row.garment_id),
    dailyDate: profile.daily_date ?? "",
    dailyOutfitId: profile.daily_outfit_id ?? "",
    salt: Number(profile.salt) || 1,
  };
}

export async function writeClosetForUser(userId: string, raw: ClosetData): Promise<{ closet: ClosetData; warning?: string }> {
  const parsed = parseCloset(raw);
  if (!parsed) throw new Error("衣橱数据无法保存");
  const split = splitClosetImages(parsed);
  const data = split.closet;
  await withTransaction(async (sql) => {
    await replaceCloset(sql, userId, data, split.uploads);
  });
  const closet = await readClosetForUser(userId);
  if (!closet) throw new Error("衣橱保存后没有读回来");
  return { closet, warning: split.warning };
}

async function replaceCloset(
  sql: Sql,
  userId: string,
  data: ClosetData,
  uploads: { id: string; dataUrl: string }[],
) {
  await sql`
    insert into closet_profiles (user_id, name, city, styles, salt, daily_date, daily_outfit_id, updated_at)
    values (
      ${userId},
      ${data.profile.name},
      ${data.profile.city},
      ${JSON.stringify(data.profile.styles)}::jsonb,
      ${data.salt},
      ${data.dailyDate},
      ${data.dailyOutfitId},
      now()
    )
    on conflict (user_id) do update set
      name = excluded.name,
      city = excluded.city,
      styles = excluded.styles,
      salt = excluded.salt,
      daily_date = excluded.daily_date,
      daily_outfit_id = excluded.daily_outfit_id,
      updated_at = now()
  `;
  await sql`delete from shopping_items where user_id = ${userId}`;
  await sql`delete from worn_entries where user_id = ${userId}`;
  await sql`delete from outfits where user_id = ${userId}`;
  await sql`delete from garments where user_id = ${userId}`;

  for (const garment of data.garments) {
    await sql`
      insert into garments (
        user_id, id, name, brand, category, slot, color, hex, styles, cut, price, owned, image, warmth, formality, added_at
      ) values (
        ${userId},
        ${garment.id},
        ${garment.name},
        ${garment.brand},
        ${garment.category},
        ${garment.slot},
        ${garment.color},
        ${garment.hex},
        ${JSON.stringify(garment.styles)}::jsonb,
        ${garment.cut},
        ${garment.price},
        ${garment.owned},
        ${garment.image},
        ${garment.warmth},
        ${garment.formality},
        ${garment.addedAt}
      )
    `;
  }
  for (const outfit of data.outfits) {
    await sql`
      insert into outfits (
        user_id, id, name, tags, garment_ids, score, occasion, note, saved, created_at
      ) values (
        ${userId},
        ${outfit.id},
        ${outfit.name},
        ${JSON.stringify(outfit.tags)}::jsonb,
        ${JSON.stringify(outfit.garmentIds)}::jsonb,
        ${outfit.score},
        ${outfit.occasion},
        ${outfit.note},
        ${outfit.saved},
        ${outfit.createdAt}
      )
    `;
  }
  for (const [day, outfitId] of Object.entries(data.worn)) {
    if (!outfitId) continue;
    await sql`
      insert into worn_entries (user_id, day, outfit_id, garment_ids)
      values (
        ${userId},
        ${day},
        ${outfitId},
        ${JSON.stringify(data.wornItems[day] ?? [])}::jsonb
      )
    `;
  }
  for (const garmentId of data.shopping) {
    await sql`
      insert into shopping_items (user_id, garment_id) values (${userId}, ${garmentId})
    `;
  }

  const keep = new Set(uploads.map((item) => item.id));
  for (const garment of data.garments) {
    if (garment.image.startsWith("/api/closet/images/")) keep.add(garment.id);
  }
  const keptIds = [...keep];
  if (keptIds.length === 0) {
    await sql`delete from garment_images where user_id = ${userId}`;
  } else {
    await sql`
      delete from garment_images
      where user_id = ${userId} and not (garment_id = any(${keptIds}::text[]))
    `;
  }
  for (const upload of uploads) {
    await sql`
      insert into garment_images (user_id, garment_id, data_url)
      values (${userId}, ${upload.id}, ${upload.dataUrl})
      on conflict (user_id, garment_id) do update set data_url = excluded.data_url
    `;
  }
}

export async function readGarmentImage(userId: string, garmentId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ data_url: string }>`
    select data_url from garment_images where user_id = ${userId} and garment_id = ${garmentId}
  `;
  return rows[0]?.data_url ?? null;
}
