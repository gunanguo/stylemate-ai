import { COLOR_HEX } from "@/lib/closet/catalog";
import { COLOR_OPTIONS } from "@/lib/closet/types";

export function dominantColor(dataUrl: string) {
  return new Promise<string | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(image, 0, 0, 24, 24);
      const data = ctx.getImageData(0, 0, 24, 24).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      for (let index = 0; index < data.length; index += 16) {
        const r = data[index] ?? 0;
        const g = data[index + 1] ?? 0;
        const b = data[index + 2] ?? 0;
        const a = data[index + 3] ?? 0;
        if (a < 200) continue;
        if (r > 245 && g > 245 && b > 245) continue;
        red += r;
        green += g;
        blue += b;
        count += 1;
      }
      if (count === 0) {
        resolve(null);
        return;
      }
      resolve(nearestColor(red / count, green / count, blue / count));
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

function nearestColor(red: number, green: number, blue: number) {
  let best: (typeof COLOR_OPTIONS)[number] = COLOR_OPTIONS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const name of COLOR_OPTIONS) {
    const hex = COLOR_HEX[name];
    if (!hex) continue;
    const channel = hexToRgb(hex);
    const distance = (channel[0] - red) ** 2 + (channel[1] - green) ** 2 + (channel[2] - blue) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}
