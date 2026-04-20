'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { saveScore } from '@/lib/ranking';

// ─── Types ──────────────────────────────────────────────────────────
interface Sajaseongeo {
  id: string;
  chars: string;
  reading: string;
  meaning: string;
}

interface Character {
  name: string;
  emoji: string;
  color: string;
}

type GamePhase = 'select' | 'playing' | 'result';
type QuestionType = 'meaning-to-chars' | 'fill-blank' | 'chars-to-meaning' | 'reading-to-chars';

interface Question {
  type: QuestionType;
  sajaseongeo: Sajaseongeo;
  display: string;
  options: string[];
  correctIndex: number;
  blankIndex?: number;
}

// ─── Characters ─────────────────────────────────────────────────────
const characters: Character[] = [
  { name: '용진', emoji: '🐉', color: '#F59E0B' },
  { name: '용정', emoji: '🌟', color: '#EC4899' },
];

// ─── 사자성어 데이터 (60+) ──────────────────────────────────────────
const SAJASEONGEO_DATA: Sajaseongeo[] = [
  { id: 's01', chars: '一石二鳥', reading: '일석이조', meaning: '한 돌로 두 마리 새를 잡는다. 하나의 행동으로 두 가지 이득을 얻음' },
  { id: 's02', chars: '以心傳心', reading: '이심전심', meaning: '마음에서 마음으로 전한다. 말하지 않아도 서로 뜻이 통함' },
  { id: 's03', chars: '自業自得', reading: '자업자득', meaning: '자기가 저지른 일의 결과를 자기가 받음' },
  { id: 's04', chars: '溫故知新', reading: '온고지신', meaning: '옛것을 익히고 새것을 앎. 과거를 통해 새로운 것을 배움' },
  { id: 's05', chars: '塞翁之馬', reading: '새옹지마', meaning: '인생의 길흉화복은 예측할 수 없음' },
  { id: 's06', chars: '臥薪嘗膽', reading: '와신상담', meaning: '장작 위에 눕고 쓸개를 맛봄. 원수를 갚기 위해 온갖 고난을 참음' },
  { id: 's07', chars: '四面楚歌', reading: '사면초가', meaning: '사방에서 초나라 노래가 들림. 사방이 적에게 둘러싸여 고립됨' },
  { id: 's08', chars: '百聞不如一見', reading: '백문불여일견', meaning: '백 번 듣는 것이 한 번 보는 것만 못함' },
  { id: 's09', chars: '畵龍點睛', reading: '화룡점정', meaning: '용을 그리고 눈동자를 찍음. 가장 중요한 부분을 마무리함' },
  { id: 's10', chars: '明鏡止水', reading: '명경지수', meaning: '맑은 거울과 고요한 물. 잡념이 없는 깨끗한 마음' },
  { id: 's11', chars: '走馬看山', reading: '주마간산', meaning: '달리는 말 위에서 산을 봄. 자세히 살피지 않고 대충 훑어봄' },
  { id: 's12', chars: '同病相憐', reading: '동병상련', meaning: '같은 병을 앓는 사람끼리 서로 가엾게 여김' },
  { id: 's13', chars: '刻舟求劍', reading: '각주구검', meaning: '배에 표시를 새기고 칼을 찾음. 세상이 변한 줄 모르고 낡은 방법을 고집함' },
  { id: 's14', chars: '朝三暮四', reading: '조삼모사', meaning: '아침에 셋 저녁에 넷. 간사한 꾀로 남을 속임' },
  { id: 's15', chars: '羊頭狗肉', reading: '양두구육', meaning: '양의 머리를 걸고 개고기를 팜. 겉과 속이 다름' },
  { id: 's16', chars: '結者解之', reading: '결자해지', meaning: '맺은 사람이 풀어야 함. 자기가 저지른 일은 자기가 해결해야 함' },
  { id: 's17', chars: '大器晩成', reading: '대기만성', meaning: '큰 그릇은 늦게 이루어짐. 크게 될 사람은 오랜 노력 끝에 성공함' },
  { id: 's18', chars: '群鷄一鶴', reading: '군계일학', meaning: '닭 무리 속의 한 마리 학. 많은 사람 중에 뛰어난 사람' },
  { id: 's19', chars: '千載一遇', reading: '천재일우', meaning: '천 년에 한 번 만남. 좀처럼 얻기 어려운 좋은 기회' },
  { id: 's20', chars: '百折不屈', reading: '백절불굴', meaning: '백 번 꺾여도 굽히지 않음. 어떤 어려움에도 굴하지 않음' },
  { id: 's21', chars: '虎視眈眈', reading: '호시탐탐', meaning: '호랑이가 날카로운 눈으로 노려봄. 기회를 노리고 있음' },
  { id: 's22', chars: '九死一生', reading: '구사일생', meaning: '아홉 번 죽을 뻔하고 한 번 살아남. 거의 죽을 뻔한 위기에서 살아남' },
  { id: 's23', chars: '五十步百步', reading: '오십보백보', meaning: '오십 보나 백 보나 마찬가지. 큰 차이가 없음' },
  { id: 's24', chars: '過猶不及', reading: '과유불급', meaning: '지나침은 미치지 못함과 같음. 무엇이든 적당해야 함' },
  { id: 's25', chars: '他山之石', reading: '타산지석', meaning: '다른 산의 돌. 다른 사람의 하찮은 말이나 행동도 자신의 지혜를 닦는 데 도움이 됨' },
  { id: 's26', chars: '前代未聞', reading: '전대미문', meaning: '이전 시대에 들어본 적이 없음. 전에 없던 새로운 일' },
  { id: 's27', chars: '弱肉強食', reading: '약육강식', meaning: '약한 것은 강한 것의 먹이가 됨. 강한 자가 약한 자를 지배함' },
  { id: 's28', chars: '無我之境', reading: '무아지경', meaning: '자기를 잊은 경지. 어떤 일에 몰두하여 자신을 잊음' },
  { id: 's29', chars: '有備無患', reading: '유비무환', meaning: '준비가 있으면 근심이 없음' },
  { id: 's30', chars: '落花流水', reading: '낙화유수', meaning: '떨어지는 꽃과 흐르는 물. 가는 봄의 경치 또는 세력이 약해짐' },
  { id: 's31', chars: '南柯一夢', reading: '남가일몽', meaning: '남쪽 나뭇가지의 한낮 꿈. 헛된 꿈이나 덧없는 영화' },
  { id: 's32', chars: '管鮑之交', reading: '관포지교', meaning: '관중과 포숙아의 사귐. 매우 친밀한 우정' },
  { id: 's33', chars: '背水之陣', reading: '배수지진', meaning: '물을 등지고 진을 침. 목숨을 걸고 싸움' },
  { id: 's34', chars: '三顧草廬', reading: '삼고초려', meaning: '초가집을 세 번 찾아감. 인재를 얻기 위해 참을성 있게 노력함' },
  { id: 's35', chars: '漁父之利', reading: '어부지리', meaning: '어부가 이득을 취함. 둘이 싸우는 사이 제삼자가 이익을 얻음' },
  { id: 's36', chars: '竹馬故友', reading: '죽마고우', meaning: '대나무 말을 타고 놀던 옛 친구. 어릴 때부터의 친한 벗' },
  { id: 's37', chars: '錦上添花', reading: '금상첨화', meaning: '비단 위에 꽃을 더함. 좋은 일 위에 또 좋은 일이 더해짐' },
  { id: 's38', chars: '雪上加霜', reading: '설상가상', meaning: '눈 위에 서리가 더함. 불행 위에 불행이 겹침' },
  { id: 's39', chars: '日就月將', reading: '일취월장', meaning: '날로 달로 나아감. 나날이 발전함' },
  { id: 's40', chars: '杯中蛇影', reading: '배중사영', meaning: '잔 속의 뱀 그림자. 쓸데없는 의심으로 스스로 괴로워함' },
  { id: 's41', chars: '磨斧爲針', reading: '마부위침', meaning: '도끼를 갈아 바늘을 만듦. 아무리 어려운 일도 끈기 있게 노력하면 이룰 수 있음' },
  { id: 's42', chars: '切磋琢磨', reading: '절차탁마', meaning: '자르고 갈고 쪼고 닦음. 학문이나 인격을 갈고닦음' },
  { id: 's43', chars: '風前燈火', reading: '풍전등화', meaning: '바람 앞의 등불. 매우 위태로운 상황' },
  { id: 's44', chars: '無念無想', reading: '무념무상', meaning: '아무런 생각이 없음. 잡념을 버린 경지' },
  { id: 's45', chars: '先見之明', reading: '선견지명', meaning: '앞을 내다보는 밝은 지혜' },
  { id: 's46', chars: '指鹿爲馬', reading: '지록위마', meaning: '사슴을 가리켜 말이라 함. 윗사람의 권세를 이용해 거짓을 참으로 만듦' },
  { id: 's47', chars: '面從腹背', reading: '면종복배', meaning: '겉으로는 따르면서 속으로는 배반함' },
  { id: 's48', chars: '多多益善', reading: '다다익선', meaning: '많으면 많을수록 좋음' },
  { id: 's49', chars: '天方地軸', reading: '천방지축', meaning: '하늘과 땅이 뒤집힘. 몹시 허둥대는 모양' },
  { id: 's50', chars: '言中有骨', reading: '언중유골', meaning: '말 속에 뼈가 있음. 평범한 말 속에 깊은 뜻이 있음' },
  { id: 's51', chars: '一擧兩得', reading: '일거양득', meaning: '한 가지 일로 두 가지 이득을 얻음' },
  { id: 's52', chars: '唯我獨尊', reading: '유아독존', meaning: '오직 나만이 홀로 높음. 세상에서 자기가 가장 잘났다고 여김' },
  { id: 's53', chars: '針小棒大', reading: '침소봉대', meaning: '바늘만한 것을 몽둥이만하게 만듦. 작은 일을 크게 과장함' },
  { id: 's54', chars: '問前成市', reading: '문전성시', meaning: '문 앞이 시장을 이룸. 찾아오는 사람이 매우 많음' },
  { id: 's55', chars: '馬耳東風', reading: '마이동풍', meaning: '말의 귀에 동풍. 남의 말을 귀담아듣지 않음' },
  { id: 's56', chars: '附和雷同', reading: '부화뇌동', meaning: '자기 주견 없이 남의 의견에 따라 행동함' },
  { id: 's57', chars: '右往左往', reading: '우왕좌왕', meaning: '오른쪽 왼쪽으로 왔다 갔다 함. 갈팡질팡하며 어쩔 줄 모름' },
  { id: 's58', chars: '異口同聲', reading: '이구동성', meaning: '다른 입에서 같은 소리. 여러 사람이 한목소리로 같은 말을 함' },
  { id: 's59', chars: '自畵自讚', reading: '자화자찬', meaning: '자기가 그린 그림을 스스로 칭찬함. 자기 자랑' },
  { id: 's60', chars: '心機一轉', reading: '심기일전', meaning: '마음을 새롭게 고쳐먹음. 새로운 각오를 다짐' },
  { id: 's61', chars: '青出於藍', reading: '청출어람', meaning: '푸른색이 쪽에서 나왔으나 쪽보다 더 푸름. 제자가 스승보다 나음' },
  { id: 's62', chars: '表裏不同', reading: '표리부동', meaning: '겉과 속이 같지 않음. 마음이 음흉함' },
  { id: 's63', chars: '螢雪之功', reading: '형설지공', meaning: '반딧불과 눈의 공. 어려운 환경에서 고생하며 공부함' },
  { id: 's64', chars: '卧角殺牛', reading: '교각살우', meaning: '뿔을 바로잡으려다 소를 죽임. 사소한 것을 고치려다 큰 것을 망침' },
  { id: 's65', chars: '同床異夢', reading: '동상이몽', meaning: '같은 자리에서 다른 꿈을 꿈. 겉으로는 같이 하면서 속으로는 다른 생각을 함' },
];

