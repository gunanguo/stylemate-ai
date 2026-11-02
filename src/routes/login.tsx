import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthField, AuthScreen, authInputClass } from "@/components/auth-screen";
import { readIntent } from "@/lib/account-intent";
import { authClient, rememberAuthResult } from "@/lib/auth/client";
import { authMessage } from "@/lib/auth/messages";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function goOn() {
    const intent = readIntent();
    if (intent?.kind === "add") {
      await navigate({ to: "/wardrobe", search: { add: true } });
      return;
    }
    if (intent?.kind === "piece") {
      await navigate({ to: "/wardrobe", search: { piece: intent.id } });
      return;
    }
    if (intent?.kind === "wear" || intent?.kind === "calendar") {
      await navigate({ to: "/looks", search: { tab: "calendar" } });
      return;
    }
    if (intent?.kind === "profile") {
      await navigate({ to: "/profile" });
      return;
    }
    await navigate({ to: intent ? "/" : "/profile" });
  }

  async function submit() {
    const nextEmail = email.trim();
    if (!nextEmail.includes("@")) {
      setError("请填写有效邮箱");
      return;
    }
    if (!password) {
      setError("请填写密码");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await authClient.signIn.email({ email: nextEmail, password });
      if (authError) throw new Error(authMessage(authError.message, "登录失败"));
      rememberAuthResult(data);
      await authClient.getSession();
      await goOn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  const userId = session.data?.user.id;
  useEffect(() => {
    if (userId) void goOn();
    // Resume once when a session is already present. goOn reads the latest intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <AuthScreen title="登录" lede="用邮箱回到你自己的衣橱。" error={error} switchHref="/register" switchText="没有账号？去注册">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <AuthField label="邮箱">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="密码">
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            className={authInputClass}
          />
        </AuthField>
        <button
          type="submit"
          disabled={busy}
          className="mt-8 min-h-12 w-full bg-ink text-sm text-ink-foreground disabled:opacity-60"
        >
          {busy ? "请稍候" : "登录"}
        </button>
      </form>
    </AuthScreen>
  );
}
