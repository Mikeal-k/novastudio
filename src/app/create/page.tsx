"use client";

"use client";

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGenerationCost, SEEDANCE_DURATIONS } from "@/lib/seedance";
import { RECHARGE_PACKAGES } from "@/lib/pricing";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AccountDropdown } from "@/components/AccountDropdown";
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
  Star,
  Coins,
  CreditCard,
  X,
  ImageUp,
  FileText,
  AlertCircle,
  Play,
  Loader2,
  User,
  Copy,
  Check,
  Eye,
  Volume2,
  Music,
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
  /** "real" = genuinely connected, "mock" = experience mode / coming soon */
  status: "real" | "mock";
}

const models: ModelOption[] = [
  {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5",
    category: "图片生成",
    description: "适合商品图、海报、封面、分镜图",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
    status: "real",
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    category: "图片生成",
    description: "新一代图片生成模型，效果更佳",
    supportedOutputs: ["image"],
    generateLabel: () => "生成图片",
    resultMessage: () => "图片已生成",
    status: "real",
  },
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    category: "视频生成",
    description: "适合文生视频、图生视频、短视频广告",
    supportedOutputs: ["video"],
    generateLabel: () => "生成视频",
    resultMessage: () => "视频已生成",
    status: "real",
  },
];

const videoDurations = SEEDANCE_DURATIONS;
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
    key: "poster",
    label: "海报设计",
    prompt:
      "生成一张适合小红书和朋友圈传播的产品宣传海报，画面高级、重点突出、文字区域清晰，适合推广 AI 视频生成服务。",
    modelId: "gpt-image-1.5",
  },
  {
    key: "social",
    label: "社交媒体",
    prompt:
      "为一条小红书种草内容生成封面图和视觉方向，主题是 AI 视频生成工具，画面要有点击欲、年轻化、高级感，适合社交媒体传播。",
    modelId: "gpt-image-1.5",
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
  isPublic?: boolean;
  publicTitle?: string | null;
  publicDescription?: string | null;
  publicCategory?: string | null;
  publishedAt?: string | null;
  likesCount?: number;
  taskId?: string | null;
  settings?: Record<string, unknown> | null;
}

// ─── Image model ID to display name mapping ─────────────────────────────────

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-image-1.5": "GPT Image 1.5",
  "gpt-image-2": "GPT Image 2",
  "seedance-2": "Seedance 2.0",
};

const MODEL_ID_BY_DISPLAY_NAME: Record<string, string> = {};
for (const [id, name] of Object.entries(MODEL_DISPLAY_NAMES)) {
  MODEL_ID_BY_DISPLAY_NAME[name] = id;
}

// ─── Hydrate generation form from a historical task (Bug 1 fix) ─────────────

function hydrateGenerationFormFromTask(
  task: DBGeneration,
  setters: {
    setPrompt: (v: string) => void;
    setSelectedModelId: (v: string) => void;
    setAspectRatio: (v: string) => void;
    setVideoDuration: (v: number) => void;
    setSelectedClarity: (v: string) => void;
    setSelectedStyle: (v: string) => void;
    setAudioSfx: (v: boolean) => void;
    setAudioMusic: (v: boolean) => void;
  }
): void {
  const {
    setPrompt,
    setSelectedModelId,
    setAspectRatio,
    setVideoDuration,
    setSelectedClarity,
    setSelectedStyle,
    setAudioSfx,
    setAudioMusic,
  } = setters;

  // 1. Restore prompt
  setPrompt(task.prompt || "");

  // 2. Restore model — try to match by display name first, then use model id directly
  const modelId = MODEL_ID_BY_DISPLAY_NAME[task.model] || task.model;
  setSelectedModelId(modelId);

  // 3. Restore settings if present
  const settings = task.settings;
  if (settings && typeof settings === "object") {
    if (typeof settings.aspectRatio === "string") {
      setAspectRatio(settings.aspectRatio);
    }
    if (typeof settings.duration === "number") {
      setVideoDuration(settings.duration);
    }
    if (typeof settings.quality === "string") {
      setSelectedClarity(settings.quality);
    }
    if (typeof settings.style === "string") {
      setSelectedStyle(settings.style);
    }
    if (typeof settings.audioSfx === "boolean") {
      setAudioSfx(settings.audioSfx);
    }
    if (typeof settings.audioMusic === "boolean") {
      setAudioMusic(settings.audioMusic);
    }
  }
}

// ─── Preview / Download URL helpers (Bug 2 fix) ────────────────────────────

/**
 * Return the best URL for previewing a generation result.
 * - For video tasks: returns video_url.
 * - For image tasks: returns cover_url / video_url.
 * Never returns reference image URLs.
 */
function getPreviewUrl(task: DBGeneration): string | null {
  if (task.output_type === "video") {
    return task.video_url || null;
  }
  return task.cover_url || task.video_url || null;
}

/**
 * Return the best URL for downloading a generation result.
 * - For video tasks: returns video_url ONLY. Never falls back to cover_url or reference image.
 * - For image tasks: returns cover_url / video_url.
 * Never returns reference image URLs.
 */
