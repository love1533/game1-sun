'use client';

import { useState, useEffect, useCallback } from 'react';
import { saveScore } from '@/lib/ranking';
import { hanjaData, LEVELS } from '../hanja/data';

// ─── Types ──────────────────────────────────────────────────────────
interface Character {
  name: string;
  emoji: string;
  color: string;
}

type GamePhase = 'select' | 'level' | 'playing' | 'result';

interface Card {
  id: number;
  pairId: number;
  type: 'hanja' | 'huneum';
  display: string;
  char: string;
  meaning: string;
  sound: string;
  flipped: boolean;
  matched: boolean;
}

interface GameStats {
  moves: number;
  matches: number;
  totalPairs: number;
  timeElapsed: number;
  score: number;
  level: string;
}

// ─── Constants ──────────────────────────────────────────────────────
const characters: Character[] = [
  { name: '용진', emoji: '🐉', color: '#F59E0B' },
  { name: '용정', emoji: '🌟', color: '#EC4899' },
];

// Difficulty: 8급~준6급 = 4x4 (8 pairs), 6급~1급 = 4x5 (10 pairs)
const EASY_LEVELS = new Set(['8', '준7', '7', '준6']);

const BASE_MATCH_POINTS: Record<string, number> = {
  '8': 100, '준7': 120, '7': 150, '준6': 180,
  '6': 200, '준5': 250, '5': 300, '준4': 350,
  '4': 400, '준3': 500, '3': 600, '2': 800, '1': 1000,
};

// ─── Audio ──────────────────────────────────────────────────────────
function playSound(type: 'flip' | 'match' | 'mismatch' | 'complete') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'flip':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
        break;
      case 'match': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
          g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.15);
          o.start(ctx.currentTime + i * 0.08);
          o.stop(ctx.currentTime + i * 0.08 + 0.15);
        });
        break;
      }
      case 'mismatch':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        break;
      case 'complete': {
        const notes = [523, 659, 784, 880, 1047, 1319];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.3);
          o.start(ctx.currentTime + i * 0.12);
          o.stop(ctx.currentTime + i * 0.12 + 0.3);
        });
        break;
      }
    }
  } catch {
    // Audio not available
  }
}

// ─── Shuffle (Fisher-Yates) ─────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Build Cards ────────────────────────────────────────────────────
function buildCards(levelId: string, pairCount: number): Card[] {
  const levelChars = hanjaData.filter((h) => h.level === levelId);
  if (levelChars.length === 0) return [];

  const selected = shuffle(levelChars).slice(0, pairCount);
  const cards: Card[] = [];

  selected.forEach((h, idx) => {
    cards.push({
      id: idx * 2,
      pairId: idx,
      type: 'hanja',
      display: h.char,
      char: h.char,
      meaning: h.meaning,
      sound: h.sound,
      flipped: false,
      matched: false,
    });
    cards.push({
      id: idx * 2 + 1,
      pairId: idx,
      type: 'huneum',
      display: `${h.meaning} ${h.sound}`,
      char: h.char,
      meaning: h.meaning,
      sound: h.sound,
      flipped: false,
      matched: false,
    });
  });

  return shuffle(cards);
}

