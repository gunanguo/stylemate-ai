import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient, rememberSessionToken } from "@/lib/auth/client";

export function AccountCard() {
  const session = authClient.useSession();
  const user = session.data?.user;

  if (session.isPending) return null;

  if (user) {
    return (
      <section className="mt-4 rounded-3xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">账号</p>
        <p className="mt-1 font-semibold">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          这个账号的衣橱单独保存。退出后会回到未登录时的那一份。
        </p>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut().finally(() => {
              rememberSessionToken(null);
              toast("已退出");
            });
          }}
          className="mt-3 min-h-11 text-sm font-semibold text-primary"
        >
          退出登录
        </button>
      </section>
    );
  }

  return (
    <Link
      to="/login"
      className="mt-4 flex min-h-16 items-center justify-between rounded-3xl border border-border bg-card px-4"
    >
      <span>
        <span className="block text-sm font-semibold">登录账号</span>
        <span className="text-xs text-muted-foreground">还没有账号可以去注册</span>
      </span>
      <span className="text-sm font-semibold text-primary">进入</span>
    </Link>
  );
}
