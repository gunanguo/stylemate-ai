import { toast } from "sonner";
import { GROK_PROVIDERS, signIn, socialLoginEnabled } from "@/lib/auth/client";

/** Third-party buttons. Rendered only when `VITE_SOCIAL_LOGIN=true`. */
export function SocialLogin({ callbackURL = "/profile" }: { callbackURL?: string }) {
  if (!socialLoginEnabled) return null;
  return (
    <div className="mt-6 space-y-2">
      <p className="text-center text-xs text-muted-foreground">或使用已配置的第三方账号</p>
      {GROK_PROVIDERS.map((provider) => (
        <button
          key={provider.providerId}
          type="button"
          onClick={() => {
            void signIn(provider.providerId, { callbackURL }).catch((error: unknown) => {
              toast(error instanceof Error ? error.message : "登录失败");
            });
          }}
          className="min-h-12 w-full rounded-xl border border-border bg-card text-sm font-semibold"
        >
          使用 {provider.label} 登录
        </button>
      ))}
    </div>
  );
}
