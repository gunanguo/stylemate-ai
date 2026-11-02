import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/style")({
  beforeLoad: () => {
    throw redirect({ to: "/looks", search: { tab: "generate" } });
  },
});
