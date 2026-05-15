"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Loader2,
  LogOut,
  AlertTriangle,
  ArrowRight,
  XCircle,
  RefreshCw,
  Search,
  Users,
  Coins,
  DollarSign,
  BarChart3,
  Clock,
  CheckCircle,
  ExternalLink,
  User,
  Eye,
  Zap,
  FileText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; email: string }
  | { status: "authorized"; email: string };

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  credits: number;
  createdAt: string;
  lastSignInAt: string | null;
  generationsCount: number;
  rechargeAmountTotal: number;
  creditsConsumedTotal: number;
  status: string;
}

interface UserListResponse {
  success: boolean;
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    usersTotal: number;
    searchResultCount: number;
    totalCreditsBalance: number;
    paidUserCount: number;
  };
  error?: string;
}

interface UserDetail {
  user: UserRow & {
    publicGenerationsCount: number;
  };
  recentGenerations: Array<{
    id: string;
    model: string;
    status: string;
    cost: number;
    prompt: string;
    createdAt: string;
    error: string | null;
  }>;
  recentRechargeOrders: Array<{
    id: string;
    amountYuan: number;
    credits: number;
    status: string;
    packageName: string;
    createdAt: string;
  }>;
  recentCreditTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
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

const TX_TYPE_LABELS: Record<string, string> = {
  signup_bonus: "注册赠送",
  purchase_credit: "充值",
  generation_debit: "生成消耗",
  admin_adjustment: "管理员调整",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  // User list state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [stats, setStats] = useState<{
    usersTotal: number;
    searchResultCount: number;
    totalCreditsBalance: number;
    paidUserCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Detail modal state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Credit adjustment state
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustResult, setAdjustResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────

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

  // ── Fetch users ─────────────────────────────────────────────────────────

  const fetchUsers = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
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
          return;
        }

        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data: UserListResponse = await res.json();

