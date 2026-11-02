import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Shirt, ShoppingBag, Sparkles, Sun, User } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { hydrateClosetFromStorage, switchCloset } from "@/lib/closet/store";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", label: "今日", icon: Sun },
  { to: "/wardrobe", label: "衣柜", icon: Shirt },
  { to: "/style", label: "风格", icon: Sparkles },
  { to: "/ask", label: "买前", icon: ShoppingBag },
  { to: "/calendar", label: "日历", icon: CalendarDays },
  { to: "/profile", label: "我的", icon: User },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrateClosetFromStorage();
  }, []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const authScreen = pathname === "/login" || pathname === "/register";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md overflow-x-hidden bg-background text-foreground shadow-soft">
      <main className={authScreen ? "" : "pb-28"}>
        <ClosetSync />
        {children}
      </main>
      {authScreen ? null : (
        <nav
          aria-label="主导航"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border bg-card/95 pb-safe backdrop-blur-xl"
        >
          <ul className="flex items-stretch justify-between px-1 pt-2">
            {TABS.map((tab) => (
              <Tab key={tab.to} {...tab} />
            ))}
          </ul>
        </nav>
      )}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-ink)",
            color: "var(--color-ink-foreground)",
            border: "none",
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

function Tab({ to, label, icon: Icon }: (typeof TABS)[number]) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <li className="flex-1">
      <Link
        to={to}
        className={cn(
          "flex min-h-12 flex-col items-center justify-center gap-1 text-muted-foreground",
          active && "text-primary",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
        <span className={cn("text-xs", active ? "font-semibold" : "font-medium")}>{label}</span>
        <span className={cn("h-1 w-1 rounded-full", active ? "bg-primary" : "bg-transparent")} />
      </Link>
    </li>
  );
}

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="animate-rise px-5 pt-12 pb-2">
      <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-3xl leading-tight font-medium italic">{title}</h1>
    </header>
  );
}
