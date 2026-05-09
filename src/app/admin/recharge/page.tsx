"use client";

import { useState } from "react";
import { Loader2, CheckCircle, XCircle, Shield } from "lucide-react";

export default function AdminRechargePage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

    setLoading(true);

    try {
      const res = await fetch("/api/admin/recharge/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Shield className="h-6 w-6 text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-white">管理员充值确认</h1>
          <p className="mt-1 text-sm text-gray-500">
            人工确认充值订单，手动为用户加积分
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-gray-800 bg-[#12121a] p-6 shadow-2xl">
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
              placeholder="输入充值订单 UUID"
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

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          此页面仅供内部使用，请勿暴露到公网
        </p>
      </div>
    </div>
  );
}
