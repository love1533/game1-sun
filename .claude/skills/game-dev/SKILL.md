---
name: game-dev
description: "Next.js/React 기반 한자 학습 게임을 개발하는 스킬. 한자 퀴즈, 한자 쓰기, 한자 매칭 등 한자 학습 게임을 React 컴포넌트로 구현. 게임 만들기, 게임 개발, 한자 게임, 새 게임 추가 요청 시 사용. 게임 수정, 업데이트, 난이도 조절, 한자 데이터 추가 시에도 사용."
---

# Game Development Skill

Next.js App Router 프로젝트에서 한자 학습 게임을 React 컴포넌트로 구현한다.

## 프로젝트 구조

```
app/
├── page.tsx              # 메인 허브 (게임 선택)
├── layout.tsx            # 공통 레이아웃
├── globals.css           # Tailwind + 글로벌 스타일
├── ranking/page.tsx      # 랭킹 페이지
└── games/
    └── hanja/
        ├── page.tsx      # 한자왕 게임
        └── data.ts       # 한자 데이터 (8급~1급)
lib/
├── firebase.ts           # Firebase 설정
└── ranking.ts            # 랭킹 시스템
```

## 캐릭터 정보
- **용진**: 🐉 드래곤 테마
- **용정**: 🌟 별 테마

## 게임 구현 패턴

각 게임 페이지는 다음 구조를 따른다:

```tsx
'use client';
import { useRef, useEffect, useState, useCallback } from 'react';

export default function GamePage() {
  // 게임 상태 관리
  // 한자 데이터 로드
  // 퀴즈/학습 로직
  // 점수 계산 및 랭킹 저장
}
```

## 한자 데이터 구조

```ts
interface HanjaChar {
  char: string;      // 한자
  meaning: string;   // 뜻
  reading: string;   // 음
  level: number;     // 급수 (8~1)
  examples?: { word: string; meaning: string }[];
}
```

## 모바일 최적화 필수사항

1. 반응형 레이아웃
2. 터치 이벤트 처리
3. viewport 설정
4. 스크롤 방지 (게임 중)
5. 더블탭 줌 방지

## 효과음 (Web Audio API)

```tsx
const playSound = (freq: number, duration: number) => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.frequency.value = freq;
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
};
```
