"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Palette, Layout, Layers, Zap, PenTool } from "lucide-react";

const promptChips = [
  {
    label: "品牌识别",
    icon: Palette,
    scene: "branding",
    hoverText: "Logo / 色板 / 品牌视觉",
  },
  {
    label: "落地页",
    icon: Layout,
    scene: "landing",
    hoverText: "官网首屏 / 转化页",
  },
  {
    label: "海报",
    icon: PenTool,
    scene: "poster",
    hoverText: "宣传海报 / 封面图",
  },
  {
    label: "社交媒体",
    icon: Layers,
    scene: "social",
    hoverText: "小红书 / 抖音素材",
  },
];

export function HeroSection() {
  const [prompt, setPrompt] = useState("");

  const getCreateUrl = () => {
    const trimmed = prompt.trim();
    if (trimmed) {
      return `/create?prompt=${encodeURIComponent(trimmed)}`;
    }
    return "/create";
  };

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-20">
      {/* Background gradient orbs — enhanced */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-accent-violet/25 blur-[140px] animate-pulse-glow" />
        <div className="absolute -bottom-60 left-1/3 h-[500px] w-[500px] rounded-full bg-accent-violet/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-accent-violet-light/10 blur-[100px]" />
        <div className="absolute -left-32 top-1/2 h-[350px] w-[350px] rounded-full bg-purple-500/8 blur-[90px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial vignette to darken edges */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
        {/* Badge */}
        <div className="mb-6 inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-accent-violet/20 bg-accent-violet/10 px-4 py-1.5 text-sm text-accent-violet-light backdrop-blur-sm">
          <Sparkles className="h-4 w-4" />
          <span>AI 设计助手 · Nova Studio</span>
        </div>

        {/* Headline — larger, more impactful */}
        <h1 className="mb-4 text-center text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          让 AI 成为你的
          <br />
          <span className="bg-gradient-to-r from-accent-violet via-accent-violet-light to-purple-300 bg-clip-text text-transparent">
            设计工作室
          </span>
        </h1>

        {/* Subtitle — shorter, punchier */}
        <p className="mx-auto mb-8 max-w-xl text-center text-base text-text-secondary sm:text-lg">
          用自然语言描述你的想法，AI 在数秒内生成可直接交付的设计稿。
        </p>

        {/* === LARGE PROMPT INPUT BOX === */}
        <div className="mb-4 w-full max-w-2xl">
          {/* Outer glow */}
          <div className="absolute -inset-6 left-1/2 w-[calc(100%+3rem)] -translate-x-1/2 rounded-3xl bg-accent-violet/8 blur-3xl" />

          <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-2xl shadow-2xl ring-1 ring-accent-violet/10 transition-all duration-300 focus-within:border-accent-violet/30 focus-within:ring-accent-violet/20">
            <div className="flex-1">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你的设计需求… 例如「一个极简风格的品牌识别系统」"
                className="min-h-[56px] w-full resize-none bg-transparent px-4 py-3 text-base text-foreground placeholder-text-muted/60 outline-none"
                rows={1}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
            </div>
            <Link href={getCreateUrl()}>
              <Button
                size="lg"
                className="h-12 gap-2 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-6 text-base text-white shadow-lg hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl glow transition-all duration-200"
              >
                <Sparkles className="h-5 w-5" />
                开始生成
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Prompt chips — clickable scene links */}
        <div className="mb-12 flex flex-wrap items-center justify-center gap-2">
          {promptChips.map(({ label, icon: Icon, scene, hoverText }) => (
            <Link
              key={label}
              href={`/create?scene=${scene}`}
              className="group relative flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-text-secondary backdrop-blur-sm transition-all duration-200 hover:border-accent-violet/30 hover:bg-accent-violet/10 hover:text-accent-violet-light"
            >
              <Icon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              <span>{label}</span>
              {/* Hover tooltip */}
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2.5 py-1 text-[10px] text-text-secondary opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                {hoverText}
              </span>
            </Link>
          ))}
        </div>

        {/* === VISUAL SHOWCASE — Design Workspace Mockup === */}
        <div className="relative w-full max-w-5xl">
          {/* Floating card 1 — top left, rotated slightly */}
          <div className="absolute -left-4 -top-8 z-10 hidden w-56 animate-float-delayed sm:block md:-left-8 md:w-64">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-2xl backdrop-blur-xl -rotate-3">
              {/* Card preview — gradient mockup */}
              <div className="mb-3 h-28 w-full overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/30 via-accent-violet/20 to-pink-500/20">
                <div className="flex h-full items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <Palette className="h-7 w-7 text-accent-violet-light" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded-full bg-white/10" />
                <div className="h-2 w-1/2 rounded-full bg-white/6" />
              </div>
              {/* Typing indicator */}
              <div className="mt-3 flex items-center gap-1 rounded-lg bg-accent-violet/10 px-3 py-1.5">
                <span className="text-xs text-accent-violet-light">AI 正在生成品牌视觉</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-accent-violet-light" />
                  <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-accent-violet-light" />
                  <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-accent-violet-light" />
                </span>
              </div>
            </div>
          </div>

          {/* Floating card 2 — top right, rotated opposite */}
          <div className="absolute -right-4 -top-4 z-10 hidden w-52 animate-float sm:block md:-right-8 md:w-60">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-2xl backdrop-blur-xl rotate-2">
              <div className="mb-3 h-24 w-full overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/20 via-accent-violet/20 to-cyan-500/20">
                <div className="flex h-full items-center justify-center">
                  <Layout className="h-7 w-7 text-accent-violet-light" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-2/3 rounded-full bg-white/10" />
                <div className="h-2 w-1/3 rounded-full bg-white/6" />
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                <Zap className="h-3 w-3 text-accent-violet-light" />
                <span>12 秒生成落地页草案</span>
              </div>
            </div>
          </div>

          {/* Floating card 3 — bottom left */}
          <div className="absolute -bottom-6 left-0 z-10 hidden w-48 animate-float-slow sm:block md:w-56">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-2xl backdrop-blur-xl -rotate-1">
              <div className="mb-3 h-20 w-full overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-accent-violet/20">
                <div className="flex h-full items-center justify-center">
                  <PenTool className="h-6 w-6 text-accent-violet-light" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-1/2 rounded-full bg-white/10" />
                <div className="h-2 w-3/4 rounded-full bg-white/6" />
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                <Sparkles className="h-3 w-3 text-accent-violet-light" />
                <span>海报封面已就绪</span>
              </div>
            </div>
          </div>

          {/* Floating card 4 — bottom right */}
          <div className="absolute -bottom-8 right-0 z-10 hidden w-52 animate-float-delayed sm:block md:w-60">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-2xl backdrop-blur-xl rotate-3">
              <div className="mb-3 h-20 w-full overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-accent-violet/20">
                <div className="flex h-full items-center justify-center">
                  <Layers className="h-6 w-6 text-accent-violet-light" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-2/3 rounded-full bg-white/10" />
                <div className="h-2 w-1/2 rounded-full bg-white/6" />
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                <Zap className="h-3 w-3 text-accent-violet-light" />
                <span>社媒素材自动排版</span>
              </div>
            </div>
          </div>

          {/* Center — Main Design Workspace Mockup */}
          <div className="relative mx-auto w-full max-w-3xl">
            {/* Glow behind workspace */}
            <div className="absolute -inset-8 rounded-3xl bg-accent-violet/8 blur-3xl" />

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-1 shadow-2xl backdrop-blur-xl">
              {/* Workspace header */}
              <div className="flex items-center gap-3 border-b border-white/8 px-5 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 text-center text-xs text-text-muted">
                  Nova Studio — 设计工作台
                </div>
                <div className="flex items-center gap-1 rounded-md bg-accent-violet/10 px-2 py-1 text-xs text-accent-violet-light">
                  <Sparkles className="h-3 w-3" />
                  AI 就绪
                </div>
              </div>

              {/* Workspace canvas — design grid preview */}
              <div className="p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  {/* Design card 1 — Logo 方向 */}
                  <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-purple-500/15 via-accent-violet/10 to-pink-500/10 transition-all duration-300 hover:scale-[1.02] hover:border-accent-violet/20">
                    <div className="aspect-[4/3] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Layout className="h-6 w-6 text-accent-violet-light" />
                        </div>
                        <span className="text-xs text-text-muted">Logo 方向</span>
                      </div>
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-accent-violet/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        查看设计
                      </span>
                    </div>
                  </div>

                  {/* Design card 2 — 品牌色板 */}
                  <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-blue-500/15 via-accent-violet/10 to-cyan-500/10 transition-all duration-300 hover:scale-[1.02] hover:border-accent-violet/20">
                    <div className="aspect-[4/3] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Palette className="h-6 w-6 text-accent-violet-light" />
                        </div>
                        <span className="text-xs text-text-muted">品牌色板</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-accent-violet/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        查看设计
                      </span>
                    </div>
                  </div>

                  {/* Design card 3 — 官网首屏 */}
                  <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-accent-violet/10 transition-all duration-300 hover:scale-[1.02] hover:border-accent-violet/20">
                    <div className="aspect-[4/3] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <PenTool className="h-6 w-6 text-accent-violet-light" />
                        </div>
                        <span className="text-xs text-text-muted">官网首屏</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-accent-violet/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        查看设计
                      </span>
                    </div>
                  </div>

                  {/* Design card 4 — 社媒封面 */}
                  <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-accent-violet/10 transition-all duration-300 hover:scale-[1.02] hover:border-accent-violet/20">
                    <div className="aspect-[4/3] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Layers className="h-6 w-6 text-accent-violet-light" />
                        </div>
                        <span className="text-xs text-text-muted">社媒封面</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-accent-violet/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        查看设计
                      </span>
                    </div>
                  </div>

                  {/* Design card 5 — 宣传海报 */}
                  <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-accent-violet/10 transition-all duration-300 hover:scale-[1.02] hover:border-accent-violet/20">
                    <div className="aspect-[4/3] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Zap className="h-6 w-6 text-accent-violet-light" />
                        </div>
                        <span className="text-xs text-text-muted">宣传海报</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-accent-violet/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        查看设计
                      </span>
                    </div>
                  </div>

                  {/* Design card 6 — 视频分镜 */}
                  <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-accent-violet/10 transition-all duration-300 hover:scale-[1.02] hover:border-accent-violet/20">
                    <div className="aspect-[4/3] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-accent-violet-light" />
                        </div>
                        <span className="text-xs text-text-muted">视频分镜</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-accent-violet/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        查看设计
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row — moved below the visual showcase */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 sm:gap-16">
          {[
            { value: "50K+", label: "设计草案" },
            { value: "10K+", label: "创作者使用" },
            { value: "4.9★", label: "用户评分" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-foreground sm:text-3xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
