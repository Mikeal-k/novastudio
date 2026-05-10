"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGenerationCost } from "@/lib/seedance";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Clock,
  ArrowRight,
  RefreshCw,
  Plus,
  Download,
  Repeat,
  Send,
  Zap,
  Crown,
  Star,
  Coins,
  CreditCard,
  X,
  ImageUp,
  FileText,
  AlertCircle,
  Play,
  LogOut,
  Loader2,
  User,
  Copy,
  Check,
} from "lucide-react";

// ─── Type definitions ───────────────────────────────────────────────────────

type OutputType = "image" | "video";

interface ModelOption {
  id: string;
  name: string;
  category: string;
  description: string;
  supportedOutputs: OutputType[];
  generateLabel: (outputType: OutputType) => string;
  resultMessage: (outputType: OutputType) => string;
}

const models: ModelOption[] = [
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    category: "图片生成",
    description: "适合商品图、海报、封面、分镜图",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
  },
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    category: "视频生成",
    description: "适合文生视频、图生视频、短视频广告",
    supportedOutputs: ["video"],
    generateLabel: () => "生成视频",
    resultMessage: () => "视频已生成",
  },
  {
    id: "grok-imagine",
    name: "Grok Imagine",
    category: "图片/视频创意生成",
    description: "适合创意图片、短视频灵感、图生视频和社媒内容",
    supportedOutputs: ["image", "video"],
    generateLabel: (outputType: OutputType) =>
      outputType === "image" ? "生成图片" : "生成视频",
    resultMessage: (outputType: OutputType) =>
      outputType === "image" ? "图片已生成" : "视频草稿已生成",
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    category: "图片增强",
    description: "适合图片优化、风格化、细节修复",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
  },
  {
    id: "design",
    name: "Design",
    category: "设计模式",
    description: "适合海报、品牌视觉、落地页概念图",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
  },
  {
    id: "branding",
    name: "Branding",
    category: "品牌模式",
    description: "适合生成统一风格的一组视觉素材",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
  },
  {
    id: "ecommerce",
    name: "E-Commerce",
    category: "电商模式",
    description: "适合商品主图、详情图、带货素材",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
  },
  {
    id: "video",
    name: "Video",
    category: "视频模式",
    description: "适合短视频脚本画面、广告视频草案",
    supportedOutputs: ["video"],
    generateLabel: () => "生成视频",
    resultMessage: () => "视频草稿已生成",
  },
];

const videoDurations = [5, 10, 15, 30];
const aspectRatios = [
  { label: "1:1", value: "1:1" },
  { label: "9:16", value: "9:16" },
  { label: "16:9", value: "16:9" },
];
const styles = [
  "真实质感",
  "高级商业",
  "赛博未来",
  "极简设计",
  "产品广告",
];
const clarities = ["标准", "高清", "超清"];

// ─── Scene presets ────────────────────────────────────────────────────────────

interface ScenePreset {
  key: string;
  label: string;
  prompt: string;
  modelId: string;
}

const scenePresets: ScenePreset[] = [
  {
    key: "branding",
    label: "品牌识别",
    prompt:
      "为一个新消费品牌设计一套品牌识别系统，包含 Logo 方向、品牌色彩、字体风格、视觉元素和社交媒体应用场景，风格高级、简洁、有商业质感。",
    modelId: "branding",
  },
  {
    key: "landing",
    label: "落地页设计",
    prompt:
      "为一个 AI 产品设计高转化落地页首屏，包含主标题、副标题、CTA 按钮、产品展示区和信任背书，深色高级科技风，适合官网使用。",
    modelId: "design",
  },
  {
    key: "poster",
    label: "海报设计",
    prompt:
      "生成一张适合小红书和朋友圈传播的产品宣传海报，画面高级、重点突出、文字区域清晰，适合推广 AI 视频生成服务。",
    modelId: "gpt-image-2",
  },
  {
    key: "social",
    label: "社交媒体",
    prompt:
      "为一条小红书种草内容生成封面图和视觉方向，主题是 AI 视频生成工具，画面要有点击欲、年轻化、高级感，适合社交媒体传播。",
    modelId: "gpt-image-2",
  },
];

const scenePresetMap = new Map(scenePresets.map((s) => [s.key, s]));

// ─── Recent generation type (from DB) ───────────────────────────────────────

interface DBGeneration {
  id: string;
  model: string;
  prompt: string;
  output_type: string;
  status: string;
  cost: number;
  video_url: string | null;
  cover_url: string | null;
  error: string | null;
  created_at: string;
}

// ─── Credit packages ────────────────────────────────────────────────────────

