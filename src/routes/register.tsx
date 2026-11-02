import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SocialLogin } from "@/components/social-login";
import { authClient, rememberAuthResult } from "@/lib/auth/client";
import { authMessage } from "@/lib/auth/messages";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const nextEmail = email.trim();
    if (!name.trim()) {
      toast("请填写名字");
      return;
    }
    if (!nextEmail.includes("@")) {
      toast("请填写有效邮箱");
      return;
    }
    if (password.length < 8) {
      toast("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      toast("两次密码不一致");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await authClient.signUp.email({
        email: nextEmail,
        password,
        name: name.trim(),
      });
      if (error) throw new Error(authMessage(error.message, "注册失败"));
      rememberAuthResult(data);
      await authClient.getSession();
      toast("注册成功");
      await navigate({ to: "/profile" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (session.data?.user) void navigate({ to: "/profile" });
  }, [navigate, session.data?.user]);

  return (
    <div className="px-5 pt-12 pb-10">
      <Link to="/login" className="text-sm font-semibold text-primary">
        返回登录
      </Link>
      <p className="mt-8 text-xs font-medium text-muted-foreground">新账号</p>
      <h1 className="mt-1 text-3xl font-semibold">注册</h1>
      <p className="mt-2 text-sm text-muted-foreground">建一个邮箱账号，再回到衣橱。</p>
      <label className="mt-8 block text-xs text-muted-foreground">
        名字
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground outline-none"
        />
      </label>
      <label className="mt-4 block text-xs text-muted-foreground">
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
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground outline-none"
        />
      </label>
      <label className="mt-4 block text-xs text-muted-foreground">
        再输入一次密码
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          type="password"
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground outline-none"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-8 min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "请稍候" : "注册"}
      </button>
      <SocialLogin />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <Link to="/login" className="font-semibold text-primary">
          去登录
        </Link>
      </p>
    </div>
  );
}
