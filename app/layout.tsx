import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한자왕 - 용진 & 용정의 한자 학습",
  description: "8급부터 1급까지! 한자 급수 시험 대비 학습 게임 漢",
  keywords: "한자,한자학습,한자급수,한자시험,한자왕,교육게임",
  openGraph: {
    title: "漢 한자왕",
    description: "8급부터 1급까지! 용진 & 용정의 한자 학습 게임",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-[#f0f4ff]">
        {children}
      </body>
    </html>
  );
}
