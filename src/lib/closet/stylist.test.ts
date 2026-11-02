import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEED_GARMENTS, SEED_OUTFITS } from "./catalog.ts";
import { coerceOutfits, suggestOutfits } from "./stylist.ts";

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
