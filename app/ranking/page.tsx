"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getGameRankings,
  getAllRankings,
  type ScoreEntry,
} from "@/lib/ranking";

const GAMES = [
  { id: "hanja", label: "한자왕", emoji: "漢" },
] as const;

type GameId = (typeof GAMES)[number]["id"] | "all";

const PLAYER_INFO: Record<string, { emoji: string; color: string }> = {
  용진: { emoji: "🐉", color: "bg-amber-200 text-amber-700" },
  용정: { emoji: "🌟", color: "bg-yellow-200 text-yellow-700" },
};

function getPlayerEmoji(name: string): string {
  return PLAYER_INFO[name]?.emoji ?? "🎮";
}

function getPlayerBadge(name: string): string {
  return PLAYER_INFO[name]?.color ?? "bg-gray-200 text-gray-700";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl leading-none">🥇</span>;
  if (rank === 2) return <span className="text-2xl leading-none">🥈</span>;
  if (rank === 3) return <span className="text-2xl leading-none">🥉</span>;
  return (
    <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-500 text-xs font-extrabold flex items-center justify-center">
      {rank}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  } catch {
    return "";
  }
}

function ScoreRow({
  entry,
  rank,
  delay,
}: {
  entry: ScoreEntry;
  rank: number;
  delay: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const rowBg =
    rank === 1
      ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200"
      : rank === 2
        ? "bg-gradient-to-r from-slate-50 to-gray-100 border-slate-200"
        : rank === 3
          ? "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200"
          : "bg-white border-amber-100";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm
        transition-all duration-500
        ${rowBg}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex-shrink-0 w-8 flex items-center justify-center">
        <RankBadge rank={rank} />
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-lg leading-none">{getPlayerEmoji(entry.playerName)}</span>
        <span
          className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${getPlayerBadge(entry.playerName)}`}
        >
          {entry.playerName}
        </span>
      </div>

      <div className="flex-shrink-0 text-right">
        <span className="text-sm font-extrabold text-amber-600 tabular-nums">
          {entry.score.toLocaleString()}
        </span>
        <span className="text-[10px] text-gray-400 ml-0.5">점</span>
      </div>

      <div className="flex-shrink-0 text-[10px] text-gray-400 w-8 text-right tabular-nums">
        {formatDate(entry.date)}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <span className="text-5xl animate-bounce">漢</span>
      <p className="text-sm font-bold text-amber-400 text-center leading-relaxed">
        아직 기록이 없어요!
        <br />
        한자왕에 도전해보세요~ 📖
      </p>
    </div>
  );
}

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState<GameId>("hanja");
  const [rankings, setRankings] = useState<ScoreEntry[]>([]);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchRankings = async () => {
      const entries =
        activeTab === "all"
          ? await getAllRankings()
          : await getGameRankings(activeTab);
      if (!cancelled) {
        setRankings(entries);
        setListKey((k) => k + 1);
      }
    };
    fetchRankings();
    return () => { cancelled = true; };
  }, [activeTab]);

  const tabs: { id: GameId; label: string; emoji: string }[] = [
    { id: "hanja", label: "한자왕", emoji: "漢" },
  ];

  return (
    <>
      <style>{`
        @keyframes title-pop {
          0% { transform: scale(0.8) rotate(-3deg); opacity: 0; }
          70% { transform: scale(1.08) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .title-pop {
          animation: title-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center pb-10">
        <div className="w-full max-w-md px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-amber-400
                bg-white/70 rounded-full px-3 py-1.5 shadow-sm
                active:scale-95 transition-transform"
            >
              ← 홈으로
            </Link>
            <div className="w-16" />
          </div>

          <div className="text-center mb-5">
            <h1 className="text-3xl font-extrabold text-amber-600 title-pop tracking-tight">
              🏆 한자왕 랭킹
            </h1>
            <p className="text-xs text-amber-400 font-semibold mt-1">
              용진 & 용정, 누가 한자왕? ✨
            </p>
          </div>
        </div>

        <div className="w-full max-w-md px-4 mb-4">
          <div className="flex gap-2 pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold
                  transition-all duration-200 active:scale-95 shadow-sm
                  ${
                    activeTab === tab.id
                      ? "bg-amber-500 text-white shadow-amber-200 shadow-md scale-105"
                      : "bg-white/80 text-amber-400 border border-amber-100"
                  }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-md px-4">
          <div
            className="flex items-center gap-2 mb-3 px-4 py-2.5
            bg-gradient-to-r from-amber-100 to-yellow-100
            rounded-2xl border border-amber-200 shadow-sm"
          >
            <span className="text-2xl">漢</span>
            <div>
              <p className="text-sm font-extrabold text-amber-700">한자왕 랭킹</p>
              <p className="text-[10px] text-amber-400">TOP 10 랭킹</p>
            </div>
          </div>

          {rankings.length === 0 ? (
            <EmptyState />
          ) : (
            <div key={listKey} className="flex flex-col gap-2">
              {rankings.map((entry, i) => (
                <ScoreRow
                  key={`${entry.playerName}-${entry.gameId}-${entry.date}-${i}`}
                  entry={entry}
                  rank={i + 1}
                  delay={i * 60}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-xs text-amber-300">
          <p className="font-semibold text-amber-400">
            용진 🐉 · 용정 🌟
          </p>
          <p className="mt-1 text-[10px] text-amber-300">
            오늘도 한자왕에 도전해봐요~! 📖
          </p>
        </div>
      </div>
    </>
  );
}
