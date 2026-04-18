'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { saveScore } from '@/lib/ranking';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHARACTERS = [
  { name: '승민', color: '#3B82F6', emoji: '🤖', heart: '💙', role: '리더' },
  { name: '건우', color: '#10B981', emoji: '🩺', heart: '💚', role: '선봉' },
  { name: '강우', color: '#F59E0B', emoji: '👨‍🍳', heart: '🧡', role: '해결사' },
];

const PLAYER_RADIUS = 16;
const PLAYER_SPEED = 4.5;
const NEIGHBOR_RADIUS = 18;
const INTERACT_RANGE = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Wall { x: number; y: number; w: number; h: number; }
interface Obj {
  id: string; x: number; y: number; w: number; h: number;
  type: 'item' | 'door' | 'npc' | 'lever' | 'book';
  emoji: string; label?: string;
  collected?: boolean; active?: boolean; order?: number;
}
interface Neighbor {
  x: number; y: number;
  patrolX1: number; patrolX2: number; patrolY: number;
  dir: number; speed: number; angle: number;
}
interface RoomData {
  width: number; height: number;
  bgColor: string;
  walls: Wall[];
  objects: Obj[];
  neighbor?: Neighbor;
  spawnX: number; spawnY: number;
}
interface GameState {
  screen: 'select' | 'playing' | 'caught' | 'victory';
  stage: number;
  charIdx: number;
  playerX: number; playerY: number;
  playerBounce: number;
  moving: boolean;
  visRadius: number;
  inventory: string[];
  elapsed: number;
  uncaughtStages: number;
  dialog: string;
  dialogTimer: number;
  nearObj: string | null;
  // Stage 1
  hasFlashlight: boolean;
  noteRead: boolean;
  keypadOpen: boolean;
  stage1Done: boolean;
  // Stage 2
  stage2Parts: number;
  rescuedSuhyeon: boolean;
  suhyeonX: number; suhyeonY: number;
  // Stage 3
  bookOrder: string[];
  rescuedIhyeon: boolean;
  ihyeonX: number; ihyeonY: number;
  // Stage 4
  levers: boolean[];
  leverTimer: number;
  lightPos: number;
  lightDir: number;
  stage4Timer: number;
  stage4Failed: boolean;
}

// ─── Room Definitions ────────────────────────────────────────────────────────

function makeRoom1(): RoomData {
  const W = 520, H = 380;
  return {
    width: W, height: H, bgColor: '#1a1035',
    walls: [
      { x: 0, y: 0, w: W, h: 20 },         // top - will have door gap
      { x: 0, y: H - 20, w: W, h: 20 },    // bottom
      { x: 0, y: 0, w: 20, h: H },          // left
      { x: W - 20, y: 0, w: 20, h: H },     // right
      // door frame (locked) - gap in top wall handled in draw
    ],
    objects: [
      { id: 'flashlight', x: 80, y: 80, w: 32, h: 32, type: 'item', emoji: '🔦', label: '손전등' },
      { id: 'note', x: 240, y: 175, w: 36, h: 36, type: 'item', emoji: '📝', label: '쪽지' },
      { id: 'door1', x: 230, y: 5, w: 60, h: 30, type: 'door', emoji: '🚪', label: '잠긴 문' },
      // furniture (no interact)
      { id: 'shelf', x: 50, y: 50, w: 80, h: 50, type: 'item', emoji: '🗄️', label: '', collected: true },
      { id: 'table', x: 200, y: 155, w: 100, h: 70, type: 'item', emoji: '🪑', label: '', collected: true },
      { id: 'counter', x: 390, y: 80, w: 90, h: 50, type: 'item', emoji: '🍳', label: '', collected: true },
    ],
    spawnX: W / 2, spawnY: H - 60,
  };
}

function makeRoom2(): RoomData {
  const W = 560, H = 440;
  return {
    width: W, height: H, bgColor: '#0a1a0f',
    walls: [
      { x: 0, y: 0, w: W, h: 20 },
      { x: 0, y: H - 20, w: W, h: 20 },
      { x: 0, y: 0, w: 20, h: H },
      { x: W - 20, y: 0, w: 20, h: H },
      // lab tables as walls
      { x: 100, y: 100, w: 100, h: 30 },
      { x: 350, y: 100, w: 100, h: 30 },
      { x: 100, y: 300, w: 100, h: 30 },
      { x: 350, y: 300, w: 100, h: 30 },
    ],
    objects: [
      { id: 'part1', x: 60, y: 60, w: 28, h: 28, type: 'item', emoji: '⚙️', label: '부품1' },
      { id: 'part2', x: 460, y: 360, w: 28, h: 28, type: 'item', emoji: '🔋', label: '부품2' },
      { id: 'part3', x: 460, y: 60, w: 28, h: 28, type: 'item', emoji: '💡', label: '부품3' },
      { id: 'suhyeon', x: W / 2 - 15, y: H / 2 - 15, w: 30, h: 30, type: 'npc', emoji: '💃', label: '수현' },
    ],
    neighbor: { x: 280, y: 200, patrolX1: 50, patrolX2: W - 50, patrolY: 200, dir: 1, speed: 1.8, angle: 0 },
    spawnX: 60, spawnY: H - 60,
  };
}

