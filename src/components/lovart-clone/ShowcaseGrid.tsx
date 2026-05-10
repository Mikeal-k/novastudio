import Link from "next/link";
import { ExternalLink } from "lucide-react";

const showcaseItems = [
  {
    title: "SaaS 数据看板",
    category: "网页应用",
    description: "全面的数据分析看板，支持实时数据可视化和深色模式。",
    gradient: "from-blue-600 via-purple-600 to-pink-600",
    scene: "landing",
  },
  {
    title: "高级作品集",
    category: "作品集",
    description: "极简摄影作品集，全屏画廊与流畅过渡动画。",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    scene: "landing",
  },
  {
    title: "电商展示页",
    category: "电商页面",
    description: "现代产品展示，集成交互式 3D 产品查看器和流畅结账流程。",
    gradient: "from-orange-500 via-red-500 to-rose-600",
    scene: "landing",
  },
  {
    title: "金融应用",
    category: "金融界面",
    description: "简洁的财务管理界面，包含图表、交易记录和预算工具。",
    gradient: "from-violet-600 via-indigo-600 to-blue-600",
    scene: "landing",
  },
  {
    title: "创意机构",
    category: "落地页",
    description: "大胆的机构落地页，包含动画 Hero、客户 Logo 和案例展示。",
    gradient: "from-pink-500 via-rose-500 to-red-500",
    scene: "landing",
  },
  {
    title: "健康追踪",
    category: "移动端",
    description: "健康应用界面，支持活动追踪、饮食记录和进度洞察。",
    gradient: "from-green-500 via-emerald-500 to-teal-500",
    scene: "landing",
  },
];

export function ShowcaseGrid() {
  return (
    <section id="showcase" className="relative px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-text-muted">
          作品展示
        </div>
        <h2 className="mb-4 text-center text-3xl font-bold text-foreground sm:text-4xl">
          看看 AI 能创作什么
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-lg text-text-secondary">
          探索由 Nova Studio 生成的设计案例。
        </p>

        {/* Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {showcaseItems.map((item) => (
            <Link
              key={item.title}
              href={`/create?scene=${item.scene}`}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent-violet/10"
            >
              {/* Preview placeholder */}
              <div
                className={`h-48 w-full bg-gradient-to-br ${item.gradient} flex items-center justify-center`}
              >
                <div className="rounded-lg bg-white/10 px-4 py-2 backdrop-blur-sm">
                  <span className="text-sm font-medium text-white/90">
                    {item.category}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-accent-violet-light">
                    {item.category}
                  </span>
                  <ExternalLink className="h-4 w-4 text-text-muted transition-colors group-hover:text-accent-violet-light" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
