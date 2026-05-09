"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGenerationCost } from "@/lib/seedance";
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

// ─── Recent generation type ──────────────────────────────────────────────────

interface RecentGeneration {
  id: number;
  modelName: string;
  outputType: OutputType;
  prompt: string;
  timestamp: string;
  resultMessage: string;
  cost: number;
  /** Real video URL from Seedance API (only for seedance-2) */
  videoUrl?: string;
  /** Cover image URL from Seedance API (only for seedance-2) */
  coverUrl?: string;
}

// ─── Credit packages ────────────────────────────────────────────────────────

const creditPackages = [
  { name: "体验包", price: "¥19.9", credits: 100, popular: false },
  { name: "标准包", price: "¥49.9", credits: 300, popular: true },
  { name: "专业包", price: "¥99.9", credits: 800, popular: false },
];

// ─── Default credits for new users ──────────────────────────────────────────

const DEFAULT_CREDITS = 30;

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [selectedModelId, setSelectedModelId] = useState<string>("gpt-image-2");
  const [outputType, setOutputType] = useState<OutputType>("image");
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<RecentGeneration[]>(
    []
  );
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [selectedStyle, setSelectedStyle] = useState("真实质感");
  const [selectedClarity, setSelectedClarity] = useState("标准");
  const [showBuyToast, setShowBuyToast] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState(DEFAULT_CREDITS);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Seedance real generation ─────────────────────────────────────────────

  const startSeedanceGeneration = useCallback(
    async (promptText: string) => {
      setGenerationError("");

      // Double-check credits before calling API
      const cost = getGenerationCost({
        modelId: "seedance-2",
        outputType: "video",
        duration: videoDuration,
        quality: selectedClarity,
      });

      if (credits < cost) {
        setIsGenerating(false);
        setGenerationError(`积分不足，本次需要 ${cost} 积分，请先购买积分`);
        return;
      }

      try {
        // Step 1: Submit the task
        const submitRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            aspectRatio,
            duration: videoDuration,
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
            const pollRes = await fetch(`/api/generate-video/${taskId}`);
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

              // Deduct credits only on successful generation
              setCredits((prev) => prev - cost);

              const gen: RecentGeneration = {
                id: Date.now(),
                modelName: "Seedance 2.0",
                outputType: "video",
                prompt: promptText,
                timestamp: new Date().toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                resultMessage: "视频已生成",
                cost,
                videoUrl: pollData.videoUrl ?? undefined,
                coverUrl: pollData.coverUrl ?? undefined,
              };

              setRecentGenerations((prev) => [gen, ...prev]);
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
    [aspectRatio, videoDuration, selectedClarity, credits]
  );

  // ── Handle Generate ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (isGenerating) return;

    if (!prompt.trim()) {
      setPromptError("请先输入你的创作需求");
      promptInputRef.current?.focus();
      return;
    }

    // Check if user has enough credits
    if (isInsufficientCredits) {
      setGenerationError(`当前积分不足，本次需要 ${currentCost} 积分，请先购买积分`);
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

    // All other models → mock (deduct credits immediately for mock)
    setTimeout(() => {
      const result = selectedModel.resultMessage(outputType);
      const gen: RecentGeneration = {
        id: Date.now(),
        modelName: selectedModel.name,
        outputType,
        prompt: prompt.trim(),
        timestamp: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        resultMessage: result,
        cost: currentCost,
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
  ]);

  const handleBuyClick = () => {
    setShowBuyToast(true);
    setTimeout(() => setShowBuyToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Video Preview Modal ──────────────────────────────────────── */}
      {previewVideoUrl && (
        <VideoPreviewModal
          videoUrl={previewVideoUrl}
          onClose={() => setPreviewVideoUrl(null)}
        />
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
            {/* Credits display */}
            <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span>当前积分：</span>
              <span className="text-amber-400">{credits}</span>
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

            <Link
              href="/"
              className="text-xs text-text-muted transition-colors hover:text-foreground"
            >
              返回首页
            </Link>
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
                  当前积分不足，本次需要 {currentCost} 积分，请先购买积分
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

              {/* Recent generation cards */}
              {recentGenerations.slice(0, 4).map((gen) => (
                <div
                  key={gen.id}
                  className="group animate-fade-in-scale flex flex-col rounded-xl border border-border/40 bg-gradient-to-br from-card/70 to-card/40 p-4 backdrop-blur-sm transition-all duration-200 hover:border-accent-violet/20 hover:shadow-lg hover:shadow-accent-violet/5"
                >
                  {/* Thumbnail */}
                  <div className="relative mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-violet/10 to-accent-violet/5">
                    {gen.coverUrl ? (
                      <Image
                        src={gen.coverUrl}
                        alt={gen.prompt}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : gen.videoUrl ? (
                      <>
                        <video
                          src={gen.videoUrl}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white/80" />
                        </div>
                      </>
                    ) : gen.outputType === "image" ? (
                      <ImageIcon className="h-8 w-8 text-accent-violet/30" />
                    ) : (
                      <Video className="h-8 w-8 text-accent-violet/30" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {gen.modelName}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {gen.resultMessage}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {gen.timestamp} · {gen.cost} 积分
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-1.5 border-t border-border/20 pt-2">
                    {gen.videoUrl ? (
                      <>
                        <button
                          onClick={() => setPreviewVideoUrl(gen.videoUrl!)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                        >
                          <Play className="h-3 w-3" />
                          预览
                        </button>
                        <a
                          href={gen.videoUrl}
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
                        if (gen.videoUrl) {
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

              {/* Placeholder cards if fewer than 4 recent generations */}
              {Array.from({
                length: Math.max(0, 4 - recentGenerations.length),
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

      {/* ── Buy Toast ────────────────────────────────────────────────── */}
      {showBuyToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
          <div className="flex items-center gap-3 rounded-xl border border-accent-violet/20 bg-card/90 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <AlertCircle className="h-4 w-4 text-accent-violet-light" />
            <p className="text-sm text-text-secondary">
              支付功能将在下一阶段接入，你可以先联系客服开通。
            </p>
            <button
              onClick={() => setShowBuyToast(false)}
              className="shrink-0 text-text-muted transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
