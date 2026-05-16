import Link from "next/link";

const services = [
  {
    title: "AI 图片生成",
    description: "基于先进 AI 模型，快速生成高质量的图片内容，支持多种风格和尺寸。",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    ),
  },
  {
    title: "AI 视频生成",
    description: "通过文本描述或图片参考生成短视频内容，适用于社交媒体、广告宣传及创意表达。",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25V7.5a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    title: "商品图与海报素材",
    description: "为电商和营销场景制作商品展示图、海报背景与宣传素材，提升视觉呈现效果。",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5a3.375 3.375 0 0 0 3.375 3.375h1.5a3.375 3.375 0 0 1 3.375 3.375M10.125 2.25h4.5" />
      </svg>
    ),
  },
  {
    title: "短视频创意素材",
    description: "高效生成短视频创意素材，辅助内容创作者快速产出吸引人的视频片段。",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
      </svg>
    ),
  },
  {
    title: "数字内容制作",
    description: "提供完整的数字内容制作流程支持，涵盖策划、生成、编辑与导出等环节。",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
  },
  {
    title: "创意设计辅助",
    description: "利用 AI 辅助创意发散与设计构思，帮助快速生成多个设计方案供参考与迭代。",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
      </svg>
    ),
  },
];

const useCases = [
  "电商商品图",
  "短视频素材",
  "品牌宣传",
  "海报封面",
  "内容创作",
  "创意分镜",
];

export default function OfficialLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== Navigation ===== */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              顺维数字科技工作室
            </span>
            <span className="text-xs text-muted-foreground -mt-0.5">
              Nova Studio
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg"
            >
              登录
            </Link>
            <Link
              href="/create"
              className="text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-lg"
            >
              开始使用
            </Link>
          </nav>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent-violet/5 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-32 sm:pb-28 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
            AI 图片与视频
            <br />
            <span className="text-gradient">创意生成服务</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            提供 AI 图片生成、AI 视频生成、数字内容制作、创意设计辅助等服务，
            <br className="hidden sm:inline" />
            帮助个人和企业快速制作商品图、海报、封面、短视频素材和创意分镜。
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-6 py-3 rounded-xl text-base font-medium"
            >
              开始使用
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 border border-border text-foreground hover:bg-secondary transition-colors px-6 py-3 rounded-xl text-base font-medium"
            >
              登录
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Services ===== */}
      <section className="border-t border-border/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">服务内容</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              围绕 AI 视觉创意，提供覆盖图片、视频、设计等多维度的数字化服务
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service) => (
              <div
                key={service.title}
                className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  {service.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Use Cases ===== */}
      <section className="border-t border-border/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">适用场景</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              广泛适用于电商运营、品牌营销、社交媒体及个人创作等场景
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {useCases.map((useCase) => (
              <span
                key={useCase}
                className="inline-block px-5 py-2.5 rounded-full text-sm font-medium bg-secondary text-secondary-foreground border border-border/50"
              >
                {useCase}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Contact ===== */}
      <section className="border-t border-border/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">联系我们</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              如有合作咨询或使用问题，欢迎通过以下方式与我们取得联系
            </p>
          </div>
          <div className="max-w-md mx-auto space-y-4">
            <div className="glass-card rounded-xl px-6 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">邮箱</p>
                <a
                  href="mailto:172201637@qq.com"
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  172201637@qq.com
                </a>
              </div>
            </div>
            <div className="glass-card rounded-xl px-6 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">域名</p>
                <a
                  href="https://shunweidigital.cn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  https://shunweidigital.cn
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border/30 mt-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-foreground">顺维数字科技工作室</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nova Studio</p>
            </div>
            <nav className="flex items-center gap-6 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                用户协议
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                隐私政策
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                退款与售后说明
              </a>
            </nav>
          </div>
          <div className="mt-6 border-t border-border/20 pt-4 text-center">
            <p className="text-xs text-muted-foreground/60">
              &copy; {new Date().getFullYear()} 顺维数字科技工作室. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
