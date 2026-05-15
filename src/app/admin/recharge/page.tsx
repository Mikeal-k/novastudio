"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  LogOut,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  Clock,
  Search,
  Filter,
  BarChart3,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; email: string }
  | { status: "authorized"; email: string };

interface RechargeOrder {
  id: string;
  userId: string;
  userEmail: string;
  packageName: string;
  amountYuan: number;
  credits: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  remarkCode: string;
  paymentProofUrl: string | null;
  paymentProofUploadedAt: string | null;
  payerNote: string | null;
}

type FilterMode = "pending" | "all";

// ─── Helper: copy to clipboard ──────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    return true;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminRechargePage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [adminSecret, setAdminSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Order list state ─────────────────────────────────────────────────────
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("pending");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedRemark, setCopiedRemark] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) setAuthState({ status: "unauthenticated" });
          return;
        }

        const token = session.access_token;

        // Call server-side API to check admin status
        const res = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!data.success) {
          if (!cancelled) setAuthState({ status: "unauthenticated" });
          return;
        }

        if (data.isAdmin) {
          if (!cancelled)
            setAuthState({ status: "authorized", email: data.email });
        } else {
          if (!cancelled)
            setAuthState({ status: "unauthorized", email: data.email });
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

  // ── Fetch orders ──────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setOrdersError("未登录");
        setOrdersLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (filterMode === "all") {
        params.set("status", "all");
      }

      const res = await fetch(
        `/api/admin/recharge/orders?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();

      if (data.success) {
        setOrders(data.orders ?? []);
      } else {
        setOrdersError(data.error || "获取订单列表失败");
      }
    } catch (err) {
      setOrdersError(
        err instanceof Error ? err.message : "网络请求失败"
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [supabase, filterMode]);

  // Fetch orders when authorized and filter changes
  useEffect(() => {
    if (authState.status === "authorized") {
      fetchOrders();
    }
  }, [authState.status, fetchOrders]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }, [supabase, router]);

  const handleApprove = async () => {
    setResult(null);

    if (!adminSecret.trim()) {
      setResult({ type: "error", message: "请输入 Admin Secret" });
      return;
    }

    if (!orderId.trim()) {
      setResult({ type: "error", message: "请输入订单 ID" });
      return;
    }

    // Check if order is already paid
    const existingOrder = orders.find((o) => o.id === orderId.trim());
    if (existingOrder?.status === "paid") {
      setResult({ type: "error", message: "该订单已确认到账，无需重复操作" });
      return;
    }

    setLoading(true);

    try {
      // Get access token for the request
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/admin/recharge/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ orderId: orderId.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          type: "success",
          message: data.message + `，当前余额：${data.newCredits} 积分`,
        });
        // Refresh order list
        fetchOrders();
      } else {
        setResult({
          type: "error",
          message: data.error || "确认失败",
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "网络请求失败",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Approve from list ─────────────────────────────────────────────────────

  const handleApproveFromList = async (orderIdToApprove: string) => {
    // Find the order to check its status
    const order = orders.find((o) => o.id === orderIdToApprove);
    if (order?.status === "paid") {
      setResult({ type: "error", message: "该订单已确认到账，无需重复操作" });
      return;
    }
    // Auto-fill the form
    setOrderId(orderIdToApprove);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Copy handlers ─────────────────────────────────────────────────────────

  const handleCopyId = async (id: string) => {
    await copyToClipboard(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyRemark = async (remark: string) => {
    await copyToClipboard(remark);
    setCopiedRemark(remark);
    setTimeout(() => setCopiedRemark(null), 2000);
  };

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
            需要管理员权限才能访问充值确认后台
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

  // ── Unauthorized (logged in but not admin) ────────────────────────────
  if (authState.status === "unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">无权限访问</h1>
          <p className="mb-6 text-sm text-gray-500">
            当前账号不是管理员账号，无法访问充值确认后台。
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

  // ── Authorized — show the admin form + order list ─────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Shield className="h-6 w-6 text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-white">管理员充值确认</h1>
          <p className="mt-1 text-sm text-gray-500">
            人工确认充值订单，手动为用户加积分
          </p>
          <button
            onClick={() => router.push("/admin")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-all hover:bg-violet-500/20"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            返回后台总览
          </button>
        </div>

        {/* Admin info bar */}
        <div className="mb-6 flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2.5">
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

        {/* ── Confirm Form ──────────────────────────────────────────────── */}
        <div className="mb-8 rounded-xl border border-gray-800 bg-[#12121a] p-6 shadow-2xl">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">
            手动确认订单
          </h2>

          {/* Admin Secret */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              Admin Secret
            </label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="输入管理员密钥"
              className="w-full rounded-lg border border-gray-800 bg-[#1a1a24] px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          {/* Order ID */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              订单 ID
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="输入充值订单 UUID，或从下方列表点击自动填入"
              className="w-full rounded-lg border border-gray-800 bg-[#1a1a24] px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                确认充值
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <div
              className={`mt-4 flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
                result.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {result.type === "success" ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        {/* ── Order List ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-[#12121a] p-6 shadow-2xl">
          {/* Header + Filters */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              充值订单列表
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterMode("pending")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "pending"
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-gray-800/50 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                }`}
              >
                <Clock className="h-3 w-3" />
                待确认
              </button>
              <button
                onClick={() => setFilterMode("all")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filterMode === "all"
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-gray-800/50 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                }`}
              >
                <Filter className="h-3 w-3" />
                全部
              </button>
              <button
                onClick={fetchOrders}
                disabled={ordersLoading}
                className="flex items-center gap-1.5 rounded-lg bg-gray-800/50 px-3 py-1.5 text-xs font-medium text-gray-500 transition-all hover:bg-gray-800 hover:text-gray-300 disabled:opacity-50"
              >
                <Loader2
                  className={`h-3 w-3 ${ordersLoading ? "animate-spin" : ""}`}
                />
                刷新
              </button>
            </div>
          </div>

          {/* Loading */}
          {ordersLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            </div>
          )}

          {/* Error */}
          {ordersError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{ordersError}</span>
            </div>
          )}

          {/* Empty state */}
          {!ordersLoading && !ordersError && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="mb-2 h-8 w-8 text-gray-600" />
              <p className="text-sm">
                {filterMode === "pending"
                  ? "暂无待确认的充值订单"
                  : "暂无充值订单记录"}
              </p>
            </div>
          )}

          {/* Order cards */}
          {!ordersLoading && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-gray-800 bg-[#1a1a24] p-4 transition-colors hover:border-gray-700"
                >
                  {/* Top row: status + user email */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {order.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          已到账
                        </span>
                      ) : order.paymentProofUrl ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
                          <CheckCircle className="h-3 w-3" />
                          已提交凭证
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                          <Clock className="h-3 w-3" />
                          待付款
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-gray-500">用户邮箱</span>
                      <p className="mt-0.5 font-medium text-gray-200 truncate">
                        {order.userEmail || order.userId.slice(0, 8) + "..."}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">套餐</span>
                      <p className="mt-0.5 font-medium text-gray-200">
                        {order.packageName}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">金额</span>
                      <p className="mt-0.5 font-medium text-gray-200">
                        ¥{order.amountYuan}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">积分</span>
                      <p className="mt-0.5 font-medium text-amber-400">
                        {order.credits}
                      </p>
                    </div>
                  </div>

                  {/* Order ID + Remark */}
                  <div className="mb-3 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">订单号</span>
                      <p className="mt-0.5 font-mono text-[10px] text-gray-300 break-all">
                        {order.id}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">付款备注后 6 位</span>
                      <p className="mt-0.5 font-mono text-sm font-bold tracking-wider text-amber-400">
                        {order.remarkCode}
                      </p>
                    </div>
                  </div>

                  {/* Paid at */}
                  {order.paidAt && (
                    <div className="mb-3 text-[10px] text-gray-500">
                      已支付时间：{new Date(order.paidAt).toLocaleString("zh-CN")}
                    </div>
                  )}

                  {/* Payment proof */}
                  <div className="mb-3">
                    {order.paymentProofUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-emerald-400">
                            付款截图：已上传
                          </span>
                          {order.paymentProofUploadedAt && (
                            <span className="text-[10px] text-gray-500">
                              {new Date(order.paymentProofUploadedAt).toLocaleString("zh-CN")}
                            </span>
                          )}
                        </div>
                        <a
                          href={order.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block"
                        >
                          <Image
                            src={order.paymentProofUrl}
                            alt="付款截图"
                            width={160}
                            height={120}
                            className="rounded-lg border border-gray-700 object-cover transition-opacity hover:opacity-80"
                            unoptimized
                          />
                        </a>
                        {order.payerNote && (
                          <p className="text-[11px] text-gray-400">
                            用户备注：{order.payerNote}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-500">
                        付款截图：未上传
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                    <button
                      onClick={() => handleCopyId(order.id)}
                      className="flex items-center gap-1 rounded-md bg-gray-800/50 px-2.5 py-1.5 text-[11px] font-medium text-gray-400 transition-all hover:bg-gray-700 hover:text-gray-200"
                    >
                      {copiedId === order.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedId === order.id ? "已复制" : "复制订单号"}
                    </button>
                    <button
                      onClick={() => handleCopyRemark(order.remarkCode)}
                      className="flex items-center gap-1 rounded-md bg-gray-800/50 px-2.5 py-1.5 text-[11px] font-medium text-gray-400 transition-all hover:bg-gray-700 hover:text-gray-200"
                    >
                      {copiedRemark === order.remarkCode ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedRemark === order.remarkCode ? "已复制" : "复制备注"}
                    </button>
                    {order.status === "paid" ? (
                      <span className="ml-auto text-[11px] text-gray-500">
                        已确认到账
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApproveFromList(order.id)}
                        className="ml-auto flex items-center gap-1 rounded-md bg-gradient-to-r from-violet-600 to-violet-500 px-3 py-1.5 text-[11px] font-medium text-white shadow transition-all hover:from-violet-500 hover:to-violet-400"
                      >
                        <CheckCircle className="h-3 w-3" />
                        确认到账
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          此页面仅供内部使用，请勿暴露到公网
        </p>
      </div>
    </div>
  );
}
