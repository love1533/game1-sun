'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { saveScore } from '@/lib/ranking';
import { hanjaData, wordData, LEVELS, type HanjaChar } from '../hanja/data';

// ─── Types ──────────────────────────────────────────────────────────
interface Character {
  name: string;
  emoji: string;
  color: string;
}

type GamePhase = 'select' | 'level' | 'playing' | 'result';

interface Question {
  char: string;
  options: string[];
  correctIndex: number;
}

interface GameResult {
  score: number;
  correct: number;
  wrong: number;
  maxCombo: number;
  totalQuestions: number;
}

// ─── Constants ──────────────────────────────────────────────────────
const characters: Character[] = [
  { name: '용진', emoji: '🐉', color: '#F59E0B' },
  { name: '용정', emoji: '🌟', color: '#EC4899' },
];

const GAME_DURATION = 60;
const MAX_LIVES = 3;
const MAX_COMBO_MULT = 4;

const BASE_POINTS: Record<string, number> = {
  '8': 10, '준7': 15, '7': 20, '준6': 25, '6': 30,
  '준5': 40, '5': 50, '준4': 60, '4': 80,
  '준3': 100, '3': 130, '2': 170, '1': 250,
};

// ─── Audio ──────────────────────────────────────────────────────────
function playSound(type: 'correct' | 'wrong' | 'combo' | 'timeup') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'correct':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        break;
      case 'wrong':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        break;
      case 'combo': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.05);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
      }
      case 'timeup': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        break;
      }
    }
  } catch {
    // Audio not supported
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

// ─── Question Generator ─────────────────────────────────────────────
function generateQuestion(pool: HanjaChar[]): Question {
  const shuffled = shuffle(pool);
  const correct = shuffled[0];
  const correctLabel = `${correct.meaning} ${correct.sound}`;

  // Pick 3 wrong answers, ensuring unique labels
  const wrongPool = shuffled.slice(1);
  const usedLabels = new Set([correctLabel]);
  const wrongs: string[] = [];

  for (const w of wrongPool) {
    const label = `${w.meaning} ${w.sound}`;
    if (!usedLabels.has(label) && wrongs.length < 3) {
      wrongs.push(label);
      usedLabels.add(label);
    }
  }

  // Fill if not enough unique wrong answers
  while (wrongs.length < 3) {
    wrongs.push(`--- ---`);
  }

  const options = shuffle([correctLabel, ...wrongs]);
  const correctIndex = options.indexOf(correctLabel);

  return {
    char: correct.char,
    options,
    correctIndex,
  };
}

// ─── Component ──────────────────────────────────────────────────────
export default function HanjaSpeedPage() {
  // Phase state
  const [phase, setPhase] = useState<GamePhase>('select');
  const [character, setCharacter] = useState<Character | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  // Game state
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [pool, setPool] = useState<HanjaChar[]>([]);

  // UI feedback
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [comboPopup, setComboPopup] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreAnimRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const gameActiveRef = useRef(false);

  // ── Score counting animation ──────────────────────────────────────
  useEffect(() => {
    if (displayScore === score) return;
    const diff = score - displayScore;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 10));

    scoreAnimRef.current = requestAnimationFrame(() => {
      setDisplayScore(prev => {
        if (prev < score) return Math.min(prev + step, score);
        if (prev > score) return Math.max(prev - step, score);
        return prev;
      });
    });

    return () => {
      if (scoreAnimRef.current) cancelAnimationFrame(scoreAnimRef.current);
    };
  }, [displayScore, score]);

  // ── Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          gameActiveRef.current = false;
          playSound('timeup');
          // Trigger end via a timeout so state settles
          setTimeout(() => endGame(), 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── End game ──────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    gameActiveRef.current = false;

    setResult({
      score,
      correct: correctCount,
      wrong: wrongCount,
      maxCombo,
      totalQuestions,
    });
    setPhase('result');
  }, [score, correctCount, wrongCount, maxCombo, totalQuestions]);

  // Effect: end game when lives reach 0
  useEffect(() => {
    if (phase === 'playing' && lives <= 0) {
      playSound('timeup');
      endGame();
    }
  }, [lives, phase, endGame]);

  // ── Start game ────────────────────────────────────────────────────
  const startGame = useCallback((level: string) => {
    const charPool = hanjaData.filter(h => h.level === level);
    if (charPool.length < 4) return;

    setPool(charPool);
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setDisplayScore(0);
    setLives(MAX_LIVES);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setWrongCount(0);
    setTotalQuestions(0);
    setResult(null);
    setNameSaved(false);
    setFeedback(null);
    gameActiveRef.current = true;

    const q = generateQuestion(charPool);
    setQuestion(q);
    setPhase('playing');
  }, []);

  // ── Handle answer ─────────────────────────────────────────────────
  const handleAnswer = useCallback((index: number) => {
    if (!question || !gameActiveRef.current || feedback) return;

    const isCorrect = index === question.correctIndex;
    setTotalQuestions(prev => prev + 1);

    if (isCorrect) {
      const newCombo = combo + 1;
      const mult = Math.min(newCombo, MAX_COMBO_MULT);
      const basePoints = BASE_POINTS[selectedLevel] || 10;
      const earned = basePoints * mult;

      setScore(prev => prev + earned);
      setCombo(newCombo);
      setMaxCombo(prev => Math.max(prev, newCombo));
      setCorrectCount(prev => prev + 1);
      setFeedback('correct');

      if (newCombo >= 3) {
        playSound('combo');
        setComboPopup(true);
        setTimeout(() => setComboPopup(false), 600);
      } else {
        playSound('correct');
      }
    } else {
      setLives(prev => prev - 1);
      setCombo(0);
      setWrongCount(prev => prev + 1);
      setFeedback('wrong');
      playSound('wrong');
    }

    // Clear feedback and next question
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      if (gameActiveRef.current) {
        setQuestion(generateQuestion(pool));
      }
    }, 300);
  }, [question, feedback, combo, selectedLevel, pool]);

  // ── Save score ────────────────────────────────────────────────────
  const handleSaveScore = useCallback(() => {
    if (!character || !result || nameSaved) return;
    const playerName = `${character.emoji} ${character.name}`;
    saveScore('hanja-speed', playerName, result.score);
    setNameSaved(true);
  }, [character, result, nameSaved]);

  // ── Timer progress (circular) ─────────────────────────────────────
  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (timerPercent / 100) * circumference;

  // ── Render: Character Select ──────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-600 to-violet-800 flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full mx-auto text-center">
          <h1 className="text-4xl font-bold text-white mb-2">한자 스피드</h1>
          <p className="text-violet-200 mb-8 text-lg">60초 스피드 퀴즈</p>

          <p className="text-white text-lg mb-6">캐릭터를 선택하세요</p>

          <div className="flex gap-4 justify-center">
            {characters.map(c => (
              <button
                key={c.name}
                onClick={() => {
                  setCharacter(c);
                  setPhase('level');
                }}
                className="bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-2xl p-6 w-36
                  hover:bg-white/20 hover:scale-105 active:scale-95
                  transition-all duration-200 flex flex-col items-center gap-3"
              >
                <span className="text-5xl">{c.emoji}</span>
                <span className="text-white font-bold text-lg">{c.name}</span>
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
              </button>
            ))}
          </div>

          <button
            onClick={() => window.history.back()}
            className="mt-8 text-violet-300 hover:text-white transition-colors"
          >
            ← 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Level Select ──────────────────────────────────────────
  if (phase === 'level') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-600 to-violet-800 flex flex-col items-center p-4 pt-8">
        <div className="max-w-lg w-full mx-auto">
          <div className="text-center mb-8">
            <span className="text-4xl">{character?.emoji}</span>
            <h2 className="text-2xl font-bold text-white mt-2">급수 선택</h2>
            <p className="text-violet-200 mt-1">도전할 급수를 선택하세요</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {LEVELS.map(lv => {
              const charCount = hanjaData.filter(h => h.level === lv.id).length;
              return (
                <button
                  key={lv.id}
                  onClick={() => {
                    setSelectedLevel(lv.id);
                    startGame(lv.id);
                  }}
                  disabled={charCount < 4}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3
                    hover:bg-white/20 hover:scale-105 active:scale-95
                    transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none
                    flex flex-col items-center gap-1"
                >
                  <span className="text-white font-bold text-lg">{lv.name}</span>
                  <span className="text-violet-300 text-xs">{charCount}자</span>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: lv.difficulty }, (_, i) => (
                      <span key={i} className="text-yellow-400 text-[10px]">★</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPhase('select')}
            className="mt-6 text-violet-300 hover:text-white transition-colors mx-auto block"
          >
            ← 캐릭터 선택
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Playing ───────────────────────────────────────────────
  if (phase === 'playing' && question) {
    const comboMult = Math.min(combo, MAX_COMBO_MULT);
    const timerColor = timeLeft > 20 ? '#a78bfa' : timeLeft > 10 ? '#fbbf24' : '#ef4444';
    const timerBg = timeLeft <= 10 ? 'animate-pulse' : '';

    return (
      <div className={`min-h-screen bg-gradient-to-b from-violet-600 to-violet-800 flex flex-col p-4 ${timerBg}`}>
        <div className="max-w-lg w-full mx-auto flex flex-col flex-1">

          {/* ── Top Bar: Score / Timer / Lives ── */}
          <div className="flex items-center justify-between mb-4">
            {/* Score */}
            <div className="flex flex-col items-start">
              <span className="text-violet-300 text-xs font-medium">점수</span>
              <span className="text-white font-bold text-2xl tabular-nums">
                {displayScore.toLocaleString()}
              </span>
            </div>

            {/* Timer (circular) */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="6"
                />
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke={timerColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`font-bold tabular-nums ${timeLeft <= 10 ? 'text-red-300 text-2xl' : 'text-white text-xl'}`}>
                  {timeLeft}
                </span>
              </div>
            </div>

            {/* Lives */}
            <div className="flex flex-col items-end">
              <span className="text-violet-300 text-xs font-medium">생명</span>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <span
                    key={i}
                    className={`text-xl transition-all duration-300 ${
                      i < lives ? 'scale-100 opacity-100' : 'scale-75 opacity-30 grayscale'
                    }`}
                  >
                    ❤️
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Combo Bar ── */}
          {combo >= 2 && (
            <div className={`text-center mb-2 transition-all duration-300 ${comboPopup ? 'scale-125' : 'scale-100'}`}>
              <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-sm font-bold inline-flex items-center gap-1 shadow-lg">
                🔥 {combo} 콤보! x{comboMult}
              </span>
            </div>
          )}

          {/* ── Linear Timer Bar ── */}
          <div className="w-full h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${timerPercent}%`,
                backgroundColor: timerColor,
              }}
            />
          </div>

          {/* ── Question Area ── */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Hanja Character */}
            <div
              className={`relative mb-8 transition-all duration-200 ${
                feedback === 'correct'
                  ? 'scale-110'
                  : feedback === 'wrong'
                  ? 'animate-[shake_0.3s_ease-in-out]'
                  : ''
              }`}
            >
              {/* Glow behind character */}
              <div
                className={`absolute inset-0 rounded-3xl blur-2xl transition-colors duration-200 ${
                  feedback === 'correct'
                    ? 'bg-green-400/40'
                    : feedback === 'wrong'
                    ? 'bg-red-400/40'
                    : 'bg-violet-400/20'
                }`}
              />
              <div
                className={`relative bg-white/10 backdrop-blur-sm rounded-3xl p-8
                  border-2 transition-colors duration-200 ${
                  feedback === 'correct'
                    ? 'border-green-400 bg-green-500/20'
                    : feedback === 'wrong'
                    ? 'border-red-400 bg-red-500/20'
                    : 'border-white/20'
                }`}
              >
                <span className="text-7xl font-serif text-white block text-center select-none">
                  {question.char}
                </span>
              </div>
            </div>

            <p className="text-violet-200 text-sm mb-4">이 한자의 훈음은?</p>

            {/* ── 2x2 Answer Grid ── */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              {question.options.map((opt, i) => (
                <button
                  key={`${question.char}-${i}`}
                  onClick={() => handleAnswer(i)}
                  disabled={feedback !== null}
                  className={`py-4 px-3 rounded-xl text-base font-medium
                    transition-all duration-150 active:scale-95
                    border-2 min-h-[60px]
                    ${feedback !== null && i === question.correctIndex
                      ? 'bg-green-500/30 border-green-400 text-green-100'
                      : feedback === 'wrong' && i !== question.correctIndex
                      ? 'bg-white/5 border-white/10 text-white/50'
                      : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40'
                    }
                    disabled:pointer-events-none
                  `}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* ── Bottom Stats ── */}
          <div className="flex justify-between mt-4 text-violet-300 text-xs">
            <span>정답 {correctCount} / 오답 {wrongCount}</span>
            <span>
              {character?.emoji} {character?.name} | {LEVELS.find(l => l.id === selectedLevel)?.name}
            </span>
          </div>
        </div>

        {/* ── Shake Keyframes ── */}
        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
          }
        `}</style>
      </div>
    );
  }

  // ── Render: Result ────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const accuracy = result.totalQuestions > 0
      ? Math.round((result.correct / result.totalQuestions) * 100)
      : 0;

    const gradeEmoji =
      accuracy >= 90 ? '🏆' :
      accuracy >= 70 ? '🥇' :
      accuracy >= 50 ? '🥈' :
      accuracy >= 30 ? '🥉' : '💪';

    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-600 to-violet-800 flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 text-center">
            {/* Header */}
            <span className="text-5xl block mb-2">{gradeEmoji}</span>
            <h2 className="text-2xl font-bold text-white mb-1">게임 종료!</h2>
            <p className="text-violet-200 text-sm mb-6">
              {character?.emoji} {character?.name}의 스피드 퀴즈 결과
            </p>

            {/* Score */}
            <div className="bg-white/10 rounded-2xl p-6 mb-6">
              <p className="text-violet-300 text-sm">총 점수</p>
              <p className="text-5xl font-bold text-white mt-1">
                {result.score.toLocaleString()}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-green-400 text-2xl font-bold">{result.correct}</p>
                <p className="text-violet-300 text-xs">정답</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-red-400 text-2xl font-bold">{result.wrong}</p>
                <p className="text-violet-300 text-xs">오답</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-yellow-400 text-2xl font-bold">{accuracy}%</p>
                <p className="text-violet-300 text-xs">정답률</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-orange-400 text-2xl font-bold flex items-center justify-center gap-1">
                  {result.maxCombo >= 3 && <span>🔥</span>}
                  {result.maxCombo}
                </p>
                <p className="text-violet-300 text-xs">최대 콤보</p>
              </div>
            </div>

            {/* Save Button */}
            {!nameSaved ? (
              <button
                onClick={handleSaveScore}
                className="w-full py-3 rounded-xl font-bold text-white
                  bg-gradient-to-r from-violet-500 to-purple-500
                  hover:from-violet-400 hover:to-purple-400
                  active:scale-95 transition-all duration-200 mb-3 text-lg"
              >
                🏆 랭킹 저장
              </button>
            ) : (
              <div className="bg-green-500/20 border border-green-400/30 rounded-xl py-3 px-4 mb-3 text-green-300 font-medium">
                ✅ 랭킹에 저장되었습니다!
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => startGame(selectedLevel)}
                className="flex-1 py-3 rounded-xl font-bold text-white
                  bg-white/10 border border-white/20
                  hover:bg-white/20 active:scale-95 transition-all duration-200"
              >
                🔄 다시하기
              </button>
              <button
                onClick={() => setPhase('level')}
                className="flex-1 py-3 rounded-xl font-bold text-white
                  bg-white/10 border border-white/20
                  hover:bg-white/20 active:scale-95 transition-all duration-200"
              >
                📋 급수 선택
              </button>
            </div>

            <button
              onClick={() => window.history.back()}
              className="mt-4 text-violet-300 hover:text-white transition-colors text-sm"
            >
              ← 홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────
  return null;
}