// ─── Main Component ─────────────────────────────────────────────────
export default function HanjaMatchPage() {
  const [phase, setPhase] = useState<GamePhase>('select');
  const [character, setCharacter] = useState<Character | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [stats, setStats] = useState<GameStats>({
    moves: 0,
    matches: 0,
    totalPairs: 0,
    timeElapsed: 0,
    score: 0,
    level: '',
  });
  const [timerActive, setTimerActive] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState<number>(0);
  const [showMatchEffect, setShowMatchEffect] = useState<number | null>(null);

  // ─── Timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setStats((prev) => ({ ...prev, timeElapsed: prev.timeElapsed + 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  // ─── Start Game ─────────────────────────────────────────────────
  const startGame = useCallback((levelId: string) => {
    const isEasy = EASY_LEVELS.has(levelId);
    const pairCount = isEasy ? 8 : 10;
    const newCards = buildCards(levelId, pairCount);

    if (newCards.length === 0) return;

    setCards(newCards);
    setFlippedIds([]);
    setIsChecking(false);
    setComboCount(0);
    setLastMatchTime(0);
    setShowMatchEffect(null);
    setStats({
      moves: 0,
      matches: 0,
      totalPairs: pairCount,
      timeElapsed: 0,
      score: 0,
      level: levelId,
    });
    setSelectedLevel(levelId);
    setTimerActive(true);
    setPhase('playing');
  }, []);

  // ─── Handle Card Click ──────────────────────────────────────────
  const handleCardClick = useCallback(
    (cardId: number) => {
      if (isChecking) return;
      if (flippedIds.length >= 2) return;

      const card = cards.find((c) => c.id === cardId);
      if (!card || card.flipped || card.matched) return;

      playSound('flip');

      const newCards = cards.map((c) =>
        c.id === cardId ? { ...c, flipped: true } : c
      );
      setCards(newCards);

      const newFlipped = [...flippedIds, cardId];
      setFlippedIds(newFlipped);

      if (newFlipped.length === 2) {
        setIsChecking(true);
        setStats((prev) => ({ ...prev, moves: prev.moves + 1 }));

        const first = newCards.find((c) => c.id === newFlipped[0])!;
        const second = newCards.find((c) => c.id === newFlipped[1])!;

        if (first.pairId === second.pairId) {
          // Match!
          setTimeout(() => {
            playSound('match');
            const now = Date.now();
            const isCombo = now - lastMatchTime < 3000 && lastMatchTime > 0;
            const newCombo = isCombo ? comboCount + 1 : 1;
            setComboCount(newCombo);
            setLastMatchTime(now);
            setShowMatchEffect(first.pairId);
            setTimeout(() => setShowMatchEffect(null), 600);

            const matchedCards = newCards.map((c) =>
              c.pairId === first.pairId ? { ...c, matched: true } : c
            );
            setCards(matchedCards);
            setFlippedIds([]);
            setIsChecking(false);

            const newMatches = stats.matches + 1;
            const basePoints = BASE_MATCH_POINTS[stats.level] || 100;
            const comboBonus = newCombo > 1 ? basePoints * 0.5 * (newCombo - 1) : 0;
            const matchScore = basePoints + comboBonus;

            setStats((prev) => ({
              ...prev,
              matches: newMatches,
              score: prev.score + matchScore,
            }));

            // Check completion
            if (newMatches === stats.totalPairs) {
              setTimeout(() => {
                playSound('complete');
                setTimerActive(false);
                // Calculate final bonus
                setStats((prev) => {
                  const moveBonus = Math.max(0, (prev.totalPairs * 3 - prev.moves) * 50);
                  const timeBonus = Math.max(0, (prev.totalPairs * 15 - prev.timeElapsed) * 10);
                  const finalScore = Math.round(prev.score + moveBonus + timeBonus);
                  if (character) {
                    saveScore('hanja-match', character.name, finalScore);
                  }
                  return { ...prev, score: finalScore };
                });
                setPhase('result');
              }, 500);
            }
          }, 300);
        } else {
          // Mismatch
          setTimeout(() => {
            playSound('mismatch');
            setComboCount(0);
            const resetCards = newCards.map((c) =>
              newFlipped.includes(c.id) ? { ...c, flipped: false } : c
            );
            setCards(resetCards);
            setFlippedIds([]);
            setIsChecking(false);
          }, 800);
        }
      }
    },
    [cards, flippedIds, isChecking, stats, comboCount, lastMatchTime, character]
  );

  // ─── Format Time ────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Get Grid Cols ──────────────────────────────────────────────
  const getGridClass = () => {
    return EASY_LEVELS.has(selectedLevel)
      ? 'grid-cols-4'
      : 'grid-cols-4';
  };

  const getLevelName = (levelId: string) => {
    const lvl = LEVELS.find((l) => l.id === levelId);
    return lvl ? lvl.name : levelId;
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Character Select
  // ═══════════════════════════════════════════════════════════════
  if (phase === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 flex flex-col items-center justify-center p-4">
        <a href="/" className="absolute top-4 left-4 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
          ← 홈으로
        </a>
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🃏</div>
          <h1 className="text-3xl font-bold text-white mb-2">한자 매칭</h1>
          <p className="text-emerald-200 text-sm">한자와 훈음을 짝지어 보세요!</p>
        </div>
        <div className="text-lg text-emerald-100 mb-6 font-semibold">캐릭터를 선택하세요</div>
        <div className="flex gap-6">
          {characters.map((ch) => (
            <button
              key={ch.name}
              onClick={() => {
                setCharacter(ch);
                setPhase('level');
              }}
              className="group flex flex-col items-center gap-3 bg-white/10 backdrop-blur rounded-2xl p-6 w-36 hover:bg-white/20 hover:scale-105 transition-all duration-200 border border-white/20"
            >
              <span className="text-5xl group-hover:scale-110 transition-transform">{ch.emoji}</span>
              <span className="text-white font-bold text-lg">{ch.name}</span>
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: ch.color }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Level Select
  // ═══════════════════════════════════════════════════════════════
  if (phase === 'level') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 flex flex-col items-center p-4 pt-16">
        <a href="/" className="absolute top-4 left-4 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
          ← 홈으로
        </a>
        <button
          onClick={() => setPhase('select')}
          className="absolute top-4 right-4 text-emerald-300 hover:text-white text-sm font-medium transition-colors"
        >
          캐릭터 변경
        </button>
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">{character?.emoji}</div>
          <h2 className="text-2xl font-bold text-white mb-1">급수 선택</h2>
          <p className="text-emerald-200 text-sm">
            {character?.name}님, 도전할 급수를 골라주세요!
          </p>
        </div>
        <div className="max-w-lg w-full grid grid-cols-2 gap-3">
          {LEVELS.map((lvl) => {
            const isEasy = EASY_LEVELS.has(lvl.id);
            const charCount = hanjaData.filter((h) => h.level === lvl.id).length;
            const pairCount = isEasy ? 8 : 10;
            const hasEnough = charCount >= pairCount;
            return (
              <button
                key={lvl.id}
                disabled={!hasEnough}
                onClick={() => startGame(lvl.id)}
                className={`
                  rounded-2xl p-4 text-left transition-all duration-200 border
                  ${hasEnough
                    ? 'bg-white/10 border-white/20 hover:bg-white/20 hover:scale-[1.02] active:scale-95'
                    : 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-bold text-lg">{lvl.name}</span>
                  <span className="text-emerald-300 text-xs">
                    {isEasy ? '4×4' : '4×5'}
                  </span>
                </div>
                <div className="text-emerald-200 text-xs">
                  {pairCount}쌍 · {charCount}자 보유
                </div>
                <div className="flex mt-2 gap-0.5">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < lvl.difficulty ? 'bg-emerald-400' : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Playing
  // ═══════════════════════════════════════════════════════════════
  if (phase === 'playing') {
    const isEasy = EASY_LEVELS.has(selectedLevel);
    const rows = isEasy ? 4 : 5;
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 flex flex-col items-center p-3">
        {/* Header */}
        <div className="w-full max-w-lg flex items-center justify-between mb-3">
          <button
            onClick={() => {
              setTimerActive(false);
              setPhase('level');
            }}
            className="text-emerald-300 hover:text-white text-sm font-medium transition-colors"
          >
            ← 돌아가기
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">{character?.emoji}</span>
            <span className="text-white font-bold text-sm">
              {getLevelName(selectedLevel)}
            </span>
          </div>
          <div className="text-emerald-200 text-sm font-mono">
            {formatTime(stats.timeElapsed)}
          </div>
        </div>

        {/* Stats bar */}
        <div className="w-full max-w-lg flex items-center justify-between bg-white/10 backdrop-blur rounded-xl px-4 py-2 mb-3">
          <div className="text-center">
            <div className="text-emerald-300 text-xs">시도</div>
            <div className="text-white font-bold">{stats.moves}</div>
          </div>
          <div className="text-center">
            <div className="text-emerald-300 text-xs">매칭</div>
            <div className="text-white font-bold">
              {stats.matches}/{stats.totalPairs}
            </div>
          </div>
          <div className="text-center">
            <div className="text-emerald-300 text-xs">점수</div>
            <div className="text-white font-bold">{Math.round(stats.score)}</div>
          </div>
          {comboCount > 1 && (
            <div className="text-center animate-bounce">
              <div className="text-yellow-300 text-xs">콤보</div>
              <div className="text-yellow-300 font-bold">×{comboCount}</div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-lg h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-500"
            style={{
              width: `${(stats.matches / stats.totalPairs) * 100}%`,
            }}
          />
        </div>

        {/* Card Grid */}
        <div
          className={`w-full max-w-lg grid ${getGridClass()} gap-2`}
          style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
          {cards.map((card) => {
            const isFlipped = card.flipped || card.matched;
            const isMatched = card.matched;
            const isMatchEffect = showMatchEffect === card.pairId && isMatched;

            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={isFlipped || isChecking}
                className="relative w-full aspect-[3/4] perspective-500"
                style={{ perspective: '500px' }}
              >
                <div
                  className={`
                    relative w-full h-full transition-transform duration-500
                    ${isFlipped ? '[transform:rotateY(180deg)]' : ''}
                  `}
                  style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.5s',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Back of card (visible when not flipped) */}
                  <div
                    className={`
                      absolute inset-0 rounded-2xl flex items-center justify-center
                      border-2 transition-all duration-300
                      ${isMatched
                        ? 'opacity-0 pointer-events-none'
                        : 'bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-400/50 hover:from-emerald-400 hover:to-emerald-600 hover:scale-[1.03] active:scale-95 cursor-pointer shadow-lg'
                      }
                    `}
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <span className="text-emerald-200/40 text-3xl font-serif select-none">漢</span>
                  </div>

                  {/* Front of card (visible when flipped) */}
                  <div
                    className={`
                      absolute inset-0 rounded-2xl flex flex-col items-center justify-center
                      border-2 transition-all duration-300
                      ${isMatched
                        ? isMatchEffect
                          ? 'bg-emerald-500/30 border-emerald-300 scale-105 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                          : 'bg-emerald-500/20 border-emerald-400/50'
                        : card.type === 'hanja'
                          ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-amber-400/60'
                          : 'bg-gradient-to-br from-slate-800 to-slate-900 border-sky-400/60'
                      }
                    `}
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    {card.type === 'hanja' ? (
                      <span className={`font-serif select-none ${isEasy ? 'text-3xl' : 'text-2xl'} ${isMatched ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {card.display}
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 px-1">
                        <span className={`font-medium select-none text-center leading-tight ${isEasy ? 'text-sm' : 'text-xs'} ${isMatched ? 'text-emerald-300' : 'text-sky-300'}`}>
                          {card.meaning}
                        </span>
                        <span className={`select-none ${isEasy ? 'text-base' : 'text-sm'} font-bold ${isMatched ? 'text-emerald-200' : 'text-sky-200'}`}>
                          {card.sound}
                        </span>
                      </div>
                    )}
                    {isMatched && (
                      <span className="absolute top-1 right-1.5 text-emerald-400 text-xs">✓</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Result
  // ═══════════════════════════════════════════════════════════════
  if (phase === 'result') {
    const perfectMoves = stats.totalPairs;
    const efficiency = Math.round((perfectMoves / Math.max(stats.moves, 1)) * 100);
    const avgTime = (stats.timeElapsed / stats.totalPairs).toFixed(1);

    let grade = '🌱';
    let gradeText = '새싹';
    if (efficiency >= 90) { grade = '👑'; gradeText = '한자왕'; }
    else if (efficiency >= 70) { grade = '🏆'; gradeText = '달인'; }
    else if (efficiency >= 50) { grade = '⭐'; gradeText = '우수'; }
    else if (efficiency >= 35) { grade = '📚'; gradeText = '노력파'; }

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 flex flex-col items-center justify-center p-4">
        <a href="/" className="absolute top-4 left-4 text-emerald-300 hover:text-white text-sm font-medium transition-colors">
          ← 홈으로
        </a>

        <div className="max-w-lg w-full">
          {/* Result card */}
          <div className="bg-white/10 backdrop-blur rounded-3xl p-6 border border-white/20 text-center mb-6">
            <div className="text-6xl mb-3">{grade}</div>
            <h2 className="text-2xl font-bold text-white mb-1">매칭 완료!</h2>
            <p className="text-emerald-200 mb-4">
              {character?.emoji} {character?.name} · {getLevelName(selectedLevel)}
            </p>

            {/* Score */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <div className="text-emerald-300 text-sm mb-1">최종 점수</div>
              <div className="text-4xl font-bold text-white">{Math.round(stats.score)}</div>
              <div className="text-emerald-300 text-sm mt-1">등급: {gradeText}</div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-emerald-300 text-xs mb-1">시도 횟수</div>
                <div className="text-white font-bold text-lg">{stats.moves}회</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-emerald-300 text-xs mb-1">소요 시간</div>
                <div className="text-white font-bold text-lg">{formatTime(stats.timeElapsed)}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-emerald-300 text-xs mb-1">매칭 효율</div>
                <div className="text-white font-bold text-lg">{efficiency}%</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-emerald-300 text-xs mb-1">쌍당 시간</div>
                <div className="text-white font-bold text-lg">{avgTime}초</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => startGame(selectedLevel)}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-2xl transition-all duration-200 active:scale-95"
            >
              다시 도전 🔄
            </button>
            <button
              onClick={() => setPhase('level')}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all duration-200 border border-white/20 active:scale-95"
            >
              급수 변경
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
