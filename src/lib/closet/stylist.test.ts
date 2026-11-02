import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEED_GARMENTS, SEED_OUTFITS } from "./catalog.ts";
import { coerceOutfits, suggestOutfits, swapGarment, swapOptions } from "./stylist.ts";

const SEED_LOOK_NAMES = new Set(SEED_OUTFITS.map((outfit) => outfit.name));

describe("outfit suggestions", () => {
  it("does not attach a fake match percentage", () => {
    const outfits = suggestOutfits(SEED_GARMENTS, {
      occasion: "上班",
      mood: "优雅",
      weather: "凉爽",
      salt: 2,
      preferred: ["静奢风"],
      limit: 2,
    });
    assert.ok(outfits.length > 0);
    for (const outfit of outfits) {
      assert.equal(outfit.score, 0);
      assert.equal(SEED_LOOK_NAMES.has(outfit.name), false);
      for (const id of outfit.garmentIds) {
        assert.ok(SEED_GARMENTS.some((garment) => garment.id === id));
      }
    }
  });

  it("gives one batch three different commute names", () => {
    const outfits = suggestOutfits(SEED_GARMENTS, {
      occasion: "上班",
      mood: "优雅",
      weather: "凉爽",
      salt: 4,
      preferred: ["职场通勤"],
      limit: 3,
    });
    assert.equal(outfits.length, 3);
    const names = outfits.map((outfit) => outfit.name);
    assert.equal(new Set(names).size, names.length);
    for (const name of names) {
      assert.equal(SEED_LOOK_NAMES.has(name), false);
      assert.match(name, /通勤|开会|办公/);
      assert.match(name, /温柔/);
    }
  });

  it("lists owned pieces before wishes in the same category", () => {
    const shirt = SEED_GARMENTS.find((item) => item.id === "shirt");
    assert.ok(shirt);
    const options = swapOptions(SEED_GARMENTS, shirt, ["shirt", "black-pants"]);
    assert.ok(options.length > 0);
    assert.equal(options.some((item) => item.category !== "上衣"), false);
    const firstWish = options.findIndex((item) => !item.owned);
    const lastOwned = options.map((item) => item.owned).lastIndexOf(true);
    if (firstWish >= 0 && lastOwned >= 0) assert.ok(lastOwned < firstWish);
    const swapped = swapGarment(
      { id: "look", name: "测试", tags: [], garmentIds: ["shirt", "black-pants"], score: 0, occasion: "上班", note: "", saved: false, createdAt: 0 },
      "shirt",
      options[0]!,
      SEED_GARMENTS,
      "凉爽",
      false,
    );
    assert.equal(swapped.garmentIds[0], options[0]?.id);
    assert.match(swapped.note, /叠穿|微风|外套/);
  });

  it("keeps only real closet ids and a wearable combination", () => {
    const outfits = coerceOutfits(
      {
        outfits: [
          { name: "瞎编一套", garmentIds: ["不存在", "shirt", "black-pants"], note: "白衬衫收进黑西裤。" },
          { name: "只有鞋", garmentIds: ["loafers"], note: "不能单独出门。" },
        ],
      },
      SEED_GARMENTS,
      { occasion: "上班", mood: "简约" },
    );
    assert.equal(outfits?.length, 1);
    assert.deepEqual(outfits?.[0]?.garmentIds, ["shirt", "black-pants"]);
    assert.equal(outfits?.[0]?.score, 0);
    assert.match(outfits?.[0]?.note ?? "", /白衬衫/);
  });
});
