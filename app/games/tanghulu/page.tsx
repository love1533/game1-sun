'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────
interface Character {
  name: string;
  color: string;
  emoji: string;
  heart: string;
  bgColor: string;
}

interface Fruit {
  id: number;
  emoji: string;
  name: string;
  x: number;
  y: number;
  vy: number;
  size: number;
  isGolden: boolean;
  caught: boolean;
  missed: boolean;
  sparkleTime?: number;
}

interface SkeweredFruit {
  emoji: string;
  isGolden: boolean;
  isCorrect: boolean;
  coatProgress: number; // 0-1, sugar coating
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'star' | 'circle' | 'heart' | 'sparkle';
  rotation: number;
  rotSpeed: number;
}

interface RoundResult {
  skewered: SkeweredFruit[];
  isPerfect: boolean;
  score: number;
}

type Phase =
  | 'select'
  | 'playing'
  | 'coating'
  | 'eating'
  | 'roundEnd'
  | 'gameover'
  | 'final';

// ─── Constants ───────────────────────────────────────────────────
const CHARACTERS: Character[] = [
  { name: '수현', color: '#E74C3C', emoji: '🧢', heart: '❤️', bgColor: '#FFEBEE' },
  { name: '이현', color: '#FF69B4', emoji: '👸', heart: '💗', bgColor: '#FCE4EC' },
  { name: '은영', color: '#FF6B9D', emoji: '🌸', heart: '🌸', bgColor: '#FFF0F5' },
  { name: '민구', color: '#F39C12', emoji: '🏴‍☠️', heart: '🧡', bgColor: '#FFF8E1' },
];

const FRUITS = [
  { emoji: '🍓', name: '딸기' },
  { emoji: '🍇', name: '포도' },
  { emoji: '🍊', name: '귤' },
  { emoji: '🍑', name: '복숭아' },
  { emoji: '🥝', name: '키위' },
  { emoji: '🍌', name: '바나나' },
];

const TOTAL_ROUNDS = 10;
const SKEWER_MAX = 5;
const MISS_PER_ROUND = 3;
const FRUIT_SIZE = 52;
const SPAWN_INTERVAL = 1800; // ms between spawns
const FRUIT_FALL_SPEED = 1.6; // slow = easy
const GOLDEN_CHANCE = 0.06; // 6% chance

const PASTEL_COLORS = [
  '#FFB3C6', '#FFCCE0', '#FFDDE8', '#FFB3D9',
  '#FFD6E8', '#FFC9E3', '#FFB8D1', '#FFADC6',
];

// ─── Audio helpers ───────────────────────────────────────────────
function playChime(ctx: AudioContext, freq = 880) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.2, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* ignore */ }
}

function playCrunch(ctx: AudioContext) {
  try {
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.8;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    source.start(ctx.currentTime);
  } catch { /* ignore */ }
}

