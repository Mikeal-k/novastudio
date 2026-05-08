import {
  Palette,
  Type,
  Eye,
  Move,
  RotateCcw,
  Sparkles,
  Check,
} from "lucide-react";

const features = [
  {
    id: "precise-edit",
    title: "精准编辑",
    subtitle: "选中即改，AI 理解你的局部修改意图",
    description:
      "不再需要反复生成整张图。在画布中直接框选任意元素——文字、图标、背景或某个物体——告诉 AI 你想怎么改，它只修改选中区域，其余部分保持不变。",
    items: [
      "框选任意元素进行局部修改",
      "保留未选中区域的所有细节",
      "支持撤销 / 重做操作历史",
    ],
    gradient: "from-violet-500/20 via-purple-500/10 to-fuchsia-500/10",
    borderGlow: "group-hover:border-violet-500/30",
  },
  {
    id: "style-consistency",
    title: "风格一致",
    subtitle: "一次定调，全线统一",
    description:
      "设定好品牌风格后，AI 确保每一张输出——从社交媒体卡片到产品海报——都遵循统一的色彩体系、字体规范和视觉语言。不再有「看起来不像同一家公司的作品」的尴尬。",
    items: [
      "全局品牌风格一键同步",
      "色彩、字体、间距自动统一",
      "批量生成保持视觉连贯",
    ],
    gradient: "from-blue-500/20 via-cyan-500/10 to-teal-500/10",
    borderGlow: "group-hover:border-blue-500/30",
  },
  {
    id: "text-control",
    title: "文字可控",
    subtitle: "设计中的文字，像文档一样编辑",
    description:
      "AI 生成的设计图中，所有文字都是可编辑的独立图层。双击即可修改文案、调整字体大小、更换字重，无需重新生成。排版自动重排，保持设计完整性。",
    items: [
      "文字作为独立图层可编辑",
      "支持实时修改文案与字体",
      "排版自动适配，保持美观",
    ],
    gradient: "from-amber-500/20 via-orange-500/10 to-rose-500/10",
    borderGlow: "group-hover:border-amber-500/30",
  },
  {
    id: "visual-insight",
    title: "视觉洞察",
    subtitle: "AI 搜集参考，提炼风格关键词",
    description:
      "输入项目描述后，AI 自动搜索并分析海量视觉参考，提取色彩趋势、版式风格和设计语言关键词，生成灵感板。让每一次创作都有据可依，而非凭空想象。",
    items: [
      "自动搜集并分析视觉参考",
      "提取色彩趋势与风格关键词",
      "生成可交互的灵感板",
    ],
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/10",
    borderGlow: "group-hover:border-emerald-500/30",
  },
];

/* ─── Mockup Components ─── */

