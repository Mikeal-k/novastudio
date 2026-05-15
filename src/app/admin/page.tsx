"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Loader2,
  Shield,
  LogOut,
  AlertTriangle,
  ArrowRight,
  XCircle,
  RefreshCw,
  Users,
  UserPlus,
  Zap,
  DollarSign,
  Coins,
  TrendingDown,
  BarChart3,
  Clock,
  CheckCircle,
  Hourglass,
  Search,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; email: string }
  | { status: "authorized"; email: string };

interface DashboardStats {
  usersTotal: number;
  usersToday: number | null;
  generationsTotal: number;
  generationsToday: number | null;
  generationsSucceededToday: number | null;
  generationsFailedToday: number | null;
  failRateToday: number;
  rechargeAmountTotal: number;
  rechargeAmountToday: number;
  creditsConsumedTotal: number;
  creditsConsumedToday: number;
  creditsBalanceTotal: number | null;
  publicGenerationsTotal: number;
}

interface ModelStat {
  model: string;
  total: number;
  today: number;
  succeeded: number;
  failed: number;
  running: number;
  successRate: number;
  failRate: number;
  creditsConsumed: number;
}

interface RecentOrder {
  id: string;
  userEmail: string;
  amount: number;
  credits: number;
  status: string;
  createdAt: string;
}

interface RecentGeneration {
  id: string;
  userEmail: string;
  model: string;
  status: string;
  credits: number;
  prompt: string;
  createdAt: string;
  error: string | null;
}

