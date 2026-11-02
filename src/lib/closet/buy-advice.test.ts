import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEED_GARMENTS } from "./catalog.ts";
import { adviseFromCloset, coerceBuyAdvice } from "./buy-advice.ts";

describe("buy-before advice", () => {
  it("tells you to skip a white shirt you already own", () => {
    const advice = adviseFromCloset("优衣库白色衬衫", SEED_GARMENTS);
    assert.equal(advice.verdict, "skip");
    assert.ok(advice.similar.some((item) => item.id === "shirt"));
    assert.ok(advice.outfitCount >= 1);
  });

  it("drops closet ids the model invented", () => {
    const fallback = adviseFromCloset("红色大衣", SEED_GARMENTS);
    const advice = coerceBuyAdvice(
      {
        verdict: "buy",
        headline: "能穿很多次",
        reasons: ["没有红色外套。"],
        similarIds: ["不存在", "trench"],
        outfits: [{ name: "风衣日", garmentIds: ["trench", "虚构", "shirt", "skirt"] }],
      },
      SEED_GARMENTS,
      fallback,
    );
    assert.equal(advice.source, "model");
    assert.equal(advice.verdict, "buy");
    assert.deepEqual(advice.similar.map((item) => item.id), ["trench"]);
    assert.deepEqual(advice.outfits[0]?.garmentIds, ["trench", "shirt", "skirt"]);
    assert.equal(advice.outfitCount, 1);
  });
});
