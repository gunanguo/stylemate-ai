import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Shell } from "@/components/shell";
import appCss from "../styles.css?url";

const APP_NAME = "StyleMate AI — 你的衣橱造型师";
const SPLASH_KEY = "stylemate-splash";

const SPLASH_CSS = `
#stylemate-splash{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:#f7f3ee;color:#2c2825;opacity:1;animation:stylemate-splash-out .3s ease .8s forwards}
@keyframes stylemate-splash-out{from{opacity:1}to{opacity:0;visibility:hidden}}
html.splash-seen #stylemate-splash{display:none !important;animation:none !important}
@media (prefers-reduced-motion: reduce){#stylemate-splash{animation:none}}
`;

const SPLASH_SEEN_SCRIPT = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_KEY)})==="1")document.documentElement.classList.add("splash-seen")}catch(e){}})();`;

const SPLASH_BOOT_SCRIPT = `(function(){var el=document.getElementById("stylemate-splash");if(!el)return;var key=${JSON.stringify(SPLASH_KEY)};if(document.documentElement.classList.contains("splash-seen"))return;var reduce=false;try{reduce=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}setTimeout(function(){try{sessionStorage.setItem(key,"1")}catch(e){}document.documentElement.classList.add("splash-seen");if(el.parentNode)el.remove()},reduce?180:1120)})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content: "从你自己的数字衣橱里搭配今日造型，并补齐还缺的单品。",
      },
      { name: "theme-color", content: "#f7f3ee" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "StyleMate AI" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-180.png" },
      { rel: "apple-touch-startup-image", href: "/splash-startup.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = document.documentElement.classList.contains("splash-seen");
    if (seen) {
      setSplash(false);
      return;
    }
    const timer = window.setTimeout(() => setSplash(false), reduce ? 180 : 1120);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={
        typeof document !== "undefined" && document.documentElement.classList.contains("splash-seen")
          ? "splash-seen"
          : undefined
      }
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SEEN_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
        <HeadContent />
      </head>
      <body>
        {splash ? (
          <div
            id="stylemate-splash"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f7f3ee",
              color: "#2c2825",
              opacity: 1,
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontFamily: '"Plus Jakarta Sans","PingFang SC","Noto Sans SC",sans-serif',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "1.875rem",
                  fontWeight: 600,
                  fontStyle: "italic",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                StyleMate <span style={{ color: "#c45c32" }}>AI</span>
              </p>
              <p
                style={{
                  margin: "0.75rem 0 0",
                  fontSize: "0.875rem",
                  fontStyle: "normal",
                  fontWeight: 500,
                  color: "#4a453f",
                }}
              >
                懂你衣橱的穿搭助理
              </p>
            </div>
          </div>
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT_SCRIPT }} />
        <PreviewHostBridge />
        <AuthProvider>
          <Shell>
            <Outlet />
          </Shell>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
