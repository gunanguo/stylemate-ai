import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closetIsEmpty, shouldImportLocalCloset, splitClosetImages } from "./snapshot.ts";
import type { ClosetData } from "./storage.ts";

function sample(image = ""): ClosetData {
  return {
    profile: { name: "小满", styles: ["极简"], city: "上海" },
    garments: [
      {
        id: "shirt",
        name: "白色衬衫",
        brand: "优衣库",
        category: "上衣",
        slot: "top",
        color: "白色",
        hex: "#fff",
        styles: ["极简"],
        cut: "直筒",
        price: 129,
        owned: true,
        image,
        warmth: 1,
        formality: 2,
        addedAt: 1,
      },
    ],
    outfits: [],
    worn: {},
    wornItems: {},
    shopping: [],
    dailyDate: "",
    dailyOutfitId: "",
    salt: 1,
  };
}

describe("closet snapshots", () => {
  it("moves inline photos onto the image route", () => {
    const split = splitClosetImages(sample("data:image/jpeg;base64,aaaa"));
    assert.equal(split.uploads.length, 1);
    assert.equal(split.uploads[0]?.id, "shirt");
    assert.equal(split.closet.garments[0]?.image, "/api/closet/images/shirt");
  });

  it("drops a photo that is too large to store", () => {
    const split = splitClosetImages(sample(`data:image/jpeg;base64,${"a".repeat(400_000)}`));
    assert.equal(split.uploads.length, 0);
    assert.equal(split.closet.garments[0]?.image, "");
    assert.match(split.warning ?? "", /太大/);
  });

  it("imports a local closet only once, and only into an empty account", () => {
    const local = sample("/wardrobe/shirt.svg");
    assert.equal(shouldImportLocalCloset({ server: null, local, alreadyImported: false }), true);
    assert.equal(shouldImportLocalCloset({ server: null, local, alreadyImported: true }), false);
    assert.equal(
      shouldImportLocalCloset({ server: local, local, alreadyImported: false }),
      false,
    );
    assert.equal(closetIsEmpty(sample("")), false);
    assert.equal(
      closetIsEmpty({ ...sample(""), garments: [], outfits: [], worn: {}, wornItems: {} }),
      true,
    );
  });
});