function makeRoom3(): RoomData {
  const W = 540, H = 420;
  return {
    width: W, height: H, bgColor: '#1a100a',
    walls: [
      { x: 0, y: 0, w: W, h: 20 },
      { x: 0, y: H - 20, w: W, h: 20 },
      { x: 0, y: 0, w: 20, h: H },
      { x: W - 20, y: 0, w: 20, h: H },
      // bookshelf corridors
      { x: 100, y: 60, w: 20, h: 120 },
      { x: 200, y: 60, w: 20, h: 120 },
      { x: 300, y: 60, w: 20, h: 120 },
      { x: 100, y: 240, w: 20, h: 120 },
      { x: 200, y: 240, w: 20, h: 120 },
      { x: 300, y: 240, w: 20, h: 120 },
      { x: 420, y: 60, w: 20, h: 130 },
      { x: 420, y: 240, w: 20, h: 130 },
    ],
    objects: [
      { id: 'clue', x: 50, y: 170, w: 40, h: 40, type: 'item', emoji: '🖼️', label: '단서' },
      { id: 'redbook', x: 110, y: 80, w: 24, h: 40, type: 'book', emoji: '📕', label: '빨간 책', order: 0 },
      { id: 'bluebook', x: 210, y: 80, w: 24, h: 40, type: 'book', emoji: '📘', label: '파란 책', order: 1 },
      { id: 'greenbook', x: 310, y: 80, w: 24, h: 40, type: 'book', emoji: '📗', label: '초록 책', order: 2 },
      { id: 'ihyeon', x: W - 70, y: H / 2 - 15, w: 30, h: 30, type: 'npc', emoji: '👸', label: '이현' },
    ],
    neighbor: { x: 280, y: 250, patrolX1: 50, patrolX2: W - 50, patrolY: 250, dir: 1, speed: 2.5, angle: 0 },
    spawnX: 60, spawnY: H - 60,
  };
}

function makeRoom4(): RoomData {
  const W = 560, H = 400;
  return {
    width: W, height: H, bgColor: '#0d0d1a',
    walls: [
      { x: 0, y: 0, w: W, h: 20 },
      { x: 0, y: H - 20, w: W, h: 20 },
      { x: 0, y: 0, w: 20, h: H },
      { x: W - 20, y: 0, w: 20, h: H },
    ],
    objects: [
      { id: 'lever0', x: 80, y: 60, w: 30, h: 50, type: 'lever', emoji: '🔧', label: '레버1' },
      { id: 'lever1', x: 180, y: 60, w: 30, h: 50, type: 'lever', emoji: '🔧', label: '레버2' },
      { id: 'lever2', x: 280, y: 60, w: 30, h: 50, type: 'lever', emoji: '🔧', label: '레버3' },
      { id: 'lever3', x: 380, y: 60, w: 30, h: 50, type: 'lever', emoji: '🔧', label: '레버4' },
      { id: 'lever4', x: 480, y: 60, w: 30, h: 50, type: 'lever', emoji: '🔧', label: '레버5' },
      { id: 'exit', x: W / 2 - 40, y: 5, w: 80, h: 30, type: 'door', emoji: '🚪', label: '탈출구' },
    ],
    spawnX: W / 2, spawnY: H - 60,
  };
}

const ROOMS: RoomData[] = [makeRoom1(), makeRoom2(), makeRoom3(), makeRoom4()];

// ─── Collision ────────────────────────────────────────────────────────────────

function collides(px: number, py: number, pr: number, w: Wall): boolean {
  const cx = Math.max(w.x, Math.min(px, w.x + w.w));
  const cy = Math.max(w.y, Math.min(py, w.y + w.h));
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy < pr * pr;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function objCenter(o: Obj): { x: number; y: number } {
  return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function createAudio() {
  if (typeof window === 'undefined') return null;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const beep = (freq: number, dur: number, vol = 0.15, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    };
    return {
      pickup: () => { beep(880, 0.1); setTimeout(() => beep(1200, 0.15), 80); },
      alarm: () => { beep(200, 0.3, 0.3, 'sawtooth'); setTimeout(() => beep(150, 0.4, 0.3, 'sawtooth'), 200); },
      door: () => { beep(300, 0.3, 0.1, 'triangle'); setTimeout(() => beep(250, 0.3, 0.1, 'triangle'), 150); },
      victory: () => {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.3, 0.2), i * 150));
      },
      step: () => beep(80 + Math.random() * 20, 0.05, 0.04, 'square'),
    };
  } catch { return null; }
}

// ─── Initial State ────────────────────────────────────────────────────────────

