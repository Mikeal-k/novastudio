"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  User,
  Sparkles,
  Coins,
} from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load user data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/auth");
          return;
        }

        const token = session.access_token;
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (cancelled) return;

        if (data.success) {
          setEmail(data.user.email ?? "");
          setDisplayName(data.user.displayName ?? "");
          setAvatarUrl(data.user.avatarUrl ?? null);
          setCredits(data.profile.credits ?? 0);
        } else {
          setError("加载用户信息失败");
        }
      } catch {
        setError("网络请求失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  // Upload avatar
  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate
      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError("仅支持 PNG/JPG/WebP 格式");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("头像图片不能超过 2MB");
        return;
      }

      setUploading(true);
      setError("");
      setSuccess("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError("请先登录");
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/account/avatar", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "上传失败");
        }

        // Force cache bust
        setAvatarUrl(`${data.avatarUrl}?t=${Date.now()}`);
        setSuccess("头像已更新");
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [supabase]
  );

  // Save display name
  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      setError("昵称不能为空");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("请先登录");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "保存失败");
      }

      setSuccess("账户信息已更新");

      // Dispatch event to notify header to refresh
      window.dispatchEvent(new CustomEvent("nova-profile-update"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [displayName, supabase]);

  const getInitial = () => {
    if (displayName) return displayName[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return "N";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent-violet-light" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/create"
            className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回创作页
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-violet-light">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-base font-semibold text-foreground">
              Nova Studio
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="relative">
          {/* Glow */}
          <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/20 via-transparent to-accent-violet/5 opacity-60 blur-xl" />

          <div className="relative rounded-2xl border border-border/50 bg-card/70 p-6 backdrop-blur-xl shadow-lg shadow-black/10 sm:p-8">
            {/* Title */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-violet/5">
                <User className="h-6 w-6 text-accent-violet-light" />
              </div>
              <h1 className="text-xl font-bold text-foreground">账户管理</h1>
              <p className="mt-1 text-sm text-text-secondary">
                管理你的头像和昵称
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="ml-auto shrink-0 text-red-400/60 transition-colors hover:text-red-400"
                >
                  ×
                </button>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-400">
                <Check className="h-4 w-4 shrink-0" />
                <span>{success}</span>
                <button
                  onClick={() => setSuccess("")}
                  className="ml-auto shrink-0 text-emerald-400/60 transition-colors hover:text-emerald-400"
                >
                  ×
                </button>
              </div>
            )}

            {/* ── Avatar Section ──────────────────────────────────── */}
            <div className="mb-6 flex flex-col items-center gap-4">
              <div className="relative">
                {/* Avatar */}
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-accent-violet/30 bg-card/80">
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={avatarUrl}
                      alt="头像"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-accent-violet-light">
                      {getInitial()}
                    </span>
                  )}
                </div>

                {/* Upload overlay */}
                <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent-violet text-white shadow-lg transition-all hover:bg-accent-violet-light active:scale-95">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              <p className="text-xs text-text-muted">
                支持 PNG/JPG/WebP，最大 2MB
              </p>
            </div>

            {/* ── Display Name ────────────────────────────────────── */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                昵称
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (error) setError("");
                }}
                placeholder="设置你的昵称"
                maxLength={50}
                className="w-full rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted/50 outline-none transition-all duration-200 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20"
              />
            </div>

            {/* ── Email (read-only) ────────────────────────────────── */}
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                邮箱 <span className="text-text-muted/50">（不可修改）</span>
              </label>
              <div className="w-full rounded-lg border border-border/30 bg-card/20 px-3 py-2.5 text-sm text-text-secondary">
                {email || "—"}
              </div>
            </div>

            {/* ── Credits Display ─────────────────────────────────── */}
            <div className="mb-6 flex items-center justify-between rounded-xl border border-border/30 bg-card/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-text-secondary">当前积分</span>
              </div>
              <span className="text-sm font-semibold text-amber-400">
                {credits}
              </span>
            </div>

            {/* ── Save Button ─────────────────────────────────────── */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中...
                </span>
              ) : (
                "保存修改"
              )}
            </button>

            {/* ── Back Link ───────────────────────────────────────── */}
            <div className="mt-4 text-center">
              <Link
                href="/create"
                className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-accent-violet-light"
              >
                <Sparkles className="h-3.5 w-3.5" />
                返回创作页
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