interface DashboardData {
  stats: DashboardStats;
  modelStats: ModelStat[];
  recentOrders: RecentOrder[];
  recentGenerations: RecentGeneration[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  succeeded: { label: "成功", color: "text-emerald-400 bg-emerald-500/15" },
  failed: { label: "失败", color: "text-red-400 bg-red-500/15" },
  running: { label: "运行中", color: "text-blue-400 bg-blue-500/15" },
  pending: { label: "等待中", color: "text-amber-400 bg-amber-500/15" },
  processing: { label: "处理中", color: "text-blue-400 bg-blue-500/15" },
};

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: "已到账", color: "text-emerald-400 bg-emerald-500/15" },
  pending: { label: "待付款", color: "text-amber-400 bg-amber-500/15" },
  canceled: { label: "已取消", color: "text-gray-400 bg-gray-500/15" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Check auth on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) setAuthState({ status: "unauthenticated" });
          return;
        }

        const token = session.access_token;
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const authData = await res.json();

        if (!authData.success) {
          if (!cancelled) setAuthState({ status: "unauthenticated" });
          return;
        }

        if (authData.isAdmin) {
          if (!cancelled)
            setAuthState({ status: "authorized", email: authData.email });
        } else {
          if (!cancelled)
            setAuthState({ status: "unauthorized", email: authData.email });
        }
      } catch {
        if (!cancelled) setAuthState({ status: "unauthenticated" });
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          setError("未登录");
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const res = await fetch("/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await res.json();

        if (result.success) {
          setData({
            stats: result.stats,
            modelStats: result.modelStats ?? [],
            recentOrders: result.recentOrders ?? [],
            recentGenerations: result.recentGenerations ?? [],
          });
        } else {
          setError(result.error || "获取数据失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络请求失败");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  // Fetch when authorized
  useEffect(() => {
    if (authState.status === "authorized") {
      fetchDashboard();
    }
  }, [authState.status, fetchDashboard]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }, [supabase, router]);

  // ── Loading state ─────────────────────────────────────────────────────
  if (authState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  // ── Unauthenticated state ─────────────────────────────────────────────
  if (authState.status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">
            请先登录管理员账号
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            需要管理员权限才能访问后台总览
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-violet-500 hover:to-violet-400"
          >
            前往登录
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Unauthorized state ────────────────────────────────────────────────
  if (authState.status === "unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">无权限访问</h1>
          <p className="mb-6 text-sm text-gray-500">
            当前账号不是管理员账号，无法访问后台总览。
          </p>
          <button
            onClick={() => router.push("/create")}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-violet-500 hover:to-violet-400"
          >
            返回创作页
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Authorized — show dashboard ───────────────────────────────────────

  const todayStr = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // ── Stat card helper ──────────────────────────────────────────────────

  const StatCard = ({
    icon,
    label,
    value,
    sub,
    accent = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    accent?: boolean;
  }) => (
    <div className="rounded-xl border border-gray-800 bg-[#12121a] p-4 shadow-2xl transition-colors hover:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs text-gray-500">{label}</p>
          <p
            className={`text-2xl font-bold tracking-tight ${
              accent ? "text-violet-400" : "text-white"
            }`}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-gray-600">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
          {icon}
        </div>
      </div>
    </div>
  );

  const formatValue = (val: number | null, suffix = ""): string => {
    if (val === null || val === undefined) return "暂不可用";
    return formatNumber(val) + suffix;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
                  <BarChart3 className="h-5 w-5 text-violet-400" />
                </div>
                <h1 className="text-xl font-bold text-white">
                  Nova Studio 后台总览
                </h1>
              </div>
              <p className="text-sm text-gray-500">{todayStr}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => fetchDashboard(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#12121a] px-3 py-2 text-xs font-medium text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                刷新
              </button>
              <button
                onClick={() => router.push("/admin/users")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 transition-all hover:bg-violet-500/20"
              >
                <Users className="h-3.5 w-3.5" />
                用户管理
              </button>
              <button
                onClick={() => router.push("/admin/recharge")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 transition-all hover:bg-violet-500/20"
              >
                <Shield className="h-3.5 w-3.5" />
                充值审核
              </button>
              <button
                onClick={() => router.push("/create")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#12121a] px-3 py-2 text-xs font-medium text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                返回创作
              </button>
            </div>
          </div>

          {/* Admin bar */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2.5">
            <span className="text-xs text-violet-300">
              管理员：{authState.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出登录
            </button>
          </div>
        </div>

        {/* ── Loading / Error ───────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        )}

        {error && !loading && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* ── Row 1: Key Metrics ────────────────────────────────── */}
            <div className="mb-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  label="累计用户"
                  value={formatValue(data.stats.usersTotal)}
                />
                <StatCard
                  icon={<UserPlus className="h-5 w-5" />}
                  label="今日新增"
                  value={formatValue(data.stats.usersToday)}
                  accent
                />
                <StatCard
                  icon={<Zap className="h-5 w-5" />}
                  label="今日生成"
                  value={formatValue(data.stats.generationsToday)}
                  accent
                />
                <StatCard
                  icon={<DollarSign className="h-5 w-5" />}
                  label="今日充值金额"
                  value={
                    data.stats.rechargeAmountToday !== null
                      ? `¥${formatNumber(data.stats.rechargeAmountToday)}`
                      : "暂不可用"
                  }
                  accent
                />
                <StatCard
                  icon={<Coins className="h-5 w-5" />}
                  label="今日消耗积分"
                  value={formatValue(data.stats.creditsConsumedToday)}
                />
                <StatCard
                  icon={<TrendingDown className="h-5 w-5" />}
                  label="今日失败率"
                  value={
                    data.stats.generationsToday !== null &&
                    data.stats.generationsToday > 0
                      ? `${data.stats.failRateToday}%`
                      : "暂无数据"
                  }
                  sub={
                    data.stats.generationsSucceededToday !== null
                      ? `成功 ${data.stats.generationsSucceededToday} / 失败 ${data.stats.generationsFailedToday ?? 0}`
                      : undefined
                  }
                />
              </div>
              {/* Extra stat row */}
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-800 bg-[#12121a] px-4 py-3">
                  <p className="text-[11px] text-gray-500">累计生成</p>
                  <p className="mt-0.5 text-base font-semibold text-white">
                    {formatValue(data.stats.generationsTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#12121a] px-4 py-3">
                  <p className="text-[11px] text-gray-500">累计充值总额</p>
                  <p className="mt-0.5 text-base font-semibold text-white">
                    ¥{formatNumber(data.stats.rechargeAmountTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#12121a] px-4 py-3">
                  <p className="text-[11px] text-gray-500">累计消耗积分</p>
                  <p className="mt-0.5 text-base font-semibold text-white">
                    {formatValue(data.stats.creditsConsumedTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#12121a] px-4 py-3">
                  <p className="text-[11px] text-gray-500">
                    当前总积分余额
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-white">
                    {data.stats.creditsBalanceTotal !== null
                      ? formatNumber(data.stats.creditsBalanceTotal)
                      : "暂不可用"}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Block 2: Model Call Analysis ──────────────────────── */}
            <div className="mb-8 rounded-xl border border-gray-800 bg-[#12121a] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                <BarChart3 className="h-4 w-4 text-violet-400" />
                模型调用分析
              </h2>

              {data.modelStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Search className="mb-2 h-6 w-6 text-gray-600" />
                  <p className="text-sm">暂无模型调用数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500">
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          模型
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          今日调用
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          累计调用
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          成功
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          失败
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          失败率
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          消耗积分
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.modelStats.map((m) => (
                        <tr
                          key={m.model}
                          className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-200">
                            {m.model}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-300">
                            {formatNumber(m.today)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-300">
                            {formatNumber(m.total)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-emerald-400">
                            {formatNumber(m.succeeded)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <span
                              className={
                                m.failed > 0
                                  ? "text-red-400"
                                  : "text-gray-500"
                              }
                            >
                              {formatNumber(m.failed)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <span
                              className={
                                m.failRate > 10
                                  ? "text-red-400"
                                  : m.failRate > 0
                                    ? "text-amber-400"
                                    : "text-gray-500"
                              }
                            >
                              {m.failRate}%
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-amber-400">
                            {formatNumber(m.creditsConsumed)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Block 3: Recent Recharge Orders ───────────────────── */}
            <div className="mb-8 rounded-xl border border-gray-800 bg-[#12121a] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <DollarSign className="h-4 w-4 text-violet-400" />
                  最近充值订单
                </h2>
                <button
                  onClick={() => router.push("/admin/recharge")}
                  className="text-[11px] text-violet-400 transition-colors hover:text-violet-300"
                >
                  查看全部
                </button>
              </div>

              {data.recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Search className="mb-2 h-6 w-6 text-gray-600" />
                  <p className="text-sm">暂无充值订单</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500">
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          用户
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          金额
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          积分
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-center">
                          状态
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          时间
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((order) => {
                        const statusInfo =
                          ORDER_STATUS_LABELS[order.status] ?? {
                            label: order.status,
                            color: "text-gray-400 bg-gray-500/15",
                          };
                        return (
                          <tr
                            key={order.id}
                            className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                          >
                            <td className="max-w-[160px] truncate px-3 py-2.5 text-gray-200">
                              {order.userEmail || "未知用户"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-gray-200">
                              ¥{order.amount}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-amber-400">
                              {formatNumber(order.credits)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-400">
                              {formatDateTime(order.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Block 4: Recent Generation Tasks ──────────────────── */}
            <div className="mb-8 rounded-xl border border-gray-800 bg-[#12121a] p-5 shadow-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                <Zap className="h-4 w-4 text-violet-400" />
                最近生成任务
              </h2>

              {data.recentGenerations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Search className="mb-2 h-6 w-6 text-gray-600" />
                  <p className="text-sm">暂无生成任务</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500">
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          用户
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          模型
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-center">
                          状态
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          积分
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          Prompt
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium text-right">
                          时间
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">
                          错误原因
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentGenerations.map((gen) => {
                        const statusInfo = STATUS_LABELS[gen.status] ?? {
                          label: gen.status,
                          color: "text-gray-400 bg-gray-500/15",
                        };
                        const truncatedPrompt =
                          gen.prompt.length > 40
                            ? gen.prompt.slice(0, 40) + "..."
                            : gen.prompt;
                        const truncatedError =
                          gen.error && gen.error.length > 60
                            ? gen.error.slice(0, 60) + "..."
                            : gen.error;
                        return (
                          <tr
                            key={gen.id}
                            className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                          >
                            <td className="max-w-[140px] truncate px-3 py-2.5 text-gray-200">
                              {gen.userEmail || "未知用户"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-300">
                              {gen.model}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-center">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-amber-400">
                              {gen.credits}
                            </td>
                            <td className="max-w-[200px] truncate px-3 py-2.5 text-gray-400">
                              {truncatedPrompt || "-"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-400">
                              {formatDateTime(gen.createdAt)}
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-2.5">
                              {truncatedError ? (
                                <span
                                  className="text-red-400/80"
                                  title={gen.error ?? undefined}
                                >
                                  {truncatedError}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <p className="pb-6 text-center text-xs text-gray-600">
          此页面仅供内部使用，请勿暴露到公网
        </p>
      </div>
    </div>
  );
}
