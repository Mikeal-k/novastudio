import Link from "next/link";
import { Globe, MessageCircle, Briefcase, Mail } from "lucide-react";

const footerLinks = {
  产品: [
    { label: "功能", href: "#features" },
    { label: "定价", href: "#pricing" },
    { label: "展示", href: "#showcase" },
    { label: "更新日志", href: "#" },
  ],
  资源: [
    { label: "文档", href: "#" },
    { label: "API 参考", href: "#" },
    { label: "教程", href: "#" },
    { label: "社区", href: "#" },
  ],
  公司: [
    { label: "关于", href: "#" },
    { label: "博客", href: "#" },
    { label: "招聘", href: "#" },
    { label: "联系我们", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Main grid */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-accent-violet-light">
                <span className="text-sm font-bold text-white">N</span>
              </div>
              <span className="text-lg font-semibold text-foreground">
                Nova Studio
              </span>
            </Link>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-text-secondary">
              AI 驱动的设计平台，将你的创意转化为惊艳的视觉作品。创作、协作、发布，比以往更快。
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              {[
                { icon: Globe, href: "#", label: "网站" },
                { icon: MessageCircle, href: "#", label: "社区" },
                { icon: Briefcase, href: "#", label: "作品集" },
                { icon: Mail, href: "#", label: "邮箱" },
              ].map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 text-text-muted transition-colors hover:border-accent-violet/50 hover:text-accent-violet-light"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-sm font-semibold text-foreground">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-secondary transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 border-t border-border/50 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} Nova Studio. 保留所有权利。
            </p>
            <div className="flex gap-6">
              <a
                href="#"
                className="text-sm text-text-muted transition-colors hover:text-foreground"
              >
                隐私政策
              </a>
              <a
                href="#"
                className="text-sm text-text-muted transition-colors hover:text-foreground"
              >
                服务条款
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
