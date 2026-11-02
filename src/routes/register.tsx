import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthField, AuthScreen, authInputClass } from "@/components/auth-screen";
import { readIntent } from "@/lib/account-intent";
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
    if (!name.trim()) {
      setError("请填写名字");
      return;
    }
    if (!nextEmail.includes("@")) {
      setError("请填写有效邮箱");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await authClient.signUp.email({
        email: nextEmail,
        password,
        name: name.trim(),
      });
      if (authError) throw new Error(authMessage(authError.message, "注册失败"));
      rememberAuthResult(data);
      await authClient.getSession();
      await goOn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  const userId = session.data?.user.id;
  useEffect(() => {
    if (userId) void goOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <AuthScreen title="注册" lede="建一个邮箱账号，衣橱就只属于你。" error={error} switchHref="/login" switchText="已有账号？去登录">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <AuthField label="名字">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className={authInputClass}
          />
        </AuthField>
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
            autoComplete="new-password"
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="再输入一次密码">
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            type="password"
            autoComplete="new-password"
            className={authInputClass}
          />
        </AuthField>
        <button
          type="submit"
          disabled={busy}
          className="mt-8 min-h-12 w-full bg-ink text-sm text-ink-foreground disabled:opacity-60"
        >
          {busy ? "请稍候" : "注册"}
        </button>
      </form>
    </AuthScreen>
  );
}
