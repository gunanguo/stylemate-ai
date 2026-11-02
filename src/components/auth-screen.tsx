import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function BrandMark({ tagline = false, className = "" }: { tagline?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[30px] leading-tight font-light tracking-tight">
        StyleMate <span className="text-accent">AI</span>
      </p>
      {tagline ? <p className="mt-3 text-sm text-muted-foreground">懂你衣橱的穿搭助理</p> : null}
    </div>
  );
}

export function AuthScreen({
  title,
  lede,
  error,
  children,
  switchHref,
  switchText,
}: {
  title: string;
  lede: string;
  error?: string;
  children: ReactNode;
  switchHref: "/login" | "/register";
  switchText: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-16 pb-10">
      <BrandMark tagline />
      <h1 className="display mt-10">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{lede}</p>
      <div className="mt-6">{children}</div>
      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to={switchHref} className="text-foreground underline underline-offset-4">
          {switchText}
        </Link>
      </p>
      <Link to="/" className="mt-4 text-center text-sm font-normal text-muted-foreground">
        先不登录，随便看看
      </Link>
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-4 block text-xs font-medium text-muted-foreground first:mt-0">
      {label}
      {children}
    </label>
  );
}

export const authInputClass =
  "mt-1.5 w-full border-b border-border bg-transparent px-0 py-3 text-base text-foreground outline-none";