        if (data.success) {
          setUsers(data.users ?? []);
          setTotal(data.total ?? 0);
          setStats(data.stats ?? null);
        } else {
          setError(data.error || "获取用户列表失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络请求失败");
      } finally {
        setLoading(false);
      }
    },
    [supabase, searchQuery, page, pageSize]
  );

  useEffect(() => {
    if (authState.status === "authorized") {
      fetchUsers();
    }
  }, [authState.status, fetchUsers]);

  // ── Search handler ──────────────────────────────────────────────────────

  const handleSearch = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // ── Fetch user detail ──────────────────────────────────────────────────

  const openDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setDetailError("");
    setAdjustResult(null);
    setAdjustAmount("");
    setAdjustReason("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setDetailError("未登录");
        setDetailLoading(false);
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.success) {
        setUserDetail({
          user: data.user,
          recentGenerations: data.recentGenerations ?? [],
          recentRechargeOrders: data.recentRechargeOrders ?? [],
          recentCreditTransactions: data.recentCreditTransactions ?? [],
        });
      } else {
        setDetailError(data.error || "获取用户详情失败");
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedUserId(null);
    setUserDetail(null);
    setDetailError("");
    setAdjustResult(null);
  };

  // ── Adjust credits ─────────────────────────────────────────────────────

  const handleAdjustCredits = async () => {
    if (!selectedUserId) return;

    setAdjustResult(null);

    const amountNum = parseInt(adjustAmount, 10);
    if (isNaN(amountNum) || !Number.isInteger(amountNum)) {
      setAdjustResult({ type: "error", message: "积分调整数量必须是整数" });
      return;
    }
    if (amountNum === 0) {
      setAdjustResult({ type: "error", message: "积分调整数量不能为 0" });
      return;
    }
    if (!adjustReason.trim() || adjustReason.trim().length < 2) {
      setAdjustResult({ type: "error", message: "操作原因至少 2 个字" });
      return;
    }

    setAdjustSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setAdjustResult({ type: "error", message: "未登录" });
        setAdjustSubmitting(false);
        return;
      }

      const res = await fetch(`/api/admin/users/${selectedUserId}/credits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          reason: adjustReason.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAdjustResult({
          type: "success",
          message: `${data.message}，当前积分：${data.newCredits}`,
        });
        // Refresh user detail and list
        openDetail(selectedUserId);
        fetchUsers(true);
      } else {
        setAdjustResult({
          type: "error",
          message: data.error || "调整积分失败",
        });
      }
    } catch (err) {
      setAdjustResult({
        type: "error",
        message: err instanceof Error ? err.message : "网络请求失败",
      });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }, [supabase, router]);

  // ── Pagination ─────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Loading state ──────────────────────────────────────────────────────

  if (authState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  // ── Unauthenticated state ──────────────────────────────────────────────

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
            需要管理员权限才能访问用户管理
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

  // ── Unauthorized state ─────────────────────────────────────────────────

  if (authState.status === "unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">无权限访问</h1>
          <p className="mb-6 text-sm text-gray-500">
            当前账号不是管理员账号，无法访问用户管理。
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

  // ── Authorized — show user management ──────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
                  <Users className="h-5 w-5 text-violet-400" />
                </div>
                <h1 className="text-xl font-bold text-white">用户管理</h1>
              </div>
              <p className="text-sm text-gray-500">
                查看和管理所有注册用户
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => router.push("/admin")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 transition-all hover:bg-violet-500/20"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                返回后台总览
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

        {/* ── Search Bar ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索邮箱..."
              className="w-full rounded-lg border border-gray-800 bg-[#1a1a24] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>
          <button
            onClick={handleSearch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-violet-500 hover:to-violet-400"
          >
            <Search className="h-4 w-4" />
            搜索
          </button>
          <button
            onClick={() => fetchUsers(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#12121a] px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        {/* ── Stats Cards ────────────────────────────────────────────── */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-[#12121a] p-4 shadow-2xl">
              <p className="mb-1 text-xs text-gray-500">总用户数</p>
              <p className="text-2xl font-bold tracking-tight text-white">
                {formatNumber(stats.usersTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#12121a] p-4 shadow-2xl">
              <p className="mb-1 text-xs text-gray-500">搜索结果</p>
              <p className="text-2xl font-bold tracking-tight text-violet-400">
                {formatNumber(stats.searchResultCount)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#12121a] p-4 shadow-2xl">
              <p className="mb-1 text-xs text-gray-500">总积分余额</p>
              <p className="text-2xl font-bold tracking-tight text-amber-400">
                {formatNumber(stats.totalCreditsBalance)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#12121a] p-4 shadow-2xl">
              <p className="mb-1 text-xs text-gray-500">付费用户数</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-400">
                {formatNumber(stats.paidUserCount)}
              </p>
            </div>
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── User Table ─────────────────────────────────────────────── */}
        {!loading && (
          <>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#12121a] py-16">
                <Users className="mb-2 h-10 w-10 text-gray-600" />
                <p className="text-sm text-gray-500">暂无用户数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#12121a] shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500">
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        用户
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        邮箱
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        当前积分
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        生成次数
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        累计充值
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        累计消耗
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        注册时间
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        最近登录
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-center">
                        状态
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-center">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                      >
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-xs font-medium text-violet-400">
                              {u.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-200 max-w-[120px] truncate">
                              {u.displayName}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-3 text-gray-300">
                          {u.email || "暂不可用"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-amber-400 font-medium">
                          {formatNumber(u.credits)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-300">
                          {formatNumber(u.generationsCount)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {u.rechargeAmountTotal > 0 ? (
                            <span className="text-emerald-400">
                              ¥{formatNumber(u.rechargeAmountTotal)}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-300">
                          {formatNumber(u.creditsConsumedTotal)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-gray-400">
                          {formatDateTime(u.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {u.lastSignInAt ? (
                            <span className="text-gray-400">
                              {formatDateTime(u.lastSignInAt)}
                            </span>
                          ) : (
                            <span className="text-gray-600">暂不可用</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          <span className="inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            {u.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          <button
                            onClick={() => openDetail(u.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 transition-all hover:bg-violet-500/25"
                          >
                            <Eye className="h-3 w-3" />
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ── Pagination ────────────────────────────────────── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
                    <span className="text-xs text-gray-500">
                      共 {total} 条，第 {page}/{totalPages} 页
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-gray-800 bg-[#1a1a24] px-3 py-1.5 text-xs text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200 disabled:opacity-30"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page >= totalPages}
                        className="rounded-lg border border-gray-800 bg-[#1a1a24] px-3 py-1.5 text-xs text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200 disabled:opacity-30"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-xs text-gray-600">
          此页面仅供内部使用，请勿暴露到公网
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: User Detail
          ═══════════════════════════════════════════════════════════════ */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl border border-gray-800 bg-[#12121a] shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
                  <User className="h-4 w-4 text-violet-400" />
                </div>
                <h2 className="text-base font-semibold text-white">
                  用户详情
                </h2>
              </div>
              <button
                onClick={closeDetail}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-6">
              {/* ── Loading ──────────────────────────────────────────── */}
              {detailLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                </div>
              )}

              {/* ── Error ────────────────────────────────────────────── */}
              {detailError && !detailLoading && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {/* ── Detail Content ───────────────────────────────────── */}
              {!detailLoading && !detailError && userDetail && (
                <>
                  {/* ── Section 1: Basic Info ────────────────────────── */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <User className="h-4 w-4 text-violet-400" />
                      基本信息
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-violet-500/10 text-lg font-bold text-violet-400">
                          {userDetail.user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                          <div>
                            <span className="text-xs text-gray-500">昵称</span>
                            <p className="mt-0.5 font-medium text-gray-200">
                              {userDetail.user.displayName}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">邮箱</span>
                            <p className="mt-0.5 text-gray-300 break-all">
                              {userDetail.user.email || "暂不可用"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">
                              用户 ID
                            </span>
                            <p className="mt-0.5 font-mono text-[11px] text-gray-400 break-all">
                              {userDetail.user.id}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">
                              注册时间
                            </span>
                            <p className="mt-0.5 text-gray-300">
                              {formatDateTime(userDetail.user.createdAt)}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">
                              最近登录
                            </span>
                            <p className="mt-0.5 text-gray-300">
                              {userDetail.user.lastSignInAt
                                ? formatDateTime(userDetail.user.lastSignInAt)
                                : "暂不可用"}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">
                              当前积分
                            </span>
                            <p className="mt-0.5 text-lg font-bold text-amber-400">
                              {formatNumber(userDetail.user.credits)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Section 2: Credit Adjustment ────────────────── */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Coins className="h-4 w-4 text-amber-400" />
                      积分操作
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-5">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="mb-1.5 block text-xs font-medium text-gray-400">
                            调整数量（正数加积分，负数减积分）
                          </label>
                          <input
                            type="number"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            placeholder="例如：100 或 -50"
                            className="w-full rounded-lg border border-gray-800 bg-[#0a0a0f] px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                          />
                        </div>
                        <div className="flex-[2]">
                          <label className="mb-1.5 block text-xs font-medium text-gray-400">
                            操作原因
                          </label>
                          <input
                            type="text"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            placeholder="请输入调整原因（至少 2 个字）"
                            className="w-full rounded-lg border border-gray-800 bg-[#0a0a0f] px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                          />
                        </div>
                        <button
                          onClick={handleAdjustCredits}
                          disabled={adjustSubmitting}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50"
                        >
                          {adjustSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              处理中...
                            </>
                          ) : (
                            <>
                              <Coins className="h-4 w-4" />
                              确认调整
                            </>
                          )}
                        </button>
                      </div>

                      {/* Adjustment result */}
                      {adjustResult && (
                        <div
                          className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
                            adjustResult.type === "success"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border-red-500/20 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {adjustResult.type === "success" ? (
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <span>{adjustResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Section 3: Recent Generations ────────────────── */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Zap className="h-4 w-4 text-violet-400" />
                      最近生成记录
                    </h3>
                    {userDetail.recentGenerations.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#1a1a24] py-8">
                        <FileText className="mr-2 h-5 w-5 text-gray-600" />
                        <p className="text-sm text-gray-500">暂无生成记录</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#1a1a24]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500">
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                模型
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center">
                                状态
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                消耗积分
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                Prompt
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                创建时间
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                错误原因
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetail.recentGenerations.map((g) => {
                              const statusInfo = STATUS_LABELS[g.status] ?? {
                                label: g.status,
                                color: "text-gray-400 bg-gray-500/15",
                              };
                              const truncatedPrompt =
                                g.prompt.length > 40
                                  ? g.prompt.slice(0, 40) + "..."
                                  : g.prompt;
                              const truncatedError =
                                g.error && g.error.length > 60
                                  ? g.error.slice(0, 60) + "..."
                                  : g.error;
                              return (
                                <tr
                                  key={g.id}
                                  className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                                >
                                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-300">
                                    {g.model}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                                    <span
                                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                                    >
                                      {statusInfo.label}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-amber-400">
                                    {g.cost}
                                  </td>
                                  <td className="max-w-[200px] truncate px-3 py-2.5 text-gray-400">
                                    {truncatedPrompt || "-"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-400">
                                    {formatDateTime(g.createdAt)}
                                  </td>
                                  <td className="max-w-[180px] truncate px-3 py-2.5">
                                    {truncatedError ? (
                                      <span
                                        className="text-red-400/80"
                                        title={g.error ?? undefined}
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

                  {/* ── Section 4: Recent Recharge Orders ────────────── */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                      最近充值记录
                    </h3>
                    {userDetail.recentRechargeOrders.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#1a1a24] py-8">
                        <FileText className="mr-2 h-5 w-5 text-gray-600" />
                        <p className="text-sm text-gray-500">暂无充值记录</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#1a1a24]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500">
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                金额
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                积分
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center">
                                状态
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                套餐
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                创建时间
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetail.recentRechargeOrders.map((o) => {
                              const statusInfo =
                                ORDER_STATUS_LABELS[o.status] ?? {
                                  label: o.status,
                                  color: "text-gray-400 bg-gray-500/15",
                                };
                              return (
                                <tr
                                  key={o.id}
                                  className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                                >
                                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-200">
                                    ¥{o.amountYuan}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-amber-400">
                                    {formatNumber(o.credits)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                                    <span
                                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                                    >
                                      {statusInfo.label}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                                    {o.packageName}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-400">
                                    {formatDateTime(o.createdAt)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ── Section 5: Recent Credit Transactions ────────── */}
                  <div className="mb-4">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Clock className="h-4 w-4 text-violet-400" />
                      最近积分流水
                    </h3>
                    {userDetail.recentCreditTransactions.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#1a1a24] py-8">
                        <FileText className="mr-2 h-5 w-5 text-gray-600" />
                        <p className="text-sm text-gray-500">暂无积分流水</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#1a1a24]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500">
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                变动类型
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                变动数量
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                变动后余额
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                备注
                              </th>
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                                时间
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetail.recentCreditTransactions.map((tx) => {
                              const typeLabel =
                                TX_TYPE_LABELS[tx.type] ?? tx.type;
                              const isPositive = tx.amount > 0;
                              return (
                                <tr
                                  key={tx.id}
                                  className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                                >
                                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-200">
                                    {typeLabel}
                                  </td>
                                  <td
                                    className={`whitespace-nowrap px-3 py-2.5 text-right font-medium ${
                                      isPositive
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {isPositive ? "+" : ""}
                                    {tx.amount}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-300">
                                    {formatNumber(tx.balanceAfter)}
                                  </td>
                                  <td className="max-w-[240px] truncate px-3 py-2.5 text-gray-400">
                                    {tx.description || "-"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-400">
                                    {formatDateTime(tx.createdAt)}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
