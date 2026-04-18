'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { saveScore } from '@/lib/ranking';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Character {
  name: string;
  color: string;
  emoji: string;
  heart: string;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'solid' | 'sticky';
}

interface Bird {
  x: number;
  y: number;
  x1: number;
  x2: number;
  speed: number;
  dir: number;
}

interface Level {
  platforms: Platform[];
  birds: Bird[];
  starX: number;
  starY: number;
  spawnX: number;
  spawnY: number;
  width: number;
  height: number;
  name: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const CHARACTERS: Character[] = [
  { name: '승민', color: '#3B82F6', emoji: '🤖', heart: '💙' },
  { name: '건우', color: '#10B981', emoji: '🩺', heart: '💚' },
  { name: '강우', color: '#F59E0B', emoji: '👨‍🍳', heart: '🧡' },
  { name: '수현', color: '#EC4899', emoji: '💃', heart: '💗' },
  { name: '이현', color: '#FF69B4', emoji: '👸', heart: '💖' },
  { name: '준영', color: '#6366F1', emoji: '📚', heart: '💜' },
  { name: '준우', color: '#0EA5E9', emoji: '✈️', heart: '💎' },
];

const GRAVITY = 0.3;
const MAX_VEL = 15;
const AIR_RESIST = 0.99;
const PLAYER_RADIUS = 16;
const STAR_RADIUS = 24;
const BIRD_RADIUS = 18;
const ARM_MAX_LENGTH = 300;

// ─── Level Definitions ───────────────────────────────────────────────────────
function makeLevels(SW: number, SH: number): Level[] {
  // Use screen-relative measurements so levels feel right on any device
  const W = Math.max(SW, 400);
  const H = Math.max(SH, 600);

  return [
    // Stage 1 – Tutorial
    {
      name: '기본 경사',
      width: W,
      height: H * 1.6,
      spawnX: W * 0.15,
      spawnY: H * 1.6 - 120,
      starX: W * 0.82,
      starY: H * 0.25,
      birds: [],
      platforms: [
        // Ground / base
        { x: 0, y: H * 1.6 - 60, w: W, h: 60, type: 'solid' },
        // Step 1
        { x: W * 0.1, y: H * 1.6 - 180, w: W * 0.28, h: 20, type: 'sticky' },
        // Step 2
        { x: W * 0.35, y: H * 1.6 - 320, w: W * 0.28, h: 20, type: 'sticky' },
        // Step 3
        { x: W * 0.55, y: H * 1.6 - 480, w: W * 0.28, h: 20, type: 'sticky' },
        // Final platform
        { x: W * 0.62, y: H * 0.2, w: W * 0.3, h: 20, type: 'sticky' },
        // Wall right (grapple anchor)
        { x: W * 0.9, y: H * 0.15, w: 20, h: H * 0.5, type: 'sticky' },
      ],
    },

    // Stage 2 – Zigzag
    {
      name: '교차 경사',
      width: W,
      height: H * 2,
      spawnX: W * 0.1,
      spawnY: H * 2 - 120,
      starX: W * 0.8,
      starY: H * 0.22,
      birds: [],
      platforms: [
        { x: 0, y: H * 2 - 60, w: W, h: 60, type: 'solid' },
        { x: W * 0.05, y: H * 2 - 220, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.55, y: H * 2 - 400, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.1, y: H * 2 - 580, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.55, y: H * 2 - 760, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.2, y: H * 2 - 940, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.6, y: H * 0.2, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.85, y: H * 0.1, w: 20, h: H * 0.4, type: 'sticky' },
      ],
    },

    // Stage 3 – Birds appear
    {
      name: '새 등장',
      width: W,
      height: H * 2.2,
      spawnX: W * 0.12,
      spawnY: H * 2.2 - 120,
      starX: W * 0.78,
      starY: H * 0.2,
      birds: [
        { x: W * 0.3, y: H * 2.2 - 500, x1: W * 0.05, x2: W * 0.7, speed: 1.2, dir: 1 },
        { x: W * 0.6, y: H * 2.2 - 900, x1: W * 0.1, x2: W * 0.85, speed: 1.5, dir: -1 },
      ],
      platforms: [
        { x: 0, y: H * 2.2 - 60, w: W, h: 60, type: 'solid' },
        { x: W * 0.05, y: H * 2.2 - 200, w: W * 0.28, h: 20, type: 'sticky' },
        { x: W * 0.55, y: H * 2.2 - 380, w: W * 0.28, h: 20, type: 'sticky' },
        { x: W * 0.1, y: H * 2.2 - 560, w: W * 0.28, h: 20, type: 'sticky' },
        { x: W * 0.5, y: H * 2.2 - 740, w: W * 0.28, h: 20, type: 'sticky' },
        { x: W * 0.15, y: H * 2.2 - 920, w: W * 0.28, h: 20, type: 'sticky' },
        { x: W * 0.55, y: H * 0.2, w: W * 0.35, h: 20, type: 'sticky' },
        { x: W * 0.88, y: H * 0.1, w: 20, h: H * 0.35, type: 'sticky' },
      ],
    },

    // Stage 4 – Floating islands
    {
      name: '떠있는 섬',
      width: W,
      height: H * 2.5,
      spawnX: W * 0.1,
      spawnY: H * 2.5 - 120,
      starX: W * 0.8,
      starY: H * 0.15,
      birds: [
        { x: W * 0.4, y: H * 2.5 - 600, x1: W * 0.05, x2: W * 0.75, speed: 1.4, dir: 1 },
        { x: W * 0.2, y: H * 2.5 - 1100, x1: W * 0.05, x2: W * 0.65, speed: 1.8, dir: 1 },
        { x: W * 0.6, y: H * 2.5 - 1500, x1: W * 0.2, x2: W * 0.85, speed: 1.6, dir: -1 },
      ],
      platforms: [
        { x: 0, y: H * 2.5 - 60, w: W * 0.35, h: 60, type: 'solid' },
        { x: W * 0.65, y: H * 2.5 - 60, w: W * 0.35, h: 60, type: 'solid' },
        { x: W * 0.08, y: H * 2.5 - 250, w: W * 0.22, h: 20, type: 'sticky' },
        { x: W * 0.65, y: H * 2.5 - 430, w: W * 0.22, h: 20, type: 'sticky' },
        { x: W * 0.12, y: H * 2.5 - 620, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.62, y: H * 2.5 - 810, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.08, y: H * 2.5 - 1000, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.6, y: H * 2.5 - 1200, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.15, y: H * 2.5 - 1400, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.58, y: H * 0.15, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.88, y: H * 0.05, w: 20, h: H * 0.35, type: 'sticky' },
      ],
    },

    // Stage 5 – Final climb
    {
      name: '최종 등반',
      width: W,
      height: H * 3,
      spawnX: W * 0.1,
      spawnY: H * 3 - 120,
      starX: W * 0.5,
      starY: H * 0.1,
      birds: [
        { x: W * 0.3, y: H * 3 - 500, x1: W * 0.05, x2: W * 0.65, speed: 1.6, dir: 1 },
        { x: W * 0.6, y: H * 3 - 900, x1: W * 0.3, x2: W * 0.9, speed: 2.0, dir: -1 },
        { x: W * 0.2, y: H * 3 - 1300, x1: W * 0.05, x2: W * 0.55, speed: 1.8, dir: 1 },
        { x: W * 0.65, y: H * 3 - 1800, x1: W * 0.35, x2: W * 0.9, speed: 2.2, dir: -1 },
      ],
      platforms: [
        { x: 0, y: H * 3 - 60, w: W * 0.3, h: 60, type: 'solid' },
        { x: W * 0.7, y: H * 3 - 60, w: W * 0.3, h: 60, type: 'solid' },
        // Left wall
        { x: 0, y: H * 0.05, w: 18, h: H * 1.5, type: 'sticky' },
        // Right wall
        { x: W - 18, y: H * 0.05, w: 18, h: H * 1.5, type: 'sticky' },
        { x: W * 0.05, y: H * 3 - 250, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.65, y: H * 3 - 450, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.08, y: H * 3 - 650, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.62, y: H * 3 - 850, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.05, y: H * 3 - 1050, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.65, y: H * 3 - 1250, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.08, y: H * 3 - 1450, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.62, y: H * 3 - 1650, w: W * 0.18, h: 20, type: 'sticky' },
        { x: W * 0.05, y: H * 3 - 1860, w: W * 0.2, h: 20, type: 'sticky' },
        { x: W * 0.35, y: H * 0.08, w: W * 0.3, h: 20, type: 'sticky' },
        { x: W * 0.62, y: H * 3 - 2100, w: W * 0.2, h: 20, type: 'sticky' },
      ],
    },
  ];
}

// ─── Sketch drawing helpers ───────────────────────────────────────────────────
function wobble(v: number, amt = 2): number {
  return v + (Math.random() - 0.5) * amt;
}

function drawWobblyLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(wobble(x1), wobble(y1));
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 4;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 4;
  ctx.quadraticCurveTo(mx, my, wobble(x2), wobble(y2));
  ctx.stroke();
}

function drawWobblyRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: string,
  lineWidth: number,
  fill?: string
) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 3);
    ctx.fill();
  }
  drawWobblyLine(ctx, x, y, x + w, y, color, lineWidth);
  drawWobblyLine(ctx, x + w, y, x + w, y + h, color, lineWidth);
  drawWobblyLine(ctx, x + w, y + h, x, y + h, color, lineWidth);
  drawWobblyLine(ctx, x, y + h, x, y, color, lineWidth);
}

function drawPaperBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(0, 0, W, H);
  // Subtle grid lines
  ctx.strokeStyle = 'rgba(180,170,150,0.25)';
  ctx.lineWidth = 0.5;
  const gridSize = 28;
  for (let gx = 0; gx < W; gx += gridSize) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = 0; gy < H; gy += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StickyPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<'select' | 'game' | 'over' | 'win'>('select');
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const savedRef = useRef(false);

  // ─── Game State ─────────────────────────────────────────────────
  interface ArmState {
    active: boolean;
    stuck: boolean;
    tx: number;
    ty: number;
    stickX: number;
    stickY: number;
  }

  interface PlayerState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    grounded: boolean;
    arm: ArmState;
    lives: number;
    invincible: number; // frames of invincibility after hit
    dead: boolean;
  }

  interface GameState {
    char: Character;
    player: PlayerState;
    levels: Level[];
    stageIndex: number;
    score: number;
    stageStart: number; // timestamp
    cameraY: number;
    birds: Bird[];
    hintAlpha: number; // fades hint text
    aimX: number;
    aimY: number;
    isAiming: boolean;
    stageBanner: number; // countdown frames to show banner
    W: number;
    H: number;
    animFrame: number;
  }

  // ─── Start Game ─────────────────────────────────────────────────
  const startGame = useCallback((char: Character) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const levels = makeLevels(W, H);
    const lvl = levels[0];

    const gs: GameState = {
      char,
      levels,
      stageIndex: 0,
      score: 0,
      stageStart: performance.now(),
      cameraY: 0,
      birds: lvl.birds.map(b => ({ ...b })),
      hintAlpha: 1,
      aimX: 0,
      aimY: 0,
      isAiming: false,
      stageBanner: 180,
      W,
      H,
      animFrame: 0,
      player: {
        x: lvl.spawnX,
        y: lvl.spawnY,
        vx: 0,
        vy: 0,
        grounded: false,
        lives: 3,
        invincible: 0,
        dead: false,
        arm: { active: false, stuck: false, tx: 0, ty: 0, stickX: 0, stickY: 0 },
      },
    };
    stateRef.current = gs;
    setScreen('game');
  }, []);

  // ─── Load Stage ─────────────────────────────────────────────────
  function loadStage(gs: GameState, idx: number) {
    const lvl = gs.levels[idx];
    gs.stageIndex = idx;
    gs.stageStart = performance.now();
    gs.birds = lvl.birds.map(b => ({ ...b }));
    gs.stageBanner = 180;
    gs.player.x = lvl.spawnX;
    gs.player.y = lvl.spawnY;
    gs.player.vx = 0;
    gs.player.vy = 0;
    gs.player.grounded = false;
    gs.player.arm = { active: false, stuck: false, tx: 0, ty: 0, stickX: 0, stickY: 0 };
    gs.cameraY = 0;
  }

  // ─── Collision helpers ───────────────────────────────────────────
  function circleRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
  }

  function armHitsPlatform(ax: number, ay: number, tx: number, ty: number, p: Platform): { hit: boolean; hx: number; hy: number } {
    // Simple line-rect intersection test
    const dx = tx - ax;
    const dy = ty - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return { hit: false, hx: 0, hy: 0 };

    // Parametric: P(t) = (ax + dx*t, ay + dy*t), t in [0,1]
    // Find intersection with each edge
    const tests = [
      // Top edge
      dy !== 0 ? (p.y - ay) / dy : Infinity,
      // Bottom edge
      dy !== 0 ? (p.y + p.h - ay) / dy : Infinity,
      // Left edge
      dx !== 0 ? (p.x - ax) / dx : Infinity,
      // Right edge
      dx !== 0 ? (p.x + p.w - ax) / dx : Infinity,
    ];

    for (const t of tests) {
      if (t < 0 || t > 1) continue;
      const hx = ax + dx * t;
      const hy = ay + dy * t;
      if (hx >= p.x - 2 && hx <= p.x + p.w + 2 && hy >= p.y - 2 && hy <= p.y + p.h + 2) {
        return { hit: true, hx, hy };
      }
    }
    return { hit: false, hx: 0, hy: 0 };
  }

  // ─── Physics update ──────────────────────────────────────────────
  function updatePhysics(gs: GameState) {
    const p = gs.player;
    const lvl = gs.levels[gs.stageIndex];

    if (p.dead) return;

    gs.animFrame++;
    if (gs.stageBanner > 0) gs.stageBanner--;
    if (p.invincible > 0) p.invincible--;
    if (gs.hintAlpha > 0) gs.hintAlpha -= 0.003;

    // ── Birds movement ──────────────────────────────────────────
    for (const bird of gs.birds) {
      bird.x += bird.speed * bird.dir;
      if (bird.x > bird.x2) { bird.x = bird.x2; bird.dir = -1; }
      if (bird.x < bird.x1) { bird.x = bird.x1; bird.dir = 1; }
    }

    // ── Arm physics ─────────────────────────────────────────────
    const arm = p.arm;
    if (arm.active) {
      if (!arm.stuck) {
        // Arm is flying toward target
        // We just keep it visual; check if it hit something
        // (arm fire is instant in our model - we check on release)
      } else {
        // Pendulum pull
        const rx = arm.stickX - p.x;
        const ry = arm.stickY - p.y;
        const dist = Math.sqrt(rx * rx + ry * ry);

        if (dist < 24) {
          // Reached the anchor - detach
          arm.active = false;
          arm.stuck = false;
        } else {
          // Rope tension force
          const tension = 0.18;
          p.vx += (rx / dist) * tension * Math.min(dist / 80, 1);
          p.vy += (ry / dist) * tension * Math.min(dist / 80, 1);
        }
      }
    }

    // ── Gravity ─────────────────────────────────────────────────
    p.vy += GRAVITY;

    // ── Air resistance ──────────────────────────────────────────
    p.vx *= AIR_RESIST;
    p.vy *= AIR_RESIST;

    // ── Clamp velocity ──────────────────────────────────────────
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (spd > MAX_VEL) {
      p.vx = (p.vx / spd) * MAX_VEL;
      p.vy = (p.vy / spd) * MAX_VEL;
    }

    // ── Move ────────────────────────────────────────────────────
    p.x += p.vx;
    p.y += p.vy;
    p.grounded = false;

    // ── Platform collisions ─────────────────────────────────────
    for (const plat of lvl.platforms) {
      if (!circleRect(p.x, p.y, PLAYER_RADIUS, plat.x, plat.y, plat.w, plat.h)) continue;

      // Find overlap direction
      const cx = plat.x + plat.w / 2;
      const cy = plat.y + plat.h / 2;
      const overlapX = (plat.w / 2 + PLAYER_RADIUS) - Math.abs(p.x - cx);
      const overlapY = (plat.h / 2 + PLAYER_RADIUS) - Math.abs(p.y - cy);

      if (overlapX < overlapY) {
        // Side collision
        p.x += p.x < cx ? -overlapX : overlapX;
        p.vx = 0;
      } else {
        // Top/bottom collision
        if (p.y < cy) {
          // Landing on top
          p.y -= overlapY;
          p.vy = 0;
          p.grounded = true;
        } else {
          p.y += overlapY;
          p.vy = 0;
        }
      }
    }

    // ── Wall bounds ─────────────────────────────────────────────
    if (p.x < PLAYER_RADIUS) { p.x = PLAYER_RADIUS; p.vx = Math.abs(p.vx) * 0.5; }
    if (p.x > lvl.width - PLAYER_RADIUS) { p.x = lvl.width - PLAYER_RADIUS; p.vx = -Math.abs(p.vx) * 0.5; }

    // ── Lava (bottom) ───────────────────────────────────────────
    if (p.y > lvl.height - 30 && p.invincible <= 0) {
      hitPlayer(gs);
    }

    // ── Bird collisions ─────────────────────────────────────────
    if (p.invincible <= 0) {
      for (const bird of gs.birds) {
        const dx = p.x - bird.x;
        const dy = p.y - bird.y;
        if (dx * dx + dy * dy < (PLAYER_RADIUS + BIRD_RADIUS) ** 2) {
          hitPlayer(gs);
          break;
        }
      }
    }

    // ── Star collection ─────────────────────────────────────────
    const sdx = p.x - lvl.starX;
    const sdy = p.y - lvl.starY;
    if (sdx * sdx + sdy * sdy < (PLAYER_RADIUS + STAR_RADIUS) ** 2) {
      stageCleared(gs);
    }

    // ── Camera follows player ───────────────────────────────────
    const screenPlayerY = p.y - gs.cameraY;
    const scrollThreshold = gs.H * 0.4;
    if (screenPlayerY < scrollThreshold) {
      gs.cameraY = p.y - scrollThreshold;
    }
    const maxCam = lvl.height - gs.H;
    if (gs.cameraY < 0) gs.cameraY = 0;
    if (gs.cameraY > maxCam) gs.cameraY = maxCam;
  }

  function hitPlayer(gs: GameState) {
    const p = gs.player;
    p.lives--;
    p.invincible = 120;
    p.arm.active = false;
    p.arm.stuck = false;
    // Bounce back up a bit
    p.vy = -8;
    p.vx = p.vx * -0.5;

    // Respawn to level spawn if fell in lava
    if (p.y > gs.levels[gs.stageIndex].height - 20) {
      p.x = gs.levels[gs.stageIndex].spawnX;
      p.y = gs.levels[gs.stageIndex].spawnY;
      p.vx = 0;
      p.vy = 0;
      gs.cameraY = 0;
    }

    if (p.lives <= 0) {
      p.dead = true;
    }
  }

  function stageCleared(gs: GameState) {
    const elapsed = (performance.now() - gs.stageStart) / 1000;
    const speedBonus = Math.max(0, Math.floor(500 - elapsed * 10));
    gs.score += 1000 + speedBonus;

    if (gs.stageIndex < gs.levels.length - 1) {
      loadStage(gs, gs.stageIndex + 1);
    } else {
      // Game complete!
      gs.player.dead = true; // stop updates
    }
  }

  // ─── Fire arm ────────────────────────────────────────────────────
  function fireArm(gs: GameState, targetX: number, targetY: number) {
    const p = gs.player;
    if (p.dead) return;

    // Fade hint
    gs.hintAlpha = 0;

    const arm = p.arm;
    arm.active = true;
    arm.stuck = false;
    arm.tx = targetX;
    arm.ty = targetY;
    arm.stickX = 0;
    arm.stickY = 0;

    // Check if arm hits a sticky platform
    const lvl = gs.levels[gs.stageIndex];
    let bestT = Infinity;
    let hitPlatform: Platform | null = null;
    let hitX = 0, hitY = 0;

    for (const plat of lvl.platforms) {
      if (plat.type !== 'sticky') continue;
      const { hit, hx, hy } = armHitsPlatform(p.x, p.y, targetX, targetY, plat);
      if (hit) {
        const dx = hx - p.x;
        const dy = hy - p.y;
        const d = dx * dx + dy * dy;
        if (d < bestT) {
          bestT = d;
          hitPlatform = plat;
          hitX = hx;
          hitY = hy;
        }
      }
    }

    if (hitPlatform && Math.sqrt(bestT) < ARM_MAX_LENGTH) {
      arm.stuck = true;
      arm.stickX = hitX;
      arm.stickY = hitY;
    } else {
      // Miss - retract after a moment
      setTimeout(() => {
        if (stateRef.current && stateRef.current.player.arm === arm) {
          arm.active = false;
        }
      }, 300);
    }
  }

  // ─── Draw ─────────────────────────────────────────────────────────
  function draw(ctx: CanvasRenderingContext2D, gs: GameState) {
    const { W, H } = gs;
    const lvl = gs.levels[gs.stageIndex];
    const cam = gs.cameraY;
    const p = gs.player;
    const t = gs.animFrame;

    // Clear + paper bg
    drawPaperBackground(ctx, W, H);

    ctx.save();
    ctx.translate(0, -cam);

    // ── Lava ──────────────────────────────────────────────────
    const lavaY = lvl.height - 58;
    // Glow
    const lavaGrad = ctx.createLinearGradient(0, lavaY - 20, 0, lvl.height);
    lavaGrad.addColorStop(0, 'rgba(255,80,0,0)');
    lavaGrad.addColorStop(0.3, 'rgba(255,80,0,0.25)');
    lavaGrad.addColorStop(1, 'rgba(255,30,0,0.6)');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, lavaY - 20, W, lvl.height - lavaY + 20);

    // Wavy lava surface
    ctx.strokeStyle = '#FF4500';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let lx = 0; lx <= W; lx += 6) {
      const ly = lavaY + Math.sin((lx * 0.04) + t * 0.06) * 6 + (Math.random() - 0.5) * 2;
      lx === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
    }
    ctx.stroke();

    ctx.fillStyle = '#FF2200';
    ctx.beginPath();
    ctx.moveTo(0, lavaY + 5);
    for (let lx = 0; lx <= W; lx += 6) {
      const ly = lavaY + Math.sin((lx * 0.04) + t * 0.06) * 6 + 5;
      ctx.lineTo(lx, ly);
    }
    ctx.lineTo(W, lvl.height);
    ctx.lineTo(0, lvl.height);
    ctx.closePath();
    ctx.fill();

    // ── Platforms ─────────────────────────────────────────────
    for (const plat of lvl.platforms) {
      const isSticky = plat.type === 'sticky';
      const platColor = isSticky ? '#2D8B4E' : '#5D4037';
      const fillColor = isSticky ? 'rgba(45,139,78,0.12)' : 'rgba(93,64,55,0.12)';
      drawWobblyRect(ctx, plat.x, plat.y, plat.w, plat.h, platColor, isSticky ? 3.5 : 2.5, fillColor);

      if (isSticky && plat.w > 30) {
        // Draw small sticky blobs as texture
        ctx.fillStyle = 'rgba(45,139,78,0.35)';
        const blobCount = Math.floor(plat.w / 30);
        for (let bi = 0; bi < blobCount; bi++) {
          const bx = plat.x + 15 + bi * 30 + (Math.random() - 0.5) * 4;
          const by = plat.y + plat.h / 2 + (Math.random() - 0.5) * 3;
          ctx.beginPath();
          ctx.arc(bx, by, 3 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── Birds ─────────────────────────────────────────────────
    for (const bird of gs.birds) {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      if (bird.dir < 0) ctx.scale(-1, 1);

      // Wing flap
      const flap = Math.sin(t * 0.2) * 8;
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-4, -flap);
      ctx.lineTo(4, -flap);
      ctx.lineTo(16, 0);
      ctx.stroke();
      // Body dot
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(0, 2, 5, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(8 * (bird.dir > 0 ? 1 : -1), 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(9 * (bird.dir > 0 ? 1 : -1), 0, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ── Star ─────────────────────────────────────────────────
    const starPulse = 1 + Math.sin(t * 0.05) * 0.15;
    ctx.save();
    ctx.translate(lvl.starX, lvl.starY);
    ctx.scale(starPulse, starPulse);
    // Glow
    const starGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, STAR_RADIUS * 2);
    starGlow.addColorStop(0, 'rgba(255,230,0,0.5)');
    starGlow.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.fillStyle = starGlow;
    ctx.beginPath();
    ctx.arc(0, 0, STAR_RADIUS * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${STAR_RADIUS * 2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 0, 2);
    ctx.restore();

    // ── Arm ───────────────────────────────────────────────────
    const arm = p.arm;
    if (arm.active) {
      const endX = arm.stuck ? arm.stickX : arm.tx;
      const endY = arm.stuck ? arm.stickY : arm.ty;

      // Stretchy rope - draw as wobbly thick line
      const armLen = Math.sqrt((endX - p.x) ** 2 + (endY - p.y) ** 2);
      const segments = Math.max(3, Math.floor(armLen / 20));

      ctx.strokeStyle = '#1A6B32';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (let si = 1; si < segments; si++) {
        const frac = si / segments;
        const sx = p.x + (endX - p.x) * frac + (Math.random() - 0.5) * 3 * Math.sin(frac * Math.PI);
        const sy = p.y + (endY - p.y) * frac + (Math.random() - 0.5) * 3 * Math.sin(frac * Math.PI);
        ctx.lineTo(sx, sy);
      }
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Blob at end
      ctx.fillStyle = arm.stuck ? '#2D8B4E' : '#4CAF50';
      ctx.beginPath();
      ctx.arc(endX, endY, arm.stuck ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1A6B32';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ── Player ────────────────────────────────────────────────
    const char = gs.char;
    const blink = p.invincible > 0 && Math.floor(t / 5) % 2 === 0;

    if (!blink) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.ellipse(0, PLAYER_RADIUS + 2, PLAYER_RADIUS * 0.8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = char.color;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Legs (wobbly)
      const legSwing = p.grounded ? Math.sin(t * 0.2) * 5 : (p.vy > 0 ? 4 : -4);
      ctx.strokeStyle = char.color;
      ctx.lineWidth = 3;
      // Left leg
      ctx.beginPath();
      ctx.moveTo(-6, PLAYER_RADIUS - 2);
      ctx.lineTo(-8 - legSwing, PLAYER_RADIUS + 10);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(6, PLAYER_RADIUS - 2);
      ctx.lineTo(8 + legSwing, PLAYER_RADIUS + 10);
      ctx.stroke();

      // Emoji face
      ctx.font = `${PLAYER_RADIUS * 1.3}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char.emoji, 0, 1);

      ctx.restore();
    }

    // ── Aim dotted line ───────────────────────────────────────
    if (gs.isAiming && !arm.active) {
      const dx = gs.aimX - p.x;
      const dy = gs.aimY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normX = dx / (dist || 1);
      const normY = dy / (dist || 1);
      const maxD = Math.min(dist, ARM_MAX_LENGTH);

      ctx.strokeStyle = 'rgba(45,139,78,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + normX * maxD, p.y + normY * maxD);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crosshair at aim point
      const ax2 = p.x + normX * maxD;
      const ay2 = p.y + normY * maxD;
      ctx.strokeStyle = 'rgba(45,139,78,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax2, ay2, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore(); // end camera transform

    // ── HUD ───────────────────────────────────────────────────
    // Stage name
    ctx.fillStyle = '#2D3A2E';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Stage ${gs.stageIndex + 1}: ${lvl.name}`, 14, 14);

    // Lives
    ctx.font = '22px serif';
    ctx.textAlign = 'right';
    let livesStr = '';
    for (let i = 0; i < p.lives; i++) livesStr += char.heart;
    for (let i = p.lives; i < 3; i++) livesStr += '🖤';
    ctx.fillText(livesStr, W - 10, 10);

    // Score
    ctx.fillStyle = '#2D3A2E';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`점수: ${gs.score}`, 14, 36);

    // Hint
    if (gs.hintAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(gs.hintAlpha, 1);
      ctx.fillStyle = 'rgba(45,139,78,0.85)';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('터치해서 끈끈이 발사!', W / 2, H - 20);
      ctx.restore();
    }

    // Stage banner
    if (gs.stageBanner > 0) {
      const alpha = Math.min(1, gs.stageBanner / 40) * Math.min(1, gs.stageBanner / 180 * 4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(45,60,46,0.85)';
      const bannerW = 260;
      const bannerH = 60;
      ctx.beginPath();
      ctx.roundRect(W / 2 - bannerW / 2, H / 2 - bannerH / 2, bannerW, bannerH, 12);
      ctx.fill();
      ctx.fillStyle = '#E8F5E9';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Stage ${gs.stageIndex + 1} - ${lvl.name}`, W / 2, H / 2);
      ctx.restore();
    }

    // Dead overlay
    if (p.dead && p.lives <= 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ─── Game Loop ────────────────────────────────────────────────────
  const gameLoopRef = useRef<((ts: number) => void) | null>(null);

  useEffect(() => {
    if (screen !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ensure canvas is sized
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gs = stateRef.current;
    if (gs) { gs.W = canvas.width; gs.H = canvas.height; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameLoopRef.current = (_ts: number) => {
      const gs = stateRef.current;
      if (!gs) return;

      updatePhysics(gs);
      draw(ctx, gs);

      // Check end conditions
      if (gs.player.dead) {
        cancelAnimationFrame(rafRef.current);
        if (gs.player.lives <= 0) {
          // Game over
          if (!savedRef.current) {
            savedRef.current = true;
            saveScore('sticky', gs.char.name, gs.score);
          }
          setFinalScore(gs.score);
          setTimeout(() => setScreen('over'), 600);
        } else {
          // All stages cleared (dead flag used as sentinel)
          if (!savedRef.current) {
            savedRef.current = true;
            saveScore('sticky', gs.char.name, gs.score);
          }
          setFinalScore(gs.score);
          setTimeout(() => setScreen('win'), 600);
        }
        return;
      }

      // Check if all stages done (player reached star on last stage)
      if (gs.stageIndex >= gs.levels.length) {
        cancelAnimationFrame(rafRef.current);
        if (!savedRef.current) {
          savedRef.current = true;
          saveScore('sticky', gs.char.name, gs.score);
        }
        setFinalScore(gs.score);
        setTimeout(() => setScreen('win'), 400);
        return;
      }

      rafRef.current = requestAnimationFrame(gameLoopRef.current!);
    };

    rafRef.current = requestAnimationFrame(gameLoopRef.current);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [screen]);

  // ─── Stage clear detection for "last stage + star = win" ──────────
  // We patch stageCleared to set dead=true with lives>0 to trigger win
  // Already handled above: when stageIndex >= levels.length it's a win

  // ─── Input handlers ───────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = canvas!.width / rect.width;
      const scaleY = canvas!.height / rect.height;
      if ('touches' in e) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      const gs = stateRef.current;
      if (!gs) return;
      const { x, y } = getPos(e);
      // Convert screen coords to world coords
      const worldX = x;
      const worldY = y + gs.cameraY;
      gs.isAiming = true;
      gs.aimX = worldX;
      gs.aimY = worldY;
    }

    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      const gs = stateRef.current;
      if (!gs || !gs.isAiming) return;
      const { x, y } = getPos(e);
      gs.aimX = x;
      gs.aimY = y + gs.cameraY;
    }

    function onEnd(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      const gs = stateRef.current;
      if (!gs || !gs.isAiming) return;
      gs.isAiming = false;
      let endX: number, endY: number;
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        const rect = canvas!.getBoundingClientRect();
        const scaleX = canvas!.width / rect.width;
        const scaleY = canvas!.height / rect.height;
        endX = (e.changedTouches[0].clientX - rect.left) * scaleX;
        endY = (e.changedTouches[0].clientY - rect.top) * scaleY + gs.cameraY;
      } else {
        endX = gs.aimX;
        endY = gs.aimY;
      }
      fireArm(gs, endX, endY);
    }

    canvas.addEventListener('mousedown', onStart, { passive: false });
    canvas.addEventListener('mousemove', onMove, { passive: false });
    canvas.addEventListener('mouseup', onEnd, { passive: false });
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [screen]);

  // ─── Canvas sizing ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Re-init state if game is running
      const gs = stateRef.current;
      if (gs) {
        gs.W = canvas.width;
        gs.H = canvas.height;
      }
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─── Restart ──────────────────────────────────────────────────────
  function restart() {
    savedRef.current = false;
    if (selectedChar) startGame(selectedChar);
  }

  // ─── Character Select Screen ──────────────────────────────────────
  if (screen === 'select') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100dvh',
          background: '#F5F0E8',
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(180,170,150,0.2) 27px, rgba(180,170,150,0.2) 28px),
            repeating-linear-gradient(90deg, transparent, transparent 27px, rgba(180,170,150,0.2) 27px, rgba(180,170,150,0.2) 28px)
          `,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowY: 'auto',
          padding: '20px 16px 40px',
          boxSizing: 'border-box',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Back button */}
        <a
          href="/"
          style={{
            alignSelf: 'flex-start',
            marginBottom: 8,
            fontSize: 14,
            color: '#2D8B4E',
            textDecoration: 'none',
            border: '2px solid #2D8B4E',
            padding: '4px 12px',
            borderRadius: 8,
          }}
        >
          ← 홈으로
        </a>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: '#1B5E20',
              fontStyle: 'italic',
              textShadow: '2px 2px 0 rgba(45,139,78,0.2)',
              letterSpacing: '-1px',
            }}
          >
            찐득이의 모험
          </div>
          <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
            끈끈이 팔로 용암을 탈출하라! 🔥
          </div>
        </div>

        {/* Story */}
        <div
          style={{
            background: 'rgba(255,255,255,0.6)',
            border: '2px solid #2D8B4E',
            borderRadius: 12,
            padding: '10px 16px',
            maxWidth: 360,
            fontSize: 13,
            color: '#333',
            lineHeight: 1.6,
            marginBottom: 18,
            textAlign: 'center',
          }}
        >
          끈적마을에 살던 꼬마 찐득이.<br />
          어느 날 땅이 용암이 되어버렸다.<br />
          하지만 그에겐 끈끈이 긴 팔이 있다!
        </div>

        {/* Character select */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2D8B4E', marginBottom: 12 }}>
          캐릭터를 선택하세요
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            width: '100%',
            maxWidth: 380,
          }}
        >
          {CHARACTERS.map((ch) => (
            <button
              key={ch.name}
              onClick={() => {
                setSelectedChar(ch);
                startGame(ch);
              }}
              style={{
                background: `${ch.color}22`,
                border: `2.5px solid ${ch.color}`,
                borderRadius: 14,
                padding: '14px 8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span style={{ fontSize: 32 }}>{ch.emoji}</span>
              <span style={{ fontWeight: 700, color: ch.color, fontSize: 15 }}>{ch.name}</span>
              <span style={{ fontSize: 16 }}>{ch.heart}</span>
            </button>
          ))}
        </div>

        {/* Controls hint */}
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            color: '#666',
            textAlign: 'center',
            lineHeight: 1.7,
            maxWidth: 320,
          }}
        >
          📱 터치해서 끈끈이 팔 발사<br />
          🟢 초록 발판에만 달라붙음<br />
          ⭐ 별을 먹으면 다음 스테이지<br />
          ❤️ 목숨 3개 - 용암/새 조심!
        </div>
      </div>
    );
  }

  // ─── Game Over Screen ─────────────────────────────────────────────
  if (screen === 'over') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100dvh',
          background: '#F5F0E8',
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(180,170,150,0.2) 27px, rgba(180,170,150,0.2) 28px),
            repeating-linear-gradient(90deg, transparent, transparent 27px, rgba(180,170,150,0.2) 27px, rgba(180,170,150,0.2) 28px)
          `,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 52 }}>💀</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#C62828' }}>게임 오버!</div>
        <div style={{ fontSize: 18, color: '#333' }}>
          점수: <strong>{finalScore}</strong>
        </div>
        <div style={{ fontSize: 15, color: '#555' }}>
          {selectedChar?.name} {selectedChar?.emoji}
        </div>
        <button
          onClick={restart}
          style={{
            marginTop: 8,
            background: '#2D8B4E',
            color: '#FFF',
            border: 'none',
            borderRadius: 12,
            padding: '14px 36px',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 도전!
        </button>
        <a
          href="/"
          style={{
            fontSize: 14,
            color: '#2D8B4E',
            textDecoration: 'none',
            border: '1.5px solid #2D8B4E',
            padding: '6px 20px',
            borderRadius: 8,
          }}
        >
          ← 홈으로
        </a>
      </div>
    );
  }

  // ─── Victory Screen ───────────────────────────────────────────────
  if (screen === 'win') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100dvh',
          background: '#F5F0E8',
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(180,170,150,0.2) 27px, rgba(180,170,150,0.2) 28px),
            repeating-linear-gradient(90deg, transparent, transparent 27px, rgba(180,170,150,0.2) 27px, rgba(180,170,150,0.2) 28px)
          `,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 56 }}>⭐</div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: '#1B5E20',
            textAlign: 'center',
          }}
        >
          탈출 성공! ⭐
        </div>
        <div style={{ fontSize: 16, color: '#444', textAlign: 'center', lineHeight: 1.6 }}>
          {selectedChar?.emoji} {selectedChar?.name} (이)가<br />
          끈끈이 팔로 용암을 탈출했어요!
        </div>
        <div
          style={{
            background: 'rgba(45,139,78,0.12)',
            border: '2px solid #2D8B4E',
            borderRadius: 14,
            padding: '16px 40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#555' }}>최종 점수</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#1B5E20' }}>
            {finalScore}
          </div>
        </div>
        <button
          onClick={restart}
          style={{
            background: '#2D8B4E',
            color: '#FFF',
            border: 'none',
            borderRadius: 12,
            padding: '14px 36px',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 하기
        </button>
        <a
          href="/"
          style={{
            fontSize: 14,
            color: '#2D8B4E',
            textDecoration: 'none',
            border: '1.5px solid #2D8B4E',
            padding: '6px 20px',
            borderRadius: 8,
          }}
        >
          ← 홈으로
        </a>
      </div>
    );
  }

  // ─── Game Screen ──────────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: '#F5F0E8',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
}
