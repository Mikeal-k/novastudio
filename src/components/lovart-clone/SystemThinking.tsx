import { Lightbulb, Search, Layers, WandSparkles } from "lucide-react";

const workflowSteps = [
  {
    number: "01",
    icon: Lightbulb,
    title: "理解需求",
    description:
      "输入你的项目背景、目标受众和风格偏好。AI 会深度分析需求，构建精准的设计策略。",
    gradient: "from-violet-500/20 to-purple-500/10",
    iconBg: "from-violet-500 to-purple-600",
  },
  {
    number: "02",
    icon: Search,
    title: "搜集灵感",
    description:
      "AI 自动检索海量设计参考，提取与你项目匹配的视觉风格、色彩趋势和版式方案。",
    gradient: "from-blue-500/20 to-cyan-500/10",
    iconBg: "from-blue-500 to-cyan-600",
  },
  {
    number: "03",
    icon: Layers,
    title: "生成方向",
    description:
      "基于分析结果，AI 同时输出多个设计方向——从品牌色到布局结构，每个方案都完整可交付。",
    gradient: "from-amber-500/20 to-orange-500/10",
    iconBg: "from-amber-500 to-orange-600",
  },
  {
    number: "04",
    icon: WandSparkles,
    title: "精修交付",
    description:
      "在生成的方案上直接调整细节，AI 实时响应每一次修改，直到你满意为止。支持多格式导出。",
    gradient: "from-emerald-500/20 to-teal-500/10",
    iconBg: "from-emerald-500 to-teal-600",
  },
];

export function SystemThinking() {
  return (
    <section id="how-it-works" className="relative px-4 py-24 sm:py-32">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-violet/5 blur-[120px]" />
        <div className="absolute right-0 top-2/3 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-text-muted">
          系统化流程
        </div>
        <h2 className="mb-4 text-center text-3xl font-bold text-foreground sm:text-4xl">
          系统化设计流程
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-lg text-text-secondary">
          从需求到交付，AI 驱动的完整设计链路，每一步都精准可控。
        </p>

        {/* Desktop: left title + right cards */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
          {/* Left: section description */}
          <div className="flex-shrink-0 lg:w-80 lg:sticky lg:top-32">
            <div className="rounded-2xl border border-accent-violet/10 bg-gradient-to-br from-accent-violet/[0.04] to-transparent p-6 backdrop-blur-sm">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-violet/5 ring-1 ring-accent-violet/20">
                <Layers className="h-7 w-7 text-accent-violet-light" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">
                从想法到成品的完整路径
              </h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                不再依赖碎片化的设计工具和反复的手动沟通。Nova Studio
                将设计流程整合为一个智能系统——从需求理解到最终交付，AI
                在每个环节提供精准辅助。
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm text-accent-violet-light">
                <span className="inline-block h-px w-6 bg-accent-violet/40" />
                <span>4 步完成设计</span>
              </div>
            </div>
          </div>

          {/* Right: workflow cards */}
          <div className="flex-1 grid gap-5 sm:grid-cols-2">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-accent-violet/20 hover:shadow-lg hover:shadow-accent-violet/5"
                >
                  {/* Background gradient */}
                  <div
                    className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${step.gradient} blur-2xl transition-all duration-500 group-hover:scale-150`}
                  />

                  {/* Number */}
                  <div className="relative mb-4 flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${step.iconBg} shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-white/5">
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="relative">
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {step.description}
                    </p>
                  </div>

                  {/* Bottom accent line */}
                  <div className="relative mt-4 h-px w-0 bg-gradient-to-r from-accent-violet/40 to-transparent transition-all duration-500 group-hover:w-full" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
