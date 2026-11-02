export const CATEGORIES = ["全部", "上衣", "裤子", "裙子", "外套", "鞋子", "包包", "配饰"] as const;
export type Category = (typeof CATEGORIES)[number];
export type GarmentCategory = Exclude<Category, "全部">;

export const STYLE_TAGS = [
  "极简",
  "静奢风",
  "职场通勤",
  "法式",
  "复古",
  "休闲",
  "甜美",
  "街头",
  "运动",
  "优雅",
  "度假",
  "约会",
] as const;

export const COLOR_OPTIONS = [
  "黑色",
  "白色",
  "奶油白",
  "燕麦色",
  "驼色",
  "棕色",
  "灰色",
  "藏青",
  "蓝色",
  "绿色",
  "红色",
  "粉色",
] as const;

export const OCCASIONS = ["日常", "上班", "约会", "聚会", "旅行", "运动"] as const;
export const MOODS = ["休闲", "优雅", "自信", "甜美", "酷飒", "简约"] as const;
export const WEATHERS = ["炎热", "温暖", "凉爽", "寒冷"] as const;

export type Slot = "top" | "bottom" | "onepiece" | "outer" | "shoes" | "bag" | "extra";

export type Garment = {
  id: string;
  name: string;
  brand: string;
  category: GarmentCategory;
  slot: Slot;
  color: string;
  hex: string;
  styles: string[];
  cut: string;
  price: number;
  owned: boolean;
  image: string;
  warmth: 1 | 2 | 3;
  formality: 1 | 2 | 3;
  addedAt: number;
};

export type Outfit = {
  id: string;
  name: string;
  tags: string[];
  garmentIds: string[];
  score: number;
  occasion: string;
  note: string;
  saved: boolean;
  createdAt: number;
};

export type Profile = {
  name: string;
  styles: string[];
  city: string;
};
