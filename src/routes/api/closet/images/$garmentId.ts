import { createFileRoute } from "@tanstack/react-router";

function imageResponse(dataUrl: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return new Response("Not found", { status: 404 });
  const bytes = Buffer.from(match[2] ?? "", "base64");
  return new Response(bytes, {
    headers: {
      "content-type": match[1] ?? "image/jpeg",
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}

export const Route = createFileRoute("/api/closet/images/$garmentId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const garmentId = decodeURIComponent(params.garmentId);
        const { auth } = await import("@/lib/auth/server");
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const { readGarmentImage } = await import("@/lib/closet/repository.server");
        const dataUrl = await readGarmentImage(session.user.id, garmentId);
        if (!dataUrl) return new Response("Not found", { status: 404 });
        return imageResponse(dataUrl);
      },
    },
  },
});
