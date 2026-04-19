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
  // Movies (50)
  { id:'M1', type:'movie', answer:'기생충', aliases:['기생충'], hint:'2019 아카데미 작품상 수상', year:2019 },
  { id:'M2', type:'movie', answer:'겨울왕국', aliases:['겨울왕국'], hint:'렛잇고~ 디즈니 애니메이션', year:2013 },
  { id:'M3', type:'movie', answer:'어벤져스', aliases:['어벤져스'], hint:'마블 히어로 총집합', year:2012 },
  { id:'M4', type:'movie', answer:'범죄도시', aliases:['범죄도시'], hint:'마동석 주연 액션 영화', year:2017 },
  { id:'M5', type:'movie', answer:'해리포터', aliases:['해리포터','해리 포터'], hint:'마법 학교 호그와트', year:2001 },
  { id:'M6', type:'movie', answer:'인사이드 아웃', aliases:['인사이드아웃'], hint:'감정들이 캐릭터! 기쁨이 슬픔이', year:2015 },
  { id:'M7', type:'movie', answer:'토이스토리', aliases:['토이 스토리','토이스토리'], hint:'장난감들이 살아 움직여요', year:1995 },
  { id:'M8', type:'movie', answer:'명탐정 코난', aliases:['명탐정코난','코난'], hint:'진실은 언제나 하나!', year:1996 },
  { id:'M9', type:'movie', answer:'짱구는 못말려', aliases:['짱구','짱구는못말려'], hint:'엉덩이 춤의 달인', year:1992 },
  { id:'M10', type:'movie', answer:'스파이더맨', aliases:['스파이더맨'], hint:'거미줄을 쏘는 히어로', year:2002 },
  { id:'M11', type:'movie', answer:'슈퍼마리오', aliases:['슈퍼마리오','마리오'], hint:'공주를 구하는 배관공', year:2023 },
  { id:'M12', type:'movie', answer:'도라에몽', aliases:['도라에몽'], hint:'주머니에서 뭐든 나오는 로봇 고양이', year:1980 },
  { id:'M13', type:'movie', answer:'신비아파트', aliases:['신비아파트'], hint:'귀신이 나오는 아파트', year:2014 },
  { id:'M14', type:'movie', answer:'뽀로로', aliases:['뽀로로'], hint:'노는게 제일 좋아 친구들 모여라', year:2003 },
  { id:'M15', type:'movie', answer:'타이타닉', aliases:['타이타닉'], hint:'배가 빙산에 부딪혀 침몰', year:1997 },
  { id:'M16', type:'movie', answer:'주토피아', aliases:['주토피아'], hint:'동물들이 사는 도시', year:2016 },
  { id:'M17', type:'movie', answer:'모아나', aliases:['모아나'], hint:'바다를 건너는 디즈니 공주', year:2016 },
  { id:'M18', type:'movie', answer:'라이온킹', aliases:['라이온킹'], hint:'아프리카 사자 왕', year:1994 },
  { id:'M19', type:'movie', answer:'알라딘', aliases:['알라딘'], hint:'램프의 요정 지니', year:1992 },
  { id:'M20', type:'movie', answer:'엘리멘탈', aliases:['엘리멘탈'], hint:'불과 물의 사랑 이야기', year:2023 },
  { id:'M21', type:'movie', answer:'터닝레드', aliases:['터닝레드'], hint:'흥분하면 빨간 판다로 변신', year:2022 },
  { id:'M22', type:'movie', answer:'포켓몬스터', aliases:['포켓몬','포켓몬스터'], hint:'피카피카! 몬스터볼 던져', year:1997 },
  { id:'M23', type:'movie', answer:'원피스', aliases:['원피스'], hint:'해적왕이 되겠다! 루피', year:1999 },
  { id:'M24', type:'movie', answer:'나루토', aliases:['나루토'], hint:'다테바요! 닌자 소년', year:2002 },
  { id:'M25', type:'movie', answer:'귀멸의 칼날', aliases:['귀멸의칼날','귀멸'], hint:'탄지로의 도깨비 퇴치', year:2019 },
  { id:'M26', type:'movie', answer:'드래곤볼', aliases:['드래곤볼'], hint:'카메하메하! 손오공', year:1986 },
  { id:'M27', type:'movie', answer:'미니언즈', aliases:['미니언즈'], hint:'바나나~ 노란 알약 생물체', year:2015 },
  { id:'M28', type:'movie', answer:'슈렉', aliases:['슈렉'], hint:'초록색 오우거의 모험', year:2001 },
  { id:'M29', type:'movie', answer:'쿵푸팬더', aliases:['쿵푸팬더','쿵푸 팬더'], hint:'뚱뚱한 팬더가 무술 마스터', year:2008 },
  { id:'M30', type:'movie', answer:'아이언맨', aliases:['아이언맨'], hint:'토니 스타크의 철갑 슈트', year:2008 },
  { id:'M31', type:'movie', answer:'블랙팬서', aliases:['블랙팬서'], hint:'와칸다 포에버!', year:2018 },
  { id:'M32', type:'movie', answer:'닥터스트레인지', aliases:['닥터스트레인지'], hint:'마법사 히어로, 타임스톤', year:2016 },
  { id:'M33', type:'movie', answer:'앤트맨', aliases:['앤트맨'], hint:'작아지는 히어로', year:2015 },
  { id:'M34', type:'movie', answer:'토르', aliases:['토르'], hint:'망치 들고 다니는 천둥의 신', year:2011 },
  { id:'M35', type:'movie', answer:'배트맨', aliases:['배트맨'], hint:'고담시를 지키는 박쥐 히어로', year:2022 },
  { id:'M36', type:'movie', answer:'수퍼맨', aliases:['수퍼맨','슈퍼맨'], hint:'하늘을 나는 크립톤 영웅', year:1978 },
  { id:'M37', type:'movie', answer:'트랜스포머', aliases:['트랜스포머'], hint:'자동차가 로봇으로 변신', year:2007 },
  { id:'M38', type:'movie', answer:'쥬라기공원', aliases:['쥬라기공원','쥬라기 공원'], hint:'공룡이 부활한 섬', year:1993 },
  { id:'M39', type:'movie', answer:'해운대', aliases:['해운대'], hint:'부산에 쓰나미가 온다!', year:2009 },
  { id:'M40', type:'movie', answer:'극한직업', aliases:['극한직업'], hint:'치킨집 운영하는 형사들', year:2019 },
  { id:'M41', type:'movie', answer:'신과함께', aliases:['신과함께'], hint:'저승 재판을 받는 영화', year:2017 },
  { id:'M42', type:'movie', answer:'택시운전사', aliases:['택시운전사'], hint:'광주로 가는 택시 기사 이야기', year:2017 },
  { id:'M43', type:'movie', answer:'부산행', aliases:['부산행'], hint:'KTX에서 좀비 발생!', year:2016 },
  { id:'M44', type:'movie', answer:'올드보이', aliases:['올드보이'], hint:'15년간 갇혀있던 남자의 복수', year:2003 },
  { id:'M45', type:'movie', answer:'괴물', aliases:['괴물'], hint:'한강에 괴물이 나타났다', year:2006 },
  { id:'M46', type:'movie', answer:'마당을 나온 암탉', aliases:['마당을나온암탉'], hint:'자유를 찾아 떠난 닭 잎싹', year:2011 },
  { id:'M47', type:'movie', answer:'너의 이름은', aliases:['너의이름은'], hint:'일본 애니, 몸이 바뀌는 소년소녀', year:2016 },
  { id:'M48', type:'movie', answer:'센과 치히로', aliases:['센과치히로'], hint:'지브리 온천 세계 모험', year:2001 },
  { id:'M49', type:'movie', answer:'하울의 움직이는 성', aliases:['하울의움직이는성'], hint:'걸어다니는 성에 사는 마법사', year:2004 },
  { id:'M50', type:'movie', answer:'이웃집 토토로', aliases:['이웃집토토로','토토로'], hint:'숲속의 커다란 정령 토토로', year:1988 },
  // Memes (50)
  { id:'MM1', type:'meme', answer:'무야호', aliases:['무야호'], hint:'유재석 신나서 외치는 소리', year:2021 },
  { id:'MM2', type:'meme', answer:'어쩔티비', aliases:['어쩔티비'], hint:'말대꾸 할 때 쓰는 유행어', year:2021 },
  { id:'MM3', type:'meme', answer:'킹받네', aliases:['킹받네'], hint:'매우 화가 날 때 쓰는 말', year:2022 },
  { id:'MM4', type:'meme', answer:'갑분싸', aliases:['갑분싸'], hint:'갑자기 분위기 싸해짐', year:2018 },
  { id:'MM5', type:'meme', answer:'점메추', aliases:['점메추'], hint:'점심 메뉴 추천해줘', year:2022 },
  { id:'MM6', type:'meme', answer:'별다줄', aliases:['별다줄'], hint:'별걸 다 줄인다', year:2022 },
  { id:'MM7', type:'meme', answer:'중꺾마', aliases:['중꺾마'], hint:'중요한 건 꺾이지 않는 마음', year:2022 },
  { id:'MM8', type:'meme', answer:'얼죽아', aliases:['얼죽아'], hint:'얼어 죽어도 아이스 아메리카노', year:2018 },
  { id:'MM9', type:'meme', answer:'실화냐', aliases:['실화냐'], hint:'놀라울 때 쓰는 말', year:2020 },
  { id:'MM10', type:'meme', answer:'뇌절', aliases:['뇌절'], hint:'같은 드립을 반복할 때', year:2022 },
  { id:'MM11', type:'meme', answer:'갓생', aliases:['갓생'], hint:'알차고 보람찬 하루', year:2022 },
  { id:'MM12', type:'meme', answer:'오운완', aliases:['오운완'], hint:'오늘 운동 완료', year:2023 },
  { id:'MM13', type:'meme', answer:'가보자고', aliases:['가보자고'], hint:'도전할 때 외치는 말', year:2023 },
  { id:'MM14', type:'meme', answer:'레게노', aliases:['레게노'], hint:'레전드를 귀엽게 발음', year:2023 },
  { id:'MM15', type:'meme', answer:'스불재', aliases:['스불재'], hint:'스스로 불러온 재앙', year:2022 },
  { id:'MM16', type:'meme', answer:'맛도리', aliases:['맛도리'], hint:'맛있다를 귀엽게', year:2024 },
  { id:'MM17', type:'meme', answer:'혼코노', aliases:['혼코노'], hint:'혼자 코인 노래방', year:2023 },
  { id:'MM18', type:'meme', answer:'억텐', aliases:['억텐'], hint:'억지 텐션', year:2023 },
  { id:'MM19', type:'meme', answer:'알잘딱깔센', aliases:['알잘딱깔센'], hint:'알아서 잘 딱 깔끔하고 센스있게', year:2021 },
  { id:'MM20', type:'meme', answer:'오히려 좋아', aliases:['오히려좋아'], hint:'안 좋은 상황인데 긍정적으로', year:2023 },
  { id:'MM21', type:'meme', answer:'좋댓구알', aliases:['좋댓구알'], hint:'좋아요 댓글 구독 알림설정', year:2020 },
  { id:'MM22', type:'meme', answer:'TMI', aliases:['TMI','티엠아이'], hint:'Too Much Information 너무 많은 정보', year:2019 },
  { id:'MM23', type:'meme', answer:'JMT', aliases:['JMT','존맛탱'], hint:'존맛탱! 진짜 맛있다', year:2020 },
  { id:'MM24', type:'meme', answer:'FLEX', aliases:['FLEX','플렉스'], hint:'돈 자랑, 과시할 때', year:2020 },
  { id:'MM25', type:'meme', answer:'갓겜', aliases:['갓겜'], hint:'갓 + 게임 = 최고의 게임', year:2021 },
  { id:'MM26', type:'meme', answer:'현타', aliases:['현타'], hint:'현실 자각 타임', year:2020 },
  { id:'MM27', type:'meme', answer:'인싸', aliases:['인싸'], hint:'인사이더, 사회성 좋은 사람', year:2019 },
  { id:'MM28', type:'meme', answer:'아싸', aliases:['아싸'], hint:'아웃사이더, 혼자 노는 사람', year:2019 },
  { id:'MM29', type:'meme', answer:'갈비탕', aliases:['갈비탕'], hint:'갈수록 비호감 탱구리', year:2024 },
  { id:'MM30', type:'meme', answer:'삼귀자', aliases:['삼귀자'], hint:'삼초에 귀여워지는 자', year:2023 },
  { id:'MM31', type:'meme', answer:'만반잘부', aliases:['만반잘부'], hint:'만나서 반갑고 잘 부탁해', year:2021 },
  { id:'MM32', type:'meme', answer:'꾸안꾸', aliases:['꾸안꾸'], hint:'꾸민 듯 안 꾸민 듯', year:2021 },
  { id:'MM33', type:'meme', answer:'럭키비키', aliases:['럭키비키'], hint:'럭키비키잖아~ 운이 좋다', year:2024 },
  { id:'MM34', type:'meme', answer:'아무튼 출근', aliases:['아무튼출근'], hint:'힘들어도 어쨌든 출근하는 직장인', year:2024 },
  { id:'MM35', type:'meme', answer:'찐친', aliases:['찐친'], hint:'진짜 진짜 친한 친구', year:2022 },
  { id:'MM36', type:'meme', answer:'취존', aliases:['취존'], hint:'취향 존중', year:2020 },
  { id:'MM37', type:'meme', answer:'소확행', aliases:['소확행'], hint:'소소하지만 확실한 행복', year:2018 },
  { id:'MM38', type:'meme', answer:'갑통알', aliases:['갑통알'], hint:'갑자기 통장을 보니 알바를 해야겠다', year:2022 },
  { id:'MM39', type:'meme', answer:'워라밸', aliases:['워라밸'], hint:'워크 라이프 밸런스', year:2019 },
  { id:'MM40', type:'meme', answer:'돼지런하다', aliases:['돼지런하다'], hint:'돼지+부지런 = 먹으려고 부지런', year:2023 },
  { id:'MM41', type:'meme', answer:'이생망', aliases:['이생망'], hint:'이번 생은 망했어', year:2022 },
  { id:'MM42', type:'meme', answer:'완내스', aliases:['완내스'], hint:'완전 내 스타일', year:2022 },
  { id:'MM43', type:'meme', answer:'할많하않', aliases:['할많하않'], hint:'할 말은 많지만 하지 않겠다', year:2021 },
  { id:'MM44', type:'meme', answer:'쌉가능', aliases:['쌉가능'], hint:'완전 가능! 매우 가능!', year:2021 },
  { id:'MM45', type:'meme', answer:'쫌쫌따리', aliases:['쫌쫌따리'], hint:'아주 조금씩 모으는 것', year:2022 },
  { id:'MM46', type:'meme', answer:'나만없어고양이', aliases:['나만없어고양이'], hint:'다 있는데 나만 없는 고양이', year:2020 },
  { id:'MM47', type:'meme', answer:'댕댕이', aliases:['댕댕이'], hint:'멍멍이를 귀엽게 부르는 말', year:2018 },
  { id:'MM48', type:'meme', answer:'삼시세끼', aliases:['삼시세끼'], hint:'하루 세 끼 밥 먹는 예능', year:2015 },
  { id:'MM49', type:'meme', answer:'비담', aliases:['비담'], hint:'비주얼 담당', year:2021 },
  { id:'MM50', type:'meme', answer:'갈무리', aliases:['갈무리'], hint:'가을에 농사 마무리, 정리한다는 뜻', year:2023 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaskRatio(round: number): number {
  if (round <= 5) return 0.25;
  if (round <= 10) return 0.40;
  if (round <= 15) return 0.55;
  if (round <= 18) return 0.70;
  return 0.80;
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
  const correctLen = correctQ.answer.replace(/\s/g, '').length;
  const sameType = allQs.filter(q => q.type === correctQ.type && q.id !== correctQ.id);
  // Sort by similarity in character count (closest length first)
  const sorted = [...sameType].sort((a, b) => {
    const diffA = Math.abs(a.answer.replace(/\s/g, '').length - correctLen);
    const diffB = Math.abs(b.answer.replace(/\s/g, '').length - correctLen);
    if (diffA !== diffB) return diffA - diffB;
    return Math.random() - 0.5;
  });
  // Pick top 3 similar-length wrong answers, then shuffle
  const wrongs = sorted.slice(0, 3).map(q => q.answer);
  return [correctQ.answer, ...wrongs].sort(() => Math.random() - 0.5);
}

function pickQuestions(): Question[] {
  return [...ALL_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 20);
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

const CHARACTERS = [
  { name: '승민', emoji: '🤖', color: '#3B82F6' },
  { name: '건우', emoji: '🩺', color: '#10B981' },
  { name: '강우', emoji: '👨‍🍳', color: '#F59E0B' },
  { name: '수현', emoji: '💃', color: '#EC4899' },
  { name: '이현', emoji: '👸', color: '#FF69B4' },
  { name: '준영', emoji: '📚', color: '#6366F1' },
  { name: '준우', emoji: '✈️', color: '#0EA5E9' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MemePage() {
  const [screen, setScreen] = useState<GameScreen>('home');
  const [selectedChar, setSelectedChar] = useState(-1);
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
    const charName = selectedChar >= 0 ? CHARACTERS[selectedChar].name : '플레이어';
    saveScore('meme', charName, finalScore);
  }, [bestScore, selectedChar]);

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
      if (nextRound >= 20 || newLives <= 0) {
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

            {/* Character select */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-400 font-semibold mb-2.5 text-center">누가 플레이할까?</p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {CHARACTERS.map((c, i) => (
                  <button key={c.name} onClick={() => setSelectedChar(i)}
                    className="flex flex-col items-center gap-0.5 w-10 transition-transform active:scale-90"
                    style={{
                      opacity: selectedChar === -1 || selectedChar === i ? 1 : 0.4,
                      transform: selectedChar === i ? 'scale(1.15)' : 'scale(1)',
                    }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2"
                      style={{
                        borderColor: selectedChar === i ? c.color : '#E5E7EB',
                        backgroundColor: selectedChar === i ? c.color + '20' : '#F9FAFB',
                      }}>
                      {c.emoji}
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: selectedChar === i ? c.color : '#9CA3AF' }}>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { if (selectedChar >= 0) startGame(); }}
              disabled={selectedChar < 0}
              className="w-full py-5 text-white text-xl font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
              style={{ backgroundColor: selectedChar >= 0 ? '#7C3AED' : '#D1D5DB' }}
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
          <div className="text-sm font-bold text-gray-400">{currentRound + 1}<span className="text-gray-300">/20</span></div>
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
      const text = `🎬💬 밈밈! MeMeme!\n💎 ${score.toLocaleString()}점 | ${correctCount}/20 정답\n${emojiGrid}`;
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
          <p className="text-sm font-bold opacity-90">{correctCount}/20 정답</p>
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
