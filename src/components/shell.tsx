import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Shirt, Sun, User } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AccountGate } from "@/components/account-gate";
import { hydrateClosetFromStorage, switchCloset } from "@/lib/closet/store";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", label: "今日", icon: Sun, match: (path: string) => path === "/" },
  { to: "/wardrobe", label: "衣橱", icon: Shirt, match: (path: string) => path.startsWith("/wardrobe") },
  {
    to: "/looks",
    label: "搭配",
    icon: LayoutGrid,
    match: (path: string) => path.startsWith("/looks") || path === "/style" || path === "/calendar",
  },
  { to: "/profile", label: "我的", icon: User, match: (path: string) => path.startsWith("/profile") },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrateClosetFromStorage();
  }, []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const authScreen = pathname === "/login" || pathname === "/register";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md overflow-x-hidden bg-background text-foreground">
      <main className={authScreen ? "" : "pb-28"}>
        <ClosetSync />
        <AccountGate>{children}</AccountGate>
      </main>
      {authScreen ? null : (
        <nav
          aria-label="主导航"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border bg-background/80 pb-safe backdrop-blur-xl"
        >
          <ul className="flex items-stretch justify-between px-2 pt-2">
            {TABS.map((tab) => (
              <Tab key={tab.to} {...tab} active={tab.match(pathname)} />
            ))}
          </ul>
        </nav>
      )}
      <Toaster
        position="bottom-center"
        offset={authScreen ? "1rem" : "calc(5.75rem + env(safe-area-inset-bottom))"}
        mobileOffset={authScreen ? "1rem" : "calc(5.75rem + env(safe-area-inset-bottom))"}
        toastOptions={{
          style: {
            background: "#faf8f5",
            color: "#1c1b19",
            border: "1px solid #e9e5df",
            fontFamily: "inherit",
          },
        }}
      />
    </div>
  );
}

function ClosetSync() {
  const session = authClient.useSession();
  const userId = session.data?.user.id ?? null;
  const name = session.data?.user.name;
  useEffect(() => {
    if (session.isPending) return;
    switchCloset(userId, name);
  }, [session.isPending, userId, name]);
  return null;
}

function Tab({
  to,
  label,
  icon: Icon,
  active,
}: (typeof TABS)[number] & { active: boolean }) {
  return (
    <li className="flex-1">
      <Link
        to={to}
        search={to === "/looks" ? { tab: "generate" } : undefined}
        className={cn(
          "flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground",
          active && "text-foreground",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.25} />
        <span>{label}</span>
        <span className={cn("h-[3px] w-[3px] rounded-full", active ? "bg-accent" : "bg-transparent")} />
      </Link>
    </li>
  );
}

export function PageHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 pt-12">
      <h1 className="display">{title}</h1>
      {aside}
    </header>
  );
}