function initState(charIdx: number): GameState {
  const room = ROOMS[0];
  return {
    screen: 'playing', stage: 1, charIdx,
    playerX: room.spawnX, playerY: room.spawnY,
    playerBounce: 0, moving: false,
    visRadius: 150, inventory: [],
    elapsed: 0, uncaughtStages: 0,
    dialog: '거실에 갇혔다! 탐색해보자.', dialogTimer: 180,
    nearObj: null,
    hasFlashlight: false, noteRead: false, keypadOpen: false, stage1Done: false,
    stage2Parts: 0, rescuedSuhyeon: false, suhyeonX: 300, suhyeonY: 240,
    bookOrder: [], rescuedIhyeon: false, ihyeonX: 480, ihyeonY: 200,
    levers: [false, false, false, false, false],
    leverTimer: 0, lightPos: 80, lightDir: 1, stage4Timer: 60,
    stage4Failed: false,
  };
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EscapePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const inputRef = useRef({ x: 0, y: 0, interact: false });
  const keysRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<ReturnType<typeof createAudio>>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stepTimerRef = useRef(0);
  const joystickRef = useRef<{ active: boolean; startX: number; startY: number; curX: number; curY: number }>({
    active: false, startX: 0, startY: 0, curX: 0, curY: 0,
  });
  const interactPressedRef = useRef(false);
  const [uiScreen, setUiScreen] = useState<'select' | 'playing'>('select');
  const [selectedChar, setSelectedChar] = useState(0);

  // Neighbor state (mutable, per-stage)
  const neighborRef = useRef<Neighbor | null>(null);
  // Room objects (mutable copy)
  const roomObjsRef = useRef<Obj[]>([]);

  const startGame = useCallback((charIdx: number) => {
    const s = initState(charIdx);
    stateRef.current = s;
    roomObjsRef.current = ROOMS[0].objects.map(o => ({ ...o }));
    const nb = ROOMS[0].neighbor;
    neighborRef.current = nb ? { ...nb } : null;
    audioRef.current = createAudio();
    setUiScreen('playing');
  }, []);

  const loadStage = useCallback((stage: number) => {
    const s = stateRef.current!;
    const room = ROOMS[stage - 1];
    s.playerX = room.spawnX;
    s.playerY = room.spawnY;
    s.playerBounce = 0;
    s.moving = false;
    roomObjsRef.current = room.objects.map(o => ({ ...o }));
    const nb = room.neighbor;
    neighborRef.current = nb ? { ...nb } : null;

    if (stage === 1) s.dialog = '거실에 갇혔다! 탐색해보자.';
    else if (stage === 2) s.dialog = '실험실! 수현이가 갇혀있다. 부품 3개를 찾아라!';
    else if (stage === 3) s.dialog = '도서관! 이현이를 구해라. 올바른 순서로 책을 당겨라.';
    else if (stage === 4) s.dialog = '박사님: 나도 갇혀있어! 레버 5개를 전부 눌러서 탈출하자!';
    s.dialogTimer = 240;
  }, []);

  // ── Game Logic ──────────────────────────────────────────────────────────────

  const handleInteract = useCallback(() => {
    const s = stateRef.current!;
    if (!s || s.screen !== 'playing') return;
    const room = ROOMS[s.stage - 1];
    const objs = roomObjsRef.current;

    // Find nearest interactable object
    let nearest: Obj | null = null;
    let nearDist = INTERACT_RANGE;
    for (const obj of objs) {
      if (obj.collected) continue;
      const c = objCenter(obj);
      const d = dist(s.playerX, s.playerY, c.x, c.y);
      if (d < nearDist) { nearDist = d; nearest = obj; }
    }

    if (!nearest) return;
    const audio = audioRef.current;

    // Stage 1 logic
    if (s.stage === 1) {
      if (nearest.id === 'flashlight') {
        nearest.collected = true;
        s.hasFlashlight = true;
        s.visRadius = 300;
        s.inventory.push('🔦');
        s.dialog = '손전등을 주웠다! 이제 더 잘 보인다.';
        s.dialogTimer = 180;
        audio?.pickup();
      } else if (nearest.id === 'note' && s.hasFlashlight) {
        nearest.collected = true;
        s.noteRead = true;
        s.inventory.push('📝');
        s.dialog = '📝 쪽지: 🐱=1 ⭐=3 🌙=7 → 암호: 137';
        s.dialogTimer = 240;
        audio?.pickup();
      } else if (nearest.id === 'note') {
        s.dialog = '어두워서 잘 안 보인다. 먼저 불빛을 찾자!';
        s.dialogTimer = 150;
      } else if (nearest.id === 'door1' && s.noteRead) {
        s.stage1Done = true;
        s.dialog = '137! 맞아! 문이 열렸다!';
        s.dialogTimer = 180;
        audio?.door();
        nearest.collected = true;
        s.uncaughtStages++;
        setTimeout(() => {
          const gs = stateRef.current!;
          gs.stage = 2;
          loadStage(2);
        }, 1200);
      } else if (nearest.id === 'door1') {
        s.dialog = '잠겨있다. 암호가 필요하다... 쪽지를 찾아보자!';
        s.dialogTimer = 150;
      }
    }

    // Stage 2 logic
    else if (s.stage === 2) {
      if (nearest.id === 'part1' || nearest.id === 'part2' || nearest.id === 'part3') {
        nearest.collected = true;
        s.stage2Parts++;
        s.inventory.push(nearest.emoji);
        s.dialog = `부품 획득! (${s.stage2Parts}/3)`;
        s.dialogTimer = 120;
        audio?.pickup();
      } else if (nearest.id === 'suhyeon' && s.stage2Parts >= 3) {
        nearest.collected = true;
        s.rescuedSuhyeon = true;
        s.suhyeonX = s.playerX + 30;
        s.suhyeonY = s.playerY;
        s.dialog = '수현: 고마워! 같이 탈출하자!';
        s.dialogTimer = 200;
        audio?.pickup();
        s.uncaughtStages++;
        setTimeout(() => {
          const gs = stateRef.current!;
          gs.stage = 3;
          loadStage(3);
        }, 1500);
      } else if (nearest.id === 'suhyeon') {
        s.dialog = '수현: 기계를 꺼줘! 부품 3개가 필요해!';
        s.dialogTimer = 150;
      }
    }

    // Stage 3 logic
    else if (s.stage === 3) {
      if (nearest.id === 'clue') {
        nearest.collected = true;
        s.dialog = '단서: 🔴→🔵→🟢 순서로 책을 당겨라!';
        s.dialogTimer = 200;
        audio?.pickup();
      } else if (nearest.type === 'book') {
        const correctOrder = ['redbook', 'bluebook', 'greenbook'];
        const expected = correctOrder[s.bookOrder.length];
        if (nearest.id === expected) {
          s.bookOrder.push(nearest.id);
          nearest.active = true;
          s.dialog = `📚 책 당김! (${s.bookOrder.length}/3)`;
          s.dialogTimer = 120;
          audio?.pickup();
          if (s.bookOrder.length === 3) {
            // books pulled correctly → rescue ihyeon
            const ihObj = roomObjsRef.current.find(o => o.id === 'ihyeon');
            if (ihObj) ihObj.active = true;
            s.dialog = '이현: 고마워!! 우린 거의 다 됐어!';
            s.dialogTimer = 180;
          }
        } else {
          s.dialog = '순서가 틀렸다! 단서를 다시 확인해보자.';
          s.dialogTimer = 150;
          s.bookOrder = [];
          roomObjsRef.current.filter(o => o.type === 'book').forEach(o => { o.active = false; });
        }
      } else if (nearest.id === 'ihyeon' && s.bookOrder.length === 3) {
        nearest.collected = true;
        s.rescuedIhyeon = true;
        s.ihyeonX = s.playerX + 30;
        s.ihyeonY = s.playerY;
        s.dialog = '이현 구출 완료!';
        s.dialogTimer = 180;
        s.uncaughtStages++;
        setTimeout(() => {
          const gs = stateRef.current!;
          gs.stage = 4;
          loadStage(4);
        }, 1500);
      }
    }

    // Stage 4 logic
    else if (s.stage === 4) {
      if (nearest.type === 'lever') {
        const idx = parseInt(nearest.id.replace('lever', ''));
        const leverObjs = [80, 180, 280, 380, 480];
        const lightCenter = s.lightPos;
        const leverCenter = leverObjs[idx] + 15;
        if (Math.abs(lightCenter - leverCenter) < 40 && !s.levers[idx]) {
          s.levers[idx] = true;
          nearest.active = true;
          const count = s.levers.filter(Boolean).length;
          s.dialog = `레버 작동! (${count}/5)`;
          s.dialogTimer = 120;
          audio?.pickup();
          if (s.levers.every(Boolean)) {
            s.dialog = '모든 레버 완료! 탈출구가 열렸다!';
            s.dialogTimer = 200;
            audio?.door();
            // open exit
            const exitObj = roomObjsRef.current.find(o => o.id === 'exit');
            if (exitObj) exitObj.active = true;
          }
        } else if (s.levers[idx]) {
          s.dialog = '이미 작동됐다!';
          s.dialogTimer = 100;
        } else {
          s.dialog = '빛이 레버를 비출 때 눌러라!';
          s.dialogTimer = 120;
        }
      } else if (nearest.id === 'exit' && s.levers.every(Boolean)) {
        // VICTORY!
        const score = Math.max(0, 10000 - Math.floor(s.elapsed) * 10) + s.uncaughtStages * 500;
        saveScore('escape', CHARACTERS[s.charIdx].name, score);
        s.screen = 'victory';
        audio?.victory();
      }
    }
  }, [loadStage]);

  // ── Main Loop ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (uiScreen !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === 'e' || e.key === 'E') {
        if (!interactPressedRef.current) {
          interactPressedRef.current = true;
          handleInteract();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      if (e.key === 'e' || e.key === 'E') interactPressedRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frameCount = 0;

    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = Math.min((ts - lastTimeRef.current) / 16.67, 3);
      lastTimeRef.current = ts;
      frameCount++;

      const s = stateRef.current;
      if (!s || s.screen !== 'playing') {
        const ctx2 = canvas.getContext('2d');
        if (ctx2 && s) drawFrame(ctx2, canvas.width, canvas.height, s, frameCount);
        return;
      }

      // Input
      const keys = keysRef.current;
      let dx = 0, dy = 0;
      if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
      if (keys.has('arrowright') || keys.has('d')) dx += 1;
      if (keys.has('arrowup') || keys.has('w')) dy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) dy += 1;

      // Joystick
      const joy = joystickRef.current;
      if (joy.active) {
        const jdx = joy.curX - joy.startX;
        const jdy = joy.curY - joy.startY;
        const jlen = Math.sqrt(jdx * jdx + jdy * jdy);
        if (jlen > 10) {
          dx += (jdx / jlen) * Math.min(jlen / 40, 1);
          dy += (jdy / jlen) * Math.min(jlen / 40, 1);
        }
      }

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) { dx /= len; dy /= len; }
      const speed = PLAYER_SPEED * dt;

      // Movement + collision
      const room = ROOMS[s.stage - 1];
      let walls = [...room.walls];

      // Add objects as soft walls (furniture only)
      const newX = s.playerX + dx * speed;
      const newY = s.playerY + dy * speed;
      let blocked = false;
      for (const w of walls) {
        if (collides(newX, newY, PLAYER_RADIUS, w)) { blocked = true; break; }
      }
      if (!blocked) {
        s.playerX = Math.max(PLAYER_RADIUS, Math.min(room.width - PLAYER_RADIUS, newX));
        s.playerY = Math.max(PLAYER_RADIUS, Math.min(room.height - PLAYER_RADIUS, newY));
      } else {
        // try x only
        const nx2 = s.playerX + dx * speed, ny2 = s.playerY;
        let bx = false;
        for (const w of walls) { if (collides(nx2, ny2, PLAYER_RADIUS, w)) { bx = true; break; } }
        if (!bx) s.playerX = nx2;
        // try y only
        const nx3 = s.playerX, ny3 = s.playerY + dy * speed;
        let by = false;
        for (const w of walls) { if (collides(nx3, ny3, PLAYER_RADIUS, w)) { by = true; break; } }
        if (!by) s.playerY = ny3;
      }

      s.moving = len > 0;
      if (s.moving) {
        s.playerBounce = Math.sin(frameCount * 0.3) * 3;
        stepTimerRef.current++;
        if (stepTimerRef.current % 18 === 0) audioRef.current?.step();
      } else {
        s.playerBounce *= 0.8;
      }

      // Timer
      s.elapsed += dt / 60;
      if (s.dialogTimer > 0) s.dialogTimer -= dt;

      // Find near object
      const objs = roomObjsRef.current;
      let nearestId: string | null = null;
      let nearestD = INTERACT_RANGE;
      for (const obj of objs) {
        if (obj.collected) continue;
        if (s.stage === 3 && obj.type === 'book' && obj.active) continue;
        if (s.stage === 4 && obj.id === 'exit' && !s.levers.every(Boolean)) continue;
        const c = objCenter(obj);
        const d = dist(s.playerX, s.playerY, c.x, c.y);
        if (d < nearestD) { nearestD = d; nearestId = obj.id; }
      }
      s.nearObj = nearestId;

      // Neighbor update
      const nb = neighborRef.current;
      if (nb) {
        nb.x += nb.dir * nb.speed * dt;
        if (nb.x > nb.patrolX2) nb.dir = -1;
        if (nb.x < nb.patrolX1) nb.dir = 1;
        nb.angle = nb.dir > 0 ? 0 : Math.PI;

        // Detection cone
        const coneLen = s.moving ? 90 : 45;
        const coneAngle = Math.PI / 3;
        const toDx = s.playerX - nb.x;
        const toDy = s.playerY - nb.y;
        const toDist = Math.sqrt(toDx * toDx + toDy * toDy);
        if (toDist < coneLen) {
          const toAngle = Math.atan2(toDy, toDx);
          let angleDiff = toAngle - nb.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) < coneAngle / 2) {
            s.screen = 'caught';
            audioRef.current?.alarm();
          }
        }
        // Also proximity catch
        if (toDist < NEIGHBOR_RADIUS + PLAYER_RADIUS + 5) {
          s.screen = 'caught';
          audioRef.current?.alarm();
        }
      }

      // Stage 4: sweeping light
      if (s.stage === 4) {
        s.lightPos += s.lightDir * 1.5 * dt;
        if (s.lightPos > 510) s.lightDir = -1;
        if (s.lightPos < 75) s.lightDir = 1;

        if (!s.levers.every(Boolean)) {
          s.stage4Timer -= dt / 60;
          if (s.stage4Timer <= 0) {
            s.stage4Failed = true;
            s.dialog = '시간 초과! 다시 시도해라!';
            s.dialogTimer = 180;
            s.stage4Timer = 60;
            s.levers = [false, false, false, false, false];
            roomObjsRef.current.filter(o => o.type === 'lever').forEach(o => { o.active = false; });
          }
        }
      }

      // Draw
      const ctx = canvas.getContext('2d');
      if (ctx) drawFrame(ctx, canvas.width, canvas.height, s, frameCount);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [uiScreen, handleInteract]);

  // ── Draw ─────────────────────────────────────────────────────────────────────

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    cw: number, ch: number,
    s: GameState,
    frame: number
  ) {
    ctx.clearRect(0, 0, cw, ch);

    if (s.screen === 'caught') {
      drawCaughtScreen(ctx, cw, ch, s);
      return;
    }
    if (s.screen === 'victory') {
      drawVictoryScreen(ctx, cw, ch, s, frame);
      return;
    }

    const room = ROOMS[s.stage - 1];
    const char = CHARACTERS[s.charIdx];

    // Camera offset (player centered)
    const camX = s.playerX - cw / 2;
    const camY = s.playerY - ch / 2;
    // Clamp camera
    const clampedCamX = Math.max(0, Math.min(room.width - cw, camX));
    const clampedCamY = Math.max(0, Math.min(room.height - ch, camY));
    const offX = -clampedCamX;
    const offY = -clampedCamY;

    // Background
    ctx.fillStyle = room.bgColor;
    ctx.fillRect(0, 0, cw, ch);

    // Floor tiles
    ctx.save();
    ctx.translate(offX, offY);
    drawFloor(ctx, room, frame);
    drawWalls(ctx, room);
    drawObjects(ctx, roomObjsRef.current, s, frame);

    // Companion NPCs
    if (s.rescuedSuhyeon && s.stage >= 2) {
      drawNPC(ctx, s.suhyeonX, s.suhyeonY, '💃', '#FF69B4', frame);
    }
    if (s.rescuedIhyeon && s.stage >= 3) {
      drawNPC(ctx, s.ihyeonX, s.ihyeonY, '👸', '#DDA0DD', frame);
    }

    // Neighbor
    const nb = neighborRef.current;
    if (nb) drawNeighbor(ctx, nb, frame);

    // Player
    drawPlayer(ctx, s.playerX, s.playerY + s.playerBounce, char, s.moving, frame);

    ctx.restore();

    // Stage 4: sweeping light beam (world space)
    if (s.stage === 4) {
      drawLightBeam(ctx, s.lightPos + offX, 60 + offY, s.levers);
    }

    // Fog of war
    drawFog(ctx, cw, ch, s.playerX + offX, s.playerY + offY, s.visRadius);

    // HUD
    drawHUD(ctx, cw, ch, s, frame);
  }

  function drawFloor(ctx: CanvasRenderingContext2D, room: RoomData, frame: number) {
    const tileSize = 40;
    for (let tx = 0; tx < room.width; tx += tileSize) {
      for (let ty = 0; ty < room.height; ty += tileSize) {
        const alt = ((tx / tileSize) + (ty / tileSize)) % 2 === 0;
        ctx.fillStyle = alt ? '#1e1030' : '#221238';
        ctx.fillRect(tx, ty, tileSize, tileSize);
      }
    }
  }

  function drawWalls(ctx: CanvasRenderingContext2D, room: RoomData) {
    for (const w of room.walls) {
      ctx.fillStyle = '#2d2040';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = '#4a3060';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    }
  }

  function drawObjects(ctx: CanvasRenderingContext2D, objs: Obj[], s: GameState, frame: number) {
    for (const obj of objs) {
      if (obj.id === 'shelf' || obj.id === 'table' || obj.id === 'counter') {
        // Furniture
        ctx.fillStyle = '#3d2a5a';
        drawRoundRect(ctx, obj.x, obj.y, obj.w, obj.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#5a3f80';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `${Math.min(obj.w, obj.h) * 0.7}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.emoji, obj.x + obj.w / 2, obj.y + obj.h / 2);
        continue;
      }

      if (obj.collected) continue;

      const c = objCenter(obj);
      const pulse = 0.9 + Math.sin(frame * 0.08) * 0.1;

      if (obj.type === 'item') {
        // Glow
        const grad = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 30 * pulse);
        grad.addColorStop(0, 'rgba(255,255,150,0.3)');
        grad.addColorStop(1, 'rgba(255,255,150,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 30 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${20 * pulse}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.emoji, c.x, c.y);

        if (obj.label) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#aaa';
          ctx.fillText(obj.label, c.x, c.y + 18);
        }
      } else if (obj.type === 'door') {
        if (obj.active) {
          // Open door - draw opening
          ctx.fillStyle = '#00ff88';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.font = '20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🚪', c.x, c.y);
        } else {
          ctx.fillStyle = '#4a2060';
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.strokeStyle = '#8855aa';
          ctx.lineWidth = 2;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          ctx.font = '18px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔒', c.x, c.y);
        }
      } else if (obj.type === 'npc') {
        if (!obj.collected) {
          // Trapped NPC in cage
          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(c.x, c.y, 22 + Math.sin(frame * 0.05) * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = '20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.emoji, c.x, c.y);
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#ff6600';
          ctx.fillText(obj.label || '', c.x, c.y + 28);
        }
      } else if (obj.type === 'book') {
        const bookColors: Record<string, string> = {
          redbook: '#cc2222', bluebook: '#2244cc', greenbook: '#228833'
        };
        ctx.fillStyle = obj.active ? '#888' : (bookColors[obj.id] || '#664422');
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeStyle = obj.active ? '#444' : '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        if (!obj.active) {
          ctx.font = '16px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.emoji, c.x, c.y);
        }
      } else if (obj.type === 'lever') {
        const activated = obj.active || false;
        ctx.fillStyle = activated ? '#00ff88' : '#884422';
        drawRoundRect(ctx, obj.x, obj.y, obj.w, obj.h, 6);
        ctx.fill();
        ctx.strokeStyle = activated ? '#00cc66' : '#cc6633';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activated ? '✅' : '🔧', c.x, c.y);
      }
    }
  }

  function drawLightBeam(ctx: CanvasRenderingContext2D, lightX: number, topY: number, levers: boolean[]) {
    // Sweeping beam of light across levers
    const leverXs = [80, 180, 280, 380, 480];
    const grad = ctx.createRadialGradient(lightX, topY + 25, 5, lightX, topY + 25, 50);
    grad.addColorStop(0, 'rgba(255,255,100,0.6)');
    grad.addColorStop(1, 'rgba(255,255,100,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lightX, topY + 25, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawNPC(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, color: string, frame: number) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y - 2 + Math.sin(frame * 0.1) * 2);
  }

  function drawNeighbor(ctx: CanvasRenderingContext2D, nb: Neighbor, frame: number) {
    // Detection cone
    const coneLen = 90;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ff2200';
    ctx.beginPath();
    ctx.moveTo(nb.x, nb.y);
    const spread = Math.PI / 3;
    ctx.arc(nb.x, nb.y, coneLen, nb.angle - spread / 2, nb.angle + spread / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Patrol path
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,60,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nb.patrolX1, nb.patrolY);
    ctx.lineTo(nb.patrolX2, nb.patrolY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Body
    ctx.fillStyle = '#cc1100';
    ctx.beginPath();
    ctx.arc(nb.x, nb.y, NEIGHBOR_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4422';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😈', nb.x, nb.y - 2);
  }

  function drawPlayer(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    char: typeof CHARACTERS[0],
    moving: boolean,
    frame: number
  ) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + PLAYER_RADIUS - 2, PLAYER_RADIUS * 0.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, PLAYER_RADIUS);
    grad.addColorStop(0, lightenColor(char.color, 40));
    grad.addColorStop(1, char.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Emoji face
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char.emoji, x, y - 2);
  }

  function lightenColor(hex: string, amount: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function drawFog(ctx: CanvasRenderingContext2D, cw: number, ch: number, px: number, py: number, radius: number) {
    // Dark overlay with hole
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Draw dark layer
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cw, ch);

    // Punch hole (use destination-out trick via compositing on offscreen - simplified: use gradient)
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(px, py, radius * 0.3, px, py, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHUD(ctx: CanvasRenderingContext2D, cw: number, ch: number, s: GameState, frame: number) {
    const char = CHARACTERS[s.charIdx];
    const stageNames = ['', '거실&주방', '실험실', '도서관', '지하실'];

    // Top-left: stage + mission
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    drawRoundRect(ctx, 10, 10, 220, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`스테이지 ${s.stage}: ${stageNames[s.stage]}`, 18, 16);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#ccc';
    const missions = [
      '', '손전등→쪽지→문 열기', '부품 3개 수집→수현 구출',
      '단서 확인→책 순서대로', '레버 5개 타이밍 맞춰 누르기',
    ];
    ctx.fillText(missions[s.stage], 18, 34);

    // Top-right: timer
    const mins = Math.floor(s.elapsed / 60);
    const secs = Math.floor(s.elapsed % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    drawRoundRect(ctx, cw - 90, 10, 80, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, cw - 50, 27);

    // Stage 4: countdown
    if (s.stage === 4 && !s.levers.every(Boolean)) {
      const remaining = Math.ceil(s.stage4Timer);
      ctx.fillStyle = remaining < 15 ? 'rgba(200,0,0,0.8)' : 'rgba(0,0,0,0.7)';
      drawRoundRect(ctx, cw / 2 - 50, 10, 100, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⏱ ${remaining}s`, cw / 2, 27);
    }

    // Inventory
    const invX = cw / 2 - (s.inventory.length * 34) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 5; i++) {
      drawRoundRect(ctx, invX + i * 34, ch - 52, 30, 30, 4);
      ctx.fill();
    }
    for (let i = 0; i < s.inventory.length && i < 5; i++) {
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.inventory[i], invX + i * 34 + 15, ch - 37);
    }

    // Interaction prompt
    if (s.nearObj) {
      const objs = roomObjsRef.current;
      const obj = objs.find(o => o.id === s.nearObj);
      if (obj) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        drawRoundRect(ctx, cw / 2 - 70, ch / 2 + 50, 140, 30, 8);
        ctx.fill();
        ctx.fillStyle = '#ffee00';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`E: ${obj.label || '상호작용'}`, cw / 2, ch / 2 + 65);
      }
    }

    // Dialog box
    if (s.dialogTimer > 0 && s.dialog) {
      const alpha = Math.min(1, s.dialogTimer / 30);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,5,25,0.88)';
      drawRoundRect(ctx, cw / 2 - 200, ch - 100, 400, 50, 10);
      ctx.fill();
      ctx.strokeStyle = '#6644aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Word wrap
      const words = s.dialog.split(' ');
      let line1 = '', line2 = '';
      for (const w of words) {
        if (line1.length + w.length < 30) line1 += (line1 ? ' ' : '') + w;
        else line2 += (line2 ? ' ' : '') + w;
      }
      if (line2) {
        ctx.fillText(line1, cw / 2, ch - 87);
        ctx.fillText(line2, cw / 2, ch - 68);
      } else {
        ctx.fillText(line1, cw / 2, ch - 77);
      }
      ctx.restore();
    }

    // Character indicator (top-left corner tiny)
    ctx.font = '22px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(char.emoji, 240, 12);
  }

  function drawCaughtScreen(ctx: CanvasRenderingContext2D, cw: number, ch: number, s: GameState) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#ff2200';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('발각!!', cw / 2, ch / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText('😈 이웃집 남자한테 들켰다!', cw / 2, ch / 2 + 10);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('화면을 터치하거나 아무 키를 눌러 재시도', cw / 2, ch / 2 + 55);
  }

  function drawVictoryScreen(ctx: CanvasRenderingContext2D, cw: number, ch: number, s: GameState, frame: number) {
    ctx.fillStyle = 'rgba(5,0,15,0.95)';
    ctx.fillRect(0, 0, cw, ch);

    // Particles
    for (let i = 0; i < 20; i++) {
      const t = (frame * 0.02 + i * 0.31) % 1;
      const x = cw * 0.1 + (cw * 0.8 * ((i * 0.618) % 1));
      const y = ch - t * ch;
      ctx.fillStyle = `hsl(${(i * 37 + frame) % 360},100%,60%)`;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 탈출 성공! 🎉', cw / 2, ch / 2 - 70);

    const score = Math.max(0, 10000 - Math.floor(s.elapsed) * 10) + s.uncaughtStages * 500;
    const mins = Math.floor(s.elapsed / 60);
    const secs = Math.floor(s.elapsed % 60);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText(`점수: ${score}점`, cw / 2, ch / 2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`클리어 시간: ${mins}:${secs.toString().padStart(2, '0')}`, cw / 2, ch / 2 + 25);
    ctx.fillText(`무탈출 보너스: ${s.uncaughtStages * 500}점`, cw / 2, ch / 2 + 55);
    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.fillText('화면을 터치하거나 아무 키를 눌러 메인으로', cw / 2, ch / 2 + 95);
  }

  // ── Touch / Joystick Handlers ────────────────────────────────────────────────

  const handleCanvasClick = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.screen === 'caught') {
      // Restart stage
      const gs = stateRef.current!;
      const savedChar = gs.charIdx;
      const savedStage = gs.stage;
      const savedElapsed = gs.elapsed;
      const savedUncaught = gs.uncaughtStages;
      const savedInv = gs.inventory;
      const savedFlash = gs.hasFlashlight;
      const savedNote = gs.noteRead;
      const savedParts = gs.stage2Parts;
      const savedRescuedS = gs.rescuedSuhyeon;
      const savedRescuedI = gs.rescuedIhyeon;
      const savedBookOrder = gs.bookOrder;
      const newS = initState(savedChar);
      newS.stage = savedStage;
      newS.elapsed = savedElapsed + 30; // penalty
      newS.uncaughtStages = savedUncaught;
      newS.inventory = savedInv;
      newS.hasFlashlight = savedFlash;
      newS.visRadius = savedFlash ? 300 : 150;
      newS.noteRead = savedNote;
      newS.stage2Parts = savedParts;
      newS.rescuedSuhyeon = savedRescuedS;
      newS.rescuedIhyeon = savedRescuedI;
      newS.bookOrder = savedBookOrder;
      stateRef.current = newS;
      loadStage(savedStage);
    } else if (s.screen === 'victory') {
      // Go to home - handled by link, but reset
      stateRef.current = null;
      setUiScreen('select');
    }
  }, [loadStage]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth / 2) {
        joystickRef.current = { active: true, startX: t.clientX, startY: t.clientY, curX: t.clientX, curY: t.clientY };
      } else {
        // Right side: interact
        handleInteract();
      }
    }
  }, [handleInteract]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth / 2) {
        joystickRef.current.curX = t.clientX;
        joystickRef.current.curY = t.clientY;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth / 2) {
        joystickRef.current = { active: false, startX: 0, startY: 0, curX: 0, curY: 0 };
      }
    }
  }, []);

  // ── Character Select Screen ──────────────────────────────────────────────────

  if (uiScreen === 'select') {
    return (
      <div style={{
        width: '100vw', height: '100dvh', background: 'linear-gradient(135deg, #0d0020 0%, #1a0535 50%, #0a0a2e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden', position: 'relative',
      }}>
        {/* Back link */}
        <Link href="/" style={{
          position: 'absolute', top: 16, left: 16, color: '#aaa', textDecoration: 'none',
          fontSize: 14, padding: '6px 12px', background: 'rgba(255,255,255,0.1)',
          borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
        }}>← 홈으로</Link>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>🏚️ 탈출</div>
          <div style={{ fontSize: 13, color: '#9988bb', marginBottom: 20, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
            이웃집 남자가 우릴 가뒀다!<br />
            방을 탈출하고 친구들을 구출하라!
          </div>
        </div>

        {/* Character cards */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px' }}>
          {CHARACTERS.map((c, i) => (
            <button key={i} onClick={() => { setSelectedChar(i); startGame(i); }}
              style={{
                background: selectedChar === i
                  ? `linear-gradient(135deg, ${c.color}33, ${c.color}11)`
                  : 'rgba(255,255,255,0.05)',
                border: `2px solid ${selectedChar === i ? c.color : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 16, padding: '20px 24px', cursor: 'pointer',
                color: '#fff', textAlign: 'center', transition: 'all 0.2s',
                minWidth: 110,
              }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>{c.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#bba', marginBottom: 8 }}>{c.role}</div>
              <div style={{
                background: c.color, borderRadius: 20, padding: '4px 14px',
                fontSize: 12, fontWeight: 'bold',
              }}>선택!</div>
            </button>
          ))}
        </div>

        {/* Controls hint */}
        <div style={{
          marginTop: 28, background: 'rgba(0,0,0,0.4)', borderRadius: 12,
          padding: '12px 20px', fontSize: 12, color: '#aaa', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.1)', maxWidth: 320,
        }}>
          <div style={{ marginBottom: 4, color: '#ccc', fontWeight: 'bold' }}>조작법</div>
          <div>PC: WASD/화살표 이동 · E 상호작용</div>
          <div style={{ marginTop: 2 }}>모바일: 왼쪽 조이스틱 · 오른쪽 E버튼</div>
        </div>
      </div>
    );
  }

  // ── Game Canvas Screen ────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100vw', height: '100dvh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Mobile joystick overlay (visual) */}
      <div style={{
        position: 'absolute', bottom: 70, left: 20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '2px solid rgba(255,255,255,0.2)',
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
        }} />
      </div>

      {/* Mobile E button */}
      <button
        style={{
          position: 'absolute', bottom: 90, right: 20,
          width: 90, height: 90, borderRadius: '50%',
          background: 'rgba(150,100,255,0.5)',
          border: '3px solid rgba(200,160,255,0.8)',
          color: '#fff', fontSize: 28, fontWeight: 'bold',
          cursor: 'pointer', touchAction: 'manipulation',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 0,
        }}
        onTouchStart={(e) => { e.preventDefault(); handleInteract(); }}
        onClick={handleInteract}
      ><span style={{fontSize:28}}>👆</span><span style={{fontSize:11}}>상호작용</span></button>

      {/* Home link (small) */}
      <Link href="/" style={{
        position: 'absolute', top: 10, right: 10,
        color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
        fontSize: 12, padding: '4px 8px',
        background: 'rgba(0,0,0,0.4)', borderRadius: 6,
        zIndex: 10,
      }}>← 홈</Link>
    </div>
  );
}