const creditPackages = [
  { name: "体验包", price: "¥29.9", credits: 150, popular: false, description: "可生成 1 条 10 秒标准视频" },
  { name: "标准包", price: "¥69.9", credits: 400, popular: true, description: "适合连续生成 2-4 条短视频" },
  { name: "专业包", price: "¥199", credits: 1200, popular: false, description: "适合批量生成短视频素材" },
];

// ─── Video Preview Modal ─────────────────────────────────────────────────────

function VideoPreviewModal({
  videoUrl,
  onClose,
}: {
  videoUrl: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          className="w-full aspect-video bg-black"
        >
          您的浏览器不支持视频播放
        </video>
      </div>
    </div>
  );
}

// ─── Login / Register Modal ────────────────────────────────────────────────

function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-sm animate-fade-in-scale">
        {/* Glow */}
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/30 via-transparent to-accent-violet/10 opacity-70 blur-xl" />

        <div className="relative rounded-2xl border border-border/50 bg-card/80 p-8 backdrop-blur-xl shadow-2xl shadow-black/20 text-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-violet/5">
            <Sparkles className="h-7 w-7 text-accent-violet-light" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground">
            登录后开始生成
          </h2>

          {/* Description */}
          <p className="mt-3 text-sm text-text-secondary leading-relaxed">
            登录后即可获得 30 积分，并保存你的生成记录。生成视频会根据时长和清晰度扣除积分。
          </p>

          {/* Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/auth" className="w-full">
              <Button className="w-full gap-2 bg-gradient-to-r from-accent-violet to-accent-violet-light text-white shadow-lg transition-all duration-200 hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl">
                登录 / 注册
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/10 hover:text-accent-violet-light"
            >
              继续浏览
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent-violet-light" />
        <p className="text-sm text-text-muted">正在加载...</p>
      </div>
    </div>
  );
}

// ─── Purchase Modal ─────────────────────────────────────────────────────────

interface PurchaseResult {
  orderId: string;
  packageName: string;
  amountYuan: number;
  credits: number;
}

function PurchaseModal({
  open,
  onClose,
  purchaseLoading,
  purchaseResult,
  purchaseError,
  onSelectPackage,
  onCopyOrderId,
  copied,
}: {
  open: boolean;
  onClose: () => void;
  purchaseLoading: string | null;
  purchaseResult: PurchaseResult | null;
  purchaseError: string;
  onSelectPackage: (packageId: string) => void;
  onCopyOrderId: (orderId: string) => void;
  copied: boolean;
}) {
  // ── Proof upload state ──────────────────────────────────────────────────
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [payerNote, setPayerNote] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [proofError, setProofError] = useState("");

  // ── Upload proof handler ────────────────────────────────────────────────
  const handleUploadProof = useCallback(async () => {
    if (!purchaseResult?.orderId) {
      setProofError("订单号缺失，请重新创建订单");
      return;
    }
    if (!proofFile) {
      setProofError("请先选择付款截图");
      return;
    }

    setProofUploading(true);
    setProofError("");

    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setProofError("请先登录后再上传付款凭证");
        setProofUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("orderId", purchaseResult.orderId);
      formData.append("file", proofFile);
      formData.append("payerNote", payerNote);

      const res = await fetch("/api/recharge/upload-proof", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "上传失败，请重试");
      }

      setProofUploaded(true);
      setProofError("");
    } catch (err) {
      setProofError(
        err instanceof Error ? err.message : "上传失败，请重试"
      );
    } finally {
      setProofUploading(false);
    }
  }, [purchaseResult, proofFile, payerNote]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const packages = [
    { id: "experience", name: "体验包", price: "¥29.9", credits: 150, popular: false },
    { id: "standard", name: "标准包", price: "¥69.9", credits: 400, popular: true },
    { id: "pro", name: "专业包", price: "¥199", credits: 1200, popular: false },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-lg animate-fade-in-scale">
        {/* Glow */}
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/30 via-transparent to-accent-violet/10 opacity-70 blur-xl" />

        <div className="relative rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-xl shadow-2xl shadow-black/20">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {purchaseResult ? (
            /* ── Success State ─────────────────────────────────────── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">订单已创建</h2>
              <p className="mt-2 text-sm text-text-secondary">
                请按以下步骤完成付款：
              </p>

              {/* Steps */}
              <div className="mt-3 rounded-xl border border-border/30 bg-card/50 p-4 text-left text-xs text-text-secondary space-y-2">
                <p>1. 复制订单号或付款备注</p>
                <p>2. 扫码付款</p>
                <p>3. 付款备注填写订单号后 6 位</p>
                <p>4. 上传付款截图</p>
                <p>5. 等待管理员确认，确认后积分自动到账</p>
              </div>

              {/* Order details */}
              <div className="mt-4 rounded-xl border border-border/30 bg-card/50 p-4 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">套餐</span>
                  <span className="font-medium text-foreground">{purchaseResult.packageName}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-text-muted">金额</span>
                  <span className="font-medium text-foreground">¥{purchaseResult.amountYuan}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-text-muted">积分</span>
                  <span className="font-medium text-amber-400">{purchaseResult.credits} 积分</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-3">
                  <span className="text-text-muted">订单号</span>
                  <button
                    onClick={() => onCopyOrderId(purchaseResult.orderId)}
                    disabled={!purchaseResult.orderId}
                    className="flex items-center gap-1.5 text-xs text-accent-violet-light transition-colors hover:text-accent-violet disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制
                      </>
                    )}
                    <span className="max-w-[160px] truncate font-mono text-[10px]">
                      {purchaseResult.orderId || "—"}
                    </span>
                  </button>
                </div>
              </div>

              {/* ── Upload Proof Section ──────────────────────────────── */}
              {!proofUploaded ? (
                <div className="mt-4 rounded-xl border border-border/30 bg-card/50 p-4 text-left">
                  <h3 className="text-sm font-semibold text-foreground">上传付款截图</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    付款完成后，请上传微信或支付宝付款成功截图。管理员核对后，积分会自动到账。
                  </p>

                  {/* File input */}
                  <div className="mt-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/30 bg-card/30 px-3 py-2.5 text-sm text-text-secondary transition-colors hover:border-accent-violet/30 hover:text-foreground">
                      <ImageUp className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">
                        {proofFile ? proofFile.name : "选择截图文件"}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setProofFile(file);
                          if (file) setProofError("");
                        }}
                      />
                    </label>
                    <p className="mt-1 text-[10px] text-text-muted">支持 PNG/JPG/WebP，最大 5MB</p>
                  </div>

                  {/* Payer note */}
                  <div className="mt-3">
                    <input
                      type="text"
                      value={payerNote}
                      onChange={(e) => setPayerNote(e.target.value)}
                      placeholder="例如：已用支付宝付款，备注 1A2B3C"
                      className="w-full rounded-lg border border-border/30 bg-card/30 px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted/60 outline-none transition-colors focus:border-accent-violet/40"
                    />
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={handleUploadProof}
                    disabled={proofUploading}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {proofUploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        上传中...
                      </span>
                    ) : (
                      "提交付款凭证"
                    )}
                  </button>

                  {/* Error */}
                  {proofError && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{proofError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Upload Success ──────────────────────────────────── */
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-emerald-400">
                    付款凭证已提交，请等待管理员确认
                  </p>
                </div>
              )}

              {/* Contact info — optional, not required */}
              <div className="mt-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 text-left text-xs text-text-muted">
                <p>
                  遇到问题时，可联系客服微信：
                  <span className="text-text-secondary">请替换为你的微信号</span>
                </p>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/10 hover:text-accent-violet-light"
              >
                关闭
              </button>
            </div>
          ) : (
            /* ── Package Selection ─────────────────────────────────── */
            <>
              <div className="mb-2 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-violet/5">
                  <CreditCard className="h-6 w-6 text-accent-violet-light" />
                </div>
                <h2 className="text-lg font-bold text-foreground">购买积分</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  选择套餐，创建订单后联系客服付款
                </p>
              </div>

              {/* Packages */}
              <div className="mt-4 grid gap-3">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => onSelectPackage(pkg.id)}
                    disabled={purchaseLoading !== null}
                    className={`relative flex items-center justify-between rounded-xl border p-4 text-left transition-all duration-200 ${
                      pkg.popular
                        ? "border-accent-violet/40 bg-accent-violet/10"
                        : "border-border/40 bg-card/50 hover:border-accent-violet/20"
                    } ${purchaseLoading === pkg.id ? "opacity-60" : ""}`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-2.5 right-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent-violet to-accent-violet-light px-2.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
                          <Star className="h-3 w-3" />
                          推荐
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-semibold text-foreground">{pkg.name}</span>
                      <span className="ml-2 text-xs text-text-muted">
                        {pkg.credits} 积分
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">{pkg.price}</span>
                      {purchaseLoading === pkg.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-accent-violet-light" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Error */}
              {purchaseError && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{purchaseError}</span>
                </div>
              )}

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/10 hover:text-accent-violet-light"
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedModelId, setSelectedModelId] = useState<string>("gpt-image-2");
  const [outputType, setOutputType] = useState<OutputType>("image");
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<DBGeneration[]>([]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [selectedStyle, setSelectedStyle] = useState("真实质感");
  const [selectedClarity, setSelectedClarity] = useState("标准");
  const [showBuyToast, setShowBuyToast] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{
    orderId: string;
    packageName: string;
    amountYuan: number;
    credits: number;
  } | null>(null);
  const [purchaseError, setPurchaseError] = useState("");
  const [copied, setCopied] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supabase = createBrowserSupabaseClient();

  // ── Read search params (scene / prompt) on mount ────────────────────────
  useEffect(() => {
    const sceneParam = searchParams.get("scene");
    const promptParam = searchParams.get("prompt");

    if (promptParam) {
      // prompt param takes priority
      setPrompt(decodeURIComponent(promptParam));
    } else if (sceneParam) {
      const preset = scenePresetMap.get(sceneParam);
      if (preset) {
        setActiveScene(sceneParam);
        setPrompt(preset.prompt);
        setSelectedModelId(preset.modelId);
      }
    }
  }, [searchParams]);

  // ── Auth check on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setIsLoggedIn(false);
          setIsLoading(false);
          return;
        }

        setIsLoggedIn(true);
        setUserEmail(user.email ?? null);

        // Fetch profile (credits) and generations
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (token) {
          // Fetch credits
          const meRes = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const meData = await meRes.json();
          if (meData.success) {
            setCredits(meData.profile.credits);
          }

          // Fetch recent generations
          const gensRes = await fetch("/api/generations", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const gensData = await gensRes.json();
          if (gensData.success) {
            setRecentGenerations(gensData.generations ?? []);
          }
        }
      } catch (err) {
        console.error("[create] Auth check error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const selectedModel = models.find((m) => m.id === selectedModelId)!;

  // ── Dynamic cost calculation ─────────────────────────────────────────────

  const currentCost = useMemo(() => {
    return getGenerationCost({
      modelId: selectedModelId,
      outputType,
      duration: videoDuration,
      quality: selectedClarity,
    });
  }, [selectedModelId, outputType, videoDuration, selectedClarity]);

  const isInsufficientCredits = credits < currentCost;

  // Reset output type when model changes if the model doesn't support current type
  const handleModelSelect = useCallback(
    (modelId: string) => {
      const model = models.find((m) => m.id === modelId)!;
      setSelectedModelId(modelId);
      if (!model.supportedOutputs.includes(outputType)) {
        setOutputType(model.supportedOutputs[0]);
      }
      setGenerationError("");
    },
    [outputType]
  );

  // ── Get auth token helper ────────────────────────────────────────────────

  const getToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  // ── Refresh credits from server ──────────────────────────────────────────

  const refreshCredits = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setCredits(data.profile.credits);
    }
  }, [getToken]);

  // ── Refresh generations from server ──────────────────────────────────────

  const refreshGenerations = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/generations", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setRecentGenerations(data.generations ?? []);
    }
  }, [getToken]);

  // ── Seedance real generation ─────────────────────────────────────────────

  const startSeedanceGeneration = useCallback(
    async (promptText: string) => {
      setGenerationError("");

      const token = await getToken();
      if (!token) {
        setIsGenerating(false);
        setGenerationError("认证失败，请重新登录");
        return;
      }

      // Double-check credits before calling API
      const cost = getGenerationCost({
        modelId: "seedance-2",
        outputType: "video",
        duration: videoDuration,
        quality: selectedClarity,
      });

      if (credits < cost) {
        setIsGenerating(false);
        setGenerationError(`真实视频生成成本较高，本次需要 ${cost} 积分。请先购买积分后再生成。`);
        return;
      }

      try {
        // Step 1: Submit the task
        const submitRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: promptText,
            aspectRatio,
            duration: videoDuration,
            quality: selectedClarity,
            style: selectedStyle,
          }),
        });

        const submitData = await submitRes.json();

        if (!submitData.success || !submitData.taskId) {
          throw new Error(submitData.error || "Failed to submit video generation task");
        }

        const taskId: string = submitData.taskId;

        // Step 2: Poll for results
        const poll = async () => {
          try {
            const pollRes = await fetch(`/api/generate-video/${taskId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pollData = await pollRes.json();

            if (!pollData.success) {
              throw new Error(pollData.error || "Failed to query task status");
            }

            if (pollData.status === "succeeded") {
              // Stop polling
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }

              // Refresh credits from server (deduction happened server-side)
              await refreshCredits();
              // Refresh generations from server
              await refreshGenerations();

              setIsGenerating(false);
              setPrompt("");

              // Scroll to recent projects
              requestAnimationFrame(() => {
                const el = document.getElementById("recent-projects");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              });
            } else if (pollData.status === "failed") {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              setIsGenerating(false);
              // Do NOT deduct credits on failure
              setGenerationError(pollData.error || "视频生成失败，请重试");
              // Refresh generations to get updated status
              await refreshGenerations();
            }
            // else: still running/pending, continue polling
          } catch (pollErr) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setIsGenerating(false);
            setGenerationError(
              pollErr instanceof Error ? pollErr.message : "查询任务状态失败"
            );
          }
        };

        // Poll every 3 seconds
        pollingRef.current = setInterval(poll, 3000);

        // Also poll immediately
        await poll();
      } catch (err) {
        setIsGenerating(false);
        setGenerationError(
          err instanceof Error ? err.message : "提交视频生成任务失败"
        );
      }
    },
    [
      aspectRatio,
      videoDuration,
      selectedClarity,
      selectedStyle,
      credits,
      getToken,
      refreshCredits,
      refreshGenerations,
    ]
  );

  // ── Handle Generate ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (isGenerating) return;

    if (!prompt.trim()) {
      setPromptError("请先输入你的创作需求");
      promptInputRef.current?.focus();
      return;
    }

    // If not logged in, show login modal — do NOT call API or mock
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    // Check if user has enough credits
    if (isInsufficientCredits) {
      if (selectedModel.id === "seedance-2") {
        setGenerationError(`真实视频生成成本较高，本次需要 ${currentCost} 积分。请先购买积分后再生成。`);
      } else {
        setGenerationError(`当前积分不足，本次需要 ${currentCost} 积分，请先购买积分`);
      }
      return;
    }

    setPromptError("");
    setGenerationError("");
    setIsGenerating(true);

    // Seedance 2.0 → real API
    if (selectedModel.id === "seedance-2") {
      startSeedanceGeneration(prompt.trim());
      return;
    }

    // All other models → mock (deduct credits locally for mock)
    setTimeout(() => {
      selectedModel.resultMessage(outputType);
      const gen: DBGeneration = {
        id: String(Date.now()),
        model: selectedModel.name,
        prompt: prompt.trim(),
        output_type: outputType,
        status: "succeeded",
        cost: currentCost,
        video_url: null,
        cover_url: null,
        error: null,
        created_at: new Date().toISOString(),
      };
      setCredits((prev) => prev - currentCost);
      setRecentGenerations((prev) => [gen, ...prev]);
      setIsGenerating(false);
      setPrompt("");

      // Scroll to recent projects after DOM update
      requestAnimationFrame(() => {
        const el = document.getElementById("recent-projects");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }, 1500);
  }, [
    prompt,
    isGenerating,
    selectedModel,
    outputType,
    startSeedanceGeneration,
    isInsufficientCredits,
    currentCost,
    isLoggedIn,
  ]);

  // ── Logout ───────────────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }, [supabase, router]);

  const handleBuyClick = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setPurchaseResult(null);
    setPurchaseError("");
    setShowPurchaseModal(true);
  };

  const handlePurchasePackage = async (packageId: string) => {
    setPurchaseLoading(packageId);
    setPurchaseError("");
    setPurchaseResult(null);

    try {
      const token = await getToken();
      if (!token) {
        setPurchaseError("认证失败，请重新登录");
        setPurchaseLoading(null);
        return;
      }

      const res = await fetch("/api/recharge/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId }),
      });

      const data = await res.json();

      if (data.success) {
        // Compatible with both data.orderId and data.order.id
        const orderId = data.orderId || data.order?.id;
        if (!orderId) {
          setPurchaseError("订单创建成功但未返回订单号，请刷新后重试");
        } else {
          setPurchaseResult({
            orderId,
            packageName: data.order?.packageName ?? "",
            amountYuan: data.order?.amountYuan ?? 0,
            credits: data.order?.credits ?? 0,
          });
        }
      } else {
        setPurchaseError(data.error || "创建订单失败");
      }
    } catch (err) {
      setPurchaseError(
        err instanceof Error ? err.message : "网络请求失败"
      );
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleCopyOrderId = async (orderId: string) => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = orderId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen />;
  }

  // ── Render (always show workspace, regardless of login) ──────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ── Login Modal ─────────────────────────────────────────────── */}
      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* ── Video Preview Modal ──────────────────────────────────────── */}
      {previewVideoUrl && (
        <VideoPreviewModal
          videoUrl={previewVideoUrl}
          onClose={() => setPreviewVideoUrl(null)}
        />
      )}

      {/* ── Purchase Modal ─────────────────────────────────────────── */}
      <PurchaseModal
        open={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          setPurchaseResult(null);
          setPurchaseError("");
        }}
        purchaseLoading={purchaseLoading}
        purchaseResult={purchaseResult}
        purchaseError={purchaseError}
        onSelectPackage={handlePurchasePackage}
        onCopyOrderId={handleCopyOrderId}
        copied={copied}
      />

      {/* ── Upgrade Banner ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-accent-violet/20 via-accent-violet/10 to-accent-violet/5 border-b border-accent-violet/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.15),transparent_60%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Zap className="h-4 w-4 shrink-0 text-accent-violet-light" />
            <span className="text-text-secondary">
              抢先体验新一代 AI 图片/视频生成模型，升级后获得更多积分与更快生成速度
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-accent-violet/30 bg-accent-violet/10 text-accent-violet-light hover:bg-accent-violet/20 hover:text-accent-violet-light"
          >
            <Crown className="h-3.5 w-3.5" />
            立即升级
          </Button>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-violet-light">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-base font-semibold text-foreground">
              Nova Studio
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {/* User email */}
                {userEmail && (
                  <span className="hidden text-xs text-text-muted sm:block">
                    {userEmail}
                  </span>
                )}

                {/* Credits display */}
                <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <span>当前积分：</span>
                  <span className="text-amber-400">{credits}</span>
                  <button
                    onClick={refreshCredits}
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card/60 hover:text-accent-violet-light"
                    title="刷新积分"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBuyClick}
                  className="gap-1.5 border-accent-violet/20 text-accent-violet-light hover:bg-accent-violet/10"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  购买积分
                </Button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-red-400/10 hover:text-red-400"
                  title="退出登录"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </>
            ) : (
              <>
                {/* Unauthenticated: show "登录后赠送 30 积分" */}
                <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <span>登录后赠送 30 积分</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLoginModal(true)}
                  className="gap-1.5 border-accent-violet/20 text-accent-violet-light hover:bg-accent-violet/10"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  购买积分
                </Button>

                <Link href="/auth">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-gradient-to-r from-accent-violet to-accent-violet-light text-white shadow-lg transition-all duration-200 hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl"
                  >
                    <User className="h-3.5 w-3.5" />
                    登录 / 注册
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Hero Title ─────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            让 AI 帮你生成
            <span className="bg-gradient-to-r from-accent-violet to-accent-violet-light bg-clip-text text-transparent">
              {" "}
              图片和视频
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            输入创意需求，选择生成模型，快速制作商品图、短视频、海报、封面和带货素材。
          </p>

          {/* Scene tag */}
          {activeScene && (() => {
            const preset = scenePresetMap.get(activeScene);
            if (!preset) return null;
            return (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent-violet/20 bg-accent-violet/10 px-4 py-1.5 text-sm text-accent-violet-light backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                <span>当前场景：{preset.label}</span>
              </div>
            );
          })()}
        </div>

        {/* ── Main creation area ────────────────────────────────────── */}
        <div className="mx-auto max-w-4xl">
          {/* ── Prompt Input ─────────────────────────────────────────── */}
          <section className="relative mb-6">
            {/* Glow effect behind the card */}
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/20 via-transparent to-accent-violet/5 opacity-60 blur-xl" />

            <div className="relative rounded-2xl border border-border/50 bg-card/70 p-1 backdrop-blur-xl shadow-lg shadow-black/10">
              <textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (promptError) setPromptError("");
                }}
                placeholder="例如：生成一条适合抖音种草的产品展示视频，真实质感，高级光影，吸引点击"
                className={cn(
                  "min-h-[120px] w-full resize-none rounded-xl border-0 bg-transparent p-4 text-sm text-foreground placeholder-text-muted/50 outline-none transition-all duration-200 sm:p-5 sm:text-base",
                  promptError && "placeholder:text-red-400/50"
                )}
                rows={4}
              />
              {promptError && (
                <p className="px-4 pb-1 text-xs text-red-400 sm:px-5">
                  {promptError}
                </p>
              )}

              {/* Bottom bar */}
              <div className="flex items-center justify-between border-t border-border/30 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent-violet/30 hover:bg-accent-violet/10 hover:text-accent-violet-light">
                    <ImageUp className="h-3.5 w-3.5" />
                    添加参考图
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent-violet/30 hover:bg-accent-violet/10 hover:text-accent-violet-light">
                    <FileText className="h-3.5 w-3.5" />
                    添加脚本
                  </button>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating || isInsufficientCredits}
                  size="lg"
                  className={cn(
                    "gap-2 bg-gradient-to-r from-accent-violet to-accent-violet-light text-white shadow-lg transition-all duration-200",
                    "hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl",
                    "disabled:opacity-40"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {outputType === "image" ? "图片生成中..." : "视频生成中..."}
                    </>
                  ) : isInsufficientCredits ? (
                    <>
                      <Coins className="h-4 w-4" />
                      积分不足
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {selectedModel.generateLabel(outputType)}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Cost indicator */}
            <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-text-muted">
              <Coins className="h-3 w-3 text-amber-400/70" />
              <span>
                本次消耗：<span className="text-amber-400">{currentCost}</span>{" "}
                积分
              </span>
            </div>

            {/* Insufficient credits warning */}
            {isInsufficientCredits && (
              <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                <span>
                  {selectedModelId === "seedance-2"
                    ? `真实视频生成成本较高，本次需要 ${currentCost} 积分。请先购买积分后再生成。`
                    : `当前积分不足，本次需要 ${currentCost} 积分，请先购买积分`}
                </span>
              </div>
            )}

            {/* Generation error */}
            {generationError && !isInsufficientCredits && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{generationError}</span>
                <button
                  onClick={() => setGenerationError("")}
                  className="ml-auto shrink-0 text-red-400/60 transition-colors hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>

          {/* ── Model Chips ──────────────────────────────────────────── */}
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
              选择模型
            </h2>
            <div className="flex flex-wrap gap-2">
              {models.map((model) => {
                const modelCost = getGenerationCost({
                  modelId: model.id,
                  outputType: model.supportedOutputs[0],
                  duration: videoDuration,
                  quality: selectedClarity,
                });
                return (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200",
                      selectedModelId === model.id
                        ? "border-accent-violet/40 bg-accent-violet/15 text-accent-violet-light shadow-sm shadow-accent-violet/5"
                        : "border-border/60 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:bg-accent-violet/5 hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {model.name}
                      <span className="text-[10px] opacity-60">
                        {modelCost}pt
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected model info */}
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/30 bg-card/40 px-4 py-2.5 text-xs text-text-secondary backdrop-blur-sm">
              <span className="font-medium text-accent-violet-light">
                {selectedModel.name}
              </span>
              <span className="text-text-muted">·</span>
              <span>{selectedModel.category}</span>
              <span className="text-text-muted">·</span>
              <span>
                消耗 <span className="text-amber-400">{currentCost}</span>{" "}
                积分
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">{selectedModel.description}</span>
            </div>
          </section>

          {/* ── Generation Settings ──────────────────────────────────── */}
          <section className="mb-8 rounded-2xl border border-border/40 bg-card/50 p-5 backdrop-blur-sm">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
              生成设置
            </h3>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Aspect Ratio */}
              <div>
                <label className="mb-2 block text-xs font-medium text-text-muted">
                  输出比例
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        aspectRatio === ratio.value
                          ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                          : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                      )}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <label className="mb-2 block text-xs font-medium text-text-muted">
                  风格
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {styles.map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(style)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        selectedStyle === style
                          ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                          : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clarity */}
              <div>
                <label className="mb-2 block text-xs font-medium text-text-muted">
                  清晰度
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {clarities.map((clarity) => (
                    <button
                      key={clarity}
                      onClick={() => setSelectedClarity(clarity)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        selectedClarity === clarity
                          ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                          : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                      )}
                    >
                      {clarity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Duration (conditional) */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  视频时长
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {videoDurations.map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setVideoDuration(dur)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        videoDuration === dur
                          ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                          : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                      )}
                    >
                      {dur}秒
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Output type toggle for Grok Imagine */}
            {selectedModel.supportedOutputs.length > 1 && (
              <div className="mt-4 flex items-center gap-3 border-t border-border/20 pt-4">
                <span className="text-xs font-medium text-text-muted">
                  输出类型：
                </span>
                <div className="inline-flex overflow-hidden rounded-lg border border-border/60 bg-card p-0.5">
                  {selectedModel.supportedOutputs.map((type) => (
                    <button
                      key={type}
                      onClick={() => setOutputType(type)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        outputType === type
                          ? "bg-accent-violet/15 text-accent-violet-light shadow-sm"
                          : "text-text-muted hover:text-foreground"
                      )}
                    >
                      {type === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : (
                        <Video className="h-3.5 w-3.5" />
                      )}
                      {type === "image" ? "图片" : "视频"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Recent Projects ──────────────────────────────────────── */}
          <section id="recent-projects" className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              最近项目
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {/* New project card */}
              <button className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-card/30 text-text-muted transition-all duration-200 hover:border-accent-violet/30 hover:bg-accent-violet/5 hover:text-accent-violet-light">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-card/50 transition-all duration-200 group-hover:border-accent-violet/30 group-hover:bg-accent-violet/10">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">新建项目</span>
              </button>

              {/* Recent generation cards from DB (only when logged in) */}
              {isLoggedIn && recentGenerations.slice(0, 4).map((gen) => (
                <div
                  key={gen.id}
                  className="group animate-fade-in-scale flex flex-col rounded-xl border border-border/40 bg-gradient-to-br from-card/70 to-card/40 p-4 backdrop-blur-sm transition-all duration-200 hover:border-accent-violet/20 hover:shadow-lg hover:shadow-accent-violet/5"
                >
                  {/* Thumbnail */}
                  <div className="relative mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-violet/10 to-accent-violet/5">
                    {gen.cover_url ? (
                      <Image
                        src={gen.cover_url}
                        alt={gen.prompt}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : gen.video_url ? (
                      <>
                        <video
                          src={gen.video_url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white/80" />
                        </div>
                      </>
                    ) : gen.output_type === "image" ? (
                      <ImageIcon className="h-8 w-8 text-accent-violet/30" />
                    ) : (
                      <Video className="h-8 w-8 text-accent-violet/30" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {gen.model}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {gen.status === "succeeded" ? "生成成功" : gen.status === "running" ? "生成中..." : "生成失败"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {new Date(gen.created_at).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} · {gen.cost} 积分
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-1.5 border-t border-border/20 pt-2">
                    {gen.video_url ? (
                      <>
                        <button
                          onClick={() => setPreviewVideoUrl(gen.video_url!)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                        >
                          <Play className="h-3 w-3" />
                          预览
                        </button>
                        <a
                          href={gen.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                        >
                          <Download className="h-3 w-3" />
                          下载
                        </a>
                      </>
                    ) : (
                      <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light">
                        <Download className="h-3 w-3" />
                        下载
                      </button>
                    )}
                    <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light">
                      <Repeat className="h-3 w-3" />
                      再次生成
                    </button>
                    <button
                      onClick={() => {
                        if (gen.video_url) {
                          setGenerationError("发布功能即将上线，敬请期待");
                        }
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                    >
                      <Send className="h-3 w-3" />
                      用于发布
                    </button>
                  </div>
                </div>
              ))}

              {/* Placeholder cards — show all 4 when not logged in, or fill remaining when logged in */}
              {Array.from({
                length: isLoggedIn
                  ? Math.max(0, 4 - recentGenerations.length)
                  : 4,
              }).map((_, i) => (
                <div
                  key={`placeholder-${i}`}
                  className="flex flex-col rounded-xl border border-border/20 bg-gradient-to-br from-card/30 to-card/10 p-4 backdrop-blur-sm"
                >
                  <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet/5 to-accent-violet/[0.02]">
                    <Sparkles className="h-8 w-8 text-text-muted/20" />
                  </div>
                  <div className="h-3 w-16 rounded bg-card/40" />
                  <div className="mt-1.5 h-2 w-24 rounded bg-card/30" />
                  <div className="mt-2 border-t border-border/10 pt-2">
                    <div className="h-2 w-12 rounded bg-card/20" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Credit Packages ──────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/70 via-card/50 to-card/30 p-6 backdrop-blur-sm sm:p-8">
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-accent-violet/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-accent-violet/5 blur-3xl" />

            <div className="relative">
              <div className="mb-2 text-center">
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                  购买积分，开始批量生成
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  适合短视频带货、商品种草、广告投放、店铺素材、账号内容矩阵。
                </p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className={cn(
                      "relative rounded-xl border p-5 text-center transition-all duration-200",
                      pkg.popular
                        ? "border-accent-violet/40 bg-accent-violet/10 shadow-lg shadow-accent-violet/5"
                        : "border-border/40 bg-card/50 hover:border-accent-violet/20"
                    )}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent-violet to-accent-violet-light px-3 py-0.5 text-[10px] font-medium text-white shadow-sm">
                          <Star className="h-3 w-3" />
                          最受欢迎
                        </span>
                      </div>
                    )}

                    <h3 className="text-base font-semibold text-foreground">
                      {pkg.name}
                    </h3>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {pkg.price}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      <span className="text-amber-400">{pkg.credits}</span>{" "}
                      积分
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted/70">
                      {pkg.description}
                    </p>

                    <Button
                      onClick={handleBuyClick}
                      variant={pkg.popular ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "mt-4 w-full",
                        pkg.popular
                          ? "bg-gradient-to-r from-accent-violet to-accent-violet-light text-white"
                          : "border-accent-violet/20 text-accent-violet-light"
                      )}
                    >
                      立即购买
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

    </div>
  );
}