function getDownloadUrl(task: DBGeneration): string | null {
  if (task.output_type === "video") {
    // Video downloads MUST use video_url — never cover_url or reference image URL
    return task.video_url || null;
  }
  return task.cover_url || task.video_url || null;
}

/**
 * Debug helper: log key fields for a generation before download.
 * Useful for verifying the video_url chain end-to-end.
 */
function debugLogGeneration(task: DBGeneration): void {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[download-debug] id=${task.id} model=${task.model} output_type=${task.output_type} ` +
      `video_url=${task.video_url ?? "(null)"} cover_url=${task.cover_url ?? "(null)"} ` +
      `downloadUrl=${getDownloadUrl(task) ?? "(null)"}`
    );
  }
}

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

// ─── Image Preview Modal ───────────────────────────────────────────────────

function ImagePreviewModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
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
        <div className="relative flex max-h-[80vh] items-center justify-center bg-black p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="生成图片预览"
            className="max-h-[75vh] w-auto rounded-lg object-contain"
          />
        </div>
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

interface ExistingOrderInfo {
  id: string;
  packageName: string;
  amount: number;
  credits: number;
  status: string;
  createdAt: string;
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
  existingOrder,
}: {
  open: boolean;
  onClose: () => void;
  purchaseLoading: string | null;
  purchaseResult: PurchaseResult | null;
  purchaseError: string;
  onSelectPackage: (packageId: string) => void;
  onCopyOrderId: (orderId: string) => void;
  copied: boolean;
  existingOrder: ExistingOrderInfo | null;
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

  const packages = RECHARGE_PACKAGES;

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

              {/* Order status badge */}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                {proofUploaded ? "已提交付款凭证 · 等待管理员确认" : "待付款"}
              </div>

              <p className="mt-3 text-sm text-text-secondary">
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
                    disabled={proofUploading || proofUploaded}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {proofUploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        上传中...
                      </span>
                    ) : proofUploaded ? (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="h-4 w-4" />
                        付款凭证已提交
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
                    付款凭证已提交
                  </p>
                  <p className="mt-1 text-xs text-emerald-400/70">
                    管理员确认后，积分会自动到账。请勿重复创建订单。
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
          ) : existingOrder ? (
            /* ── Existing Order Warning ──────────────────────────── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20">
                <AlertCircle className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">已有待确认订单</h2>
              <p className="mt-2 text-sm text-text-secondary">
                你已有待确认订单，请等待管理员审核。请勿重复创建订单。
              </p>

              <div className="mt-4 rounded-xl border border-border/30 bg-card/50 p-4 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">套餐</span>
                  <span className="font-medium text-foreground">{existingOrder.packageName}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-text-muted">金额</span>
                  <span className="font-medium text-foreground">¥{existingOrder.amount}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-text-muted">积分</span>
                  <span className="font-medium text-amber-400">{existingOrder.credits} 积分</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-text-muted">状态</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                    <Clock className="h-3 w-3" />
                    待确认
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-text-muted">创建时间</span>
                  <span className="text-xs text-gray-400">
                    {new Date(existingOrder.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/10 hover:text-accent-violet-light"
                >
                  关闭
                </button>
              </div>
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

// ─── Share Modal ────────────────────────────────────────────────────────────

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  defaultTitle: string;
  title: string;
  description: string;
  category: string;
  publishing: boolean;
  error: string;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onConfirm: () => void;
}

const shareCategories = [
  "全部",
  "品牌设计",
  "海报与广告",
  "插画",
  "UI设计",
  "角色设计",
  "影片与分镜",
  "产品设计",
  "建筑设计",
];

function ShareModal({
  open,
  onClose,
  defaultTitle,
  title,
  description,
  category,
  publishing,
  error,
  onTitleChange,
  onDescriptionChange,
  onCategoryChange,
  onConfirm,
}: ShareModalProps) {
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
      <div className="relative mx-4 w-full max-w-md animate-fade-in-scale">
        <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent-violet/30 via-transparent to-accent-violet/10 opacity-70 blur-xl" />
        <div className="relative rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-xl shadow-2xl shadow-black/20">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-violet/5">
              <Send className="h-6 w-6 text-accent-violet-light" />
            </div>
            <h2 className="text-lg font-bold text-foreground">分享作品</h2>
            <p className="mt-1 text-sm text-text-secondary">
              填写以下信息将作品公开分享到社区
            </p>
          </div>

          {/* Title */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              作品标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={defaultTitle || "未命名作品"}
              className="w-full rounded-lg border border-border/30 bg-card/30 px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted/60 outline-none transition-colors focus:border-accent-violet/40"
            />
          </div>

          {/* Description */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              作品描述 <span className="text-text-muted/50">（可选）</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="简单描述你的作品..."
              rows={3}
              className="w-full resize-none rounded-lg border border-border/30 bg-card/30 px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted/60 outline-none transition-colors focus:border-accent-violet/40"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              分类
            </label>
            <div className="flex flex-wrap gap-1.5">
              {shareCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onCategoryChange(cat)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200",
                    category === cat
                      ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                      : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/10 hover:text-accent-violet-light"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              disabled={publishing || !title.trim()}
              className="flex-1 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  分享中...
                </span>
              ) : (
                "确认分享"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Script Modal ────────────────────────────────────────────────────────

function AddScriptModal({
  open,
  onClose,
  scriptContent,
  onScriptChange,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  scriptContent: string;
  onScriptChange: (val: string) => void;
  onSave: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
      // Focus textarea after modal opens
      requestAnimationFrame(() => textareaRef.current?.focus());
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

          {/* Icon & Title */}
          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-violet/5">
              <FileText className="h-6 w-6 text-accent-violet-light" />
            </div>
            <h2 className="text-lg font-bold text-foreground">添加脚本</h2>
            <p className="mt-1 text-sm text-text-secondary">
              输入脚本内容，将自动添加到 prompt 中
            </p>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={scriptContent}
            onChange={(e) => onScriptChange(e.target.value)}
            placeholder="输入你的脚本内容..."
            rows={8}
            className="w-full resize-none rounded-xl border border-border/30 bg-card/30 px-4 py-3 text-sm text-foreground placeholder:text-text-muted/60 outline-none transition-colors focus:border-accent-violet/40"
          />

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/10 hover:text-accent-violet-light"
            >
              取消
            </button>
            <button
              onClick={onSave}
              disabled={!scriptContent.trim()}
              className="flex-1 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              保存并使用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Utility: Convert File to Data URL ──────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("图片读取失败"));
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

// ─── Main Component ─────────────────────────────────────────────────────────

function CreatePageContent() {
  const searchParams = useSearchParams();
  const [selectedModelId, setSelectedModelId] = useState<string>("gpt-image-1.5");
  const [outputType, setOutputType] = useState<OutputType>("image");
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<DBGeneration[]>([]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [selectedStyle, setSelectedStyle] = useState("真实质感");
  const [selectedClarity, setSelectedClarity] = useState("标准");
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{
    orderId: string;
    packageName: string;
    amountYuan: number;
    credits: number;
  } | null>(null);
  const [purchaseError, setPurchaseError] = useState("");
  const [existingOrder, setExistingOrder] = useState<ExistingOrderInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [shareModalGenId, setShareModalGenId] = useState<string | null>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareCategory, setShareCategory] = useState("全部");
  const [sharePublishing, setSharePublishing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccessMsg, setShareSuccessMsg] = useState("");
  const [showAllGenerations, setShowAllGenerations] = useState(false);
  const [audioSfx, setAudioSfx] = useState(false);
  const [audioMusic, setAudioMusic] = useState(false);
  const [refreshingTaskIds, setRefreshingTaskIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const autoCheckDoneRef = useRef(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Reference image state ───────────────────────────────────────────────
  const [referenceImages, setReferenceImages] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refImageError, setRefImageError] = useState("");

  // ── Script modal state ──────────────────────────────────────────────────
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptContent, setScriptContent] = useState("");

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
          // Fetch profile data from /api/me
          const meRes = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const meData = await meRes.json();
          if (meData.success) {
            setCredits(meData.profile.credits);
            setDisplayName(meData.user.displayName ?? null);
            setAvatarUrl(meData.user.avatarUrl ?? null);
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

  // Auto-dismiss toast message after 3 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

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

  // ── Refresh profile data from server ────────────────────────────────────

  const refreshProfile = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setCredits(data.profile.credits);
      setDisplayName(data.user.displayName ?? null);
      setAvatarUrl(data.user.avatarUrl ?? null);
    }
  }, [getToken]);

  // Keep refreshCredits as alias for backward compatibility
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

  // ── Clear reference image state (Bug 3 fix) ──────────────────────────────

  const clearReferenceImageState = useCallback(() => {
    // Revoke all object URLs to prevent memory leaks
    setReferenceImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    // Clear error message
    setRefImageError("");
    // Clear hidden file input value via ref
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ── Refresh a single Seedance task status ────────────────────────────────

  const handleRefreshTaskStatus = useCallback(
    async (gen: DBGeneration) => {
      const taskId = gen.taskId;
      if (!taskId) return;

      // Mark this task as refreshing
      setRefreshingTaskIds((prev) => new Set(prev).add(taskId));

      try {
        const token = await getToken();
        if (!token) {
          setToastMessage({ type: "error", text: "认证失败，请重新登录" });
          return;
        }

        const res = await fetch(`/api/generate-video/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.status === "succeeded" || data.success === true) {
          console.log(
            `[create] Task ${taskId} succeeded. ` +
            `responseVideoUrl=${data.videoUrl ?? "(null)"} ` +
            `responseCoverUrl=${data.coverUrl ?? "(null)"}`
          );
          // ── Clear reference image from UI (Bug 3 fix) ─────────────
          clearReferenceImageState();
          setToastMessage({ type: "success", text: "视频生成成功！" });
          await refreshGenerations();
        } else if (data.status === "failed") {
          // ── Clear reference image from UI (Bug 3 fix) ─────────────
          clearReferenceImageState();
          setToastMessage({
            type: "error",
            text: data.error || "视频生成失败",
          });
          await refreshGenerations();
        } else {
          // Still running / pending
          setToastMessage({
            type: "info",
            text: "仍在生成中，请稍后再试",
          });
        }
      } catch (err) {
        setToastMessage({
          type: "error",
          text: err instanceof Error ? err.message : "查询任务状态失败",
        });
      } finally {
        setRefreshingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [getToken, refreshGenerations, clearReferenceImageState]
  );

  // ── Auto-check running Seedance tasks once after generations load ────────

  useEffect(() => {
    if (autoCheckDoneRef.current) return;
    if (!isLoggedIn) return;

    const runningSeedanceTask = recentGenerations.find(
      (g) =>
        (g.status === "running" || g.status === "pending") &&
        g.model === "Seedance 2.0" &&
        g.taskId
    );

    if (runningSeedanceTask) {
      autoCheckDoneRef.current = true;
      handleRefreshTaskStatus(runningSeedanceTask);
    }
  }, [recentGenerations, isLoggedIn, handleRefreshTaskStatus]);

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
        // Convert reference image to data URL (if present, take the first one)
        let referenceImageDataUrl: string | undefined;
        if (referenceImages.length > 0) {
          try {
            referenceImageDataUrl = await fileToDataUrl(referenceImages[0].file);
          } catch {
            setIsGenerating(false);
            setGenerationError("参考图读取失败，请重新选择图片");
            return;
          }
        }

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
            audioSfx: audioSfx || undefined,
            audioMusic: audioMusic || undefined,
            ...(referenceImageDataUrl ? { referenceImageDataUrl } : {}),
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

              // ── Clear reference image from UI (Bug 3 fix) ─────────────
              clearReferenceImageState();

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
              // ── Clear reference image from UI (Bug 3 fix) ─────────────
              clearReferenceImageState();
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
            // ── Clear reference image from UI (Bug 3 fix) ─────────────
            clearReferenceImageState();
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
        // ── Clear reference image from UI (Bug 3 fix) ─────────────
        clearReferenceImageState();
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
      audioSfx,
      audioMusic,
      referenceImages,
      clearReferenceImageState,
    ]
  );

  // ── GPT Image 1.5 real generation (synchronous) ──────────────────────────

  const startGptImage1_5Generation = useCallback(
    async (promptText: string) => {
      setGenerationError("");

      const token = await getToken();
      if (!token) {
        setIsGenerating(false);
        setGenerationError("认证失败，请重新登录");
        return;
      }

      try {
        const submitRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: "gpt-image-1.5",
            prompt: promptText,
            aspectRatio,
          }),
        });

        const submitData = await submitRes.json();

        if (!submitData.success) {
          throw new Error(submitData.error || "图片生成失败");
        }

        // Success — refresh data from server
        await refreshCredits();
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
      } catch (err) {
        setIsGenerating(false);
        setGenerationError(
          err instanceof Error ? err.message : "图片生成失败"
        );
      }
    },
    [aspectRatio, getToken, refreshCredits, refreshGenerations]
  );

  // ── GPT Image 2 real generation (synchronous, same pattern as 1.5) ──────

  const startGptImage2Generation = useCallback(
    async (promptText: string) => {
      setGenerationError("");

      const token = await getToken();
      if (!token) {
        setIsGenerating(false);
        setGenerationError("认证失败，请重新登录");
        return;
      }

      try {
        const submitRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: "gpt-image-2",
            prompt: promptText,
            aspectRatio,
          }),
        });

        const submitData = await submitRes.json();

        if (!submitData.success) {
          throw new Error(submitData.error || "图片生成失败");
        }

        // Success — refresh data from server
        await refreshCredits();
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
      } catch (err) {
        setIsGenerating(false);
        setGenerationError(
          err instanceof Error ? err.message : "图片生成失败"
        );
      }
    },
    [aspectRatio, getToken, refreshCredits, refreshGenerations]
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
      const deficit = currentCost - credits;
      if (selectedModel.id === "seedance-2") {
        setGenerationError(
          `当前积分不足，本次需要 ${currentCost} 积分，你还差 ${deficit} 积分。请先购买积分后再生成。\n真实视频生成成本较高，生成前请确认提示词、比例和时长。`
        );
      } else {
        setGenerationError(
          `当前积分不足，本次需要 ${currentCost} 积分，你还差 ${deficit} 积分。请先购买积分后再生成。`
        );
      }
      return;
    }

    setPromptError("");
    setGenerationError("");
    setIsGenerating(true);

    // GPT Image 1.5 → real OpenAI API
    if (selectedModel.id === "gpt-image-1.5") {
      startGptImage1_5Generation(prompt.trim());
      return;
    }

    // GPT Image 2 → real OpenAI API
    if (selectedModel.id === "gpt-image-2") {
      startGptImage2Generation(prompt.trim());
      return;
    }

    // Seedance 2.0 → real API
    if (selectedModel.id === "seedance-2") {
      startSeedanceGeneration(prompt.trim());
      return;
    }
  }, [
    prompt,
    isGenerating,
    selectedModel,
    outputType,
    startSeedanceGeneration,
    startGptImage1_5Generation,
    startGptImage2Generation,
    isInsufficientCredits,
    currentCost,
    isLoggedIn,
    credits,
  ]);

  const handleBuyClick = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setPurchaseResult(null);
    setPurchaseError("");
    setExistingOrder(null);
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

      if (res.status === 409) {
        // User already has a pending order
        if (data.existingOrder) {
          setExistingOrder(data.existingOrder);
        } else {
          setPurchaseError(data.error || "你已有待确认订单");
        }
        setPurchaseResult(null);
      } else if (data.success) {
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

  // ── Share / Unshare handlers ──────────────────────────────────────────────

  const openShareModal = useCallback((gen: DBGeneration) => {
    setShareModalGenId(gen.id);
    setShareTitle(gen.publicTitle || gen.prompt || "");
    setShareDescription(gen.publicDescription || "");
    setShareCategory(gen.publicCategory || "全部");
    setShareError("");
    setSharePublishing(false);
  }, []);

  const closeShareModal = useCallback(() => {
    setShareModalGenId(null);
    setShareTitle("");
    setShareDescription("");
    setShareCategory("全部");
    setShareError("");
    setSharePublishing(false);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!shareModalGenId) return;
    if (!shareTitle.trim()) {
      setShareError("请填写作品标题");
      return;
    }

    setSharePublishing(true);
    setShareError("");

    try {
      const token = await getToken();
      if (!token) {
        setShareError("请先登录");
        setSharePublishing(false);
        return;
      }

      const res = await fetch(`/api/generations/${shareModalGenId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: shareTitle.trim(),
          description: shareDescription.trim(),
          category: shareCategory,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "分享失败");
      }

      closeShareModal();

      // Update local state
      setRecentGenerations((prev) =>
        prev.map((g) =>
          g.id === shareModalGenId
            ? {
                ...g,
                isPublic: true,
                publicTitle: shareTitle.trim(),
                publicDescription: shareDescription.trim(),
                publicCategory: shareCategory,
              }
            : g
        )
      );

      setShareSuccessMsg("作品已公开分享");
      setTimeout(() => setShareSuccessMsg(""), 3000);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "分享失败，请重试");
    } finally {
      setSharePublishing(false);
    }
  }, [shareModalGenId, shareTitle, shareDescription, shareCategory, getToken, closeShareModal]);

  const handleUnpublish = useCallback(async (genId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        setGenerationError("请先登录");
        return;
      }

      const res = await fetch(`/api/generations/${genId}/unpublish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "取消分享失败");
      }

      // Update local state
      setRecentGenerations((prev) =>
        prev.map((g) =>
          g.id === genId
            ? {
                ...g,
                isPublic: false,
                publicTitle: null,
                publicDescription: null,
                publicCategory: null,
                publishedAt: null,
              }
            : g
        )
      );

      setShareSuccessMsg("已取消公开分享");
      setTimeout(() => setShareSuccessMsg(""), 3000);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "取消分享失败，请重试");
    }
  }, [getToken]);

  // ── Reference image handlers ─────────────────────────────────────────────

  const handleAddReferenceImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRefImageError("");

    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setRefImageError("文件大小超过 5MB 限制，请选择较小的图片");
      // Reset input
      e.target.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setRefImageError("仅支持 PNG、JPG、JPEG、WebP 格式");
      e.target.value = "";
      return;
    }

    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setReferenceImages((prev) => [...prev, { id, file, previewUrl }]);

    // Reset input so same file can be selected again
    e.target.value = "";
  }, []);

  const handleRemoveReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const img = prev.find((img) => img.id === id);
      if (img) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  // ── Script handlers ─────────────────────────────────────────────────────

  const handleOpenScriptModal = useCallback(() => {
    setScriptContent("");
    setShowScriptModal(true);
  }, []);

  const handleSaveScript = useCallback(() => {
    const trimmed = scriptContent.trim();
    if (!trimmed) return;

    setPrompt((prev) => {
      const scriptBlock = `\n\n脚本内容：\n${trimmed}`;
      if (prev.trim()) {
        return prev + scriptBlock;
      }
      return trimmed;
    });

    setShowScriptModal(false);
    setScriptContent("");

    // Focus prompt input after saving
    requestAnimationFrame(() => {
      promptInputRef.current?.focus();
    });
  }, [scriptContent]);

  // ── Handle "New Project" — reset to blank input state ───────────────────

  const handleNewProject = useCallback(() => {
    // Clear prompt
    setPrompt("");
    setPromptError("");
    setGenerationError("");

    // Clear reference images
    setReferenceImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    setRefImageError("");

    // Clear generation state
    setIsGenerating(false);
    setActiveScene(null);

    // Stop polling if active
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Close all modals
    setShowLoginModal(false);
    setShowPurchaseModal(false);
    setPurchaseResult(null);
    setPurchaseError("");
    setPreviewVideoUrl(null);
    setPreviewImageUrl(null);
    closeShareModal();
    setShareSuccessMsg("");

    // Scroll to top creation area & focus prompt
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      promptInputRef.current?.focus();
    });
  }, [closeShareModal]);

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

      {/* ── Image Preview Modal ───────────────────────────────────────── */}
      {previewImageUrl && (
        <ImagePreviewModal
          imageUrl={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}

      {/* ── Purchase Modal ─────────────────────────────────────────── */}
      <PurchaseModal
        open={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          setPurchaseResult(null);
          setPurchaseError("");
          setExistingOrder(null);
        }}
        purchaseLoading={purchaseLoading}
        purchaseResult={purchaseResult}
        purchaseError={purchaseError}
        onSelectPackage={handlePurchasePackage}
        onCopyOrderId={handleCopyOrderId}
        copied={copied}
        existingOrder={existingOrder}
      />

      {/* ── Share Modal ───────────────────────────────────────────── */}
      <ShareModal
        open={shareModalGenId !== null}
        onClose={closeShareModal}
        defaultTitle={
          shareModalGenId
            ? recentGenerations.find((g) => g.id === shareModalGenId)?.prompt ||
              "未命名作品"
            : "未命名作品"
        }
        title={shareTitle}
        description={shareDescription}
        category={shareCategory}
        publishing={sharePublishing}
        error={shareError}
        onTitleChange={setShareTitle}
        onDescriptionChange={setShareDescription}
        onCategoryChange={setShareCategory}
        onConfirm={handlePublish}
      />

      {/* ── Add Script Modal ────────────────────────────────────────── */}
      <AddScriptModal
        open={showScriptModal}
        onClose={() => {
          setShowScriptModal(false);
          setScriptContent("");
        }}
        scriptContent={scriptContent}
        onScriptChange={setScriptContent}
        onSave={handleSaveScript}
      />

      {/* ── Share Success Toast ──────────────────────────────────────── */}
      {shareSuccessMsg && (
        <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 animate-fade-in-scale">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400 shadow-lg backdrop-blur-sm">
            <Check className="h-4 w-4" />
            {shareSuccessMsg}
          </div>
        </div>
      )}

      {/* ── Task Status Toast ───────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 z-[200] -translate-x-1/2 animate-fade-in-scale">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm",
              toastMessage.type === "success" &&
                "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
              toastMessage.type === "error" &&
                "border-red-400/20 bg-red-400/10 text-red-400",
              toastMessage.type === "info" &&
                "border-accent-violet/20 bg-accent-violet/10 text-accent-violet-light"
            )}
          >
            {toastMessage.type === "success" && <Check className="h-4 w-4" />}
            {toastMessage.type === "error" && <AlertCircle className="h-4 w-4" />}
            {toastMessage.type === "info" && <RefreshCw className="h-4 w-4" />}
            {toastMessage.text}
          </div>
        </div>
      )}

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
            onClick={handleBuyClick}
            className="shrink-0 gap-1.5 border-accent-violet/30 bg-accent-violet/10 text-accent-violet-light hover:bg-accent-violet/20 hover:text-accent-violet-light"
          >
            <CreditCard className="h-3.5 w-3.5" />
            购买积分
          </Button>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              promptInputRef.current?.focus();
            }}
            className="flex items-center gap-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-violet-light">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-base font-semibold text-foreground">
              Nova Studio
            </span>
          </button>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
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

                {/* Account Dropdown */}
                <AccountDropdown
                  email={userEmail ?? ""}
                  credits={credits}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  onRefresh={refreshProfile}
                />
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
                  {/* Hidden file input for reference images */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={handleAddReferenceImage}
                    className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent-violet/30 hover:bg-accent-violet/10 hover:text-accent-violet-light"
                  >
                    <ImageUp className="h-3.5 w-3.5" />
                    添加参考图
                  </button>
                  <button
                    onClick={handleOpenScriptModal}
                    className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent-violet/30 hover:bg-accent-violet/10 hover:text-accent-violet-light"
                  >
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

            {/* ── Reference Image Preview ──────────────────────────────── */}
            {referenceImages.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <ImageUp className="h-3.5 w-3.5 text-accent-violet-light" />
                  <span className="text-xs font-medium text-text-secondary">参考图</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {referenceImages.map((img) => (
                    <div key={img.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt="参考图"
                        className="h-16 w-16 rounded-lg border border-border/40 object-cover sm:h-20 sm:w-20"
                      />
                      <button
                        onClick={() => handleRemoveReferenceImage(img.id)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/40 bg-card text-text-muted shadow-sm transition-all hover:bg-card-hover hover:text-foreground opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-text-muted">
                  {selectedModel.id === "seedance-2"
                    ? "参考图已添加，生成视频时将作为画面参考。"
                    : "参考图已添加，当前图片模型暂仅作为创作素材预览。"}
                </p>
              </div>
            )}

            {/* ── Reference image error ──────────────────────────────────── */}
            {refImageError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{refImageError}</span>
                <button
                  onClick={() => setRefImageError("")}
                  className="ml-auto shrink-0 text-red-400/60 transition-colors hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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
              <div className="mt-2 flex flex-col items-end gap-1 text-xs text-red-400">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  <span>
                    当前积分不足，本次需要 {currentCost} 积分，你还差{" "}
                    {currentCost - credits} 积分。请先购买积分后再生成。
                  </span>
                </div>
                {selectedModelId === "seedance-2" && (
                  <span className="text-[10px] text-red-400/70">
                    真实视频生成成本较高，生成前请确认提示词、比例和时长。
                  </span>
                )}
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
                const modelCost =
                  model.id === "seedance-2"
                    ? null // show range instead
                    : getGenerationCost({
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
                      {model.id === "seedance-2" ? (
                        <span className="text-[10px] opacity-60">
                          38-148pt
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-60">
                          {modelCost}pt
                        </span>
                      )}
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
              {/* Model status badge */}
              <span
                className={cn(
                  "ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  selectedModel.status === "real"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-amber-500/10 text-amber-400"
                )}
              >
                {selectedModel.status === "real"
                  ? "真实生成"
                  : selectedModel.id === "gpt-image-2"
                    ? "即将开放"
                    : "体验模式 · 即将接入"}
              </span>

              {/* Reference image indicator — only for Seedance 2.0 when reference image is present */}
              {selectedModel.id === "seedance-2" && referenceImages.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-accent-violet/10 px-2 py-0.5 text-[10px] font-medium text-accent-violet-light">
                  <ImageUp className="h-3 w-3" />
                  将参考图片生成视频
                </span>
              )}

              {/* Audio indicator — only for Seedance 2.0 when audio is enabled */}
              {selectedModel.id === "seedance-2" && (audioSfx || audioMusic) && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-accent-violet/10 px-2 py-0.5 text-[10px] font-medium text-accent-violet-light">
                  <Volume2 className="h-3 w-3" />
                  将生成带音轨的视频
                </span>
              )}
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
                {/* Resolution hint — only for Seedance 2.0 */}
                {selectedModel.id === "seedance-2" && (
                  <p className="mt-1.5 text-[10px] text-text-muted/70 leading-relaxed">
                    {selectedClarity === "标准" && "标准 · 720p"}
                    {selectedClarity === "高清" && "高清 · 720p"}
                    {selectedClarity === "超清" && "超清 · 1080p"}
                    <br />
                    清晰度会影响生成耗时，超清可能更慢。
                  </p>
                )}
              </div>

              {/* Video Duration (video models only) */}
              {selectedModel.supportedOutputs.includes("video") && (
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
              )}

              {/* Audio settings — only for Seedance 2.0 */}
              {selectedModel.id === "seedance-2" && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                    <Volume2 className="h-3.5 w-3.5" />
                    AI 音频设置
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {/* AI音效 toggle */}
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-all duration-200",
                        audioSfx
                          ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                          : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                      )}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={audioSfx}
                        onClick={() => setAudioSfx(!audioSfx)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/40",
                          audioSfx ? "bg-accent-violet-light" : "bg-border/60"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200",
                            audioSfx ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">AI音效</span>
                        <span className="text-[10px] text-text-muted/70">生成环境声、动作声、机械声等</span>
                      </div>
                    </label>

                    {/* AI音乐 toggle */}
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-all duration-200",
                        audioMusic
                          ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                          : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                      )}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={audioMusic}
                        onClick={() => setAudioMusic(!audioMusic)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/40",
                          audioMusic ? "bg-accent-violet-light" : "bg-border/60"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200",
                            audioMusic ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1 text-xs font-medium">
                          <Music className="h-3 w-3" />
                          AI音乐
                        </span>
                        <span className="text-[10px] text-text-muted/70">生成原创背景音乐和氛围音乐</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Recent Projects ──────────────────────────────────────── */}
          <section id="recent-projects" className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                最近项目
              </h2>
              <Link
                href="/gallery"
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent-violet/20 bg-accent-violet/10 px-3 py-1.5 text-xs font-medium text-accent-violet-light transition-all hover:bg-accent-violet/20"
              >
                <Eye className="h-3.5 w-3.5" />
                公开作品
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {/* New project card */}
              <button
                onClick={handleNewProject}
                className="group cursor-pointer flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-card/30 text-text-muted transition-all duration-200 hover:border-accent-violet/30 hover:bg-accent-violet/5 hover:text-accent-violet-light"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-card/50 transition-all duration-200 group-hover:border-accent-violet/30 group-hover:bg-accent-violet/10">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">新建项目</span>
              </button>

              {/* Recent generation cards from DB (only when logged in) */}
              {isLoggedIn && (showAllGenerations ? recentGenerations : recentGenerations.slice(0, 8)).map((gen) => (
                <div
                  key={gen.id}
                  className="group animate-fade-in-scale flex flex-col rounded-xl border border-border/40 bg-gradient-to-br from-card/70 to-card/40 p-4 backdrop-blur-sm transition-all duration-200 hover:border-accent-violet/20 hover:shadow-lg hover:shadow-accent-violet/5"
                >
                  {/* Thumbnail */}
                  <div className="relative mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-violet/10 to-accent-violet/5">
                    {gen.cover_url && gen.output_type === "image" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={gen.cover_url}
                        alt={gen.prompt}
                        className="h-full w-full object-cover"
                      />
                    ) : gen.cover_url ? (
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
                      {gen.status === "succeeded"
                        ? "生成成功"
                        : gen.status === "running" || gen.status === "pending"
                          ? gen.model === "Seedance 2.0"
                            ? "生成中，可刷新状态"
                            : "生成中..."
                          : gen.status === "failed" && gen.error
                            ? gen.error.length > 30
                              ? gen.error.slice(0, 30) + "..."
                              : gen.error
                            : "生成失败"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {new Date(gen.created_at).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} · {gen.cost} 积分
                    </p>
                  </div>

                  {/* Actions — two rows to ensure share always visible */}
                  <div className="mt-2 flex flex-col gap-1 border-t border-border/20 pt-2">
                    {/* Row 1: Preview / Download / Refresh Status */}
                    <div className="flex items-center gap-1.5">
                      {(gen.status === "running" || gen.status === "pending") &&
                      gen.model === "Seedance 2.0" &&
                      gen.taskId ? (
                        <button
                          onClick={() => handleRefreshTaskStatus(gen)}
                          disabled={refreshingTaskIds.has(gen.taskId)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light disabled:opacity-40"
                        >
                          <RefreshCw
                            className={cn(
                              "h-3 w-3",
                              refreshingTaskIds.has(gen.taskId) && "animate-spin"
                            )}
                          />
                          {refreshingTaskIds.has(gen.taskId) ? "查询中..." : "刷新状态"}
                        </button>
                      ) : (() => {
                        const previewUrl = getPreviewUrl(gen);
                        const downloadUrl = getDownloadUrl(gen);
                        // Image task with cover_url
                        if (gen.output_type === "image" && previewUrl) {
                          return (
                            <>
                              <button
                                onClick={() => setPreviewImageUrl(previewUrl)}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                              >
                                <ImageIcon className="h-3 w-3" />
                                预览
                              </button>
                              <a
                                href={downloadUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={gen.prompt ? `${gen.prompt.slice(0, 30)}.png` : "image.png"}
                                onClick={() => { debugLogGeneration(gen); }}
                                className={cn(
                                  "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light",
                                  !downloadUrl && "pointer-events-none opacity-40"
                                )}
                              >
                                <Download className="h-3 w-3" />
                                下载
                              </a>
                            </>
                          );
                        }
                        // Video task with video_url
                        if (gen.output_type === "video" && downloadUrl) {
                          // WARNING: Do NOT reject external URLs as "expired" just because
                          // they don't start with "/". Seedance CDN URLs (https://...) are
                          // valid video URLs that may be used if local download failed.
                          return (
                            <>
                              <button
                                onClick={() => {
                                  // ── Debug log: verify video_url before preview ──
                                  debugLogGeneration(gen);
                                  setPreviewVideoUrl(downloadUrl);
                                }}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                              >
                                <Play className="h-3 w-3" />
                                预览
                              </button>
                              <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                              >
                                <Download className="h-3 w-3" />
                                下载
                              </a>
                            </>
                          );
                        }
                        // No valid URL — show error or status
                        if (gen.status !== "running" && gen.status !== "pending") {
                          return <span className="text-[10px] text-text-muted">{gen.error || "等待生成"}</span>;
                        }
                        return null;
                      })()}
                      {/* Only show "再次生成" for non-running items or non-Seedance items */}
                      {(gen.status !== "running" && gen.status !== "pending") ||
                      gen.model !== "Seedance 2.0" ? (
                        <button
                          onClick={() => {
                            hydrateGenerationFormFromTask(gen, {
                              setPrompt,
                              setSelectedModelId,
                              setAspectRatio,
                              setVideoDuration,
                              setSelectedClarity,
                              setSelectedStyle,
                              setAudioSfx,
                              setAudioMusic,
                            });
                            requestAnimationFrame(() => {
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              promptInputRef.current?.focus();
                            });
                          }}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                        >
                          <Repeat className="h-3 w-3" />
                          再次生成
                        </button>
                      ) : null}
                    </div>
                    {/* Row 2: Share / Unshare */}
                    <div className="flex items-center gap-1.5">
                      {gen.isPublic ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400">
                            <Send className="h-3 w-3" />
                            已公开
                          </span>
                          <button
                            onClick={() => handleUnpublish(gen.id)}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-red-400/10 hover:text-red-400"
                          >
                            取消分享
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openShareModal(gen)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                        >
                          <Send className="h-3 w-3" />
                          分享作品
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Placeholder cards — show all 8 when not logged in, or fill remaining when logged in */}
              {isLoggedIn && !showAllGenerations && recentGenerations.length > 8 && (
                <div className="col-span-full flex justify-center pt-2">
                  <button
                    onClick={() => setShowAllGenerations(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/5 hover:text-accent-violet-light"
                  >
                    <Sparkles className="h-4 w-4" />
                    查看全部项目
                  </button>
                </div>
              )}

              {isLoggedIn && showAllGenerations && recentGenerations.length > 8 && (
                <div className="col-span-full flex justify-center pt-2">
                  <button
                    onClick={() => setShowAllGenerations(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/5 hover:text-accent-violet-light"
                  >
                    收起
                  </button>
                </div>
              )}

              {/* Placeholder cards when not logged in */}
              {!isLoggedIn && Array.from({ length: 8 }).map((_, i) => (
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
                {RECHARGE_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={handleBuyClick}
                    className={cn(
                      "relative rounded-xl border p-5 text-center transition-all duration-200 cursor-pointer",
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
                        "mt-4 w-full pointer-events-auto",
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

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CreatePageContent />
    </Suspense>
  );
}