function PreciseEditMockup() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 shadow-2xl backdrop-blur-xl">
      {/* Canvas area */}
      <div className="relative mb-3 h-48 w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 sm:h-56">
        {/* Design elements on canvas */}
        <div className="absolute left-4 top-4 h-16 w-24 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/20 ring-1 ring-white/10" />
        <div className="absolute right-6 top-6 h-10 w-20 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/20 ring-1 ring-white/10" />
        {/* The "selected" element */}
        <div className="absolute bottom-6 left-8 h-14 w-32 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/20 ring-2 ring-amber-400/60 ring-offset-2 ring-offset-slate-900">
          <div className="flex h-full items-center justify-center gap-1 px-3">
            <Move className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-xs text-amber-200/80">选中编辑</span>
          </div>
        </div>
        {/* Selection indicator */}
        <div className="absolute bottom-6 left-8 h-14 w-32 rounded-lg border-2 border-dashed border-amber-400/40" />
        {/* Corner handles */}
        <div className="absolute bottom-5 left-7 h-2 w-2 rounded-full bg-amber-400 shadow-lg" />
        <div className="absolute bottom-5 right-[73px] h-2 w-2 rounded-full bg-amber-400 shadow-lg" />
        <div className="absolute top-[101px] left-7 h-2 w-2 rounded-full bg-amber-400 shadow-lg" />
        <div className="absolute top-[101px] right-[73px] h-2 w-2 rounded-full bg-amber-400 shadow-lg" />
      </div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-2">
        <div className="flex items-center gap-1 rounded-md bg-accent-violet/15 px-2.5 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent-violet-light" />
          <span className="text-xs text-accent-violet-light">修改选中区域</span>
        </div>
        <div className="ml-auto flex gap-1">
          <div className="rounded-md bg-white/5 p-1.5">
            <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
          </div>
          <div className="rounded-md bg-white/5 p-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleConsistencyMockup() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 shadow-2xl backdrop-blur-xl">
      {/* Brand color bar */}
      <div className="mb-3 flex h-8 items-center gap-2 rounded-lg bg-white/[0.04] px-3">
        <Palette className="h-4 w-4 text-accent-violet-light" />
        <div className="flex gap-1">
          <div className="h-4 w-4 rounded-full bg-violet-500 ring-1 ring-white/20" />
          <div className="h-4 w-4 rounded-full bg-blue-500 ring-1 ring-white/20" />
          <div className="h-4 w-4 rounded-full bg-amber-400 ring-1 ring-white/20" />
          <div className="h-4 w-4 rounded-full bg-emerald-500 ring-1 ring-white/20" />
        </div>
        <span className="ml-auto text-xs text-text-muted">品牌色板</span>
      </div>
      {/* Thumbnail grid showing consistent style */}
      <div className="grid grid-cols-3 gap-2">
        {[
          "from-violet-500/30 to-blue-500/20",
          "from-violet-500/25 to-amber-400/20",
          "from-violet-500/30 to-emerald-500/20",
        ].map((gradient, i) => (
          <div
            key={i}
            className={`aspect-[3/4] rounded-lg bg-gradient-to-br ${gradient} ring-1 ring-white/10 flex flex-col items-center justify-center gap-1 p-2`}
          >
            <div className="h-1.5 w-3/4 rounded-full bg-white/10" />
            <div className="h-1.5 w-1/2 rounded-full bg-white/8" />
            <div className="mt-1 h-1 w-1/3 rounded-full bg-accent-violet/30" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1 text-xs text-text-muted">
        <Check className="h-3 w-3 text-emerald-400" />
        <span>统一风格 · 3 个输出</span>
      </div>
    </div>
  );
}

function TextControlMockup() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 shadow-2xl backdrop-blur-xl">
      {/* Design preview */}
      <div className="mb-3 h-44 w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-4 sm:h-52">
        {/* Mock poster layout */}
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="mb-1 text-xs uppercase tracking-widest text-text-muted">
              Brand
            </div>
            {/* Editable title - the key mockup element */}
            <div className="group relative inline-block">
              <h4 className="text-xl font-bold text-white sm:text-2xl">
                创意无限
              </h4>
              {/* Edit indicator */}
              <div className="absolute -right-6 -top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Type className="h-3.5 w-3.5 text-amber-400" />
              </div>
            </div>
            <div className="mt-1 h-2 w-24 rounded-full bg-white/10" />
            <div className="mt-1 h-2 w-32 rounded-full bg-white/6" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-md bg-accent-violet/30" />
            <div className="h-6 w-16 rounded-md bg-white/10" />
          </div>
        </div>
      </div>
      {/* Text editing toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/[0.04] p-2">
        <div className="rounded-md bg-white/8 px-2 py-1 text-xs text-foreground">
          创意无限
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div className="rounded-md bg-white/5 px-2 py-1 text-xs text-text-muted">
          24px
        </div>
        <div className="rounded-md bg-white/5 px-2 py-1 text-xs text-text-muted">
          Bold
        </div>
        <div className="ml-auto rounded-md bg-accent-violet/15 px-2 py-1">
          <span className="text-xs text-accent-violet-light">编辑文字</span>
        </div>
      </div>
    </div>
  );
}

function VisualInsightMockup() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 shadow-2xl backdrop-blur-xl">
      {/* Mood board header */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
        <Eye className="h-4 w-4 text-accent-violet-light" />
        <span className="text-xs font-medium text-foreground">灵感板</span>
        <span className="ml-auto text-xs text-text-muted">12 个参考</span>
      </div>
      {/* Reference grid */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {[
          "from-rose-400/30 to-pink-500/20",
          "from-blue-400/30 to-indigo-500/20",
          "from-emerald-400/30 to-teal-500/20",
          "from-amber-400/30 to-orange-500/20",
        ].map((gradient, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md bg-gradient-to-br ${gradient} ring-1 ring-white/10`}
          />
        ))}
      </div>
      {/* AI analysis tags */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Sparkles className="h-3 w-3 text-accent-violet-light" />
          <span>AI 风格分析</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["极简主义", "暖色调", "高对比度", "无衬线字体", "大量留白"].map(
            (tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-violet/10 px-2.5 py-0.5 text-xs text-accent-violet-light ring-1 ring-accent-violet/15"
              >
                {tag}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

const mockups = [
  <PreciseEditMockup key="pe" />,
  <StyleConsistencyMockup key="sc" />,
  <TextControlMockup key="tc" />,
  <VisualInsightMockup key="vi" />,
];

export function FeatureSection() {
  return (
    <section id="features" className="relative px-4 py-24 sm:py-32">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-accent-violet/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-text-muted">
          核心功能
        </div>
        <h2 className="mb-4 text-center text-3xl font-bold text-foreground sm:text-4xl">
          不止于生成，更是你的设计搭档
        </h2>
        <p className="mx-auto mb-20 max-w-2xl text-center text-lg text-text-secondary">
          AI 不只是输出图片——它理解设计意图，帮你把控细节，让每一件作品都经得起推敲。
        </p>

        {/* Feature blocks */}
        <div className="space-y-24">
          {features.map((feature, index) => {
            const isReversed = index % 2 === 1;
            return (
              <div
                key={feature.id}
                className={`group flex flex-col items-center gap-10 ${
                  isReversed ? "lg:flex-row-reverse" : "lg:flex-row"
                }`}
              >
                {/* Content side */}
                <div className="flex-1 space-y-5">
                  {/* Feature number */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-accent-violet-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-accent-violet/30 to-transparent" />
                  </div>

                  <h3 className="text-2xl font-bold text-foreground sm:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="text-lg text-text-secondary">
                    {feature.subtitle}
                  </p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {feature.description}
                  </p>

                  {/* Feature items */}
                  <ul className="space-y-2.5">
                    {feature.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-text-secondary"
                      >
                        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent-violet/10">
                          <Check className="h-3 w-3 text-accent-violet-light" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Mockup side */}
                <div
                  className={`flex-1 w-full max-w-lg transition-all duration-500 ${
                    isReversed ? "lg:translate-x-4" : "lg:-translate-x-4"
                  }`}
                >
                  {mockups[index]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
