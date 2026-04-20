'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { getGameRankings, type ScoreEntry } from "@/lib/ranking";

const games = [
  {
    id: "hanja",
    name: "한자왕",
    desc: "8급부터 도전! 내 한자 급수는?",
    href: "/games/hanja",
    emoji: "漢",
    tag: "HOT",
    tagColor: "#EF4444",
    bg: "#FFF8F0",
    border: "#FBBF24",
  },
  {
    id: "hanja-match",
    name: "한자 매칭",
    desc: "카드를 뒤집어 한자와 훈음을 맞춰봐!",
    href: "/games/hanja-match",
    emoji: "🃏",
    tag: "NEW",
    tagColor: "#10B981",
    bg: "#F0FFF4",
    border: "#6EE7B7",
  },
  {
    id: "hanja-speed",
    name: "한자 스피드",
    desc: "60초 안에 몇 개나 맞출 수 있을까?",
    href: "/games/hanja-speed",
    emoji: "⚡",
    tag: "NEW",
    tagColor: "#8B5CF6",
    bg: "#F5F3FF",
    border: "#C4B5FD",
  },
  {
    id: "sajaseongeo",
    name: "사자성어",
    desc: "사자성어 퀴즈로 한자 실력 UP!",
    href: "/games/sajaseongeo",
    emoji: "📜",
    tag: "NEW",
    tagColor: "#EF4444",
    bg: "#FFF5F5",
    border: "#FCA5A5",
  },
];

const characters = [
  { name: "용진", emoji: "🐉" },
  { name: "용정", emoji: "🌟" },
];

const PLAYER_EMOJI: Record<string, string> = {
  용진: "🐉",
  용정: "🌟",
};

export default function Home() {
  const [topScores, setTopScores] = useState<Record<string, ScoreEntry | null>>({});

  useEffect(() => {
    async function fetchTopScores() {
      const results: Record<string, ScoreEntry | null> = {};
      for (const game of games) {
        try {
          const rankings = await getGameRankings(game.id);
          results[game.id] = rankings.length > 0 ? rankings[0] : null;
        } catch {
          results[game.id] = null;
        }
      }
      setTopScores(results);
    }
    fetchTopScores();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      {/* Header */}
      <header className="bg-white px-5 pt-12 pb-5 border-b border-[#F2F3F5]">
        <h1 className="text-[24px] font-extrabold text-[#1B1D1F] tracking-tight">
          漢 한자왕
        </h1>
        <p className="text-[14px] text-[#8B95A1] mt-1">
          용진 & 용정의 한자 학습 게임
        </p>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 flex flex-col gap-3">
        {/* Top row: Characters + Ranking */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white rounded-2xl p-3.5 border border-[#F2F3F5]">
            <p className="text-[11px] font-semibold text-[#8B95A1] mb-2">우리 친구들</p>
            <div className="flex gap-4 justify-center">
              {characters.map((c) => (
                <div key={c.name} className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#FFF8F0] border-2 border-[#FBBF24] flex items-center justify-center text-2xl">
                    {c.emoji}
                  </div>
                  <span className="text-[11px] font-bold text-[#1B1D1F] mt-1">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            href="/ranking"
            className="flex flex-col items-center justify-center bg-white rounded-2xl px-5 border border-[#F2F3F5] active:scale-95 transition-transform"
          >
            <span className="text-3xl mb-1">🏆</span>
            <span className="text-[12px] font-bold text-[#1B1D1F]">랭킹</span>
          </Link>
        </div>

        {/* Game Cards */}
        {games.map((game) => {
          const top = topScores[game.id];
          return (
            <Link
              key={game.id}
              href={game.href}
              className="flex items-center gap-4 bg-white rounded-3xl p-5 border-2 active:scale-[0.97] transition-all duration-150"
              style={{
                borderColor: game.border || "#F2F3F5",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                minHeight: 110,
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl flex-shrink-0"
                style={{ backgroundColor: game.bg }}
              >
                {game.emoji}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[18px] font-extrabold text-[#1B1D1F]">
                    {game.name}
                  </span>
                  {game.tag && (
                    <span
                      className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: game.tagColor }}
                    >
                      {game.tag}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#6B7280] leading-snug">
                  {game.desc}
                </p>

                {top && (
                  <div className="flex items-center gap-1.5 mt-2 bg-[#F9FAFB] rounded-lg px-2.5 py-1.5 w-fit">
                    <span className="text-sm">👑</span>
                    <span className="text-[11px] font-bold text-[#F59E0B]">
                      {PLAYER_EMOJI[top.playerName] || "🎮"} {top.playerName}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      {top.score.toLocaleString()}점
                    </span>
                  </div>
                )}
              </div>

              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M9 5L16 12L9 19" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-[11px] text-[#C4C8CC]">
        <p>{characters.map((c) => `${c.emoji} ${c.name}`).join("  ")}</p>
        <p className="mt-1">한자왕 © 2025</p>
      </footer>
    </div>
  );
}
