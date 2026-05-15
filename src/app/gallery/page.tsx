"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Sparkles,
  Heart,
  Download,
  Clock,
  X,
  Play,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublicGeneration {
  id: string;
  title: string;
  description: string;
  category: string;
  modelId: string | null;
  outputType: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  thumbnailUrl: string | null;
  likesCount: number;
  publishedAt: string | null;
  userEmailMasked: string;
  isLikedByCurrentUser: boolean;
}

// ─── Preview Modal ─────────────────────────────────────────────────────────

function PreviewModal({
  item,
  onClose,
}: {
  item: PublicGeneration;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const mediaUrl = item.coverUrl || item.videoUrl || item.thumbnailUrl;

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

        {/* Media */}
        <div className="relative flex max-h-[60vh] items-center justify-center bg-black">
          {item.outputType === "video" && item.videoUrl ? (
            <video
              ref={videoRef}
              src={item.videoUrl}
              controls
              autoPlay
              className="max-h-[60vh] w-full"
            >
              您的浏览器不支持视频播放
            </video>
          ) : mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt={item.title}
              className="max-h-[60vh] w-auto rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center text-text-muted">
              暂无预览
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
          {item.description && (
            <p className="mt-1.5 text-sm text-text-secondary">{item.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-violet/10 px-2.5 py-0.5 text-accent-violet-light">
              {item.category}
            </span>
            {item.modelId && (
              <span>{item.modelId}</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {item.likesCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.publishedAt
                ? new Date(item.publishedAt).toLocaleDateString("zh-CN")
                : "未知"}
            </span>
            <span>{item.userEmailMasked}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Gallery Page ──────────────────────────────────────────────────────────

const categories = [
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

export default function GalleryPage() {
  const [generations, setGenerations] = useState<PublicGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [sortBy, setSortBy] = useState<"latest" | "likes">("latest");
  const [previewItem, setPreviewItem] = useState<PublicGeneration | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const supabase = createBrowserSupabaseClient();

  // ── Auth check ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        setIsLoggedIn(true);
        setToken(session.access_token);
      }
    }
    checkAuth();
  }, [supabase]);

  // ── Fetch public generations ────────────────────────────────────────────
  const fetchGenerations = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "全部") {
        params.set("category", selectedCategory);
      }
      params.set("sort", sortBy);

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/public-generations?${params.toString()}`, {
        headers,
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "获取公开作品失败");
      }

      setGenerations(data.generations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取公开作品失败");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, sortBy, token]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  // ── Like handler ────────────────────────────────────────────────────────
  const handleLike = useCallback(
    async (id: string) => {
      if (!token) return;

      try {
        const res = await fetch(`/api/public-generations/${id}/like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.success) {
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === id
                ? {
                    ...g,
                    likesCount: data.likesCount,
                    isLikedByCurrentUser: data.liked,
                  }
                : g
            )
          );
        }
      } catch {
        // silently ignore
      }
    },
    [token]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Preview Modal ──────────────────────────────────────────────── */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/create" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-violet-light">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-base font-semibold text-foreground">
              Nova Studio
            </span>
          </Link>

          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-card/40 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent-violet/20 hover:bg-accent-violet/5 hover:text-accent-violet-light"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回创作
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            公开作品
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            浏览社区用户分享的 AI 生成作品，发现创作灵感
          </p>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  selectedCategory === cat
                    ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                    : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">排序：</span>
            <button
              onClick={() => setSortBy("latest")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                sortBy === "latest"
                  ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                  : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
              }`}
            >
              最新发布
            </button>
            <button
              onClick={() => setSortBy("likes")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                sortBy === "likes"
                  ? "border-accent-violet/30 bg-accent-violet/15 text-accent-violet-light"
                  : "border-border/50 bg-card/40 text-text-secondary hover:border-accent-violet/20 hover:text-foreground"
              }`}
            >
              最多点赞
            </button>
          </div>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-violet-light" />
            <p className="mt-3 text-sm text-text-muted">加载中...</p>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {!isLoading && error && (
          <div className="mx-auto max-w-md rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Empty ────────────────────────────────────────────────────── */}
        {!isLoading && !error && generations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Sparkles className="h-12 w-12 text-text-muted/30" />
            <p className="mt-4 text-sm text-text-muted">
              暂无公开作品
            </p>
            <Link
              href="/create"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              开始创作
            </Link>
          </div>
        )}

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        {!isLoading && !error && generations.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {generations.map((item) => (
              <div
                key={item.id}
                className="group animate-fade-in-scale flex cursor-pointer flex-col rounded-xl border border-border/40 bg-gradient-to-br from-card/70 to-card/40 p-3 backdrop-blur-sm transition-all duration-200 hover:border-accent-violet/20 hover:shadow-lg hover:shadow-accent-violet/5"
                onClick={() => setPreviewItem(item)}
              >
                {/* Thumbnail */}
                <div className="relative mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-violet/10 to-accent-violet/5">
                  {item.coverUrl || item.thumbnailUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.coverUrl || item.thumbnailUrl!}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      {item.outputType === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white/80" />
                        </div>
                      )}
                    </>
                  ) : item.videoUrl ? (
                    <>
                      <video
                        src={item.videoUrl}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-8 w-8 text-white/80" />
                      </div>
                    </>
                  ) : (
                    <ImageIcon className="h-8 w-8 text-accent-violet/30" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-text-muted">
                    {item.description || "无描述"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.modelId && (
                      <span className="inline-flex items-center rounded-full bg-accent-violet/10 px-2 py-0.5 text-[9px] text-accent-violet-light">
                        {item.modelId}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
                      <Heart className={`h-3 w-3 ${item.isLikedByCurrentUser ? "fill-red-400 text-red-400" : ""}`} />
                      {item.likesCount}
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-text-muted/60">
                    {item.userEmailMasked}
                  </p>
                </div>

                {/* Like button overlay */}
                <div className="mt-2 flex items-center gap-1.5 border-t border-border/20 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(item.id);
                    }}
                    disabled={!isLoggedIn}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
                      item.isLikedByCurrentUser
                        ? "text-red-400 hover:bg-red-400/10"
                        : "text-text-muted hover:bg-accent-violet/10 hover:text-accent-violet-light"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <Heart
                      className={`h-3 w-3 ${
                        item.isLikedByCurrentUser ? "fill-red-400" : ""
                      }`}
                    />
                    {item.isLikedByCurrentUser ? "已赞" : "点赞"}
                  </button>
                  {item.videoUrl && (
                    <a
                      href={item.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-accent-violet/10 hover:text-accent-violet-light"
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
