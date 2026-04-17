import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미니게임월드",
  description: "승민 건우 강우 수현 이현 준영 준우의 미니게임 모음! 🎮",
  openGraph: {
    title: "🎮 미니게임월드",
    description: "13가지 미니게임으로 신나게 놀자! 점프, 달리기, 퀴즈, 슈팅, 탕후루 등",
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
      <body className="min-h-full flex flex-col bg-gradient-to-b from-purple-100 via-pink-50 to-blue-100">
        {children}
      </body>
    </html>
  );
}