function playSparkle(ctx: AudioContext) {
  try {
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch { /* ignore */ }
}

function playMiss(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch { /* ignore */ }
}

// ─── Recipe generator ────────────────────────────────────────────
function generateRecipe(): string[] {
  const recipe: string[] = [];
  for (let i = 0; i < SKEWER_MAX; i++) {
    recipe.push(FRUITS[Math.floor(Math.random() * FRUITS.length)].emoji);
  }
  return recipe;
}

// ─── Main component ───────────────────────────────────────────────
export default function TanghuluPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({
    phase: 'select' as Phase,
    selectedChar: 1, // 이현 default
    round: 1,
    totalScore: 0,
    roundScore: 0,
    misses: 0,
    fruits: [] as Fruit[],
    skewered: [] as SkeweredFruit[],
    particles: [] as Particle[],
    recipe: [] as string[],
    roundResults: [] as RoundResult[],
    spawnTimer: 0,
    lastTime: 0,
    coatProgress: 0,
    eatingTimer: 0,
    eatingFrame: 0,
    roundEndTimer: 0,
    nextFruitId: 0,
    gleamAngle: 0,
    bgStars: [] as { x: number; y: number; size: number; twinkle: number }[],
    canvasW: 0,
    canvasH: 0,
    floatingTexts: [] as { x: number; y: number; text: string; life: number; color: string; vy: number }[],
  });

  const [uiPhase, setUiPhase] = useState<Phase>('select');
  const [selectedChar, setSelectedChar] = useState(1);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // ─── Particle helpers ─────────────────────────────────────────
  const spawnCatchParticles = useCallback((particles: Particle[], x: number, y: number, isGolden: boolean) => {
    const colors = isGolden
      ? ['#FFD700', '#FFC200', '#FFEA70', '#FFF3A0']
      : ['#FFB3C6', '#FF69B4', '#FFCCE0', '#FF1493', '#FF85C1'];
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
      const speed = 2.5 + Math.random() * 3.5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 5,
        type: isGolden ? 'star' : (Math.random() < 0.4 ? 'heart' : 'circle'),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  }, []);

  const spawnPerfectParticles = useCallback((particles: Particle[], cx: number, cy: number) => {
    const colors = ['#FFD700', '#FF69B4', '#FFCCE0', '#FF85C1', '#FFF000', '#FF1493'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      particles.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 7,
        type: Math.random() < 0.3 ? 'star' : (Math.random() < 0.5 ? 'heart' : 'sparkle'),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.4,
      });
    }
  }, []);

  // ─── Drawing helpers ──────────────────────────────────────────
  const drawEmoji = (ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) => {
    ctx.save();
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
    ctx.restore();
  };

  const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rotation = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.lineTo(Math.cos(innerAngle) * (r * 0.4), Math.sin(innerAngle) * (r * 0.4));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotation = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size * 0.5, -size * 0.2, -size, size * 0.1, 0, size);
    ctx.bezierCurveTo(size, size * 0.1, size * 0.5, -size * 0.2, 0, size * 0.3);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life) * 0.92;
    if (p.type === 'star') {
      drawStar(ctx, p.x, p.y, p.size, p.color, p.rotation);
    } else if (p.type === 'heart') {
      drawHeart(ctx, p.x, p.y, p.size * 0.6, p.color, p.rotation);
    } else if (p.type === 'sparkle') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      const len = p.size * 1.4;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + p.rotation;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  };

  // ─── Game scenes ──────────────────────────────────────────────

  const drawBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    // Pastel gradient bg
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFF0F8');
    grad.addColorStop(0.5, '#FFE8F4');
    grad.addColorStop(1, '#FFD6EC');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Floating bg hearts/stars
    const st = stateRef.current;
    st.bgStars.forEach((s, i) => {
      const tw = Math.sin(t * 0.001 + i * 1.3) * 0.4 + 0.6;
      ctx.save();
      ctx.globalAlpha = tw * 0.18;
      const symbols = ['✨', '💗', '⭐', '🌸', '💕'];
      ctx.font = `${s.size * 16}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbols[i % symbols.length], s.x * w, s.y * h);
      ctx.restore();
    });
  };

  const drawSkewer = (ctx: CanvasRenderingContext2D, w: number, h: number, skewered: SkeweredFruit[], coatProgress: number, phase: Phase) => {
    const sx = w / 2;
    const stickTop = h * 0.12;
    const fruitSpacing = 62;
    const firstFruitY = h * 0.82;

    // Wooden stick
    const stickGrad = ctx.createLinearGradient(sx - 6, 0, sx + 6, 0);
    stickGrad.addColorStop(0, '#D4A574');
    stickGrad.addColorStop(0.3, '#E8C99A');
    stickGrad.addColorStop(0.6, '#C8935A');
    stickGrad.addColorStop(1, '#B87840');
    ctx.save();
    ctx.strokeStyle = stickGrad;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(180,120,60,0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(sx, firstFruitY + 70);
    ctx.lineTo(sx, stickTop);
    ctx.stroke();
    ctx.restore();

    // Stick tip sparkle
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', sx, stickTop - 6);
    ctx.restore();

    // Draw fruits on skewer (bottom to top)
    skewered.forEach((f, i) => {
      const fy = firstFruitY - i * fruitSpacing;
      if (fy < stickTop) return;

      // Sugar coat glow
      if (phase === 'coating' || phase === 'eating' || phase === 'roundEnd' || phase === 'final') {
        const coatAlpha = Math.min(1, coatProgress * 1.2);
        if (coatAlpha > 0) {
          const coatGrad = ctx.createRadialGradient(sx, fy, 10, sx, fy, 38);
          coatGrad.addColorStop(0, `rgba(255,255,255,${coatAlpha * 0.7})`);
          coatGrad.addColorStop(0.4, `rgba(255,220,240,${coatAlpha * 0.5})`);
          coatGrad.addColorStop(1, `rgba(255,180,220,${coatAlpha * 0.1})`);
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, fy, 36, 0, Math.PI * 2);
          ctx.fillStyle = coatGrad;
          ctx.fill();
          ctx.restore();

          // Shiny gleam sweep
          if (coatProgress > 0.3) {
            const gleam = stateRef.current.gleamAngle;
            ctx.save();
            ctx.beginPath();
            ctx.arc(sx, fy, 32, 0, Math.PI * 2);
            ctx.clip();
            const gleamGrad = ctx.createLinearGradient(
              sx + Math.cos(gleam) * -40,
              fy + Math.sin(gleam) * -40,
              sx + Math.cos(gleam) * 40,
              fy + Math.sin(gleam) * 40,
            );
            gleamGrad.addColorStop(0, 'rgba(255,255,255,0)');
            gleamGrad.addColorStop(0.45, 'rgba(255,255,255,0)');
            gleamGrad.addColorStop(0.5, `rgba(255,255,255,${coatAlpha * 0.75})`);
            gleamGrad.addColorStop(0.55, 'rgba(255,255,255,0)');
            gleamGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gleamGrad;
            ctx.fillRect(sx - 40, fy - 40, 80, 80);
            ctx.restore();
          }
        }
      }

      // Golden glow ring
      if (f.isGolden) {
        ctx.save();
        const glowGrad = ctx.createRadialGradient(sx, fy, 18, sx, fy, 38);
        glowGrad.addColorStop(0, 'rgba(255,215,0,0.45)');
        glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(sx, fy, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Correct indicator dot
      if (f.isCorrect) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx + 24, fy - 20, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#FF69B4';
        ctx.fill();
        ctx.font = '9px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', sx + 24, fy - 20);
        ctx.restore();
      }

      drawEmoji(ctx, f.emoji, sx, fy, 46);
    });
  };

  const drawRecipe = (ctx: CanvasRenderingContext2D, w: number, recipe: string[], skewered: SkeweredFruit[]) => {
    const boxW = 220;
    const boxH = 48;
    const bx = (w - boxW) / 2;
    const by = 14;

    // Recipe card bg
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.shadowColor = 'rgba(255,105,180,0.18)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.strokeStyle = '#FFB3D9';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.textAlign = 'center';
    ctx.fillText('🍡 오늘의 레시피', w / 2, by + 14);
    ctx.restore();

    const startX = w / 2 - ((recipe.length * 34) / 2) + 17;
    recipe.forEach((emoji, i) => {
      const rx = startX + i * 34;
      const ry = by + 32;
      const matched = skewered[i]?.emoji === emoji || skewered[i]?.isGolden;

      if (matched) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(rx, ry, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,105,180,0.2)';
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = matched ? 1 : 0.5;
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, rx, ry);
      ctx.restore();
    });
  };

  const drawHUD = (ctx: CanvasRenderingContext2D, w: number, h: number, round: number, totalScore: number, misses: number, char: Character) => {
    // Top info bar
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.roundRect(8, 70, 110, 38, 12);
    ctx.fill();
    ctx.strokeStyle = '#FFB3D9';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#E75480';
    ctx.textAlign = 'left';
    ctx.fillText(`라운드 ${round}/${TOTAL_ROUNDS}`, 16, 85);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.fillText(`✨ ${totalScore.toLocaleString()}`, 16, 100);
    ctx.restore();

    // Miss hearts (right side)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.roundRect(w - 100, 70, 92, 38, 12);
    ctx.fill();
    ctx.strokeStyle = '#FFB3D9';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('실패', w - 54, 83);
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    const heartsStr = Array(MISS_PER_ROUND).fill('♡').map((h, i) => i < misses ? '💔' : '❤️').join('');
    ctx.fillText(heartsStr, w - 54, 100);
    ctx.restore();

    // Character badge bottom left
    ctx.save();
    ctx.beginPath();
    ctx.arc(28, h - 32, 22, 0, Math.PI * 2);
    ctx.fillStyle = char.bgColor;
    ctx.shadowColor = char.color + '66';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.strokeStyle = char.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char.emoji, 28, h - 32);
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = char.color;
    ctx.textAlign = 'center';
    ctx.fillText(char.name, 28, h - 6);
    ctx.restore();
  };

  const drawFruits = (ctx: CanvasRenderingContext2D, fruits: Fruit[], t: number) => {
    fruits.forEach((f) => {
      if (f.caught || f.missed) return;

      // Catch zone circle (gentle glow)
      ctx.save();
      const pulseR = 32 + Math.sin(t * 0.004 + f.id) * 4;
      const zoneGrad = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, pulseR + 8);
      zoneGrad.addColorStop(0, 'rgba(255,105,180,0.12)');
      zoneGrad.addColorStop(1, 'rgba(255,105,180,0)');
      ctx.fillStyle = zoneGrad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, pulseR + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Golden sparkle ring
      if (f.isGolden) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(f.x, f.y, 34, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,215,0,${0.5 + Math.sin(t * 0.008) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.restore();
      }

      // Fruit emoji
      ctx.save();
      const wobble = Math.sin(t * 0.004 + f.id * 0.8) * 3;
      ctx.translate(f.x + wobble * 0.3, f.y);
      ctx.font = `${f.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (f.isGolden) {
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
      }
      ctx.fillText(f.isGolden ? '🌟' : f.emoji, 0, 0);
      ctx.restore();

      // Fruit name label
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = f.isGolden ? '#B8860B' : '#FF69B4';
      ctx.textAlign = 'center';
      ctx.fillText(f.isGolden ? '황금!' : f.name, f.x, f.y + 32);
      ctx.restore();
    });
  };

  const drawFloatingTexts = (ctx: CanvasRenderingContext2D, texts: typeof stateRef.current.floatingTexts) => {
    texts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  };

  // ─── Scenes ───────────────────────────────────────────────────

  const drawCoatingScene = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const st = stateRef.current;
    drawBackground(ctx, w, h, t);
    drawSkewer(ctx, w, h, st.skewered, st.coatProgress, 'coating');

    ctx.save();
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.textAlign = 'center';
    ctx.fillText('🍬 설탕 코팅 중~! ✨', w / 2, h * 0.1);
    ctx.restore();

    // Sugar drizzle animation
    if (st.coatProgress < 1) {
      const dropCount = 8;
      for (let i = 0; i < dropCount; i++) {
        const angle = (i / dropCount) * Math.PI * 2 + t * 0.003;
        const r = 45 + Math.sin(t * 0.005 + i) * 8;
        const firstFruitY = h * 0.82;
        const cx2 = w / 2 + Math.cos(angle) * r;
        const cy2 = firstFruitY - (st.skewered.length - 1) * 62 * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx2, cy2, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,230,${0.5 + Math.sin(t * 0.01 + i) * 0.3})`;
        ctx.fill();
        ctx.restore();
      }
    }

    drawParticlesScene(ctx, st.particles);
  };

  const drawEatingScene = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const st = stateRef.current;
    const char = CHARACTERS[st.selectedChar];
    drawBackground(ctx, w, h, t);

    // Character eating animation
    const bounce = Math.abs(Math.sin(st.eatingFrame * 0.15)) * 12;
    const charY = h * 0.45 - bounce;

    // Character circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, charY, 55, 0, Math.PI * 2);
    ctx.fillStyle = char.bgColor;
    ctx.shadowColor = char.color + '88';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.strokeStyle = char.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Happy eating emoji
    const happyEmojis = ['😋', '🤤', '😄', '🥰', '😍'];
    const eIdx = Math.floor(st.eatingFrame / 8) % happyEmojis.length;
    ctx.font = '60px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(happyEmojis[eIdx], w / 2, charY);

    // Character name
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = char.color;
    ctx.textAlign = 'center';
    ctx.fillText(char.name, w / 2, charY + 72);
    ctx.restore();

    // Tanghulu in hand
    ctx.save();
    ctx.font = '44px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍡', w / 2 + 70, charY + 10);
    ctx.restore();

    // Cute message
    const msgs = ['냠냠~ 맛있어! 💗', '탕후루 최고야! ✨', '달달해~ 🍬', '또 만들고 싶다! 🌟'];
    const mIdx = Math.floor(st.eatingFrame / 20) % msgs.length;
    ctx.save();
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.textAlign = 'center';
    ctx.fillText(msgs[mIdx], w / 2, h * 0.7);
    ctx.restore();

    // Round score popup
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 90, h * 0.76, 180, 44, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#FFB3D9';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.textAlign = 'center';
    ctx.fillText(`이번 라운드: +${st.roundScore}점 ✨`, w / 2, h * 0.76 + 27);
    ctx.restore();

    drawParticlesScene(ctx, st.particles);
  };

  const drawParticlesScene = (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    particles.forEach((p) => drawParticle(ctx, p));
  };

  const drawRoundEndBanner = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const st = stateRef.current;
    const lastResult = st.roundResults[st.roundResults.length - 1];

    // Dim overlay
    ctx.save();
    ctx.fillStyle = 'rgba(255,220,240,0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Card
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 130, h / 2 - 90, 260, 180, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.shadowColor = '#FFB3D9';
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.strokeStyle = '#FF69B4';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    if (lastResult?.isPerfect) {
      ctx.font = '36px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎉', w / 2, h / 2 - 62);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#FF69B4';
      ctx.fillText('퍼펙트 탕후루! 🌟', w / 2, h / 2 - 30);
    } else {
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍡', w / 2, h / 2 - 58);
      ctx.font = 'bold 19px sans-serif';
      ctx.fillStyle = '#FF85C1';
      ctx.fillText('탕후루 완성!', w / 2, h / 2 - 28);
    }

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#E75480';
    ctx.textAlign = 'center';
    ctx.fillText(`+${lastResult?.score ?? 0}점`, w / 2, h / 2 + 6);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(
      st.round < TOTAL_ROUNDS ? `다음 라운드: ${st.round + 1}/${TOTAL_ROUNDS}` : '마지막 라운드!',
      w / 2,
      h / 2 + 32,
    );

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#FFB3D9';
    ctx.fillText('탭해서 계속하기 👆', w / 2, h / 2 + 60);
  };

  const drawGameOverScreen = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const st = stateRef.current;
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFF0F8');
    grad.addColorStop(1, '#FFD6EC');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.font = '52px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😢', w / 2, h * 0.28);

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#FF6B9D';
    ctx.textAlign = 'center';
    ctx.fillText('게임 오버!', w / 2, h * 0.42);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#FF85C1';
    ctx.fillText(`총 점수: ${st.totalScore.toLocaleString()}점`, w / 2, h * 0.52);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#FFB3D9';
    ctx.fillText('실수가 너무 많았어요 💔', w / 2, h * 0.60);

    // Retry button
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 90, h * 0.68, 180, 48, 18);
    ctx.fillStyle = '#FF69B4';
    ctx.shadowColor = 'rgba(255,105,180,0.4)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('다시 도전! 🍡', w / 2, h * 0.68 + 28);
    ctx.restore();
  };

  const drawFinalScreen = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const st = stateRef.current;
    const char = CHARACTERS[st.selectedChar];

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FFF0F8');
    grad.addColorStop(1, '#FFD6EC');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    drawParticlesScene(ctx, st.particles);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.textAlign = 'center';
    ctx.fillText('🎊 탕후루 완성 보고서 🎊', w / 2, 36);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#E75480';
    ctx.fillText(`총 점수: ${st.totalScore.toLocaleString()}점 ✨`, w / 2, 64);

    const perfects = st.roundResults.filter((r) => r.isPerfect).length;
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#FF85C1';
    ctx.fillText(`퍼펙트: ${perfects}/${TOTAL_ROUNDS} 🌟`, w / 2, 84);

    // Round result grid
    const cols = 5;
    const cellW = (w - 32) / cols;
    const cellH = 96;
    const gridTop = 100;

    st.roundResults.forEach((r, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = 16 + col * cellW + cellW / 2;
      const cy = gridTop + row * cellH;

      // Card bg
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx - cellW / 2 + 3, cy + 4, cellW - 6, cellH - 8, 10);
      ctx.fillStyle = r.isPerfect ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.7)';
      ctx.strokeStyle = r.isPerfect ? '#FFD700' : '#FFB3D9';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Round number
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#FF85C1';
      ctx.textAlign = 'center';
      ctx.fillText(`R${i + 1}`, cx, cy + 18);

      // Mini tanghulu
      const fruitY = cy + 28;
      const fruitSpacing = 12;
      const fruitEmojis = r.skewered.slice(0, 5);
      fruitEmojis.forEach((f, fi) => {
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.emoji, cx, fruitY + fi * fruitSpacing);
      });

      // Stars
      const stars = r.isPerfect ? 3 : r.score >= 300 ? 2 : 1;
      ctx.font = '10px serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐'.repeat(stars), cx, cy + cellH - 14);
    });

    // Total star rating
    const avgScore = st.totalScore / TOTAL_ROUNDS;
    let rating = '⭐';
    if (avgScore >= 500) rating = '⭐⭐⭐';
    else if (avgScore >= 300) rating = '⭐⭐';
    const ratingY = gridTop + Math.ceil(TOTAL_ROUNDS / cols) * cellH + 16;
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText(rating, w / 2, ratingY);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.fillText(`${char.name}의 탕후루 솜씨! ${char.heart}`, w / 2, ratingY + 30);

    // Retry button
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(w / 2 - 95, ratingY + 50, 190, 46, 18);
    ctx.fillStyle = '#FF69B4';
    ctx.shadowColor = 'rgba(255,105,180,0.4)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('처음부터 다시! 🍡', w / 2, ratingY + 78);
    ctx.restore();
  };

  // ─── Game logic ───────────────────────────────────────────────

  const startRound = useCallback(() => {
    const st = stateRef.current;
    st.recipe = generateRecipe();
    st.fruits = [];
    st.skewered = [];
    st.misses = 0;
    st.roundScore = 0;
    st.spawnTimer = 0;
    st.coatProgress = 0;
    st.phase = 'playing';
    setUiPhase('playing');
  }, []);

  const startGame = useCallback((charIdx: number) => {
    const st = stateRef.current;
    st.selectedChar = charIdx;
    st.round = 1;
    st.totalScore = 0;
    st.roundResults = [];
    st.particles = [];
    st.floatingTexts = [];
    startRound();
  }, [startRound]);

  const endRound = useCallback(() => {
    const st = stateRef.current;
    const isPerfect = st.skewered.length === SKEWER_MAX &&
      st.skewered.every((f, i) => f.emoji === st.recipe[i] || f.isGolden);
    const bonus = isPerfect ? 500 : 0;
    st.roundScore += bonus;
    st.totalScore += st.roundScore;

    st.roundResults.push({
      skewered: [...st.skewered],
      isPerfect,
      score: st.roundScore,
    });

    if (isPerfect) {
      const ctx = getAudioCtx();
      playSparkle(ctx);
      spawnPerfectParticles(st.particles, st.canvasW / 2, st.canvasH * 0.5);
    }

    st.phase = 'coating';
    st.coatProgress = 0;
    setUiPhase('coating');
  }, [getAudioCtx, spawnPerfectParticles]);

  const catchFruit = useCallback((fruitId: number) => {
    const st = stateRef.current;
    if (st.phase !== 'playing') return;
    if (st.skewered.length >= SKEWER_MAX) return;

    const fruit = st.fruits.find((f) => f.id === fruitId && !f.caught && !f.missed);
    if (!fruit) return;

    fruit.caught = true;

    const recipePos = st.skewered.length;
    const isCorrect = fruit.isGolden || fruit.emoji === st.recipe[recipePos];
    const pts = fruit.isGolden ? 200 : isCorrect ? 100 : 30;

    st.skewered.push({
      emoji: fruit.isGolden ? '🌟' : fruit.emoji,
      isGolden: fruit.isGolden,
      isCorrect,
      coatProgress: 0,
    });

    st.roundScore += pts;

    // Floating score text
    st.floatingTexts.push({
      x: fruit.x,
      y: fruit.y,
      text: fruit.isGolden ? `+${pts} 황금!` : `+${pts}`,
      life: 1,
      color: fruit.isGolden ? '#B8860B' : isCorrect ? '#FF69B4' : '#FF85C1',
      vy: -1.5,
    });

    spawnCatchParticles(st.particles, fruit.x, fruit.y, fruit.isGolden);

    const ctx2 = getAudioCtx();
    if (fruit.isGolden) playChime(ctx2, 1200);
    else if (isCorrect) playChime(ctx2, 880);
    else playChime(ctx2, 660);

    if (st.skewered.length >= SKEWER_MAX) {
      endRound();
    }
  }, [getAudioCtx, spawnCatchParticles, endRound]);

  // ─── Main game loop ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stateRef.current.canvasW = canvas.width;
      stateRef.current.canvasH = canvas.height;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init bg stars
    const st = stateRef.current;
    st.bgStars = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1,
      twinkle: Math.random() * Math.PI * 2,
    }));

    const ctx = canvas.getContext('2d')!;
    let lastTime = 0;

    const loop = (t: number) => {
      const dt = Math.min(t - lastTime, 50);
      lastTime = t;

      const w = canvas.width;
      const h = canvas.height;
      const s = stateRef.current;
      s.gleamAngle += 0.03;

      ctx.clearRect(0, 0, w, h);

      // ── SELECT ──────────────────────────────────────────────────
      if (s.phase === 'select') {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── PLAYING ─────────────────────────────────────────────────
      if (s.phase === 'playing') {
        drawBackground(ctx, w, h, t);
        drawRecipe(ctx, w, s.recipe, s.skewered);
        drawSkewer(ctx, w, h, s.skewered, 0, 'playing');

        // Spawn fruits
        s.spawnTimer += dt;
        if (s.spawnTimer >= SPAWN_INTERVAL && s.skewered.length < SKEWER_MAX) {
          s.spawnTimer = 0;
          const isGolden = Math.random() < GOLDEN_CHANCE;
          const fruitDef = FRUITS[Math.floor(Math.random() * FRUITS.length)];
          const margin = 60;
          s.fruits.push({
            id: s.nextFruitId++,
            emoji: fruitDef.emoji,
            name: fruitDef.name,
            x: margin + Math.random() * (w - margin * 2),
            y: -30,
            vy: FRUIT_FALL_SPEED + Math.random() * 0.5,
            size: FRUIT_SIZE,
            isGolden,
            caught: false,
            missed: false,
          });
        }

        // Update fruits
        s.fruits.forEach((f) => {
          if (f.caught || f.missed) return;
          f.y += f.vy;
          if (f.y > h + 40) {
            f.missed = true;
            s.misses++;
            const audioCtx = getAudioCtx();
            playMiss(audioCtx);

            s.floatingTexts.push({
              x: f.x,
              y: h - 80,
              text: '놓쳤다! 💔',
              life: 1,
              color: '#FF6B6B',
              vy: -1,
            });

            if (s.misses >= MISS_PER_ROUND) {
              // Force end round with what we have
              endRound();
            }
          }
        });

        // Cleanup old fruits
        if (s.fruits.length > 20) {
          s.fruits = s.fruits.filter((f) => !f.missed || f.y < h + 100);
        }

        drawFruits(ctx, s.fruits, t);

        drawHUD(ctx, w, h, s.round, s.totalScore, s.misses, CHARACTERS[s.selectedChar]);

        // Particles
        s.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12;
          p.life -= 0.025;
          p.rotation += p.rotSpeed;
        });
        s.particles = s.particles.filter((p) => p.life > 0);
        drawParticlesScene(ctx, s.particles);
        drawFloatingTexts(ctx, s.floatingTexts);

        s.floatingTexts.forEach((ft) => {
          ft.y += ft.vy;
          ft.life -= 0.02;
        });
        s.floatingTexts = s.floatingTexts.filter((ft) => ft.life > 0);
      }

      // ── COATING ─────────────────────────────────────────────────
      if (s.phase === 'coating') {
        s.coatProgress += dt * 0.002;
        if (s.coatProgress >= 1) {
          s.coatProgress = 1;
          const audioCtx = getAudioCtx();
          playCrunch(audioCtx);
          s.phase = 'eating';
          s.eatingFrame = 0;
          setUiPhase('eating');
        }
        drawCoatingScene(ctx, w, h, t);
        s.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1;
          p.life -= 0.02;
          p.rotation += p.rotSpeed;
        });
        s.particles = s.particles.filter((p) => p.life > 0);
      }

      // ── EATING ──────────────────────────────────────────────────
      if (s.phase === 'eating') {
        s.eatingFrame++;
        if (s.eatingFrame > 90) {
          s.phase = 'roundEnd';
          setUiPhase('roundEnd');
          s.roundEndTimer = 0;
        }
        drawEatingScene(ctx, w, h, t);
        s.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.1;
          p.life -= 0.018;
          p.rotation += p.rotSpeed;
        });
        s.particles = s.particles.filter((p) => p.life > 0);
      }

      // ── ROUND END ───────────────────────────────────────────────
      if (s.phase === 'roundEnd') {
        drawBackground(ctx, w, h, t);
        drawSkewer(ctx, w, h, s.skewered, 1, 'roundEnd');
        drawParticlesScene(ctx, s.particles);
        drawRoundEndBanner(ctx, w, h);
      }

      // ── GAME OVER ───────────────────────────────────────────────
      if (s.phase === 'gameover') {
        drawGameOverScreen(ctx, w, h);
      }

      // ── FINAL ───────────────────────────────────────────────────
      if (s.phase === 'final') {
        drawFinalScreen(ctx, w, h, t);
        s.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.life -= 0.008;
          p.rotation += p.rotSpeed;
        });
        s.particles = s.particles.filter((p) => p.life > 0);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [getAudioCtx, spawnCatchParticles, spawnPerfectParticles, endRound]);

  // ─── Touch / click handler ────────────────────────────────────
  const handleCanvasInteract = useCallback((cx: number, cy: number) => {
    const st = stateRef.current;
    getAudioCtx(); // unlock audio

    if (st.phase === 'playing') {
      // Check fruit hits (generous catch zone)
      let hit = false;
      for (const fruit of st.fruits) {
        if (fruit.caught || fruit.missed) continue;
        const dx = cx - fruit.x;
        const dy = cy - fruit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 54) {
          catchFruit(fruit.id);
          hit = true;
          break;
        }
      }
      return hit;
    }

    if (st.phase === 'roundEnd') {
      if (st.round >= TOTAL_ROUNDS) {
        st.phase = 'final';
        st.particles = [];
        spawnPerfectParticles(st.particles, st.canvasW / 2, st.canvasH * 0.4);
        setUiPhase('final');
      } else {
        st.round++;
        startRound();
      }
      return true;
    }

    if (st.phase === 'gameover') {
      // Tap retry button
      const w = st.canvasW;
      const h = st.canvasH;
      const btnY = h * 0.68;
      if (cy > btnY && cy < btnY + 48 && cx > w / 2 - 90 && cx < w / 2 + 90) {
        setUiPhase('select');
        st.phase = 'select';
      }
      return true;
    }

    if (st.phase === 'final') {
      const w = st.canvasW;
      const h = st.canvasH;
      // tap anywhere on bottom area
      if (cy > h * 0.8) {
        setUiPhase('select');
        st.phase = 'select';
      }
      return true;
    }

    return false;
  }, [getAudioCtx, catchFruit, startRound, spawnPerfectParticles]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    handleCanvasInteract(t.clientX - rect.left, t.clientY - rect.top);
  }, [handleCanvasInteract]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    handleCanvasInteract(e.clientX - rect.left, e.clientY - rect.top);
  }, [handleCanvasInteract]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#FFF0F8', position: 'relative' }}>
      <style>{`
        @keyframes kawaii-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.05); }
        }
        @keyframes sparkle-spin {
          0% { transform: rotate(0deg) scale(1); opacity: 1; }
          50% { transform: rotate(180deg) scale(1.2); opacity: 0.8; }
          100% { transform: rotate(360deg) scale(1); opacity: 1; }
        }
        @keyframes pink-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,105,180,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(255,105,180,0); }
        }
        @keyframes float-up {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
        .char-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .char-card:active { transform: scale(0.92) !important; }
        .char-selected {
          animation: pink-pulse 1.4s ease-in-out infinite;
        }
      `}</style>

      <canvas
        ref={canvasRef}
        style={{
          display: uiPhase === 'select' ? 'none' : 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
        onTouchStart={onTouchStart}
        onMouseDown={onMouseDown}
      />

      {/* ── SELECT SCREEN (HTML overlay) ── */}
      {uiPhase === 'select' && (
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(160deg, #FFF0F8 0%, #FFE8F4 50%, #FFD6EC 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          gap: '0',
          overflowY: 'auto',
        }}>
          {/* Floating decorations */}
          {['✨', '💗', '🌸', '⭐', '💕'].map((sym, i) => (
            <span key={i} style={{
              position: 'fixed',
              fontSize: '18px',
              top: `${10 + i * 18}%`,
              left: i % 2 === 0 ? `${4 + i * 2}%` : `${88 - i * 2}%`,
              animation: `kawaii-bounce ${2 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              opacity: 0.6,
              pointerEvents: 'none',
            }}>{sym}</span>
          ))}

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '52px', animation: 'kawaii-bounce 2s ease-in-out infinite' }}>🍡</div>
            <h1 style={{
              fontSize: '26px',
              fontWeight: '900',
              color: '#FF69B4',
              margin: '4px 0 2px',
              textShadow: '0 2px 8px rgba(255,105,180,0.3)',
            }}>탕후루 만들기</h1>
            <p style={{ fontSize: '13px', color: '#FF85C1', margin: 0 }}>달콤한 탕후루를 만들어봐요! ✨</p>
          </div>

          {/* 이현 특별 추천 badge */}
          <div style={{
            background: 'linear-gradient(135deg, #FFD6EC, #FFADD5)',
            border: '2px solid #FF69B4',
            borderRadius: '20px',
            padding: '8px 20px',
            marginBottom: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(255,105,180,0.25)',
            animation: 'pink-pulse 1.8s ease-in-out infinite',
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#FF1493' }}>
              💗 이현이가 특별히 좋아하는 게임! 💗
            </span>
          </div>

          {/* How to play */}
          <div style={{
            background: 'rgba(255,255,255,0.85)',
            borderRadius: '20px',
            border: '1.5px solid #FFB3D9',
            padding: '12px 18px',
            marginBottom: '18px',
            maxWidth: '340px',
            width: '100%',
          }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#FF69B4', margin: '0 0 6px', textAlign: 'center' }}>
              🎮 게임 방법
            </p>
            {[
              '🍓 떨어지는 과일을 탭해서 꼬치에 꿰어요',
              '📋 위의 레시피 순서대로 꿰면 보너스!',
              '🌟 황금 과일은 항상 정답 + 2배 점수',
              '💔 3번 놓치면 라운드 종료',
              '🍡 10라운드 탕후루 만들기!',
            ].map((tip, i) => (
              <p key={i} style={{ fontSize: '11px', color: '#888', margin: '2px 0' }}>{tip}</p>
            ))}
          </div>

          {/* Character select */}
          <p style={{ fontSize: '14px', fontWeight: '700', color: '#FF69B4', marginBottom: '10px' }}>
            캐릭터 선택 💕
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '320px', width: '100%' }}>
            {CHARACTERS.map((char, i) => {
              const isSelected = selectedChar === i;
              const isIhyeon = i === 1;
              return (
                <div
                  key={char.name}
                  className={`char-card ${isSelected ? 'char-selected' : ''}`}
                  onClick={() => setSelectedChar(i)}
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${char.bgColor}, white)`
                      : 'rgba(255,255,255,0.8)',
                    border: isSelected ? `2.5px solid ${char.color}` : '2px solid #FFD6EC',
                    borderRadius: '20px',
                    padding: '14px 10px',
                    textAlign: 'center',
                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    boxShadow: isSelected ? `0 6px 20px ${char.color}44` : '0 2px 10px rgba(255,180,220,0.2)',
                    position: 'relative',
                  }}
                >
                  {isIhyeon && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #FF69B4, #FF1493)',
                      color: 'white',
                      fontSize: '9px',
                      fontWeight: '800',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(255,20,147,0.4)',
                    }}>이현's 추천! ⭐</div>
                  )}
                  <div style={{ fontSize: '36px', margin: '4px 0' }}>{char.emoji}</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: char.color }}>{char.name}</div>
                  <div style={{ fontSize: '16px', marginTop: '2px' }}>{char.heart}</div>
                </div>
              );
            })}
          </div>

          {/* Start button */}
          <button
            onClick={() => startGame(selectedChar)}
            style={{
              marginTop: '20px',
              background: `linear-gradient(135deg, #FF69B4, #FF1493)`,
              color: 'white',
              border: 'none',
              borderRadius: '28px',
              padding: '16px 52px',
              fontSize: '18px',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(255,20,147,0.35)',
              letterSpacing: '0.5px',
              animation: 'pink-pulse 1.6s ease-in-out infinite',
            }}
          >
            탕후루 만들기 시작! 🍡
          </button>

          {/* Back link */}
          <Link href="/" style={{
            marginTop: '14px',
            fontSize: '13px',
            color: '#FFB3D9',
            textDecoration: 'none',
            fontWeight: '600',
          }}>← 홈으로 돌아가기</Link>
        </div>
      )}

      {/* Back button overlay during game */}
      {(uiPhase === 'playing' || uiPhase === 'coating' || uiPhase === 'eating') && (
        <Link href="/" style={{
          position: 'fixed',
          top: '14px',
          left: '14px',
          background: 'rgba(255,255,255,0.85)',
          border: '1.5px solid #FFB3D9',
          borderRadius: '20px',
          padding: '5px 12px',
          fontSize: '12px',
          color: '#FF69B4',
          textDecoration: 'none',
          fontWeight: '700',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
        }}>← 홈</Link>
      )}
    </div>
  );
}
