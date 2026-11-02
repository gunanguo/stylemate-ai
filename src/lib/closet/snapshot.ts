import type { ClosetData } from "@/lib/closet/storage";

export const GARMENT_IMAGE_PREFIX = "/api/closet/images/";

const MAX_DATA_URL = 400_000;

export function garmentImagePath(id: string) {
  return `${GARMENT_IMAGE_PREFIX}${encodeURIComponent(id)}`;
}

export function closetIsEmpty(data: ClosetData | null | undefined) {
  if (!data) return true;
  return data.garments.length === 0 && data.outfits.length === 0 && Object.keys(data.worn).length === 0;
}

export type ImageUpload = { id: string; dataUrl: string };

/**
 * Pull inline photos out of a closet document. The row keeps a stable URL
 * the browser can request; the bytes go to garment_images.
 */
export function splitClosetImages(data: ClosetData): {
  closet: ClosetData;
  uploads: ImageUpload[];
  warning?: string;
} {
  const uploads: ImageUpload[] = [];
  let stripped = false;
  const garments = data.garments.map((garment) => {
    if (!garment.image.startsWith("data:image/")) return garment;
    if (garment.image.length > MAX_DATA_URL) {
      stripped = true;
      return { ...garment, image: "" };
    }
    uploads.push({ id: garment.id, dataUrl: garment.image });
    return { ...garment, image: garmentImagePath(garment.id) };
  });
  return {
    closet: { ...data, garments },
    uploads,
    warning: stripped ? "有照片太大，没有存进衣橱" : undefined,
  };
}

/** Import the on-device closet once, and only when the server copy is still empty. */
export function shouldImportLocalCloset(input: {
  server: ClosetData | null;
  local: ClosetData | null;
  alreadyImported: boolean;
}) {
  if (input.alreadyImported) return false;
  if (!closetIsEmpty(input.server)) return false;
  return !closetIsEmpty(input.local);
}