// ─── Constants ──────────────────────────────────────────────────────
const TOTAL_ROUNDS = 20;
const TIMER_SECONDS = 15;
const QUESTION_TYPES: QuestionType[] = ['meaning-to-chars', 'fill-blank', 'chars-to-meaning', 'reading-to-chars'];

// ─── Audio ──────────────────────────────────────────────────────────
function playSound(type: 'correct' | 'wrong' | 'combo' | 'complete') {
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
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.07);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
      case 'wrong':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
      case 'combo': {
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
        return;
      }
      case 'complete': {
        const melody = [523, 659, 784, 880, 1047];
        melody.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.25);
          o.start(ctx.currentTime + i * 0.12);
          o.stop(ctx.currentTime + i * 0.12 + 0.25);
        });
        return;
      }
    }
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not supported
  }
}

// ─── Helpers ────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number, exclude?: T): T[] {
  const filtered = exclude ? arr.filter((x) => x !== exclude) : [...arr];
  return shuffle(filtered).slice(0, n);
}

function getComboMultiplier(combo: number): number {
  if (combo >= 6) return 3;
  if (combo >= 4) return 2.5;
  if (combo >= 3) return 2;
  if (combo >= 2) return 1.5;
  return 1;
}

function generateQuestion(round: number, allData: Sajaseongeo[]): Question {
  const typeIdx = round % QUESTION_TYPES.length;
  const type = QUESTION_TYPES[typeIdx];
  const target = allData[Math.floor(Math.random() * allData.length)];

  switch (type) {
    case 'meaning-to-chars': {
      const distractors = pick(allData, 3, target);
      const options = shuffle([target, ...distractors]);
      return {
        type,
        sajaseongeo: target,
        display: target.meaning,
        options: options.map((s) => s.chars),
        correctIndex: options.indexOf(target),
      };
    }
    case 'fill-blank': {
      const charArr = [...target.chars];
      const blankIdx = Math.floor(Math.random() * charArr.length);
      const correctChar = charArr[blankIdx];
      const allChars = allData.flatMap((s) => [...s.chars]);
      const uniqueChars = [...new Set(allChars)].filter((c) => c !== correctChar);
      const wrongChars = shuffle(uniqueChars).slice(0, 3);
      const optionChars = shuffle([correctChar, ...wrongChars]);
      const displayChars = [...charArr];
      displayChars[blankIdx] = '□';
      return {
        type,
        sajaseongeo: target,
        display: displayChars.join(''),
        options: optionChars,
        correctIndex: optionChars.indexOf(correctChar),
        blankIndex: blankIdx,
      };
    }
    case 'chars-to-meaning': {
      const distractors = pick(allData, 3, target);
      const options = shuffle([target, ...distractors]);
      return {
        type,
        sajaseongeo: target,
        display: target.chars,
        options: options.map((s) => s.meaning.length > 30 ? s.meaning.slice(0, 28) + '...' : s.meaning),
        correctIndex: options.indexOf(target),
      };
    }
    case 'reading-to-chars': {
      const distractors = pick(allData, 3, target);
      const options = shuffle([target, ...distractors]);
      return {
        type,
        sajaseongeo: target,
        display: target.reading,
        options: options.map((s) => s.chars),
        correctIndex: options.indexOf(target),
      };
    }
  }
}

