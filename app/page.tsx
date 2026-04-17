import Link from "next/link";

const games = [
  {
    name: "점프점프",
    description: "폴짝폴짝! 하늘까지 올라가자~ 🌙",
    href: "/games/jump",
    emoji: "🐰",
    color: "from-purple-200 to-pink-200",
    shadow: "shadow-purple-100",
  },
  {
    name: "캐릭터 달리기",
    description: "냥냥~ 장애물을 훌쩍 넘어라! 🍀",
    href: "/games/runner",
    emoji: "🐱",
    color: "from-blue-200 to-cyan-200",
    shadow: "shadow-blue-100",
  },
  {
    name: "짝맞추기",
    description: "어디 있을까? 짝꿍을 찾아줘! 🌸",
    href: "/games/match",
    emoji: "🐻",
    color: "from-pink-200 to-rose-200",
    shadow: "shadow-pink-100",
  },
  {
    name: "퀴즈 대결",
    description: "오! 정답은 뭘까? 같이 맞혀봐~ 💡",
    href: "/games/quiz",
    emoji: "🦊",
    color: "from-amber-200 to-orange-200",
    shadow: "shadow-amber-100",
  },
  {
    name: "꾸미기",
    description: "반짝반짝~ 나만의 스타일로 꾸며봐! 🎀",
    href: "/games/dress",
    emoji: "🐼",
    color: "from-green-200 to-emerald-200",
    shadow: "shadow-green-100",
  },
];

const characters = [
  { name: "수현", emoji: "😎", color: "bg-purple-300", desc: "용감한 리더!" },
  { name: "이현", emoji: "👸", color: "bg-pink-300", desc: "핑크 공주님!" },
  { name: "은영", emoji: "🥰", color: "bg-pink-300", desc: "다정한 힐러!" },
  { name: "민구", emoji: "😜", color: "bg-green-300", desc: "장난꾸러기!" },
];

const decorations = [
  { symbol: "⭐", top: "6%", left: "5%", delay: "0s", size: "text-lg" },
  { symbol: "💛", top: "10%", left: "85%", delay: "0.4s", size: "text-base" },
  { symbol: "🌸", top: "22%", left: "92%", delay: "0.8s", size: "text-sm" },
  { symbol: "✨", top: "35%", left: "3%", delay: "1.2s", size: "text-base" },
  { symbol: "💜", top: "55%", left: "90%", delay: "0.6s", size: "text-sm" },
  { symbol: "🌟", top: "70%", left: "6%", delay: "1.0s", size: "text-lg" },
  { symbol: "💕", top: "80%", left: "88%", delay: "0.2s", size: "text-base" },
  { symbol: "🍭", top: "90%", left: "12%", delay: "1.4s", size: "text-sm" },
];

export default function Home() {
  return (
    <>
      <style>{`
        @keyframes bounce-title {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }
        @keyframes float-char {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.05); }
        }
        @keyframes float-deco {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
          50% { transform: translateY(-10px) rotate(15deg); opacity: 1; }
        }
        @keyframes shimmer-card {
          0%, 100% { box-shadow: 0 4px 20px rgba(200, 180, 255, 0.25); }
          50% { box-shadow: 0 6px 28px rgba(200, 180, 255, 0.45); }
        }
        .title-bounce {
          animation: bounce-title 2.4s ease-in-out infinite;
          display: inline-block;
        }
        .char-float {
          animation: float-char 2s ease-in-out infinite;
        }
        .char-float:nth-child(2) { animation-delay: 0.3s; }
        .char-float:nth-child(3) { animation-delay: 0.6s; }
        .char-float:nth-child(4) { animation-delay: 0.9s; }
        .deco-float {
          animation: float-deco 3s ease-in-out infinite;
          position: fixed;
          pointer-events: none;
          user-select: none;
          z-index: 0;
        }
      `}</style>

      {/* Decorative floating elements */}
      {decorations.map((d, i) => (
        <span
          key={i}
          className={`deco-float ${d.size}`}
          style={{ top: d.top, left: d.left, animationDelay: d.delay }}
        >
          {d.symbol}
        </span>
      ))}

      <div className="min-h-screen flex flex-col items-center px-4 py-6 relative z-10">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-purple-600 mb-1 tracking-tight">
            <span className="title-bounce inline-block">🎮 미니게임 월드</span>
          </h1>
          <p className="text-sm font-semibold text-pink-400 mt-1">
            함께 놀자! 🌈
          </p>
          <p className="text-xs text-purple-400 mt-0.5">
            우리들의 신나는 게임 모음~! 🎵
          </p>
        </div>

        {/* Characters */}
        <div className="flex gap-4 mb-7">
          {characters.map((char, i) => (
            <div
              key={char.name}
              className="flex flex-col items-center char-float"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <div
                className={`w-14 h-14 ${char.color} rounded-full flex items-center justify-center text-2xl shadow-md border-2 border-white`}
              >
                {char.emoji}
              </div>
              <span className="text-xs font-bold text-gray-600 mt-1">
                {char.name}
              </span>
              <span className="text-[9px] text-gray-400">{char.desc}</span>
            </div>
          ))}
        </div>

        {/* Game Cards */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          {games.map((game) => (
            <Link
              key={game.name}
              href={game.href}
              className={`block rounded-3xl bg-gradient-to-r ${game.color} p-4 shadow-lg ${game.shadow}
                border border-white/60
                transform transition-all duration-200 active:scale-95 hover:scale-[1.03] hover:shadow-xl`}
            >
              <div className="flex items-center gap-3">
                <span className="text-4xl drop-shadow-sm">{game.emoji}</span>
                <div className="flex-1">
                  <h2 className="text-base font-extrabold text-gray-700 leading-tight">
                    {game.name}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {game.description}
                  </p>
                </div>
                <span className="text-lg text-gray-400/70">▶</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-purple-300">
          <p className="font-semibold text-purple-400">
            수현 · 이현 · 은영 · 민구
          </p>
          <p className="mt-0.5">💜💙💗💚</p>
          <p className="mt-1 text-[10px] text-pink-300">
            오늘도 신나게 놀아요~! 🌟
          </p>
        </div>
      </div>
    </>
  );
}
