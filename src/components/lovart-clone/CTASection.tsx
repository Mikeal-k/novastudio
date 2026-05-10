"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, FileImage, Brain } from "lucide-react";

const trustBadges = [
  {
    icon: Brain,
    label: "无需设计经验",
    description: "AI 引导式创作，零门槛上手",
  },
  {
    icon: FileImage,
    label: "多格式输出",
    description: "PNG / SVG / HTML / React 组件",
  },
  {
    icon: Zap,
    label: "即时生成草案",
    description: "输入需求，数秒内获得初稿",
  },
];

export function CTASection() {
  const [prompt, setPrompt] = useState("");

  return (
    <section id="pricing" className="relative overflow-hidden px-4 py-24 sm:py-32">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        {/* Large central glow */}
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-violet/15 blur-[150px]" />
        <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute -right-32 bottom-1/4 h-[350px] w-[350px] rounded-full bg-blue-500/8 blur-[100px]" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative mx-auto max-w-4xl">
        {/* Top badge */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-accent-violet/20 bg-accent-violet/10 px-4 py-1.5 text-sm text-accent-violet-light backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            <span>免费开始 · 无需信用卡</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 backdrop-blur-2xl shadow-2xl sm:p-12">
          {/* Inner glow */}
          <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-accent-violet/5 blur-3xl" />

          <div className="relative">
            {/* Heading */}
            <h2 className="mb-4 text-center text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              准备好开始你的
              <br className="sm:hidden" />
              <span className="bg-gradient-to-r from-accent-violet via-accent-violet-light to-purple-300 bg-clip-text text-transparent">
                第一个 AI 设计
              </span>
              了吗？
            </h2>

            <p className="mx-auto mb-10 max-w-xl text-center text-base text-text-secondary sm:text-lg">
              输入你的设计想法，立即体验 AI 设计工作流。无需注册，免费试用。
            </p>

            {/* Prompt input */}
            <div className="mx-auto mb-8 max-w-2xl">
              <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-2xl shadow-2xl ring-1 ring-accent-violet/10 transition-all duration-300 focus-within:border-accent-violet/30 focus-within:ring-accent-violet/20">
                <div className="flex-1">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你的设计想法… 例如「一个科技品牌的官网首页」"
                    className="min-h-[52px] w-full resize-none bg-transparent px-4 py-3 text-base text-foreground placeholder-text-muted/60 outline-none"
                    rows={1}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
                    }}
                  />
                </div>
                <Link href="/create">
                  <Button
                    size="lg"
                    className="h-11 gap-2 rounded-xl bg-gradient-to-r from-accent-violet to-accent-violet-light px-6 text-base text-white shadow-lg hover:from-accent-violet-dark hover:to-accent-violet hover:shadow-xl glow transition-all duration-200"
                  >
                    <Sparkles className="h-4 w-4" />
                    开始创作
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4">
              {trustBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.label}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-accent-violet/20 hover:bg-accent-violet/5"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-violet/10">
                      <Icon className="h-4.5 w-4.5 text-accent-violet-light" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {badge.label}
                      </div>
                      <div className="text-xs text-text-muted">
                        {badge.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