function getTypeLabel(type: QuestionType): string {
  switch (type) {
    case 'meaning-to-chars': return '뜻 → 사자성어';
    case 'fill-blank': return '빈칸 채우기';
    case 'chars-to-meaning': return '사자성어 → 뜻';
    case 'reading-to-chars': return '읽기 → 한자';
  }
}

// ─── Component ──────────────────────────────────────────────────────
export default function SajaseongeoGame() {
  const [phase, setPhase] = useState<GamePhase>('select');
  const [character, setCharacter] = useState<Character | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const usedIdsRef = useRef<Set<string>>(new Set());
  const gameDataRef = useRef<Sajaseongeo[]>(shuffle(SAJASEONGEO_DATA));
  const [scoreSaved, setScoreSaved] = useState(false);

  // Generate next question
  const loadQuestion = useCallback((r: number) => {
    const available = gameDataRef.current.filter((s) => !usedIdsRef.current.has(s.id));
    const pool = available.length >= 4 ? available : gameDataRef.current;
    const q = generateQuestion(r, pool);
    if (q.sajaseongeo) {
      usedIdsRef.current.add(q.sajaseongeo.id);
    }
    setQuestion(q);
    setSelectedIndex(null);
    setShowResult(false);
    setTimer(TIMER_SECONDS);
  }, []);

  // Start game
  const startGame = useCallback((char: Character) => {
    setCharacter(char);
    usedIdsRef.current = new Set();
    gameDataRef.current = shuffle(SAJASEONGEO_DATA);
    setRound(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setScoreSaved(false);
    setPhase('playing');
  }, []);

  // Generate question when round changes during playing
  useEffect(() => {
    if (phase === 'playing' && round < TOTAL_ROUNDS) {
      loadQuestion(round);
    } else if (phase === 'playing' && round >= TOTAL_ROUNDS) {
      setPhase('result');
      playSound('complete');
    }
  }, [phase, round, loadQuestion]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || showResult || !question) return;
    if (timer <= 0) {
      handleAnswer(-1);
      return;
    }
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timer, showResult, question]);

  // Save score on result
  useEffect(() => {
    if (phase === 'result' && character && score > 0 && !scoreSaved) {
      saveScore('sajaseongeo', character.name, score);
      setScoreSaved(true);
    }
  }, [phase, character, score, scoreSaved]);

  // Handle answer
  const handleAnswer = useCallback((index: number) => {
    if (showResult || !question) return;
    setSelectedIndex(index);
    setShowResult(true);

    const isCorrect = index === question.correctIndex;
    if (isCorrect) {
      const newCombo = combo + 1;
      const multiplier = getComboMultiplier(newCombo);
      const points = Math.round(100 * multiplier);
      setScore((s) => s + points);
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setCorrectCount((c) => c + 1);
      if (newCombo >= 3) {
        playSound('combo');
      } else {
        playSound('correct');
      }
    } else {
      setCombo(0);
      playSound('wrong');
    }

  }, [showResult, question, combo]);

  const goNext = useCallback(() => {
    setRound((r) => r + 1);
  }, []);

  // ─── Render: Character Select ─────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📜</div>
            <h1 className="text-3xl font-bold text-yellow-300 mb-2"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
              사자성어 퀴즈
            </h1>
            <p className="text-red-200 text-sm">四字成語 - 네 글자에 담긴 지혜</p>
          </div>

          <p className="text-center text-yellow-200 mb-6 text-lg font-medium">
            캐릭터를 선택하세요
          </p>

          <div className="grid grid-cols-2 gap-4">
            {characters.map((char) => (
              <button
                key={char.name}
                onClick={() => startGame(char)}
                className="bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6
                           hover:bg-white/20 hover:border-yellow-400/50 hover:scale-105
                           active:scale-95 transition-all duration-200"
              >
                <div className="text-5xl mb-3">{char.emoji}</div>
                <div className="text-xl font-bold text-white">{char.name}</div>
                <div className="w-8 h-1 rounded-full mx-auto mt-2"
                     style={{ backgroundColor: char.color }} />
              </button>
            ))}
          </div>

          <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-4 text-sm text-red-100">
            <p className="font-bold text-yellow-300 mb-2">게임 방법</p>
            <ul className="space-y-1">
              <li>- 총 {TOTAL_ROUNDS}문제의 사자성어 퀴즈</li>
              <li>- 문제당 {TIMER_SECONDS}초 제한시간</li>
              <li>- 연속 정답 시 콤보 보너스!</li>
              <li>- 뜻, 빈칸, 읽기 등 다양한 유형</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Playing ──────────────────────────────────────────────
  if (phase === 'playing' && question && character) {
    const isCorrect = selectedIndex === question.correctIndex;
    const timerPercent = (timer / TIMER_SECONDS) * 100;
    const timerColor = timer <= 3 ? 'bg-red-400' : timer <= 7 ? 'bg-yellow-400' : 'bg-green-400';
    const multiplier = getComboMultiplier(combo);

    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-red-900 p-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{character.emoji}</span>
              <span className="text-white font-bold">{character.name}</span>
            </div>
            <div className="text-yellow-300 font-bold text-lg">{score}점</div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-red-200 mb-1">
              <span>라운드 {round + 1} / {TOTAL_ROUNDS}</span>
              <span>{getTypeLabel(question.type)}</span>
            </div>
            <div className="w-full h-2 bg-red-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                style={{ width: `${((round + 1) / TOTAL_ROUNDS) * 100}%` }}
              />
            </div>
          </div>

          {/* Timer bar */}
          <div className="mb-4">
            <div className="w-full h-2 bg-red-950 rounded-full overflow-hidden">
              <div
                className={`h-full ${timerColor} rounded-full transition-all duration-1000`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
            <div className="text-right text-xs text-red-200 mt-1">
              {timer <= 5 && (
                <span className={`font-bold ${timer <= 3 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}>
                  {timer}초
                </span>
              )}
              {timer > 5 && <span>{timer}초</span>}
            </div>
          </div>

          {/* Combo indicator */}
          {combo >= 2 && (
            <div className="text-center mb-3 animate-bounce">
              <span className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-red-900
                               font-bold px-4 py-1 rounded-full text-sm shadow-lg">
                {combo} 콤보! x{multiplier}
              </span>
            </div>
          )}

          {/* Question display */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-white/10">
            <div className="text-center">
              {(question.type === 'meaning-to-chars') && (
                <div>
                  <p className="text-yellow-300 text-xs mb-3 font-medium">다음 뜻에 해당하는 사자성어는?</p>
                  <p className="text-white text-lg leading-relaxed">{question.display}</p>
                </div>
              )}

              {(question.type === 'fill-blank') && (
                <div>
                  <p className="text-yellow-300 text-xs mb-4 font-medium">빈칸에 들어갈 한자는?</p>
                  <div className="flex justify-center gap-2">
                    {[...question.display].map((ch, i) => (
                      <div
                        key={i}
                        className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold
                          ${ch === '□'
                            ? 'bg-yellow-400/30 border-2 border-yellow-400 border-dashed text-yellow-300 animate-pulse'
                            : 'bg-white/15 border border-white/20 text-white'
                          }`}
                      >
                        {ch === '□' ? '?' : ch}
                      </div>
                    ))}
                  </div>
                  <p className="text-red-200 text-sm mt-3">({question.sajaseongeo.reading})</p>
                </div>
              )}

              {(question.type === 'chars-to-meaning') && (
                <div>
                  <p className="text-yellow-300 text-xs mb-4 font-medium">다음 사자성어의 뜻은?</p>
                  <div className="flex justify-center gap-2 mb-2">
                    {[...question.display].map((ch, i) => (
                      <div
                        key={i}
                        className="w-14 h-14 bg-white/15 border border-white/20 rounded-lg
                                   flex items-center justify-center text-xl font-bold text-white"
                      >
                        {ch}
                      </div>
                    ))}
                  </div>
                  <p className="text-red-200 text-sm">({question.sajaseongeo.reading})</p>
                </div>
              )}

              {(question.type === 'reading-to-chars') && (
                <div>
                  <p className="text-yellow-300 text-xs mb-3 font-medium">다음 읽기에 해당하는 한자는?</p>
                  <p className="text-white text-3xl font-bold tracking-widest">{question.display}</p>
                </div>
              )}
            </div>
          </div>

          {/* Answer buttons */}
          <div className="space-y-3">
            {question.options.map((opt, i) => {
              let btnClass = 'bg-white/10 border-white/20 text-white hover:bg-white/20';
              if (showResult) {
                if (i === question.correctIndex) {
                  btnClass = 'bg-green-500/30 border-green-400 text-green-200';
                } else if (i === selectedIndex && !isCorrect) {
                  btnClass = 'bg-red-500/30 border-red-400 text-red-200';
                } else {
                  btnClass = 'bg-white/5 border-white/10 text-white/40';
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showResult}
                  className={`w-full border rounded-xl p-3.5 text-left transition-all duration-200
                    ${btnClass}
                    ${!showResult ? 'active:scale-[0.98]' : ''}
                    ${question.type === 'chars-to-meaning' ? 'text-sm leading-relaxed' : 'text-base'}
                  `}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center
                                     justify-center text-xs font-bold text-yellow-300">
                      {i + 1}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {showResult && i === question.correctIndex && (
                      <span className="text-green-400 text-lg">&#10003;</span>
                    )}
                    {showResult && i === selectedIndex && !isCorrect && (
                      <span className="text-red-400 text-lg">&#10007;</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Explanation after answer */}
          {showResult && (
            <div className={`mt-4 rounded-xl p-4 border text-sm
              ${isCorrect
                ? 'bg-green-900/30 border-green-500/30 text-green-200'
                : 'bg-red-900/30 border-red-500/30 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{isCorrect ? '⭕' : '❌'}</span>
                <span className="font-bold">
                  {isCorrect
                    ? `정답! +${Math.round(100 * getComboMultiplier(combo))}점`
                    : selectedIndex === -1 ? '시간 초과!' : '오답!'}
                </span>
              </div>
              <div className="space-y-1">
                <p>
                  <span className="text-yellow-300 font-bold">{question.sajaseongeo.chars}</span>
                  <span className="text-white/60 ml-2">({question.sajaseongeo.reading})</span>
                </p>
                <p className="text-white/70">{question.sajaseongeo.meaning}</p>
              </div>

              <button
                onClick={goNext}
                className="mt-4 w-full bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold
                           py-3 rounded-xl transition-all active:scale-[0.98] text-base"
              >
                {round + 1 < TOTAL_ROUNDS ? '다음 문제 →' : '결과 보기 →'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Result ───────────────────────────────────────────────
  if (phase === 'result' && character) {
    const accuracy = Math.round((correctCount / TOTAL_ROUNDS) * 100);
    const grade =
      accuracy >= 90 ? '사자성어 달인' :
      accuracy >= 70 ? '사자성어 학자' :
      accuracy >= 50 ? '사자성어 수련생' : '사자성어 입문자';
    const gradeEmoji =
      accuracy >= 90 ? '🏆' :
      accuracy >= 70 ? '📚' :
      accuracy >= 50 ? '📖' : '🌱';

    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-2">{gradeEmoji}</div>
            <h2 className="text-2xl font-bold text-yellow-300 mb-1">퀴즈 완료!</h2>
            <p className="text-red-200">{character.emoji} {character.name}의 성적표</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-6">
            <div className="text-center mb-4">
              <p className="text-yellow-400 text-4xl font-bold">{score}<span className="text-xl">점</span></p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-red-200 text-xs mb-1">정답률</p>
                <p className="text-white font-bold text-lg">{accuracy}%</p>
                <p className="text-red-300 text-xs">{correctCount}/{TOTAL_ROUNDS}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-red-200 text-xs mb-1">최고 콤보</p>
                <p className="text-white font-bold text-lg">{maxCombo}</p>
                <p className="text-red-300 text-xs">연속 정답</p>
              </div>
            </div>

            <div className="text-center bg-white/5 rounded-xl p-3">
              <p className="text-red-200 text-xs mb-1">등급</p>
              <p className="text-yellow-300 font-bold text-lg">{grade}</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => startGame(character)}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold
                         py-3.5 rounded-xl transition-all active:scale-[0.98] text-lg"
            >
              다시 도전하기
            </button>
            <button
              onClick={() => {
                setPhase('select');
                setCharacter(null);
              }}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-medium
                         py-3 rounded-xl border border-white/20 transition-all active:scale-[0.98]"
            >
              캐릭터 다시 선택
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-white/5 hover:bg-white/10 text-red-200
                         py-2.5 rounded-xl transition-all text-sm"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading fallback ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-red-900 flex items-center justify-center">
      <div className="text-yellow-300 text-xl animate-pulse">로딩 중...</div>
    </div>
  );
}
