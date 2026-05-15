"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Settings,
  BookOpen,
  MessageCircle,
  Globe,
  Sparkles,
  LogOut,
  Coins,
  Zap,
  ChevronDown,
} from "lucide-react";

interface AccountDropdownProps {
  email: string;
  credits: number;
  displayName: string | null;
  avatarUrl: string | null;
  onRefresh?: () => void;
}

export function AccountDropdown({
  email,
  credits,
  displayName,
  avatarUrl,
  onRefresh,
}: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  // Listen for profile updates from account page
  useEffect(() => {
    const handler = () => {
      if (onRefresh) onRefresh();
    };
    window.addEventListener("nova-profile-update", handler);
    return () => window.removeEventListener("nova-profile-update", handler);
  }, [onRefresh]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }, [supabase, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const getInitial = () => {
    if (displayName) return displayName[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return "N";
  };

  const displayLabel = displayName || email.split("@")[0] || "用户";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Trigger Button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/50 px-2.5 py-1.5 text-sm transition-all hover:border-accent-violet/30 hover:bg-accent-violet/5"
      >
        {/* Avatar */}
        <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent-violet to-accent-violet-light">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-white">
              {getInitial()}
            </span>
          )}
        </div>

        {/* Name */}
        <span className="hidden max-w-[100px] truncate text-xs font-medium text-foreground sm:block">
          {displayLabel}
        </span>

        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Dropdown Menu ──────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 animate-fade-in-scale">
          {/* Glow */}
          <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/20 via-transparent to-accent-violet/5 opacity-60 blur-xl" />

          <div className="relative rounded-2xl border border-border/50 bg-card/90 p-2 backdrop-blur-xl shadow-2xl shadow-black/20">
            {/* ── User Info ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 border-b border-border/20 px-3 pb-3">
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent-violet/20 bg-gradient-to-br from-accent-violet to-accent-violet-light">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {getInitial()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName || "用户"}
                </p>
                <p className="truncate text-xs text-text-muted">{email}</p>
              </div>
            </div>

            {/* ── Plan & Credits ─────────────────────────────────── */}
            <div className="border-b border-border/20 px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-accent-violet/20 bg-accent-violet/10 px-2 py-0.5 text-xs font-medium text-accent-violet-light">
                  <Zap className="h-3 w-3" />
                  Free
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <Coins className="h-3 w-3 text-amber-400" />
                  <span className="font-medium text-amber-400">{credits}</span>{" "}
                  积分
                </span>
              </div>

              <Link
                href="/create"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-violet to-accent-violet-light px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                升级套餐
              </Link>
            </div>

            {/* ── Menu Items ─────────────────────────────────────── */}
            <div className="py-1">
              <MenuItem
                icon={<Settings className="h-4 w-4" />}
                label="账户管理"
                onClick={() => {
                  setOpen(false);
                  router.push("/account");
                }}
              />
              <MenuItem
                icon={<BookOpen className="h-4 w-4" />}
                label="使用指南"
                onClick={() => showToast("使用指南即将开放")}
              />
              <MenuItem
                icon={<MessageCircle className="h-4 w-4" />}
                label="联系我们"
                onClick={() => showToast("请联系管理员")}
              />
              <MenuItem
                icon={<Globe className="h-4 w-4" />}
                label="简体中文"
                disabled
              />
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="border-t border-border/20 pt-1">
              <MenuItem
                icon={<Sparkles className="h-4 w-4" />}
                label="Nova Studio"
                onClick={() => {
                  setOpen(false);
                  router.push("/create");
                }}
              />
              <MenuItem
                icon={<LogOut className="h-4 w-4" />}
                label="退出登录"
                onClick={() => {
                  setOpen(false);
                  handleLogout();
                }}
                danger
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 animate-fade-in-scale">
          <div className="flex items-center gap-2 rounded-xl border border-accent-violet/20 bg-card/90 px-4 py-2.5 text-sm font-medium text-accent-violet-light shadow-lg backdrop-blur-sm">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Menu Item Component ──────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
        danger
          ? "text-text-muted hover:bg-red-400/10 hover:text-red-400"
          : disabled
            ? "cursor-not-allowed text-text-muted/40"
            : "text-text-secondary hover:bg-accent-violet/10 hover:text-accent-violet-light"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {disabled && (
        <span className="text-[10px] text-text-muted/40">当前</span>
      )}
    </button>
  );
}
