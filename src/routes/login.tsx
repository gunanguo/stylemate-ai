import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SocialLogin } from "@/components/social-login";
import { authClient, rememberAuthResult } from "@/lib/auth/client";
import { authMessage } from "@/lib/auth/messages";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const nextEmail = email.trim();
    if (!nextEmail.includes("@")) {
      toast("请填写有效邮箱");
      return;
    }
    if (!password) {
      toast("请填写密码");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await authClient.signIn.email({ email: nextEmail, password });
      if (error) throw new Error(authMessage(error.message, "登录失败"));
      rememberAuthResult(data);
      await authClient.getSession();
      toast("已登录");
      await navigate({ to: "/profile" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (session.data?.user) void navigate({ to: "/profile" });
  }, [navigate, session.data?.user]);

  return (
    <div className="px-5 pt-12">
      <Link to="/profile" className="text-sm font-semibold text-primary">
        返回
      </Link>
      <p className="mt-8 text-xs font-medium text-muted-foreground">欢迎回来</p>
      <h1 className="mt-1 text-3xl font-semibold">登录</h1>
      <p className="mt-2 text-sm text-muted-foreground">用已经注册的邮箱进入衣橱。</p>
      <label className="mt-8 block text-xs text-muted-foreground">
        邮箱
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground outline-none"
        />
      </label>
      <label className="mt-4 block text-xs text-muted-foreground">
        密码
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground outline-none"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-8 min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "请稍候" : "登录"}
      </button>
      <SocialLogin />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        还没有账号？{" "}
        <Link to="/register" className="font-semibold text-primary">
          去注册
        </Link>
      </p>
    </div>
  );
}
