import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseCloset, type ClosetData } from "@/lib/closet/storage";

export type ClosetSyncResult = { closet: ClosetData | null; warning?: string };

export const loadCloset = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ClosetSyncResult> => {
    const { readClosetForUser } = await import("./repository.server");
    const closet = await readClosetForUser(context.userId);
    return { closet };
  });

export const saveCloset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const closet = parseCloset(input);
    if (!closet) throw new Error("衣橱数据无法保存");
    if (closet.garments.length > 200) throw new Error("衣物太多了，先删掉一些再保存");
    return closet;
  })
  .handler(async ({ data, context }): Promise<ClosetSyncResult> => {
    const { writeClosetForUser } = await import("./repository.server");
    const written = await writeClosetForUser(context.userId, data);
    return { closet: written.closet, warning: written.warning };
  });
