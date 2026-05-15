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
  Zap,
  BarChart3,
  ExternalLink,
  Eye,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  RotateCw,
  DollarSign,
  Film,
  Image as ImageIcon,
  User,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; email: string }
  | { status: "authorized"; email: string };

interface GenerationItem {
  id: string;
  userId: string;
  userEmail: string;
  model: string;
  status: string;
  prompt: string;
  credits: number;
  taskId: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  error: string | null;
  settings: Record<string, unknown> | null;
  chargedAt: string | null;
  createdAt: string;
  updatedAt: string;
  refunded: boolean;
  refundAmount?: number | null;
  refundAt?: string | null;
  isTimeout?: boolean;
}

interface GenerationsResponse {
  success: boolean;
  items: GenerationItem[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

interface GenerationDetail {
  id: string;
  userId: string;
  model: string;
  prompt: string;
  outputType: string;
  status: string;
  credits: number;
  taskId: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  error: string | null;
  settings: Record<string, unknown> | null;
  chargedAt: string | null;
  createdAt: string;
  updatedAt: string;
  refunded: boolean;
  isTimeout?: boolean;
  refundTransaction: {
    id: string;
    amount: number;
    createdAt: string;
    description: string | null;
  } | null;
}

interface DetailResponse {
  success: boolean;
  generation: GenerationDetail;
  user: { id: string; email: string; credits: number } | null;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balance_after: number;
    description: string | null;
    created_at: string;
  }>;
  error?: string;
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

const MODEL_LABELS: Record<string, string> = {
  "gpt-image-1.5": "GPT Image 1.5",
  "gpt-image-2": "GPT Image 2",
  "seedance-2": "Seedance 2.0",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  succeeded: { label: "成功", color: "text-emerald-400 bg-emerald-500/15" },
  failed: { label: "失败", color: "text-red-400 bg-red-500/15" },
  running: { label: "运行中", color: "text-blue-400 bg-blue-500/15" },
  pending: { label: "等待中", color: "text-amber-400 bg-amber-500/15" },
  processing: { label: "处理中", color: "text-blue-400 bg-blue-500/15" },
};

const TX_TYPE_LABELS: Record<string, string> = {
  signup_bonus: "注册赠送",
  purchase_credit: "充值",
  generation_debit: "生成消耗",
  admin_adjustment: "管理员调整",
  admin_refund: "管理员退款",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminGenerationsPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  // List state
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Detail modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Refund modal state
  const [refundTarget, setRefundTarget] = useState<{
    id: string;
    credits: number;
    userEmail: string;
  } | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundResult, setRefundResult] = useState<{
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

  // ── Fetch generations ──────────────────────────────────────────────────

  const fetchGenerations = useCallback(
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
        if (modelFilter) params.set("model", modelFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(
          `/api/admin/generations?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data: GenerationsResponse = await res.json();

        if (data.success) {
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
        } else {
          setError(data.error || "获取生成任务列表失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络请求失败");
      } finally {
        setLoading(false);
      }
    },
    [supabase, searchQuery, modelFilter, statusFilter, page, pageSize]
  );

  useEffect(() => {
    if (authState.status === "authorized") {
      fetchGenerations();
    }
  }, [authState.status, fetchGenerations]);

  // ── Filter handlers ────────────────────────────────────────────────────

  const handleSearch = () => {
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setModelFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const hasActiveFilters = searchQuery || modelFilter || statusFilter;

  // ── Open detail ────────────────────────────────────────────────────────

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError("");

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

      const res = await fetch(`/api/admin/generations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: DetailResponse = await res.json();

      if (data.success) {
        setDetail(data);
      } else {
        setDetailError(data.error || "获取任务详情失败");
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  };

  // ── Refresh Seedance status ──────────────────────────────────────────

  const handleRefresh = async (id: string) => {
    setActionLoading(id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError("未登录");
        return;
      }

      const res = await fetch(`/api/admin/generations/${id}/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        // Refresh the list
        fetchGenerations(true);
        // If detail is open, refresh it too
        if (selectedId === id) {
          openDetail(id);
        }
      } else {
        setError(data.error || "刷新失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Mark as failed ─────────────────────────────────────────────────────

  const handleMarkFailed = async (id: string) => {
    const reason = prompt("请输入标记失败的原因：");
    if (!reason || !reason.trim()) return;

    setActionLoading(id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError("未登录");
        return;
      }

      const res = await fetch(`/api/admin/generations/${id}/mark-failed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        fetchGenerations(true);
        if (selectedId === id) {
          openDetail(id);
        }
      } else {
        setError(data.error || "标记失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络请求失败");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Refund credits ─────────────────────────────────────────────────────

  const openRefundModal = (
    id: string,
    credits: number,
    userEmail: string
  ) => {
    setRefundTarget({ id, credits, userEmail });
    setRefundReason("");
    setRefundResult(null);
  };

  const closeRefundModal = () => {
    setRefundTarget(null);
    setRefundReason("");
    setRefundResult(null);
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    if (!refundReason.trim() || refundReason.trim().length < 2) {
      setRefundResult({
        type: "error",
        message: "退款原因至少 2 个字",
      });
      return;
    }

    setRefundSubmitting(true);
    setRefundResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setRefundResult({ type: "error", message: "未登录" });
        setRefundSubmitting(false);
        return;
      }

      const res = await fetch(
        `/api/admin/generations/${refundTarget.id}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: refundReason.trim() }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setRefundResult({
          type: "success",
          message: data.message || "退款成功",
        });
        fetchGenerations(true);
        if (selectedId === refundTarget.id) {
          openDetail(refundTarget.id);
        }
      } else {
        setRefundResult({
          type: "error",
          message: data.error || "退款失败",
        });
      }
    } catch (err) {
      setRefundResult({
        type: "error",
        message: err instanceof Error ? err.message : "网络请求失败",
      });
    } finally {
      setRefundSubmitting(false);
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
            需要管理员权限才能访问生成任务管理
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
            当前账号不是管理员账号，无法访问生成任务管理。
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

  // ── Authorized — show content ─────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
                  <Zap className="h-5 w-5 text-violet-400" />
                </div>
                <h1 className="text-xl font-bold text-white">
                  生成任务管理
                </h1>
              </div>
              <p className="text-sm text-gray-500">
                查看和管理所有生成任务
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

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-3">
          {/* Row 1: Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索用户邮箱 / Prompt..."
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
              onClick={() => fetchGenerations(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#12121a] px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </button>
          </div>

          {/* Row 2: Model + Status filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Model filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">模型：</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "", label: "全部" },
                  { value: "gpt-image-1.5", label: "GPT Image 1.5" },
                  { value: "gpt-image-2", label: "GPT Image 2" },
                  { value: "seedance-2", label: "Seedance 2.0" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setModelFilter(opt.value);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                      modelFilter === opt.value
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-[#1a1a24] text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">状态：</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "", label: "全部" },
                  { value: "pending", label: "等待中" },
                  { value: "running", label: "运行中" },
                  { value: "succeeded", label: "成功" },
                  { value: "failed", label: "失败" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setStatusFilter(opt.value);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                      statusFilter === opt.value
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-[#1a1a24] text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 underline hover:text-gray-300"
              >
                清除筛选
              </button>
            )}
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────── */}
        {!loading && (
          <>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#12121a] py-16">
                <Zap className="mb-2 h-10 w-10 text-gray-600" />
                <p className="text-sm text-gray-500">暂无任务</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#12121a] shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500">
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        时间
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        用户
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        模型
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-center">
                        状态
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-right">
                        积分
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        Prompt 摘要
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">
                        错误原因
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium text-center">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((gen) => {
                      const statusInfo = STATUS_LABELS[gen.status] ?? {
                        label: gen.status,
                        color: "text-gray-400 bg-gray-500/15",
                      };
                      const truncatedPrompt =
                        gen.prompt.length > 50
                          ? gen.prompt.slice(0, 50) + "..."
                          : gen.prompt;
                      const truncatedError =
                        gen.error && gen.error.length > 60
                          ? gen.error.slice(0, 60) + "..."
                          : gen.error;
                      const modelLabel =
                        MODEL_LABELS[gen.model] ?? gen.model;
                      const canRefresh =
                        gen.model === "seedance-2" &&
                        gen.taskId &&
                        (gen.status === "running" ||
                          gen.status === "pending");
                      const canMarkFailed =
                        gen.status === "running" || gen.status === "pending";
                      const canRefund =
                        gen.status === "failed" &&
                        gen.chargedAt &&
                        gen.credits > 0 &&
                        !gen.refunded;

                      return (
                        <tr
                          key={gen.id}
                          className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                        >
                          <td className="whitespace-nowrap px-3 py-3 text-gray-400">
                            {formatDateTime(gen.createdAt)}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-3 text-gray-200">
                            {gen.userEmail || "未知用户"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-300">
                            {modelLabel}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                            {gen.isTimeout && (
                              <span className="ml-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                                超时
                              </span>
                            )}
                            {gen.refunded && (
                              <span className="ml-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                已退款
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-amber-400 font-medium">
                            {gen.credits}
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-3 text-gray-400">
                            {truncatedPrompt || "-"}
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-3">
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
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              <button
                                onClick={() => openDetail(gen.id)}
                                className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-[11px] font-medium text-violet-300 transition-all hover:bg-violet-500/25"
                              >
                                <Eye className="h-3 w-3" />
                                详情
                              </button>

                              {canRefresh && (
                                <button
                                  onClick={() => handleRefresh(gen.id)}
                                  disabled={actionLoading === gen.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-1 text-[11px] font-medium text-blue-300 transition-all hover:bg-blue-500/25 disabled:opacity-50"
                                >
                                  <RotateCw
                                    className={`h-3 w-3 ${
                                      actionLoading === gen.id
                                        ? "animate-spin"
                                        : ""
                                    }`}
                                  />
                                  刷新
                                </button>
                              )}

                              {canMarkFailed && (
                                <button
                                  onClick={() => handleMarkFailed(gen.id)}
                                  disabled={actionLoading === gen.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300 transition-all hover:bg-red-500/25 disabled:opacity-50"
                                >
                                  <XCircle className="h-3 w-3" />
                                  标记失败
                                </button>
                              )}

                              {canRefund && (
                                <button
                                  onClick={() =>
                                    openRefundModal(
                                      gen.id,
                                      gen.credits,
                                      gen.userEmail
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300 transition-all hover:bg-amber-500/25"
                                >
                                  <DollarSign className="h-3 w-3" />
                                  退款
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ── Pagination ───────────────────────────────────── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
                    <span className="text-xs text-gray-500">
                      共 {total} 条，第 {page}/{totalPages} 页
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setPage((p) => Math.max(1, p - 1))
                        }
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

        {/* ── Footer ───────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-xs text-gray-600">
          此页面仅供内部使用，请勿暴露到公网
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: Task Detail
          ═══════════════════════════════════════════════════════════════ */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl border border-gray-800 bg-[#12121a] shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
                  <Eye className="h-4 w-4 text-violet-400" />
                </div>
                <h2 className="text-base font-semibold text-white">
                  任务详情
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
              {/* ── Loading ────────────────────────────────────────── */}
              {detailLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                </div>
              )}

              {/* ── Error ──────────────────────────────────────────── */}
              {detailError && !detailLoading && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {/* ── Detail Content ─────────────────────────────────── */}
              {!detailLoading && !detailError && detail && (
                <>
                  {/* Section 1: Basic Info */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Zap className="h-4 w-4 text-violet-400" />
                      基本信息
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-5">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                        <div>
                          <span className="text-xs text-gray-500">
                            用户邮箱
                          </span>
                          <p className="mt-0.5 text-gray-200 break-all">
                            {detail.user?.email || "未知"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            用户 ID
                          </span>
                          <p className="mt-0.5 font-mono text-[11px] text-gray-400 break-all">
                            {detail.generation.userId}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            模型
                          </span>
                          <p className="mt-0.5 font-medium text-gray-200">
                            {MODEL_LABELS[detail.generation.model] ??
                              detail.generation.model}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            状态
                          </span>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_LABELS[detail.generation.status]
                                  ?.color ?? "text-gray-400 bg-gray-500/15"
                              }`}
                            >
                              {STATUS_LABELS[detail.generation.status]
                                ?.label ?? detail.generation.status}
                            </span>
                            {detail.generation.isTimeout && (
                              <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                                图片生成超时
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            积分
                          </span>
                          <p className="mt-0.5 font-medium text-amber-400">
                            {detail.generation.credits}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            输出类型
                          </span>
                          <p className="mt-0.5 text-gray-300">
                            {detail.generation.outputType === "video" ? (
                              <span className="inline-flex items-center gap-1">
                                <Film className="h-3.5 w-3.5" />
                                视频
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <ImageIcon className="h-3.5 w-3.5" />
                                图片
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            Task ID
                          </span>
                          <p className="mt-0.5 font-mono text-[11px] text-gray-400 break-all">
                            {detail.generation.taskId || (
                              <span className="text-gray-600">-</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            创建时间
                          </span>
                          <p className="mt-0.5 text-gray-300">
                            {formatDateTime(detail.generation.createdAt)}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            扣费时间
                          </span>
                          <p className="mt-0.5 text-gray-300">
                            {detail.generation.chargedAt
                              ? formatDateTime(detail.generation.chargedAt)
                              : (
                                <span className="text-gray-600">-</span>
                              )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Error */}
                  {detail.generation.error && (
                    <div className="mb-8">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        错误信息
                      </h3>
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <p className="text-sm text-red-400 break-all whitespace-pre-wrap">
                          {detail.generation.error}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Section 3: Prompt */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <FileText className="h-4 w-4 text-violet-400" />
                      Prompt（完整内容）
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-4">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap break-all">
                        {detail.generation.prompt}
                      </p>
                    </div>
                  </div>

                  {/* Section 4: Settings */}
                  {detail.generation.settings &&
                    Object.keys(detail.generation.settings).length > 0 && (
                      <div className="mb-8">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                          <FileText className="h-4 w-4 text-violet-400" />
                          Settings
                        </h3>
                        <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-4">
                          <pre className="max-h-60 overflow-auto text-sm text-gray-300">
                            <code>
                              {JSON.stringify(
                                detail.generation.settings,
                                null,
                                2
                              )}
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}

                  {/* Section 5: Video / Cover URLs */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <ExternalLink className="h-4 w-4 text-violet-400" />
                      输出文件
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-5">
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-gray-500">
                            Video URL
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            {detail.generation.videoUrl ? (
                              <>
                                <a
                                  href={detail.generation.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 truncate text-sm text-violet-400 underline hover:text-violet-300"
                                >
                                  {detail.generation.videoUrl}
                                </a>
                                {detail.generation.status ===
                                  "succeeded" && (
                                  <video
                                    src={detail.generation.videoUrl}
                                    controls
                                    className="h-20 w-20 shrink-0 rounded-lg border border-gray-700 object-cover"
                                  />
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-600">
                                -
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            Cover URL
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            {detail.generation.coverUrl ? (
                              <>
                                <a
                                  href={detail.generation.coverUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 truncate text-sm text-violet-400 underline hover:text-violet-300"
                                >
                                  {detail.generation.coverUrl}
                                </a>
                                <img
                                  src={detail.generation.coverUrl}
                                  alt="cover"
                                  className="h-20 w-20 shrink-0 rounded-lg border border-gray-700 object-cover"
                                />
                              </>
                            ) : (
                              <span className="text-sm text-gray-600">
                                -
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: User Info */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <User className="h-4 w-4 text-violet-400" />
                      用户信息
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-5">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-xs text-gray-500">
                            用户邮箱
                          </span>
                          <p className="mt-0.5 text-gray-200">
                            {detail.user?.email || "未知"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">
                            当前积分
                          </span>
                          <p className="mt-0.5 text-lg font-bold text-amber-400">
                            {detail.user
                              ? formatNumber(detail.user.credits)
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 7: Credit Transactions */}
                  <div className="mb-4">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Clock className="h-4 w-4 text-violet-400" />
                      相关积分流水
                    </h3>
                    {detail.transactions.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#1a1a24] py-8">
                        <FileText className="mr-2 h-5 w-5 text-gray-600" />
                        <p className="text-sm text-gray-500">
                          暂无积分流水
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#1a1a24]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500">
                              <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                                类型
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
                            {detail.transactions.map((tx) => {
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
                                    {formatNumber(tx.balance_after)}
                                  </td>
                                  <td className="max-w-[240px] truncate px-3 py-2.5 text-gray-400">
                                    {tx.description || "-"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-gray-400">
                                    {formatDateTime(tx.created_at)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 8: Admin Actions */}
                  <div className="mb-4">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Zap className="h-4 w-4 text-amber-400" />
                      管理员操作
                    </h3>
                    <div className="rounded-xl border border-gray-800 bg-[#1a1a24] p-5">
                      {(() => {
                        const g = detail.generation;
                        const isSeedance = g.model === "seedance-2";
                        const hasTaskId = !!g.taskId;
                        const isPending = g.status === "pending";
                        const isRunning = g.status === "running";
                        const isFailed = g.status === "failed";
                        const isSucceeded = g.status === "succeeded";
                        const canRefresh = isSeedance && hasTaskId && (isPending || isRunning);
                        const canMarkFailed = isPending || isRunning;
                        const canRefundDetail = isFailed && !!g.chargedAt && g.credits > 0 && !g.refunded;
                        const isRefunded = g.refunded;

                        if (isSucceeded) {
                          return (
                            <p className="text-sm text-gray-500">无可用操作</p>
                          );
                        }

                        return (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {canRefresh && (
                                <button
                                  onClick={() => handleRefresh(g.id)}
                                  disabled={actionLoading === g.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-300 transition-all hover:bg-blue-500/25 disabled:opacity-50"
                                >
                                  <RotateCw className={`h-3.5 w-3.5 ${actionLoading === g.id ? "animate-spin" : ""}`} />
                                  刷新状态
                                </button>
                              )}

                              {canMarkFailed && (
                                <button
                                  onClick={() => handleMarkFailed(g.id)}
                                  disabled={actionLoading === g.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300 transition-all hover:bg-red-500/25 disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  标记失败
                                </button>
                              )}

                              {canRefundDetail && (
                                <button
                                  onClick={() => openRefundModal(g.id, g.credits, detail.user?.email || "")}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/25"
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                  退还积分
                                </button>
                              )}

                              {isRefunded && (
                                <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-400">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  已退款
                                </div>
                              )}

                              {isFailed && !canRefundDetail && !isRefunded && (
                                <p className="text-sm text-gray-500">无可用操作</p>
                              )}
                            </div>

                            {/* Timeout hint for stuck image generations */}
                            {g.isTimeout && (
                              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                  <div>
                                    <p className="text-xs font-medium text-amber-400">
                                      图片生成超时
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-amber-400/70">
                                      该任务已超过 3 分钟未完成，建议点击上方「标记失败」手动关闭。
                                      system 不会自动重试，避免重复 API 成本。
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Refund info if already refunded */}
                      {detail.generation.refunded && detail.generation.refundTransaction && (
                        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <p className="text-xs font-medium text-emerald-400">退款记录</p>
                          <p className="mt-1 text-xs text-emerald-400/70">
                            金额：{detail.generation.refundTransaction.amount} 积分
                          </p>
                          <p className="mt-0.5 text-xs text-emerald-400/70">
                            时间：{formatDateTime(detail.generation.refundTransaction.createdAt)}
                          </p>
                          {detail.generation.refundTransaction.description && (
                            <p className="mt-0.5 text-xs text-emerald-400/70">
                              备注：{detail.generation.refundTransaction.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: Refund Confirmation
          ═══════════════════════════════════════════════════════════════ */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-[#12121a] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                <DollarSign className="h-4 w-4 text-amber-400" />
              </div>
              <h2 className="text-base font-semibold text-white">
                确认退款
              </h2>
              <button
                onClick={closeRefundModal}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-[#1a1a24] px-4 py-3">
                <span className="text-sm text-gray-400">退还积分</span>
                <span className="text-lg font-bold text-amber-400">
                  {refundTarget.credits}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#1a1a24] px-4 py-3">
                <span className="text-sm text-gray-400">用户邮箱</span>
                <span className="text-sm text-gray-200">
                  {refundTarget.userEmail || "未知"}
                </span>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  退款原因
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="请输入退款原因（至少 2 个字）"
                  className="w-full rounded-lg border border-gray-800 bg-[#0a0a0f] px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>

            {/* Result */}
            {refundResult && (
              <div
                className={`mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
                  refundResult.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/20 bg-red-500/10 text-red-400"
                }`}
              >
                {refundResult.type === "success" ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{refundResult.message}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeRefundModal}
                className="flex-1 rounded-lg border border-gray-800 bg-[#1a1a24] px-4 py-2.5 text-sm font-medium text-gray-400 transition-all hover:border-gray-700 hover:text-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleRefund}
                disabled={refundSubmitting}
                className="flex-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50"
              >
                {refundSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    处理中...
                  </span>
                ) : (
                  "确认退款"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
