import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "顺维数字科技工作室 | Nova Studio — AI 图片与视频创意生成服务",
  description:
    "顺维数字科技工作室（Nova Studio）提供 AI 图片生成、AI 视频生成、数字内容制作、创意设计辅助等服务，帮助个人和企业快速制作商品图、海报、封面、短视频素材和创意分镜。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
