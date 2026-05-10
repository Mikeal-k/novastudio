"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";

type AuthTab = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const supabase = createBrowserSupabaseClient();

  const handleLogin = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "邮箱或密码错误，请重试"
            : signInError.message
        );
        return;
      }

      // Success — redirect to /create
      router.push("/create");
    } catch {
      setError("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [email, password, supabase, router]);

  const handleRegister = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(
          signUpError.message === "User already registered"
            ? "该邮箱已注册，请直接登录"
            : signUpError.message
        );
        return;
      }

      // Registration successful
      setSuccess("注册成功！请检查邮箱验证链接。如果没有收到邮件，可以尝试直接登录。");

      // Try to sign in directly (in case email confirmation is disabled)
      const { error: autoSignInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (!autoSignInError) {
        router.push("/create");
      }
    } catch {
      setError("注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [email, password, supabase, router]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!email.trim()) {
        setError("请输入邮箱地址");
        return;
      }
      if (!password) {
        setError("请输入密码");
        return;
      }
      if (password.length < 6) {
        setError("密码长度至少为 6 位");
        return;
      }

      if (tab === "login") {
        handleLogin();
      } else {
        handleRegister();
      }
    },
    [email, password, tab, handleLogin, handleRegister]
  );

  const handleResetPassword = useCallback(async () => {
    setResetError("");
    setResetLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError) {
        setResetError(resetError.message);
        return;
      }

      setResetSent(true);
    } catch {
      setResetError("发送重置邮件失败，请稍后重试");
    } finally {
      setResetLoading(false);
    }
  }, [resetEmail, supabase]);

  const handleBackToLogin = useCallback(() => {
    setShowForgotPassword(false);
    setResetSent(false);
    setResetEmail("");
    setResetError("");
  }, []);

  // Forgot password form
  if (showForgotPassword) {
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

        {/* Reset card */}
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
                重置密码
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                输入你的邮箱地址，我们将发送重置密码链接
              </p>
            </div>

            {/* Reset error */}
            {resetError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {/* Reset success */}
            {resetSent ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 rounded-lg border border-green-400/20 bg-green-400/10 px-4 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-400">
                      重置密码邮件已发送
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      请前往邮箱点击链接设置新密码。
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleBackToLogin}
                  className="w-full rounded-lg bg-gradient-to-r from-accent-violet to-accent-violet-light py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl"
                >
                  返回登录
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label
                    htmlFor="reset-email"
                    className="mb-1.5 block text-xs font-medium text-text-muted"
                  >
                    邮箱地址
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-text-muted" />
                    </div>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetError) setResetError("");
                      }}
                      placeholder="your@email.com"
                      className="w-full rounded-lg border border-border/60 bg-card/40 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder-text-muted/50 outline-none transition-all duration-200 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Send reset button */}
                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading || !resetEmail.trim()}
                  className={cn(
                    "w-full rounded-lg bg-gradient-to-r from-accent-violet to-accent-violet-light py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200",
                    "hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {resetLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      发送中...
                    </span>
                  ) : (
                    "发送重置邮件"
                  )}
                </button>

                {/* Back to login */}
                <button
                  onClick={handleBackToLogin}
                  className="block w-full text-center text-xs text-text-muted transition-colors hover:text-accent-violet-light"
                >
                  返回登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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

      {/* Auth card */}
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
              {tab === "login" ? "欢迎回来" : "创建账户"}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {tab === "login"
                ? "登录后继续你的创作之旅"
                : "注册后获得 30 积分，开始 AI 创作"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 flex rounded-lg border border-border/60 bg-card p-0.5">
            <button
              onClick={() => {
                setTab("login");
                setError("");
                setSuccess("");
              }}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
                tab === "login"
                  ? "bg-accent-violet/15 text-accent-violet-light shadow-sm"
                  : "text-text-muted hover:text-foreground"
              )}
            >
              登录
            </button>
            <button
              onClick={() => {
                setTab("register");
                setError("");
                setSuccess("");
              }}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
                tab === "register"
                  ? "bg-accent-violet/15 text-accent-violet-light shadow-sm"
                  : "text-text-muted hover:text-foreground"
              )}
            >
              注册
            </button>
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
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-text-muted"
              >
                邮箱地址
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-text-muted" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-border/60 bg-card/40 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder-text-muted/50 outline-none transition-all duration-200 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium text-text-muted"
              >
                密码
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-text-muted" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="至少 6 位密码"
                  className="w-full rounded-lg border border-border/60 bg-card/40 py-2.5 pl-10 pr-10 text-sm text-foreground placeholder-text-muted/50 outline-none transition-all duration-200 focus:border-accent-violet/40 focus:ring-1 focus:ring-accent-violet/20"
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
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

            {/* Forgot password link (login tab only) */}
            {tab === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-xs text-text-muted transition-colors hover:text-accent-violet-light"
                >
                  忘记密码？
                </button>
              </div>
            )}

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
                  {tab === "login" ? "登录中..." : "注册中..."}
                </span>
              ) : tab === "login" ? (
                "登录"
              ) : (
                "注册并获取 30 积分"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-text-muted">
            {tab === "login" ? (
              <>
                还没有账户？{" "}
                <button
                  onClick={() => {
                    setTab("register");
                    setError("");
                    setSuccess("");
                  }}
                  className="text-accent-violet-light transition-colors hover:text-accent-violet"
                >
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账户？{" "}
                <button
                  onClick={() => {
                    setTab("login");
                    setError("");
                    setSuccess("");
                  }}
                  className="text-accent-violet-light transition-colors hover:text-accent-violet"
                >
                  立即登录
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
