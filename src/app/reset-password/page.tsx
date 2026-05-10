"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  const supabase = createBrowserSupabaseClient();

  // Check for valid recovery session
  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      // --- Priority 1: Check URL for error/error_description ---
      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get("error");
      const urlErrorDescription = urlParams.get("error_description");

      if (urlError) {
        if (!cancelled) {
          setError(
            urlErrorDescription
              ? decodeURIComponent(urlErrorDescription)
              : `认证错误: ${urlError}`
          );
          setSessionReady(false);
        }
        return;
      }

      // --- Priority 2: Exchange URL code for session ---
      const code = urlParams.get("code");

      if (code) {
        try {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (cancelled) return;

          if (exchangeError) {
            console.error("exchangeCodeForSession error:", exchangeError);
            setError("重置链接无效或已过期，请重新发送重置邮件");
            setSessionReady(false);
            return;
          }

          // Successfully exchanged code — recovery session is established
          setSessionReady(true);
          return;
        } catch (err) {
          if (cancelled) return;
          console.error("exchangeCodeForSession exception:", err);
          setError("重置链接无效或已过期，请重新发送重置邮件");
          setSessionReady(false);
          return;
        }
      }

      // --- Priority 3: Fallback — check existing session ---
      const { data: sessionData } = await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionData.session) {
        setSessionReady(true);
        return;
      }

      // --- Priority 4: Listen for PASSWORD_RECOVERY event ---
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event) => {
          if (event === "PASSWORD_RECOVERY") {
            if (!cancelled) {
              setSessionReady(true);
            }
          }
        }
      );

      // If no session after a short delay, show invalid link message
      setTimeout(() => {
        if (!cancelled && sessionReady === null) {
          setSessionReady(false);
        }
      }, 3000);

      return () => {
        authListener?.subscription.unsubscribe();
      };
    };

    initSession();

    return () => {
      cancelled = true;
    };
  }, [supabase, sessionReady]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSuccess("");

      // Validation
      if (!newPassword) {
        setError("请输入新密码");
        return;
      }
      if (newPassword.length < 6) {
        setError("密码长度至少为 6 位");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }

      setLoading(true);

      try {
        const { error: updateError } =
          await supabase.auth.updateUser({
            password: newPassword,
          });

        if (updateError) {
          setError(updateError.message);
          return;
        }

        // Password updated successfully
        setSuccess("密码已更新，请重新登录");

        // Sign out and redirect to login
        await supabase.auth.signOut();

        setTimeout(() => {
          router.push("/auth");
        }, 2000);
      } catch {
        setError("密码更新失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [newPassword, confirmPassword, supabase, router]
  );

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-accent-violet/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-violet/5 blur-3xl" />
      </div>

      {/* Back to home */}
      <Link
        href="/"
        className="absolute left-4 top-4 flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-foreground sm:left-8 sm:top-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回首页
      </Link>

      {/* Reset password card */}
      <div className="relative z-10 mx-4 w-full max-w-md">
        {/* Glow */}
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/20 via-transparent to-accent-violet/5 opacity-60 blur-xl" />

        <div className="relative rounded-2xl border border-border/50 bg-card/70 p-6 backdrop-blur-xl shadow-lg shadow-black/10 sm:p-8">
          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-violet to-accent-violet-light shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              设置新密码
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              请输入你的新密码
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-2.5 text-xs text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Invalid/expired link */}
          {sessionReady === false && !success && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-4 py-6 text-center">
                <AlertCircle className="h-10 w-10 text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-yellow-400">
                    重置链接无效或已过期
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    请重新发送重置邮件。
                  </p>
                </div>
              </div>

              <Link
                href="/auth"
                className="block w-full rounded-lg bg-gradient-to-r from-accent-violet to-accent-violet-light py-2.5 text-center text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl"
              >
                返回登录
              </Link>
            </div>
          )}

          {/* Loading session check */}
          {sessionReady === null && !success && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent-violet-light" />
              <p className="text-xs text-text-muted">验证重置链接...</p>
            </div>
          )}

          {/* Password reset form */}
          {sessionReady === true && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-xs font-medium text-text-muted"
                >
                  新密码
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-text-muted" />
                  </div>
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="至少 6 位密码"
                    className="w-full rounded-lg border border-border/60 bg-card/40 py-2.5 pl-10 pr-10 text-sm text-foreground placeholder-text-muted/50 outline-none transition-all duration-200 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-xs font-medium text-text-muted"
                >
                  确认新密码
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-text-muted" />
                  </div>
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="再次输入新密码"
                    className="w-full rounded-lg border border-border/60 bg-card/40 py-2.5 pl-10 pr-10 text-sm text-foreground placeholder-text-muted/50 outline-none transition-all duration-200 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted transition-colors hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full rounded-lg bg-gradient-to-r from-accent-violet to-accent-violet-light py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200",
                  "hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    更新中...
                  </span>
                ) : (
                  "更新密码"
                )}
              </button>
            </form>
          )}

          {/* Footer link (when form is visible) */}
          {sessionReady === true && !success && (
            <p className="mt-6 text-center text-xs text-text-muted">
              <Link
                href="/auth"
                className="text-accent-violet-light transition-colors hover:text-accent-violet"
              >
                返回登录
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
