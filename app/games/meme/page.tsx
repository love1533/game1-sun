'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { saveScore } from '@/lib/ranking';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  type: 'movie' | 'meme';
  answer: string;
  aliases: string[];
  hint: string;
  year: number;
}

type GameScreen = 'home' | 'playing' | 'result';
type ChoiceState = 'default' | 'correct' | 'wrong' | 'revealed';

interface RoundResult {
  correct: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaskRatio(round: number): number {
  if (round <= 3) return 0.30;
  if (round <= 6) return 0.50;
  if (round <= 9) return 0.70;
  return 0.85;
}

function maskAnswer(answer: string, ratio: number): string {
  const chars = [...answer];
  const maskable = chars
    .map((c, i) => (/[가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ]/.test(c) ? i : -1))
    .filter((i) => i >= 0);
  const maskCount = Math.floor(maskable.length * ratio);
  const toMask = new Set([...maskable].sort(() => Math.random() - 0.5).slice(0, maskCount));
  return chars.map((c, i) => (toMask.has(i) ? '⭕' : c)).join('');
}

function generateChoices(correctQ: Question, allQs: Question[]): string[] {
  const sameType = allQs.filter(q => q.type === correctQ.type && q.id !== correctQ.id);
  const shuffled = [...sameType].sort(() => Math.random() - 0.5);
  const wrongs = shuffled.slice(0, 3).map(q => q.answer);
  return [correctQ.answer, ...wrongs].sort(() => Math.random() - 0.5);
}

function pickQuestions(): Question[] {
  return [...ALL_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
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
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'wrong') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
    }
  } catch { /* unsupported */ }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MemePage() {
  const [screen, setScreen] = useState<GameScreen>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [maskedAnswer, setMaskedAnswer] = useState('');
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [copied, setCopied] = useState(false);

  // Feedback state (inline, not overlay)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [choiceStates, setChoiceStates] = useState<Record<string, ChoiceState>>({});
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackPoints, setFeedbackPoints] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('meme-best-score');
    if (saved) setBestScore(parseInt(saved, 10));
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const setupRound = useCallback((qs: Question[], round: number) => {
    const q = qs[round];
    const ratio = getMaskRatio(round + 1);
    setMaskedAnswer(maskAnswer(q.answer, ratio));
    setChoices(generateChoices(q, ALL_QUESTIONS));
    setSelectedChoice(null);
    setChoiceStates({});
    setFeedbackText('');
    setFeedbackPoints(0);
    setIsAnswered(false);
    setTimeLeft(15);
  }, []);

  const finishGame = useCallback((finalScore: number, finalCorrect: number, finalResults: RoundResult[]) => {
    setScreen('result');
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem('meme-best-score', String(finalScore));
    }
    saveScore('meme', '플레이어', finalScore);
  }, [bestScore]);

  const handleChoice = useCallback((choice: string, currentTimeLeft: number) => {
    if (isAnswered) return;
    stopTimer();

    const q = questions[currentRound];
    const isCorrect = choice === q.answer;

    setSelectedChoice(choice);
    setIsAnswered(true);

    const newStates: Record<string, ChoiceState> = {};
    choices.forEach(c => {
      if (c === choice && isCorrect) newStates[c] = 'correct';
      else if (c === choice && !isCorrect) newStates[c] = 'wrong';
      else if (c === q.answer && !isCorrect) newStates[c] = 'revealed';
      else newStates[c] = 'default';
    });
    setChoiceStates(newStates);

    let newLives = lives;
    let newScore = score;
    let newCombo = combo;
    let newCorrect = correctCount;
    let points = 0;

    if (isCorrect) {
      newCombo = combo + 1;
      let multiplier = 1;
      if (newCombo >= 5) multiplier = 2;
      else if (newCombo >= 3) multiplier = 1.5;
      points = Math.floor((100 + currentTimeLeft * 10) * multiplier);
      newScore = score + points;
      newCorrect = correctCount + 1;
      setFeedbackText('정답! ✅');
      setFeedbackPoints(points);
      playSound('correct');
    } else {
      newCombo = 0;
      newLives = lives - 1;
      setFeedbackText('아쉽~ ❌');
      playSound('wrong');
    }

    setLives(newLives);
    setScore(newScore);
    setCombo(newCombo);
    setCorrectCount(newCorrect);

    const newResults = [...results, { correct: isCorrect }];
    setResults(newResults);

    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => {
      const nextRound = currentRound + 1;
      if (nextRound >= 10 || newLives <= 0) {
        finishGame(newScore, newCorrect, newResults);
      } else {
        setCurrentRound(nextRound);
        setupRound(questions, nextRound);
        setScreen('playing');
      }
    }, 1500);
  }, [isAnswered, questions, currentRound, choices, lives, score, combo, correctCount, results, stopTimer, setupRound, finishGame]);

  // Timer
  useEffect(() => {
    if (screen !== 'playing' || isAnswered) return;
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        if (prev <= 6) playSound('tick');
        return prev - 1;
      });
    }, 1000);
    return stopTimer;
  }, [screen, currentRound, isAnswered, stopTimer]);

  // Time out
  useEffect(() => {
    if (screen === 'playing' && timeLeft === 0 && !isAnswered) {
      handleChoice('__timeout__', 0);
    }
  }, [timeLeft, screen, isAnswered, handleChoice]);

  const startGame = useCallback(() => {
    const picked = pickQuestions();
    setQuestions(picked);
    setCurrentRound(0);
    setLives(3);
    setScore(0);
    setCombo(0);
    setResults([]);
    setCorrectCount(0);
    setupRound(picked, 0);
    setScreen('playing');
  }, [setupRound]);

  const timerPct = (timeLeft / 15) * 100;

  // ─── Home Screen ─────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-[#F5F0FF] flex flex-col">
        <div className="px-5 pt-5">
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
            <span>←</span><span>홈</span>
          </Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-8">
          <div className="text-center">
            <div className="text-6xl mb-3">🎬💬</div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">밈밈! MeMeme!</h1>
            <p className="mt-2 text-base text-gray-500 font-medium">몇 글자로 알아볼 수 있어?</p>
          </div>

          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-xs text-gray-400 font-medium">최고 기록</p>
                <p className="text-xl font-black text-gray-900">{bestScore.toLocaleString()}점</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[['🎬', '영화 제목'], ['💬', '인터넷 밈'], ['🔟', '10라운드']].map(([icon, label]) => (
                <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 py-3">
                  <div className="text-xl">{icon}</div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={startGame}
              className="w-full py-5 bg-[#7C3AED] text-white text-xl font-black rounded-2xl shadow-lg active:scale-95 transition-transform"
            >
              🔥 시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Playing Screen ───────────────────────────────────────────────────────────

  if (screen === 'playing') {
    const q = questions[currentRound];
    if (!q) return null;

    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-[#F5F0FF] flex flex-col px-4 pt-4 pb-6 gap-4">
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-8px)}
            40%{transform:translateX(8px)}
            60%{transform:translateX(-5px)}
            80%{transform:translateX(5px)}
          }
          @keyframes pop-in {
            0%{transform:scale(0.85);opacity:0}
            60%{transform:scale(1.05)}
            100%{transform:scale(1);opacity:1}
          }
          .animate-shake{animation:shake 0.4s ease-in-out}
          .animate-pop-in{animation:pop-in 0.25s ease-out forwards}
        `}</style>

        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 text-xl">
            {[0,1,2].map(i => (
              <span key={i} className={`transition-all ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}>❤️</span>
            ))}
          </div>
          <div className="bg-white rounded-full px-4 py-1.5 shadow-sm border border-gray-100">
            <span className="font-black text-[#7C3AED] text-sm">💎 {score.toLocaleString()}</span>
          </div>
          <div className="text-sm font-bold text-gray-400">{currentRound + 1}<span className="text-gray-300">/10</span></div>
        </div>

        {/* Timer bar */}
        <div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${timerPct}%`,
                background: timerPct > 50 ? 'linear-gradient(90deg,#10B981,#34D399)' : timerPct > 25 ? 'linear-gradient(90deg,#F59E0B,#FBBF24)' : 'linear-gradient(90deg,#EF4444,#F87171)',
              }}
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className={`text-xs font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
              {timeLeft}초
            </span>
          </div>
        </div>

        {/* Category badge + combo */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${q.type === 'movie' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
            {q.type === 'movie' ? '🎬 영화' : '💬 밈'}
          </span>
          {combo >= 3 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-600 animate-pop-in">
              🔥 {combo}콤보!
            </span>
          )}
        </div>

        {/* Masked answer */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-6 text-center">
          <p className={`font-black text-gray-900 leading-snug break-all ${maskedAnswer.length > 8 ? 'text-3xl' : 'text-4xl'}`}>
            {maskedAnswer}
          </p>
          <p className="mt-3 text-sm text-gray-400 font-medium">💡 &quot;{q.hint}&quot;</p>
        </div>

        {/* Feedback text */}
        <div className="h-8 flex items-center justify-center">
          {feedbackText && (
            <div className={`text-base font-black animate-pop-in ${feedbackText.includes('정답') ? 'text-green-600' : 'text-red-500'}`}>
              {feedbackText}
              {feedbackPoints > 0 && <span className="ml-2 text-[#7C3AED]">+{feedbackPoints}점</span>}
            </div>
          )}
        </div>

        {/* Choices */}
        <div className="flex flex-col gap-3">
          {choices.map((choice) => {
            const state = choiceStates[choice] ?? 'default';
            let cls = 'bg-white border-gray-200 text-gray-800';
            if (state === 'correct') cls = 'bg-green-100 border-green-500 text-green-700';
            else if (state === 'wrong') cls = 'bg-red-100 border-red-500 text-red-700';
            else if (state === 'revealed') cls = 'bg-green-50 border-green-400 text-green-600';

            return (
              <button
                key={choice}
                onClick={() => handleChoice(choice, timeLeft)}
                disabled={isAnswered}
                className={`w-full py-4 rounded-2xl border-2 text-base font-bold transition-all active:scale-95 ${cls} ${isAnswered ? 'cursor-default' : 'hover:border-[#7C3AED] hover:shadow-sm'}`}
              >
                {choice}
                {state === 'correct' && <span className="ml-2">✅</span>}
                {state === 'wrong' && <span className="ml-2">❌</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Result Screen ────────────────────────────────────────────────────────────

  if (screen === 'result') {
    const emojiGrid = results.map(r => r.correct ? '🟩' : '🟥').join('');
    const isHighScore = score >= bestScore && score > 0;

    const shareResult = () => {
      const text = `🎬💬 밈밈! MeMeme!\n💎 ${score.toLocaleString()}점 | ${correctCount}/10 정답\n${emojiGrid}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    const grade = correctCount >= 9 ? '완벽해요! 🎉' : correctCount >= 7 ? '잘했어요! 👏' : correctCount >= 5 ? '괜찮아요! 😊' : '다시 도전! 💪';

    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-[#F5F0FF] flex flex-col px-5 pt-10 pb-8 gap-5">
        {/* Grade */}
        <div className="text-center">
          <p className="text-4xl mb-2">{correctCount >= 7 ? '🎉' : correctCount >= 5 ? '😊' : '😅'}</p>
          <h2 className="text-2xl font-black text-gray-900">{grade}</h2>
        </div>

        {/* Score card */}
        <div className="bg-[#7C3AED] rounded-2xl p-6 text-center text-white shadow-lg">
          <p className="text-sm font-medium opacity-80 mb-1">최종 점수</p>
          <p className="text-5xl font-black mb-2">{score.toLocaleString()}<span className="text-2xl ml-1">점</span></p>
          <p className="text-sm font-bold opacity-90">{correctCount}/10 정답</p>
          {isHighScore && (
            <div className="mt-3 inline-block bg-white/20 rounded-full px-4 py-1 text-sm font-bold">
              🏆 최고기록 갱신!
            </div>
          )}
        </div>

        {/* Emoji grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
          <p className="text-xs font-bold text-gray-400 mb-3 text-center">라운드별 결과</p>
          <p className="text-center text-2xl tracking-widest leading-relaxed">{emojiGrid}</p>
          <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400 font-medium">
            <span>🟩 정답</span><span>🟥 오답</span>
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={shareResult}
          className="w-full py-4 bg-white border-2 border-[#7C3AED] text-[#7C3AED] text-base font-bold rounded-2xl active:scale-95 transition-transform"
        >
          {copied ? '✅ 복사됐어요!' : '📤 공유하기'}
        </button>

        <div className="flex gap-3">
          <button
            onClick={startGame}
            className="flex-1 py-4 bg-[#7C3AED] text-white text-base font-bold rounded-2xl active:scale-95 transition-transform"
          >
            🔁 다시
          </button>
          <Link
            href="/"
            className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 text-base font-bold rounded-2xl text-center flex items-center justify-center active:scale-95 transition-transform"
          >
            🏠 홈
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
