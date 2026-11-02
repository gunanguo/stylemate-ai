import { useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { clearIntent, readIntent, saveIntent, type AccountIntent } from "@/lib/account-intent";
import { authClient } from "@/lib/auth/client";
import { useCloset } from "@/lib/closet/store";

const AccountGateContext = createContext<(intent: AccountIntent) => boolean>(() => true);

export function useRequireAccount() {
  return useContext(AccountGateContext);
}

export function AccountGate({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const requireAccount = useCallback(
    (intent: AccountIntent) => {
      if (session.isPending) return false;
      if (session.data?.user) return true;
      saveIntent(intent);
      setOpen(true);
      return false;
    },
    [session.data?.user, session.isPending],
  );

  function dismiss() {
    clearIntent();
    setOpen(false);
  }

  return (
    <AccountGateContext.Provider value={requireAccount}>
      {children}
      <ResumeIntent />
      {open ? (
        <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-md items-end bg-ink/40">
          <div
            role="dialog"
            aria-labelledby="account-gate-title"
            className="w-full rounded-t-3xl bg-background px-5 pt-4 pb-10"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <h2 id="account-gate-title" className="text-2xl font-semibold text-primary">
              登录后，衣橱就是你的了
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              换一部手机，衣橱和搭配也会跟着过去。
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/login" });
              }}
              className="mt-6 min-h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              登录 / 注册
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="mt-2 min-h-12 w-full rounded-2xl bg-secondary text-sm font-semibold"
            >
              先随便看看
            </button>
          </div>
        </div>
      ) : null}
    </AccountGateContext.Provider>
  );
}

function ResumeIntent() {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const readyOwner = useCloset((state) => state.readyOwner);
  const userId = session.data?.user.id;

  useEffect(() => {
    if (!userId || readyOwner !== userId) return;
    const intent = readIntent();
    if (!intent) return;
    clearIntent();
    const state = useCloset.getState();
    if (intent.kind === "add") {
      void navigate({ to: "/wardrobe", search: { add: true } });
      return;
    }
    if (intent.kind === "piece") {
      void navigate({ to: "/wardrobe", search: { piece: intent.id } });
      return;
    }
    if (intent.kind === "calendar" || intent.kind === "profile") {
      void navigate({ to: intent.kind === "calendar" ? "/calendar" : "/profile" });
      return;
    }
    if (intent.kind === "wear" && state.outfits.some((item) => item.id === intent.outfitId)) {
      state.wear(intent.date, intent.outfitId);
      toast("这天的穿搭已安排");
      void navigate({ to: "/calendar" });
      return;
    }
    if (intent.kind === "save" && state.outfits.some((item) => item.id === intent.outfitId)) {
      state.toggleSave(intent.outfitId);
      toast("已收藏造型");
      return;
    }
    if (intent.kind === "shop") {
      const ids = intent.ids.filter((id) => state.garments.some((item) => item.id === id && !item.owned));
      if (ids.length > 0) {
        state.addShopping(ids);
        toast("已加入购买清单");
      }
      return;
    }
    if (intent.kind === "own") {
      const garment = state.garments.find((item) => item.id === intent.id && !item.owned);
      if (garment) {
        state.markOwned(garment.id);
        toast(`「${garment.name}」已放入衣橱`);
      }
    }
  }, [navigate, readyOwner, userId]);

  return null;
}
