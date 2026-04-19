'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { saveScore } from '@/lib/ranking';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  type: 'movie' | 'meme';
  answer: string;
  aliases: string[];
  hint: string;
  year: number;
}

type GameScreen = 'home' | 'playing' | 'feedback' | 'result';

interface RoundResult {
  correct: boolean;
  passed: boolean;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const ALL_QUESTIONS: Question[] = [
  // Movies
  { id:'M1', type:'movie', answer:'기생충', aliases:['기생충'], hint:'2019 아카데미 작품상 수상', year:2019 },
  { id:'M2', type:'movie', answer:'겨울왕국', aliases:['겨울왕국'], hint:'렛잇고~ 디즈니 애니메이션', year:2013 },
  { id:'M3', type:'movie', answer:'어벤져스', aliases:['어벤져스'], hint:'마블 히어로 총집합', year:2012 },
  { id:'M4', type:'movie', answer:'범죄도시', aliases:['범죄도시'], hint:'마동석 주연 액션 영화', year:2017 },
  { id:'M5', type:'movie', answer:'해리포터', aliases:['해리포터','해리 포터'], hint:'마법 학교 호그와트', year:2001 },
  { id:'M6', type:'movie', answer:'인사이드 아웃', aliases:['인사이드아웃'], hint:'감정들이 캐릭터! 기쁨이 슬픔이', year:2015 },
  { id:'M7', type:'movie', answer:'토이스토리', aliases:['토이 스토리','토이스토리'], hint:'장난감들이 살아 움직여요', year:1995 },
  { id:'M8', type:'movie', answer:'명탐정 코난', aliases:['명탐정코난','코난'], hint:'진실은 언제나 하나!', year:1996 },
  { id:'M9', type:'movie', answer:'짱구는 못말려', aliases:['짱구','짱구는못말려'], hint:'엉덩이 춤의 달인', year:1992 },
  { id:'M10', type:'movie', answer:'스파이더맨', aliases:['스파이더맨','스파이더 맨'], hint:'거미줄을 쏘는 히어로', year:2002 },
  { id:'M11', type:'movie', answer:'슈퍼마리오', aliases:['슈퍼 마리오','마리오'], hint:'공주를 구하는 배관공', year:2023 },
  { id:'M12', type:'movie', answer:'도라에몽', aliases:['도라에몽'], hint:'주머니에서 뭐든 나오는 로봇 고양이', year:1980 },
  { id:'M13', type:'movie', answer:'신비아파트', aliases:['신비 아파트'], hint:'귀신이 나오는 아파트', year:2014 },
  { id:'M14', type:'movie', answer:'뽀로로', aliases:['뽀로로','포로로'], hint:'노는게 제일 좋아 친구들 모여라', year:2003 },
  { id:'M15', type:'movie', answer:'콩순이', aliases:['콩순이'], hint:'귀여운 아기 캐릭터', year:2013 },
  { id:'M16', type:'movie', answer:'타이타닉', aliases:['타이타닉'], hint:'배가 빙산에 부딪혀 침몰', year:1997 },
  { id:'M17', type:'movie', answer:'주토피아', aliases:['주토피아'], hint:'동물들이 사는 도시', year:2016 },
  { id:'M18', type:'movie', answer:'코코', aliases:['코코'], hint:'멕시코 망자의 날 음악 영화', year:2017 },
  { id:'M19', type:'movie', answer:'모아나', aliases:['모아나'], hint:'바다를 건너는 공주', year:2016 },
  { id:'M20', type:'movie', answer:'라이온킹', aliases:['라이온 킹','라이온킹'], hint:'아프리카 사자 왕', year:1994 },
  { id:'M21', type:'movie', answer:'알라딘', aliases:['알라딘'], hint:'램프의 요정 지니', year:1992 },
  { id:'M22', type:'movie', answer:'엘리멘탈', aliases:['엘리멘탈'], hint:'불과 물의 사랑 이야기', year:2023 },
  { id:'M23', type:'movie', answer:'터닝레드', aliases:['터닝 레드','터닝레드'], hint:'흥분하면 빨간 판다로 변신', year:2022 },
  { id:'M24', type:'movie', answer:'짱구 극장판', aliases:['짱구극장판'], hint:'어른의 제국 역습!', year:2001 },
  { id:'M25', type:'movie', answer:'포켓몬스터', aliases:['포켓몬','포켓몬스터'], hint:'피카피카! 몬스터볼 던져', year:1997 },
  // Memes
  { id:'MM1', type:'meme', answer:'이것은 실화입니다', aliases:['이것은실화입니다'], hint:'믿기 어려운 이야기 끝에', year:2024 },
  { id:'MM2', type:'meme', answer:'무야호', aliases:['무야호'], hint:'유재석 신나서 외치는 소리', year:2021 },
  { id:'MM3', type:'meme', answer:'어쩔티비', aliases:['어쩔티비','어쩔 티비'], hint:'말대꾸 할 때 쓰는 유행어', year:2021 },
  { id:'MM4', type:'meme', answer:'킹받네', aliases:['킹받네','킹받다'], hint:'매우 화가 날 때 쓰는 말', year:2022 },
  { id:'MM5', type:'meme', answer:'갑분싸', aliases:['갑분싸','갑자기분위기싸해짐'], hint:'갑자기 분위기 싸해짐', year:2018 },
  { id:'MM6', type:'meme', answer:'점메추', aliases:['점메추','점심메뉴추천'], hint:'점심 메뉴 추천해줘', year:2022 },
  { id:'MM7', type:'meme', answer:'별다줄', aliases:['별다줄','별걸다줄인다'], hint:'별걸 다 줄인다', year:2022 },
  { id:'MM8', type:'meme', answer:'중꺾마', aliases:['중꺾마','중요한건꺾이지않는마음'], hint:'중요한 건 꺾이지 않는 마음', year:2022 },
  { id:'MM9', type:'meme', answer:'얼죽아', aliases:['얼죽아','얼어죽어도아이스'], hint:'얼어 죽어도 아이스 아메리카노', year:2018 },
  { id:'MM10', type:'meme', answer:'오히려 좋아', aliases:['오히려좋아'], hint:'안 좋은 상황인데 긍정적으로', year:2023 },
  { id:'MM11', type:'meme', answer:'실화냐', aliases:['실화냐'], hint:'놀라울 때 쓰는 말', year:2020 },
  { id:'MM12', type:'meme', answer:'뇌절', aliases:['뇌절'], hint:'같은 드립을 반복할 때', year:2022 },
  { id:'MM13', type:'meme', answer:'갓생', aliases:['갓생','갓생살기'], hint:'알차고 보람찬 하루', year:2022 },
  { id:'MM14', type:'meme', answer:'오운완', aliases:['오운완','오늘운동완료'], hint:'오늘 운동 완료', year:2023 },
  { id:'MM15', type:'meme', answer:'디토', aliases:['디토'], hint:'나도 같은 생각이야', year:2022 },
  { id:'MM16', type:'meme', answer:'ㅋㅋ루삥뽕', aliases:['ㅋㅋ루삥뽕'], hint:'웃길 때 쓰는 과장 표현', year:2023 },
  { id:'MM17', type:'meme', answer:'억텐', aliases:['억텐','억지텐션'], hint:'억지 텐션', year:2023 },
  { id:'MM18', type:'meme', answer:'좋댓구알', aliases:['좋댓구알','좋아요댓글구독알림'], hint:'좋아요 댓글 구독 알림설정', year:2020 },
  { id:'MM19', type:'meme', answer:'이게 맞아?', aliases:['이게맞아'], hint:'의심스러울 때 쓰는 말', year:2024 },
  { id:'MM20', type:'meme', answer:'알잘딱깔센', aliases:['알잘딱깔센'], hint:'알아서 잘 딱 깔끔하고 센스있게', year:2021 },
  { id:'MM21', type:'meme', answer:'가보자고', aliases:['가보자고'], hint:'도전할 때 외치는 말', year:2023 },
  { id:'MM22', type:'meme', answer:'레게노', aliases:['레게노','레전드'], hint:'레전드를 귀엽게 발음', year:2023 },
  { id:'MM23', type:'meme', answer:'스불재', aliases:['스불재','스스로불러온재앙'], hint:'스스로 불러온 재앙', year:2022 },
  { id:'MM24', type:'meme', answer:'맛도리', aliases:['맛도리','맛있는도리토스'], hint:'맛있다를 귀엽게', year:2024 },
  { id:'MM25', type:'meme', answer:'혼코노', aliases:['혼코노','혼자코인노래방'], hint:'혼자 코인 노래방', year:2023 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskAnswer(answer: string, ratio: number): string {
  const chars = [...answer];
  const maskable = chars
    .map((c, i) => (/[가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ]/.test(c) ? i : -1))
    .filter((i) => i >= 0);
  const maskCount = Math.floor(maskable.length * ratio);
  const shuffled = [...maskable].sort(() => Math.random() - 0.5);
  const toMask = new Set(shuffled.slice(0, maskCount));
  return chars.map((c, i) => (toMask.has(i) ? '⭕' : c)).join('');
}

function revealOneChar(masked: string, answer: string): string {
  const maskedChars = [...masked];
  const answerChars = [...answer];
  const hiddenIndices: number[] = [];
  maskedChars.forEach((c, i) => {
    if (c === '⭕') hiddenIndices.push(i);
  });
  if (hiddenIndices.length === 0) return masked;
  const pick = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  maskedChars[pick] = answerChars[pick];
  return maskedChars.join('');
}

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

function checkAnswer(input: string, question: Question): boolean {
  const norm = normalizeAnswer(input);
  const correct = [question.answer, ...question.aliases].some(
    (a) => normalizeAnswer(a) === norm
  );
  return correct;
}

function getDifficulty(round: number): { maskRatio: number; timerSec: number; baseScore: number; label: string } {
  if (round <= 3) return { maskRatio: 0.2 + Math.random() * 0.1, timerSec: 15, baseScore: 50, label: '쉬움' };
  if (round <= 6) return { maskRatio: 0.4 + Math.random() * 0.2, timerSec: 10, baseScore: 80, label: '중간' };
  if (round <= 9) return { maskRatio: 0.65 + Math.random() * 0.15, timerSec: 8, baseScore: 120, label: '어려움' };
  return { maskRatio: 0.85, timerSec: 6, baseScore: 250, label: '극한' };
}

function pickQuestions(): Question[] {
  const shuffled = [...ALL_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10);
}

function playSound(type: 'correct' | 'wrong' | 'tick') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch {
    // Audio not supported
  }
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
}

function Confetti({ active }: { active: boolean }) {
  const pieces: ConfettiPiece[] = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ['#FF2D7B', '#00D4FF', '#FFF200', '#FF6B35', '#7B2FFF'][i % 5],
    delay: Math.random() * 0.5,
    size: 8 + Math.random() * 8,
  }));

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            animationDelay: `${p.delay}s`,
            animationDuration: `${1 + Math.random()}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MemePage() {
  const [screen, setScreen] = useState<GameScreen>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentRound, setCurrentRound] = useState(0); // 0-indexed
  const [maskedAnswer, setMaskedAnswer] = useState('');
  const [userInput, setUserInput] = useState('');
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [timerMax, setTimerMax] = useState(15);
  const [hintUsed, setHintUsed] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackPassed, setFeedbackPassed] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState(0);
  const [shakeActive, setShakeActive] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load best score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('meme-best-score');
    if (saved) setBestScore(parseInt(saved, 10));
  }, []);

  const currentQuestion = questions[currentRound];

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceToNextRound = useCallback(
    (newLives: number, newScore: number, newCombo: number, newCorrectCount: number, roundResults: RoundResult[]) => {
      const nextRound = currentRound + 1;
      if (nextRound >= 10 || newLives <= 0) {
        // Game over
        setScreen('result');
        const finalScore = newScore;
        if (finalScore > bestScore) {
          setBestScore(finalScore);
          localStorage.setItem('meme-best-score', String(finalScore));
        }
        saveScore('meme', '플레이어', finalScore);
      } else {
        setCurrentRound(nextRound);
        const diff = getDifficulty(nextRound + 1);
        const masked = maskAnswer(questions[nextRound].answer, diff.maskRatio);
        setMaskedAnswer(masked);
        setUserInput('');
        setHintUsed(false);
        setTimeLeft(diff.timerSec);
        setTimerMax(diff.timerSec);
        setScreen('playing');
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [currentRound, questions, bestScore]
  );

  const handleFeedbackEnd = useCallback(
    (wasCorrect: boolean, wasPassed: boolean, pointsEarned: number, newLives: number, newScore: number, newCombo: number, newCorrectCount: number) => {
      const updatedResults = [
        ...results,
        { correct: wasCorrect && !wasPassed, passed: wasPassed },
      ];
      setResults(updatedResults);
      setConfettiActive(false);

      advanceToNextRound(newLives, newScore, newCombo, newCorrectCount, updatedResults);
    },
    [results, advanceToNextRound]
  );

  const submitAnswer = useCallback(
    (input: string, isPassed: boolean, currentTimeLeft: number) => {
      stopTimer();
      const question = currentQuestion;
      if (!question) return;

      const isCorrect = !isPassed && checkAnswer(input, question);
      const diff = getDifficulty(currentRound + 1);

      let pointsEarned = 0;
      let newCombo = combo;
      let newLives = lives;
      let newScore = score;
      let newCorrectCount = correctCount;

      if (isPassed) {
        newCombo = 0;
      } else if (isCorrect) {
        newCombo = combo + 1;
        let multiplier = 1;
        if (newCombo >= 5) multiplier = 2;
        else if (newCombo >= 3) multiplier = 1.5;
        const timeBonus = currentTimeLeft * 5;
        const hintPenalty = hintUsed ? 50 : 0;
        pointsEarned = Math.max(0, Math.floor((diff.baseScore + timeBonus) * multiplier) - hintPenalty);
        newScore = score + pointsEarned;
        newCorrectCount = correctCount + 1;
        playSound('correct');
        setConfettiActive(true);
        setTimeout(() => setConfettiActive(false), 1500);
      } else {
        // Wrong answer
        newCombo = 0;
        newLives = lives - 1;
        playSound('wrong');
        setShakeActive(true);
        setTimeout(() => setShakeActive(false), 500);
      }

      setCombo(newCombo);
      setLives(newLives);
      setScore(newScore);
      setCorrectCount(newCorrectCount);
      setFeedbackCorrect(isCorrect);
      setFeedbackPassed(isPassed);
      setFeedbackScore(pointsEarned);
      setScreen('feedback');

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        handleFeedbackEnd(isCorrect, isPassed, pointsEarned, newLives, newScore, newCombo, newCorrectCount);
      }, 2000);
    },
    [stopTimer, currentQuestion, currentRound, combo, lives, score, correctCount, hintUsed, handleFeedbackEnd]
  );

  // Timer
  useEffect(() => {
    if (screen !== 'playing') return;
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - treat as wrong
          return 0;
        }
        if (prev <= 6) playSound('tick');
        return prev - 1;
      });
    }, 1000);
    return stopTimer;
  }, [screen, currentRound, stopTimer]);

  // Handle time running out
  useEffect(() => {
    if (screen === 'playing' && timeLeft === 0) {
      submitAnswer('', false, 0);
    }
  }, [timeLeft, screen, submitAnswer]);

  const startGame = useCallback(() => {
    const picked = pickQuestions();
    setQuestions(picked);
    setCurrentRound(0);
    setLives(3);
    setScore(0);
    setCombo(0);
    setResults([]);
    setCorrectCount(0);
    setUserInput('');
    setHintUsed(false);
    setConfettiActive(false);
    setShakeActive(false);

    const diff = getDifficulty(1);
    const masked = maskAnswer(picked[0].answer, diff.maskRatio);
    setMaskedAnswer(masked);
    setTimeLeft(diff.timerSec);
    setTimerMax(diff.timerSec);
    setScreen('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleHint = useCallback(() => {
    if (hintUsed) return;
    setHintUsed(true);
    setMaskedAnswer((prev) => revealOneChar(prev, currentQuestion.answer));
  }, [hintUsed, currentQuestion]);

  const handlePass = useCallback(() => {
    submitAnswer('', true, timeLeft);
  }, [submitAnswer, timeLeft]);

  const handleSubmit = useCallback(() => {
    if (!userInput.trim()) return;
    submitAnswer(userInput, false, timeLeft);
  }, [submitAnswer, userInput, timeLeft]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSubmit();
    },
    [handleSubmit]
  );

  const timerPercent = timerMax > 0 ? (timeLeft / timerMax) * 100 : 0;
  const timerColor =
    timerPercent > 60
      ? 'bg-green-500'
      : timerPercent > 30
      ? 'bg-yellow-400'
      : 'bg-red-500';

  const shareResult = useCallback(() => {
    const emojiLine = results
      .map((r) => (r.passed ? '⬜' : r.correct ? '🟩' : '🟥'))
      .join('');
    const text = `🎮 밈밈! MeMeme!\n💎 ${score}점 | ${correctCount}/10 정답\n${emojiLine}\nhttps://game1.example.com/games/meme`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [results, score, correctCount]);

  // ─── Screens ───────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-[#FFF200] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-[-60px] left-[-60px] w-48 h-48 rounded-full bg-[#FF2D7B] opacity-20 blur-3xl" />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full bg-[#00D4FF] opacity-20 blur-3xl" />

        <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
          {/* Title */}
          <div className="text-center">
            <h1
              className="text-7xl font-black tracking-tight"
              style={{
                WebkitTextStroke: '3px black',
                textShadow: '4px 4px 0 black',
                color: '#FF2D7B',
              }}
            >
              🎮 밈밈!
            </h1>
            <p
              className="mt-2 text-xl font-extrabold text-black"
              style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}
            >
              몇 글자로 알아볼 수 있어?
            </p>
          </div>

          {/* Best score */}
          <div className="bg-black text-[#FFF200] rounded-2xl px-6 py-3 text-lg font-bold border-4 border-black shadow-[4px_4px_0_#FF2D7B]">
            🏆 최고: <span className="text-[#00D4FF]">{bestScore}점</span>
          </div>

          {/* Info chips */}
          <div className="flex gap-3 flex-wrap justify-center">
            <span className="bg-white border-3 border-black rounded-full px-4 py-1.5 text-sm font-bold shadow-[2px_2px_0_black]">
              🎬 영화 제목
            </span>
            <span className="bg-white border-3 border-black rounded-full px-4 py-1.5 text-sm font-bold shadow-[2px_2px_0_black]">
              💬 인터넷 밈
            </span>
            <span className="bg-white border-3 border-black rounded-full px-4 py-1.5 text-sm font-bold shadow-[2px_2px_0_black]">
              10라운드
            </span>
          </div>

          {/* Start button */}
          <button
            onClick={startGame}
            className="w-full py-5 bg-[#FF2D7B] text-white text-2xl font-black rounded-2xl border-4 border-black shadow-[6px_6px_0_black] active:shadow-[2px_2px_0_black] active:translate-x-1 active:translate-y-1 transition-all"
          >
            🔥 시작하기
          </button>

          {/* Home link */}
          <Link
            href="/"
            className="text-black font-bold underline underline-offset-2 text-sm opacity-70 hover:opacity-100"
          >
            ← 홈으로
          </Link>
        </div>
      </div>
    );
  }

  // ─── Playing Screen ────────────────────────────────────────────────────────

  if (screen === 'playing' && currentQuestion) {
    const diff = getDifficulty(currentRound + 1);
    return (
      <div
        className={`min-h-screen bg-[#FFF200] flex flex-col p-4 gap-3 ${
          shakeActive ? 'animate-shake' : ''
        }`}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
          }
          .animate-shake { animation: shake 0.5s ease-in-out; }
          .animate-confetti-fall { animation: confetti-fall 1.5s ease-in forwards; }
        `}</style>

        <Confetti active={confettiActive} />

        {/* Top bar */}
        <div className="flex items-center justify-between bg-black rounded-2xl px-4 py-2.5 shadow-[3px_3px_0_#FF2D7B]">
          <div className="flex gap-1 text-xl">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={i < lives ? '' : 'opacity-20'}>
                ❤️
              </span>
            ))}
          </div>
          <div className="text-[#FFF200] font-black text-lg">
            💎 {score}
          </div>
          <div className="text-white font-bold text-sm">
            #{currentRound + 1}/10
          </div>
        </div>

        {/* Timer bar */}
        <div className="w-full bg-gray-300 rounded-full h-4 border-2 border-black overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-bold text-black -mt-1">
          <span>{diff.label}</span>
          <span className={timeLeft <= 5 ? 'text-red-600 font-black text-sm animate-pulse' : ''}>
            ⏱ {timeLeft}초
          </span>
        </div>

        {/* Category chip */}
        <div className="flex justify-center">
          <span
            className={`px-4 py-1.5 rounded-full text-sm font-black border-3 border-black shadow-[2px_2px_0_black] ${
              currentQuestion.type === 'movie'
                ? 'bg-[#00D4FF] text-black'
                : 'bg-[#FF2D7B] text-white'
            }`}
          >
            {currentQuestion.type === 'movie' ? '🎬 영화' : '💬 밈'}
            {combo >= 3 && (
              <span className="ml-2 bg-[#FFF200] text-black rounded-full px-2 py-0.5 text-xs font-black border border-black">
                🔥 {combo}콤보!
              </span>
            )}
          </span>
        </div>

        {/* Masked answer */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[120px]">
          <div
            className="text-center break-all leading-tight"
            style={{
              fontSize: maskedAnswer.length > 8 ? '2.2rem' : '3rem',
              fontWeight: 900,
              letterSpacing: '0.05em',
              WebkitTextStroke: '1.5px black',
              textShadow: '3px 3px 0 black',
              color: '#FF2D7B',
            }}
          >
            {maskedAnswer}
          </div>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="정답을 입력하세요"
          className="w-full text-xl font-bold text-center border-4 border-black rounded-2xl px-4 py-4 bg-white shadow-[4px_4px_0_black] placeholder-gray-400 focus:outline-none focus:border-[#FF2D7B]"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!userInput.trim()}
          className="w-full py-4 bg-[#FF2D7B] text-white text-xl font-black rounded-2xl border-4 border-black shadow-[4px_4px_0_black] active:shadow-[1px_1px_0_black] active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ✅ 정답 제출
        </button>

        {/* Hint + Pass */}
        <div className="flex gap-3">
          <button
            onClick={handleHint}
            disabled={hintUsed}
            className="flex-1 py-3 bg-[#00D4FF] text-black text-base font-black rounded-xl border-3 border-black shadow-[3px_3px_0_black] active:shadow-[1px_1px_0_black] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {hintUsed ? '💡 사용됨' : '💡 힌트 -50점'}
          </button>
          <button
            onClick={handlePass}
            className="flex-1 py-3 bg-white text-black text-base font-black rounded-xl border-3 border-black shadow-[3px_3px_0_black] active:shadow-[1px_1px_0_black] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            ⏭ PASS
          </button>
        </div>
      </div>
    );
  }

  // ─── Feedback Screen ───────────────────────────────────────────────────────

  if (screen === 'feedback' && currentQuestion) {
    return (
      <div className="min-h-screen bg-[#FFF200] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Confetti active={confettiActive} />

        <div
          className={`w-full max-w-sm rounded-3xl border-4 border-black shadow-[6px_6px_0_black] p-8 flex flex-col items-center gap-4 ${
            feedbackPassed
              ? 'bg-gray-100'
              : feedbackCorrect
              ? 'bg-green-100'
              : 'bg-red-100'
          }`}
        >
          <div className="text-6xl">
            {feedbackPassed ? '⏭' : feedbackCorrect ? '✅' : '❌'}
          </div>
          <div
            className={`text-3xl font-black ${
              feedbackPassed
                ? 'text-gray-600'
                : feedbackCorrect
                ? 'text-green-700'
                : 'text-red-700'
            }`}
          >
            {feedbackPassed
              ? 'PASS!'
              : feedbackCorrect
              ? `정답! +${feedbackScore}점`
              : '오답!'}
          </div>

          <div className="text-center">
            <div className="text-sm font-bold text-gray-500 mb-1">정답</div>
            <div
              className="font-black text-2xl text-black"
              style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.15)' }}
            >
              {currentQuestion.answer}
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-bold text-gray-700">
              💡 {currentQuestion.hint}
            </p>
          </div>

          <div className="text-xs text-gray-500 font-bold animate-pulse">
            2초 후 다음 문제...
          </div>
        </div>
      </div>
    );
  }

  // ─── Result Screen ─────────────────────────────────────────────────────────

  if (screen === 'result') {
    const allClear = lives > 0 && correctCount === 10;
    const emojiLine = results
      .map((r) => (r.passed ? '⬜' : r.correct ? '🟩' : '🟥'))
      .join('');

    return (
      <div className="min-h-screen bg-[#FFF200] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <Confetti active={allClear} />

        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          {/* Title */}
          <div className="text-center">
            <div className="text-5xl mb-2">{allClear ? '🎉' : '💀'}</div>
            <h2
              className="text-4xl font-black"
              style={{
                WebkitTextStroke: '2px black',
                textShadow: '3px 3px 0 black',
                color: allClear ? '#FF2D7B' : '#333',
              }}
            >
              {allClear ? '올 클리어!' : 'GAME OVER'}
            </h2>
          </div>

          {/* Score card */}
          <div className="w-full bg-black rounded-3xl p-6 flex flex-col items-center gap-3 shadow-[6px_6px_0_#FF2D7B]">
            <div className="text-[#FFF200] text-5xl font-black">
              💎 {score}점
            </div>
            <div className="text-white font-bold text-lg">
              {correctCount}/10 정답
            </div>
            {score >= bestScore && score > 0 && (
              <div className="bg-[#FF2D7B] text-white rounded-full px-4 py-1 text-sm font-black animate-bounce">
                🏆 최고기록 갱신!
              </div>
            )}
          </div>

          {/* Emoji grid */}
          <div className="bg-white border-4 border-black rounded-2xl px-6 py-4 w-full shadow-[3px_3px_0_black]">
            <div className="text-center font-black text-sm text-gray-500 mb-2">결과</div>
            <div className="text-center text-3xl tracking-widest">{emojiLine}</div>
            <div className="flex justify-center gap-3 mt-3 text-xs font-bold text-gray-500">
              <span>🟩 정답</span>
              <span>🟥 오답</span>
              <span>⬜ PASS</span>
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={shareResult}
            className="w-full py-4 bg-[#00D4FF] text-black text-lg font-black rounded-2xl border-4 border-black shadow-[4px_4px_0_black] active:shadow-[1px_1px_0_black] active:translate-x-1 active:translate-y-1 transition-all"
          >
            {copied ? '✅ 클립보드에 복사됨!' : '📤 결과 공유'}
          </button>

          {/* Play again + Home */}
          <div className="flex gap-3 w-full">
            <button
              onClick={startGame}
              className="flex-1 py-4 bg-[#FF2D7B] text-white text-lg font-black rounded-2xl border-4 border-black shadow-[4px_4px_0_black] active:shadow-[1px_1px_0_black] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              🔁 다시하기
            </button>
            <Link
              href="/"
              className="flex-1 py-4 bg-black text-[#FFF200] text-lg font-black rounded-2xl border-4 border-black shadow-[4px_4px_0_black] active:shadow-[1px_1px_0_black] text-center flex items-center justify-center"
            >
              🏠 홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
